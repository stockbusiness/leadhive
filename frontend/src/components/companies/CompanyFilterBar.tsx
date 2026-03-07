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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="会社名・URL検索..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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
        {members.length > 0 && (
          <select
            value={filters.assignee_id}
            onChange={(e) => onFilterChange({ ...filters, assignee_id: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全タグ</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
