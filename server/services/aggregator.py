import re
from urllib.parse import urlparse

# 行政・社団法人・NPO等の公的ドメインサフィックス
PUBLIC_ORG_DOMAIN_SUFFIXES = [
    "go.jp",   # 国の行政機関
    "lg.jp",   # 地方公共団体（都道府県・市区町村）
    "or.jp",   # 社団法人・財団法人・NPO法人・協同組合等
    "ac.jp",   # 大学・学術機関
    "ed.jp",   # 小中高等学校・教育機関
]

PUBLIC_ORG_TITLE_PATTERNS = [
    r"社団法人", r"財団法人",
    r"NPO法人", r"特定非営利活動法人",
    r"市役所", r"区役所", r"町役場", r"村役場",
    r"都庁", r"県庁", r"道庁", r"府庁",
    r"(?:農業|漁業|信用|消費生活|森林)協同組合",
    r"農業協同組合|農協",
    r"国立(?:大学|病院|研究)",
    r"公立(?:大学|病院)",
    r"(?:都|道|府|県|市|区|町|村)立",
]

KNOWN_AGGREGATOR_DOMAINS = [
    "matome.naver.jp", "matomeno.in", "togetter.com",
    "naver.jp", "hatena.ne.jp", "hatenablog.com",
    "qiita.com", "zenn.dev", "note.com",
    "kakaku.com", "price.com", "mybest.com",
    "rank-king.jp", "ranking.net",
    "comparison.com", "hikaku.com",
    "ferret-plus.com", "liskul.com", "boxil.jp",
    "itreview.jp", "oricon.co.jp",
    "minne.com", "creema.jp",
    "coconala.com", "lancers.jp", "crowdworks.jp",
    "wikipedia.org", "youtube.com", "twitter.com", "x.com",
    "facebook.com", "instagram.com", "linkedin.com",
    "amazon.co.jp", "rakuten.co.jp",
    "amebaownd.com", "ameblo.jp", "livedoor.com",
    "fc2.com", "seesaa.net", "jugem.jp",
    "wix.com", "jimdo.com", "weebly.com",
    # 求人・転職サイト
    "en-gage.net", "engage.jp", "en-japan.com",
    "mynavi.jp", "rikunabi.com", "doda.jp",
    "type.jp", "indeed.com", "glassdoor.com",
    "openwork.jp", "vorkers.com", "jobtalk.jp",
    "jobs.rakuten.co.jp", "careerconnection.jp",
    "wantedly.com", "green-japan.com",
    "kuchikomi-kaisha.jp", "kaisha.jp",
    # 企業情報・信用調査
    "tsr-net.co.jp", "teikoku-databank.co.jp",
    "ullet.com", "shikiho.jp", "buffett-code.com",
    "edinet-fsa.go.jp", "nikkei.com",
    "minkabu.jp", "kabutan.jp", "kabuplus.com",
    # 地域・店舗情報
    "itp.ne.jp", "townpage.com", "mapion.co.jp",
    "ekiten.jp", "hotpepper.jp", "gnavi.co.jp",
    "tabelog.com", "jalan.net", "tripadvisor.jp",
    "yelp.com",
    # ナビ・地図・住所検索
    "navitime.co.jp", "yahoo.co.jp",
    "map.yahoo.co.jp", "openstreetmap.org",
    "chizumaru.com", "zenrin.co.jp",
    # 求人サイト追加
    "recruit.co.jp", "r-agent.com", "staffservice.co.jp",
    "hellowork.mhlw.go.jp", "job.rikunabi.com", "next.rikunabi.com",
    "careerlink.jp", "townwork.net", "job-terminal.com",
    "hatarako.net", "gakujo.ne.jp", "baito.mynavi.jp",
    # ニュース・プレス
    "businessinsider.jp", "techcrunch.com", "forbes.com",
    "nhk.or.jp", "asahi.com", "yomiuri.co.jp", "mainichi.jp",
    # レビュー・口コミ
    "review.google.com", "goo.gl",
    # ショッピング・ポータル
    "amazon.com", "ebay.com", "yahoo.com",
    # ローカルページ管理
    "locaop.jp", "maps.google.com", "google.com",
    # プレスリリース・ニュース
    "prtimes.jp", "atpress.ne.jp", "dreamnews.jp",
    "sankeibiz.jp", "jiji.com", "kyodo.co.jp",
    # 電話帳・住所録
    "mapfan.com", "goo.ne.jp", "nuvilog.jp",
    # SNS・コミュニティ
    "pinterest.com", "tiktok.com", "line.me",
    # メディア・雑誌・ニュースサイト
    "ascii.jp", "nikkeibp.co.jp", "nikkei-trendy.com",
    "impress.co.jp", "itmedia.co.jp", "cnet.com", "techcrunch.com",
    "diamond.jp", "toyokeizai.net", "president.jp",
    "dime.jp", "gizmodo.jp", "engadget.com",
    "buzzfeed.com", "huffingtonpost.jp", "livedoor.jp",
    "excite.co.jp", "infoseek.co.jp", "biglobe.ne.jp",
    "mag2.com", "allabout.co.jp", "mynavi.jp",
    "itmedia.co.jp", "keizai.biz", "sbbit.jp",
    "markezine.jp", "nikkansports.com", "sanspo.com",
    "mediaonline.jp", "fnn.jp", "tv-asahi.co.jp",
    "ntv.co.jp", "tbs.co.jp", "nhk.jp",
    # 電子書籍・出版
    "bookwalker.jp", "ebookjapan.yahoo.co.jp", "honto.jp",
    "kindle.amazon.co.jp", "dbook.docomo.ne.jp", "cmoa.jp",
    # 官公庁・学術・PDFが多いサイト
    "meti.go.jp", "mof.go.jp", "cao.go.jp", "soumu.go.jp",
    "jftc.go.jp", "fsa.go.jp", "mhlw.go.jp",
    "ndl.go.jp", "ipa.go.jp", "nict.go.jp",
    "jst.go.jp", "jsps.go.jp", "riken.jp",
    "ac.jp",  # 大学・学術機関全般（サブドメインに含む）
    # 証券・IR・投資情報
    "irbank.net", "kabuyoho.ir-bank.net", "tanshin.co.jp",
    "traders.co.jp", "monex.co.jp", "sbi.co.jp",
]

