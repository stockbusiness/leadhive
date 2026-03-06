from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from server.database import get_db
from server.models import SearchKeyword, CollectionLog
from server.services.collector import collect_by_keyword, process_urls_to_companies
from server.services.cache import cache_invalidate

router = APIRouter(prefix="/api/collect", tags=["collector"])


@router.post("")
def collect_single(data: dict, db: Session = Depends(get_db)):
    keyword_id = data.get("keyword_id")
    if not keyword_id:
        return {"error": "キーワードIDを指定してください"}
    return collect_by_keyword(keyword_id, db)


@router.post("/all")
def collect_all(db: Session = Depends(get_db)):
    keywords = db.query(SearchKeyword).filter(SearchKeyword.is_active == True).all()
    if not keywords:
        return {"error": "アクティブなキーワードがありません"}

    all_results = []
    for kw in keywords:
        result = collect_by_keyword(kw.id, db)
        if "error" in result:
            all_results.append({
                "keyword": kw.keyword,
                "error": result["error"],
            })
        else:
            all_results.append({
                "keyword": kw.keyword,
                "summary": result["summary"],
                "results": result["results"],
            })

    total_success = sum(
        r.get("summary", {}).get("success", 0) for r in all_results if "summary" in r
    )
    total_rejected = sum(
        r.get("summary", {}).get("rejected", 0) for r in all_results if "summary" in r
    )
    total_duplicate = sum(
        r.get("summary", {}).get("duplicate", 0) for r in all_results if "summary" in r
    )

    return {
        "keywords_processed": len(all_results),
        "total_success": total_success,
        "total_rejected": total_rejected,
        "total_duplicate": total_duplicate,
        "details": all_results,
    }


@router.get("/history")
def get_collection_history(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    logs = db.query(CollectionLog).order_by(desc(CollectionLog.created_at)).limit(limit).all()
    return {
        "logs": [
            {
                "id": log.id,
                "keyword_id": log.keyword_id,
                "keyword_text": log.keyword_text,
                "total_found": log.total_found,
                "success_count": log.success_count,
                "duplicate_count": log.duplicate_count,
                "rejected_count": log.rejected_count,
                "error_count": log.error_count,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    }


@router.post("/directory")
def collect_from_directory(data: dict, db: Session = Depends(get_db)):
    url = data.get("url", "").strip()
    max_pages = min(data.get("max_pages", 3), 10)
    if not url:
        return {"error": "ディレクトリURLを入力してください"}

    from server.services.directory_scraper import scrape_directory
    links = scrape_directory(url, max_pages=max_pages)
    if not links:
        return {"error": "リンクが見つかりませんでした。URLを確認してください。"}

    result = process_urls_to_companies(links, db, source=f"ディレクトリ: {url}")
    cache_invalidate("dashboard")
    return result


@router.post("/google-scrape")
def collect_google_scrape(data: dict, db: Session = Depends(get_db)):
    keyword = data.get("keyword", "").strip()
    region = data.get("region", "").strip()
    num = min(data.get("num", 10), 30)
    if not keyword:
        return {"error": "検索キーワードを入力してください"}

    query = keyword
    if region:
        query += f" {region}"

    from server.services.google_scrape import scrape_google_search
    search_results = scrape_google_search(query, num=num)
    if not search_results:
        return {"error": "検索結果が取得できませんでした。時間をおいて再試行してください。"}

    result = process_urls_to_companies(search_results, db, source=f"Google直接検索: {keyword}")
    cache_invalidate("dashboard")
    return result


@router.post("/shopify-partners")
def collect_shopify_partners(data: dict, db: Session = Depends(get_db)):
    max_results = min(data.get("max_results", 20), 50)

    from server.services.shopify_partners import scrape_shopify_partners
    partners = scrape_shopify_partners(max_results=max_results)
    if not partners:
        return {"error": "Shopifyパートナー情報を取得できませんでした。"}

    result = process_urls_to_companies(partners, db, source="Shopifyパートナー")
    cache_invalidate("dashboard")
    return result
