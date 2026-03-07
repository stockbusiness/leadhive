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


def get_openai_key(db, org_id: int) -> str:
    from server.models import AppSetting
    setting = db.query(AppSetting).filter(
        AppSetting.setting_key == "openai_api_key",
        AppSetting.org_id == org_id,
    ).first()
    return setting.setting_value if setting and setting.setting_value else ""
