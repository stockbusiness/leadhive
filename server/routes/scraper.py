import ipaddress
import socket
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from urllib.parse import urlparse
from server.database import get_db
from server.models import Company, User
from server.services.scraper import scrape_company_info, scrape_urls_parallel
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score
from server.auth import get_current_user

router = APIRouter(prefix="/api/scrape", tags=["scraper"])


def validate_url(url: str) -> str:
    if not url.startswith("http"):
        url = "https://" + url

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="HTTPまたはHTTPSのURLのみ対応しています")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="無効なURLです")

    try:
        resolved = socket.getaddrinfo(hostname, None)
        for _, _, _, _, addr in resolved:
            ip = ipaddress.ip_address(addr[0])
            if ip.is_private or ip.is_loopback or ip.is_reserved:
                raise HTTPException(status_code=400, detail="プライベートIPへのアクセスは許可されていません")
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="ホスト名を解決できません")

    return url


@router.post("")
def scrape_url(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = data.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URLを入力してください")

    url = validate_url(url)

    domain = urlparse(url).netloc
    dup_q = db.query(Company).filter(Company.domain == domain)
    if data.get("project_id"):
        dup_q = dup_q.filter(Company.project_id == data["project_id"])
    existing = dup_q.first()
    if existing:
        raise HTTPException(status_code=409, detail="この企業は既に登録されています")

    info = scrape_company_info(url)
    if "error" in info:
        raise HTTPException(status_code=422, detail=f"スクレイピングエラー: {info['error']}")

    full_text = info.pop("full_text", "")
    category_main, category_sub = categorize_company(full_text)
    cms_type = info.get("cms_type") or None
    flags = detect_flags(full_text, cms_type=cms_type)

    company_data = {
        **info,
        "category_main": category_main,
        "category_sub": category_sub,
        **flags,
    }

    score, rank = calculate_score(company_data)
    company_data["score_total"] = score
    company_data["score_rank"] = rank

    company_fields = {k: v for k, v in company_data.items() if hasattr(Company, k)}
    if data.get("project_id"):
        company_fields["project_id"] = data["project_id"]
    company = Company(**company_fields)
    db.add(company)
    db.commit()
    db.refresh(company)

    from server.schemas import company_to_dict
    return {"company": company_to_dict(company)}


@router.post("/bulk")
def scrape_bulk(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    urls = data.get("urls", [])
    if not urls:
        raise HTTPException(status_code=400, detail="URLリストを入力してください")

    results = []
    valid_urls = []
    valid_indices = []

    for url in urls:
        url = url.strip()
        if not url:
            continue

        try:
            url = validate_url(url)
        except HTTPException as e:
            results.append({"url": url, "status": "error", "message": e.detail})
            continue

        domain = urlparse(url).netloc
        dup_q = db.query(Company).filter(Company.domain == domain)
        if data.get("project_id"):
            dup_q = dup_q.filter(Company.project_id == data["project_id"])
        existing = dup_q.first()
        if existing:
            results.append({"url": url, "status": "duplicate", "message": "既に登録済み"})
            continue

        valid_urls.append(url)
        valid_indices.append(len(results))
        results.append(None)

    if valid_urls:
        scraped = scrape_urls_parallel(valid_urls, max_workers=5)

        for i, info in enumerate(scraped):
            url = valid_urls[i]
            idx = valid_indices[i]

            if not info or "error" in info:
                results[idx] = {"url": url, "status": "error", "message": info.get("error", "スクレイピング失敗") if info else "スクレイピング失敗"}
                continue

            full_text = info.pop("full_text", "")
            category_main, category_sub = categorize_company(full_text)
            cms_type = info.get("cms_type") or None
            flags = detect_flags(full_text, cms_type=cms_type)

            company_data = {
                **info,
                "category_main": category_main,
                "category_sub": category_sub,
                **flags,
            }

            score, rank = calculate_score(company_data)
            company_data["score_total"] = score
            company_data["score_rank"] = rank

            company_fields = {k: v for k, v in company_data.items() if hasattr(Company, k)}
            if data.get("project_id"):
                company_fields["project_id"] = data["project_id"]
            company = Company(**company_fields)
            db.add(company)
            db.commit()
            db.refresh(company)

            results[idx] = {"url": url, "status": "success", "company_id": company.id}

    return {"results": [r for r in results if r is not None]}
