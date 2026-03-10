from sqlalchemy import Column, Index, Integer, String, Boolean, Text, DateTime, Date, ForeignKey, JSON, UniqueConstraint

from sqlalchemy.sql import func
from server.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price_monthly = Column(Integer, nullable=True)
    max_members = Column(Integer, nullable=True)
    max_projects = Column(Integer, nullable=True)
    max_companies = Column(Integer, nullable=True)
    max_ai_analyses_monthly = Column(Integer, nullable=True)
    max_master_db_imports = Column(Integer, nullable=True)
    max_csv_export = Column(Integer, nullable=True)
    api_daily_limit = Column(Integer, nullable=True)
    allow_smtp_send = Column(Boolean, default=True)
    stripe_price_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True)
    master_db_import_count = Column(Integer, default=0)
    master_db_import_month = Column(String(7), nullable=True)
    onboarding_completed = Column(Boolean, default=False)
    phone = Column(String(50), nullable=True)
    corporate_number = Column(String(13), nullable=True)
    corporate_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="admin")
    display_name = Column(String(255), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    is_system_admin = Column(Boolean, default=False)
    is_founder = Column(Boolean, default=False)
    registration_number = Column(Integer, nullable=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    failed_login_count = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)


class OrgInvitation(Base):
    __tablename__ = "org_invitations"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    token = Column(String(255), nullable=False, unique=True, index=True)
    role = Column(String(50), default="member")
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    industry = Column(String(255), default="")
    categories = Column(JSON, default=list)
    category_keywords = Column(JSON, default=dict)
    flag_definitions = Column(JSON, default=dict)
    scoring_rules = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    company_name = Column(String(255))
    website_url = Column(Text)
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
    ec_score = Column(Integer, default=0)
    amazon_flag = Column(Boolean, default=False)
    rakuten_flag = Column(Boolean, default=False)
    consulting_flag = Column(Boolean, default=False)
    operation_flag = Column(Boolean, default=False)
    production_flag = Column(Boolean, default=False)
    score_total = Column(Integer, default=0)
    score_adjustment = Column(Integer, default=0)
    score_rank = Column(String(1), default="D", index=True)
    status = Column(String(50), default="未確認", index=True)
    contact_name = Column(String(255), nullable=True)
    contact_title = Column(String(100), nullable=True)
    notes = Column(Text)
    follow_up_date = Column(Date, nullable=True, index=True)
    ai_summary = Column(JSON, nullable=True)
    cms_type = Column(String(50), nullable=True)
    cms_detected_at = Column(DateTime, nullable=True)
    sns_links = Column(JSON, nullable=True)
    sns_instagram_url = Column(Text, nullable=True)
    sns_x_url = Column(Text, nullable=True)
    sns_facebook_url = Column(Text, nullable=True)
    sns_youtube_url = Column(Text, nullable=True)
    sns_tiktok_url = Column(Text, nullable=True)
    sns_line_url = Column(Text, nullable=True)
    sns_count = Column(Integer, default=0)
    has_recruitment = Column(Boolean, default=False)
    employee_count = Column(Integer, nullable=True)
    escms_target_flag = Column(Boolean, default=False)
    robots_disallow = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("website_url", "project_id", name="uq_company_url_project"),
    )


