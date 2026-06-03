import logging
import threading
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from server.database import get_db, SessionLocal
from server.models import SalesMessage, AuditLog, OptOutList, Company, CompanyMaster, User, AppSetting, Project
from server.auth import get_current_user

router = APIRouter(prefix="/api/sales-ai", tags=["sales-ai"])
logger = logging.getLogger(__name__)

# ── バックグラウンドジョブストア ──────────────────────────────────────────────
_JOBS: Dict[str, Dict[str, Any]] = {}
_JOBS_LOCK = threading.Lock()


def _update_job(job_id: str, **kwargs):
    with _JOBS_LOCK:
        if job_id in _JOBS:
            _JOBS[job_id].update(kwargs)


def _owned_projects(current_user: User, db: Session):
    """自org配下のプロジェクトIDリストを返す。"""
    return [p.id for p in db.query(Project.id).filter(Project.org_id == current_user.org_id).all()]


def _expand_variables(text: str, company: Company) -> str:
    """{{会社名}} 等の変数を企業情報で置換する。"""
    if not text:
        return text
    replacements = {
        "{{会社名}}": company.company_name or "",
        "{{担当者名}}": company.contact_name or "",
        "{{担当者役職}}": company.contact_title or "",
        "{{都道府県}}": company.prefecture or "",
    }
    for var, val in replacements.items():
        text = text.replace(var, val)
    return text


