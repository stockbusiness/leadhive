from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import SearchKeyword
from server.services.collector import collect_by_keyword

router = APIRouter(prefix="/api/collect", tags=["collector"])


@router.post("")
def collect_single(data: dict, db: Session = Depends(get_db)):
    keyword_id = data.get("keyword_id")
    if not keyword_id:
        return {"error": "キーワードIDを指定してください"}
    return collect_by_keyword(keyword_id, db)


@router.post("/all")
def collect_all(db: Session = Depends(get_db)):
    keywords = db.query(SearchKeyword).filter(SearchKeyword.is_active == True).all()
    if not keywords:
        return {"error": "アクティブなキーワードがありません"}

    all_results = []
    for kw in keywords:
        result = collect_by_keyword(kw.id, db)
        if "error" in result:
            all_results.append({
                "keyword": kw.keyword,
                "error": result["error"],
            })
        else:
            all_results.append({
                "keyword": kw.keyword,
                "summary": result["summary"],
                "results": result["results"],
            })

    total_success = sum(
        r.get("summary", {}).get("success", 0) for r in all_results if "summary" in r
    )
    total_rejected = sum(
        r.get("summary", {}).get("rejected", 0) for r in all_results if "summary" in r
    )
    total_duplicate = sum(
        r.get("summary", {}).get("duplicate", 0) for r in all_results if "summary" in r
    )

    return {
        "keywords_processed": len(all_results),
        "total_success": total_success,
        "total_rejected": total_rejected,
        "total_duplicate": total_duplicate,
        "details": all_results,
    }
