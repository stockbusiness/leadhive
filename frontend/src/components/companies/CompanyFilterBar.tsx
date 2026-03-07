import { useState, useEffect } from "react";
import { CATEGORIES, STATUSES, RANKS } from "../../constants";
import { useDebounce } from "../../hooks/useDebounce";
import { api } from "../../api";

interface Filters {
  category: string;
  status: string;
  score_rank: string;
  has_contact: string;
  search: string;
  tag: string;
  assignee_id: string;
  follow_up_filter: string;
}

export default function CompanyFilterBar({
  filters,
  onFilterChange,
}: {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: number; email: string; display_name: string }[]>([]);

  useEffect(() => {
    api.companies.getAllTags().then((data) => setAllTags(data.tags));
    api.users.list().then((data) => setMembers(data.users.map(u => ({ id: u.id, email: u.email, display_name: u.display_name }))));
  }, []);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const selectClass = "border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="会社名・URL・メモ検索..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className={`${selectClass} w-full sm:w-48`}
        />
        <select
          value={filters.category}
          onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
          className={selectClass}
        >
          <option value="">全カテゴリ</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
          className={selectClass}
        >
          <option value="">全ステータス</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filters.score_rank}
          onChange={(e) => onFilterChange({ ...filters, score_rank: e.target.value })}
          className={selectClass}
        >
          <option value="">全ランク</option>
          {RANKS.map((r) => (
            <option key={r} value={r}>ランク {r}</option>
          ))}
        </select>
        <select
          value={filters.has_contact}
          onChange={(e) => onFilterChange({ ...filters, has_contact: e.target.value })}
          className={selectClass}
        >
          <option value="">問い合わせ</option>
          <option value="true">あり</option>
          <option value="false">なし</option>
        </select>
        {members.length > 0 && (
          <select
            value={filters.assignee_id}
            onChange={(e) => onFilterChange({ ...filters, assignee_id: e.target.value })}
            className={selectClass}
          >
            <option value="">全担当者</option>
            <option value="unassigned">未割り当て</option>
            {members.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.display_name || m.email}</option>
            ))}
          </select>
        )}
        {allTags.length > 0 && (
          <select
            value={filters.tag}
            onChange={(e) => onFilterChange({ ...filters, tag: e.target.value })}
            className={selectClass}
          >
            <option value="">全タグ</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <select
          value={filters.follow_up_filter}
          onChange={(e) => onFilterChange({ ...filters, follow_up_filter: e.target.value })}
          className={`border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
            filters.follow_up_filter === "overdue"
              ? "border-red-400 bg-red-50 text-red-700"
              : filters.follow_up_filter
              ? "border-amber-400 bg-amber-50 text-amber-700"
              : "border-slate-300"
          }`}
        >
          <option value="">フォローアップ</option>
          <option value="overdue">⚠ 期限超過</option>
          <option value="today">今日が期限</option>
          <option value="week">7日以内</option>
        </select>
      </div>
    </div>
  );
}
