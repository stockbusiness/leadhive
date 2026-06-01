"""
フォーム自動送信サービス

コンタクトページのHTMLフォームを解析し、AIでフィールドマッピングを行い、
HTTP POSTで自動送信する。
"""
import json
import logging
import re
import time
import urllib.parse
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
}
_FETCH_TIMEOUT = 15
_SUBMIT_TIMEOUT = 20


def _fetch_html(url: str, session: requests.Session) -> tuple[str, str]:
    """URLのHTMLを取得し (html, final_url) を返す。"""
    resp = session.get(url, headers=_HEADERS, timeout=_FETCH_TIMEOUT, allow_redirects=True)
    resp.raise_for_status()
    encoding = resp.encoding or "utf-8"
    try:
        html = resp.content.decode(encoding, errors="replace")
    except Exception:
        html = resp.text
    return html, resp.url


def _extract_forms(html: str, base_url: str) -> list[dict]:
    """HTMLから全フォームを抽出し、フィールドリストとaction URLを返す。"""
    soup = BeautifulSoup(html, "html.parser")
    forms = []
    for form in soup.find_all("form"):
        action = form.get("action", "")
        method = (form.get("method", "post") or "post").lower()
        if action:
            action = urllib.parse.urljoin(base_url, action)
        else:
            action = base_url

        fields = []
        seen_names = set()
        for tag in form.find_all(["input", "textarea", "select"]):
            name = tag.get("name") or tag.get("id") or ""
            if not name or name in seen_names:
                continue
            seen_names.add(name)

            ftype = tag.get("type", "text").lower() if tag.name == "input" else tag.name
            if ftype in ("submit", "button", "image", "reset", "file"):
                continue
            if ftype == "hidden":
                fields.append({
                    "name": name,
                    "type": "hidden",
                    "value": tag.get("value", ""),
                    "label": "",
                })
                continue

            label_text = ""
            label_tag = form.find("label", {"for": tag.get("id", "")})
            if label_tag:
                label_text = label_tag.get_text(strip=True)
            if not label_text:
                placeholder = tag.get("placeholder", "")
                label_text = placeholder

            if tag.name == "select":
                options = [o.get("value", o.get_text(strip=True)) for o in tag.find_all("option")]
                fields.append({
                    "name": name,
                    "type": "select",
                    "label": label_text,
                    "options": options[:20],
                    "value": "",
                })
            else:
                fields.append({
                    "name": name,
                    "type": ftype,
                    "label": label_text,
                    "value": tag.get("value", ""),
                })

        if fields:
            forms.append({
                "action": action,
                "method": method,
                "fields": fields,
            })
    return forms


def _choose_best_form(forms: list[dict]) -> Optional[dict]:
    """お問い合わせフォームらしいフォームを選択する。"""
    if not forms:
        return None
    if len(forms) == 1:
        return forms[0]

    def _score(form: dict) -> int:
        score = 0
        for f in form["fields"]:
            n = (f["name"] + f.get("label", "")).lower()
            if any(k in n for k in ("message", "content", "body", "お問い合わせ", "内容", "メッセージ")):
                score += 10
            if any(k in n for k in ("name", "氏名", "お名前", "名前")):
                score += 5
            if any(k in n for k in ("email", "mail", "メール")):
                score += 5
            if any(k in n for k in ("company", "会社", "企業", "法人")):
                score += 3
        return score

    return max(forms, key=_score)


