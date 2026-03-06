export interface Company {
  id: number;
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
  created_at?: string;
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
}
