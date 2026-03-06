from sqlalchemy import Column, Index, Integer, String, Boolean, Text, DateTime, Date, ForeignKey
from sqlalchemy.sql import func
from server.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255))
    website_url = Column(Text, unique=True)
    domain = Column(String(255), index=True)
    contact_url = Column(Text)
    prefecture = Column(String(100))
    city = Column(String(100))
    phone = Column(String(50))
    email = Column(String(255))
    category_main = Column(String(100), index=True)
    category_sub = Column(String(100))
    shopify_flag = Column(Boolean, default=False)
    ec_flag = Column(Boolean, default=False)
    amazon_flag = Column(Boolean, default=False)
    rakuten_flag = Column(Boolean, default=False)
    consulting_flag = Column(Boolean, default=False)
    operation_flag = Column(Boolean, default=False)
    production_flag = Column(Boolean, default=False)
    score_total = Column(Integer, default=0)
    score_adjustment = Column(Integer, default=0)
    score_rank = Column(String(1), default="D", index=True)
    status = Column(String(50), default="未確認", index=True)
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


class ApiUsageLog(Base):
    __tablename__ = "api_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    usage_date = Column(Date, unique=True, nullable=False)
    request_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class CollectionLog(Base):
    __tablename__ = "collection_logs"

    id = Column(Integer, primary_key=True, index=True)
    keyword_id = Column(Integer)
    keyword_text = Column(String(255))
    total_found = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False)
    old_status = Column(String(50))
    new_status = Column(String(50))
    changed_at = Column(DateTime, server_default=func.now())


class MemoTemplate(Base):
    __tablename__ = "memo_templates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_email_template = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class CompanyTag(Base):
    __tablename__ = "company_tags"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    tag_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_company_tags_company_tag", "company_id", "tag_name", unique=True),
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