_MAPPING_PROMPT = """あなたはWebフォームの入力アシスタントです。
以下の企業へ送るお問い合わせフォームのフィールド一覧と、送信内容を渡します。
各フィールドに最適な値を決定し、JSON形式で返してください。

## フィールド一覧（JSON配列）:
{fields_json}

## 送信者情報:
- 送信者名: {sender_name}
- 送信者メールアドレス: {sender_email}
- 送信者会社名: {sender_company}
- 送信者電話番号: {sender_phone}
- 送信者役職: {sender_title}
- 送信者部署名: {sender_department}
- 送信者会社URL: {sender_website_url}
- 送信者都道府県: {sender_prefecture}
- 送信者住所: {sender_address}

## 宛先企業名: {company_name}

## 送信するメッセージ本文:
{message_body}

## 指示:
- type="hidden" のフィールドは元のvalueをそのまま返してください
- type="select" のフィールドは options の中から最も適切なものを選んでください（お問い合わせ種別は「その他」「一般」「ご相談」等を選ぶ）
- メッセージ/お問い合わせ内容フィールドには message_body をそのまま入れてください
- 該当しないフィールドは空文字""にしてください
- チェックボックス系は "1" または "" で返してください
- 返答は必ずJSON: {{"フィールドname": "値", ...}} の形式のみ

JSON:"""


def map_fields_with_ai(
    form: dict,
    sender_name: str,
    sender_email: str,
    sender_company: str,
    sender_phone: str,
    sender_title: str,
    company_name: str,
    message_body: str,
    openai_key: str,
    sender_department: str = "",
    sender_website_url: str = "",
    sender_prefecture: str = "",
    sender_address: str = "",
) -> dict[str, str]:
    """GPT-4o-miniでフォームフィールドと送信データをマッピングする。"""
    if not openai_key:
        raise ValueError("OpenAI APIキーが設定されていません")

    non_hidden = [f for f in form["fields"] if f["type"] != "hidden"]
    hidden = {f["name"]: f.get("value", "") for f in form["fields"] if f["type"] == "hidden"}

    prompt = _MAPPING_PROMPT.format(
        fields_json=json.dumps(non_hidden, ensure_ascii=False, indent=2),
        sender_name=sender_name or "",
        sender_email=sender_email or "",
        sender_company=sender_company or "",
        sender_phone=sender_phone or "",
        sender_title=sender_title or "",
        sender_department=sender_department or "",
        sender_website_url=sender_website_url or "",
        sender_prefecture=sender_prefecture or "",
        sender_address=sender_address or "",
        company_name=company_name or "",
        message_body=message_body or "",
    )

    from openai import OpenAI
    client = OpenAI(api_key=openai_key)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1000,
        response_format={"type": "json_object"},
    )
    mapped = json.loads(resp.choices[0].message.content)

    result = {}
    result.update(hidden)
    result.update({k: str(v) for k, v in mapped.items()})
    return result


def _find_contact_url(website_url: str, contact_url: str, session: requests.Session) -> Optional[str]:
    """コンタクトページURLを決定する。contact_urlがあればそれを使い、なければトップからリンクを探す。"""
    if contact_url:
        return contact_url
    if not website_url:
        return None

    try:
        html, final_url = _fetch_html(website_url, session)
        soup = BeautifulSoup(html, "html.parser")
        candidates = []
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            text = a.get_text(strip=True).lower()
            abs_href = urllib.parse.urljoin(final_url, href)
            if not abs_href.startswith("http"):
                continue
            score = 0
            if any(k in href.lower() for k in ("contact", "inquiry", "form", "ask", "お問い合わせ", "問合")):
                score += 5
            if any(k in text for k in ("お問い合わせ", "contact", "inquiry", "問い合わせ", "問合")):
                score += 3
            if score > 0:
                candidates.append((score, abs_href))
        if candidates:
            return max(candidates, key=lambda x: x[0])[1]
    except Exception as e:
        logger.warning(f"コンタクトページ探索失敗: {e}")
    return None


