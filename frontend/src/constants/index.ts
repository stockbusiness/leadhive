export const CATEGORIES = [
  "Web制作", "IT・システム開発", "コンサルティング", "マーケティング・広告",
  "人材・採用", "不動産", "医療・福祉", "製造・メーカー", "物流・運送",
  "飲食・フード", "小売・流通", "士業・法律", "教育・研修",
  "EC制作", "ECコンサル", "EC運営代行", "EC広告代理店",
  "Shopify支援", "Amazon支援", "楽天支援", "その他",
];

export const STATUSES = [
  "未確認", "対象候補", "除外", "アプローチ前",
  "フォーム送信済", "返信あり", "面談化", "代理店化", "失注",
];

export const RANKS = ["A", "B", "C", "D"];

export const DEFAULT_KEYWORDS = [
  { keyword: "Web制作 会社", category: "Web制作" },
  { keyword: "システム開発 会社", category: "IT・システム開発" },
  { keyword: "コンサルティング 中小企業", category: "コンサルティング" },
  { keyword: "Webマーケティング 会社", category: "マーケティング・広告" },
  { keyword: "人材紹介 会社", category: "人材・採用" },
  { keyword: "Shopify 制作会社", category: "Shopify支援" },
  { keyword: "EC 制作会社", category: "EC制作" },
  { keyword: "EC コンサル", category: "ECコンサル" },
];

export const KEYWORD_SUGGESTIONS: { industry: string; examples: string[] }[] = [
  {
    industry: "Web・IT",
    examples: [
      "Web制作 会社", "ホームページ制作 会社", "システム開発 会社",
      "アプリ開発 会社", "DX推進 支援", "クラウド導入 支援",
    ],
  },
  {
    industry: "マーケティング・広告",
    examples: [
      "Webマーケティング 会社", "SEO対策 会社", "SNS運用代行",
      "Web広告 代理店", "コンテンツ制作 会社", "PR会社",
    ],
  },
  {
    industry: "コンサル・士業",
    examples: [
      "経営コンサルティング 会社", "中小企業 コンサルタント",
      "税理士事務所", "社会保険労務士", "行政書士 事務所",
    ],
  },
  {
    industry: "人材・採用",
    examples: [
      "人材紹介 会社", "派遣会社", "採用支援 会社",
      "HR Tech 会社", "アウトソーシング 会社",
    ],
  },
  {
    industry: "不動産",
    examples: [
      "不動産会社", "不動産管理 会社", "賃貸管理 会社",
      "不動産コンサルティング", "土地活用 会社",
    ],
  },
  {
    industry: "医療・介護",
    examples: [
      "医療機器 メーカー", "調剤薬局", "訪問看護 ステーション",
      "介護施設 運営", "医療IT 会社",
    ],
  },
  {
    industry: "製造・物流",
    examples: [
      "製造業 中小企業", "部品メーカー", "物流会社",
      "倉庫業 会社", "食品メーカー",
    ],
  },
  {
    industry: "EC・通販",
    examples: [
      "Shopify 制作会社", "EC 制作会社", "EC コンサル",
      "EC 運営代行", "Amazon 運用代行", "楽天 運営代行",
    ],
  },
];

export const REGION_SUGGESTIONS = [
  "東京", "大阪", "名古屋", "福岡", "札幌", "仙台",
  "横浜", "神戸", "京都", "広島", "関東", "関西", "全国",
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
