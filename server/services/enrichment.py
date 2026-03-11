import time
import random
import logging
import requests
from sqlalchemy.orm import Session

from server.models import Company
from server.services.collector import job_update, _upsert_company_master
from server.services.scraper import scrape_company_info
from server.services.aggregator import normalize_domain, is_aggregator_site
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score
from server.services.gbiz_collector import (
    find_website_for_company,
    get_gbiz_token,
    GBIZ_BASE_URL,
)

logger = logging.getLogger(__name__)


def _fetch_url_from_gbiz(corporate_number: str, token: str) -> str | None:
    if not token or not corporate_number:
        return None
    try:
        headers = {
            "X-hojinInfo-api-token": token,
            "Accept": "application/json",
        }
        url = f"{GBIZ_BASE_URL}/{corporate_number}"
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            infos = data.get("hojin-infos", [])
            if infos:
                return infos[0].get("company_url", "") or None
    except Exception as e:
        logger.warning(f"gBizINFO single lookup failed for {corporate_number}: {e}")
    return None


def enrich_companies_batch(
    job_id: str,
    project_id: int,
    org_id: int,
    db: Session,
    max_items: int = 20,
) -> dict:
    token = get_gbiz_token(org_id, db)

    companies = (
        db.query(Company)
        .filter(
            Company.project_id == project_id,
            (Company.website_url == None) | (Company.website_url == ""),
        )
        .order_by(Company.id)
        .limit(max_items)
        .all()
    )

    total = len(companies)
    job_update(job_id, message=f"URLなし企業 {total} 件を処理します...", current=0, total=total)

    success = 0
    found_url = 0
    no_url = 0
    errors = 0

    for i, company in enumerate(companies):
        job_update(
            job_id,
            current=i + 1,
            total=total,
            message=f"({i + 1}/{total}) 「{company.company_name}」のURL検索中...",
        )

        try:
            url = None

            if company.corporate_number and token:
                url = _fetch_url_from_gbiz(company.corporate_number, token)
                if url:
                    time.sleep(0.3)

            if not url:
                location = ""
                parts = []
                if company.prefecture:
                    parts.append(company.prefecture)
                if company.city:
                    parts.append(company.city)
                location = "".join(parts)
                url = find_website_for_company(
                    company.company_name, location, db=db, org_id=org_id
                )
                if url:
                    time.sleep(random.uniform(1.0, 2.0))

            if not url:
                no_url += 1
                continue

            from urllib.parse import urlparse as _up
            domain = normalize_domain(_up(url).netloc)
            if not domain or is_aggregator_site(url)[0]:
                no_url += 1
                continue

            found_url += 1
            job_update(
                job_id,
                current=i + 1,
                total=total,
                message=f"({i + 1}/{total}) 「{company.company_name}」をスクレイピング中...",
            )

            scraped = scrape_company_info(url)
            if not scraped:
                company.website_url = url
                company.domain = domain
                db.commit()
                success += 1
                continue

            scraped["company_name"] = company.company_name
            if company.prefecture and not scraped.get("prefecture"):
                scraped["prefecture"] = company.prefecture
            if company.city and not scraped.get("city"):
                scraped["city"] = company.city
            scraped["website_url"] = url
            scraped["domain"] = domain
            scraped["project_id"] = project_id

            full_text = scraped.get("full_text", "")
            category_main, category_sub = categorize_company(full_text)
            flags = detect_flags(full_text)
            scraped.update({
                "category_main": category_main,
                "category_sub": category_sub,
                **flags,
            })
            score, rank = calculate_score(scraped)
            scraped["score_total"] = score
            scraped["score_rank"] = rank

            allowed_fields = {c.name for c in Company.__table__.columns}
            for k, v in scraped.items():
                if k in allowed_fields and k != "id" and k != "project_id":
                    setattr(company, k, v)
            db.commit()

            _upsert_company_master(db, scraped, domain, source="enrich")

            success += 1

        except Exception as e:
            logger.warning(f"enrich error for company {company.id} ({company.company_name}): {e}")
            errors += 1
            try:
                db.rollback()
            except Exception:
                pass

    return {
        "success": success,
        "found_url": found_url,
        "no_url": no_url,
        "error": errors,
        "total": total,
    }
