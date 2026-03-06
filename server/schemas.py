from server.models import Company


def company_to_dict(c: Company) -> dict:
    return {
        "id": c.id,
        "company_name": c.company_name,
        "website_url": c.website_url,
        "domain": c.domain,
        "contact_url": c.contact_url,
        "prefecture": c.prefecture,
        "city": c.city,
        "phone": c.phone,
        "email": c.email,
        "category_main": c.category_main,
        "category_sub": c.category_sub,
        "shopify_flag": c.shopify_flag,
        "ec_flag": c.ec_flag,
        "amazon_flag": c.amazon_flag,
        "rakuten_flag": c.rakuten_flag,
        "consulting_flag": c.consulting_flag,
        "operation_flag": c.operation_flag,
        "production_flag": c.production_flag,
        "score_total": c.score_total,
        "score_adjustment": c.score_adjustment,
        "score_rank": c.score_rank,
        "status": c.status,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }
