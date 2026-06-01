import re
from bs4 import BeautifulSoup

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
    "base_flag": ["ベイス", "base.shop", "pay.base.com", "base-ec.jp", "base-ec"],
    "makeshop_flag": ["makeshop", "メイクショップ"],
    "futureshop_flag": ["futureshop", "フューチャーショップ", "future-shop"],
    "stores_flag": ["stores.jp", "stores.store"],
    "woocommerce_flag": ["woocommerce", "ウーコマース", "woo commerce"],
    "yahoo_shopping_flag": ["yahoo!ショッピング", "yahoo shopping", "ストア.yahoo", "store.yahoo.co.jp"],
    "lolipop_flag": ["ロリポップec", "lolipop-ec", "lolipop.jp"],
    "consulting_flag": ["コンサル", "支援", "戦略"],
    "operation_flag": ["運営代行", "運用代行"],
    "production_flag": ["制作", "構築", "開発"],
}

EC_URL_PATTERNS = re.compile(
    r"/(?:products?|items?|shop|goods|catalog|store|cart|purchase|buy|order|checkout)",
    re.IGNORECASE,
)
EC_CART_KEYWORDS = ["カートに入れる", "購入する", "買い物かご", "ショッピングカート", "add to cart", "buy now", "注文する", "カートへ", "今すぐ購入"]
EC_PRICE_KEYWORDS = ["¥", "円", "税込", "税別", "税抜", "価格", "値段", "定価", "割引", "OFF", "送料無料"]
EC_TOKUSHO_PATTERNS = re.compile(r"/(?:tokusho|law|legal|tokuteishohotorihikiho|特定商取引|tokutei)", re.IGNORECASE)
EC_TOKUSHO_CONTENT_KEYWORDS = ["特定商取引法", "販売事業者", "販売責任者", "通信販売", "返品特約", "返品・交換"]
EC_PAYMENT_KEYWORDS = ["決済方法", "お支払い方法", "支払方法", "クレジットカード", "代引き", "送料", "お届け", "配送方法", "配送料"]
EC_PAYMENT_BADGE_KEYWORDS = ["paypay", "line pay", "linepay", "au pay", "メルペイ", "d払い", "楽天pay", "amazon pay", "paidy", "bnpl"]
EC_STOCK_KEYWORDS = ["在庫あり", "在庫確認", "お届け日数", "在庫", "入荷待ち", "残り", "SOLD OUT", "完売"]
EC_REVIEW_KEYWORDS = ["レビュー", "口コミ", "評価", "★", "件のレビュー", "購入者レビュー"]
EC_ROBOTS_CART_PATTERN = re.compile(r"Disallow:\s*/(?:cart|checkout|order|purchase|wishlist|account/order)", re.IGNORECASE)
EC_ROBOTS_EC_PATTERN = re.compile(r"Disallow:\s*/(?:wp-json/wc|wc-api|ecapi)", re.IGNORECASE)
EC_SCALE_PRODUCT_PATTERN = re.compile(r"/(?:products?|items?|goods)/", re.IGNORECASE)
EC_CHECKOUT_URL_PATTERN = re.compile(r"/(?:checkout|cart|basket|payment|order/confirm)", re.IGNORECASE)
EC_WOOCOMMERCE_SIGNALS = re.compile(r"wp-json/wc/|wc-ajax=|woocommerce-cart|wc_add_to_cart|add-to-cart=\d", re.IGNORECASE)
EC_TOKUSHO_URL_EXTENDED = re.compile(r"/(?:tokusho|law|legal|tokuteishohotorihikiho|特定商取引|act|disclosure|company-info)", re.IGNORECASE)
EC_RAKUTEN_SELLER_PATTERN = re.compile(r"item\.rakuten\.co\.jp/|store\.rakuten\.co\.jp/|rakuten\.co\.jp/shop/", re.IGNORECASE)
EC_AMAZON_SELLER_PATTERN = re.compile(r"amazon\.co\.jp/stores/|amazon\.co\.jp/s\?|sellercentral\.amazon", re.IGNORECASE)


