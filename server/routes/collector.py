import asyncio
import json
import logging
import uuid
import threading
from datetime import datetime
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
    from server.services.serper_search import get_serper_api_key
    has_serper = bool(get_serper_api_key(db=db, org_id=current_user.org_id))
    active_engine = "serper" if has_serper else "none"

    return {
        "active_engine": active_engine,
        "has_serper": has_serper,
        "has_google": False,
    }


@router.get("/progress/{job_id}")
async def collect_progress(job_id: str):
    async def event_stream():
        max_wait = 900
        waited = 0
        interval = 0.5
        sent_done = False
        db_checked = False

        while waited < max_wait:
            state = job_get(job_id)
            if state:
                data = json.dumps(state, ensure_ascii=False)
                yield f"data: {data}\n\n"
                if state.get("type") in ("done", "error"):
                    sent_done = True
                    break
            else:
                # ジョブがメモリにない場合、10秒待ってからDBを確認する
                # （サーバー再起動後の再接続時に900秒待つのを防ぐ）
                if not db_checked and waited >= 10:
                    db_checked = True
                    try:
                        from server.database import SessionLocal
                        from server.models import JobLog
                        from datetime import datetime as _dt
                        _db = SessionLocal()
                        try:
                            row = _db.query(JobLog).filter(JobLog.job_id == job_id).first()
                            if not row:
                                yield f"data: {json.dumps({'type': 'error', 'status': 'error', 'message': 'ジョブが見つかりません。再度収集を開始してください。'}, ensure_ascii=False)}\n\n"
                                sent_done = True
                                break
                            elif row.status in ("interrupted", "error"):
                                msg = row.message or "サーバー再起動によりジョブが中断されました。再度お試しください。"
                                if row.status == "running":
                                    row.status = "interrupted"
                                    row.message = msg
                                    row.finished_at = _dt.utcnow()
                                    try:
                                        _db.commit()
                                    except Exception:
                                        _db.rollback()
                                yield f"data: {json.dumps({'type': 'error', 'status': 'interrupted', 'message': msg}, ensure_ascii=False)}\n\n"
                                sent_done = True
                                break
                            elif row.status == "running":
                                # DBには"running"があるが、サーバー再起動でメモリ消失 → interrupted扱い
                                row.status = "interrupted"
                                row.message = "サーバー再起動によりジョブが中断されました。再度お試しください。"
                                row.finished_at = _dt.utcnow()
                                try:
                                    _db.commit()
                                except Exception:
                                    _db.rollback()
                                yield f"data: {json.dumps({'type': 'error', 'status': 'interrupted', 'message': row.message}, ensure_ascii=False)}\n\n"
                                sent_done = True
                                break
                            elif row.status == "done":
                                yield f"data: {json.dumps({'type': 'done', 'status': 'done', 'message': '収集は完了済みです'}, ensure_ascii=False)}\n\n"
                                sent_done = True
                                break
                            # それ以外は待機継続（起動直後など）
                        finally:
                            _db.close()
                    except Exception as _e:
                        logger.warning(f"SSE DB fallback check error: {_e}")

            await asyncio.sleep(interval)
            waited += interval

        if not sent_done:
            yield f"data: {json.dumps({'type': 'error', 'message': 'タイムアウト'})}\n\n"
        job_cleanup(job_id)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/job-status/{job_id}")
def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.models import JobLog
    state = job_get(job_id)
    if state:
        return {
            "found": True,
            "status": state.get("type", "running"),
            "message": state.get("message"),
            "current": state.get("current", 0),
            "total": state.get("total", 0),
            "result": state.get("result"),
        }
    row = db.query(JobLog).filter(JobLog.job_id == job_id).first()
    if not row:
        return {"found": False, "status": "not_found"}
    # Job is in DB but NOT in memory → server restarted mid-job, mark as interrupted
    if row.status == "running":
        row.status = "interrupted"
        row.message = "サーバー再起動によりジョブが中断されました。再度お試しください。"
        row.finished_at = datetime.utcnow()
        try:
            db.commit()
        except Exception:
            db.rollback()
    return {
        "found": True,
        "status": row.status,
        "message": row.message,
        "current": row.current or 0,
        "total": row.total or 0,
        "result": None,
    }


