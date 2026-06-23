import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import User, Organization, Plan

_KNOWN_INSECURE_DEFAULT = "changeme-please-set-session-secret"
_SESSION_SECRET_RAW = os.environ.get("SESSION_SECRET", "")
if not _SESSION_SECRET_RAW or _SESSION_SECRET_RAW == _KNOWN_INSECURE_DEFAULT:
    raise RuntimeError(
        "SESSION_SECRET environment variable is not set or is still the insecure default. "
        "Set a strong, random value before starting the server."
    )
SECRET_KEY = _SESSION_SECRET_RAW
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=["sha256_crypt", "bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="認証が必要です")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="無効なトークン")
        token_version: Optional[int] = payload.get("tv")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="無効なトークン")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ユーザーが見つかりません")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アカウントが停止されています。管理者にお問い合わせください。")
    if token_version is not None and token_version != (user.token_version or 1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="セッションが無効化されました。再ログインしてください。")
    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者権限が必要です")
    return current_user


def require_system_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_system_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="システム管理者権限が必要です")
    return current_user


def require_phase0_unlock(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """有料プラン以上のユーザーのみアクセス可（402を返してアップグレードモーダルを発火）"""
    if current_user.is_system_admin or current_user.is_founder:
        return current_user
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if org and org.plan_id:
        plan = db.query(Plan).filter(Plan.id == org.plan_id).first()
        if plan and plan.name != "フリー":
            return current_user
    raise HTTPException(
        status_code=402,
        detail="この機能は有料プランで利用できます。プランをアップグレードしてください。",
    )
