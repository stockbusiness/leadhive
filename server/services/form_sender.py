"""
フォーム自動送信サービス

コンタクトページのHTMLフォームを解析し、AIでフィールドマッピングを行い、
HTTP POSTで自動送信する。

静的HTTPでフォームが見つからない場合は Playwright（ヘッドレスChromium）で
JavaScriptを実行してからHTMLを取得するフォールバックを備える。
"""
import asyncio
import json
import logging
import re
import shutil
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
_FETCH_TIMEOUT = 8
_SUBMIT_TIMEOUT = 20
_PLAYWRIGHT_TIMEOUT = 30000  # ms


# ── Playwright ヘッドレスブラウザ フォールバック ──────────────────────────

def _get_chromium_path() -> Optional[str]:
    """Nix でインストールされた Chromium の実行ファイルパスを返す。"""
    return shutil.which("chromium") or shutil.which("chromium-browser")


async def _fetch_html_playwright_async(url: str) -> tuple[str, str]:
    """Playwright でページを開き、JS実行後の HTML と最終URLを返す。"""
    from playwright.async_api import async_playwright

    chromium_path = _get_chromium_path()
    launch_args = [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--disable-blink-features=AutomationControlled",
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=chromium_path,
            args=launch_args,
            headless=True,
        )
        ctx = await browser.new_context(
            user_agent=_HEADERS["User-Agent"],
            locale="ja-JP",
        )
        page = await ctx.new_page()
        try:
            resp = await page.goto(url, timeout=_PLAYWRIGHT_TIMEOUT, wait_until="networkidle")
            # フォームが出るまで最大5秒待機
            try:
                await page.wait_for_selector("form", timeout=5000)
            except Exception:
                pass
            html = await page.content()
            final_url = page.url
        finally:
            await browser.close()

    return html, final_url


