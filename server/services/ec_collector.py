"""
EC Collection Service — ECサイトオーナー向け収集専用サービスモジュール

EC特化型の検索クエリ生成・スコアフィルタリング・プラットフォーム別収集ロジックを提供する。
collector.py / routes/collector.py から呼び出して使用する。
"""
from __future__ import annotations

import re
from typing import Optional

EC_PLATFORM_QUERY_MAP: dict[str, list[str]] = {
    "Shopify": [
        "site:myshopify.com 通販",
        "Shopify 自社EC 通販 運営",
        "Shopify ストア 公式ショップ",
        "Shopify Plus ブランド EC 運営",
    ],
    "BASE": [
        "site:base.shop 通販",
        "BASE ネットショップ 運営 公式",
        "thebase.in 通販 自社",
    ],
    "STORES": [
        "site:stores.jp 通販",
        "STORES ネットショップ 公式 運営",
    ],
    "MakeShop": [
        "inurl:makeshop.jp 通販",
        "MakeShop 通販サイト 運営",
        "MakeShop EC 導入 運営",
    ],
    "futureshop": [
        "inurl:future-shop.jp 通販",
        "futureshop EC 運営",
        "futureshop 通販 自社",
    ],
    "ecbeing": [
        "ecbeing EC 導入 運営",
        "ecbeing 通販サイト 自社",
    ],
    "カラーミー": [
        "inurl:shop-pro.jp 通販",
        "カラーミーショップ 運営 自社EC",
    ],
    "EC-CUBE": [
        "EC-CUBE 自社EC 通販 運営",
        "eccube 通販サイト 自社",
    ],
    "WooCommerce": [
        "WooCommerce 通販サイト 自社 運営",
        "WooCommerce ネットショップ EC 運営",
        "powered by WooCommerce 通販",
    ],
    "aishipR": [
        "aishipR EC 導入 通販",
        "aiship 通販サイト 運営 自社",
    ],
    "ショップサーブ": [
        "ショップサーブ EC 通販 運営",
        "shopserve.jp 通販サイト 自社",
    ],
    "Yahoo!ショッピング": [
        "site:store.shopping.yahoo.co.jp",
        "Yahoo!ショッピング 出店 公式ショップ",
    ],
    "楽天市場": [
        "site:item.rakuten.co.jp 出店",
        "楽天市場 出店 公式ショップ 運営",
    ],
    "BigCommerce": [
        "BigCommerce 通販サイト 自社 EC",
        "bigcommerce.com EC 運営 日本",
    ],
    "Magento": [
        "Magento 通販サイト 自社 EC",
        "Adobe Commerce EC 運営 日本",
    ],
    "TikTokショップ": [
        "TikTok Shop 出店 自社EC",
        "TikTokショップ 通販 ブランド",
        "tiktok.com/shop 出店 販売",
    ],
    "Canaly": [
        "Canaly EC 管理 通販 自社",
        "canaly.jp 利用 EC 運営",
    ],
    "Cross Mall": [
        "クロスモール EC 受注 管理",
        "cross-mall.jp 利用 通販",
    ],
    "Smaregi": [
        "スマレジ EC 連携 通販",
        "Smaregi EC 運営 実店舗",
    ],
}

EC_SCORE_THRESHOLDS = {
    "high": 60,
    "medium": 35,
    "low": 15,
}

PLATFORM_EC_FLAG_MAP: dict[str, str] = {
    "Shopify": "shopify_flag",
    "BASE": "base_flag",
    "MakeShop": "makeshop_flag",
    "futureshop": "futureshop_flag",
    "ecbeing": "ecbeing_flag",
    "STORES": "stores_flag",
    "WooCommerce": "woocommerce_flag",
    "Yahoo!ショッピング": "yahoo_shopping_flag",
    "ロリポップEC": "lolipop_flag",
    "楽天市場": "rakuten_flag",
}

_SOCIAL_COMMERCE_PATTERNS = [
    re.compile(r"shop\.tiktok\.com|tiktok\.com/shop|tiktokshop", re.IGNORECASE),
    re.compile(r"instagram\.com/shop|instagram\.com/shopping|ig\.me/shop", re.IGNORECASE),
    re.compile(r"facebook\.com/marketplace|fb\.com/marketplace", re.IGNORECASE),
    re.compile(r"line\.me/shop|liff\.line\.me.*shop|linestore", re.IGNORECASE),
]

_HEADLESS_SHOPIFY_PATTERNS = [
    re.compile(r"shopify\.com/api/storefront|storefront\.shopify\.com", re.IGNORECASE),
    re.compile(r"hydrogen\.shopify\.dev|shopify-hydrogen", re.IGNORECASE),
    re.compile(r'"@shopify/hydrogen"', re.IGNORECASE),
]

