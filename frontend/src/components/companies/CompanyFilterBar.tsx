import { useState, useEffect } from "react";
import { CATEGORIES, STATUSES, RANKS } from "../../constants";
import { useDebounce } from "../../hooks/useDebounce";
import { api } from "../../api";
import { useProject } from "../../contexts/ProjectContext";

interface Filters {
  category: string;
  status: string;
  score_rank: string;
  has_contact: string;
  search: string;
  tag: string;
  assignee_id: string;
  follow_up_filter: string;
  cms_type: string;
  ec_only: string;
}

const CMS_COLORS: Record<string, string> = {
  Shopify: "bg-green-100 text-green-800 border-green-300 hover:bg-green-200",
  WooCommerce: "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200",
  BASE: "bg-pink-100 text-pink-800 border-pink-300 hover:bg-pink-200",
  STORES: "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200",
  MakeShop: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200",
  futureshop: "bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200",
  "カラーミー": "bg-red-100 text-red-800 border-red-300 hover:bg-red-200",
  "EC-CUBE": "bg-cyan-100 text-cyan-800 border-cyan-300 hover:bg-cyan-200",
  WordPress: "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200",
  Wix: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200",
};

const DEFAULT_BADGE_COLOR = "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200";

export default function CompanyFilterBar({
  filters,
  onFilterChange,
}: {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}) {
  const { currentProject } = useProject();
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: number; email: string; display_name: string }[]>([]);
  const [cmsSummary, setCmsSummary] = useState<Record<string, number>>({});
  const [ecCount, setEcCount] = useState<number>(0);

  useEffect(() => {
    api.companies.getAllTags().then((data) => setAllTags(data.tags));
    api.users.list().then((data) => setMembers(data.users.map(u => ({ id: u.id, email: u.email, display_name: u.display_name }))));
  }, []);

  useEffect(() => {
    api.dashboard.get(currentProject?.id).then((data) => {
      if (data.by_cms_type) setCmsSummary(data.by_cms_type);
      if (typeof data.ec_count === "number") setEcCount(data.ec_count);
    }).catch(() => {});
  }, [currentProject?.id]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const selectClass = "border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const [showAllCms, setShowAllCms] = useState(false);

  const TOP_CMS_COUNT = 5;

  const sortedCmsEntries = Object.entries(cmsSummary)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  const hiddenCmsEntries = sortedCmsEntries.slice(TOP_CMS_COUNT);
  const hiddenCount = hiddenCmsEntries.length;
  const hiddenTotal = hiddenCmsEntries.reduce((sum, [, count]) => sum + count, 0);

  useEffect(() => {
    if (filters.cms_type && hiddenCmsEntries.some(([cms]) => cms === filters.cms_type)) {
      setShowAllCms(true);
    }
  }, [filters.cms_type, hiddenCmsEntries.map(([cms]) => cms).join(",")]);

  const visibleCmsEntries = showAllCms ? sortedCmsEntries : sortedCmsEntries.slice(0, TOP_CMS_COUNT);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 space-y-2">
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
        <select
          value={filters.cms_type}
          onChange={(e) => onFilterChange({ ...filters, cms_type: e.target.value })}
          className={`border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
            filters.cms_type ? "border-purple-400 bg-purple-50 text-purple-700" : "border-slate-300"
          }`}
        >
          <option value="">全CMS/プラットフォーム</option>
          <option value="EC_PLATFORMS">🛒 ECプラットフォーム全般</option>
          <optgroup label="ECカート">
            <option value="Shopify">Shopify</option>
            <option value="WooCommerce">WooCommerce</option>
            <option value="BASE">BASE</option>
            <option value="STORES">STORES</option>
            <option value="MakeShop">MakeShop</option>
            <option value="futureshop">futureshop</option>
            <option value="カラーミー">カラーミー</option>
            <option value="EC-CUBE">EC-CUBE</option>
            <option value="ロリポップEC">ロリポップEC</option>
            <option value="aishipR">aishipR</option>
            <option value="ショップサーブ">ショップサーブ</option>
            <option value="カート365">カート365</option>
          </optgroup>
          <optgroup label="CMS">
            <option value="WordPress">WordPress</option>
            <option value="Wix">Wix</option>
            <option value="Squarespace">Squarespace</option>
            <option value="Jimdo">Jimdo</option>
          </optgroup>
        </select>
        <select
          value={filters.ec_only}
          onChange={(e) => onFilterChange({ ...filters, ec_only: e.target.value })}
          className={`border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
            filters.ec_only ? "border-orange-400 bg-orange-50 text-orange-700" : "border-slate-300"
          }`}
        >
          <option value="">EC判定</option>
          <option value="true">🛍️ EC企業のみ</option>
        </select>
      </div>

      {(sortedCmsEntries.length > 0 || ecCount > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          {ecCount > 0 && (
            <button
              onClick={() => onFilterChange({ ...filters, ec_only: filters.ec_only === "true" ? "" : "true", cms_type: "" })}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.ec_only === "true"
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
              }`}
            >
              🛍️ ECサイト: <span className="font-bold">{ecCount.toLocaleString()}社</span>
            </button>
          )}
          {visibleCmsEntries.map(([cms, count]) => (
            <button
              key={cms}
              onClick={() => onFilterChange({ ...filters, cms_type: filters.cms_type === cms ? "" : cms, ec_only: "" })}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.cms_type === cms
                  ? "bg-slate-700 text-white border-slate-700"
                  : (CMS_COLORS[cms] ?? DEFAULT_BADGE_COLOR)
              }`}
            >
              {cms}: <span className="font-bold">{count.toLocaleString()}社</span>
            </button>
          ))}
          {!showAllCms && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllCms(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100"
            >
              その他 {hiddenCount}件 ({hiddenTotal.toLocaleString()}社) ▼
            </button>
          )}
          {showAllCms && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllCms(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
            >
              折りたたむ ▲
            </button>
          )}
        </div>
      )}
    </div>
  );
}
