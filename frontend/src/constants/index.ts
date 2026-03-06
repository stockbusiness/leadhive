export const CATEGORIES = [
  "EC制作", "ECコンサル", "EC運営代行", "EC広告代理店",
  "Shopify支援", "Amazon支援", "楽天支援", "Web制作", "その他",
];

export const STATUSES = [
  "未確認", "対象候補", "除外", "アプローチ前",
  "フォーム送信済", "返信あり", "面談化", "代理店化", "失注",
];

export const RANKS = ["A", "B", "C", "D"];

export const DEFAULT_KEYWORDS = [
  { keyword: "Shopify 制作会社", category: "Shopify支援" },
  { keyword: "EC 制作会社", category: "EC制作" },
  { keyword: "EC コンサル", category: "ECコンサル" },
  { keyword: "EC 運営代行", category: "EC運営代行" },
  { keyword: "Amazon 運用代行", category: "Amazon支援" },
  { keyword: "楽天 運営代行", category: "楽天支援" },
];

export const RANK_COLORS: Record<string, string> = {
  A: "#10b981",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#94a3b8",
};

export const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

export const SCORE_BADGE_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-amber-100 text-amber-800 border-amber-200",
  D: "bg-slate-100 text-slate-600 border-slate-200",
};
