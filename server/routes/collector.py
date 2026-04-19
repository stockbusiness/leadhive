import asyncio
import json
import logging
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/collect", tags=["collector"])


@router.get("/search-engine-status")
def get_search_engine_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import os
    from server.models import SystemSettings, AppSetting
    serper_env = os.environ.get("SERPER_API_KEY", "")
    serper_sys = db.query(SystemSettings).filter(SystemSettings.key == "serper_api_key").first()
    has_serper = bool(serper_env) or bool(serper_sys and serper_sys.value)

    google_key = db.query(AppSetting).filter(
        AppSetting.setting_key == "google_api_key",
        AppSetting.org_id == current_user.org_id,
    ).first()
    google_cx = db.query(AppSetting).filter(
        AppSetting.setting_key == "google_cx",
        AppSetting.org_id == current_user.org_id,
    ).first()
    has_google = bool(google_key and google_key.setting_value) and bool(google_cx and google_cx.setting_value)

    if has_serper:
        active_engine = "serper"
    elif has_google:
        active_engine = "google"
    else:
        active_engine = "none"

    return {
        "active_engine": active_engine,
        "has_serper": has_serper,
        "has_google": has_google,
    }


@router.get("/progress/{job_id}")
async def collect_progress(job_id: str):
    async def event_stream():
        max_wait = 900
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
            try:
                from server.routes.webhooks import fire_event
                fire_event(db, current_user.org_id, "collection.completed", {
                    "total_success": result.get("total_success", result.get("summary", {}).get("success", 0)),
                    "job_id": job_id,
                })
            except Exception:
                pass
        except Exception as e:
            job_update(job_id, type="error", message=str(e))
        finally:
            db.close()

    threading.Thread(target=run, daemon=True).start()
    return {"job_id": job_id}


