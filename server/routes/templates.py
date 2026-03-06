from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import MemoTemplate

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(MemoTemplate).order_by(MemoTemplate.created_at.desc()).all()
    return {
        "templates": [
            {
                "id": t.id,
                "title": t.title,
                "content": t.content,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in templates
        ]
    }


@router.post("")
def create_template(data: dict, db: Session = Depends(get_db)):
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="タイトルと内容を入力してください")

    template = MemoTemplate(title=title, content=content)
    db.add(template)
    db.commit()
    db.refresh(template)
    return {
        "template": {
            "id": template.id,
            "title": template.title,
            "content": template.content,
            "created_at": template.created_at.isoformat() if template.created_at else None,
        }
    }


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(MemoTemplate).filter(MemoTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")
    db.delete(template)
    db.commit()
    return {"message": "削除しました"}
