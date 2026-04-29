from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import get_current_user
from server.models import User, Organization

router = APIRouter()


@router.post("/complete")
def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    org.onboarding_completed = True
    db.commit()

    try:
        from server.services.onbizu import send_onboarding_completed
        send_onboarding_completed(
            db=db,
            user_id=current_user.id,
            email=current_user.email,
            display_name=current_user.display_name or "",
            org_name=org.name,
        )
    except Exception as _ob_err:
        import logging
        logging.getLogger(__name__).warning("Onbizu onboarding_completed error: %s", _ob_err)

    return {"message": "オンボーディングが完了しました"}


@router.patch("/org-name")
def update_org_name(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="管理者のみ変更できます")
    org_name = (body.get("org_name") or "").strip()
    if not org_name:
        raise HTTPException(status_code=400, detail="組織名を入力してください")
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    org.name = org_name
    db.commit()
    return {"message": "組織名を更新しました", "org_name": org.name}
