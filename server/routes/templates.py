from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import MemoTemplate, User
from server.auth import get_current_user
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
    current_user: User = Depends(get_current_user),
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


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = db.query(MemoTemplate).filter(MemoTemplate.id == template_id, MemoTemplate.org_id == current_user.org_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")
    db.delete(template)
    db.commit()
    cache_invalidate(f"templates_list_{current_user.org_id}")
    return {"message": "削除しました"}
