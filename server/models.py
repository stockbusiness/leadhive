from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from sqlalchemy.sql import func
from server.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255))
    website_url = Column(Text, unique=True)
    domain = Column(String(255))
    contact_url = Column(Text)
    prefecture = Column(String(100))
    city = Column(String(100))
    phone = Column(String(50))
    email = Column(String(255))
    category_main = Column(String(100))
    category_sub = Column(String(100))
    shopify_flag = Column(Boolean, default=False)
    ec_flag = Column(Boolean, default=False)
    amazon_flag = Column(Boolean, default=False)
    rakuten_flag = Column(Boolean, default=False)
    consulting_flag = Column(Boolean, default=False)
    operation_flag = Column(Boolean, default=False)
    production_flag = Column(Boolean, default=False)
    score_total = Column(Integer, default=0)
    score_rank = Column(String(1), default="D")
    status = Column(String(50), default="未確認")
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SearchKeyword(Base):
    __tablename__ = "search_keywords"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(255), nullable=False)
    category = Column(String(100))
    region = Column(String(100))
    exclude_keywords = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(255), unique=True, nullable=False)
    setting_value = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RejectedUrl(Base):
    __tablename__ = "rejected_urls"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), nullable=False)
    url = Column(Text)
    reason = Column(String(255), default="まとめサイト")
    created_at = Column(DateTime, server_default=func.now())
