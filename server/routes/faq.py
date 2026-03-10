from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_admin, require_system_admin
from server.models import FaqItem

router = APIRouter(tags=["faq"])

FAQ_CATEGORIES = {
    "general": "一般",
    "technical": "技術的な問題",
    "billing": "料金・プラン",
    "account": "アカウント",
    "other": "その他",
}


def _to_dict(item: FaqItem) -> dict:
    return {
        "id": item.id,
        "question": item.question,
        "answer": item.answer,
        "category": item.category,
        "category_label": FAQ_CATEGORIES.get(item.category, item.category),
        "display_order": item.display_order,
        "is_active": item.is_active,
    }


@router.get("/api/faq")
def list_faq(db: Session = Depends(get_db)):
    items = db.query(FaqItem).filter(
        FaqItem.is_active == True
    ).order_by(FaqItem.display_order.asc(), FaqItem.id.asc()).all()
    return [_to_dict(i) for i in items]


@router.get("/api/faq/search")
def search_faq(q: str = "", db: Session = Depends(get_db)):
    if not q.strip():
        return []
    query = db.query(FaqItem).filter(FaqItem.is_active == True)
    results = []
    q_lower = q.lower()
    for item in query.all():
        if q_lower in item.question.lower() or q_lower in item.answer.lower():
            results.append(_to_dict(item))
        if len(results) >= 5:
            break
    return results


@router.get("/api/admin/faq")
def admin_list_faq(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    items = db.query(FaqItem).order_by(FaqItem.display_order.asc(), FaqItem.id.asc()).all()
    return [_to_dict(i) for i in items]


class FaqBody(BaseModel):
    question: str
    answer: str
    category: str = "general"
    display_order: int = 0
    is_active: bool = True


@router.post("/api/admin/faq")
def create_faq(
    body: FaqBody,
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    if not body.question.strip() or not body.answer.strip():
        raise HTTPException(status_code=400, detail="質問と回答は必須です")
    item = FaqItem(
        question=body.question.strip(),
        answer=body.answer.strip(),
        category=body.category,
        display_order=body.display_order,
        is_active=body.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_dict(item)


@router.put("/api/admin/faq/{item_id}")
def update_faq(
    item_id: int,
    body: FaqBody,
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    item = db.query(FaqItem).filter(FaqItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="FAQが見つかりません")
    item.question = body.question.strip()
    item.answer = body.answer.strip()
    item.category = body.category
    item.display_order = body.display_order
    item.is_active = body.is_active
    db.commit()
    db.refresh(item)
    return _to_dict(item)


@router.delete("/api/admin/faq/{item_id}")
def delete_faq(
    item_id: int,
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    item = db.query(FaqItem).filter(FaqItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="FAQが見つかりません")
    db.delete(item)
    db.commit()
    return {"message": "削除しました"}