AGGREGATOR_TITLE_PATTERNS = [
    r"\d+選", r"\d+社", r"おすすめ\d+",
    r"ランキング", r"比較", r"まとめ",
    r"一覧", r"徹底比較", r"厳選",
    r"best\s*\d+", r"top\s*\d+",
    r"とは(何か|どんな|[\?？])", r"解説", r"メリット.*デメリット",
    r"号\s*[-–]\s*", r"アーカイブ", r"懸賞", r"報告書", r"論文",
    r"年\d+月", r"短期大学", r"大学院",
]

AGGREGATOR_URL_PATTERNS = [
    r"ranking", r"matome", r"hikaku",
    r"compare", r"best-?of", r"top-?\d+",
    r"recommend", r"osusume",
    r"/\d{4}/\d{2}/",   # 日付パス（ブログ記事）
    r"/articles?/", r"/news/", r"/column/", r"/media/",
    r"/blog/", r"/archive", r"\.pdf($|\?)",
]


def normalize_domain(domain: str) -> str:
    domain = domain.lower().strip()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def is_public_org(url: str, title: str = "") -> tuple[bool, str]:
    """行政・社団法人・NPO・学術機関等の公的組織かどうかを判定する。"""
    domain = normalize_domain(urlparse(url).netloc)
    _SUFFIX_LABELS = {
        "go.jp": "国の行政機関",
        "lg.jp": "地方公共団体",
        "or.jp": "社団・財団・NPO等",
        "ac.jp": "学術機関",
        "ed.jp": "教育機関",
    }
    for suffix, label in _SUFFIX_LABELS.items():
        if domain == suffix or domain.endswith("." + suffix):
            return True, label

    if title:
        for pattern in PUBLIC_ORG_TITLE_PATTERNS:
            if re.search(pattern, title):
                return True, f"公的組織: {re.search(pattern, title).group()}"

    return False, ""


def is_aggregator_site(url: str, title: str = "") -> tuple[bool, str]:
    domain = normalize_domain(urlparse(url).netloc)
    path = urlparse(url).path.lower()

    for agg_domain in KNOWN_AGGREGATOR_DOMAINS:
        if agg_domain in domain:
            return True, f"既知のまとめサイト: {agg_domain}"

    for pattern in AGGREGATOR_URL_PATTERNS:
        if re.search(pattern, path, re.IGNORECASE):
            return True, f"URLパターン: {pattern}"

    if title:
        for pattern in AGGREGATOR_TITLE_PATTERNS:
            if re.search(pattern, title, re.IGNORECASE):
                return True, f"タイトルパターン: {pattern}"

    return False, ""
