import { useNavigate } from "react-router-dom";
import { ExternalLink, MessageSquare, Pencil, Trash2, RotateCw, CalendarClock } from "lucide-react";
import { STATUSES } from "../../constants";
import { ScoreBadge, FlagBadge } from "../common";
import type { Company } from "../../types";

export default function CompanyTable({
  companies,
  selectedIds,
  onSelectionChange,
  onStatusChange,
  onEdit,
  onDelete,
  onRescrape,
}: {
  companies: Company[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  onStatusChange: (id: number, status: string) => void;
  onEdit: (company: Company) => void;
  onDelete: (id: number) => void;
  onRescrape: (id: number) => void;
}) {
  const navigate = useNavigate();
  const allSelected = companies.length > 0 && companies.every((c) => selectedIds.has(c.id));

  const handleSelectAll = () => {
    if (allSelected) {
      const newSet = new Set(selectedIds);
      companies.forEach((c) => newSet.delete(c.id));
      onSelectionChange(newSet);
    } else {
      const newSet = new Set(selectedIds);
      companies.forEach((c) => newSet.add(c.id));
      onSelectionChange(newSet);
    }
  };

  const handleSelectOne = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const empty = (
    <div className="px-4 py-14 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600 mb-1">企業データがありません</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            「URL収集」でキーワードから企業を自動収集するか、CSVでインポートしてください
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <a href="/scraper" className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
            URL収集を開始
          </a>
          <span className="text-xs text-slate-400">または</span>
          <span className="text-xs text-slate-500">CSVインポートボタンを使用</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-slate-100">
        {companies.length === 0 && empty}
        {companies.map((c) => {
          const isOverdue = c.follow_up_date && new Date(c.follow_up_date) < new Date(new Date().toDateString());
          return (
            <div
              key={c.id}
              className={`px-3 py-3 ${isOverdue ? "bg-red-50" : selectedIds.has(c.id) ? "bg-blue-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => handleSelectOne(c.id)}
                    className="mt-1 flex-shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0">
                    <button
                      onClick={() => navigate(`/companies/${c.id}`)}
                      className="font-semibold text-blue-600 hover:underline text-left text-sm leading-snug"
                    >
                      {c.company_name || c.domain}
                    </button>
                    {c.website_url && (
                      <a
                        href={c.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-slate-400 hover:underline mt-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {c.domain} <ExternalLink size={10} />
                      </a>
                    )}
                    {c.category_main && (
                      <span className="text-xs text-slate-500 mt-0.5 block">{c.category_main}</span>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.shopify_flag && <FlagBadge label="Shopify" color="bg-green-100 text-green-700" />}
                      {c.amazon_flag && <FlagBadge label="Amazon" color="bg-orange-100 text-orange-700" />}
                      {c.rakuten_flag && <FlagBadge label="楽天" color="bg-red-100 text-red-700" />}
                      {c.tags && c.tags.map((tag) => (
                        <span key={tag} className="inline-block bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ScoreBadge score={c.score_total} rank={c.score_rank} />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 pl-6">
                <select
                  value={c.status}
                  onChange={(e) => onStatusChange(c.id, e.target.value)}
                  className="text-xs border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1 min-w-0 bg-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => onRescrape(c.id)} className="text-amber-500 hover:text-amber-700 p-1.5" title="再スクレイピング">
                    <RotateCw size={15} />
                  </button>
                  <button onClick={() => onEdit(c)} className="text-blue-500 hover:text-blue-700 p-1.5" title="編集">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => onDelete(c.id)} className="text-red-400 hover:text-red-600 p-1.5" title="削除">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {c.follow_up_date && (
                <div className="pl-6 mt-1.5">
                  <FollowUpBadge date={c.follow_up_date} />
                </div>
              )}

              {c.contact_url && (
                <div className="pl-6 mt-1.5">
                  <a
                    href={c.contact_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded"
                  >
                    <MessageSquare size={11} />
                    問い合わせ
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">会社名</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">カテゴリ</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">スコア</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">所在地</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">問い合わせ</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">担当者</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">ステータス</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">メモ</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const isOverdue = c.follow_up_date && new Date(c.follow_up_date) < new Date(new Date().toDateString());
              return (
                <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 ${selectedIds.has(c.id) ? "bg-blue-50" : isOverdue ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => handleSelectOne(c.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => navigate(`/companies/${c.id}`)}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left leading-snug"
                    >
                      {c.company_name || c.domain}
                    </button>
                    <a
                      href={c.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:underline flex items-center gap-1"
                      onClick={e => e.stopPropagation()}
                    >
                      {c.domain} <ExternalLink size={10} />
                    </a>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.shopify_flag && <FlagBadge label="Shopify" color="bg-green-100 text-green-700" />}
                      {c.amazon_flag && <FlagBadge label="Amazon" color="bg-orange-100 text-orange-700" />}
                      {c.rakuten_flag && <FlagBadge label="楽天" color="bg-red-100 text-red-700" />}
                      {c.tags && c.tags.map((tag) => (
                        <span key={tag} className="inline-block bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px] leading-tight">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.category_main}</td>
                  <td className="px-3 py-2 text-center">
                    <ScoreBadge score={c.score_total} rank={c.score_rank} />
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">
                    {c.prefecture}{c.city}
                    {c.phone && <div className="text-slate-400">{c.phone}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {c.contact_url ? (
                      <a
                        href={c.contact_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                      >
                        <MessageSquare size={12} />
                        問い合わせ
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">なし</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.assignee ? (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        {c.assignee.display_name || c.assignee.email}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={c.status}
                      onChange={(e) => onStatusChange(c.id, e.target.value)}
                      className="text-xs border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {c.follow_up_date && <FollowUpBadge date={c.follow_up_date} />}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-slate-500 max-w-[120px] truncate block">
                      {c.notes || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onRescrape(c.id)} className="text-amber-500 hover:text-amber-700 p-1" title="再スクレイピング">
                        <RotateCw size={14} />
                      </button>
                      <button onClick={() => onEdit(c)} className="text-blue-500 hover:text-blue-700 p-1" title="詳細編集">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => onDelete(c.id)} className="text-red-400 hover:text-red-600 p-1" title="削除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                  企業データがありません。「URL収集」から企業を追加してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FollowUpBadge({ date }: { date: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const overdue = diff < 0;
  const isToday = diff === 0;
  const label = overdue
    ? `${Math.abs(diff)}日超過`
    : isToday
    ? "今日"
    : `${diff}日後`;
  const cls = overdue || isToday
    ? "bg-red-100 text-red-700"
    : "bg-amber-100 text-amber-700";
  return (
    <div className={`flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${cls}`}>
      <CalendarClock size={9} />
      {label}
    </div>
  );
}