def _msg_to_dict(m: SalesMessage, company_name: str = None) -> dict:
    return {
        "id": m.id,
        "org_id": m.org_id,
        "company_id": m.company_id,
        "company_name": company_name,
        "project_id": m.project_id,
        "template_type": m.template_type,
        "subject": m.subject,
        "body": m.body,
        "ai_prompt_id": m.ai_prompt_id,
        "status": m.status,
        "reviewed_by": m.reviewed_by,
        "reviewed_at": m.reviewed_at.isoformat() if m.reviewed_at else None,
        "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        "sent_by": m.sent_by,
        "open_count": m.open_count or 0,
        "opened_at": m.opened_at.isoformat() if m.opened_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def _company_obj_to_dict(c: Company) -> dict:
    return {
        "id": c.id,
        "company_name": c.company_name,
        "prefecture": c.prefecture,
        "city": c.city,
        "category_main": c.category_main,
        "cms_type": c.cms_type,
        "ec_score": c.ec_score,
        "ec_flag": c.ec_flag,
        "shopify_flag": c.shopify_flag,
        "sns_count": c.sns_count,
        "score_total": c.score_total,
        "score_rank": c.score_rank,
        "email": c.email,
        "domain": c.domain,
        "website_url": c.website_url,
    }


def _get_company_dict(company_id: int, db: Session) -> dict:
    c = db.query(Company).filter(Company.id == company_id).first()
    if c:
        return _company_obj_to_dict(c)
    return {}


def _is_opted_out(email: str, domain: str, db: Session) -> bool:
    if email:
        row = db.query(OptOutList).filter(OptOutList.email == email).first()
        if row:
            return True
    if domain:
        row = db.query(OptOutList).filter(OptOutList.domain == domain).first()
        if row:
            return True
    return False


class GenerateRequest(BaseModel):
    company_id: int
    template_type: str
    project_id: Optional[int] = None
    custom_template_id: Optional[int] = None
    analyze_site: bool = True


class GenerateBatchRequest(BaseModel):
    company_ids: list[int]
    template_type: str
    project_id: Optional[int] = None
    custom_template_id: Optional[int] = None
    skip_existing: bool = False
    analyze_site: bool = True


class BulkSendRequest(BaseModel):
    send_method: str = "manual"
    profile_id: Optional[int] = None
    message_ids: Optional[list[int]] = None


class BgJobRequest(BaseModel):
    company_ids: List[int]
    template_type: str = "shopify"
    project_id: Optional[int] = None
    custom_template_id: Optional[int] = None
    skip_existing: bool = True
    analyze_site: bool = False
    auto_send_form: bool = False
    profile_id: Optional[int] = None


class UpdateMessageRequest(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None


class SendMessageRequest(BaseModel):
    send_method: str = "email"
    note: Optional[str] = None
    profile_id: Optional[int] = None


class OptOutRequest(BaseModel):
    email: Optional[str] = None
    domain: Optional[str] = None
    company_id: Optional[int] = None
    reason: Optional[str] = None


def _run_bg_job(job_id: str, req: BgJobRequest, org_id: int):
    """バックグラウンドスレッドで生成→オプションでフォーム送信を実行する。"""
    import concurrent.futures
    from server.services.ai_writer import generate_sales_message, generate_from_custom_template, _resolve_anthropic_key

    BATCH = 50
    company_ids = req.company_ids
    chunks = [company_ids[i:i+BATCH] for i in range(0, len(company_ids), BATCH)]
    _update_job(job_id, total_batches=len(chunks))

    db = SessionLocal()
    try:
        api_key = _resolve_anthropic_key()

        custom_tpl = None
        if req.custom_template_id:
            from server.models import MemoTemplate
            custom_tpl = db.query(MemoTemplate).filter(
                MemoTemplate.id == req.custom_template_id,
                MemoTemplate.org_id == org_id,
            ).first()

        all_cos = db.query(Company).filter(Company.id.in_(company_ids)).all()
        cos_map = {c.id: c for c in all_cos}

        opted_emails: set = set()
        opted_domains: set = set()
        emails = [c.email for c in all_cos if c.email]
        domains = [c.domain for c in all_cos if c.domain]
        if emails:
            opted_emails = {r[0] for r in db.query(OptOutList.email).filter(OptOutList.email.in_(emails)).all()}
        if domains:
            opted_domains = {r[0] for r in db.query(OptOutList.domain).filter(OptOutList.domain.in_(domains)).all()}

        existing_ids: set = set()
        if req.skip_existing:
            rows = db.query(SalesMessage.company_id).filter(
                SalesMessage.org_id == org_id,
                SalesMessage.company_id.in_(company_ids),
                SalesMessage.status != "failed",
            ).all()
            existing_ids = {r[0] for r in rows}

        effective_type = f"custom:{custom_tpl.id}" if custom_tpl else req.template_type
        all_generated_ids: List[int] = []
        total_generated = 0

        for i, chunk in enumerate(chunks):
            _update_job(job_id, batch=i + 1)

            eligible = []
            for cid in chunk:
                if cid in existing_ids:
                    continue
                c = cos_map.get(cid)
                if not c:
                    continue
                if (c.email and c.email in opted_emails) or (c.domain and c.domain in opted_domains):
                    continue
                eligible.append((cid, _company_obj_to_dict(c)))

            if not eligible:
                _update_job(job_id, done=min((i + 1) * BATCH, len(company_ids)))
                continue

            site_summaries: dict = {}
            if req.analyze_site and not custom_tpl:
                from server.services.ai_writer import scrape_site_summary as _scrape
                def _do_scrape(item):
                    cid, cdict = item
                    url = cdict.get("website_url") or cdict.get("domain") or ""
                    if url and not url.startswith("http"):
                        url = "https://" + url
                    return (cid, _scrape(url) if url else "")
                with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
                    for cid, s in ex.map(_do_scrape, eligible):
                        site_summaries[cid] = s

            def _gen_one(args):
                cid, cdict = args
                try:
                    if custom_tpl:
                        result = generate_from_custom_template(cdict, custom_tpl.content, custom_tpl.title)
                    else:
                        result = generate_sales_message(cdict, req.template_type, api_key=api_key, site_summary=site_summaries.get(cid, ""))
                    return (cid, result, None)
                except Exception as e:
                    return (cid, None, str(e))

            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
                gen_results = list(ex.map(_gen_one, eligible))

            batch_gen = 0
            for cid, result, error in gen_results:
                if error or not result:
                    continue
                msg = SalesMessage(
                    org_id=org_id,
                    company_id=cid,
                    project_id=req.project_id,
                    template_type=effective_type,
                    subject=result["subject"],
                    body=result["body"],
                    ai_prompt_id=result.get("ai_prompt_id"),
                    status="draft",
                )
                db.add(msg)
                db.flush()
                all_generated_ids.append(msg.id)
                batch_gen += 1

            db.commit()
            total_generated += batch_gen
            _update_job(job_id, done=min((i + 1) * BATCH, len(company_ids)), generated=total_generated)

        if req.auto_send_form and all_generated_ids:
            _update_job(job_id, phase="sending")
            from server.services.form_sender import send_form_auto
            from server.services.ai_analyzer import get_openai_key
            from server.models import Organization, FormSenderProfile as FProf

            openai_key = get_openai_key(db, org_id)
            if not openai_key:
                _update_job(job_id, status="done", phase="done", error="OpenAI APIキー未設定のためフォーム送信をスキップしました")
                return

            org = db.query(Organization).filter(Organization.id == org_id).first()
            smtp_s = {}
            try:
                from server.services.mailer import get_smtp_settings
                smtp_s = get_smtp_settings(db, org_id)
            except Exception:
                pass

            prof = db.query(FProf).filter(FProf.id == req.profile_id, FProf.org_id == org_id).first() if req.profile_id else None

            if prof:
                sname = prof.display_name or ""
                semail = prof.email or smtp_s.get("smtp_from_email") or ""
                scompany = prof.company_name or (org.name if org else "")
                sphone = prof.phone or ""
                stitle = prof.title or ""
                sdept = prof.department or ""
                swebsite = prof.website_url or ""
                spostal = prof.postal_code or ""
                ssubject = prof.subject or ""
                spref = prof.prefecture or ""
                saddress = prof.address or ""
            else:
                sname = smtp_s.get("smtp_from_name") or ""
                semail = smtp_s.get("smtp_from_email") or ""
                scompany = org.name if org else ""
                sphone = org.phone if org else ""
                stitle = swebsite = sdept = spostal = ssubject = spref = saddress = ""

            msgs = db.query(SalesMessage).filter(SalesMessage.id.in_(all_generated_ids)).all()
            sent_c = 0
            failed_c = 0
            early = {"未確認", "対象候補", "アプローチ前"}

            for msg in msgs:
                co = cos_map.get(msg.company_id) or db.query(Company).filter(Company.id == msg.company_id).first()
                if not co or not co.website_url:
                    failed_c += 1
                    _update_job(job_id, failed=failed_c)
                    continue
                body = _expand_variables(msg.body or "", co)
                subject = _expand_variables(msg.subject or ssubject or "", co)
                try:
                    r = send_form_auto(
                        company_name=co.company_name or "",
                        website_url=co.website_url or "",
                        contact_url=co.contact_url or "",
                        message_body=body,
                        sender_name=sname,
                        sender_email=semail,
                        sender_company=scompany,
                        sender_phone=sphone,
                        sender_title=stitle,
                        openai_key=openai_key,
                        sender_department=sdept,
                        sender_website_url=swebsite,
                        sender_postal_code=spostal,
                        sender_prefecture=spref,
                        sender_address=saddress,
                        subject=subject,
                    )
                    if r.get("success"):
                        msg.status = "sent"
                        msg.sent_at = datetime.utcnow()
                        if co.status in early:
                            co.status = "フォーム送信済"
                        sent_c += 1
                    else:
                        msg.status = "failed"
                        logger.warning(f"BG form send failed co={co.id}: {r.get('message')}")
                        failed_c += 1
                except Exception as ex:
                    logger.exception(f"BG form send exception co={co.id}: {ex}")
                    msg.status = "failed"
                    failed_c += 1
                db.commit()
                _update_job(job_id, sent=sent_c, failed=failed_c)

        _update_job(job_id, status="done", phase="done")
    except Exception as e:
        logger.error(f"BG job {job_id} error: {e}")
        _update_job(job_id, status="error", error=str(e))
    finally:
        db.close()


# ── ジョブ管理エンドポイント（固定パスを動的パスより前に置く） ──────────────
@router.post("/jobs/start")
def start_bg_job(req: BgJobRequest, current_user: User = Depends(get_current_user)):
    if len(req.company_ids) == 0:
        raise HTTPException(status_code=400, detail="company_ids が空です")
    job_id = str(uuid.uuid4())[:8]
    with _JOBS_LOCK:
        _JOBS[job_id] = {
            "job_id": job_id,
            "status": "running",
            "phase": "generating",
            "done": 0,
            "total": len(req.company_ids),
            "batch": 0,
            "total_batches": 0,
            "generated": 0,
            "sent": 0,
            "failed": 0,
            "error": None,
            "org_id": current_user.org_id,
            "auto_send_form": req.auto_send_form,
            "started_at": datetime.utcnow().isoformat(),
        }
    thread = threading.Thread(target=_run_bg_job, args=(job_id, req, current_user.org_id), daemon=True)
    thread.start()
    return {"job_id": job_id}


@router.get("/jobs/active")
def get_active_jobs(current_user: User = Depends(get_current_user)):
    with _JOBS_LOCK:
        active = [j.copy() for j in _JOBS.values()
                  if j["org_id"] == current_user.org_id and j["status"] == "running"]
    return {"jobs": active}


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str, current_user: User = Depends(get_current_user)):
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if job:
            job = job.copy()
    if not job:
        raise HTTPException(status_code=404, detail="ジョブが見つかりません")
    if job["org_id"] != current_user.org_id:
        raise HTTPException(status_code=403, detail="アクセス権限がありません")
    return job


@router.post("/generate")
def generate_single(
    req: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.services.ai_writer import generate_sales_message, scrape_site_summary

    company_dict = _get_company_dict(req.company_id, db)
    if not company_dict:
        raise HTTPException(status_code=404, detail="企業が見つかりません")

    domain = ""
    c = db.query(Company).filter(Company.id == req.company_id).first()
    if c:
        domain = c.domain or ""

    if _is_opted_out(company_dict.get("email", ""), domain, db):
        raise HTTPException(status_code=400, detail="この企業/メールアドレスは配信停止リストに登録されています")

    # サイト分析（失敗してもDB情報で生成続行）
    site_summary = ""
    if req.analyze_site:
        url = company_dict.get("website_url") or company_dict.get("domain") or ""
        if url and not url.startswith("http"):
            url = "https://" + url
        if url:
            site_summary = scrape_site_summary(url)

    try:
        result = generate_sales_message(company_dict, req.template_type, site_summary=site_summary)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"generate_single error: {e}")
        raise HTTPException(status_code=500, detail=f"AI生成エラー: {str(e)}")

    msg = SalesMessage(
        org_id=current_user.org_id,
        company_id=req.company_id,
        project_id=req.project_id,
        template_type=req.template_type,
        subject=result["subject"],
        body=result["body"],
        ai_prompt_id=result["ai_prompt_id"],
        status="draft",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    resp = _msg_to_dict(msg, company_dict.get("company_name"))
    resp["site_analyzed"] = result.get("site_analyzed", False)
    return resp


@router.post("/generate-batch")
def generate_batch(
    req: GenerateBatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import os
    import concurrent.futures
    from server.services.ai_writer import generate_sales_message, generate_from_custom_template, _resolve_anthropic_key

    if len(req.company_ids) > 50:
        raise HTTPException(status_code=400, detail="一括生成は最大50件です")

    # ── Phase 1: バッチDBフェッチ（N+1排除） ──────────────────────────────
    custom_tpl = None
    if req.custom_template_id:
        from server.models import MemoTemplate
        custom_tpl = db.query(MemoTemplate).filter(
            MemoTemplate.id == req.custom_template_id,
            MemoTemplate.org_id == current_user.org_id,
        ).first()
        if not custom_tpl:
            raise HTTPException(status_code=404, detail="カスタムテンプレートが見つかりません")

    # 全企業を1回のクエリで取得
    company_rows = db.query(Company).filter(Company.id.in_(req.company_ids)).all()
    companies_map: dict[int, Company] = {c.id: c for c in company_rows}

    # 生成済みチェックを1回のクエリで
    existing_company_ids: set[int] = set()
    if req.skip_existing:
        existing_rows = db.query(SalesMessage.company_id).filter(
            SalesMessage.org_id == current_user.org_id,
            SalesMessage.company_id.in_(req.company_ids),
            SalesMessage.status != "failed",
        ).all()
        existing_company_ids = {r[0] for r in existing_rows}

    # 配信停止リストを1回のクエリで
    all_emails = [c.email for c in company_rows if c.email]
    all_domains = [c.domain for c in company_rows if c.domain]
    opted_out_emails: set[str] = set()
    opted_out_domains: set[str] = set()
    if all_emails:
        opted_out_emails = {r[0] for r in db.query(OptOutList.email).filter(OptOutList.email.in_(all_emails)).all()}
    if all_domains:
        opted_out_domains = {r[0] for r in db.query(OptOutList.domain).filter(OptOutList.domain.in_(all_domains)).all()}

    # APIキーを1回だけ解決（スレッド内で毎回DBアクセスしない）
    api_key = _resolve_anthropic_key()

    # ── Phase 2: フィルタリング ────────────────────────────────────────────
    errors: list[dict] = []
    skipped = 0
    eligible: list[tuple[int, dict]] = []  # (company_id, company_dict)

    for company_id in req.company_ids:
        if company_id in existing_company_ids:
            skipped += 1
            continue
        c = companies_map.get(company_id)
        if not c:
            errors.append({"company_id": company_id, "error": "企業が見つかりません"})
            continue
        email = c.email or ""
        domain = c.domain or ""
        if email in opted_out_emails or domain in opted_out_domains:
            errors.append({"company_id": company_id, "error": "配信停止リストに登録済み"})
            continue
        eligible.append((company_id, _company_obj_to_dict(c)))

    # ── Phase 2.5: サイト分析を並列スクレイピング ────────────────────────
    site_summaries: dict[int, str] = {}
    if req.analyze_site and not custom_tpl:
        from server.services.ai_writer import scrape_site_summary as _scrape

        def _do_scrape(item: tuple[int, dict]) -> tuple[int, str]:
            cid, cdict = item
            url = cdict.get("website_url") or cdict.get("domain") or ""
            if url and not url.startswith("http"):
                url = "https://" + url
            return (cid, _scrape(url) if url else "")

        # スクレイピングはI/O待ちが多いので多めに並列実行
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as scrape_executor:
            for cid, summary in scrape_executor.map(_do_scrape, eligible):
                site_summaries[cid] = summary

    # ── Phase 3: Claude API呼び出しを並列実行 ────────────────────────────
    effective_type = f"custom:{custom_tpl.id}" if custom_tpl else req.template_type

    def _generate_one(args: tuple[int, dict]) -> tuple[int, dict, dict | None, str | None]:
        cid, cdict = args
        try:
            if custom_tpl:
                result = generate_from_custom_template(cdict, custom_tpl.content, custom_tpl.title)
            else:
                result = generate_sales_message(
                    cdict, req.template_type,
                    api_key=api_key,
                    site_summary=site_summaries.get(cid, ""),
                )
            return (cid, cdict, result, None)
        except RuntimeError as e:
            return (cid, cdict, None, str(e))
        except Exception as e:
            logger.error(f"batch generate error for company {cid}: {e}")
            return (cid, cdict, None, f"AI生成エラー: {str(e)}")

    MAX_WORKERS = 5  # Anthropic レート制限に配慮
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        gen_results = list(executor.map(_generate_one, eligible))

    # ── Phase 4: バッチDBライト ───────────────────────────────────────────
    results: list[dict] = []
    for company_id, company_dict, result, error in gen_results:
        if error:
            errors.append({"company_id": company_id, "error": error})
            continue
        msg = SalesMessage(
            org_id=current_user.org_id,
            company_id=company_id,
            project_id=req.project_id,
            template_type=effective_type,
            subject=result["subject"],
            body=result["body"],
            ai_prompt_id=result["ai_prompt_id"],
            status="draft",
        )
        db.add(msg)
        db.flush()
        results.append(_msg_to_dict(msg, company_dict.get("company_name")))

    db.commit()

    return {
        "generated": results,
        "errors": errors,
        "total_requested": len(req.company_ids),
        "total_generated": len(results),
        "total_skipped": skipped,
        "generated_ids": [r["id"] for r in results],
    }


@router.get("/messages")
def list_messages(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _LIMIT = 500
    q = (
        db.query(SalesMessage, Company.company_name)
        .outerjoin(Company, SalesMessage.company_id == Company.id)
        .filter(SalesMessage.org_id == current_user.org_id)
    )
    if status:
        q = q.filter(SalesMessage.status == status)

    total = q.count()
    rows = q.order_by(SalesMessage.created_at.desc()).limit(_LIMIT).all()

    return {
        "messages": [_msg_to_dict(m, cname) for m, cname in rows],
        "total": total,
        "limited": total > _LIMIT,
    }


@router.put("/messages/{message_id}")
def update_message(
    message_id: int,
    req: UpdateMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")
    if msg.status == "sent":
        raise HTTPException(status_code=400, detail="送信済みのメッセージは編集できません")

    if req.subject is not None:
        msg.subject = req.subject
    if req.body is not None:
        msg.body = req.body
    msg.status = "reviewed"
    msg.reviewed_by = current_user.id
    msg.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    c = db.query(Company).filter(Company.id == msg.company_id).first()
    return _msg_to_dict(msg, c.company_name if c else None)


@router.get("/messages/{message_id}/send-preview")
def get_send_preview(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")

    c = db.query(Company).filter(Company.id == msg.company_id).first()
    email = (c.email or "") if c else ""
    contact_url = (c.contact_url or "") if c else ""
    domain = (c.domain or "") if c else ""

    opted_out = False
    if email or domain:
        opted_out = _is_opted_out(email, domain, db)

    from server.services.mailer import get_smtp_settings
    smtp = get_smtp_settings(db, current_user.org_id)
    smtp_ok = bool(smtp.get("smtp_host") and smtp.get("smtp_from_email"))

    return {
        "company_name": c.company_name if c else None,
        "email": email,
        "contact_url": contact_url,
        "opted_out": opted_out,
        "smtp_configured": smtp_ok,
        "can_send_email": bool(email and smtp_ok and not opted_out),
    }


@router.post("/messages/{message_id}/send")
def send_message(
    message_id: int,
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")
    if msg.status == "sent":
        raise HTTPException(status_code=400, detail="既に送信済みです")

    c = db.query(Company).filter(Company.id == msg.company_id).first()
    email = (c.email or "") if c else ""
    domain = (c.domain or "") if c else ""

    if email or domain:
        if _is_opted_out(email, domain, db):
            raise HTTPException(status_code=400, detail="この企業/メールアドレスは配信停止リストに登録されています")

    send_result = "sent"
    send_note = req.note or ""
    actually_sent = False

    # ── 変数展開（{{会社名}} 等） ──────────────────────────────────────────
    send_subject = _expand_variables(msg.subject or "", c) if c else (msg.subject or "")
    send_body = _expand_variables(msg.body or "", c) if c else (msg.body or "")

    if req.send_method == "email" and email:
        from server.routes.plans import check_smtp_allowed
        check_smtp_allowed(current_user.org_id, db)

        from server.services.mailer import get_smtp_settings, send_email
        smtp = get_smtp_settings(db, current_user.org_id)

        if not smtp.get("smtp_host"):
            raise HTTPException(
                status_code=400,
                detail="SMTPが設定されていません。設定画面でSMTPを設定するか、送信方法を「手動」に変更してください。"
            )

        from server.services.unsubscribe_token import build_unsubscribe_url
        unsub_url = build_unsubscribe_url(email)

        body_text = send_body
        if unsub_url:
            body_text_footer = f"\n\n---\n配信停止はこちら: {unsub_url}"
        else:
            body_text_footer = "\n\n---\n配信停止をご希望の場合は、このメールへの返信にてお知らせください。"

        paragraphs = []
        for line in body_text.split("\n"):
            if line.strip():
                paragraphs.append(f"<p style='margin: 0 0 0.8em 0;'>{line}</p>")
            else:
                paragraphs.append("<br>")
        body_html_content = "\n".join(paragraphs)

        if unsub_url:
            footer_html = (
                f'<a href="{unsub_url}" style="color: #999; text-decoration: underline;">'
                f'配信停止はこちらをクリック</a>'
            )
        else:
            footer_html = "配信停止をご希望の場合は、このメールへの返信にてお知らせください。"

        body_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
{body_html_content}
<hr style="margin-top: 2.5em; border: none; border-top: 1px solid #eee;">
<p style="font-size: 11px; color: #aaa; margin-top: 1em;">
このメールは LeadHive を通じて送信されました。<br>
{footer_html}
</p>
</body></html>"""

        # ── トラッキングトークン生成 ─────────────────────────────────────
        import secrets as _secrets
        tracking_token = _secrets.token_urlsafe(32)
        msg.tracking_token = tracking_token
        tracking_pixel = (
            f'<img src="https://leadhive.work/api/track/{tracking_token}.gif" '
            f'width="1" height="1" style="display:none;" alt="" />'
        )
        body_html = body_html.replace("</body>", f"{tracking_pixel}\n</body>")

        extra_headers: dict = {}
        if unsub_url:
            extra_headers["List-Unsubscribe"] = f"<{unsub_url}>"
            extra_headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        success, detail = send_email(
            to=email,
            subject=send_subject,
            html_body=body_html,
            text_body=body_text + body_text_footer,
            smtp_settings=smtp,
            extra_headers=extra_headers,
        )
        actually_sent = success
        send_result = "sent" if success else "failed"
        if not success:
            send_note = f"SMTP送信失敗: {detail}"
            logger.warning(f"SalesAI email send failed to {email}: {detail}")
        else:
            send_note = f"送信先: {email}" + (f" / {req.note}" if req.note else "")

    elif req.send_method == "form":
        from server.services.form_sender import send_form_auto
        from server.services.ai_analyzer import get_openai_key
        from server.models import Organization

        openai_key = get_openai_key(db, current_user.org_id)
        if not openai_key:
            raise HTTPException(
                status_code=400,
                detail="OpenAI APIキーが設定されていません。設定画面でAPIキーを設定してください。"
            )

        org = db.query(Organization).filter(Organization.id == current_user.org_id).first()

        smtp_s = {}
        try:
            from server.services.mailer import get_smtp_settings
            smtp_s = get_smtp_settings(db, current_user.org_id)
        except Exception:
            pass

        if req.profile_id:
            from server.models import FormSenderProfile
            prof = db.query(FormSenderProfile).filter(
                FormSenderProfile.id == req.profile_id,
                FormSenderProfile.org_id == current_user.org_id
            ).first()
        else:
            prof = None

        if prof:
            sender_name = prof.display_name or current_user.display_name or current_user.email or ""
            sender_email = prof.email or smtp_s.get("smtp_from_email") or current_user.email or ""
            sender_company = prof.company_name or (org.name if org else "")
            sender_phone = prof.phone or ""
            sender_title = prof.title or ""
            sender_department = prof.department or ""
            sender_website_url = prof.website_url or ""
            sender_postal_code = prof.postal_code or ""
            sender_subject = prof.subject or ""
            sender_prefecture = prof.prefecture or ""
            sender_address = prof.address or ""
        else:
            sender_name = current_user.display_name or current_user.email or ""
            sender_email = smtp_s.get("smtp_from_email") or current_user.email or ""
            sender_company = org.name if org else ""
            sender_phone = current_user.phone or (org.phone if org else "") or ""
            sender_title = current_user.title or ""
            sender_department = ""
            sender_website_url = ""
            sender_postal_code = ""
            sender_subject = ""
            sender_prefecture = ""
            sender_address = ""

        form_result = send_form_auto(
            company_name=c.company_name if c else "",
            website_url=c.website_url or "" if c else "",
            contact_url=c.contact_url or "" if c else "",
            message_body=send_body,
            sender_name=sender_name,
            sender_email=sender_email,
            sender_company=sender_company,
            sender_phone=sender_phone or "",
            sender_title=sender_title,
            openai_key=openai_key,
            sender_department=sender_department,
            sender_website_url=sender_website_url,
            sender_postal_code=sender_postal_code,
            sender_prefecture=sender_prefecture,
            sender_address=sender_address,
            subject=sender_subject or send_subject,
        )

        actually_sent = form_result["success"]
        send_result = "sent" if actually_sent else "failed"
        form_url = form_result.get("form_url", "")
        send_note = form_result["message"]
        if form_url:
            send_note += f" / URL: {form_url}"
        if req.note:
            send_note += f" / {req.note}"

        if not actually_sent:
            logger.warning(f"Form auto-send failed for company {msg.company_id}: {form_result['message']}")

    else:
        actually_sent = True

    final_status = "sent" if (req.send_method not in ("email", "form") or actually_sent) else "failed"
    msg.status = final_status
    msg.sent_at = datetime.utcnow()
    msg.sent_by = current_user.id

    if final_status == "sent" and c:
        early_statuses = {"未確認", "対象候補", "アプローチ前"}
        if c.status in early_statuses or c.status is None:
            c.status = "フォーム送信済"

    audit = AuditLog(
        company_id=msg.company_id,
        send_method=req.send_method,
        sent_by_user_id=current_user.id,
        message_id=msg.id,
        ai_prompt_id=msg.ai_prompt_id,
        result=send_result,
        note=send_note,
    )
    db.add(audit)
    db.commit()
    db.refresh(msg)

    result = _msg_to_dict(msg, c.company_name if c else None)
    result["send_result"] = send_result
    result["send_detail"] = send_note
    return result


@router.post("/messages/bulk-send")
def bulk_send_messages(
    req: BulkSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """レビュー済みメッセージを一括送信（手動記録）する。"""
    owned_pids = _owned_projects(current_user, db)

    q = (
        db.query(SalesMessage)
        .join(Company, SalesMessage.company_id == Company.id)
        .filter(
            SalesMessage.status == "reviewed",
            Company.project_id.in_(owned_pids),
        )
    )
    if req.message_ids:
        q = q.filter(SalesMessage.id.in_(req.message_ids))

    msgs = q.all()
    send_method = req.send_method or "manual"
    early_statuses = {"未確認", "対象候補", "アプローチ前"}

    sent_count = 0
    failed_count = 0

    for msg in msgs:
        try:
            c = db.query(Company).filter(Company.id == msg.company_id).first()
            msg.status = "sent"
            msg.sent_at = datetime.utcnow()
            msg.sent_by = current_user.id
            if c and (c.status in early_statuses or c.status is None):
                c.status = "フォーム送信済"
            db.add(AuditLog(
                company_id=msg.company_id,
                send_method=send_method,
                sent_by_user_id=current_user.id,
                message_id=msg.id,
                ai_prompt_id=msg.ai_prompt_id,
                result="sent",
                note=f"一括送信 ({send_method})",
            ))
            sent_count += 1
        except Exception as e:
            logger.warning(f"bulk_send: error on message {msg.id}: {e}")
            failed_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB更新に失敗しました: {str(e)}")

    return {"sent": sent_count, "failed": failed_count, "total": len(msgs)}


@router.post("/messages/bulk-send-form")
def bulk_send_form_messages(
    req: BulkSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """レビュー済みメッセージをフォーム自動送信で一括送信する。"""
    from server.services.form_sender import send_form_auto
    from server.services.ai_analyzer import get_openai_key
    from server.models import Organization, FormSenderProfile as FormSenderProfileModel

    openai_key = get_openai_key(db, current_user.org_id)
    if not openai_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI APIキーが設定されていません。設定画面でAPIキーを設定してください。"
        )

    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    smtp_s = {}
    try:
        from server.services.mailer import get_smtp_settings
        smtp_s = get_smtp_settings(db, current_user.org_id)
    except Exception:
        pass

    if req.profile_id:
        prof = db.query(FormSenderProfileModel).filter(
            FormSenderProfileModel.id == req.profile_id,
            FormSenderProfileModel.org_id == current_user.org_id,
        ).first()
    else:
        prof = None

    if prof:
        sender_name = prof.display_name or current_user.display_name or current_user.email or ""
        sender_email = prof.email or smtp_s.get("smtp_from_email") or current_user.email or ""
        sender_company = prof.company_name or (org.name if org else "")
        sender_phone = prof.phone or ""
        sender_title = prof.title or ""
        sender_department = prof.department or ""
        sender_website_url = prof.website_url or ""
        sender_postal_code = prof.postal_code or ""
        sender_subject = prof.subject or ""
        sender_prefecture = prof.prefecture or ""
        sender_address = prof.address or ""
    else:
        sender_name = current_user.display_name or current_user.email or ""
        sender_email = smtp_s.get("smtp_from_email") or current_user.email or ""
        sender_company = org.name if org else ""
        sender_phone = current_user.phone or (org.phone if org else "") or ""
        sender_title = current_user.title or ""
        sender_department = ""
        sender_website_url = ""
        sender_postal_code = ""
        sender_subject = ""
        sender_prefecture = ""
        sender_address = ""

    owned_pids = _owned_projects(current_user, db)
    q = (
        db.query(SalesMessage)
        .join(Company, SalesMessage.company_id == Company.id)
        .filter(
            SalesMessage.status.in_(["draft", "reviewed"]),
            Company.project_id.in_(owned_pids),
        )
    )
    if req.message_ids:
        q = q.filter(SalesMessage.id.in_(req.message_ids))

    msgs = q.all()
    early_statuses = {"未確認", "対象候補", "アプローチ前"}
    sent_count = 0
    failed_count = 0
    skipped_count = 0

    INVALID_NAME_PATTERNS = {
        "403 forbidden", "404 not found", "not found", "403", "404",
        "ログイン", "login", "sign in", "signin", "access denied",
        "unauthorized", "forbidden", "error", "ページが見つかりません",
        "アクセスが拒否されました",
    }

    for msg in msgs:
        try:
            c = db.query(Company).filter(Company.id == msg.company_id).first()

            # URLが全くない場合はスキップ
            has_url = c and (c.website_url or c.contact_url)
            if not has_url:
                skipped_count += 1
                continue

            # 会社名がHTTPエラーやログインページを示す場合はスキップ
            cname = (c.company_name or "").strip().lower()
            if cname in INVALID_NAME_PATTERNS or not cname:
                skipped_count += 1
                continue

            expanded_body = _expand_variables(msg.body or "", c) if c else (msg.body or "")
            expanded_subject = _expand_variables(msg.subject or "", c) if c else (msg.subject or "")
            form_result = send_form_auto(
                company_name=c.company_name if c else "",
                website_url=c.website_url or "" if c else "",
                contact_url=c.contact_url or "" if c else "",
                message_body=expanded_body,
                sender_name=sender_name,
                sender_email=sender_email,
                sender_company=sender_company,
                sender_phone=sender_phone,
                sender_title=sender_title,
                openai_key=openai_key,
                sender_department=sender_department,
                sender_website_url=sender_website_url,
                sender_postal_code=sender_postal_code,
                sender_prefecture=sender_prefecture,
                sender_address=sender_address,
                subject=sender_subject or expanded_subject,
            )
            success = form_result["success"]
            note = form_result["message"]
            form_url = form_result.get("form_url", "")
            if form_url:
                note += f" / URL: {form_url}"

            msg.status = "sent" if success else "failed"
            msg.sent_at = datetime.utcnow()
            msg.sent_by = current_user.id

            if success and c and (c.status in early_statuses or c.status is None):
                c.status = "フォーム送信済"

            db.add(AuditLog(
                company_id=msg.company_id,
                send_method="form",
                sent_by_user_id=current_user.id,
                message_id=msg.id,
                ai_prompt_id=msg.ai_prompt_id,
                result="sent" if success else "failed",
                note=note,
            ))

            if success:
                sent_count += 1
            else:
                failed_count += 1
        except Exception as e:
            logger.warning(f"bulk_send_form: error on message {msg.id}: {e}")
            failed_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB更新に失敗しました: {str(e)}")

    return {"sent": sent_count, "failed": failed_count, "skipped": skipped_count, "total": len(msgs)}


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")
    if msg.status == "sent":
        raise HTTPException(status_code=400, detail="送信済みのメッセージは削除できません")
    db.delete(msg)
    db.commit()
    return {"ok": True}


@router.post("/messages/bulk-delete")
def bulk_delete_messages(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """指定した未送信メッセージを一括削除する。"""
    message_ids = data.get("message_ids") or []
    if not message_ids:
        raise HTTPException(status_code=400, detail="message_ids を指定してください")

    msgs = db.query(SalesMessage).filter(
        SalesMessage.id.in_(message_ids),
        SalesMessage.org_id == current_user.org_id,
        SalesMessage.status != "sent",
    ).all()

    deleted = 0
    for msg in msgs:
        db.delete(msg)
        deleted += 1

    db.commit()
    return {"deleted": deleted}


@router.post("/opt-out")
def add_opt_out(
    req: OptOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.email and not req.domain and not req.company_id:
        raise HTTPException(status_code=400, detail="email、domain、company_idのいずれかを指定してください")

    entry = OptOutList(
        email=req.email,
        domain=req.domain,
        company_id=req.company_id,
        reason=req.reason,
        added_by=current_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"ok": True, "id": entry.id}


@router.get("/opt-out")
def list_opt_out(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = db.query(OptOutList).order_by(OptOutList.added_at.desc()).all()
    return {
        "opt_out_list": [
            {
                "id": e.id,
                "email": e.email,
                "domain": e.domain,
                "company_id": e.company_id,
                "reason": e.reason,
                "added_by": e.added_by,
                "added_at": e.added_at.isoformat() if e.added_at else None,
            }
            for e in entries
        ]
    }


@router.get("/stats")
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.org_id

    status_counts = dict(
        db.query(SalesMessage.status, func.count(SalesMessage.id))
        .filter(SalesMessage.org_id == org_id)
        .group_by(SalesMessage.status)
        .all()
    )

    template_counts = dict(
        db.query(SalesMessage.template_type, func.count(SalesMessage.id))
        .filter(SalesMessage.org_id == org_id)
        .group_by(SalesMessage.template_type)
        .all()
    )

    sent_msg_ids = [
        row[0] for row in
        db.query(SalesMessage.id)
        .filter(SalesMessage.org_id == org_id)
        .all()
    ]

    method_counts: dict = {}
    result_counts: dict = {}
    if sent_msg_ids:
        method_rows = (
            db.query(AuditLog.send_method, func.count(AuditLog.id))
            .filter(AuditLog.message_id.in_(sent_msg_ids))
            .group_by(AuditLog.send_method)
            .all()
        )
        method_counts = dict(method_rows)

        result_rows = (
            db.query(AuditLog.result, func.count(AuditLog.id))
            .filter(AuditLog.message_id.in_(sent_msg_ids))
            .group_by(AuditLog.result)
            .all()
        )
        result_counts = dict(result_rows)

    today = datetime.utcnow().date()
    daily: list[dict] = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        cnt = 0
        if sent_msg_ids:
            cnt = (
                db.query(func.count(AuditLog.id))
                .filter(
                    AuditLog.message_id.in_(sent_msg_ids),
                    AuditLog.sent_at >= day_start,
                    AuditLog.sent_at < day_end,
                )
                .scalar() or 0
            )
        daily.append({"date": day.strftime("%m/%d"), "count": cnt})

    opt_out_count = db.query(func.count(OptOutList.id)).scalar() or 0

    return {
        "status_counts": status_counts,
        "template_counts": template_counts,
        "method_counts": method_counts,
        "result_counts": result_counts,
        "daily_sends": daily,
        "opt_out_count": opt_out_count,
        "total_messages": sum(status_counts.values()),
        "total_sent": status_counts.get("sent", 0),
        "total_failed": status_counts.get("failed", 0),
        "total_draft": status_counts.get("draft", 0),
        "total_reviewed": status_counts.get("reviewed", 0),
    }


@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.org_id
    sent_msg_ids = [
        row[0] for row in
        db.query(SalesMessage.id).filter(SalesMessage.org_id == org_id).all()
    ]
    if not sent_msg_ids:
        return {"audit_logs": []}

    rows = (
        db.query(AuditLog, Company.company_name)
        .outerjoin(Company, Company.id == AuditLog.company_id)
        .filter(AuditLog.message_id.in_(sent_msg_ids))
        .order_by(AuditLog.sent_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "audit_logs": [
            {
                "id": log.id,
                "company_name": company_name,
                "company_id": log.company_id,
                "send_method": log.send_method,
                "result": log.result,
                "note": log.note,
                "sent_at": log.sent_at.isoformat() if log.sent_at else None,
                "message_id": log.message_id,
            }
            for log, company_name in rows
        ]
    }


@router.get("/settings/api-key-status")
def check_api_key_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import os
    from server.models import SystemSettings
    env_key = os.environ.get("ANTHROPIC_API_KEY", "")
    sys_row = db.query(SystemSettings).filter(SystemSettings.key == "anthropic_api_key").first()
    has_key = bool(env_key) or bool(sys_row and sys_row.value)
    return {"has_api_key": has_key}


# ─────────────────────────────────────────────
#  Auto-generate settings (semi-automatic scheduler)
# ─────────────────────────────────────────────
AUTO_GEN_KEYS = [
    "auto_generate_enabled",
    "auto_generate_hour",
    "auto_generate_statuses",
    "auto_generate_min_score",
    "auto_generate_max_per_run",
    "auto_generate_template_type",
    "auto_generate_project_id",
    "auto_generate_last_run_at",
    "auto_generate_last_run_count",
]

AUTO_GEN_DEFAULTS = {
    "auto_generate_enabled": "false",
    "auto_generate_hour": "8",
    "auto_generate_statuses": '["未確認","アプローチ前"]',
    "auto_generate_min_score": "0",
    "auto_generate_max_per_run": "10",
    "auto_generate_template_type": "shopify",
    "auto_generate_project_id": "",
    "auto_generate_last_run_at": "",
    "auto_generate_last_run_count": "0",
}


def _get_auto_gen_settings(org_id: int, db: Session) -> dict:
    rows = db.query(AppSetting).filter(
        AppSetting.setting_key.in_(AUTO_GEN_KEYS),
        AppSetting.org_id == org_id,
    ).all()
    result = {**AUTO_GEN_DEFAULTS}
    for row in rows:
        result[row.setting_key] = row.setting_value or AUTO_GEN_DEFAULTS.get(row.setting_key, "")
    return result


def _set_auto_gen_setting(org_id: int, key: str, value: str, db: Session):
    row = db.query(AppSetting).filter(
        AppSetting.setting_key == key,
        AppSetting.org_id == org_id,
    ).first()
    if row:
        row.setting_value = value
    else:
        db.add(AppSetting(org_id=org_id, setting_key=key, setting_value=value))


class AutoGenerateSettingsRequest(BaseModel):
    enabled: bool
    hour: int
    statuses: list
    min_score: int
    max_per_run: int
    template_type: str
    project_id: Optional[int] = None


@router.get("/auto-generate/settings")
def get_auto_generate_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "system_admin") and not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="権限がありません")
    import json
    raw = _get_auto_gen_settings(current_user.org_id, db)
    projects = db.query(Project).filter(Project.org_id == current_user.org_id, Project.is_active == True).all()
    try:
        statuses = json.loads(raw["auto_generate_statuses"])
    except Exception:
        statuses = ["未確認", "アプローチ前"]
    return {
        "enabled": raw["auto_generate_enabled"] == "true",
        "hour": int(raw["auto_generate_hour"]),
        "statuses": statuses,
        "min_score": int(raw["auto_generate_min_score"]),
        "max_per_run": int(raw["auto_generate_max_per_run"]),
        "template_type": raw["auto_generate_template_type"],
        "project_id": int(raw["auto_generate_project_id"]) if raw["auto_generate_project_id"] else None,
        "last_run_at": raw["auto_generate_last_run_at"] or None,
        "last_run_count": int(raw["auto_generate_last_run_count"]),
        "projects": [{"id": p.id, "name": p.name} for p in projects],
    }


@router.put("/auto-generate/settings")
def update_auto_generate_settings(
    req: AutoGenerateSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "system_admin") and not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="権限がありません")
    import json
    if not 0 <= req.hour <= 23:
        raise HTTPException(status_code=400, detail="時刻は0〜23で指定してください")
    if not 1 <= req.max_per_run <= 50:
        raise HTTPException(status_code=400, detail="最大生成件数は1〜50で指定してください")
    _set_auto_gen_setting(current_user.org_id, "auto_generate_enabled", "true" if req.enabled else "false", db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_hour", str(req.hour), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_statuses", json.dumps(req.statuses, ensure_ascii=False), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_min_score", str(req.min_score), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_max_per_run", str(req.max_per_run), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_template_type", req.template_type, db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_project_id", str(req.project_id) if req.project_id else "", db)
    db.commit()
    return {"ok": True}


@router.post("/auto-generate/run-now")
def run_auto_generate_now(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "system_admin") and not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="権限がありません")
    import threading
    from server.services.scheduler import _run_auto_generate_for_org
    threading.Thread(
        target=_run_auto_generate_for_org,
        args=(current_user.org_id,),
        daemon=True,
    ).start()
    return {"ok": True, "message": "バックグラウンドで生成を開始しました"}
