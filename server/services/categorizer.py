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


def categorize_company(text: str) -> tuple[str, str]:
    text_lower = text.lower()
    matched_categories = []

    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                matched_categories.append(category)
                break

    if not matched_categories:
        return "その他", ""

    main = matched_categories[0]
    sub = matched_categories[1] if len(matched_categories) > 1 else ""
    return main, sub


def detect_flags(text: str) -> dict:
    text_lower = text.lower()
    return {
        "shopify_flag": any(kw in text_lower for kw in ["shopify", "ショッピファイ"]),
        "ec_flag": any(kw in text_lower for kw in ["ec", "eコマース", "ネットショップ", "通販"]),
        "amazon_flag": any(kw in text_lower for kw in ["amazon", "アマゾン"]),
        "rakuten_flag": any(kw in text_lower for kw in ["楽天", "rakuten"]),
        "consulting_flag": any(kw in text_lower for kw in ["コンサル", "支援", "戦略"]),
        "operation_flag": any(kw in text_lower for kw in ["運営代行", "運用代行"]),
        "production_flag": any(kw in text_lower for kw in ["制作", "構築", "開発"]),
    }
