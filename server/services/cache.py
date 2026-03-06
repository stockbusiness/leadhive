import time
from threading import Lock

_cache: dict[str, tuple[float, any]] = {}
_lock = Lock()


def cache_get(key: str, ttl: int = 60) -> any:
    with _lock:
        if key in _cache:
            stored_at, value = _cache[key]
            if time.time() - stored_at < ttl:
                return value
            del _cache[key]
    return None


def cache_set(key: str, value: any):
    with _lock:
        _cache[key] = (time.time(), value)


def cache_invalidate(*prefixes: str):
    with _lock:
        keys_to_delete = []
        for key in _cache:
            for prefix in prefixes:
                if key.startswith(prefix):
                    keys_to_delete.append(key)
                    break
        for key in keys_to_delete:
            del _cache[key]


def cache_clear():
    with _lock:
        _cache.clear()
