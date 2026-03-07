export interface Company {
  id: number;
  project_id?: number;
  assignee_id?: number | null;
  assignee?: { id: number; email: string; display_name: string } | null;
  company_name: string;
  website_url: string;
  domain: string;
  contact_url: string;
  prefecture: string;
  city: string;
  phone: string;
  email: string;
  category_main: string;
  category_sub: string;
  shopify_flag: boolean;
  ec_flag: boolean;
  amazon_flag: boolean;
  rakuten_flag: boolean;
  consulting_flag: boolean;
  operation_flag: boolean;
  production_flag: boolean;
  score_total: number;
  score_adjustment: number;
  score_rank: string;
  status: string;
  notes: string;
  follow_up_date?: string | null;
  tags?: string[];
  ai_summary?: {
    事業内容?: string;
    顧客層?: string;
    強み?: string;
    サービス?: string;
    価格帯?: string;
    generated_at?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface StatusHistoryEntry {
  id: number;
  old_status: string;
  new_status: string;
  changed_at: string;
}

export interface MemoTemplate {
  id: number;
  title: string;
  content: string;
  is_email_template: boolean;
  created_at?: string;
}

export interface ActivityLogEntry {
  id: number;
  company_id: number;
  action_type: string;
  description: string;
  created_at: string;
}

export interface SearchKeyword {
  id: number;
  keyword: string;
  category: string;
  region: string;
  exclude_keywords: string;
  is_active: boolean;
  created_at: string;
}

export interface ScrapeResult {
  url: string;
  status: "success" | "error" | "duplicate" | "rejected";
  message?: string;
  company_id?: number;
}

export interface CollectSummary {
  keyword: string;
  total: number;
  success: number;
  duplicate: number;
  rejected: number;
  error: number;
}

export interface CollectionLog {
  id: number;
  keyword_id: number;
  keyword_text: string;
  total_found: number;
  success_count: number;
  duplicate_count: number;
  rejected_count: number;
  error_count: number;
  created_at: string;
}

export interface RejectedItem {
  id: number;
  domain: string;
  url: string;
  reason: string;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  industry: string;
  categories: string[];
  category_keywords: Record<string, string[]>;
  flag_definitions: Record<string, string[]>;
  scoring_rules: Record<string, number>;
  is_active: boolean;
  company_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardData {
  total: number;
  unique_domains: number;
  unconfirmed: number;
  high_score: number;
  with_contact: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  by_rank: Record<string, number>;
  by_prefecture: Record<string, number>;
  recent_companies: Company[];
  api_usage_today: number;
  api_daily_limit: number;
  daily_collection_trend?: { date: string; count: number }[];
  today_followups?: Company[];
  top_uncontacted?: Company[];
  replied_companies?: Company[];
}

export interface CompanyMaster {
  id: number;
  domain: string;
  company_name: string;
  website_url: string;
  contact_url: string;
  phone: string;
  email: string;
  prefecture: string;
  city: string;
  category_main: string;
  category_sub: string;
  shopify_flag: boolean;
  ec_flag: boolean;
  amazon_flag: boolean;
  rakuten_flag: boolean;
  consulting_flag: boolean;
  operation_flag: boolean;
  production_flag: boolean;
  score_total: number;
  score_rank: string;
  source: string;
  last_scraped_at: string | null;
  created_at: string | null;
  already_in_project: boolean;
}

export interface PlanData {
  id: number;
  name: string;
  description: string | null;
  price_monthly: number | null;
  max_members: number | null;
  max_projects: number | null;
  max_companies: number | null;
  max_ai_analyses_monthly: number | null;
  api_daily_limit: number | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface PlanUsage {
  members: number;
  projects: number;
  companies: number;
  ai_analyses_this_month: number;
}

export interface OrgWithPlan {
  id: number;
  name: string;
  plan_id: number | null;
  created_at: string | null;
}
