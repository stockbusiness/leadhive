from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from server.database import get_db
from server.models import Project, Company, User
from server.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])

DEFAULT_CATEGORIES = [
    "EC制作", "ECコンサル", "EC運営代行", "EC広告代理店",
    "Shopify支援", "Amazon支援", "楽天支援", "Web制作", "その他",
]

DEFAULT_CATEGORY_KEYWORDS = {
    "Shopify支援": ["shopify", "ショッピファイ"],
    "EC制作": ["ec制作", "ecサイト制作", "ecサイト構築", "ネットショップ制作", "ネットショップ構築"],
    "ECコンサル": ["ecコンサル", "ec支援", "eコマースコンサル"],
    "EC運営代行": ["ec運営代行", "ec運用代行", "ネットショップ運営代行"],
    "EC広告代理店": ["ec広告", "ec集客", "ecマーケティング"],
    "Amazon支援": ["amazon", "アマゾン"],
    "楽天支援": ["楽天", "rakuten"],
    "Web制作": ["web制作", "ウェブ制作", "ホームページ制作", "webサイト制作"],
}

DEFAULT_FLAG_DEFINITIONS = {
    "shopify_flag": ["shopify", "ショッピファイ"],
    "ec_flag": ["ec", "eコマース", "ネットショップ", "通販"],
    "amazon_flag": ["amazon", "アマゾン"],
    "rakuten_flag": ["楽天", "rakuten"],
    "consulting_flag": ["コンサル", "支援", "戦略"],
    "operation_flag": ["運営代行", "運用代行"],
    "production_flag": ["制作", "構築", "開発"],
}

DEFAULT_SCORING_RULES = {
    "shopify_flag": 20,
    "production_flag": 15,
    "consulting_flag": 15,
    "operation_flag": 15,
    "has_contact": 10,
    "has_phone": 5,
    "has_location": 5,
    "multi_platform": 10,
    "low_info_penalty": -10,
    "no_contact_penalty": -15,
    "no_ec_penalty": -20,
}


def _project_to_dict(project, company_count=None):
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description or "",
        "industry": project.industry or "",
        "categories": project.categories or [],
        "category_keywords": project.category_keywords or {},
        "flag_definitions": project.flag_definitions or {},
        "scoring_rules": project.scoring_rules or {},
        "is_active": project.is_active,
        "company_count": company_count,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


@router.get("")
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = db.query(Project).filter(Project.org_id == current_user.org_id).order_by(desc(Project.created_at)).all()
    result = []
    for p in projects:
        count = db.query(func.count(Company.id)).filter(Company.project_id == p.id).scalar()
        result.append(_project_to_dict(p, company_count=count))
    return {"projects": result}


@router.get("/{project_id}")
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.org_id == current_user.org_id).first()
    if not project:
        return {"error": "プロジェクトが見つかりません"}
    count = db.query(func.count(Company.id)).filter(Company.project_id == project.id).scalar()
    return {"project": _project_to_dict(project, company_count=count)}


@router.post("")
def create_project(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.routes.plans import check_plan_limit
    name = data.get("name", "").strip()
    if not name:
        return {"error": "プロジェクト名を入力してください"}

    check_plan_limit(current_user.org_id, "projects", db)

    project = Project(
        org_id=current_user.org_id,
        name=name,
        description=data.get("description", ""),
        industry=data.get("industry", ""),
        categories=data.get("categories", DEFAULT_CATEGORIES),
        category_keywords=data.get("category_keywords", DEFAULT_CATEGORY_KEYWORDS),
        flag_definitions=data.get("flag_definitions", DEFAULT_FLAG_DEFINITIONS),
        scoring_rules=data.get("scoring_rules", DEFAULT_SCORING_RULES),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"project": _project_to_dict(project, company_count=0)}


@router.put("/{project_id}")
def update_project(
    project_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.org_id == current_user.org_id).first()
    if not project:
        return {"error": "プロジェクトが見つかりません"}

    for field in ["name", "description", "industry", "categories", "category_keywords", "flag_definitions", "scoring_rules", "is_active"]:
        if field in data:
            setattr(project, field, data[field])

    db.commit()
    db.refresh(project)
    count = db.query(func.count(Company.id)).filter(Company.project_id == project.id).scalar()
    return {"project": _project_to_dict(project, company_count=count)}


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.org_id == current_user.org_id).first()
    if not project:
        return {"error": "プロジェクトが見つかりません"}

    company_count = db.query(func.count(Company.id)).filter(Company.project_id == project_id).scalar()
    if company_count > 0:
        return {"error": f"このプロジェクトには{company_count}件の企業が登録されています。先に企業を削除または移動してください。"}

    db.delete(project)
    db.commit()
    return {"success": True}
