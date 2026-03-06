DEFAULT_SCORING_RULES = {
    "shopify_flag": 20,
    "production_flag": 15,
    "consulting_flag": 15,
    "operation_flag": 15,
    "contact_url": 10,
    "phone": 5,
    "location": 5,
    "multi_platform": 10,
    "info_missing_penalty": -10,
    "no_contact_penalty": -15,
    "not_ec_related_penalty": -20,
}


def calculate_score(company_data: dict, custom_rules: dict = None) -> tuple[int, str]:
    rules = custom_rules if custom_rules else DEFAULT_SCORING_RULES
    score = 0

    for flag in ["shopify_flag", "production_flag", "consulting_flag", "operation_flag"]:
        if company_data.get(flag) and flag in rules:
            score += rules[flag]

    if company_data.get("contact_url") and "contact_url" in rules:
        score += rules["contact_url"]
    if company_data.get("phone") and "phone" in rules:
        score += rules["phone"]
    if (company_data.get("prefecture") or company_data.get("city")) and "location" in rules:
        score += rules["location"]
    if company_data.get("amazon_flag") and company_data.get("rakuten_flag") and "multi_platform" in rules:
        score += rules["multi_platform"]

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