# ── EC代行業者除外 ───────────────────────────────────────────────────────────

AGENCY_NEGATIVE_QUERY = "-EC代行 -EC制作 -Web制作 -ホームページ制作 -運営代行 -制作会社"

_AGENCY_TITLE_KEYWORDS: list[str] = [
    "ec代行", "ec制作", "ecサイト制作", "ec構築", "ecサイト構築",
    "ec運営代行", "ec支援", "ec導入支援", "ecシステム開発",
    "ネットショップ制作", "ネットショップ代行", "通販代行", "通販サイト制作",
    "web制作", "ホームページ制作", "サイト制作", "システム開発",
    "webデザイン", "ウェブ制作", "ウェブデザイン",
    "ecコンサル", "ecコンサルティング", "ec事業支援", "ec導入コンサル",
    "物流代行", "フルフィルメント代行", "受注管理代行",
    "広告代行", "sns運用代行", "リスティング代行",
    "制作実績", "導入実績", "構築実績",
]

_AGENCY_SNIPPET_PATTERNS: list[re.Pattern] = [
    re.compile(r"ec(サイト|ショップ)?を(制作|構築|開設|立ち上げ|運営代行)", re.IGNORECASE),
    re.compile(r"(ネットショップ|通販サイト|ecサイト)(の?)(制作|構築|開業支援|立ち上げ)", re.IGNORECASE),
    re.compile(r"(web|ウェブ|ホームページ)(制作|デザイン|開発)(会社|業者|代行|を)", re.IGNORECASE),
    re.compile(r"ec(運営|構築|制作)(の|を|は)(代行|支援|お手伝い|承り)", re.IGNORECASE),
    re.compile(r"\d+(社|店舗|件)(以上|の)(ec|通販|ネットショップ)(支援|制作|構築|導入)", re.IGNORECASE),
    re.compile(r"お客様のec(を|の|に)(サポート|支援|構築|制作|代わり)", re.IGNORECASE),
    re.compile(r"(shopify|base|ec-cube|woocommerce|カラーミー)(の|を|で)(制作|構築|代行|支援)", re.IGNORECASE),
]


def is_ec_agency(title: str, snippet: str, company_name: str = "") -> tuple[bool, str]:
    """EC代行・制作業者かどうかを判定する。

    収集された検索結果のタイトル・スニペット・会社名を元に
    EC代行・Web制作業者と判断されれば True を返す。

    Returns:
        (is_agency: bool, reason: str)
    """
    text_lower = f"{title} {snippet} {company_name}".lower()

    for kw in _AGENCY_TITLE_KEYWORDS:
        if kw in text_lower:
            return True, f"代行・制作キーワード: 「{kw}」"

    combined = f"{title} {snippet}"
    for pat in _AGENCY_SNIPPET_PATTERNS:
        m = pat.search(combined)
        if m:
            return True, f"代行業者パターン: 「{m.group()}」"

    return False, ""


def generate_ec_platform_queries(
    platform: str,
    keyword: str = "",
    region: str = "",
    limit: int = 3,
) -> list[str]:
    """指定プラットフォームのEC収集用クエリリストを生成する。

    Args:
        platform: 対象プラットフォーム名（PLATFORM_QUERY_MAP キー）
        keyword: 追加キーワード（業種等）
        region: 都道府県等の地域絞り込み
        limit: 最大クエリ数

    Returns:
        検索クエリ文字列のリスト
    """
    base_queries = EC_PLATFORM_QUERY_MAP.get(platform, [
        f"{platform} ECサイト 運営 通販",
        f"{platform} 自社EC 通販 会社",
    ])
    result: list[str] = []
    for q in base_queries[:limit]:
        parts = [q]
        if keyword:
            parts.append(keyword)
        if region:
            parts.append(region)
        result.append(" ".join(parts).strip())
    return result


def filter_by_ec_score(
    companies: list[dict],
    min_score: int = EC_SCORE_THRESHOLDS["medium"],
) -> list[dict]:
    """ECスコアが min_score 以上の企業だけを返す。"""
    return [c for c in companies if (c.get("ec_score") or 0) >= min_score]


def filter_ec_only(companies: list[dict]) -> list[dict]:
    """ec_flag=True の企業だけを返す。"""
    return [c for c in companies if c.get("ec_flag")]


def filter_by_platform(companies: list[dict], platform: str) -> list[dict]:
    """指定プラットフォームで検出された企業を返す。"""
    return [c for c in companies if c.get("cms_type") == platform]


