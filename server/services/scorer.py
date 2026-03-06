def calculate_score(company_data: dict) -> tuple[int, str]:
    score = 0

    if company_data.get("shopify_flag"):
        score += 20
    if company_data.get("production_flag"):
        score += 15
    if company_data.get("consulting_flag"):
        score += 15
    if company_data.get("operation_flag"):
        score += 15
    if company_data.get("contact_url"):
        score += 10
    if company_data.get("phone"):
        score += 5
    if company_data.get("prefecture") or company_data.get("city"):
        score += 5
    if company_data.get("amazon_flag") and company_data.get("rakuten_flag"):
        score += 10

    info_count = sum([
        bool(company_data.get("company_name")),
        bool(company_data.get("phone")),
        bool(company_data.get("email")),
        bool(company_data.get("prefecture")),
    ])
    if info_count < 2:
        score -= 10

    if not company_data.get("contact_url"):
        score -= 15

    ec_related = any([
        company_data.get("shopify_flag"),
        company_data.get("ec_flag"),
        company_data.get("amazon_flag"),
        company_data.get("rakuten_flag"),
        company_data.get("consulting_flag"),
        company_data.get("operation_flag"),
        company_data.get("production_flag"),
    ])
    if not ec_related:
        score -= 20

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
