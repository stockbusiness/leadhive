import logging
from datetime import datetime

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """以下の企業のウェブサイト情報を分析して、営業チーム向けのサマリーをJSON形式で生成してください。

企業名: {company_name}
URL: {url}
ウェブサイト本文:
{full_text}

以下のJSON形式で回答してください（各フィールドは2〜3文で簡潔に）:
{{
  "事業内容": "主な事業・サービスの説明",
  "顧客層": "想定顧客・ターゲット市場",
  "強み": "競合との差別化ポイント・強み",
  "サービス": "具体的なサービス・製品ラインナップ",
  "価格帯": "料金体系・価格帯（不明な場合は「要問合せ」）"
}}

情報が不足している場合は「情報なし」と記載してください。JSON以外は出力しないでください。"""


def analyze_company(company_name: str, url: str, full_text: str, api_key: str) -> dict:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        text_excerpt = full_text[:6000] if full_text else "（本文取得不可）"

        prompt = ANALYSIS_PROMPT.format(
            company_name=company_name or "不明",
            url=url or "",
            full_text=text_excerpt,
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
            response_format={"type": "json_object"},
        )

        import json
        content = response.choices[0].message.content
        result = json.loads(content)
        result["generated_at"] = datetime.utcnow().isoformat()
        return {"success": True, "summary": result}

    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return {"success": False, "error": str(e)}


EMAIL_PROMPT = """あなたはBtoB営業のプロフェッショナルです。以下の企業情報をもとに、初回アプローチ用のメールを作成してください。

企業名: {company_name}
カテゴリ: {category}
ウェブサイト: {url}
{summary_section}
トーン: {tone}
{custom_note_section}

以下のJSON形式で出力してください:
{{
  "subject": "件名（簡潔に30文字以内）",
  "body": "本文（200〜350文字。相手への価値提供を中心に、過度な売り込みは避けてください。改行は\\nで表現。）"
}}

JSON以外は出力しないでください。"""


def generate_outreach_email(
    company_name: str,
    url: str,
    category: str,
    ai_summary: dict | None,
    tone: str,
    custom_note: str,
    api_key: str,
) -> dict:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        if ai_summary:
            summary_lines = []
            for key in ["事業内容", "顧客層", "強み", "サービス", "価格帯"]:
                val = ai_summary.get(key)
                if val and val not in ("情報なし", ""):
                    summary_lines.append(f"{key}: {val}")
            summary_section = "企業サマリー:\n" + "\n".join(summary_lines) if summary_lines else ""
        else:
            summary_section = ""

        custom_note_section = f"追加指示: {custom_note}" if custom_note and custom_note.strip() else ""
        tone_label = "フォーマル（丁寧・ビジネスライク）" if tone == "formal" else "カジュアル（親しみやすく・読みやすく）"

        prompt = EMAIL_PROMPT.format(
            company_name=company_name or "御社",
            url=url or "",
            category=category or "不明",
            summary_section=summary_section,
            tone=tone_label,
            custom_note_section=custom_note_section,
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=600,
            response_format={"type": "json_object"},
        )

        import json
        content = response.choices[0].message.content
        result = json.loads(content)
        result["generated_at"] = datetime.utcnow().isoformat()
        return {"success": True, "email": result}

    except Exception as e:
        logger.error(f"Email generation error: {e}")
        return {"success": False, "error": str(e)}


def get_openai_key(db, org_id: int) -> str:
    from server.models import AppSetting
    setting = db.query(AppSetting).filter(
        AppSetting.setting_key == "openai_api_key",
        AppSetting.org_id == org_id,
    ).first()
    return setting.setting_value if setting and setting.setting_value else ""
