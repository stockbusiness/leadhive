from sqlalchemy.orm import Session
from server.models import Company, CompanyTag, User


def company_to_dict(c: Company, db: Session = None) -> dict:
    tags = []
    if db:
        tag_rows = db.query(CompanyTag).filter(CompanyTag.company_id == c.id).all()
        tags = [t.tag_name for t in tag_rows]

    assignee = None
    if db and c.assignee_id:
        u = db.query(User).filter(User.id == c.assignee_id).first()
        if u:
            assignee = {
                "id": u.id,
                "email": u.email,
                "display_name": u.display_name or "",
            }

    return {
        "id": c.id,
        "project_id": c.project_id,
        "assignee_id": c.assignee_id,
        "assignee": assignee,
        "company_name": c.company_name,
        "website_url": c.website_url,
        "domain": c.domain,
        "contact_url": c.contact_url,
        "prefecture": c.prefecture,
        "city": c.city,
        "phone": c.phone,
        "email": c.email,
        "contact_name": c.contact_name,
        "contact_title": c.contact_title,
        "category_main": c.category_main,
        "category_sub": c.category_sub,
        "shopify_flag": c.shopify_flag,
        "ec_flag": c.ec_flag,
        "amazon_flag": c.amazon_flag,
        "rakuten_flag": c.rakuten_flag,
        "base_flag": getattr(c, "base_flag", False),
        "makeshop_flag": getattr(c, "makeshop_flag", False),
        "futureshop_flag": getattr(c, "futureshop_flag", False),
        "stores_flag": getattr(c, "stores_flag", False),
        "consulting_flag": c.consulting_flag,
        "operation_flag": c.operation_flag,
        "production_flag": c.production_flag,
        "score_total": c.score_total,
        "score_adjustment": c.score_adjustment,
        "score_rank": c.score_rank,
        "status": c.status,
        "notes": c.notes,
        "follow_up_date": c.follow_up_date.isoformat() if c.follow_up_date else None,
        "tags": tags,
        "ai_summary": c.ai_summary if hasattr(c, "ai_summary") else None,
        "cms_type": getattr(c, "cms_type", None),
        "cms_detected_at": getattr(c, "cms_detected_at", None).isoformat() if getattr(c, "cms_detected_at", None) else None,
        "sns_links": getattr(c, "sns_links", None),
        "has_recruitment": getattr(c, "has_recruitment", False),
        "employee_count": getattr(c, "employee_count", None),
        "escms_target_flag": getattr(c, "escms_target_flag", False),
        "robots_disallow": getattr(c, "robots_disallow", False),
        "created_at": c.created_at.isoformat() if c.created_at and hasattr(c.created_at, 'isoformat') else (str(c.created_at) if c.created_at else None),
        "updated_at": c.updated_at.isoformat() if c.updated_at and hasattr(c.updated_at, 'isoformat') else (str(c.updated_at) if c.updated_at else None),
    }
