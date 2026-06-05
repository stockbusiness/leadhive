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

AGENCY_NEGATIVE_QUERY = (
    "-EC代行 -EC制作 -Web制作 -ホームページ制作 -運営代行 -制作会社"
    " -ECサイト制作 -ネットショップ制作 -ECコンサル -システム開発"
)

# ① タイトル・スニペットのキーワードマッチ（高スコア）
_AGENCY_TITLE_KEYWORDS: list[tuple[str, int]] = [
    # EC/ショップ制作・構築系
    ("ec代行", 60), ("ec制作", 60), ("ecサイト制作", 60), ("ec構築", 55),
    ("ecサイト構築", 60), ("ec運営代行", 70), ("ec支援", 45), ("ec導入支援", 55),
    ("ecシステム開発", 60), ("ecコンサル", 50), ("ecコンサルティング", 55),
    ("ec事業支援", 50), ("ec導入コンサル", 55),
    ("ネットショップ制作", 60), ("ネットショップ代行", 65), ("ネットショップ構築", 60),
    ("通販代行", 65), ("通販サイト制作", 60), ("通販サイト構築", 60),
    # Web制作系
    ("web制作", 50), ("ホームページ制作", 50), ("サイト制作", 45),
    ("webデザイン", 45), ("ウェブ制作", 50), ("ウェブデザイン", 45),
    ("webシステム開発", 50), ("システム開発会社", 50),
    # 代行・物流系
    ("物流代行", 55), ("フルフィルメント代行", 60), ("受注管理代行", 60),
    ("広告代行", 45), ("sns運用代行", 50), ("リスティング代行", 50),
    # 実績系（代行業者の典型表現）
    ("制作実績", 40), ("導入実績", 40), ("構築実績", 40), ("支援実績", 40),
    ("累計.*社", 35),
]

# ② スニペットの文脈パターンマッチ（高スコア）
_AGENCY_SNIPPET_PATTERNS: list[tuple[re.Pattern, int]] = [
    (re.compile(r"ec(サイト|ショップ)?を(制作|構築|開設|立ち上げ|運営代行)", re.IGNORECASE), 65),
    (re.compile(r"(ネットショップ|通販サイト|ecサイト)(の?)(制作|構築|開業支援|立ち上げ)", re.IGNORECASE), 65),
    (re.compile(r"(web|ウェブ|ホームページ)(制作|デザイン|開発)(会社|業者|代行|を)", re.IGNORECASE), 55),
    (re.compile(r"ec(運営|構築|制作)(の|を|は)(代行|支援|お手伝い|承り)", re.IGNORECASE), 70),
    (re.compile(r"\d+(社|店舗|件)(以上|の)(ec|通販|ネットショップ)(支援|制作|構築|導入)", re.IGNORECASE), 70),
    (re.compile(r"お客様の(ec|ショップ|通販)(を|の|に)(サポート|支援|構築|制作|代わり)", re.IGNORECASE), 65),
    (re.compile(r"(shopify|base|ec-cube|woocommerce|カラーミー|makeshop)(の|を|で)(制作|構築|代行|支援)", re.IGNORECASE), 65),
    (re.compile(r"(無料相談|お見積もり|お問い合わせ).{0,20}(ec|ショップ|通販|ネットショップ)", re.IGNORECASE), 45),
    (re.compile(r"(ec|ネットショップ|通販)(開業|スタート|立ち上げ)を(サポート|支援|お手伝い)", re.IGNORECASE), 60),
    (re.compile(r"月額.{0,10}(円|万).*?(ec|ショップ|通販)(運営|管理|支援)", re.IGNORECASE), 55),
]

# ③ ドメイン名のパターン（B: 中スコア）
_AGENCY_DOMAIN_PATTERNS: list[tuple[re.Pattern, int]] = [
    (re.compile(r"(web|ウェブ)[-_]?(design|designer|制作|creative|agency|studio)", re.IGNORECASE), 30),
    (re.compile(r"(ec|ecommerce|shop)[-_]?(agency|agent|support|consulting|solution|pro)", re.IGNORECASE), 35),
    (re.compile(r"(creative|クリエイティブ)[-_]?(studio|lab|works|inc|co)", re.IGNORECASE), 25),
    (re.compile(r"(digital|デジタル)[-_]?(marketing|agency|solution|works)", re.IGNORECASE), 25),
    (re.compile(r"(solution|ソリューション)(s)?[-_.]*(co\.jp|inc|llc|jp|com)?$", re.IGNORECASE), 25),
    (re.compile(r"\.(agency|studio|works|design|creative)$", re.IGNORECASE), 30),
    (re.compile(r"(consulting|consult|コンサル)(s|ing)?[-._](co\.jp|jp|com|net)?", re.IGNORECASE), 30),
    (re.compile(r"(system|systems|システム)(s)?[-._](co\.jp|jp|com|net)?", re.IGNORECASE), 20),
]