def send_form_auto(
    company_name: str,
    website_url: str,
    contact_url: str,
    message_body: str,
    sender_name: str,
    sender_email: str,
    sender_company: str,
    sender_phone: str,
    sender_title: str,
    openai_key: str,
    sender_department: str = "",
    sender_website_url: str = "",
    sender_prefecture: str = "",
    sender_address: str = "",
) -> dict:
    """
    フォーム自動送信のメインエントリポイント。

    Returns:
        {
            "success": bool,
            "message": str,
            "form_url": str,
            "fields_mapped": int,
        }
    """
    session = requests.Session()
    session.headers.update(_HEADERS)

    resolved_url = _find_contact_url(website_url, contact_url, session)
    if not resolved_url:
        return {
            "success": False,
            "message": "お問い合わせフォームのURLが見つかりませんでした",
            "form_url": "",
            "fields_mapped": 0,
        }

    try:
        html, final_url = _fetch_html(resolved_url, session)
    except Exception as e:
        return {
            "success": False,
            "message": f"フォームページの取得に失敗しました: {e}",
            "form_url": resolved_url,
            "fields_mapped": 0,
        }

    forms = _extract_forms(html, final_url)
    if not forms:
        return {
            "success": False,
            "message": "フォームが見つかりませんでした（JavaScript必須または非対応ページ）",
            "form_url": resolved_url,
            "fields_mapped": 0,
        }

    form = _choose_best_form(forms)

    try:
        mapped = map_fields_with_ai(
            form=form,
            sender_name=sender_name,
            sender_email=sender_email,
            sender_company=sender_company,
            sender_phone=sender_phone,
            sender_title=sender_title,
            company_name=company_name,
            message_body=message_body,
            openai_key=openai_key,
            sender_department=sender_department,
            sender_website_url=sender_website_url,
            sender_prefecture=sender_prefecture,
            sender_address=sender_address,
        )
    except Exception as e:
        return {
            "success": False,
            "message": f"AIフィールドマッピングに失敗しました: {e}",
            "form_url": resolved_url,
            "fields_mapped": 0,
        }

    fields_mapped = sum(1 for v in mapped.values() if v)

    referer_headers = {**_HEADERS, "Referer": final_url}
    try:
        if form["method"] == "get":
            submit_resp = session.get(
                form["action"],
                params=mapped,
                headers=referer_headers,
                timeout=_SUBMIT_TIMEOUT,
                allow_redirects=True,
            )
        else:
            content_type = "application/x-www-form-urlencoded"
            submit_resp = session.post(
                form["action"],
                data=mapped,
                headers={**referer_headers, "Content-Type": content_type},
                timeout=_SUBMIT_TIMEOUT,
                allow_redirects=True,
            )

        status = submit_resp.status_code
        if status >= 400:
            return {
                "success": False,
                "message": f"フォーム送信でHTTPエラー {status} が返されました",
                "form_url": resolved_url,
                "fields_mapped": fields_mapped,
            }

        response_text = submit_resp.text.lower()
        success_keywords = [
            "ありがとう", "送信しました", "受け付けました", "完了",
            "thank you", "success", "submitted", "received", "confirmation",
            "送信完了", "お問い合わせありがとう", "受付完了",
        ]
        error_keywords = [
            "エラー", "必須", "入力してください", "error", "required", "invalid",
        ]
        has_success = any(k in response_text for k in success_keywords)
        has_error = any(k in response_text for k in error_keywords)

        if has_error and not has_success:
            return {
                "success": False,
                "message": "フォームの入力エラーが発生しました（必須項目不足の可能性）",
                "form_url": resolved_url,
                "fields_mapped": fields_mapped,
            }

        return {
            "success": True,
            "message": f"フォーム送信完了（{fields_mapped}項目入力、ステータス{status}）",
            "form_url": resolved_url,
            "fields_mapped": fields_mapped,
        }

    except requests.exceptions.Timeout:
        return {
            "success": False,
            "message": "フォーム送信がタイムアウトしました（サーバーが応答しない）",
            "form_url": resolved_url,
            "fields_mapped": fields_mapped,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"フォーム送信中にエラーが発生しました: {e}",
            "form_url": resolved_url,
            "fields_mapped": fields_mapped,
        }
