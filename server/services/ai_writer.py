import os
import uuid
import logging

logger = logging.getLogger(__name__)

TEMPLATE_PROMPTS = {
    "shopify": """\
あなたはBtoB営業の専門家です。以下の企業情報を基に、Shopifyへの移行・ECサイト強化を提案する営業メールの叩き台を作成してください。

企業情報:
{company_info}

要件:
- 件名: 簡潔で関心を引く日本語の件名（30字以内）
- 本文: 300〜500字、丁寧なビジネス敬語
- 企業の現状（CMSタイプ、EC状況）に言及する
- COOLWORKS株式会社のESCMS（16プラットフォーム対応EC管理）の価値を伝える
- Shopifyへの移行メリットを具体的に述べる
- 問い合わせや商談のアクションを促す
- 末尾に「配信停止はこちら: {{opt_out_url}}」を記載する

以下のJSON形式で出力してください（JSON以外のテキストは出力しないでください）:
{{"subject": "件名テキスト", "body": "本文テキスト"}}""",

    "ec_support": """\
あなたはBtoB営業の専門家です。以下の企業情報を基に、EC運営支援・業務改善を提案する営業メールの叩き台を作成してください。

企業情報:
{company_info}

要件:
- 件名: 簡潔で関心を引く日本語の件名（30字以内）
- 本文: 300〜500字、丁寧なビジネス敬語
- 企業のEC活動（EC判定スコア、利用プラットフォーム）に言及する
- COOLWORKS株式会社のEC支援サービスの価値を伝える
- 売上向上・運営効率化の具体的なメリットを述べる
- 問い合わせや商談のアクションを促す
- 末尾に「配信停止はこちら: {{opt_out_url}}」を記載する

以下のJSON形式で出力してください（JSON以外のテキストは出力しないでください）:
{{"subject": "件名テキスト", "body": "本文テキスト"}}""",

    "partner": """\
あなたはBtoB営業の専門家です。以下の企業情報を基に、業務提携・パートナーシップを提案する営業メールの叩き台を作成してください。

企業情報:
{company_info}

要件:
- 件名: 簡潔で関心を引く日本語の件名（30字以内）
- 本文: 300〜500字、丁寧なビジネス敬語
- 企業の専門性（業種、CMS/EC実績）に言及する
- COOLWORKS株式会社との協業による相互メリットを述べる
- Web制作・EC支援分野でのパートナー連携の可能性を提示する
- 問い合わせや情報交換のアクションを促す
- 末尾に「配信停止はこちら: {{opt_out_url}}」を記載する

以下のJSON形式で出力してください（JSON以外のテキストは出力しないでください）:
{{"subject": "件名テキスト", "body": "本文テキスト"}}""",
}

TEMPLATE_LABELS = {
    "shopify": "Shopify提案型",
    "ec_support": "EC支援提案型",
    "partner": "パートナー提案型",
}


def _build_company_info(company: dict) -> str:
    lines = []
    if company.get("company_name"):
        lines.append(f"会社名: {company['company_name']}")
    if company.get("prefecture"):
        city = company.get("city", "")
        lines.append(f"所在地: {company['prefecture']}{city}")
    if company.get("category_main"):
        lines.append(f"業種: {company['category_main']}")
    if company.get("cms_type"):
        lines.append(f"CMSタイプ: {company['cms_type']}")

    ec_score = company.get("ec_score", 0) or 0
    ec_flag = company.get("ec_flag")
    if ec_flag is True:
        lines.append(f"EC判定: EC確定（スコア: {ec_score}）")
    elif ec_score > 0:
        lines.append(f"EC判定: EC可能性あり（スコア: {ec_score}）")

    if company.get("shopify_flag"):
        lines.append("Shopify導入済み: あり")

    sns_count = company.get("sns_count", 0) or 0
    if sns_count > 0:
        lines.append(f"SNS活用数: {sns_count}チャンネル")

    score_total = company.get("score_total", 0) or 0
    score_rank = company.get("score_rank", "D") or "D"
    lines.append(f"営業優先スコア: {score_total}点（ランク{score_rank}）")

    if company.get("email"):
        lines.append(f"メール: {company['email']}")

    return "\n".join(lines)


def generate_from_custom_template(company: dict, template_content: str, template_title: str) -> dict:
    """カスタムMemoTemplateを変数置換して生成（Claude不使用）"""
    import uuid

    name = company.get("company_name") or "貴社"
    prefecture = company.get("prefecture") or ""
    city = company.get("city") or ""
    category = company.get("category_main") or ""
    domain = company.get("domain") or company.get("website_url") or ""
    score = company.get("score_total") or 0
    cms = company.get("cms_type") or ""

    replacements = {
        "{会社名}": name,
        "{担当者名}": "ご担当者",
        "{URL}": domain,
        "{業種}": category,
        "{都道府県}": prefecture,
        "{市区町村}": city,
        "{スコア}": str(score),
        "{CMS}": cms,
        "【会社名】": name,
        "【担当者名】": "ご担当者",
        "【URL】": domain,
        "【業種】": category,
        "【都道府県】": prefecture,
    }

    body = template_content
    for var, val in replacements.items():
        body = body.replace(var, val)

    return {
        "subject": template_title,
        "body": body,
        "ai_prompt_id": f"custom:{uuid.uuid4()}",
        "template_type": "custom",
    }


def _resolve_anthropic_key(provided_key: str = "") -> str:
    """APIキーを解決する。環境変数→DB→エラーの順で試みる。"""
    key = provided_key or os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        try:
            from server.database import SessionLocal
            from server.models import SystemSettings
            db = SessionLocal()
            try:
                row = db.query(SystemSettings).filter(SystemSettings.key == "anthropic_api_key").first()
                if row and row.value:
                    key = row.value
            finally:
                db.close()
        except Exception:
            pass
    return key


def generate_sales_message(company: dict, template_type: str, api_key: str = "") -> dict:
    import anthropic

    if template_type not in TEMPLATE_PROMPTS:
        raise ValueError(f"Unknown template_type: {template_type}")

    prompt_template = TEMPLATE_PROMPTS[template_type]
    company_info = _build_company_info(company)
    prompt = prompt_template.format(company_info=company_info)

    ai_prompt_id = str(uuid.uuid4())

    api_key = _resolve_anthropic_key(api_key)

    if not api_key:
        raise RuntimeError("Anthropic APIキーが設定されていません。システム管理画面でAPIキーを登録してください。")

    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text.strip()

        import json
        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                raise ValueError(f"Claude APIのレスポンスをJSONとして解析できませんでした: {raw_text[:200]}")

        return {
            "subject": result.get("subject", ""),
            "body": result.get("body", ""),
            "ai_prompt_id": ai_prompt_id,
            "template_type": template_type,
        }
    except anthropic.APIConnectionError as e:
        raise RuntimeError(f"Anthropic API接続エラー: {e}")
    except anthropic.AuthenticationError:
        raise RuntimeError("Anthropic APIキーが無効です。設定を確認してください。")
    except anthropic.RateLimitError:
        raise RuntimeError("Anthropic APIのレート制限に達しました。しばらく待ってから再試行してください。")
    except Exception as e:
        logger.error(f"ai_writer generate error: {e}")
        raise
