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
    return collect_by_keyword(keyword_id, db, project_id=data.get("project_id"))


@router.post("/all")
def collect_all(data: dict = None, db: Session = Depends(get_db)):
    pid = (data or {}).get("project_id")
    q = db.query(SearchKeyword).filter(SearchKeyword.is_active == True)
    if pid:
        q = q.filter(SearchKeyword.project_id == pid)
    keywords = q.all()
    if not keywords:
        return {"error": "アクティブなキーワードがありません"}

    all_results = []
    for kw in keywords:
        result = collect_by_keyword(kw.id, db, project_id=pid)
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
    project_id: int = None,
    db: Session = Depends(get_db),
):
    q = db.query(CollectionLog)
    if project_id:
        q = q.filter(CollectionLog.project_id == project_id)
    logs = q.order_by(desc(CollectionLog.created_at)).limit(limit).all()
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

    pid = data.get("project_id")
    result = process_urls_to_companies(links, db, source=f"ディレクトリ: {url}", project_id=pid)
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

    pid = data.get("project_id")
    result = process_urls_to_companies(search_results, db, source=f"Google直接検索: {keyword}", project_id=pid)
    cache_invalidate("dashboard")
    return result


@router.post("/shopify-partners")
def collect_shopify_partners(data: dict, db: Session = Depends(get_db)):
    max_results = min(data.get("max_results", 20), 50)

    from server.services.shopify_partners import scrape_shopify_partners
    partners = scrape_shopify_partners(max_results=max_results)
    if not partners:
        return {"error": "Shopifyパートナー情報を取得できませんでした。"}

    pid = data.get("project_id")
    result = process_urls_to_companies(partners, db, source="Shopifyパートナー", project_id=pid)
    cache_invalidate("dashboard")
    return result


@router.post("/google-maps")
def collect_google_maps(data: dict, db: Session = Depends(get_db)):
    keyword = data.get("keyword", "").strip()
    region = data.get("region", "東京").strip()
    max_results = min(data.get("max_results", 20), 60)
    if not keyword:
        return {"error": "検索キーワードを入力してください"}

    from server.models import AppSetting
    api_key_row = db.query(AppSetting).filter(AppSetting.setting_key == "google_places_api_key").first()
    if not api_key_row or not api_key_row.setting_value:
        return {"error": "Google Places APIキーが設定されていません。設定画面で登録してください。"}

    from server.services.google_places import search_google_maps
    places = search_google_maps(
        keyword=keyword,
        region=region,
        api_key=api_key_row.setting_value,
        max_results=max_results,
    )
    if not places:
        return {"error": "Googleマップから結果が取得できませんでした。キーワードを変更して再試行してください。"}

    pid = data.get("project_id")
    result = process_urls_to_companies(places, db, source=f"Googleマップ: {keyword} {region}", project_id=pid)

    for r in result.get("results", []):
        if r.get("status") == "success" and r.get("company_id"):
            place_item = next((p for p in places if p["url"] == r.get("url")), None)
            if place_item and place_item.get("places_data"):
                pd = place_item["places_data"]
                from server.models import Company
                company = db.query(Company).filter(Company.id == r["company_id"]).first()
                if company:
                    if pd.get("phone") and not company.phone:
                        company.phone = pd["phone"]
                    if pd.get("address") and not company.prefecture:
                        addr = pd["address"]
                        for pref in _PREFECTURES:
                            if pref in addr:
                                company.prefecture = pref
                                rest = addr.split(pref, 1)[1]
                                if rest:
                                    city_part = rest.split("区")[0] + "区" if "区" in rest else rest.split("市")[0] + "市" if "市" in rest else ""
                                    if city_part:
                                        company.city = city_part
                                break
                    if pd.get("rating") is not None:
                        company.notes = (company.notes or "") + f"\nGoogleマップ評価: {pd['rating']}/5 ({pd.get('user_ratings_total', 0)}件)"
                    db.commit()

    cache_invalidate("dashboard")
    return result


_PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]
