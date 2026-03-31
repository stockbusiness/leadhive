DEFAULT_SCORING_RULES = {
    "ec_flag": 25,
    "escms_target_flag": 20,
    "shopify_flag": 20,
    "production_flag": 15,
    "consulting_flag": 15,
    "operation_flag": 15,
    "contact_url": 15,
    "multi_platform": 10,
    "sns_count_3": 10,
    "has_recruitment": 5,
    "sns_count_1": 5,
    "phone": 5,
    "location": 5,
    "info_missing_penalty": -10,
    "no_contact_penalty": -15,
    "not_ec_related_penalty": -20,
}


def calculate_score(company_data: dict, custom_rules: dict = None, db=None) -> tuple[int, str]:
    if custom_rules is not None:
        rules = custom_rules
    elif db is not None:
        rules = get_rules_from_db(db)
    else:
        rules = DEFAULT_SCORING_RULES
    score = 0

    if company_data.get("ec_flag") and "ec_flag" in rules:
        score += rules["ec_flag"]

    for flag in ["shopify_flag", "production_flag", "consulting_flag", "operation_flag"]:
        if company_data.get(flag) and flag in rules:
            score += rules[flag]

    if company_data.get("escms_target_flag") and "escms_target_flag" in rules:
        score += rules["escms_target_flag"]

    if company_data.get("contact_url") and "contact_url" in rules:
        score += rules["contact_url"]
    if company_data.get("phone") and "phone" in rules:
        score += rules["phone"]
    if (company_data.get("prefecture") or company_data.get("city")) and "location" in rules:
        score += rules["location"]
    if company_data.get("amazon_flag") and company_data.get("rakuten_flag") and "multi_platform" in rules:
        score += rules["multi_platform"]

    if company_data.get("has_recruitment") and "has_recruitment" in rules:
        score += rules["has_recruitment"]

    sns_count = company_data.get("sns_count", 0) or 0
    if sns_count == 0:
        sns = company_data.get("sns_links") or {}
        if isinstance(sns, dict):
            sns_count = sum(1 for v in sns.values() if v)

    if sns_count >= 3 and "sns_count_3" in rules:
        score += rules["sns_count_3"]
    elif sns_count >= 1 and "sns_count_1" in rules:
        score += rules["sns_count_1"]

    if "sns_active" in rules and sns_count >= 1:
        score += rules["sns_active"]

    info_count = sum([
        bool(company_data.get("company_name")),
        bool(company_data.get("phone")),
        bool(company_data.get("email")),
        bool(company_data.get("prefecture")),
    ])
    if info_count < 2 and "info_missing_penalty" in rules:
        score += rules["info_missing_penalty"]

    if not company_data.get("contact_url") and "no_contact_penalty" in rules:
        score += rules["no_contact_penalty"]

    ec_related = any([
        company_data.get("shopify_flag"),
        company_data.get("ec_flag"),
        company_data.get("amazon_flag"),
        company_data.get("rakuten_flag"),
        company_data.get("consulting_flag"),
        company_data.get("operation_flag"),
        company_data.get("production_flag"),
    ])
    if not ec_related and "not_ec_related_penalty" in rules:
        score += rules["not_ec_related_penalty"]

    for key, points in rules.items():
        if key not in DEFAULT_SCORING_RULES and company_data.get(key):
            score += points

    adjustment = company_data.get("score_adjustment", 0) or 0
    score += adjustment

    score = max(0, min(100, score))

    if score >= 80:
        rank = "A"
    elif score >= 60:
        rank = "B"
    elif score >= 40:
        rank = "C"
    else:
        rank = "D"

    return score, rank


def calculate_digital_maturity(company_data: dict) -> int:
    """
    デジタル成熟度スコア（0-100）を計算する。
    lumiqbarin 連携用: ECスコア・CMS・SNS・連絡先・採用情報を統合した指標。

    内訳:
      Webサイト存在        : +20 pts
      CMS検出              : +15 pts
      ECスコア換算         : 最大+25 pts（ec_score * 0.25）
      SNS数換算            : 最大+20 pts（SNS1件=5pts、上限4件）
      連絡先存在           : +10 pts（電話・メール・問合ページいずれか）
      採用情報             : +10 pts
    """
    score = 0

    if company_data.get("website_url"):
        score += 20

    if company_data.get("cms_type"):
        score += 15

    ec_score = company_data.get("ec_score", 0) or 0
    score += int(ec_score * 0.25)

    sns_count = company_data.get("sns_count", 0) or 0
    score += min(sns_count, 4) * 5

    has_contact = any([
        company_data.get("phone"),
        company_data.get("email"),
        company_data.get("contact_url"),
    ])
    if has_contact:
        score += 10

    if company_data.get("has_recruitment"):
        score += 10

    return max(0, min(100, score))


def get_rules_from_db(db) -> dict:
    """Load scoring rules from SystemSettings DB, falling back to defaults."""
    import json
    try:
        from server.models import SystemSettings
        row = db.query(SystemSettings).filter(SystemSettings.key == "scoring_rules").first()
        if row and row.value:
            return json.loads(row.value)
    except Exception:
        pass
    return dict(DEFAULT_SCORING_RULES)
