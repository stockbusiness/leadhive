import asyncio
import json
import uuid
import threading
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from server.database import get_db, SessionLocal
from server.models import SearchKeyword, CollectionLog, User
from server.services.collector import collect_by_keyword, process_urls_to_companies, job_update, job_get, job_cleanup
from server.services.cache import cache_invalidate
from server.auth import get_current_user

router = APIRouter(prefix="/api/collect", tags=["collector"])


@router.get("/progress/{job_id}")
async def collect_progress(job_id: str):
    async def event_stream():
        max_wait = 300
        waited = 0
        interval = 0.5
        sent_done = False
        while waited < max_wait:
            state = job_get(job_id)
            if not state:
                await asyncio.sleep(interval)
                waited += interval
                continue
            data = json.dumps(state, ensure_ascii=False)
            yield f"data: {data}\n\n"
            if state.get("type") in ("done", "error"):
                sent_done = True
                break
            await asyncio.sleep(interval)
            waited += interval
        if not sent_done:
            yield f"data: {json.dumps({'type': 'error', 'message': 'タイムアウト'})}\n\n"
        job_cleanup(job_id)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/async")
def collect_async(
    data: dict,
    current_user: User = Depends(get_current_user),
):
    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=0, message="収集を開始しています...", status="running")

    def run():
        db = SessionLocal()
        try:
            pid = data.get("project_id")
            if data.get("keyword_id"):
                keyword_id = data["keyword_id"]
                kw = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
                if kw:
                    job_update(job_id, message=f"キーワード「{kw.keyword}」で収集中...")
                result = collect_by_keyword(keyword_id, db, project_id=pid)
            else:
                q = db.query(SearchKeyword).filter(SearchKeyword.is_active == True)
                if pid:
                    q = q.filter(SearchKeyword.project_id == pid)
                keywords = q.all()
                all_results = []
                for i, kw in enumerate(keywords):
                    job_update(job_id, current=i, total=len(keywords), message=f"({i+1}/{len(keywords)}) 「{kw.keyword}」を処理中...")
                    r = collect_by_keyword(kw.id, db, project_id=pid)
                    all_results.append({"keyword": kw.keyword, **r})
                total_success = sum(r.get("summary", {}).get("success", 0) for r in all_results if "summary" in r)
                total_duplicate = sum(r.get("summary", {}).get("duplicate", 0) for r in all_results if "summary" in r)
                total_rejected = sum(r.get("summary", {}).get("rejected", 0) for r in all_results if "summary" in r)
                result = {
                    "keywords_processed": len(all_results),
                    "total_success": total_success,
                    "total_duplicate": total_duplicate,
                    "total_rejected": total_rejected,
                    "details": all_results,
                }
            cache_invalidate("dashboard")
            job_update(job_id, type="done", result=result, message="収集完了")
        except Exception as e:
            job_update(job_id, type="error", message=str(e))
        finally:
            db.close()

    threading.Thread(target=run, daemon=True).start()
    return {"job_id": job_id}


@router.post("")
def collect_single(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keyword_id = data.get("keyword_id")
    if not keyword_id:
        return {"error": "キーワードIDを指定してください"}
    return collect_by_keyword(keyword_id, db, project_id=data.get("project_id"))


@router.post("/all")
def collect_all(
    data: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
            all_results.append({"keyword": kw.keyword, "error": result["error"]})
        else:
            all_results.append({"keyword": kw.keyword, "summary": result["summary"], "results": result["results"]})

    total_success = sum(r.get("summary", {}).get("success", 0) for r in all_results if "summary" in r)
    total_rejected = sum(r.get("summary", {}).get("rejected", 0) for r in all_results if "summary" in r)
    total_duplicate = sum(r.get("summary", {}).get("duplicate", 0) for r in all_results if "summary" in r)

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
    current_user: User = Depends(get_current_user),
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
def collect_from_directory(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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


@router.post("/shopify-partners")
def collect_shopify_partners(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    max_results = min(data.get("max_results", 20), 50)

    from server.services.shopify_partners import collect_shopify_partners_via_google
    partners = collect_shopify_partners_via_google(
        max_results=max_results,
        db=db,
        org_id=current_user.org_id,
    )
    if not partners:
        return {"error": "Shopifyパートナー情報を取得できませんでした。Google APIキーが設定画面で登録済みか確認してください。"}

    pid = data.get("project_id")
    result = process_urls_to_companies(partners, db, source="Shopifyパートナー", project_id=pid)
    cache_invalidate("dashboard")
    return result


@router.post("/google-maps")
def collect_google_maps(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keyword = data.get("keyword", "").strip()
    region = data.get("region", "東京").strip()
    max_results = min(data.get("max_results", 20), 60)
    if not keyword:
        return {"error": "検索キーワードを入力してください"}

    from server.models import AppSetting
    api_key_row = db.query(AppSetting).filter(
        AppSetting.setting_key == "google_places_api_key",
        AppSetting.org_id == current_user.org_id,
    ).first()
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


@router.post("/gbiz")
def collect_gbiz(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.services.gbiz_collector import get_gbiz_token

    project_id = data.get("project_id")
    keyword = data.get("keyword", "")
    prefecture = data.get("prefecture", "")
    max_results = min(int(data.get("max_results", 20)), 100)

    token = get_gbiz_token(current_user.org_id, db)
    if not token:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="gBizINFO APIトークンが設定されていません。設定画面から登録してください。",
        )

    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=0, message="gBizINFO 収集を開始しています...", status="running")

    def run():
        new_db = SessionLocal()
        try:
            from server.services.gbiz_collector import collect_from_gbiz
            result = collect_from_gbiz(
                job_id=job_id,
                project_id=project_id,
                org_id=current_user.org_id,
                keyword=keyword,
                prefecture=prefecture,
                max_results=max_results,
                db=new_db,
            )
            cache_invalidate("dashboard")
            job_update(job_id, type="done", result=result, message="収集完了")
        except Exception as e:
            job_update(job_id, type="error", message=str(e))
        finally:
            new_db.close()

    threading.Thread(target=run, daemon=True).start()
    return {"job_id": job_id}


_PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]
