import imaplib
import email
import email.header
import logging
import threading
import time
from datetime import datetime, timezone
from email.utils import parseaddr, parsedate_to_datetime

logger = logging.getLogger(__name__)

_poller_thread: threading.Thread | None = None
_stop_event = threading.Event()


def _decode_header(val: str) -> str:
    if not val:
        return ""
    parts = email.header.decode_header(val)
    decoded = []
    for b, enc in parts:
        if isinstance(b, bytes):
            decoded.append(b.decode(enc or "utf-8", errors="replace"))
        else:
            decoded.append(b)
    return " ".join(decoded).strip()


def _get_text_body(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            disp = str(part.get("Content-Disposition") or "")
            if ct == "text/plain" and "attachment" not in disp:
                charset = part.get_content_charset() or "utf-8"
                return part.get_payload(decode=True).decode(charset, errors="replace")
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                charset = part.get_content_charset() or "utf-8"
                raw = part.get_payload(decode=True).decode(charset, errors="replace")
                import re
                return re.sub(r"<[^>]+>", "", raw).strip()
    else:
        charset = msg.get_content_charset() or "utf-8"
        return msg.get_payload(decode=True).decode(charset, errors="replace")
    return ""


def poll_imap_for_org(db, org_id: int):
    from server.models import ImapSetting, LpInquiry
    from server.services.encryption import decrypt_value

    row = db.query(ImapSetting).filter(
        ImapSetting.org_id == org_id,
        ImapSetting.enabled == True,
    ).first()
    if not row or not row.host or not row.username or not row.password_enc:
        return

    password = decrypt_value(row.password_enc)
    try:
        if row.secure:
            conn = imaplib.IMAP4_SSL(row.host, row.port)
        else:
            conn = imaplib.IMAP4(row.host, row.port)
        conn.login(row.username, password)
        conn.select(row.folder)

        status, data = conn.search(None, "UNSEEN")
        if status != "OK":
            conn.logout()
            return

        uid_list = data[0].split()
        new_count = 0
        for uid in uid_list:
            try:
                status2, msg_data = conn.fetch(uid, "(RFC822)")
                if status2 != "OK" or not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                subject = _decode_header(msg.get("Subject", "（件名なし）"))
                from_raw = msg.get("From", "")
                from_name, from_email = parseaddr(from_raw)
                from_name = _decode_header(from_name)
                body_text = _get_text_body(msg)

                composed_message = f"【件名】{subject}\n\n{body_text.strip()}"

                inq = LpInquiry(
                    org_id=org_id,
                    type="email_inbound",
                    contact_name=from_name or None,
                    email=from_email or None,
                    message=composed_message,
                    source_label="imap",
                    status="new",
                )
                db.add(inq)
                conn.store(uid, "+FLAGS", "\\Seen")
                new_count += 1
            except Exception as e:
                logger.warning("IMAP fetch error for uid %s org %s: %s", uid, org_id, e)

        if new_count:
            db.commit()
            logger.info("IMAP: org %s: %d new emails imported", org_id, new_count)

        row.last_polled_at = datetime.utcnow()
        db.commit()
        conn.logout()

    except imaplib.IMAP4.error as e:
        logger.warning("IMAP auth/connect error org %s: %s", org_id, e)
    except Exception as e:
        logger.warning("IMAP poll error org %s: %s", org_id, e)
    finally:
        try:
            db.rollback()
        except Exception:
            pass


def _poll_loop():
    from server.database import SessionLocal
    from server.models import ImapSetting

    _stop_event.wait(timeout=30)
    if _stop_event.is_set():
        return

    while not _stop_event.is_set():
        try:
            db = SessionLocal()
            try:
                rows = db.query(ImapSetting).filter(ImapSetting.enabled == True).all()
                org_ids = [r.org_id for r in rows]
            finally:
                db.close()

            for org_id in org_ids:
                if _stop_event.is_set():
                    break
                try:
                    db2 = SessionLocal()
                    poll_imap_for_org(db2, org_id)
                except Exception as e:
                    logger.error("IMAP poll error org %s: %s", org_id, e)
                finally:
                    try:
                        db2.close()
                    except Exception:
                        pass
        except Exception as e:
            logger.error("IMAP poll loop error: %s", e)

        _stop_event.wait(timeout=300)


def start_imap_polling():
    global _poller_thread
    if _poller_thread and _poller_thread.is_alive():
        return
    _stop_event.clear()
    _poller_thread = threading.Thread(target=_poll_loop, daemon=True, name="imap-poller")
    _poller_thread.start()
    logger.info("IMAP polling service started")


def stop_imap_polling():
    _stop_event.set()
    if _poller_thread:
        _poller_thread.join(timeout=5)
    logger.info("IMAP polling service stopped")
