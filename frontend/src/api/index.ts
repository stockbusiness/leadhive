import axios from "axios";
import type {
  Company, StatusHistoryEntry, MemoTemplate, SearchKeyword,
  ScrapeResult, CollectionLog, RejectedItem, DashboardData, ActivityLogEntry, Project, CompanyMaster,
  PlanData, PlanUsage, OrgWithPlan, KeywordAnalytics, KeywordAnalyticsSummary,
} from "../types";

export const api = {
  dashboard: {
    get: () => axios.get<DashboardData>("/api/dashboard").then(r => r.data),
  },

  companies: {
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

    exportCsvUrl: (params: URLSearchParams) =>
      `/api/companies/csv?${params.toString()}`,

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
  },

  keywords: {
    list: () =>
      axios.get<{ keywords: SearchKeyword[] }>("/api/keywords").then(r => r.data),

    create: (data: Partial<SearchKeyword>) =>
      axios.post("/api/keywords", data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/keywords/${id}`).then(r => r.data),

    analytics: (projectId?: number) =>
      axios.get<{ analytics: KeywordAnalytics[]; summary: KeywordAnalyticsSummary }>(
        "/api/keywords/analytics",
        { params: projectId ? { project_id: projectId } : {} }
      ).then(r => r.data),
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
  },

  templates: {
    list: () =>
      axios.get<{ templates: MemoTemplate[] }>("/api/templates").then(r => r.data),

    create: (data: { title: string; content: string; is_email_template?: boolean }) =>
      axios.post<{ template: MemoTemplate }>("/api/templates", data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/templates/${id}`).then(r => r.data),
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

    smtpTest: (testTo?: string) =>
      axios.post("/api/settings/smtp-test", { test_to: testTo }).then(r => r.data),

    getScheduler: () =>
      axios.get("/api/settings/scheduler").then(r => r.data),
  },

  master: {
    stats: () =>
      axios.get<{ total: number; by_category: Record<string, number>; by_source: Record<string, number> }>("/api/master/stats").then(r => r.data),

    search: (params: { q?: string; category?: string; prefecture?: string; min_score?: number; project_id?: number; limit?: number }) =>
      axios.get<{ items: CompanyMaster[]; total: number }>("/api/master/search", { params }).then(r => r.data),

    import: (domainList: string[], projectId: number) =>
      axios.post<{ success: number; duplicate: number; error: number }>("/api/master/import", { domain_list: domainList, project_id: projectId }).then(r => r.data),
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

  auth: {
    me: () =>
      axios.get("/api/auth/me").then(r => r.data),

    updateProfile: (data: { display_name?: string; email?: string; current_password?: string; new_password?: string }) =>
      axios.put<{ message: string; user: any }>("/api/auth/profile", data).then(r => r.data),

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
  },
};
