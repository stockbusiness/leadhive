import re

CATEGORY_KEYWORDS = {
    "Shopify支援": ["shopify", "ショッピファイ"],
    "EC制作": ["ec制作", "ecサイト制作", "ecサイト構築", "ネットショップ制作", "ネットショップ構築"],
    "ECコンサル": ["ecコンサル", "ec支援", "eコマースコンサル"],
    "EC運営代行": ["ec運営代行", "ec運用代行", "ネットショップ運営代行"],
    "EC広告代理店": ["ec広告", "ec集客", "ecマーケティング"],
    "Amazon支援": ["amazon", "アマゾン"],
    "楽天支援": ["楽天", "rakuten"],
    "Web制作": ["web制作", "ウェブ制作", "ホームページ制作", "webサイト制作"],
}


def categorize_company(text: str, custom_keywords: dict = None) -> tuple[str, str]:
    text_lower = text.lower()
    matched_categories = []

    source = custom_keywords if custom_keywords else CATEGORY_KEYWORDS
    for category, keywords in source.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                matched_categories.append(category)
                break

    if not matched_categories:
        return "その他", ""

    main = matched_categories[0]
    sub = matched_categories[1] if len(matched_categories) > 1 else ""
    return main, sub


DEFAULT_FLAG_KEYWORDS = {
    "shopify_flag": ["shopify", "ショッピファイ"],
    "ec_flag": ["ec", "eコマース", "ネットショップ", "通販"],
    "amazon_flag": ["amazon", "アマゾン"],
    "rakuten_flag": ["楽天", "rakuten"],
    "consulting_flag": ["コンサル", "支援", "戦略"],
    "operation_flag": ["運営代行", "運用代行"],
    "production_flag": ["制作", "構築", "開発"],
}


def detect_flags(text: str, custom_flags: dict = None) -> dict:
    text_lower = text.lower()
    source = custom_flags if custom_flags else DEFAULT_FLAG_KEYWORDS
    result = {}
    for flag_name, keywords in source.items():
        result[flag_name] = any(kw.lower() in text_lower for kw in keywords)
    for default_flag in DEFAULT_FLAG_KEYWORDS:
        if default_flag not in result:
            result[default_flag] = any(kw.lower() in text_lower for kw in DEFAULT_FLAG_KEYWORDS[default_flag])
    return result
