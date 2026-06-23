import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=5,      # コネクション取得最大5秒待機（スレッドのDB待機ブロック防止）
    pool_pre_ping=True,  # 切断済みコネクションを再利用しない
    connect_args={"connect_timeout": 10},  # TCP接続タイムアウト10秒（ハング防止）
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