@router.post("/cancel/{job_id}")
def cancel_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """実行中のジョブをキャンセルする"""
    from server.models import JobLog
    from datetime import datetime as _dt
    state = job_get(job_id)
    if state:
        # メモリ上のステータスをcancelledに変更 → run()ループがチェックして停止
        from server.services.collector import _job_store, _job_store_lock
        with _job_store_lock:
            if job_id in _job_store:
                _job_store[job_id]["status"] = "cancelled"
                _job_store[job_id]["type"] = "error"
                _job_store[job_id]["message"] = "ユーザーによってキャンセルされました"
    row = db.query(JobLog).filter(JobLog.job_id == job_id).first()
    if row and row.status == "running":
        row.status = "interrupted"
        row.message = "ユーザーによってキャンセルされました"
        row.finished_at = _dt.utcnow()
        try:
            db.commit()
        except Exception:
            db.rollback()
    return {"cancelled": True, "job_id": job_id}


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
        "apparel": [
            "ファッション通販 会社", "レディースファッション 自社EC", "アパレル ネットショップ 運営",
            "メンズファッション 通販 自社ブランド", "子供服 ネットショップ 運営会社",
            "古着 セレクトショップ EC 自社", "スポーツウェア 通販 ブランド",
            "アパレル D2C Shopify 運営", "ファッション STORES BASE 運営",
            "レディース 公式通販 ショップ", "ブランド 公式オンラインストア ファッション",
            "ニット セーター 通販 自社", "水着 スポーツ 通販 公式ショップ",
            "アンダーウェア 下着 通販 ブランド直販", "ベビー マタニティ 通販 ネットショップ",
        ],
        "food": [
            "食品通販 会社 産直", "お取り寄せ グルメ 通販", "定期便 食品 EC",
            "農家 直販 野菜 ネットショップ", "スイーツ 菓子 通販 自社EC",
            "調味料 こだわり 通販 ブランド", "健康食品 サプリ 通販 自社",
            "肉 魚 産地直送 EC 運営", "コーヒー 紅茶 飲料 通販 自社EC",
            "パン 焼き菓子 通販 公式ショップ", "日本酒 ワイン 通販 蔵元 直販",
            "ギフト 食品 通販 公式", "米 野菜 産直 通販 農家",
            "アイス デザート 通販 自社", "チーズ 乳製品 通販 直販",
        ],
        "cosme": [
            "コスメ 通販 自社EC", "スキンケア D2C ブランド", "化粧品 通販 Shopify",
            "自然派 コスメ ネットショップ", "メイクアップ 通販 自社ブランド",
            "ヘアケア 通販 D2C 会社", "オーガニック 美容 EC 運営",
            "メンズコスメ 通販 自社", "美容液 化粧水 通販 ブランド",
            "日焼け止め UV 通販 公式", "ネイル セルフ 通販 ブランド",
            "香水 フレグランス 通販 公式ショップ", "アロマ 精油 通販 自社",
            "シャンプー トリートメント 通販 ブランド直販", "ボディケア 通販 D2C 自社",
        ],
        "btob": [
            "法人向け EC 卸売 通販", "資材 業務用 ネット注文", "BtoB EC 企業間 受発注",
            "工場 部品 資材 通販 法人", "飲食店向け 食材 卸 EC",
            "業務用 消耗品 通販 会社", "印刷 名刺 法人 ネット注文",
            "オフィス用品 法人 通販 自社", "建材 設備 BtoB EC 運営",
            "医療 介護 用品 法人 通販", "農業資材 農薬 法人 通販",
            "包装資材 段ボール 法人 ネット注文", "ユニフォーム 作業服 法人 通販",
            "清掃用品 衛生用品 法人 EC", "工具 機械 部品 法人 ネット販売",
        ],
        "handmade": [
            "ハンドメイド 自社サイト 販売", "作家 BASE ネットショップ", "アクセサリー 手作り 通販",
            "陶芸 作家 ネットショップ 販売", "革細工 ハンドメイド 通販 自社",
            "木工 家具 手作り 通販", "刺繍 布小物 作家 EC",
            "ハンドメイド 作家 Shopify 運営", "クラフト 手芸 作品 通販 自社",
            "ガラス 陶器 工芸品 通販 作家", "ジュエリー 手作り シルバー 通販",
            "バッグ 革 オーダー 通販 自社", "キャンドル 雑貨 作家 自社EC",
            "フラワー アレンジメント 作家 通販", "ニット 編み物 ハンドメイド 通販",
        ],
        "interior": [
            "インテリア 通販 自社EC", "家具 ネットショップ EC", "雑貨 セレクトショップ 通販",
            "北欧 インテリア 通販 自社", "アンティーク 家具 ネットショップ",
            "照明 ランプ 通販 EC 会社", "ラグ カーペット 通販 自社",
            "ガーデニング 植物 通販 EC", "キッチン用品 通販 セレクト 自社",
            "カーテン ブラインド 通販 自社", "ソファ テーブル 通販 公式ショップ",
            "アート ポスター 通販 自社EC", "収納 インテリア 通販 ブランド",
            "時計 壁掛け インテリア 通販", "食器 キッチン 通販 ブランド直販",
        ],
        "d2c": [
            "D2C ブランド 自社通販", "DTC 直販 オンライン", "サブスク 定期便 自社EC",
            "D2C スタートアップ 自社サイト 通販", "定期購入 サブスクリプション EC 自社",
            "パーソナライズ 通販 D2C", "ブランド直販 公式通販 EC",
            "新興 D2C 自社 Shopify 運営", "ミレニアル向け 通販 D2C ブランド",
            "サプリ 健康 D2C 定期便", "ペット 用品 D2C 通販 自社",
            "ベビー 子育て D2C 定期便", "フィットネス 運動 D2C 通販",
            "スキンケア D2C 定期便 公式", "食品 ミールキット D2C 定期",
        ],
        "shopify_users": [
            "Shopify ネットショップ 運営", "Shopify EC 事業者", "Shopify 導入 通販 会社",
            "Shopify 構築 EC 運営 自社", "Shopify Plus 事業者 EC",
            "Shopify 日本 通販 ブランド 自社", "Shopify 移行 EC 運営",
            "Shopify アプリ 活用 通販", "Shopify 越境 EC 日本企業",
            "myshopify 通販 日本 ショップ", "Shopify ブランド 公式ストア",
            "Shopify 自社 D2C 公式通販", "Shopify ファッション 雑貨 通販",
            "Shopify 食品 通販 公式", "Shopify 美容 コスメ 通販",
        ],
        "all": [
            "ECサイト 運営 会社", "ネットショップ 自社EC 運営", "通販 D2C ブランド",
            "Shopify 運営 事業者", "BASE STORES EC 運営", "EC 自社ブランド 販売",
            "WooCommerce 通販 自社サイト", "MakeShop カラーミー EC 運営",
            "EC事業者 自社通販 ネット販売", "通販 ブランド 自社サイト 直販",
            "オンラインショップ 運営 会社 日本", "ECサイト 構築 運営 中小企業",
            "公式通販 ショップ 日本 ブランド", "futureshop 通販 自社EC",
            "ネット通販 公式ストア 商品購入",
        ],
    }

    category_id = data.get("category_id", "all")
    keywords_text = EC_DISCOVERY_PRESETS.get(category_id, EC_DISCOVERY_PRESETS["all"])
    region = data.get("region", "")
    project_id = data.get("project_id")
    if region:
        keywords_text = [f"{kw} {region}" for kw in keywords_text]

    # スレッド開始前にorg_idとscoring_rulesを取得
    org_id = getattr(current_user, "org_id", None)
    scoring_rules = None
    if project_id:
        _pre_db = SessionLocal()
        try:
            from server.models import Project as _Proj
            _proj = _pre_db.query(_Proj).filter(_Proj.id == project_id).first()
            if _proj and _proj.scoring_rules:
                scoring_rules = _proj.scoring_rules
        except Exception:
            pass
        finally:
            _pre_db.close()

    def run():
        db = SessionLocal()
        try:
            from server.services.collector import _process_search_results, _save_ec_from_search_results_lightweight
            from server.services.serper_search import search_serper, get_serper_api_key
            from server.models import Company, RejectedUrl

            total_kws = len(keywords_text)
            total_success = 0
            total_duplicate = 0
            total_rejected = 0

            # Serper API キー取得
            serper_key = get_serper_api_key(db=db, org_id=org_id)
            if not serper_key:
                job_update(job_id, type="error", message="Serper APIキーが設定されていません。設定画面で登録してください。")
                return

            # 既存ドメイン・除外ドメインを一括ロード（重複排除用）
            rej_q = db.query(RejectedUrl.domain)
            comp_q = db.query(Company.domain)
            if project_id:
                rej_q = rej_q.filter(RejectedUrl.project_id == project_id)
                comp_q = comp_q.filter(Company.project_id == project_id)
            rejected_domains = set(r.domain for r in rej_q.all())
            existing_domains = set(c.domain for c in comp_q.all())

            # ========== Phase 1: 全キーワードを検索してURLを収集 ==========
            all_search_results = []
            seen_urls: set = set()

            for i, kw_text in enumerate(keywords_text):
                if job_get(job_id).get("status") == "cancelled":
                    logger.info(f"EC discovery {job_id} cancelled at search phase {i+1}/{total_kws}")
                    break

                job_update(
                    job_id,
                    current=i,
                    total=total_kws,
                    message=f"[検索 {i+1}/{total_kws}] 「{kw_text}」を検索中...",
                    status="running",
                    phase="search",
                    urls_found=len(all_search_results),
                    saved_count=0,
                    dup_count=0,
                    rej_count=0,
                )
                try:
                    results = search_serper(serper_key, kw_text, num=500)
                    if results and not ("error" in results[0]):
                        from server.services.collector import _normalize_to_homepage
                        from urllib.parse import urlparse as _up
                        from server.services.aggregator import normalize_domain as _nd
                        for r in results:
                            url = r.get("url", "")
                            if not url:
                                continue
                            # ホームページURLでの重複排除（/blog/ 等のパス違いを同一サイトとして扱う）
                            homepage = _normalize_to_homepage(url)
                            domain_key = _nd(_up(homepage).netloc)
                            if domain_key and domain_key not in seen_urls:
                                seen_urls.add(domain_key)
                                # 元のURLを保持してスニペット情報も引き継ぐ
                                all_search_results.append(r)
                except Exception as e:
                    logger.warning(f"EC discovery search error ({kw_text}): {e}")

            total_urls_found = len(all_search_results)
            logger.info(f"EC discovery {job_id}: {total_urls_found} unique URLs from {total_kws} keywords")

            if not all_search_results:
                job_update(
                    job_id, type="done",
                    result={"total_success": 0, "total_duplicate": 0, "total_rejected": 0, "keywords_processed": total_kws},
                    message="URLが見つかりませんでした",
                )
                return

            # ========== Phase 2: 100件ずつスクレイプ・保存 ==========
            CHUNK_SIZE = 100
            chunks = [all_search_results[c:c + CHUNK_SIZE] for c in range(0, total_urls_found, CHUNK_SIZE)]
            total_chunks = len(chunks)

            for chunk_idx, chunk in enumerate(chunks):
                if job_get(job_id).get("status") == "cancelled":
                    logger.info(f"EC discovery {job_id} cancelled at save batch {chunk_idx+1}/{total_chunks}")
                    break

                chunk_start = chunk_idx * CHUNK_SIZE + 1
                chunk_end = min(chunk_start + len(chunk) - 1, total_urls_found)

                job_update(
                    job_id,
                    current=chunk_idx,
                    total=total_chunks,
                    message=f"[保存 {chunk_idx+1}/{total_chunks}] {chunk_start}〜{chunk_end}件目を処理中...",
                    status="running",
                    phase="save",
                    urls_found=total_urls_found,
                    saved_count=total_success,
                    dup_count=total_duplicate,
                    rej_count=total_rejected,
                )
                try:
                    # 軽量版: スクレイピングなしでSerper検索結果から直接保存（高速）
                    # rejected_domains / existing_domains はチャンク間で共有され重複排除される
                    results = _save_ec_from_search_results_lightweight(
                        chunk, db, rejected_domains, existing_domains,
                        project_id=project_id,
                        scoring_rules=scoring_rules,
                    )
                    total_success += sum(1 for r in results if r and r.get("status") == "success")
                    total_duplicate += sum(1 for r in results if r and r.get("status") == "duplicate")
                    total_rejected += sum(1 for r in results if r and r.get("status") == "rejected")
                    logger.info(
                        f"EC discovery batch {chunk_idx+1}/{total_chunks}: "
                        f"+{sum(1 for r in results if r and r.get('status')=='success')} saved, total={total_success}"
                    )
                except Exception as e:
                    logger.warning(f"EC discovery batch {chunk_idx+1} error: {e}")
                    try:
                        db.rollback()
                    except Exception:
                        pass

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
                message=f"EC専用収集完了: {total_success}件獲得（{total_urls_found}URL中）",
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

        from server.services.serper_search import search_serper, get_serper_api_key
        serper_key = get_serper_api_key(db=db, org_id=current_user.org_id)
        if not serper_key:
            return {"error": "Serper APIキーが設定されていません。設定画面でSerper APIキーを登録してください。"}

        urls = []
        seen = set()
        for kw in keywords_data:
            query = kw.keyword + (f" {kw.region}" if kw.region else "")
            results = search_serper(serper_key, query, num=10)
            for r in results:
                url = r.get("url", "")
                if url and url not in seen:
                    seen.add(url)
                    urls.append({"url": url, "name": r.get("title", ""), "source": f"Serper検索: {kw.keyword}"})
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