# ④ URLパスのパターン（C: 低〜中スコア）
_AGENCY_PATH_PATTERNS: list[tuple[re.Pattern, int]] = [
    (re.compile(r"/(service|services|サービス)(/|$)", re.IGNORECASE), 20),
    (re.compile(r"/(works|制作実績|case[-_]?stud|導入事例|実績)(/|$)", re.IGNORECASE), 25),
    (re.compile(r"/(consulting|コンサル|solution|ソリューション)(/|$)", re.IGNORECASE), 25),
    (re.compile(r"/(ec[-_]?(support|agency|consulting|solution|service))(/|$)", re.IGNORECASE), 35),
    (re.compile(r"/(lp|landing|campaign)(/|$)", re.IGNORECASE), 15),
]

# ⑤ スニペット内の語彙スコアリング（D: 代行語 vs ショップ語）
_AGENCY_VOCAB: list[str] = [
    "無料相談", "お見積もり", "料金プラン", "月額", "初期費用", "ご相談",
    "構築支援", "運営支援", "集客支援", "マーケティング支援",
    "ソリューション", "コンサルティング", "サポートします", "お手伝いします",
    "制作から運営まで", "丸ごとお任せ", "まるっとサポート",
]

_SHOP_VOCAB: list[str] = [
    "カートに入れる", "ショッピングカート", "商品一覧", "在庫あり", "在庫切れ",
    "送料無料", "送料", "税込", "購入する", "お気に入り",
    "レビュー", "クーポン", "ポイント", "特定商取引", "お届け",
    "決済", "カード払い", "代引き", "即日発送",
]

# ⑥ フルテキスト（スクレイプ後）用の語彙リスト
_AGENCY_FULL_TEXT_VOCAB: list[str] = [
    "ec構築", "ec運営代行", "ネットショップ制作", "web制作会社", "ホームページ制作会社",
    "制作実績", "導入実績", "支援実績", "無料相談", "料金プラン", "月額費用",
    "お見積もり", "ご相談ください", "集客支援", "マーケティング支援",
    "広告運用代行", "sns運用代行", "物流代行", "フルフィルメント",
    "ecコンサル", "shopify構築", "base制作", "ec-cube構築",
    "初期費用", "運用費用", "月額サービス",
]

_SHOP_FULL_TEXT_VOCAB: list[str] = [
    "カートに入れる", "商品一覧", "在庫", "税込", "送料",
    "ご購入", "クーポン", "ポイント", "お届け日", "レビュー",
    "特定商取引法", "返品・交換", "お支払い方法", "会員登録",
    "商品詳細", "新着商品", "売れ筋", "ランキング", "セール",
]

# ポジティブECシグナル（これがあれば代行業者スコアを大幅減算）
_EC_POSITIVE_SIGNALS: list[str] = [
    "カートに入れる", "ショッピングカート", "商品を購入", "税込",
    "在庫あり", "在庫切れ", "送料無料", "特定商取引法",
    "注文する", "今すぐ購入", "add to cart",
]

_AGENCY_SCORE_THRESHOLD = 45


