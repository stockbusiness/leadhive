import { CATEGORIES, STATUSES, RANKS } from "../../constants";

interface Filters {
  category: string;
  status: string;
  score_rank: string;
  has_contact: string;
  search: string;
}

export default function CompanyFilterBar({
  filters,
  onFilterChange,
}: {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="会社名・URL検索..."
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filters.category}
          onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全カテゴリ</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全ステータス</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filters.score_rank}
          onChange={(e) => onFilterChange({ ...filters, score_rank: e.target.value })}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全ランク</option>
          {RANKS.map((r) => (
            <option key={r} value={r}>ランク {r}</option>
          ))}
        </select>
        <select
          value={filters.has_contact}
          onChange={(e) => onFilterChange({ ...filters, has_contact: e.target.value })}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">問い合わせ</option>
          <option value="true">あり</option>
          <option value="false">なし</option>
        </select>
      </div>
    </div>
  );
}
