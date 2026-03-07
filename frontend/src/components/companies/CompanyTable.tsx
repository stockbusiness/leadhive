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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
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
