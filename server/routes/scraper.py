import ipaddress
import socket
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from urllib.parse import urlparse
from server.database import get_db
from server.models import Company
from server.services.scraper import scrape_company_info
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score

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
def scrape_url(data: dict, db: Session = Depends(get_db)):
    url = data.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URLを入力してください")

    url = validate_url(url)

    domain = urlparse(url).netloc
    existing = db.query(Company).filter(Company.domain == domain).first()
    if existing:
        raise HTTPException(status_code=409, detail="この企業は既に登録されています")

    info = scrape_company_info(url)
    if "error" in info:
        raise HTTPException(status_code=422, detail=f"スクレイピングエラー: {info['error']}")

    full_text = info.pop("full_text", "")
    category_main, category_sub = categorize_company(full_text)
    flags = detect_flags(full_text)

    company_data = {
        **info,
        "category_main": category_main,
        "category_sub": category_sub,
        **flags,
    }

    score, rank = calculate_score(company_data)
    company_data["score_total"] = score
    company_data["score_rank"] = rank

    company = Company(**{k: v for k, v in company_data.items() if hasattr(Company, k)})
    db.add(company)
    db.commit()
    db.refresh(company)

    from server.routes.companies import company_to_dict
    return {"company": company_to_dict(company)}


@router.post("/bulk")
def scrape_bulk(data: dict, db: Session = Depends(get_db)):
    urls = data.get("urls", [])
    if not urls:
        raise HTTPException(status_code=400, detail="URLリストを入力してください")

    results = []
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
        existing = db.query(Company).filter(Company.domain == domain).first()
        if existing:
            results.append({"url": url, "status": "duplicate", "message": "既に登録済み"})
            continue

        info = scrape_company_info(url)
        if "error" in info:
            results.append({"url": url, "status": "error", "message": info["error"]})
            continue

        full_text = info.pop("full_text", "")
        category_main, category_sub = categorize_company(full_text)
        flags = detect_flags(full_text)

        company_data = {
            **info,
            "category_main": category_main,
            "category_sub": category_sub,
            **flags,
        }

        score, rank = calculate_score(company_data)
        company_data["score_total"] = score
        company_data["score_rank"] = rank

        company = Company(**{k: v for k, v in company_data.items() if hasattr(Company, k)})
        db.add(company)
        db.commit()
        db.refresh(company)

        results.append({"url": url, "status": "success", "company_id": company.id})

    return {"results": results}