# ─────────────────────────────────────────────────────────────
# ① プラットフォーム別URL直接収集
# ─────────────────────────────────────────────────────────────
@router.post("/ec-platform")
def ec_platform_collect(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    platform = (data.get("platform") or "Shopify").strip()
    keyword = (data.get("keyword") or "").strip()
    region = (data.get("region") or "").strip()
    project_id = data.get("project_id")

    PLATFORM_QUERIES: dict[str, list[str]] = {
        "Shopify": [
            f"site:myshopify.com {keyword}" if keyword else "site:myshopify.com 通販",
            f"Shopify 自社EC 通販 {keyword} {region}".strip(),
            f"Shopify ショップ 運営 {keyword} {region}".strip(),
        ],
        "BASE": [
            f"site:base.shop {keyword}" if keyword else "site:base.shop 通販",
            f"BASE ネットショップ {keyword} {region}".strip(),
        ],
        "STORES": [
            f"site:stores.jp {keyword}" if keyword else "site:stores.jp 通販",
            f"STORES ネットショップ {keyword} {region}".strip(),
        ],
        "MakeShop": [
            f"inurl:makeshop.jp {keyword}" if keyword else "inurl:makeshop.jp 通販",
            f"MakeShop 通販サイト 運営 {keyword} {region}".strip(),
        ],
        "futureshop": [
            f"inurl:future-shop.jp {keyword}" if keyword else "inurl:future-shop.jp 通販",
            f"futureshop EC 運営 {keyword} {region}".strip(),
        ],
        "カラーミー": [
            f"inurl:shop-pro.jp {keyword}" if keyword else "inurl:shop-pro.jp 通販",
            f"カラーミーショップ 運営 {keyword} {region}".strip(),
        ],
        "EC-CUBE": [
            f"EC-CUBE 自社EC {keyword} {region}".strip(),
            f"eccube 通販サイト 運営 {keyword} {region}".strip(),
        ],
        "WooCommerce": [
            f"WooCommerce 通販サイト {keyword} {region}".strip(),
            f"WooCommerce ネットショップ 運営 {keyword} {region}".strip(),
        ],
        "Yahoo!ショッピング": [
            f"site:store.shopping.yahoo.co.jp {keyword}" if keyword else "site:store.shopping.yahoo.co.jp",
            f"Yahoo!ショッピング 出店 {keyword} {region}".strip(),
        ],
        "楽天": [
            f"site:item.rakuten.co.jp {keyword}" if keyword else "site:item.rakuten.co.jp 出店",
            f"楽天市場 出店 ショップ {keyword} {region}".strip(),
        ],
    }

    keywords_text = PLATFORM_QUERIES.get(platform, [
        f"{platform} ECサイト 運営 {keyword} {region}".strip(),
        f"{platform} 通販 自社EC {keyword} {region}".strip(),
    ])
    keywords_text = [kw for kw in keywords_text if kw.strip()]

    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=len(keywords_text),
               message=f"{platform}向けEC収集を開始しています...", status="running",
               job_type="ec_platform")

    def run_platform():
        new_db = SessionLocal()
        try:
            from server.models import SearchKeyword as SKW
            total_success = total_dup = total_rej = 0
            for i, kw_text in enumerate(keywords_text):
                job_update(job_id, current=i, total=len(keywords_text),
                           message=f"({i+1}/{len(keywords_text)}) {platform}探索: 「{kw_text}」...",
                           status="running")
                temp_kw = SKW(
                    keyword=kw_text, category=platform, region=region,
                    exclude_keywords="", is_active=True, project_id=project_id,
                )
                new_db.add(temp_kw)
                new_db.commit()
                new_db.refresh(temp_kw)
                try:
                    result = collect_by_keyword(temp_kw.id, new_db, project_id=project_id,
                                               org_id=current_user.org_id)
                    s = result.get("summary", {})
                    total_success += s.get("success", 0)
                    total_dup += s.get("duplicate", 0)
                    total_rej += s.get("rejected", 0)
                except Exception as e:
                    logger.warning(f"ec-platform kw error: {e}")
                    try:
                        new_db.rollback()
                    except Exception:
                        pass

            cache_invalidate("dashboard")
            job_update(job_id, type="done",
                       result={"total_success": total_success, "total_duplicate": total_dup,
                               "total_rejected": total_rej},
                       message=f"{platform}EC収集完了: {total_success}件獲得")
        except Exception as e:
            job_update(job_id, type="error", message=str(e))
        finally:
            new_db.close()

    threading.Thread(target=run_platform, daemon=True).start()
    return {"job_id": job_id}


