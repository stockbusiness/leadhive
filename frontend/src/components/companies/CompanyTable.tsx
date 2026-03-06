import { ExternalLink, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { STATUSES } from "../../constants";
import { ScoreBadge, FlagBadge } from "../common";
import type { Company } from "../../types";

export default function CompanyTable({
  companies,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  companies: Company[];
  onStatusChange: (id: number, status: string) => void;
  onEdit: (company: Company) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2 font-medium text-slate-600">会社名</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">カテゴリ</th>
            <th className="text-center px-3 py-2 font-medium text-slate-600">スコア</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">所在地</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">問い合わせ</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">ステータス</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">メモ</th>
            <th className="text-center px-3 py-2 font-medium text-slate-600">操作</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800">{c.company_name || c.domain}</div>
                <a
                  href={c.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                >
                  {c.domain} <ExternalLink size={10} />
                </a>
                <div className="flex gap-1 mt-1">
                  {c.shopify_flag && <FlagBadge label="Shopify" color="bg-green-100 text-green-700" />}
                  {c.amazon_flag && <FlagBadge label="Amazon" color="bg-orange-100 text-orange-700" />}
                  {c.rakuten_flag && <FlagBadge label="楽天" color="bg-red-100 text-red-700" />}
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
                <select
                  value={c.status}
                  onChange={(e) => onStatusChange(c.id, e.target.value)}
                  className="text-xs border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <span className="text-xs text-slate-500 max-w-[120px] truncate block">
                  {c.notes || "-"}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => onEdit(c)} className="text-blue-500 hover:text-blue-700 p-1" title="詳細編集">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDelete(c.id)} className="text-red-400 hover:text-red-600 p-1" title="削除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                企業データがありません。「URL収集」から企業を追加してください。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