@router.post("/ec-discovery")
def collect_ec_discovery(
    data: dict,
    current_user: User = Depends(get_current_user),
):
    """ECサイトオーナーを直接発見するための専用収集ジョブを起動する。
    選択した業種カテゴリのプリセットキーワードでGoogleサーチを実行し、
    ECスコアが高い企業だけを登録する。
    """
    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=0, message="EC専用収集を開始しています...", status="running")

    EC_DISCOVERY_PRESETS = {
        "apparel": ["ファッション通販 会社", "レディースファッション 自社EC", "アパレル ネットショップ 運営"],
        "food": ["食品通販 会社 産直", "お取り寄せ グルメ 通販", "定期便 食品 EC"],
        "cosme": ["コスメ 通販 自社EC", "スキンケア D2C ブランド", "化粧品 通販 Shopify"],
        "btob": ["法人向け EC 卸売 通販", "資材 業務用 ネット注文", "BtoB EC 企業間 受発注"],
        "handmade": ["ハンドメイド 自社サイト 販売", "作家 BASE ネットショップ", "アクセサリー 手作り 通販"],
        "interior": ["インテリア 通販 自社EC", "家具 ネットショップ EC", "雑貨 セレクトショップ 通販"],
        "d2c": ["D2C ブランド 自社通販", "DTC 直販 オンライン", "サブスク 定期便 自社EC"],
        "shopify_users": ["Shopify ネットショップ 運営", "Shopify EC 事業者", "Shopify 導入 通販 会社"],
        "all": [
            "ECサイト 運営 会社", "ネットショップ 自社EC 運営", "通販 D2C ブランド",
            "Shopify 運営 事業者", "BASE STORES EC 運営", "EC 自社ブランド 販売",
        ],
    }

    category_id = data.get("category_id", "all")
    keywords_text = EC_DISCOVERY_PRESETS.get(category_id, EC_DISCOVERY_PRESETS["all"])
    region = data.get("region", "")
    project_id = data.get("project_id")
    if region:
        keywords_text = [f"{kw} {region}" for kw in keywords_text]

    def run():
        db = SessionLocal()
        try:
            from server.services.collector import collect_by_keyword
            from server.models import SearchKeyword as SKW

            total_success = 0
            total_duplicate = 0
            total_rejected = 0
            total_kws = len(keywords_text)

            for i, kw_text in enumerate(keywords_text):
                job_update(
                    job_id,
                    current=i,
                    total=total_kws,
                    message=f"({i+1}/{total_kws}) EC探索: 「{kw_text}」...",
                    status="running",
                )
                temp_kw = SKW(
                    keyword=kw_text,
                    category="EC運営",
                    region=region,
                    exclude_keywords="",
                    is_active=True,
                    project_id=project_id,
                )
                db.add(temp_kw)
                db.commit()
                db.refresh(temp_kw)
                try:
                    result = collect_by_keyword(temp_kw.id, db, project_id=project_id)
                    summary = result.get("summary", {})
                    total_success += summary.get("success", 0)
                    total_duplicate += summary.get("duplicate", 0)
                    total_rejected += summary.get("rejected", 0)
                except Exception as e:
                    logger.warning(f"EC discovery keyword error ({kw_text}): {e}")

            cache_invalidate("dashboard")
            job_update(
                job_id,
                type="done",
                result={
                    "total_success": total_success,
                    "total_duplicate": total_duplicate,
                    "total_rejected": total_rejected,
                    "keywords_processed": total_kws,
                },
                message=f"EC専用収集完了: {total_success}件獲得",
            )
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
    from server.services.encryption import decrypt_value as _dv
    places = search_google_maps(
        keyword=keyword,
        region=region,
        api_key=_dv(api_key_row.setting_value),
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


@router.post("/urls-preview")
def collect_urls_preview(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """各収集タイプからURLリストだけを取得する（スクレイピングなし）"""
    type_ = data.get("type", "")

    if type_ == "directory":
        url = data.get("url", "").strip()
        max_pages = min(data.get("max_pages", 3), 10)
        if not url:
            return {"error": "URLを入力してください"}
        from server.services.directory_scraper import scrape_directory
        links = scrape_directory(url, max_pages=max_pages)
        urls = [{"url": l["url"], "name": l.get("title", ""), "source": "ディレクトリ"} for l in links]
        return {"urls": urls, "count": len(urls)}

    elif type_ == "shopify":
        max_results = min(data.get("max_results", 20), 50)
        from server.services.shopify_partners import collect_shopify_partners_via_google
        partners = collect_shopify_partners_via_google(max_results=max_results, db=db, org_id=current_user.org_id)
        if not partners:
            return {"error": "Google APIキーが設定されていないか、結果が見つかりませんでした。"}
        urls = [{"url": p["url"], "name": p.get("title", ""), "source": "Shopifyパートナー"} for p in partners]
        return {"urls": urls, "count": len(urls)}

    elif type_ == "google-maps":
        keyword = data.get("keyword", "").strip()
        region = data.get("region", "東京").strip()
        max_results = min(data.get("max_results", 20), 60)
        if not keyword:
            return {"error": "キーワードを入力してください"}
        from server.models import AppSetting
        api_key_row = db.query(AppSetting).filter(
            AppSetting.setting_key == "google_places_api_key",
            AppSetting.org_id == current_user.org_id,
        ).first()
        if not api_key_row or not api_key_row.setting_value:
            return {"error": "Google Places APIキーが設定されていません。"}
        from server.services.google_places import search_google_maps
        from server.services.encryption import decrypt_value as _dv
        places = search_google_maps(keyword=keyword, region=region, api_key=_dv(api_key_row.setting_value), max_results=max_results)
        if not places:
            return {"error": "結果が見つかりませんでした。"}
        urls = []
        for p in places:
            pd = p.get("places_data", {}) or {}
            urls.append({
                "url": p.get("url", "") or "",
                "name": p.get("title", ""),
                "source": f"Googleマップ: {keyword}",
                "address": pd.get("address", ""),
                "phone": pd.get("phone", ""),
                "rating": pd.get("rating"),
                "user_ratings_total": pd.get("user_ratings_total"),
                "has_url": bool(p.get("url")),
            })
        return {"urls": urls, "count": len(urls), "source_type": "google-maps"}

    elif type_ == "houjin-db":
        keyword = data.get("keyword", "")
        prefecture = data.get("prefecture", "")
        max_results = min(int(data.get("max_results", 20)), 100)
        from server.services.gbiz_collector import get_gbiz_token, search_gbiz, find_website_for_company
        token = get_gbiz_token(current_user.org_id, db)
        if not token:
            return {"error": "gBizINFO APIトークンが設定されていません。"}
        all_companies = []
        page = 1
        while len(all_companies) < max_results * 2 and page <= 5:
            try:
                result = search_gbiz(token, name_keyword=keyword, prefecture=prefecture, page=page)
            except Exception as e:
                return {"error": f"gBizINFO エラー: {str(e)}"}
            all_companies.extend(result["companies"])
            if page >= result["total_page_count"]:
                break
            page += 1

        from urllib.parse import urlparse as _urlparse
        from server.services.aggregator import normalize_domain as _normalize_domain

        urls = []
        seen_domains = set()
        for c in all_companies[:max_results]:
            company_name = c.get("name", "")
            location = c.get("location", "")
            company_url = (c.get("company_url", "") or "").strip()

            # gBizINFO に URL がない場合は Google 検索で探す
            if not company_url:
                found = find_website_for_company(
                    company_name, location, db=db, org_id=current_user.org_id
                )
                company_url = found or ""

            if not company_url:
                continue

            # 重複ドメインを除外
            netloc = _urlparse(company_url).netloc or company_url
            domain = _normalize_domain(netloc)
            if domain in seen_domains:
                continue
            seen_domains.add(domain)

            urls.append({
                "url": company_url,
                "name": company_name,
                "source": "法人DB",
                "location": location,
            })

        return {"urls": urls, "count": len(urls)}

    elif type_ == "google-api":
        keyword_id = data.get("keyword_id")
        keywords_data = []
        if keyword_id:
            from server.models import SearchKeyword
            kw = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
            if kw:
                keywords_data = [kw]
        else:
            from server.models import SearchKeyword
            project_id = data.get("project_id")
            q = db.query(SearchKeyword).filter(SearchKeyword.is_active == True)
            if project_id:
                q = q.filter(SearchKeyword.project_id == project_id)
            keywords_data = q.limit(5).all()

        if not keywords_data:
            return {"error": "キーワードが見つかりません"}

        from server.models import AppSetting
        from server.services.google_search import search_google
        api_key_row = db.query(AppSetting).filter(
            AppSetting.org_id == current_user.org_id, AppSetting.setting_key == "google_api_key"
        ).first()
        cx_row = db.query(AppSetting).filter(
            AppSetting.org_id == current_user.org_id, AppSetting.setting_key == "google_cx"
        ).first()
        if not api_key_row or not api_key_row.setting_value:
            return {"error": "Google APIキーが設定されていません。"}
        if not cx_row or not cx_row.setting_value:
            return {"error": "Search Engine IDが設定されていません。"}

        from server.services.encryption import decrypt_value as _dv
        urls = []
        seen = set()
        for kw in keywords_data:
            query = kw.keyword + (f" {kw.region}" if kw.region else "")
            results = search_google(_dv(api_key_row.setting_value), _dv(cx_row.setting_value), query, db, num=10)
            for r in results:
                url = r.get("url", "")
                if url and url not in seen:
                    seen.add(url)
                    urls.append({"url": url, "name": r.get("title", ""), "source": f"Google検索: {kw.keyword}"})
        return {"urls": urls, "count": len(urls)}

    return {"error": "不明な収集タイプです"}


@router.post("/scrape-staged")
def scrape_staged_urls(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """ステージングリストのURLをスクレイピングして保存する（SSEジョブ）"""
    urls = data.get("urls", [])
    project_id = data.get("project_id")

    if not urls:
        return {"error": "URLリストが空です"}

    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=len(urls), message="スクレイピングを開始しています...", status="running")

    def run():
        new_db = SessionLocal()
        try:
            total = len(urls)
            BATCH = 5
            all_results = []

            for batch_start in range(0, total, BATCH):
                batch = urls[batch_start:batch_start + BATCH]
                names = [item.get("name") or item.get("url", "")[:40] for item in batch]
                label = names[0] if len(names) == 1 else f"{names[0]} 他{len(names)-1}件"
                job_update(
                    job_id,
                    current=batch_start,
                    total=total,
                    message=f"({batch_start + 1}〜{min(batch_start + BATCH, total)}/{total}) 「{label}」をスクレイピング中...",
                )
                batch_result = process_urls_to_companies(batch, new_db, source="ステージング収集", project_id=project_id)
                all_results.extend(batch_result.get("results", []))

            summary = {
                "source": "ステージング収集",
                "total": len(all_results),
                "success": sum(1 for r in all_results if r["status"] == "success"),
                "duplicate": sum(1 for r in all_results if r["status"] == "duplicate"),
                "rejected": sum(1 for r in all_results if r["status"] == "rejected"),
                "error": sum(1 for r in all_results if r["status"] == "error"),
            }
            result = {"results": all_results, "summary": summary}
            cache_invalidate("dashboard")
            job_update(job_id, type="done", result=result, message="スクレイピング完了")
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


# ──────────────────────────────────────────────────────────────
#  Enrich: URLなし企業への情報補完バッチ
# ──────────────────────────────────────────────────────────────
from server.models import Company as CompanyModel


@router.get("/enrich-count")
def enrich_count(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(CompanyModel)
        .filter(
            CompanyModel.project_id == project_id,
            (CompanyModel.website_url == None) | (CompanyModel.website_url == ""),
        )
        .count()
    )
    return {"count": count}


@router.post("/enrich")
def enrich_companies(
    data: dict,
    current_user: User = Depends(get_current_user),
):
    project_id = data.get("project_id")
    max_items = min(int(data.get("max_items", 20)), 100)

    if not project_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="project_id が必要です")

    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=0, message="情報補完処理を開始しています...", status="running")

    def run():
        new_db = SessionLocal()
        try:
            from server.services.enrichment import enrich_companies_batch
            result = enrich_companies_batch(
                job_id=job_id,
                project_id=project_id,
                org_id=current_user.org_id,
                db=new_db,
                max_items=max_items,
            )
            cache_invalidate("dashboard")
            job_update(job_id, type="done", result=result, message="情報補完完了")
        except Exception as e:
            job_update(job_id, type="error", message=str(e))
        finally:
            new_db.close()

    threading.Thread(target=run, daemon=True).start()
    return {"job_id": job_id}