# ─────────────────────────────────────────────────────────────
# ⑤ キーワード×都道府県マトリクス自動収集
# ─────────────────────────────────────────────────────────────
@router.post("/ec-matrix")
def ec_matrix_collect(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category_ids = data.get("category_ids") or ["all"]
    prefectures = data.get("prefectures") or [""]
    project_id = data.get("project_id")

    EC_MATRIX_KEYWORDS: dict[str, str] = {
        "apparel":       "アパレル ファッション 通販 自社EC",
        "food":          "食品 グルメ 通販 自社EC",
        "beauty":        "コスメ 化粧品 美容 通販 EC",
        "sports":        "スポーツ アウトドア 通販 EC",
        "interior":      "インテリア 雑貨 通販 自社EC",
        "d2c":           "D2C ブランド 自社通販",
        "shopify_users": "Shopify 通販 EC 運営",
        "all":           "ECサイト 通販 自社EC 運営",
    }

    combos = []
    for cat_id in category_ids:
        base_kw = EC_MATRIX_KEYWORDS.get(cat_id, cat_id)
        for pref in prefectures:
            combos.append((cat_id, pref, f"{base_kw} {pref}".strip() if pref else base_kw))

    if not combos:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="カテゴリと都道府県を1つ以上選択してください")

    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=len(combos),
               message=f"マトリクス収集を開始 ({len(combos)}組み合わせ)...", status="running",
               job_type="ec_matrix")

    def run_matrix():
        new_db = SessionLocal()
        try:
            from server.models import SearchKeyword as SKW
            total_success = total_dup = total_rej = 0
            for i, (cat_id, pref, kw_text) in enumerate(combos):
                label = f"{cat_id}/{pref}" if pref else cat_id
                job_update(job_id, current=i, total=len(combos),
                           message=f"({i+1}/{len(combos)}) [{label}] 収集中...",
                           status="running")
                temp_kw = SKW(
                    keyword=kw_text, category=cat_id, region=pref,
                    exclude_keywords="", is_active=True, project_id=project_id,
                )
                new_db.add(temp_kw)
                new_db.commit()
                new_db.refresh(temp_kw)
                try:
                    result = collect_by_keyword(temp_kw.id, new_db, project_id=project_id,
                                               org_id=current_user.org_id)
                    s = result.get("summary", {})
                    total_success += s.get("success", 0)
                    total_dup += s.get("duplicate", 0)
                    total_rej += s.get("rejected", 0)
                except Exception as e:
                    logger.warning(f"ec-matrix combo error ({kw_text}): {e}")
                    try:
                        new_db.rollback()
                    except Exception:
                        pass

            cache_invalidate("dashboard")
            job_update(job_id, type="done",
                       result={"total_success": total_success, "total_duplicate": total_dup,
                               "total_rejected": total_rej, "combos": len(combos)},
                       message=f"マトリクス収集完了: {total_success}件獲得 ({len(combos)}組み合わせ)")
        except Exception as e:
            job_update(job_id, type="error", message=str(e))
        finally:
            new_db.close()

    threading.Thread(target=run_matrix, daemon=True).start()
    return {"job_id": job_id}


