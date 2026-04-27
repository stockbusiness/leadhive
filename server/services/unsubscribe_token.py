import hmac
import hashlib
import os

_KNOWN_INSECURE_DEFAULT = "changeme-please-set-session-secret"
_SECRET = os.environ.get("SESSION_SECRET", "")
if not _SECRET or _SECRET == _KNOWN_INSECURE_DEFAULT:
    raise RuntimeError(
        "SESSION_SECRET environment variable is not set or is still the insecure default. "
        "Set a strong, random value before starting the server."
    )


def generate_token(email: str) -> str:
    return hmac.new(
        _SECRET.encode("utf-8"),
        email.lower().strip().encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_token(email: str, token: str) -> bool:
    expected = generate_token(email)
    return hmac.compare_digest(expected, token)


def get_app_base_url() -> str:
    domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
    if domain:
        return f"https://{domain}"
    return ""


def build_unsubscribe_url(email: str) -> str:
    token = generate_token(email)
    base = get_app_base_url()
    if not base:
        return ""
    import urllib.parse
    params = urllib.parse.urlencode({"email": email, "token": token})
    return f"{base}/unsubscribe?{params}"