class CompanyMaster(Base):
    __tablename__ = "company_master"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), unique=True, nullable=True, index=True)
    corporate_number = Column(String(14), unique=True, nullable=True, index=True)
    company_name = Column(String(255))
    website_url = Column(Text)
    contact_url = Column(Text)
    phone = Column(String(50))
    email = Column(String(255))
    prefecture = Column(String(100), index=True)
    city = Column(String(100))
    category_main = Column(String(100), index=True)
    category_sub = Column(String(100))
    shopify_flag = Column(Boolean, default=False)
    ec_flag = Column(Boolean, default=False)
    ec_score = Column(Integer, default=0)
    amazon_flag = Column(Boolean, default=False)
    rakuten_flag = Column(Boolean, default=False)
    consulting_flag = Column(Boolean, default=False)
    operation_flag = Column(Boolean, default=False)
    production_flag = Column(Boolean, default=False)
    score_total = Column(Integer, default=0)
    score_rank = Column(String(1), default="D", index=True)
    cms_type = Column(String(50), nullable=True)
    cms_detected_at = Column(DateTime, nullable=True)
    sns_links = Column(JSON, nullable=True)
    sns_instagram_url = Column(Text, nullable=True)
    sns_x_url = Column(Text, nullable=True)
    sns_facebook_url = Column(Text, nullable=True)
    sns_youtube_url = Column(Text, nullable=True)
    sns_tiktok_url = Column(Text, nullable=True)
    sns_line_url = Column(Text, nullable=True)
    sns_count = Column(Integer, default=0)
    has_recruitment = Column(Boolean, default=False)
    employee_count = Column(Integer, nullable=True)
    escms_target_flag = Column(Boolean, default=False)
    robots_disallow = Column(Boolean, default=False)
    source = Column(String(100))
    search_text = Column(Text)
    last_scraped_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SearchKeyword(Base):
    __tablename__ = "search_keywords"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    keyword = Column(String(255), nullable=False)
    category = Column(String(100))
    region = Column(String(100))
    exclude_keywords = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    setting_key = Column(String(255), nullable=False)
    setting_value = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RejectedUrl(Base):
    __tablename__ = "rejected_urls"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
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
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
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
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
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


class AiUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action_type = Column(String(50), nullable=False)
    token_input = Column(Integer, default=0)
    token_output = Column(Integer, default=0)
    model = Column(String(50), default="gpt-4o-mini")
    created_at = Column(DateTime, server_default=func.now(), index=True)


class EmailSendLog(Base):
    __tablename__ = "email_send_logs"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    sent_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    template_id = Column(Integer, ForeignKey("memo_templates.id"), nullable=True)
    subject = Column(String(500))
    body = Column(Text)
    to_email = Column(String(255))
    status = Column(String(20), default="sent")
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, server_default=func.now(), index=True)


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(50), nullable=False, index=True)
    actor_email = Column(String(255), nullable=True)
    actor_org = Column(String(255), nullable=True)
    target = Column(String(255), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    target_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class SystemSettings(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class JobLog(Base):
    __tablename__ = "job_logs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), unique=True, index=True, nullable=False)
    job_type = Column(String(50), nullable=True)
    status = Column(String(20), default="running")
    message = Column(Text, nullable=True)
    current = Column(Integer, default=0)
    total = Column(Integer, default=0)
    source_count = Column(Integer, default=0)
    saved_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    started_at = Column(DateTime, server_default=func.now())
    finished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filters = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SalesMessage(Base):
    __tablename__ = "sales_messages"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    template_type = Column(String(30), nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    ai_prompt_id = Column(String(100), nullable=True)
    status = Column(String(20), default="draft", index=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    sent_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    sent_at = Column(DateTime, server_default=func.now(), index=True)
    company_id = Column(Integer, nullable=False, index=True)
    send_method = Column(String(20), nullable=False)
    sent_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    message_id = Column(Integer, ForeignKey("sales_messages.id"), nullable=True)
    ai_prompt_id = Column(String(100), nullable=True)
    result = Column(String(30), default="sent")
    note = Column(Text, nullable=True)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(20), unique=True, nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(500), nullable=False)
    category = Column(String(50), nullable=False, default="general")
    priority = Column(String(20), nullable=False, default="normal")
    status = Column(String(20), nullable=False, default="open")
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime, nullable=True)


class SupportTicketMessage(Base):
    __tablename__ = "support_ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_staff = Column(Boolean, nullable=False, default=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class FaqItem(Base):
    __tablename__ = "faq_items"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String(500), nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, default="general")
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class StatusIncident(Base):
    __tablename__ = "status_incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    body = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, default="minor")
    status = Column(String(20), nullable=False, default="investigating")
    created_at = Column(DateTime, server_default=func.now(), index=True)
    resolved_at = Column(DateTime, nullable=True)


class OptOutList(Base):
    __tablename__ = "opt_out_list"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=True, index=True)
    domain = Column(String(255), nullable=True, index=True)
    company_id = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    added_at = Column(DateTime, server_default=func.now())
