from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.database import get_db
from server.models import SearchKeyword, CollectionLog, User, Project
from server.auth import get_current_user
from server.services.cache import cache_get, cache_set, cache_invalidate

router = APIRouter(prefix="/api/keywords", tags=["keywords"])


def _owned_project_ids(current_user: User, db: Session):
    return [p.id for p in db.query(Project.id).filter(Project.org_id == current_user.org_id).all()]


@router.get("")
def list_keywords(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_ids = _owned_project_ids(current_user, db)
    if project_id:
        if project_id not in owned_ids:
            raise HTTPException(status_code=403, detail="アクセス権限がありません")
        cache_key = f"keywords_list_{current_user.org_id}_{project_id}"
    else:
        cache_key = f"keywords_list_{current_user.org_id}"
    cached = cache_get(cache_key, ttl=30)
    if cached:
        return cached
    q = db.query(SearchKeyword)
    if project_id:
        q = q.filter(SearchKeyword.project_id == project_id)
    else:
        q = q.filter(SearchKeyword.project_id.in_(owned_ids))
    keywords = q.order_by(SearchKeyword.created_at.desc()).all()
    result = {
        "keywords": [
            {
                "id": k.id,
                "keyword": k.keyword,
                "category": k.category,
                "region": k.region,
                "exclude_keywords": k.exclude_keywords,
                "is_active": k.is_active,
                "created_at": k.created_at.isoformat() if k.created_at else None,
            }
            for k in keywords
        ]
    }
    cache_set(cache_key, result)
    return result


@router.post("")
def create_keyword(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project_id = data.get("project_id")
    if project_id:
        owned_ids = _owned_project_ids(current_user, db)
        if project_id not in owned_ids:
            raise HTTPException(status_code=403, detail="アクセス権限がありません")
    keyword = SearchKeyword(
        keyword=data["keyword"],
        category=data.get("category", ""),
        region=data.get("region", ""),
        exclude_keywords=data.get("exclude_keywords", ""),
        is_active=data.get("is_active", True),
        project_id=project_id,
    )
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    cache_invalidate("keywords")
    return {
        "keyword": {
            "id": keyword.id,
            "keyword": keyword.keyword,
            "category": keyword.category,
            "region": keyword.region,
            "exclude_keywords": keyword.exclude_keywords,
            "is_active": keyword.is_active,
            "created_at": keyword.created_at.isoformat() if keyword.created_at else None,
        }
    }


@router.post("/ai-suggest")
def ai_suggest_keywords(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = (data.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URLを入力してください")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    from server.services.ai_analyzer import get_openai_key
    from server.services.encryption import decrypt_value

    raw_key = get_openai_key(db, current_user.org_id)
    openai_key = decrypt_value(raw_key) if raw_key else ""
    if not openai_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI APIキーが設定されていません。設定 › AI連携からキーを登録してください。",
        )

    import requests as _requests
    from bs4 import BeautifulSoup

    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; LeadHive/1.0)"}
        resp = _requests.get(url, headers=headers, timeout=(5, 12))
        resp.encoding = resp.apparent_encoding or "utf-8"
        soup = BeautifulSoup(resp.content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        raw_text = soup.get_text(separator="\n", strip=True)
        body = "\n".join(line for line in raw_text.splitlines() if line.strip())[:4000]
        title = (soup.title.string or "").strip() if soup.title else ""
        meta_desc_tag = soup.find("meta", attrs={"name": "description"})
        meta_desc = (meta_desc_tag.get("content") or "").strip() if meta_desc_tag else ""
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"URLの取得に失敗しました: {e}")

    from openai import OpenAI
    import json

    prompt = f"""あなたはBtoB営業のターゲティング専門家です。
以下は商品・サービスのランディングページ（LP）の内容です。

URL: {url}
タイトル: {title}
メタディスクリプション: {meta_desc}
本文（抜粋）:
{body[:3000]}

---

このサービスをBtoB営業で販売したい場合に、ターゲットとなる企業をGoogle検索で
探すためのキーワードを10個提案してください。

各キーワードは「業種＋会社種別＋地域（任意）」の組み合わせで、
実際にGoogle検索で使える自然な日本語フレーズにしてください。

以下のJSON形式で出力してください：
{{
  "suggestions": [
    {{
      "keyword": "キーワード文字列（例: Webデザイン 制作会社 東京）",
      "category": "業種カテゴリ（例: IT・Web, 製造, 小売, 飲食, 医療）",
      "region": "地域（東京・大阪など。地域を限定しない場合は空文字）",
      "reason": "このキーワードを提案した理由（1〜2文）"
    }}
  ]
}}

JSON以外は出力しないでください。"""

    try:
        client = OpenAI(api_key=openai_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        parsed = json.loads(raw)
        suggestions = parsed.get("suggestions") or []

        try:
            from server.models import AiUsageLog
            log = AiUsageLog(
                org_id=current_user.org_id,
                user_id=current_user.id,
                action_type="keyword_suggest",
                token_input=response.usage.prompt_tokens if response.usage else 0,
                token_output=response.usage.completion_tokens if response.usage else 0,
                model="gpt-4o-mini",
            )
            db.add(log)
            db.commit()
        except Exception:
            pass

        return {"suggestions": suggestions, "url": url, "title": title}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AIの応答の解析に失敗しました")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI分析エラー: {e}")


@router.put("/{keyword_id}")
def update_keyword(
    keyword_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_ids = _owned_project_ids(current_user, db)
    keyword = db.query(SearchKeyword).filter(
        SearchKeyword.id == keyword_id,
        SearchKeyword.project_id.in_(owned_ids),
    ).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}

    for key, value in data.items():
        if hasattr(keyword, key) and key not in ("id", "created_at"):
            setattr(keyword, key, value)

    db.commit()
    db.refresh(keyword)
    cache_invalidate("keywords")
    return {
        "keyword": {
            "id": keyword.id,
            "keyword": keyword.keyword,
            "category": keyword.category,
            "region": keyword.region,
            "exclude_keywords": keyword.exclude_keywords,
            "is_active": keyword.is_active,
            "created_at": keyword.created_at.isoformat() if keyword.created_at else None,
        }
    }


@router.get("/analytics")
def get_keyword_analytics(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_ids = _owned_project_ids(current_user, db)
    if project_id:
        if project_id not in owned_ids:
            raise HTTPException(status_code=403, detail="アクセス権限がありません")
        filter_ids = [project_id]
    else:
        filter_ids = owned_ids

    q = db.query(
        CollectionLog.keyword_id,
        CollectionLog.keyword_text,
        func.count(CollectionLog.id).label("total_runs"),
        func.sum(CollectionLog.total_found).label("total_found"),
        func.sum(CollectionLog.success_count).label("success_count"),
        func.sum(CollectionLog.duplicate_count).label("duplicate_count"),
        func.sum(CollectionLog.rejected_count).label("rejected_count"),
        func.sum(CollectionLog.error_count).label("error_count"),
        func.max(CollectionLog.created_at).label("last_run_at"),
    ).filter(CollectionLog.project_id.in_(filter_ids))

    rows = q.group_by(CollectionLog.keyword_id, CollectionLog.keyword_text).all()

    analytics = []
    total_success = 0
    total_api_calls = 0
    total_runs_all = 0

    for row in rows:
        tf = row.total_found or 0
        sc = row.success_count or 0
        dc = row.duplicate_count or 0
        rc = row.rejected_count or 0
        ec = row.error_count or 0
        runs = row.total_runs or 0
        success_rate = round((sc / tf * 100) if tf > 0 else 0.0, 1)
        duplicate_rate = round((dc / tf * 100) if tf > 0 else 0.0, 1)
        rejected_rate = round((rc / tf * 100) if tf > 0 else 0.0, 1)
        total_success += sc
        total_api_calls += tf
        total_runs_all += runs
        analytics.append({
            "keyword_id": row.keyword_id,
            "keyword_text": row.keyword_text or "（不明）",
            "total_runs": runs,
            "total_found": tf,
            "success_count": sc,
            "duplicate_count": dc,
            "rejected_count": rc,
            "error_count": ec,
            "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
            "success_rate": success_rate,
            "duplicate_rate": duplicate_rate,
            "rejected_rate": rejected_rate,
        })

    analytics.sort(key=lambda x: x["success_count"], reverse=True)
    avg_success_rate = round(
        sum(a["success_rate"] for a in analytics) / len(analytics) if analytics else 0.0, 1
    )

    return {
        "analytics": analytics,
        "summary": {
            "total_companies_collected": total_success,
            "total_api_calls": total_api_calls,
            "avg_success_rate": avg_success_rate,
            "total_runs": total_runs_all,
            "keyword_count": len(analytics),
        },
    }


@router.get("/ec-templates")
def get_ec_keyword_templates(
    current_user: User = Depends(get_current_user),
):
    """ECサイトオーナー向けキーワードテンプレートのプリセットを返す"""
    templates = [
        {
            "id": "apparel",
            "label": "アパレル・ファッションEC",
            "icon": "👗",
            "description": "ファッション系EC運営企業向け",
            "keywords": [
                {"keyword": "ファッション通販 会社", "category": "EC運営", "region": ""},
                {"keyword": "レディースファッション 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "アパレル ネットショップ 運営", "category": "EC運営", "region": ""},
                {"keyword": "ブランド 通販 Shopify", "category": "EC運営", "region": ""},
                {"keyword": "古着 通販 EC", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "food",
            "label": "食品・飲料・産直EC",
            "icon": "🍱",
            "description": "食品・飲食料品のEC運営企業向け",
            "keywords": [
                {"keyword": "食品通販 会社 産直", "category": "EC運営", "region": ""},
                {"keyword": "お取り寄せ グルメ 通販", "category": "EC運営", "region": ""},
                {"keyword": "定期便 食品 EC", "category": "EC運営", "region": ""},
                {"keyword": "ワイン 通販 自社サイト", "category": "EC運営", "region": ""},
                {"keyword": "農家 直販 ネットショップ", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "cosme",
            "label": "コスメ・美容・健康EC",
            "icon": "💄",
            "description": "美容・スキンケア・健康食品のEC運営企業向け",
            "keywords": [
                {"keyword": "コスメ 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "スキンケア D2C ブランド", "category": "EC運営", "region": ""},
                {"keyword": "美容 サプリ 定期購入", "category": "EC運営", "region": ""},
                {"keyword": "化粧品 通販 Shopify", "category": "EC運営", "region": ""},
                {"keyword": "オーガニック 美容 ネットショップ", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "btob",
            "label": "BtoB EC・資材・卸売",
            "icon": "🏭",
            "description": "法人向けEC・資材調達・卸売サイト向け",
            "keywords": [
                {"keyword": "法人向け EC 卸売 通販", "category": "EC運営", "region": ""},
                {"keyword": "資材 業務用 ネット注文", "category": "EC運営", "region": ""},
                {"keyword": "BtoB EC 企業間 受発注", "category": "EC運営", "region": ""},
                {"keyword": "工具 部品 通販 法人", "category": "EC運営", "region": ""},
                {"keyword": "業務用食材 オンライン発注", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "handmade",
            "label": "ハンドメイド・作家EC",
            "icon": "🎨",
            "description": "ハンドメイド作家・クリエイターのEC向け",
            "keywords": [
                {"keyword": "ハンドメイド 自社サイト 販売", "category": "EC運営", "region": ""},
                {"keyword": "作家 BASE ネットショップ", "category": "EC運営", "region": ""},
                {"keyword": "アクセサリー 手作り 通販", "category": "EC運営", "region": ""},
                {"keyword": "陶芸 作家 EC", "category": "EC運営", "region": ""},
                {"keyword": "minne STORES 作家 販売", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "interior",
            "label": "インテリア・家具・雑貨EC",
            "icon": "🛋️",
            "description": "インテリア・家具・生活雑貨のEC向け",
            "keywords": [
                {"keyword": "インテリア 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "家具 ネットショップ EC", "category": "EC運営", "region": ""},
                {"keyword": "雑貨 セレクトショップ 通販", "category": "EC運営", "region": ""},
                {"keyword": "北欧家具 オンラインショップ", "category": "EC運営", "region": ""},
                {"keyword": "アンティーク 雑貨 EC 販売", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "d2c",
            "label": "D2Cブランド全般",
            "icon": "🚀",
            "description": "D2C・DTC・自社ブランド直販向け",
            "keywords": [
                {"keyword": "D2C ブランド 自社通販", "category": "EC運営", "region": ""},
                {"keyword": "DTC 直販 オンライン", "category": "EC運営", "region": ""},
                {"keyword": "自社ブランド 通販 EC 立ち上げ", "category": "EC運営", "region": ""},
                {"keyword": "サブスク 定期便 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "OEM 自社ブランド ネットショップ", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "shopify_users",
            "label": "Shopify利用EC運営者",
            "icon": "🛍️",
            "description": "Shopify導入済みEC事業者への直接アプローチ向け",
            "keywords": [
                {"keyword": "Shopify ネットショップ 運営", "category": "EC運営", "region": ""},
                {"keyword": "Shopify EC 事業者", "category": "EC運営", "region": ""},
                {"keyword": "Shopify Plus ブランド", "category": "EC運営", "region": ""},
                {"keyword": "Shopify 導入 通販 会社", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "pet",
            "label": "ペット用品EC",
            "icon": "🐾",
            "description": "ペットフード・用品のEC運営企業向け",
            "keywords": [
                {"keyword": "ペット用品 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "ドッグフード 猫用品 通販 ブランド", "category": "EC運営", "region": ""},
                {"keyword": "ペットグッズ ネットショップ 運営会社", "category": "EC運営", "region": ""},
                {"keyword": "犬 猫 D2C 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "ペット 定期便 EC 自社ブランド", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "sports",
            "label": "スポーツ・アウトドアEC",
            "icon": "⛺",
            "description": "スポーツ用品・アウトドア用品のEC向け",
            "keywords": [
                {"keyword": "スポーツ用品 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "アウトドア キャンプ 通販 ブランド", "category": "EC運営", "region": ""},
                {"keyword": "フィットネス 器具 通販 D2C", "category": "EC運営", "region": ""},
                {"keyword": "サーフ スノボ 通販 ネットショップ", "category": "EC運営", "region": ""},
                {"keyword": "登山 トレラン 通販 公式ショップ", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "hobby",
            "label": "ホビー・趣味・コレクターEC",
            "icon": "🎮",
            "description": "フィギュア・ゲーム・趣味グッズのEC向け",
            "keywords": [
                {"keyword": "フィギュア 模型 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "ゲーム グッズ 通販 ネットショップ", "category": "EC運営", "region": ""},
                {"keyword": "コレクター グッズ 通販 ブランド", "category": "EC運営", "region": ""},
                {"keyword": "プラモデル 工具 通販 EC 会社", "category": "EC運営", "region": ""},
                {"keyword": "アニメ グッズ 自社通販 運営", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "electronics",
            "label": "家電・ガジェット・IT周辺機器EC",
            "icon": "💻",
            "description": "家電・ガジェット・PC周辺機器のEC向け",
            "keywords": [
                {"keyword": "ガジェット 通販 自社EC 会社", "category": "EC運営", "region": ""},
                {"keyword": "スマホ アクセサリー 通販 D2C", "category": "EC運営", "region": ""},
                {"keyword": "PC周辺機器 通販 ネットショップ", "category": "EC運営", "region": ""},
                {"keyword": "家電 通販 自社ブランド EC", "category": "EC運営", "region": ""},
                {"keyword": "IoT スマートホーム 通販 EC", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "healthcare",
            "label": "ヘルスケア・医療・介護EC",
            "icon": "🏥",
            "description": "健康器具・医療用品・介護用品のEC向け",
            "keywords": [
                {"keyword": "ヘルスケア 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "医療用品 ネットショップ 運営", "category": "EC運営", "region": ""},
                {"keyword": "介護用品 通販 D2C ブランド", "category": "EC運営", "region": ""},
                {"keyword": "健康器具 サプリ 通販 定期便", "category": "EC運営", "region": ""},
                {"keyword": "ウェルネス グッズ 通販 自社EC", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "kids_baby",
            "label": "キッズ・ベビー・マタニティEC",
            "icon": "👶",
            "description": "子供用品・ベビー・マタニティのEC向け",
            "keywords": [
                {"keyword": "ベビー用品 通販 自社EC 会社", "category": "EC運営", "region": ""},
                {"keyword": "キッズファッション 通販 D2C", "category": "EC運営", "region": ""},
                {"keyword": "おもちゃ 知育 ネットショップ 運営", "category": "EC運営", "region": ""},
                {"keyword": "マタニティ 出産準備 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "子供服 自社ブランド EC 通販", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "jewelry",
            "label": "ジュエリー・アクセサリーEC",
            "icon": "💎",
            "description": "宝飾・ジュエリー・アクセサリーのEC向け",
            "keywords": [
                {"keyword": "ジュエリー 通販 自社EC 会社", "category": "EC運営", "region": ""},
                {"keyword": "アクセサリー D2C ブランド 通販", "category": "EC運営", "region": ""},
                {"keyword": "指輪 ネックレス ネットショップ 運営", "category": "EC運営", "region": ""},
                {"keyword": "ブライダル ジュエリー EC 通販", "category": "EC運営", "region": ""},
                {"keyword": "天然石 パワーストーン 通販 自社", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "wine_sake",
            "label": "酒・ワイン・飲料EC",
            "icon": "🍷",
            "description": "ワイン・日本酒・クラフトビールのEC向け",
            "keywords": [
                {"keyword": "ワイン 通販 自社EC 輸入", "category": "EC運営", "region": ""},
                {"keyword": "日本酒 地酒 ネットショップ 蔵元", "category": "EC運営", "region": ""},
                {"keyword": "クラフトビール 通販 EC 醸造所", "category": "EC運営", "region": ""},
                {"keyword": "ウイスキー 洋酒 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "お酒 定期便 サブスク EC 会社", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "books_digital",
            "label": "書籍・デジタルコンテンツEC",
            "icon": "📚",
            "description": "書籍・教材・デジタルコンテンツ販売のEC向け",
            "keywords": [
                {"keyword": "書籍 通販 自社EC 出版社", "category": "EC運営", "region": ""},
                {"keyword": "デジタルコンテンツ 販売 EC 会社", "category": "EC運営", "region": ""},
                {"keyword": "オンライン教材 販売 ネットショップ", "category": "EC運営", "region": ""},
                {"keyword": "電子書籍 自社販売 EC プラットフォーム", "category": "EC運営", "region": ""},
                {"keyword": "教育コンテンツ D2C 通販 販売", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "tiktok_shop",
            "label": "TikTokショップ・SNSコマース出店者",
            "icon": "🎵",
            "description": "TikTok Shop・Instagram Shopping等ソーシャルコマース出店企業向け",
            "keywords": [
                {"keyword": "TikTok Shop 出店 ブランド 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "TikTokショップ 運営会社 通販", "category": "EC運営", "region": ""},
                {"keyword": "SNS ライブコマース 通販 自社ブランド", "category": "EC運営", "region": ""},
                {"keyword": "Instagram ショッピング 出店 ブランド 自社", "category": "EC運営", "region": ""},
                {"keyword": "ソーシャルコマース 通販 EC 自社サイト", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "cross_mall",
            "label": "モール一元管理・受注管理EC",
            "icon": "🔗",
            "description": "複数モール一元管理・受注管理システム利用のEC事業者向け",
            "keywords": [
                {"keyword": "クロスモール 利用 EC 通販 運営", "category": "EC運営", "region": ""},
                {"keyword": "モール 一元管理 EC 運営会社", "category": "EC運営", "region": ""},
                {"keyword": "受注管理 EC 複数モール 通販", "category": "EC運営", "region": ""},
                {"keyword": "楽天 Yahoo Amazon 一元管理 EC 自社", "category": "EC運営", "region": ""},
                {"keyword": "OMS 受注管理 通販 EC 運営", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "smaregi_pos",
            "label": "スマレジ・POS連携ECオーナー",
            "icon": "🏪",
            "description": "スマレジ等POS+EC連携で実店舗・オンライン同時運営の事業者向け",
            "keywords": [
                {"keyword": "スマレジ EC 連携 実店舗 通販", "category": "EC運営", "region": ""},
                {"keyword": "POS EC 連携 在庫管理 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "実店舗 EC 一元管理 在庫 通販", "category": "EC運営", "region": ""},
                {"keyword": "オムニチャネル POS EC 運営 自社", "category": "EC運営", "region": ""},
                {"keyword": "レジ EC 連携 通販 運営会社", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "stationery",
            "label": "文具・ステーショナリーEC",
            "icon": "✏️",
            "description": "文具・手帳・画材・ラッピング用品のEC向け",
            "keywords": [
                {"keyword": "文具 ステーショナリー 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "手帳 ノート 通販 自社ブランド", "category": "EC運営", "region": ""},
                {"keyword": "万年筆 ペン 通販 専門EC", "category": "EC運営", "region": ""},
                {"keyword": "ラッピング 包装資材 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "画材 マスキングテープ 通販 自社ブランド", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "music",
            "label": "楽器・音楽機材EC",
            "icon": "🎸",
            "description": "ギター・DTM機材・音響機器・楽器周辺のEC向け",
            "keywords": [
                {"keyword": "楽器 通販 自社EC 専門店", "category": "EC運営", "region": ""},
                {"keyword": "ギター ベース 通販 専門 自社", "category": "EC運営", "region": ""},
                {"keyword": "DTM 音楽制作 機材 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "DJ 機材 通販 自社EC 専門", "category": "EC運営", "region": ""},
                {"keyword": "マイク 音響 スピーカー 通販 自社ブランド", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "anime_game",
            "label": "アニメ・ゲーム・フィギュアEC",
            "icon": "🎌",
            "description": "フィギュア・トレカ・コスプレ・アニメグッズのEC向け",
            "keywords": [
                {"keyword": "アニメグッズ 公式 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "フィギュア コレクター 通販 自社ブランド", "category": "EC運営", "region": ""},
                {"keyword": "トレーディングカード 通販 専門 自社", "category": "EC運営", "region": ""},
                {"keyword": "コスプレ 衣装 通販 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "ゲーミング グッズ 周辺機器 通販 自社", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "craft",
            "label": "工芸品・伝統工芸EC",
            "icon": "🏺",
            "description": "漆器・陶芸・染め物・和雑貨・伝統工芸のEC向け",
            "keywords": [
                {"keyword": "工芸品 伝統 通販 職人 自社EC", "category": "EC運営", "region": ""},
                {"keyword": "和雑貨 和小物 陶磁器 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "漆器 染め物 工房 通販 直販 自社", "category": "EC運営", "region": ""},
                {"keyword": "焼き物 窯元 通販 産地直販 自社", "category": "EC運営", "region": ""},
                {"keyword": "ガラス工芸 木工 手作り 通販 作家", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "regional_brand",
            "label": "地域ブランド・産直EC",
            "icon": "🗾",
            "description": "地方特産品・地産地消・地域工芸の通販EC向け",
            "keywords": [
                {"keyword": "地域ブランド 通販 自社EC 産地直送", "category": "EC運営", "region": ""},
                {"keyword": "ふるさと 特産品 通販 自社販売", "category": "EC運営", "region": ""},
                {"keyword": "地方 農産物 直売 通販 EC", "category": "EC運営", "region": ""},
                {"keyword": "地産地消 生産者 直販 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "地域 工芸品 職人 通販 自社EC", "category": "EC運営", "region": ""},
            ],
        },
        {
            "id": "luxury",
            "label": "高級・プレミアムEC",
            "icon": "✨",
            "description": "ラグジュアリー・オーダーメイド・プレミアム商品の通販EC向け",
            "keywords": [
                {"keyword": "高級 ジュエリー 通販 自社EC ブランド", "category": "EC運営", "region": ""},
                {"keyword": "ラグジュアリー 通販 直販 自社ブランド", "category": "EC運営", "region": ""},
                {"keyword": "プレミアム 食品 ギフト 通販 自社", "category": "EC運営", "region": ""},
                {"keyword": "オーダーメイド 通販 自社EC 職人", "category": "EC運営", "region": ""},
                {"keyword": "高級 時計 バッグ 通販 自社ブランド 直販", "category": "EC運営", "region": ""},
            ],
        },
    ]
    return {"templates": templates}


@router.delete("/{keyword_id}")
def delete_keyword(
    keyword_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_ids = _owned_project_ids(current_user, db)
    keyword = db.query(SearchKeyword).filter(
        SearchKeyword.id == keyword_id,
        SearchKeyword.project_id.in_(owned_ids),
    ).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}
    db.delete(keyword)
    db.commit()
    cache_invalidate("keywords")
    return {"message": "削除しました"}
