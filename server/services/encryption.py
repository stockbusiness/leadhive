import os
import base64
import hashlib
from cryptography.fernet import Fernet

_ENCRYPT_PREFIX = "enc1:"
_fernet_instance = None


def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    secret = os.environ.get("SESSION_SECRET", "")
    if not secret:
        raise RuntimeError("SESSION_SECRET が設定されていません")

    key_bytes = hashlib.pbkdf2_hmac(
        "sha256",
        secret.encode("utf-8"),
        b"leadhive-field-encryption-v1",
        iterations=100_000,
        dklen=32,
    )
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    _fernet_instance = Fernet(fernet_key)
    return _fernet_instance


def encrypt_value(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    if plaintext.startswith(_ENCRYPT_PREFIX):
        return plaintext
    try:
        f = _get_fernet()
        encrypted = f.encrypt(plaintext.encode("utf-8"))
        return _ENCRYPT_PREFIX + base64.urlsafe_b64encode(encrypted).decode("ascii")
    except Exception:
        return plaintext


def decrypt_value(value: str) -> str:
    if not value:
        return value
    if not value.startswith(_ENCRYPT_PREFIX):
        return value
    try:
        f = _get_fernet()
        encrypted_bytes = base64.urlsafe_b64decode(value[len(_ENCRYPT_PREFIX):].encode("ascii"))
        return f.decrypt(encrypted_bytes).decode("utf-8")
    except Exception:
        return value


def is_encrypted(value: str) -> bool:
    return bool(value and value.startswith(_ENCRYPT_PREFIX))


SENSITIVE_SETTING_KEYS = {
    "google_api_key",
    "google_cx",
    "google_places_api_key",
    "slack_webhook_url",
    "smtp_password",
    "openai_api_key",
    "gbiz_token",
    "gbizinfo_api_token",
    "serper_api_key",
    "anthropic_api_key",
    "stripe_secret_key",
    "stripe_webhook_secret",
}


def should_encrypt(key: str) -> bool:
    return key in SENSITIVE_SETTING_KEYS
