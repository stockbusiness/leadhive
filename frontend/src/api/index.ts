import axios from "axios";
import type {
  Company, StatusHistoryEntry, MemoTemplate, SearchKeyword,
  ScrapeResult, CollectionLog, RejectedItem, DashboardData,
} from "../types";

export const api = {
  dashboard: {
    get: () => axios.get<DashboardData>("/api/dashboard").then(r => r.data),
  },

  companies: {
    list: (params: Record<string, string | number | boolean>) =>
      axios.get<{ total: number; page: number; per_page: number; companies: Company[] }>(
        "/api/companies", { params }
      ).then(r => r.data),

    create: (data: Partial<Company>) =>
      axios.post<{ company: Company }>("/api/companies", data).then(r => r.data),

    update: (id: number, data: Partial<Company>) =>
      axios.put<{ company: Company }>(`/api/companies/${id}`, data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/companies/${id}`).then(r => r.data),

    getHistory: (id: number) =>
      axios.get<{ history: StatusHistoryEntry[] }>(`/api/companies/${id}/history`).then(r => r.data),

    exportCsvUrl: (params: URLSearchParams) =>
      `/api/companies/csv?${params.toString()}`,
  },

  keywords: {
    list: () =>
      axios.get<{ keywords: SearchKeyword[] }>("/api/keywords").then(r => r.data),

    create: (data: Partial<SearchKeyword>) =>
      axios.post("/api/keywords", data).then(r => r.data),

    delete: (id: number) =>
      axios.delete(`/api/keywords/${id}`).then(r => r.data),
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

    history: (limit = 50) =>
      axios.get<{ logs: CollectionLog[] }>("/api/collect/history", { params: { limit } }).then(r => r.data),
  },

  templates: {
    list: () =>
      axios.get<{ templates: MemoTemplate[] }>("/api/templates").then(r => r.data),

    create: (data: { title: string; content: string }) =>
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

  settings: {
    get: () =>
      axios.get("/api/settings").then(r => r.data),

    update: (data: Record<string, string>) =>
      axios.put("/api/settings", data).then(r => r.data),

    test: () =>
      axios.post("/api/settings/test").then(r => r.data),
  },
};
