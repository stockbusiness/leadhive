import logging
import requests
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAIL_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def search_google_maps(
    keyword: str,
    region: str = "日本",
    api_key: str = "",
    max_results: int = 20,
) -> list[dict]:
    if not api_key:
        return []

    query = f"{keyword} {region}".strip()
    all_places = []
    next_page_token = None

    while len(all_places) < max_results:
        params = {
            "query": query,
            "key": api_key,
            "language": "ja",
        }
        if next_page_token:
            params["pagetoken"] = next_page_token

        try:
            resp = requests.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=15)
            data = resp.json()
        except Exception as e:
            logger.error(f"Google Places API error: {e}")
            break

        status = data.get("status", "")
        if status == "REQUEST_DENIED":
            logger.error(f"Google Places API denied: {data.get('error_message', '')}")
            break
        if status not in ("OK", "ZERO_RESULTS"):
            logger.warning(f"Google Places API status: {status}")
            break

        results = data.get("results", [])
        if not results:
            break

        for place in results:
            if len(all_places) >= max_results:
                break
            all_places.append(place)

        next_page_token = data.get("next_page_token")
        if not next_page_token:
            break

        import time
        time.sleep(2)

    companies = []
    for place in all_places:
        place_id = place.get("place_id", "")
        detail = _get_place_details(place_id, api_key) if place_id else {}

        website = detail.get("website", "")
        if not website:
            continue

        parsed = urlparse(website)
        if parsed.scheme not in ("http", "https"):
            continue

        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]

        companies.append({
            "url": website,
            "title": place.get("name", ""),
            "description": detail.get("formatted_address", place.get("formatted_address", "")),
            "places_data": {
                "name": place.get("name", ""),
                "address": detail.get("formatted_address", place.get("formatted_address", "")),
                "phone": detail.get("formatted_phone_number", ""),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("user_ratings_total"),
                "types": place.get("types", []),
                "business_status": place.get("business_status", ""),
            },
        })

    return companies


def _get_place_details(place_id: str, api_key: str) -> dict:
    params = {
        "place_id": place_id,
        "key": api_key,
        "language": "ja",
        "fields": "website,formatted_phone_number,formatted_address,opening_hours",
    }
    try:
        resp = requests.get(PLACES_DETAIL_URL, params=params, timeout=10)
        data = resp.json()
        if data.get("status") == "OK":
            return data.get("result", {})
    except Exception as e:
        logger.error(f"Place details error for {place_id}: {e}")
    return {}