def is_social_commerce(html_source: str) -> bool:
    """TikTok/Instagram/LINE等のソーシャルコマース出店サイトか判定する。"""
    if not html_source:
        return False
    for pat in _SOCIAL_COMMERCE_PATTERNS:
        if pat.search(html_source):
            return True
    return False


def is_headless_shopify(html_source: str) -> bool:
    """Shopify Hydrogen (headless) で構築されたサイトか判定する。"""
    if not html_source:
        return False
    for pat in _HEADLESS_SHOPIFY_PATTERNS:
        if pat.search(html_source):
            return True
    return False


def get_platform_flag_name(platform: str) -> Optional[str]:
    """プラットフォーム名から対応する DB フラグ名を返す。"""
    return PLATFORM_EC_FLAG_MAP.get(platform)


def get_ec_priority_label(score: int, ec_flag: bool, cms_type: str) -> str:
    """ECスコア・フラグ・CMS種別から営業優先度ラベルを返す。

    Returns:
        "highest" | "high" | "medium" | "low"
    """
    if ec_flag and score >= 70 and cms_type in (
        "Shopify", "WooCommerce", "EC-CUBE", "MakeShop", "futureshop",
        "ecbeing", "aishipR", "ショップサーブ", "カラーミー",
    ):
        return "highest"
    if ec_flag and score >= EC_SCORE_THRESHOLDS["high"]:
        return "high"
    if score >= EC_SCORE_THRESHOLDS["medium"]:
        return "medium"
    return "low"


def build_ec_search_operators(
    platform: str,
    industry: str = "",
    region: str = "",
) -> str:
    """Google 検索演算子を含む EC 特化クエリを1本生成する。

    Examples:
        platform="Shopify", industry="アパレル", region="東京"
        → 'site:myshopify.com アパレル 東京 通販'
    """
    PLATFORM_OPERATORS = {
        "Shopify": "site:myshopify.com",
        "BASE": "site:base.shop",
        "STORES": "site:stores.jp",
        "MakeShop": "inurl:makeshop.jp",
        "futureshop": "inurl:future-shop.jp",
        "カラーミー": "inurl:shop-pro.jp",
        "Yahoo!ショッピング": "site:store.shopping.yahoo.co.jp",
        "楽天市場": "site:item.rakuten.co.jp",
    }
    operator = PLATFORM_OPERATORS.get(platform, "")
    parts = [p for p in [operator, industry, region, "通販"] if p]
    return " ".join(parts)


def select_ec_keyword_set(category_id: str) -> list[str]:
    """業種カテゴリIDに対応するEC収集キーワードセットを返す。

    collector.py の EC_DISCOVERY_PRESETS と同等の役割を担うが、
    このモジュール単体でも呼び出せるよう独立して管理する。
    """
    KEYWORD_SETS: dict[str, list[str]] = {
        "apparel": [
            "ファッション 通販 自社EC 運営会社", "アパレル D2C Shopify 運営",
            "メンズファッション 通販 ブランド直販", "レディース 公式オンラインストア",
            "古着 セレクトショップ 自社EC", "スポーツウェア 通販 自社ブランド",
        ],
        "cosme": [
            "コスメ 通販 自社EC D2C", "スキンケア ブランド 公式通販",
            "化粧品 D2C 定期購入 自社", "ヘアケア 通販 自社ブランド",
            "オーガニック コスメ 通販 自社EC", "メンズコスメ 通販 自社",
        ],
        "food": [
            "食品 通販 産直 EC 運営", "お取り寄せ グルメ 通販 自社",
            "定期便 食品 D2C 自社EC", "農家 直販 ネットショップ 運営",
            "スイーツ 通販 公式ショップ 自社", "健康食品 サプリ 通販 ブランド",
        ],
        "shopify": [
            "Shopify 通販 ブランド 自社EC", "site:myshopify.com 通販",
            "Shopify Plus EC 運営 日本", "Shopify 越境EC 自社ブランド",
        ],
        "tiktok_shop": [
            "TikTok Shop 出店 ブランド 自社EC", "TikTokショップ 通販 運営会社",
            "tiktok 販売 自社サイト EC", "SNSコマース 通販 自社ブランド",
        ],
        "d2c": [
            "D2C ブランド 自社通販 EC", "DTC 直販 オンライン 自社",
            "サブスク 定期便 自社EC D2C", "パーソナライズ 通販 D2C ブランド",
        ],
    }
    return KEYWORD_SETS.get(category_id, [f"{category_id} 通販 EC 自社 運営"])