def _fetch_with_playwright(url: str) -> tuple[str, str]:
    """同期ラッパー: スレッド内から Playwright を呼び出す。"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(_fetch_html_playwright_async(url))
        finally:
            loop.close()
    except Exception as e:
        raise RuntimeError(f"Playwright取得失敗: {e}") from e


# ── Playwright 完全送信（入力 → 確認ページ突破 → 完了確認） ───────────────

_SUBMIT_SELECTORS = [
    'input[type="submit"]',
    'button[type="submit"]',
    'button:has-text("送信する")',
    'button:has-text("送信")',
    'button:has-text("確認する")',
    'button:has-text("確認")',
    'button:has-text("次へ")',
    'button:has-text("Next")',
    'button:has-text("Submit")',
    'button:has-text("Send")',
    'input[value="送信"]',
    'input[value="送信する"]',
    'input[value="確認"]',
    'input[value="確認する"]',
]

_CONFIRM_SELECTORS = [
    'button:has-text("送信する")',
    'button:has-text("送信")',
    'input[value="送信"]',
    'input[value="送信する"]',
    'input[type="submit"]',
    'button[type="submit"]',
]

_SUCCESS_KWS = [
    "ありがとう", "送信しました", "受け付けました", "完了",
    "thank you", "success", "submitted", "received", "confirmation",
    "送信完了", "受付完了", "お問い合わせありがとう",
]
_ERROR_KWS = ["エラー", "error", "required", "invalid", "入力エラー",
               "必須項目が入力されていません", "必須フィールド", "validation error"]


async def _submit_form_playwright_full_async(
    url: str,
    form: dict,
    mapped_values: dict,
) -> dict:
    """
    Playwright でフォームページを開き、フィールド入力 → 送信 → 確認ページ突破 → 結果確認を行う。

    Args:
        url: フォームページURL（連絡先ページ）
        form: _extract_forms() が返したフォーム情報（fields / action / method）
        mapped_values: {field_name -> value} のマッピング

    Returns:
        {"success": bool, "message": str, "fields_mapped": int}
    """
    import random as _random
    from playwright.async_api import async_playwright, TimeoutError as PWTimeout

    chromium_path = _get_chromium_path()
    if not chromium_path:
        return {"success": False, "message": "Chromiumが見つかりません", "fields_mapped": 0}

    fields_filled = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=chromium_path,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
                "--disable-blink-features=AutomationControlled",
            ],
            headless=True,
        )
        ctx = await browser.new_context(
            user_agent=_HEADERS["User-Agent"],
            viewport={"width": 1366, "height": 768},
            locale="ja-JP",
            timezone_id="Asia/Tokyo",
            extra_http_headers={"Accept-Language": "ja,en-US;q=0.9,en;q=0.8"},
        )
        # webdriver 検出を無効化
        await ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
        )
        page = await ctx.new_page()

        try:
            await page.goto(url, timeout=_PLAYWRIGHT_TIMEOUT, wait_until="networkidle")
            try:
                await page.wait_for_selector("form", timeout=8000)
            except PWTimeout:
                pass

            # ページ読み込み後の人間らしい待機
            await asyncio.sleep(_random.uniform(0.6, 1.5))

            # ── フィールド入力 ──────────────────────────────────────────
            for field in form.get("fields", []):
                name = field.get("name", "")
                ftype = field.get("type", "text")
                value = mapped_values.get(name, "")

                if ftype == "hidden" or not name:
                    continue

                try:
                    if ftype == "select":
                        if value:
                            loc = page.locator(f'select[name="{name}"]').first
                            if await loc.count() > 0:
                                try:
                                    await loc.select_option(value=value, timeout=3000)
                                    fields_filled += 1
                                except Exception:
                                    try:
                                        await loc.select_option(label=value, timeout=2000)
                                        fields_filled += 1
                                    except Exception:
                                        pass

                    elif ftype == "radio":
                        if value:
                            loc = page.locator(
                                f'input[type=radio][name="{name}"][value="{value}"]'
                            )
                            if await loc.count() > 0:
                                await loc.click(timeout=3000)
                                fields_filled += 1

                    elif ftype == "checkbox":
                        if value:
                            loc = page.locator(
                                f'input[type=checkbox][name="{name}"]'
                            ).first
                            if await loc.count() > 0 and not await loc.is_checked():
                                await loc.check(timeout=3000)
                                fields_filled += 1

                    else:
                        if value:
                            loc = page.locator(f'[name="{name}"]').first
                            if await loc.count() > 0:
                                await loc.scroll_into_view_if_needed(timeout=3000)
                                await loc.click(timeout=3000)
                                await asyncio.sleep(_random.uniform(0.05, 0.15))
                                await loc.fill(value, timeout=3000)
                                fields_filled += 1

                    await asyncio.sleep(_random.uniform(0.1, 0.4))
                except Exception as ex:
                    logger.debug(f"フィールド入力スキップ [{name}]: {ex}")

            # 送信前の人間らしい待機
            await asyncio.sleep(_random.uniform(0.8, 2.0))

            # ── 送信ボタンをクリック ────────────────────────────────────
            submitted = False
            for sel in _SUBMIT_SELECTORS:
                loc = page.locator(sel).first
                try:
                    if await loc.count() > 0 and await loc.is_visible():
                        await loc.scroll_into_view_if_needed(timeout=3000)
                        await loc.click(timeout=5000)
                        submitted = True
                        break
                except Exception:
                    continue

            if not submitted:
                return {
                    "success": False,
                    "message": "送信ボタンが見つかりませんでした（Playwright）",
                    "fields_mapped": fields_filled,
                }

            # 送信後の遷移待機
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except PWTimeout:
                await asyncio.sleep(3)

            # ── 確認ページ検出・突破（入力→確認→送信の2ステップフォーム対応）──
            page_text = (await page.text_content("body") or "").lower()
            has_confirm_page = any(k in page_text for k in ("確認", "confirm", "内容を確認"))
            has_success_already = any(k in page_text for k in _SUCCESS_KWS)

            if has_confirm_page and not has_success_already:
                await asyncio.sleep(_random.uniform(0.5, 1.2))
                for sel in _CONFIRM_SELECTORS:
                    loc = page.locator(sel).first
                    try:
                        if await loc.count() > 0 and await loc.is_visible():
                            await loc.scroll_into_view_if_needed(timeout=3000)
                            await loc.click(timeout=5000)
                            try:
                                await page.wait_for_load_state("networkidle", timeout=12000)
                            except PWTimeout:
                                await asyncio.sleep(3)
                            break
                    except Exception:
                        continue

            # ── 最終ページのテキストで成功/失敗を判定 ──────────────────
            try:
                final_text = (await page.text_content("body") or "").lower()
            except Exception:
                final_text = ""

            has_success = any(k in final_text for k in _SUCCESS_KWS)
            has_error = any(k in final_text for k in _ERROR_KWS)

            if has_error and not has_success:
                return {
                    "success": False,
                    "message": "フォームの入力エラー（Playwright送信・必須項目不足の可能性）",
                    "fields_mapped": fields_filled,
                }

            return {
                "success": True,
                "message": f"Playwrightでフォーム送信完了（{fields_filled}項目入力）",
                "fields_mapped": fields_filled,
            }

        except PWTimeout:
            return {
                "success": False,
                "message": "Playwright送信タイムアウト",
                "fields_mapped": fields_filled,
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Playwright送信エラー: {e}",
                "fields_mapped": fields_filled,
            }
        finally:
            await browser.close()


def _submit_form_playwright_full(url: str, form: dict, mapped_values: dict) -> dict:
    """同期ラッパー: スレッド内から Playwright 完全送信を呼び出す。"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(
                _submit_form_playwright_full_async(url, form, mapped_values)
            )
        finally:
            loop.close()
    except Exception as e:
        return {"success": False, "message": f"Playwright送信エラー: {e}", "fields_mapped": 0}


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


