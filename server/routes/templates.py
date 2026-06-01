from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import MemoTemplate, User
from server.auth import get_current_user, require_phase0_unlock
from server.services.cache import cache_get, cache_set, cache_invalidate

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = f"templates_list_{current_user.org_id}"
    cached = cache_get(cache_key, ttl=30)
    if cached:
        return cached
    templates = db.query(MemoTemplate).filter(MemoTemplate.org_id == current_user.org_id).order_by(MemoTemplate.created_at.desc()).all()
    result = {
        "templates": [
            {
                "id": t.id,
                "title": t.title,
                "content": t.content,
                "is_email_template": bool(t.is_email_template),
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in templates
        ]
    }
    cache_set(cache_key, result)
    return result


@router.post("")
def create_template(
    data: dict,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    is_email = data.get("is_email_template", False)
    if not title or not content:
        raise HTTPException(status_code=400, detail="タイトルと内容を入力してください")

    template = MemoTemplate(org_id=current_user.org_id, title=title, content=content, is_email_template=is_email)
    db.add(template)
    db.commit()
    db.refresh(template)
    cache_invalidate(f"templates_list_{current_user.org_id}")
    return {
        "template": {
            "id": template.id,
            "title": template.title,
            "content": template.content,
            "is_email_template": bool(template.is_email_template),
            "created_at": template.created_at.isoformat() if template.created_at else None,
        }
    }


@router.get("/ec-presets")
def get_ec_template_presets(
    current_user: User = Depends(get_current_user),
):
    """ECサイトオーナー向けアプローチメッセージテンプレートのプリセットを返す"""
    presets = [
        {
            "id": "shopify_intro",
            "platform": "Shopify",
            "icon": "🛍️",
            "label": "Shopify利用者への初回アプローチ",
            "is_email": True,
            "title": "{会社名} 様 ／ Shopifyストア運営のご支援について",
            "content": "{会社名} ご担当者様\n\nはじめてご連絡させていただきます。\n{担当者名}と申します。\n\nShopifyを活用されたEC運営をされているとのことで、ご連絡いたしました。\n\n弊社では、Shopifyストアの売上改善・LTV向上・広告ROI最適化を支援しております。\n特に下記のような課題をお持ちの企業様にご好評をいただいております：\n\n・カゴ落ち率が改善しない\n・広告費に対してROIが低い\n・顧客の再購入率を上げたい\n\nまずは30分のオンライン相談（無料）からご検討いただけますでしょうか。\n\nご検討のほど、よろしくお願いいたします。",
        },
        {
            "id": "non_shopify_migration",
            "platform": "EC-CUBE / MakeShop / futureshop",
            "icon": "🔄",
            "label": "既存ECカートからのリプレイス提案",
            "is_email": True,
            "title": "{会社名} 様 ／ ECシステムのリプレイスについてご提案",
            "content": "{会社名} ご担当者様\n\nはじめてご連絡いたします。\n{担当者名}と申します。\n\n御社のECサイトを拝見し、現在のカートシステムをご利用されているとのことで、ご提案があり連絡いたしました。\n\n近年、Shopify等の最新プラットフォームへのリプレイスにより、\n・月間売上が平均30%向上\n・運用コストが削減\n・新機能の展開スピードが大幅に改善\nといった効果を実感されるクライアント様が増えております。\n\n御社のEC事業の今後のご方向性についてお聞かせいただけますでしょうか。\nまずはオンラインにてお話させていただければ幸いです。",
        },
        {
            "id": "d2c_growth",
            "platform": "D2C全般",
            "icon": "🚀",
            "label": "D2Cブランドの成長支援提案",
            "is_email": True,
            "title": "{会社名} 様 ／ D2Cブランドの売上拡大についてご提案",
            "content": "{会社名} ご担当者様\n\nはじめてご連絡いたします。\n{担当者名}と申します。\n\n御社のブランドサイトを拝見し、ぜひお力になれることがあるとご連絡いたしました。\n\n弊社は、D2C・自社ブランドECの売上拡大を専門に支援しており、\n主に以下のご支援をしております：\n\n・SNS広告（Instagram/TikTok）の運用代行\n・メルマガ・LINEによるリピート購入促進\n・データ分析に基づいたCRO（転換率最適化）\n\n御社のブランドの世界観を活かしつつ、売上を伸ばすお手伝いができればと考えております。\nご都合のよい日程をご教授いただけますでしょうか。",
        },
        {
            "id": "base_stores_growth",
            "platform": "BASE / STORES",
            "icon": "📦",
            "label": "BASE/STORES利用者へのステップアップ提案",
            "is_email": True,
            "title": "{会社名} 様 ／ ネットショップのさらなる成長に向けてご提案",
            "content": "{会社名} ご担当者様\n\nはじめてご連絡いたします。{担当者名}と申します。\n\n御社のオンラインショップを拝見し、素敵な商品を販売されているとのことでご連絡いたしました。\n\n現在ご利用のショッピングプラットフォームで一定の実績をお持ちの中で、\n次のステージとして独自ドメイン・自社ECへのステップアップをご検討の企業様が増えております。\n\n自社ECに移行することで、\n・プラットフォームへの手数料削減\n・顧客データの完全所有\n・ブランドの独自世界観の構築\nが実現できます。\n\n一度、将来の展望をお聞かせいただけますでしょうか。",
        },
        {
            "id": "omnichannel",
            "platform": "オムニチャネル",
            "icon": "🏪",
            "label": "実店舗+EC（オムニチャネル）展開の提案",
            "is_email": True,
            "title": "{会社名} 様 ／ 実店舗とECの連携強化についてご提案",
            "content": "{会社名} ご担当者様\n\nはじめてご連絡いたします。{担当者名}と申します。\n\n御社の実店舗運営とオンライン販売を組み合わせたビジネスを拝見し、ぜひご支援できると思いご連絡いたしました。\n\n現在、実店舗とECを統合したオムニチャネル化により、\n・在庫の一元管理\n・顧客データの統合\n・来店促進とEC購入の相互送客\nを実現される企業様が急増しています。\n\n御社のお取り組みについて詳しくお聞かせいただき、最適な提案をさせていただければ幸いです。",
        },
        {
            "id": "follow_up_memo",
            "platform": "フォロー共通",
            "icon": "📝",
            "label": "EC企業への訪問・送信メモ（メモ用）",
            "is_email": False,
            "title": "ECサイト確認メモ",
            "content": "【確認日】\n【CMS/プラットフォーム】\n【EC規模感】 商品数: / 月商推定:\n【SNS状況】 Instagram: / X:\n【接触方法】 □フォーム □メール □電話\n【次回アクション】\n【担当者名】\n【所感・備考】",
        },
    ]
    return {"presets": presets}


@router.put("/{template_id}")
def update_template(
    template_id: int,
    data: dict,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    template = db.query(MemoTemplate).filter(MemoTemplate.id == template_id, MemoTemplate.org_id == current_user.org_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="タイトルと内容を入力してください")
    template.title = title
    template.content = content
    db.commit()
    db.refresh(template)
    cache_invalidate(f"templates_list_{current_user.org_id}")
    return {
        "template": {
            "id": template.id,
            "title": template.title,
            "content": template.content,
            "is_email_template": bool(template.is_email_template),
            "created_at": template.created_at.isoformat() if template.created_at else None,
        }
    }


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    template = db.query(MemoTemplate).filter(MemoTemplate.id == template_id, MemoTemplate.org_id == current_user.org_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")
    db.delete(template)
    db.commit()
    cache_invalidate(f"templates_list_{current_user.org_id}")
    return {"message": "削除しました"}
