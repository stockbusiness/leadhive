import axios from "axios";
import type {
  Company, StatusHistoryEntry, MemoTemplate, SearchKeyword,
  ScrapeResult, CollectionLog, RejectedItem, DashboardData, ActivityLogEntry, Project, CompanyMaster,
  PlanData, PlanUsage, OrgWithPlan, KeywordAnalytics, KeywordAnalyticsSummary, PipelineCard,
  EcKeywordTemplate, EcTemplatePreset,
} from "../types";

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 402) {
      const message = error.response.data?.detail || "現在のプランの上限に達しました。";
      window.dispatchEvent(new CustomEvent("plan-limit-exceeded", { detail: { message } }));
    }
    return Promise.reject(error);
  }
);

export const api = {
  companies: {
    forSalesAi: (params: { project_id?: number; show_all?: boolean }) =>
      axios.get<{ companies: any[]; total: number; categories: string[] }>(
        "/api/companies/for-sales-ai", { params }
      ).then(r => r.data),

    list: (params: Record<string, string | number | boolean | undefined>) =>
      axios.get<{ total: number; page: number; per_page: number; companies: Company[] }>(
        "/api/companies", { params }
      ).then(r => r.data),

    get: (id: number) =>
      axios.get<{ company: Company }>(`/api/companies/${id}`).then(r => r.data),

    create: (data: Partial<Company>) =>
      axios.post<{ company: Company }>("/api/companies", data).then(r => r.data),

    update: (id: number, data: Partial<Company> & { assignee_id?: number | null }) =>
      axios.put<{ company: Company }>(`/api/companies/${id}`, data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/companies/${id}`).then(r => r.data),

    getHistory: (id: number) =>
      axios.get<{ history: StatusHistoryEntry[] }>(`/api/companies/${id}/history`).then(r => r.data),

    bulkStatus: (companyIds: number[], newStatus: string) =>
      axios.put("/api/companies/bulk-status", { company_ids: companyIds, new_status: newStatus }).then(r => r.data),

    bulkRescore: (params: { project_id?: number }) =>
      axios.post<{ updated: number; total: number; message: string }>("/api/companies/bulk-rescore", params).then(r => r.data),

    exportCsvUrl: (params: URLSearchParams) =>
      `/api/companies/csv?${params.toString()}`,

    exportCsv: (params: URLSearchParams): Promise<{ blob: Blob; count: number; limit: number | null }> =>
      axios.get(`/api/companies/csv?${params.toString()}`, { responseType: "blob" }).then((r) => ({
        blob: r.data as Blob,
        count: parseInt(r.headers["x-export-count"] || "0", 10),
        limit: r.headers["x-export-limit"] ? parseInt(r.headers["x-export-limit"], 10) : null,
      })),

    csvTemplateUrl: () => `/api/companies/csv/template`,

    importCsv: (file: File, projectId: number) => {
      const formData = new FormData();
      formData.append("file", file);
      return axios.post<{ added: number; skipped: number; errors: string[]; message: string }>(
        `/api/companies/import-csv?project_id=${projectId}`, formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      ).then(r => r.data);
    },

    getActivities: (id: number) =>
      axios.get<{ activities: ActivityLogEntry[] }>(`/api/companies/${id}/activities`).then(r => r.data),

    createActivity: (id: number, data: { action_type: string; description: string }) =>
      axios.post<{ activity: ActivityLogEntry }>(`/api/companies/${id}/activities`, data).then(r => r.data),

    rescrape: (id: number) =>
      axios.post<{ company: Company }>(`/api/companies/${id}/rescrape`).then(r => r.data),

    getTags: (id: number) =>
      axios.get<{ tags: { id: number; tag_name: string; created_at: string }[] }>(`/api/companies/${id}/tags`).then(r => r.data),

    addTag: (id: number, tagName: string) =>
      axios.post(`/api/companies/${id}/tags`, { tag_name: tagName }).then(r => r.data),

    deleteTag: (id: number, tagName: string) =>
      axios.delete(`/api/companies/${id}/tags/${encodeURIComponent(tagName)}`).then(r => r.data),

    getAllTags: () =>
      axios.get<{ tags: string[] }>("/api/companies/tags/all").then(r => r.data),

    getDuplicates: () =>
      axios.get<{ duplicate_groups: { normalized_domain: string; companies: Company[] }[]; total_groups: number }>(
        "/api/companies/duplicates"
      ).then(r => r.data),

    merge: (mainId: number, mergeIds: number[]) =>
      axios.post<{ company: Company; merged_count: number }>(
        "/api/companies/merge", { main_id: mainId, merge_ids: mergeIds }
      ).then(r => r.data),

    moveProject: (companyIds: number[], targetProjectId: number) =>
      axios.post("/api/companies/move-project", { company_ids: companyIds, target_project_id: targetProjectId }).then(r => r.data),

    aiAnalyze: (id: number) =>
      axios.post<{ company: Company; summary: Record<string, string>; error?: string }>(`/api/companies/${id}/ai-analyze`).then(r => r.data),

    generateEmail: (id: number, tone: "formal" | "casual", customNote?: string) =>
      axios.post<{ email: { subject: string; body: string; generated_at: string }; error?: string }>(
        `/api/companies/${id}/generate-email`,
        { tone, custom_note: customNote || "" }
      ).then(r => r.data),

    sendEmail: (id: number, data: { subject: string; body: string; to_email: string; template_id?: number }) =>
      axios.post<{ success?: boolean; message?: string; error?: string }>(`/api/companies/${id}/send-email`, data).then(r => r.data),

    getEmailLogs: (id: number) =>
      axios.get<{ logs: { id: number; subject: string; to_email: string; status: string; error_message?: string; sent_by?: string; sent_at: string }[] }>(`/api/companies/${id}/email-logs`).then(r => r.data),

    getPipeline: (projectId?: number) =>
      axios.get<{
        columns: { status: string; companies: PipelineCard[] }[];
        counts: Record<string, number>;
        total: number;
      }>("/api/companies/pipeline", { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),

    patchStatus: (id: number, status: string) =>
      axios.patch<{ id: number; status: string }>(`/api/companies/${id}/status`, { status }).then(r => r.data),

    getAllIds: (params: Record<string, string | number | boolean | undefined>) =>
      axios.get<{ ids: number[]; total: number; with_email: number; capped: boolean }>(
        "/api/companies/ids", { params }
      ).then(r => r.data),
  },

  keywords: {
    list: () =>
      axios.get<{ keywords: SearchKeyword[] }>("/api/keywords").then(r => r.data),

    create: (data: Partial<SearchKeyword>) =>
      axios.post("/api/keywords", data).then(r => r.data),

    update: (id: number, data: Partial<SearchKeyword>) =>
      axios.put(`/api/keywords/${id}`, data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/keywords/${id}`).then(r => r.data),

    analytics: (projectId?: number) =>
      axios.get<{ analytics: KeywordAnalytics[]; summary: KeywordAnalyticsSummary }>(
        "/api/keywords/analytics",
        { params: projectId ? { project_id: projectId } : {} }
      ).then(r => r.data),

    ecTemplates: () =>
      axios.get<{ templates: EcKeywordTemplate[] }>("/api/keywords/ec-templates").then(r => r.data),
  },

  scraper: {
    single: (url: string) =>
      axios.post("/api/scrape", { url }).then(r => r.data),

    bulk: (urls: string[]) =>
      axios.post<{ results: ScrapeResult[] }>("/api/scrape/bulk", { urls }).then(r => r.data),
  },

  collector: {
    single: (keywordId: number) =>
      axios.post("/api/collect", { keyword_id: keywordId }).then(r => r.data),

    all: () =>
      axios.post("/api/collect/all").then(r => r.data),

    startAsync: (params: { keyword_id?: number; project_id?: number }) =>
      axios.post<{ job_id: string }>("/api/collect/async", params).then(r => r.data),

    history: (limit = 50) =>
      axios.get<{ logs: CollectionLog[] }>("/api/collect/history", { params: { limit } }).then(r => r.data),

    directory: (url: string, maxPages: number = 3) =>
      axios.post("/api/collect/directory", { url, max_pages: maxPages }).then(r => r.data),

    googleScrape: (keyword: string, region: string = "", num: number = 10) =>
      axios.post("/api/collect/google-scrape", { keyword, region, num }).then(r => r.data),

    shopifyPartners: (maxResults: number = 20) =>
      axios.post("/api/collect/shopify-partners", { max_results: maxResults }).then(r => r.data),

    googleMaps: (keyword: string, region: string = "東京", maxResults: number = 20) =>
      axios.post("/api/collect/google-maps", { keyword, region, max_results: maxResults }).then(r => r.data),

    startGbiz: (params: { project_id?: number; keyword: string; prefecture: string; max_results: number }) =>
      axios.post<{ job_id: string }>("/api/collect/gbiz", params).then(r => r.data),

    urlsPreview: (params: Record<string, unknown>) =>
      axios.post<{ urls: { url: string; name: string; source: string; location?: string }[]; count: number; error?: string }>(
        "/api/collect/urls-preview", params
      ).then(r => r.data),

    scrapeStaged: (urls: { url: string; name: string; source: string }[], projectId?: number) =>
      axios.post<{ job_id: string }>("/api/collect/scrape-staged", { urls, project_id: projectId }).then(r => r.data),

    enrichCount: (projectId: number) =>
      axios.get<{ count: number }>("/api/collect/enrich-count", { params: { project_id: projectId } }).then(r => r.data),

    enrichStart: (params: { project_id: number; max_items: number }) =>
      axios.post<{ job_id: string }>("/api/collect/enrich", params).then(r => r.data),

    searchEngineStatus: () =>
      axios.get<{ active_engine: string; has_serper: boolean; has_google: boolean }>("/api/collect/search-engine-status").then(r => r.data),

    ecDiscovery: (params: { category_id: string; region?: string; project_id?: number }) =>
      axios.post<{ job_id: string }>("/api/collect/ec-discovery", params).then(r => r.data),

    ecPlatform: (params: { platform: string; keyword?: string; region?: string; project_id?: number }) =>
      axios.post<{ job_id: string }>("/api/collect/ec-platform", params).then(r => r.data),

    ecMatrix: (params: { category_ids: string[]; prefectures: string[]; project_id?: number }) =>
      axios.post<{ job_id: string }>("/api/collect/ec-matrix", params).then(r => r.data),

    ecSimilar: (params: { company_id?: number; domain?: string; cms_type?: string; category?: string; project_id?: number }) =>
      axios.post<{ job_id: string }>("/api/collect/ec-similar", params).then(r => r.data),

    jobStatus: (jobId: string) =>
      axios.get<{
        found: boolean;
        status: string;
        message?: string;
        current?: number;
        total?: number;
        result?: { total_success: number; total_duplicate: number; total_rejected: number; keywords_processed: number };
      }>(`/api/collect/job-status/${jobId}`).then(r => r.data),

    cancelJob: (jobId: string) =>
      axios.post<{ cancelled: boolean; job_id: string }>(`/api/collect/cancel/${jobId}`).then(r => r.data),
  },

  templates: {
    list: () =>
      axios.get<{ templates: MemoTemplate[] }>("/api/templates").then(r => r.data),

    create: (data: { title: string; content: string; is_email_template?: boolean }) =>
      axios.post<{ template: MemoTemplate }>("/api/templates", data).then(r => r.data),

    update: (id: number, data: { title: string; content: string }) =>
      axios.put<{ template: MemoTemplate }>(`/api/templates/${id}`, data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/templates/${id}`).then(r => r.data),

    ecPresets: () =>
      axios.get<{ presets: EcTemplatePreset[] }>("/api/templates/ec-presets").then(r => r.data),
  },

  rejected: {
    list: () =>
      axios.get<{ rejected: RejectedItem[] }>("/api/rejected").then(r => r.data),

    create: (data: { domain: string; reason: string }) =>
      axios.post("/api/rejected", data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/rejected/${id}`).then(r => r.data),
  },

  projects: {
    list: () =>
      axios.get<{ projects: Project[] }>("/api/projects").then(r => r.data),

    get: (id: number) =>
      axios.get<Project>(`/api/projects/${id}`).then(r => r.data),

    create: (data: Partial<Project>) =>
      axios.post<Project>("/api/projects", data).then(r => r.data),

    update: (id: number, data: Partial<Project>) =>
      axios.put<Project>(`/api/projects/${id}`, data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/projects/${id}`).then(r => r.data),
  },

  settings: {
    get: () =>
      axios.get("/api/settings").then(r => r.data),

    update: (data: Record<string, string>) =>
      axios.put("/api/settings", data).then(r => r.data),

    test: () =>
      axios.post("/api/settings/test").then(r => r.data),

    slackTest: () =>
      axios.post("/api/settings/slack-test").then(r => r.data),

    smtpTest: (params?: { test_to?: string; smtp_host?: string; smtp_port?: string; smtp_user?: string; smtp_password?: string; smtp_from_email?: string; smtp_from_name?: string; smtp_use_tls?: string }) =>
      axios.post("/api/settings/smtp-test", params ?? {}).then(r => r.data),

    sendgridTest: (testTo?: string) =>
      axios.post("/api/settings/sendgrid-test", { test_to: testTo }).then(r => r.data),

    getScheduler: () =>
      axios.get("/api/settings/scheduler").then(r => r.data),

    setupStatus: () =>
      axios.get<{ has_serper_api_key: boolean; has_email_config: boolean; keyword_count: number; company_count: number }>("/api/settings/setup-status").then(r => r.data),
  },

  master: {
    stats: () =>
      axios.get<{ total: number; by_category: Record<string, number>; by_source: Record<string, number> }>("/api/master/stats").then(r => r.data),

    search: (params: { q?: string; category?: string; prefecture?: string; min_score?: number; project_id?: number; limit?: number }) =>
      axios.get<{ items: CompanyMaster[]; total: number }>("/api/master/search", { params }).then(r => r.data),

    import: (domainList: string[], projectId: number) =>
      axios.post<{ success: number; duplicate: number; error: number }>("/api/master/import", { domain_list: domainList, project_id: projectId }).then(r => r.data),
  },

  segments: {
    list: () =>
      axios.get<{ segments: import("../types").Segment[] }>("/api/segments").then(r => r.data),

    create: (name: string, description: string, filters: Record<string, any>) =>
      axios.post<{ segment: import("../types").Segment }>("/api/segments", { name, description, filters }).then(r => r.data),

    update: (id: number, data: { name?: string; description?: string; filters?: Record<string, any> }) =>
      axios.put<{ segment: import("../types").Segment }>(`/api/segments/${id}`, data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/segments/${id}`).then(r => r.data),
  },

  users: {
    list: () =>
      axios.get<{
        users: { id: number; email: string; display_name: string; role: string; org_id: number; created_at: string }[];
        pending_invitations: { id: number; email: string; role: string; expires_at: string; created_at: string }[];
      }>("/api/users").then(r => r.data),

    invite: (email: string, role: string = "member") =>
      axios.post<{ message: string; invite_url: string; token: string; smtp_configured: boolean }>(
        "/api/users/invite", { email, role }
      ).then(r => r.data),

    cancelInvitation: (invitationId: number) =>
      axios.delete(`/api/users/invitations/${invitationId}`).then(r => r.data),

    updateRole: (userId: number, role: string) =>
      axios.put(`/api/users/${userId}/role`, { role }).then(r => r.data),

    delete: (userId: number) =>
      axios.delete(`/api/users/${userId}`).then(r => r.data),

    transferOwnership: (newOwnerId: number) =>
      axios.post<{ message: string }>("/api/users/transfer-ownership", { new_owner_id: newOwnerId }).then(r => r.data),
  },

  webhooks: {
    list: () =>
      axios.get<any[]>("/api/webhooks").then(r => r.data),
    create: (data: { name: string; url: string; secret?: string; events: string[]; is_active: boolean }) =>
      axios.post<any>("/api/webhooks", data).then(r => r.data),
    update: (id: number, data: Partial<{ name: string; url: string; secret: string; events: string[]; is_active: boolean }>) =>
      axios.put<any>(`/api/webhooks/${id}`, data).then(r => r.data),
    delete: (id: number) =>
      axios.delete(`/api/webhooks/${id}`).then(r => r.data),
    test: (id: number) =>
      axios.post<{ success: boolean; status_code?: number; error?: string }>(`/api/webhooks/${id}/test`).then(r => r.data),
    listEvents: () =>
      axios.get<{ events: string[] }>("/api/webhooks/events").then(r => r.data),
  },

  plans: {
    list: () =>
      axios.get<{ plans: PlanData[] }>("/api/plans").then(r => r.data),

    create: (data: Omit<PlanData, "id" | "created_at" | "updated_at">) =>
      axios.post<{ plan: PlanData }>("/api/plans", data).then(r => r.data),

    update: (id: number, data: Omit<PlanData, "id" | "created_at" | "updated_at">) =>
      axios.put<{ plan: PlanData }>(`/api/plans/${id}`, data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/plans/${id}`).then(r => r.data),

    assign: (planId: number, orgId: number) =>
      axios.post(`/api/plans/${planId}/assign`, { org_id: orgId }).then(r => r.data),

    unassign: (planId: number, orgId: number) =>
      axios.delete(`/api/plans/${planId}/assign/${orgId}`).then(r => r.data),

    current: () =>
      axios.get<{ plan: PlanData | null; usage: PlanUsage }>("/api/plans/current").then(r => r.data),

    organizations: () =>
      axios.get<{ organizations: OrgWithPlan[] }>("/api/plans/organizations").then(r => r.data),
  },

  stripe: {
    getSettings: () =>
      axios.get<Record<string, string | boolean | null>>("/api/admin/stripe-settings").then(r => r.data),

    updateSettings: (data: {
      stripe_secret_key?: string;
      stripe_publishable_key?: string;
      stripe_webhook_secret?: string;
      stripe_mode?: string;
    }) => axios.put("/api/admin/stripe-settings", data).then(r => r.data),

    testConnection: () =>
      axios.post<{ success: boolean; account_id: string; display_name: string }>("/api/admin/stripe-settings/test").then(r => r.data),

    createCheckout: (planId: number, couponCode?: string) =>
      axios.post<{ url: string; session_id: string }>("/api/payments/checkout", {
        plan_id: planId,
        success_url: `${window.location.origin}/settings?upgrade=success`,
        cancel_url: `${window.location.origin}/settings`,
        coupon_code: couponCode || undefined,
      }).then(r => r.data),

    createCustomerPortal: () =>
      axios.post<{ url: string }>("/api/payments/customer-portal").then(r => r.data),

    downgradeCheck: (planId: number) =>
      axios.get<{
        can_downgrade: boolean;
        target_plan: { id: number; name: string; price_monthly: number | null };
        current_usage: { companies: number; members: number; projects: number };
        warnings: string[];
      }>("/api/payments/downgrade-check", { params: { plan_id: planId } }).then(r => r.data),
  },

  commitrev: {
    getSettings: () =>
      axios.get<Record<string, string | boolean>>("/api/admin/commitrev-settings").then(r => r.data),
    updateSettings: (data: Record<string, string>) =>
      axios.put("/api/admin/commitrev-settings", data).then(r => r.data),
    testConnection: () =>
      axios.post<{ success: boolean; message: string }>("/api/admin/commitrev-settings/test").then(r => r.data),
  },

  admin: {
    getApiSettings: () =>
      axios.get<Record<string, string | boolean>>("/api/admin/api-settings").then(r => r.data),

    updateApiSettings: (data: Record<string, string>) =>
      axios.put("/api/admin/api-settings", data).then(r => r.data),
  },

  auth: {
    me: () =>
      axios.get("/api/auth/me").then(r => r.data),

    updateProfile: (data: { display_name?: string; title?: string; phone?: string; email?: string; current_password?: string; new_password?: string }) =>
      axios.put<{ message: string; user: any; access_token?: string }>("/api/auth/profile", data).then(r => r.data),

    forgotPassword: (email: string) =>
      axios.post("/api/auth/forgot-password", { email }).then(r => r.data),

    resetPassword: (token: string, new_password: string) =>
      axios.post("/api/auth/reset-password", { token, new_password }).then(r => r.data),

    getInvite: (token: string) =>
      axios.get<{ email: string; org_name: string; role: string; expires_at: string }>(
        `/api/auth/invite/${token}`
      ).then(r => r.data),

    acceptInvite: (token: string, data: { display_name: string; password: string }) =>
      axios.post<{ access_token: string; token_type: string; user: any }>(
        `/api/auth/invite/${token}/accept`, data
      ).then(r => r.data),

    logoutAll: () =>
      axios.post<{ message: string; access_token: string }>("/api/auth/logout-all").then(r => r.data),

    setup2fa: () =>
      axios.post<{ secret: string; uri: string; qr_image: string }>("/api/auth/2fa/setup").then(r => r.data),

    confirm2fa: (totp_code: string, secret: string) =>
      axios.post<{ message: string; access_token: string; user: any }>("/api/auth/2fa/confirm", { totp_code, secret }).then(r => r.data),

    disable2fa: (password: string) =>
      axios.post<{ message: string; access_token: string; user: any }>("/api/auth/2fa/disable", { password }).then(r => r.data),

    deleteAccount: (password: string) =>
      axios.delete("/api/auth/account", { data: { password } }).then(r => r.data),

    exportData: () =>
      axios.get("/api/auth/export-data", { responseType: "blob" }).then(r => r.data),

    adminForceLogout: (userId: number) =>
      axios.post<{ message: string }>(`/api/auth/admin/users/${userId}/force-logout`).then(r => r.data),
  },

  tenants: {
    list: () =>
      axios.get<{ tenants: Array<{
        id: number; name: string; plan_id: number | null; plan_name: string | null;
        member_count: number; company_count: number; project_count: number;
        collections_this_month: number; last_login_at: string | null;
        is_churn_risk: boolean; created_at: string | null;
      }> }>("/api/admin/tenants").then(r => r.data),
    update: (orgId: number, data: { plan_id?: number; name?: string }) =>
      axios.patch(`/api/admin/tenants/${orgId}`, data).then(r => r.data),
  },

  adminDashboard: {
    get: () => axios.get("/api/admin/dashboard").then(r => r.data),
    aiCosts: () => axios.get<{ costs: Array<{
      org_id: number; org_name: string; month: string;
      total_input_tokens: number; total_output_tokens: number;
      call_count: number; cost_usd: number;
    }> }>("/api/admin/ai-costs").then(r => r.data),
    revenue: () => axios.get<{
      mrr: number; arr: number; paying_orgs: number;
      new_this_month: number; churn_count: number; churn_rate: number;
      plan_distribution: { name: string; count: number }[];
      top_paying: { org_id: number; org_name: string; plan: string; mrr: number }[];
    }>("/api/admin/revenue").then(r => r.data),
  },

  dashboard: {
    get: (projectId?: number) =>
      axios.get("/api/dashboard", { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),
    team: (projectId?: number) =>
      axios.get<{
        members: Array<{
          user_id: number; display_name: string; email: string;
          assigned_count: number; status_breakdown: Record<string, number>;
          activity_count_this_week: number; overdue_followups: number;
        }>;
        team_summary: {
          total_collected_this_month: number;
          approached_count: number;
          meeting_count: number;
          overdue_count: number;
        };
      }>("/api/dashboard/team", { params: projectId ? { project_id: projectId } : {} }).then(r => r.data),
  },

  adminAllUsers: {
    list: (params?: { search?: string; role?: string; org_id?: number; verified?: string }) =>
      axios.get<{ users: any[] }>("/api/admin/all-users", { params }).then(r => r.data),
    updateRole: (userId: number, role: string) =>
      axios.patch(`/api/admin/all-users/${userId}`, { role }).then(r => r.data),
    delete: (userId: number) =>
      axios.delete(`/api/admin/all-users/${userId}`).then(r => r.data),
    resendVerification: (userId: number) =>
      axios.post<{ message: string; email_sent: boolean; verify_url?: string }>(
        `/api/admin/all-users/${userId}/resend-verification`
      ).then(r => r.data),
    resendAll: () =>
      axios.post<{ total: number; sent: number; message: string }>(
        "/api/admin/unverified-users/resend-all"
      ).then(r => r.data),
    cleanupUnverified: (days: number) =>
      axios.delete<{ deleted: number; message: string }>(
        "/api/admin/unverified-users/cleanup", { params: { days } }
      ).then(r => r.data),
  },

  adminLogs: {
    list: (params?: { page?: number; limit?: number; search?: string; action?: string }) =>
      axios.get<{ total: number; page: number; limit: number; logs: any[] }>("/api/admin/logs", { params }).then(r => r.data),
  },

  adminAnnouncements: {
    list: () => axios.get<{ announcements: any[] }>("/api/admin/announcements").then(r => r.data),
    create: (data: { title: string; content: string; target_org_id?: number | null; is_active: boolean }) =>
      axios.post("/api/admin/announcements", data).then(r => r.data),
    update: (id: number, data: { title: string; content: string; target_org_id?: number | null; is_active: boolean }) =>
      axios.patch(`/api/admin/announcements/${id}`, data).then(r => r.data),
    delete: (id: number) =>
      axios.delete(`/api/admin/announcements/${id}`).then(r => r.data),
  },

  announcements: {
    list: () => axios.get<{ announcements: any[] }>("/api/announcements").then(r => r.data),
  },

  adminBilling: {
    list: () => axios.get("/api/admin/billing").then(r => r.data),
  },

  adminSmtp: {
    get: () => axios.get("/api/admin/smtp-settings").then(r => r.data),
    save: (data: Record<string, string>) => axios.put("/api/admin/smtp-settings", data).then(r => r.data),
    test: (testTo?: string) => axios.post("/api/admin/smtp-settings/test", { test_to: testTo ?? "" }).then(r => r.data),
    getSendgrid: () => axios.get("/api/admin/sendgrid-settings").then(r => r.data),
    saveSendgrid: (data: Record<string, string>) => axios.put("/api/admin/sendgrid-settings", data).then(r => r.data),
    testSendgrid: (testTo?: string) => axios.post("/api/admin/sendgrid-settings/test", { test_to: testTo ?? "" }).then(r => r.data),
    getResend: () => axios.get("/api/admin/resend-settings").then(r => r.data),
    saveResend: (data: Record<string, string>) => axios.put("/api/admin/resend-settings", data).then(r => r.data),
    testResend: (testTo?: string) => axios.post("/api/admin/resend-settings/test", { test_to: testTo ?? "" }).then(r => r.data),
  },

  adminEmailTemplates: {
    list: () => axios.get("/api/admin/email-templates").then(r => r.data),
    save: (id: string, data: { subject?: string; html?: string; text?: string }) =>
      axios.put(`/api/admin/email-templates/${id}`, data).then(r => r.data),
    reset: (id: string) =>
      axios.delete(`/api/admin/email-templates/${id}`).then(r => r.data),
  },

  adminFeatures: {
    get: () => axios.get<Record<string, boolean>>("/api/admin/feature-flags").then(r => r.data),
    save: (flags: Record<string, boolean>) => axios.put("/api/admin/feature-flags", { flags }).then(r => r.data),
  },

  adminContact: {
    get: () => axios.get("/api/admin/contact-settings").then(r => r.data),
    save: (data: Record<string, string>) => axios.put("/api/admin/contact-settings", data).then(r => r.data),
  },

  adminLegal: {
    get: () => axios.get<Record<string, string>>("/api/admin/legal-settings").then(r => r.data),
    save: (data: Record<string, string>) => axios.put("/api/admin/legal-settings", data).then(r => r.data),
  },

  publicLegal: {
    get: () => axios.get<Record<string, string>>("/api/public/legal").then(r => r.data),
  },

  faq: {
    list: () => axios.get("/api/faq").then(r => r.data),
    search: (q: string) => axios.get("/api/faq/search", { params: { q } }).then(r => r.data),
  },

  adminFaq: {
    list: () => axios.get("/api/admin/faq").then(r => r.data),
    create: (data: { question: string; answer: string; category: string; display_order: number; is_active: boolean }) =>
      axios.post("/api/admin/faq", data).then(r => r.data),
    update: (id: number, data: { question: string; answer: string; category: string; display_order: number; is_active: boolean }) =>
      axios.put(`/api/admin/faq/${id}`, data).then(r => r.data),
    delete: (id: number) => axios.delete(`/api/admin/faq/${id}`).then(r => r.data),
  },

  statusPage: {
    get: () => axios.get("/api/status-page").then(r => r.data),
  },

  adminStatus: {
    list: () => axios.get("/api/admin/status-incidents").then(r => r.data),
    create: (data: { title: string; body: string; severity: string; status: string }) =>
      axios.post("/api/admin/status-incidents", data).then(r => r.data),
    update: (id: number, data: { title: string; body: string; severity: string; status: string }) =>
      axios.put(`/api/admin/status-incidents/${id}`, data).then(r => r.data),
    delete: (id: number) => axios.delete(`/api/admin/status-incidents/${id}`).then(r => r.data),
  },

  support: {
    list: (status?: string) => axios.get("/api/support/tickets", { params: status ? { status } : {} }).then(r => r.data),
    create: (data: { subject: string; category: string; priority: string; message: string }) =>
      axios.post("/api/support/tickets", data).then(r => r.data),
    get: (id: number) => axios.get(`/api/support/tickets/${id}`).then(r => r.data),
    addMessage: (id: number, body: string) =>
      axios.post(`/api/support/tickets/${id}/messages`, { body }).then(r => r.data),
    close: (id: number) => axios.put(`/api/support/tickets/${id}/close`).then(r => r.data),
  },

  adminSupport: {
    list: (status?: string) => axios.get("/api/admin/support/tickets", { params: status ? { status } : {} }).then(r => r.data),
    get: (id: number) => axios.get(`/api/admin/support/tickets/${id}`).then(r => r.data),
    addMessage: (id: number, body: string) =>
      axios.post(`/api/admin/support/tickets/${id}/messages`, { body }).then(r => r.data),
    updateStatus: (id: number, status: string) =>
      axios.put(`/api/admin/support/tickets/${id}/status`, { status }).then(r => r.data),
    getSettings: () => axios.get("/api/admin/support/settings").then(r => r.data),
    saveSettings: (data: { ticket_auto_close_days: number }) =>
      axios.put("/api/admin/support/settings", data).then(r => r.data),
  },

  onboarding: {
    complete: () => axios.post("/api/onboarding/complete").then(r => r.data),
    stepCompleted: (stepName: string) =>
      axios.post("/api/onboarding/step", { step_name: stepName }).then(r => r.data),
    updateOrgName: (orgName: string) =>
      axios.patch("/api/onboarding/org-name", { org_name: orgName }).then(r => r.data),
    testGoogleApi: (apiKey: string, cx: string) =>
      axios.post("/api/settings/test", { api_key: apiKey, cx }).then(r => r.data),
    saveSettings: (data: Record<string, string>) =>
      axios.put("/api/settings/", data).then(r => r.data),
  },

  formProfiles: {
    list: () =>
      axios.get<{ profiles: any[] }>("/api/form-profiles").then(r => r.data),
    create: (data: { name: string; display_name?: string; title?: string; phone?: string; email?: string; is_default?: boolean }) =>
      axios.post<{ profile: any }>("/api/form-profiles", data).then(r => r.data),
    update: (id: number, data: { name: string; display_name?: string; title?: string; phone?: string; email?: string; is_default?: boolean }) =>
      axios.put<{ profile: any }>(`/api/form-profiles/${id}`, data).then(r => r.data),
    delete: (id: number) =>
      axios.delete(`/api/form-profiles/${id}`).then(r => r.data),
    setDefault: (id: number) =>
      axios.post(`/api/form-profiles/${id}/set-default`).then(r => r.data),
  },

  salesAi: {
    generate: (companyId: number, templateType: string, projectId?: number, customTemplateId?: number, analyzeSite?: boolean) =>
      axios.post("/api/sales-ai/generate", { company_id: companyId, template_type: templateType, project_id: projectId, custom_template_id: customTemplateId, analyze_site: analyzeSite ?? true }).then(r => r.data),

    generateBatch: (companyIds: number[], templateType: string, projectId?: number, customTemplateId?: number, skipExisting?: boolean, analyzeSite?: boolean) =>
      axios.post("/api/sales-ai/generate-batch", { company_ids: companyIds, template_type: templateType, project_id: projectId, custom_template_id: customTemplateId, skip_existing: skipExisting ?? false, analyze_site: analyzeSite ?? true }).then(r => r.data),

    bulkSend: (sendMethod: string = "manual", profileId?: number, messageIds?: number[]) =>
      axios.post("/api/sales-ai/messages/bulk-send", { send_method: sendMethod, profile_id: profileId, message_ids: messageIds }).then(r => r.data),

    bulkSendForm: (profileId?: number, messageIds?: number[]) =>
      axios.post("/api/sales-ai/messages/bulk-send-form", { send_method: "form", profile_id: profileId, message_ids: messageIds }).then(r => r.data),

    listMessages: (status?: string) =>
      axios.get("/api/sales-ai/messages", { params: status ? { status } : {} }).then(r => r.data),

    updateMessage: (id: number, data: { subject?: string; body?: string }) =>
      axios.put(`/api/sales-ai/messages/${id}`, data).then(r => r.data),

    getSendPreview: (id: number) =>
      axios.get(`/api/sales-ai/messages/${id}/send-preview`).then(r => r.data),

    sendMessage: (id: number, sendMethod: string, note?: string, profileId?: number) =>
      axios.post(`/api/sales-ai/messages/${id}/send`, { send_method: sendMethod, note, profile_id: profileId }).then(r => r.data),

    deleteMessage: (id: number) =>
      axios.delete(`/api/sales-ai/messages/${id}`).then(r => r.data),

    bulkDeleteMessages: (messageIds: number[]) =>
      axios.post("/api/sales-ai/messages/bulk-delete", { message_ids: messageIds }).then(r => r.data),

    startBgJob: (companyIds: number[], templateType: string, projectId?: number, customTemplateId?: number, skipExisting?: boolean, analyzeSite?: boolean, autoSendForm?: boolean, profileId?: number) =>
      axios.post("/api/sales-ai/jobs/start", { company_ids: companyIds, template_type: templateType, project_id: projectId, custom_template_id: customTemplateId, skip_existing: skipExisting ?? true, analyze_site: analyzeSite ?? false, auto_send_form: autoSendForm ?? false, profile_id: profileId }).then(r => r.data),

    getJobStatus: (jobId: string) =>
      axios.get(`/api/sales-ai/jobs/${jobId}`).then(r => r.data),

    getActiveJobs: () =>
      axios.get("/api/sales-ai/jobs/active").then(r => r.data),

    resetFailed: (projectId?: number) =>
      axios.post(`/api/sales-ai/messages/reset-failed${projectId ? `?project_id=${projectId}` : ""}`).then(r => r.data),

    addOptOut: (data: { email?: string; domain?: string; company_id?: number; reason?: string }) =>
      axios.post("/api/sales-ai/opt-out", data).then(r => r.data),

    listOptOut: () =>
      axios.get("/api/sales-ai/opt-out").then(r => r.data),

    checkApiKey: () =>
      axios.get("/api/sales-ai/settings/api-key-status").then(r => r.data),

    getStats: () =>
      axios.get("/api/sales-ai/stats").then(r => r.data),

    getAuditLogs: (limit = 50) =>
      axios.get("/api/sales-ai/audit-logs", { params: { limit } }).then(r => r.data),

    getAutoGenerateSettings: () =>
      axios.get("/api/sales-ai/auto-generate/settings").then(r => r.data),

    updateAutoGenerateSettings: (data: {
      enabled: boolean;
      hour: number;
      statuses: string[];
      min_score: number;
      max_per_run: number;
      template_type: string;
      project_id?: number | null;
    }) => axios.put("/api/sales-ai/auto-generate/settings", data).then(r => r.data),

    runAutoGenerateNow: () =>
      axios.post("/api/sales-ai/auto-generate/run-now").then(r => r.data),
  },

  notifications: {
    followUps: () =>
      axios.get<{
        today: { id: number; company_name: string; follow_up_date: string; status: string; score_rank: string; score_total: number }[];
        overdue: { id: number; company_name: string; follow_up_date: string; status: string; score_rank: string; score_total: number }[];
        today_count: number;
        overdue_count: number;
        total: number;
      }>("/api/notifications/follow-ups").then(r => r.data),
  },

  emailCampaigns: {
    list: (limit = 30, offset = 0) =>
      axios.get("/api/email-campaigns", { params: { limit, offset } }).then(r => r.data),
    get: (id: number) =>
      axios.get(`/api/email-campaigns/${id}`).then(r => r.data),
  },
};