def calculate_ec_score(soup: BeautifulSoup, html_source: str, text: str, all_links: list = None,
                       robots_txt: str = None) -> int:
    score = 0
    text_lower = text.lower() if text else ""
    html_lower = html_source.lower() if html_source else ""

    link_hrefs = [a.get("href", "") for a in soup.find_all("a", href=True)] if soup else []

    if any(EC_URL_PATTERNS.search(h) for h in link_hrefs):
        score += 20

    product_link_count = sum(1 for h in link_hrefs if EC_SCALE_PRODUCT_PATTERN.search(h))
    if product_link_count >= 20:
        score += 15
    elif product_link_count >= 5:
        score += 10
    elif product_link_count >= 1:
        score += 5

    if any(EC_CHECKOUT_URL_PATTERN.search(h) for h in link_hrefs):
        score += 15

    if any(kw in text for kw in EC_CART_KEYWORDS):
        score += 20

    if any(kw in text for kw in EC_PRICE_KEYWORDS):
        score += 15

    if any(EC_TOKUSHO_PATTERNS.search(h) for h in link_hrefs):
        score += 20

    if any(kw in text for kw in EC_PAYMENT_KEYWORDS):
        score += 15

    if any(kw in text for kw in EC_STOCK_KEYWORDS):
        score += 10

    all_hrefs_text = " ".join(link_hrefs) + " " + html_lower
    if EC_RAKUTEN_SELLER_PATTERN.search(all_hrefs_text):
        score += 20
    if EC_AMAZON_SELLER_PATTERN.search(all_hrefs_text):
        score += 15

    if soup:
        og_type = soup.find("meta", property="og:type")
        if og_type:
            og_val = og_type.get("content", "").lower()
            if og_val in ("product", "og:product", "product.group", "product:item"):
                score += 15
            elif og_val in ("website", "article") and any(kw in text for kw in EC_CART_KEYWORDS):
                score += 8
        product_schema = soup.find(attrs={"itemtype": re.compile(r"schema.org/Product", re.I)})
        if product_schema:
            score += 10
        offer_schema = soup.find(attrs={"itemtype": re.compile(r"schema.org/Offer", re.I)})
        if offer_schema:
            score += 8

    if any(kw in text for kw in EC_PAYMENT_BADGE_KEYWORDS):
        score += 8

    if any(kw in text for kw in EC_REVIEW_KEYWORDS):
        score += 5

    if any(kw in text for kw in EC_TOKUSHO_CONTENT_KEYWORDS):
        score += 10

    if robots_txt:
        if EC_ROBOTS_CART_PATTERN.search(robots_txt):
            score += 10
        if EC_ROBOTS_EC_PATTERN.search(robots_txt):
            score += 12

    if EC_WOOCOMMERCE_SIGNALS.search(html_lower):
        score += 15

    return min(score, 100)


def calculate_ec_scale(soup: BeautifulSoup, html_source: str, ec_score: int) -> str:
    """EC規模を推定する: large / medium / small / '' のいずれかを返す"""
    if not soup or not html_source:
        return ""
    link_hrefs = [a.get("href", "") for a in soup.find_all("a", href=True)]
    product_link_count = sum(1 for h in link_hrefs if EC_SCALE_PRODUCT_PATTERN.search(h))
    checkout_detected = any(EC_CHECKOUT_URL_PATTERN.search(h) for h in link_hrefs)
    html_lower = html_source.lower() if html_source else ""

    review_count_match = re.search(r"(\d+)\s*件.*?レビュー|レビュー.*?(\d+)\s*件|(\d+)\s*reviews?", html_lower)
    review_count = 0
    if review_count_match:
        raw = next((g for g in review_count_match.groups() if g), "0")
        try:
            review_count = int(raw)
        except ValueError:
            review_count = 0

    woo_signals = EC_WOOCOMMERCE_SIGNALS.search(html_lower)
    has_payment_badge = any(kw in html_lower for kw in EC_PAYMENT_BADGE_KEYWORDS)

    if ec_score >= 70 and (product_link_count >= 20 or (checkout_detected and review_count >= 10)):
        return "large"
    if ec_score >= 60 and (product_link_count >= 10 or (woo_signals and checkout_detected)):
        return "large"
    if ec_score >= 50 and (product_link_count >= 5 or review_count >= 5 or has_payment_badge):
        return "medium"
    if ec_score >= 30 or product_link_count >= 1:
        return "small"
    return ""


def detect_flags(text: str, custom_flags: dict = None, cms_type: str = None,
                 soup: BeautifulSoup = None, html_source: str = None) -> dict:
    text_lower = text.lower()
    source = custom_flags if custom_flags else DEFAULT_FLAG_KEYWORDS
    result = {}
    for flag_name, keywords in source.items():
        result[flag_name] = any(kw.lower() in text_lower for kw in keywords)
    for default_flag in DEFAULT_FLAG_KEYWORDS:
        if default_flag not in result:
            result[default_flag] = any(kw.lower() in text_lower for kw in DEFAULT_FLAG_KEYWORDS[default_flag])

    if soup is not None and html_source is not None:
        ec_score = calculate_ec_score(soup, html_source, text)
    else:
        ec_score = 0

    result["ec_score"] = ec_score

    if ec_score >= 70:
        result["ec_flag"] = True
    elif ec_score < 40:
        if not result.get("ec_flag"):
            result["ec_flag"] = False

    effective_cms = cms_type or ""
    ec_flag = result.get("ec_flag", False)
    result["escms_target_flag"] = bool(ec_flag and effective_cms and effective_cms != "Shopify")

    CMS_TO_FLAG = {
        "Shopify": "shopify_flag",
        "BASE": "base_flag",
        "MakeShop": "makeshop_flag",
        "futureshop": "futureshop_flag",
        "STORES": "stores_flag",
        "WooCommerce": "woocommerce_flag",
        "Yahoo!ショッピング": "yahoo_shopping_flag",
        "ロリポップEC": "lolipop_flag",
    }
    if effective_cms in CMS_TO_FLAG:
        result[CMS_TO_FLAG[effective_cms]] = True

    return result