# ─────────────────────────────────────────────────────────────
# ⑥ 競合EC類似サイト検索
# ─────────────────────────────────────────────────────────────
@router.post("/ec-similar")
def ec_similar_collect(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_id = data.get("company_id")
    domain = (data.get("domain") or "").strip()
    cms_type = (data.get("cms_type") or "").strip()
    category = (data.get("category") or "").strip()
    project_id = data.get("project_id")

    if company_id:
        from server.models import Company as CompanyModel
        company = db.query(CompanyModel).filter(CompanyModel.id == company_id).first()
        if company:
            domain = company.domain or domain
            cms_type = company.cms_type or cms_type
            category = company.category_main or category

    if not cms_type and not category:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="CMS種類かカテゴリを指定してください")

    keywords_text = []
    if cms_type:
        keywords_text.append(f"{cms_type} 通販 ECサイト 運営")
        if category:
            keywords_text.append(f"{cms_type} {category} ネットショップ")
    if category:
        keywords_text.append(f"{category} 通販 自社EC ブランド")
        keywords_text.append(f"{category} ECサイト 運営 会社")

    keywords_text = list(dict.fromkeys(kw for kw in keywords_text if kw.strip()))[:5]

    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=len(keywords_text),
               message="類似EC企業の検索を開始しています...", status="running",
               job_type="ec_similar")

    def run_similar():
        new_db = SessionLocal()
        try:
            from server.models import SearchKeyword as SKW
            total_success = total_dup = total_rej = 0
            for i, kw_text in enumerate(keywords_text):
                job_update(job_id, current=i, total=len(keywords_text),
                           message=f"({i+1}/{len(keywords_text)}) 類似サイト探索: 「{kw_text}」...",
                           status="running")
                temp_kw = SKW(
                    keyword=kw_text, category=cms_type or category, region="",
                    exclude_keywords=domain, is_active=True, project_id=project_id,
                )
                new_db.add(temp_kw)
                new_db.commit()
                new_db.refresh(temp_kw)
                try:
                    result = collect_by_keyword(temp_kw.id, new_db, project_id=project_id,
                                               org_id=current_user.org_id)
                    s = result.get("summary", {})
                    total_success += s.get("success", 0)
                    total_dup += s.get("duplicate", 0)
                    total_rej += s.get("rejected", 0)
                except Exception as e:
                    logger.warning(f"ec-similar kw error: {e}")
                    try:
                        new_db.rollback()
                    except Exception:
                        pass

            cache_invalidate("dashboard")
            job_update(job_id, type="done",
                       result={"total_success": total_success, "total_duplicate": total_dup,
                               "total_rejected": total_rej},
                       message=f"類似EC検索完了: {total_success}件獲得")
        except Exception as e:
            job_update(job_id, type="error", message=str(e))
        finally:
            new_db.close()

    threading.Thread(target=run_similar, daemon=True).start()
    return {"job_id": job_id}