def is_ec_agency(title: str, snippet: str, company_name: str = "", url: str = "") -> tuple[bool, str]:
    """EC代行・制作業者かどうかをスコアリングで判定する（3層方式）。

    Layer 1: タイトル・スニペットのキーワードマッチ
    Layer 2: ドメイン名・URLパスのパターンマッチ
    Layer 3: 語彙スコアリング（代行語 vs ショップ語）

    Returns:
        (is_agency: bool, reason: str)
    """
    agency_score = 0
    reasons: list[str] = []
    text_lower = f"{title} {snippet} {company_name}".lower()

    # ─ ポジティブECシグナルチェック（あれば代行業者スコアを大幅抑制）─
    ec_positive_count = sum(1 for sig in _EC_POSITIVE_SIGNALS if sig in text_lower)
    if ec_positive_count >= 2:
        return False, ""  # 明確なECショップシグナルがある → 代行業者ではない

    # ─ Layer 1a: タイトルキーワードマッチ ─
    for kw, score in _AGENCY_TITLE_KEYWORDS:
        if kw in text_lower:
            agency_score += score
            reasons.append(f"KW「{kw}」")
            if agency_score >= _AGENCY_SCORE_THRESHOLD:
                break

    # ─ Layer 1b: スニペット文脈パターンマッチ ─
    combined = f"{title} {snippet}"
    for pat, score in _AGENCY_SNIPPET_PATTERNS:
        m = pat.search(combined)
        if m:
            agency_score += score
            reasons.append(f"PAT「{m.group()[:20]}」")
            if agency_score >= _AGENCY_SCORE_THRESHOLD:
                break

    # ─ Layer 2a: ドメイン名パターン ─
    if url:
        try:
            from urllib.parse import urlparse as _up2
            parsed = _up2(url)
            domain = parsed.netloc.lower()
            path = parsed.path.lower()

            for pat, score in _AGENCY_DOMAIN_PATTERNS:
                if pat.search(domain):
                    agency_score += score
                    reasons.append(f"DOM「{domain}」")
                    break

            # ─ Layer 2b: URLパスパターン ─
            for pat, score in _AGENCY_PATH_PATTERNS:
                if pat.search(path):
                    agency_score += score
                    reasons.append(f"PATH「{path[:30]}」")
                    break
        except Exception:
            pass

    # ─ Layer 3: 語彙スコアリング ─
    agency_vocab_count = sum(1 for w in _AGENCY_VOCAB if w in text_lower)
    shop_vocab_count = sum(1 for w in _SHOP_VOCAB if w in text_lower)

    if agency_vocab_count > 0:
        vocab_bonus = min(agency_vocab_count * 12, 40)
        if shop_vocab_count == 0:
            agency_score += vocab_bonus
            if agency_vocab_count >= 2:
                reasons.append(f"VOCAB代行語{agency_vocab_count}語")
        elif agency_vocab_count > shop_vocab_count + 1:
            agency_score += vocab_bonus // 2
            reasons.append(f"VOCAB代行優勢({agency_vocab_count}vs{shop_vocab_count})")

    # ショップ語が多い場合は減算
    if shop_vocab_count >= 3:
        agency_score = max(0, agency_score - 25)

    if agency_score >= _AGENCY_SCORE_THRESHOLD:
        reason_str = " / ".join(reasons[:3]) if reasons else "複合シグナル"
        return True, f"代行業者スコア{agency_score}: {reason_str}"

    return False, ""


def validate_ec_post_scrape(
    ec_score: int,
    cms_type: Optional[str],
    full_text: str,
    company_name: str = "",
) -> tuple[bool, str]:
    """スクレイプ後データを使ってEC代行業者かどうかを精密判定する（A+D層）。

    scraper.py が返す ec_score・cms_type・full_text を利用して
    EC実態のない企業（代行業者・制作会社・非EC事業者）を検出する。

    Args:
        ec_score:     スクレイパーが算出したECスコア（0〜100）
        cms_type:     検出CMSタイプ（Shopify / BASE / WooCommerce 等、または None）
        full_text:    スクレイプ済みページの全文テキスト
        company_name: 会社名（任意）

    Returns:
        (is_agency: bool, reason: str)
    """
    # ─ 強いECポジティブシグナル → 確実にECショップ ─
    EC_CMS_PLATFORMS = {
        "Shopify", "BASE", "MakeShop", "futureshop", "ecbeing", "STORES",
        "WooCommerce", "カラーミー", "EC-CUBE", "Welcart", "aishipR",
        "ロリポップEC", "Yahoo!ショッピング", "楽天市場",
    }
    if cms_type in EC_CMS_PLATFORMS:
        return False, ""  # 既知ECプラットフォーム → 確実にECショップ

    if ec_score >= 50:
        return False, ""  # 高ECスコア → ECショップと判定

    # ─ フルテキスト語彙スコアリング（D層）─
    text_lower = (full_text or "").lower()

    agency_words = [w for w in _AGENCY_FULL_TEXT_VOCAB if w in text_lower]
    shop_words = [w for w in _SHOP_FULL_TEXT_VOCAB if w in text_lower]
    agency_count = len(agency_words)
    shop_count = len(shop_words)

    # ECスコアが低く、代行語彙が多い
    if ec_score < 20 and agency_count >= 3 and shop_count <= 1:
        return True, f"ECスコア低({ec_score}) + 代行語{agency_count}語({', '.join(agency_words[:3])})"

    if ec_score < 30 and agency_count >= 5 and shop_count == 0:
        return True, f"代行語彙優勢({agency_count}語, ECスコア{ec_score})"

    # ショップ語彙ゼロ・ECスコア極低
    if ec_score < 15 and shop_count == 0 and agency_count >= 2:
        return True, f"EC実態なし(スコア{ec_score}, ショップ語0語)"

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