def _get_label_text(tag, form_soup) -> str:
    """フィールドのラベルテキストを複数の方法で取得する。"""
    # 1. <label for="id">
    tag_id = tag.get("id", "")
    if tag_id:
        label_tag = form_soup.find("label", {"for": tag_id})
        if label_tag:
            return label_tag.get_text(strip=True)

    # 2. aria-label / title / placeholder
    for attr in ("aria-label", "title", "placeholder"):
        val = tag.get(attr, "")
        if val:
            return val

    # 3. 直近の <label> 祖先または兄弟
    parent = tag.parent
    for _ in range(4):
        if parent is None:
            break
        label = parent.find("label")
        if label:
            return label.get_text(strip=True)
        # <th> や <dt> が隣にある場合
        prev = parent.find_previous_sibling(["th", "dt", "td"])
        if prev:
            txt = prev.get_text(strip=True)
            if txt:
                return txt
        parent = parent.parent

    # 4. name属性をそのまま返す
    return tag.get("name", "")


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

        # ラジオボタンはグループで処理
        radio_groups: dict[str, list] = {}
        for tag in form.find_all("input", type="radio"):
            name = tag.get("name", "")
            if not name:
                continue
            radio_groups.setdefault(name, []).append({
                "value": tag.get("value", ""),
                "label": _get_label_text(tag, form),
            })

        for tag in form.find_all(["input", "textarea", "select"]):
            name = tag.get("name") or tag.get("id") or ""
            if not name:
                continue

            ftype = tag.get("type", "text").lower() if tag.name == "input" else tag.name
            if ftype in ("submit", "button", "image", "reset", "file"):
                continue

            if ftype == "hidden":
                if name not in seen_names:
                    seen_names.add(name)
                    fields.append({
                        "name": name,
                        "type": "hidden",
                        "value": tag.get("value", ""),
                        "label": "",
                    })
                continue

            if ftype == "radio":
                if name not in seen_names:
                    seen_names.add(name)
                    options = [r["value"] for r in radio_groups.get(name, [])]
                    combined_label = " ".join(r["label"] for r in radio_groups.get(name, []) if r["label"])
                    fields.append({
                        "name": name,
                        "type": "radio",
                        "label": combined_label or _get_label_text(tag, form),
                        "options": options,
                        "value": "",
                    })
                continue

            if name in seen_names:
                continue
            seen_names.add(name)

            label_text = _get_label_text(tag, form)

            if tag.name == "select":
                options = []
                for o in tag.find_all("option"):
                    v = o.get("value", "")
                    t = o.get_text(strip=True)
                    options.append(v if v else t)
                fields.append({
                    "name": name,
                    "type": "select",
                    "label": label_text,
                    "options": options[:30],
                    "value": "",
                })
            else:
                fields.append({
                    "name": name,
                    "type": ftype,
                    "label": label_text,
                    "value": tag.get("value", ""),
                    "required": tag.has_attr("required"),
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
            n = (f["name"] + " " + f.get("label", "")).lower()
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
各フィールドに入力すべき値をJSON形式で返してください。

送信者情報:
- 送信者氏名: {sender_name}
- 送信者メールアドレス: {sender_email}
- 送信者会社名: {sender_company}
- 送信者電話番号: {sender_phone}
- 送信者役職: {sender_title}
- 送信者部署名: {sender_department}
- 送信者郵便番号: {sender_postal_code}
- 送信者都道府県: {sender_prefecture}
- 送信者住所: {sender_address}
- 送信者WebサイトURL: {sender_website_url}
- 件名: {subject}
- 本文: {message_body}

フォームフィールド一覧:
{fields_json}

ルール:
- hidden フィールドは元の value をそのまま使う
- type="select" のフィールドは options の中から最も適切なものを選んでください（お問い合わせ種別は「その他」「一般」「ご相談」等を選ぶ）
- type="radio" のフィールドは options の中から最も適切なものを選んでください（法人/個人の場合は法人を、お問い合わせ種別はその他を）
- type="checkbox" で名前/ラベルに「同意」「プライバシー」「個人情報」「利用規約」「agree」「privacy」「terms」が含まれる場合は "1" を返す（必須同意フィールド）
- type="checkbox" でそれ以外は "" を返す
- 入力不要なフィールド（CAPTCHA、画像等）は "" を返す
- 全フィールドのnameをキーとしたJSONのみ返してください（他のテキスト不要）
"""


def _map_fields_rule_based(
    form: dict,
    sender_name: str,
    sender_email: str,
    sender_company: str,
    sender_phone: str,
    sender_title: str,
    company_name: str,
    message_body: str,
    sender_department: str = "",
    sender_website_url: str = "",
    sender_postal_code: str = "",
    sender_prefecture: str = "",
    sender_address: str = "",
    subject: str = "",
) -> dict[str, str]:
    """ルールベースでフォームフィールドをマッピングする（OpenAI不要）。"""
    result = {}

    _NAME_KWS = ("name", "氏名", "お名前", "名前", "担当者", "your_name", "fullname", "full_name", "username", "yourname")
    _LAST_NAME_KWS = ("last", "family", "sei", "姓", "苗字", "lastname", "surname")
    _FIRST_NAME_KWS = ("first", "given", "mei", "名", "firstname", "givenname")
    _EMAIL_KWS = ("email", "mail", "メール", "e-mail", "メールアドレス")
    _COMPANY_KWS = ("company", "corporation", "会社", "企業", "法人", "御社", "貴社", "companyname", "corp", "organization", "organisation")
    _PHONE_KWS = ("phone", "tel", "電話", "携帯", "fax", "mobile", "contact_number")
    _TITLE_KWS = ("title", "役職", "position", "post")
    _DEPT_KWS = ("department", "dept", "部署", "部門", "section")
    _SUBJECT_KWS = ("subject", "件名", "題名", "お問い合わせ件名", "inquiry_subject", "inquirysubject")
    _MESSAGE_KWS = ("message", "content", "body", "お問い合わせ", "内容", "メッセージ", "details", "description",
                    "inquiry", "comment", "text", "textarea", "お問合", "問合せ内容", "ご相談", "ご質問", "question")
    _POSTAL_KWS = ("postal", "zip", "郵便", "〒", "postcode", "zipcode")
    _PREF_KWS = ("prefecture", "都道府県", "pref", "state", "province")
    _ADDR_KWS = ("address", "住所", "addr")
    _URL_KWS = ("url", "website", "site", "homepage", "hp", "web")
    _AGREE_KWS = ("同意", "agree", "privacy", "プライバシー", "個人情報", "利用規約", "terms", "policy", "consent", "acceptance")
    _CORPORATE_KWS = ("法人", "corporate", "company", "企業", "business")

    # 姓名分割用
    name_parts = sender_name.split() if sender_name else ["", ""]
    last_name = name_parts[0] if name_parts else ""
    first_name = name_parts[1] if len(name_parts) > 1 else ""

    # 電話番号分割用（日本形式: xxx-xxxx-xxxx または xx-xxxx-xxxx）
    phone_clean = re.sub(r"[^\d]", "", sender_phone or "")
    phone_parts = (sender_phone or "").split("-") if "-" in (sender_phone or "") else []

    def _match(key_label: str, keywords: tuple) -> bool:
        t = key_label.lower().replace("-", "").replace("_", "").replace(" ", "")
        return any(k.replace("-", "").replace("_", "").replace(" ", "") in t for k in keywords)

    used_message = False
    used_subject = False
    # 電話番号パーツ追跡
    tel_part_index = 0

    # フィールド名でtel番号付きを検出（tel1, tel2, tel3 など）
    tel_numbered = {}
    for field in form["fields"]:
        n = field.get("name", "").lower()
        m = re.search(r"tel[_\-]?(\d)$|phone[_\-]?(\d)$|電話(\d)$", n)
        if m:
            idx = int(m.group(1) or m.group(2) or m.group(3)) - 1
            tel_numbered[field["name"]] = idx

    for field in form["fields"]:
        name = field.get("name", "")
        label = field.get("label", "")
        ftype = field.get("type", "text")
        combined = (name + " " + label).strip()

        if ftype == "hidden":
            result[name] = field.get("value", "")
            continue

        # ── チェックボックス ──
        if ftype == "checkbox":
            if _match(combined, _AGREE_KWS):
                # 同意系チェックボックスは自動チェック
                val = field.get("value", "") or "1"
                result[name] = val
            else:
                result[name] = ""
            continue

        # ── ラジオボタン ──
        if ftype == "radio":
            options = field.get("options", [])
            chosen = ""
            # 法人/個人 → 法人を選ぶ
            for opt in options:
                if any(k in str(opt).lower() for k in _CORPORATE_KWS):
                    chosen = str(opt)
                    break
            # お問い合わせ種別 → その他/一般/ご相談
            if not chosen:
                preferred = ["その他", "一般", "ご相談", "相談", "問い合わせ", "inquiry", "other", "general"]
                for pref in preferred:
                    for opt in options:
                        if pref in str(opt).lower():
                            chosen = str(opt)
                            break
                    if chosen:
                        break
            # それでもなければ最後の選択肢（最初はプレースホルダーが多い）
            if not chosen and options:
                non_empty = [o for o in options if o]
                chosen = non_empty[-1] if non_empty else options[0]
            result[name] = chosen
            continue

        # ── セレクトボックス ──
        if ftype == "select":
            options = field.get("options", [])
            preferred_inquiry = ["その他", "一般", "ご相談", "相談", "問い合わせ", "inquiry", "other", "general"]
            chosen = ""
            # 法人/個人セレクト
            if _match(combined, ("法人", "corporate", "種別", "type", "category", "業種")):
                for opt in options:
                    if any(k in str(opt).lower() for k in _CORPORATE_KWS):
                        chosen = str(opt)
                        break
            if not chosen:
                for pref in preferred_inquiry:
                    for opt in options:
                        if pref in str(opt).lower():
                            chosen = str(opt)
                            break
                    if chosen:
                        break
            if not chosen and options:
                non_empty = [o for o in options if o and o != "0"]
                chosen = non_empty[-1] if non_empty else (options[0] if options else "")
            result[name] = chosen
            continue

        # ── テキスト系フィールド ──
        val = ""

        # 電話番号の分割フィールド対応（tel1/tel2/tel3）
        if name in tel_numbered:
            idx = tel_numbered[name]
            if phone_parts and idx < len(phone_parts):
                val = phone_parts[idx]
            elif phone_clean:
                # ハイフンなし → 均等分割
                chunk = len(phone_clean) // 3 or 1
                parts = [phone_clean[:chunk], phone_clean[chunk:chunk*2], phone_clean[chunk*2:]]
                val = parts[idx] if idx < len(parts) else ""
            result[name] = val
            continue

        # 姓名分割対応
        if _match(combined, _LAST_NAME_KWS) and not _match(combined, _FIRST_NAME_KWS):
            val = last_name or sender_name
        elif _match(combined, _FIRST_NAME_KWS) and not _match(combined, _LAST_NAME_KWS):
            val = first_name or sender_name
        elif not used_message and (ftype == "textarea" or _match(combined, _MESSAGE_KWS)):
            val = message_body or ""
            used_message = True
        elif not used_subject and _match(combined, _SUBJECT_KWS):
            val = subject or (message_body[:30] if message_body else "")
            used_subject = True
        elif _match(combined, _EMAIL_KWS):
            val = sender_email or ""
        elif _match(combined, _COMPANY_KWS):
            val = sender_company or ""
        elif _match(combined, _PHONE_KWS):
            val = sender_phone or ""
        elif _match(combined, _DEPT_KWS):
            val = sender_department or ""
        elif _match(combined, _TITLE_KWS):
            val = sender_title or ""
        elif _match(combined, _NAME_KWS):
            val = sender_name or ""
        elif _match(combined, _POSTAL_KWS):
            val = sender_postal_code or ""
        elif _match(combined, _PREF_KWS):
            val = sender_prefecture or ""
        elif _match(combined, _ADDR_KWS):
            val = sender_address or ""
        elif _match(combined, _URL_KWS):
            val = sender_website_url or ""
        elif ftype == "number":
            # 従業員数などの数値フィールド → 空のまま or 1
            val = ""

        result[name] = val

    # message/subjectが未割り当てなら最初の空textarea/textに入れる
    if not used_message:
        for field in form["fields"]:
            if field.get("type") in ("textarea", "text") and field.get("name") in result and not result[field["name"]]:
                result[field["name"]] = message_body or ""
                break

    return result


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
    sender_postal_code: str = "",
    sender_prefecture: str = "",
    sender_address: str = "",
    subject: str = "",
) -> dict[str, str]:
    """フォームフィールドをマッピングする。OpenAIキーがあればAI、なければルールベース。"""
    rule_result = _map_fields_rule_based(
        form=form,
        sender_name=sender_name,
        sender_email=sender_email,
        sender_company=sender_company,
        sender_phone=sender_phone,
        sender_title=sender_title,
        company_name=company_name,
        message_body=message_body,
        sender_department=sender_department,
        sender_website_url=sender_website_url,
        sender_postal_code=sender_postal_code,
        sender_prefecture=sender_prefecture,
        sender_address=sender_address,
        subject=subject,
    )

    if not openai_key:
        return rule_result

    # OpenAI APIでAIマッピングを試みる（ルールベースのフォールバックあり）
    try:
        import openai
        client = openai.OpenAI(api_key=openai_key)

        fields_for_prompt = []
        for f in form["fields"]:
            if f["type"] == "hidden":
                continue
            entry = {"name": f["name"], "type": f["type"], "label": f.get("label", "")}
            if f["type"] in ("select", "radio"):
                entry["options"] = f.get("options", [])
            fields_for_prompt.append(entry)

        prompt = _MAPPING_PROMPT.format(
            sender_name=sender_name,
            sender_email=sender_email,
            sender_company=sender_company,
            sender_phone=sender_phone,
            sender_title=sender_title,
            sender_department=sender_department,
            sender_postal_code=sender_postal_code,
            sender_prefecture=sender_prefecture,
            sender_address=sender_address,
            sender_website_url=sender_website_url,
            subject=subject,
            message_body=message_body[:500],
            fields_json=json.dumps(fields_for_prompt, ensure_ascii=False, indent=2),
        )

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        ai_mapped = json.loads(resp.choices[0].message.content or "{}")

        # AI結果とルール結果をマージ（hidden はルール結果を優先）
        merged = dict(rule_result)
        for k, v in ai_mapped.items():
            if k in merged and rule_result.get(k) and not merged.get(k):
                continue
            merged[k] = str(v) if v is not None else ""
        # hidden フィールドは常にルール結果
        for f in form["fields"]:
            if f["type"] == "hidden":
                merged[f["name"]] = rule_result.get(f["name"], f.get("value", ""))

        return merged

    except Exception as e:
        logger.warning(f"AIマッピング失敗、ルールベースにフォールバック: {e}")
        return rule_result


def _is_spa_page(html: str) -> bool:
    """JavaScriptのみで動作するSPAページかどうかを判定する。"""
    soup = BeautifulSoup(html, "html.parser")
    # フォームが既に存在する場合は SPA ではない
    if soup.find("form"):
        return False
    # SPA特有のルート要素を検出
    spa_roots = [
        {"id": "root"}, {"id": "app"}, {"id": "__next"},
        {"id": "gatsby-focus-wrapper"}, {"data-reactroot": True},
        {"id": "nuxt"}, {"id": "__nuxt"},
    ]
    for attrs in spa_roots:
        if soup.find(True, attrs=attrs):
            return True
    # 本文テキストがほぼない（JSで描画されるシェルページ）
    text = soup.get_text(strip=True)
    if len(text) < 200:
        return True
    return False


_CONTACT_DIRECT_PATHS = [
    "/contact", "/inquiry", "/form", "/contact-us", "/contact_us",
    "/contacts", "/お問い合わせ", "/otoiawase", "/toiawase",
    "/contact.html", "/inquiry.html", "/form.html",
    "/contact.php", "/inquiry.php", "/form.php",
    "/pages/contact", "/support/contact", "/help/contact",
    # 追加パス（T001-7 JS-rendered form improvement）
    "/support", "/help", "/faq/contact", "/feedback",
    "/about/contact", "/get-in-touch", "/reach-us", "/connect",
    "/contactus", "/contactus.html", "/contactus.php",
    "/toiawase.html", "/otoiawase.html", "/toiawase.php",
    "/request", "/request.html", "/request.php",
    "/inquiry/form", "/contact/form", "/form/contact",
]

# React/Vue/Angular/Next.js の特徴的なシグナル（JS-heavy SPA 判定）
_JS_FRAMEWORK_PATTERNS = [
    re.compile(r'<div\s+id=["\'](?:__next|app|root|vue-app|ng-app)["\']', re.I),
    re.compile(r'"react":\s*"[\d.]+"|react\.development\.js|react\.production\.min\.js', re.I),
    re.compile(r'vue(?:\.min)?\.js|vue\.runtime|VUE_APP_', re.I),
    re.compile(r'angular(?:\.min)?\.js|ng-version=|ng-controller', re.I),
    re.compile(r'_nuxt/|__nuxt|nuxt\.js', re.I),
    re.compile(r'gatsby-chunk|GatsbyConfig', re.I),
]


def _is_js_heavy(html: str) -> bool:
    """SPA/JS-heavy なページか推定する（Playwright フォールバックの判断用）。"""
    if len(BeautifulSoup(html, "html.parser").get_text(strip=True)) < 300:
        return True
    for pat in _JS_FRAMEWORK_PATTERNS:
        if pat.search(html):
            return True
    return False

_FORM_SERVICE_PATTERNS_FS = [
    re.compile(r"formrun\.com", re.I),
    re.compile(r"typeform\.com", re.I),
    re.compile(r"forms\.google\.com|docs\.google\.com/forms", re.I),
    re.compile(r"hubspot\.com.*form|hs-scripts\.com", re.I),
    re.compile(r"form\.run", re.I),
    re.compile(r"tayori\.com", re.I),
    re.compile(r"kintoneapp\.com", re.I),
    re.compile(r"coform\.jp", re.I),
    re.compile(r"form\.page", re.I),
]


def _verify_has_form(html: str) -> bool:
    """HTMLにお問い合わせフォームが存在するか確認する。"""
    soup = BeautifulSoup(html, "html.parser")
    for form in soup.find_all("form"):
        if form.find("textarea") or form.find("input", {"type": re.compile(r"^(text|email)$", re.I)}):
            return True
    for iframe in soup.find_all("iframe"):
        src = iframe.get("src", "")
        for pat in _FORM_SERVICE_PATTERNS_FS:
            if pat.search(src):
                return True
    for script in soup.find_all("script"):
        src = script.get("src", "") or ""
        for pat in _FORM_SERVICE_PATTERNS_FS:
            if pat.search(src):
                return True
    return False


def _find_contact_url(website_url: str, contact_url: str, session: requests.Session) -> Optional[str]:
    """
    コンタクトページURLを決定する。
    1. contact_urlが設定済みならそれを返す
    2. よく使われるパス（/contact等）を直接探索
    3. トップページのリンクからスコアリングで選択
    4. フォーム存在確認（<form> or フォームサービスiframe）
    """
    if contact_url:
        return contact_url
    if not website_url:
        return None

    try:
        html, final_url = _fetch_html(website_url, session)
    except Exception as e:
        logger.warning(f"トップページ取得失敗: {e}")
        return None

    base = urllib.parse.urlparse(final_url)
    base_origin = f"{base.scheme}://{base.netloc}"

    # ── ① 直接パス探索（よくある /contact 等） ──────────────────────────────
    for path in _CONTACT_DIRECT_PATHS:
        try:
            candidate = base_origin + path
            resp = session.get(candidate, timeout=5, allow_redirects=True)
            if resp.status_code == 200 and _verify_has_form(resp.text):
                logger.info(f"直接パスでフォームURL検出: {candidate}")
                return candidate
        except Exception:
            continue

    # ── ② トップページリンクのスコアリング探索 ──────────────────────────────
    soup = BeautifulSoup(html, "html.parser")
    candidates: list[tuple[int, str]] = []

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True).lower()
        href_lower = href.lower()
        abs_href = urllib.parse.urljoin(final_url, href)
        if not abs_href.startswith("http"):
            continue
        if urllib.parse.urlparse(abs_href).netloc != base.netloc:
            continue

        score = 0
        # href パスによるスコア
        if any(k in href_lower for k in ("/contact", "/inquiry", "/form", "/ask")):
            score += 8
        elif any(k in href_lower for k in ("contact", "inquiry", "form")):
            score += 4
        if any(k in href_lower for k in ("お問い合わせ", "otoiawase", "toiawase", "問合")):
            score += 8
        # リンクテキストによるスコア
        if any(k in text for k in ("お問い合わせ", "問い合わせ", "ご相談", "問合せ")):
            score += 6
        if any(k in text for k in ("contact", "inquiry", "form", "ask")):
            score += 4
        # フォームサービス直リンク
        for pat in _FORM_SERVICE_PATTERNS_FS:
            if pat.search(href):
                score += 12
                break
        if score > 0:
            if "?" not in href:
                score += 2
            candidates.append((score, abs_href))

    # スコア降順で検証
    seen: set[str] = set()
    for score, url in sorted(candidates, key=lambda x: -x[0]):
        if url in seen:
            continue
        seen.add(url)
        try:
            resp = session.get(url, timeout=5, allow_redirects=True)
            if resp.status_code == 200:
                if _verify_has_form(resp.text):
                    logger.info(f"リンクスコアリングでフォームURL検出: {url} (score={score})")
                    return url
        except Exception:
            continue

    # フォーム確認できなくても最高スコア候補を返す
    if candidates:
        best = sorted(candidates, key=lambda x: -x[0])[0][1]
        logger.info(f"フォーム未確認だが最高スコア候補を返す: {best}")
        return best

    logger.warning(f"コンタクトページ未検出: {website_url}")
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
    sender_postal_code: str = "",
    sender_prefecture: str = "",
    sender_address: str = "",
    subject: str = "",
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
    use_playwright_submit = False  # JS フォームは Playwright で送信まで行うフラグ

    # フォームが見つからない場合 → Playwright でJS実行して再取得
    if not forms or _is_spa_page(html):
        chromium_path = _get_chromium_path()
        if chromium_path:
            try:
                logger.info(f"Playwright フォールバック: {resolved_url}")
                pw_html, pw_final_url = _fetch_with_playwright(resolved_url)
                pw_forms = _extract_forms(pw_html, pw_final_url)
                if pw_forms:
                    html = pw_html
                    final_url = pw_final_url
                    forms = pw_forms
                    use_playwright_submit = True  # 送信もPlaywrightで行う
                    logger.info(f"Playwright でフォーム {len(pw_forms)}件 発見: {resolved_url}")
                else:
                    logger.info(f"Playwright でもフォーム未発見: {resolved_url}")
            except Exception as e:
                logger.warning(f"Playwright フォールバック失敗: {e}")
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
            sender_postal_code=sender_postal_code,
            sender_prefecture=sender_prefecture,
            sender_address=sender_address,
            subject=subject,
        )
    except Exception as e:
        return {
            "success": False,
            "message": f"AIフィールドマッピングに失敗しました: {e}",
            "form_url": resolved_url,
            "fields_mapped": 0,
        }

    # JS必須フォームは Playwright で実際にブラウザ操作して送信する
    # （Cookie/CSRF/JSバリデーション/確認ページを正しく処理できる）
    if use_playwright_submit:
        logger.info(f"Playwright完全送信モード: {resolved_url}")
        result = _submit_form_playwright_full(resolved_url, form, mapped)
        return {**result, "form_url": resolved_url}

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
            "エラー", "error", "required", "invalid",
        ]
        # 「必須」「入力してください」はフォームのラベルにも含まれるため
        # エラーキーワードとして判定する場合は文脈を絞る
        strict_error_keywords = [
            "必須項目が入力されていません", "必須フィールド", "入力エラー",
            "validation error", "required field",
        ]
        has_success = any(k in response_text for k in success_keywords)
        has_error = (
            any(k in response_text for k in error_keywords) or
            any(k in response_text for k in strict_error_keywords)
        )

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
