import { useNavigate } from "react-router-dom";
import { ExternalLink, MessageSquare, Pencil, Trash2, RotateCw, CalendarClock, Phone } from "lucide-react";

/** 電話番号を Zoom Phone URLに変換 (日本番号: 0X → +81X) */
function toZoomPhoneUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  const e164 = digits.startsWith("0") ? "+81" + digits.slice(1) : "+" + digits;
  return `zoomus://phone?action=dial&phoneNumber=${encodeURIComponent(e164)}`;
}
import { STATUSES } from "../../constants";
import { ScoreBadge, FlagBadge } from "../common";
import type { Company } from "../../types";

const CMS_COLORS: Record<string, string> = {
  Shopify: "bg-green-100 text-green-700",
  WooCommerce: "bg-purple-100 text-purple-700",
  BASE: "bg-orange-100 text-orange-700",
  STORES: "bg-pink-100 text-pink-700",
  MakeShop: "bg-blue-100 text-blue-700",
  futureshop: "bg-sky-100 text-sky-700",
  "カラーミー": "bg-rose-100 text-rose-700",
  "EC-CUBE": "bg-amber-100 text-amber-700",
  "ロリポップEC": "bg-lime-100 text-lime-700",
  aishipR: "bg-teal-100 text-teal-700",
  "ショップサーブ": "bg-indigo-100 text-indigo-700",
  "カート365": "bg-violet-100 text-violet-700",
  "Yahoo!ショッピング": "bg-red-100 text-red-700",
  WordPress: "bg-blue-100 text-blue-700",
  Wix: "bg-gray-100 text-gray-600",
};

function CmsBadge({ cms }: { cms: string }) {
  const color = CMS_COLORS[cms] || "bg-gray-100 text-gray-600";
  const isEC = Object.keys(CMS_COLORS).slice(0, 13).includes(cms);
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      {isEC ? "🛒" : "🌐"} {cms}
    </span>
  );
}

const WS_CONFIG: Record<string, { icon: string; label: string; cls: string }> = {
  active:             { icon: "✅", label: "稼働中",   cls: "bg-green-100 text-green-700" },
  dead:               { icon: "💀", label: "応答なし", cls: "bg-red-100 text-red-700" },
  closed:             { icon: "🔒", label: "閉鎖",     cls: "bg-red-100 text-red-800" },
  parking:            { icon: "🅿️", label: "駐車",     cls: "bg-amber-100 text-amber-700" },
  under_construction: { icon: "🚧", label: "工事中",   cls: "bg-yellow-100 text-yellow-700" },
  redirect_external:  { icon: "↪️", label: "外部転送", cls: "bg-gray-100 text-gray-600" },
};

function WebsiteStatusBadge({ status }: { status?: string | null }) {
  if (!status || status === "active") return null;
  const cfg = WS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls} border-current/20`}
      title={`サイト状態: ${cfg.label}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

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
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-zinc-500">
            <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-600 dark:text-zinc-400 mb-1">企業データがありません</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs mx-auto leading-relaxed">
            「URL収集」でキーワードから企業を自動収集するか、CSVでインポートしてください
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <a href="/scraper" className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
            URL収集を開始
          </a>
          <span className="text-xs text-gray-400 dark:text-zinc-500">または</span>
          <span className="text-xs text-gray-500 dark:text-zinc-400">CSVインポートボタンを使用</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100 dark:divide-zinc-800">
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
                    className="mt-1 flex-shrink-0 rounded border-gray-200 text-blue-600 focus:ring-blue-500"
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
                        className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:underline mt-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {c.domain} <ExternalLink size={10} />
                      </a>
                    )}
                    {c.category_main && (
                      <span className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 block">{c.category_main}</span>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.ec_flag && <FlagBadge label="🛒 ECサイト" color="bg-blue-100 text-blue-700" />}
                      {c.ec_scale === "large" && <FlagBadge label="規模:大" color="bg-indigo-100 text-indigo-700" />}
                      {c.ec_scale === "medium" && <FlagBadge label="規模:中" color="bg-teal-100 text-teal-700" />}
                      {c.ec_scale === "small" && <FlagBadge label="規模:小" color="bg-gray-100 text-gray-600" />}
                      {c.cms_type ? (
                        <CmsBadge cms={c.cms_type} />
                      ) : (
                        <>
                          {c.shopify_flag && <FlagBadge label="🛒 Shopify" color="bg-green-100 text-green-700" />}
                          {c.base_flag && <FlagBadge label="🛒 BASE" color="bg-orange-100 text-orange-700" />}
                          {c.makeshop_flag && <FlagBadge label="🛒 MakeShop" color="bg-blue-100 text-blue-700" />}
                          {c.futureshop_flag && <FlagBadge label="🛒 futureshop" color="bg-sky-100 text-sky-700" />}
                          {c.stores_flag && <FlagBadge label="🛒 STORES" color="bg-pink-100 text-pink-700" />}
                        </>
                      )}
                      {c.amazon_flag && <FlagBadge label="Amazon" color="bg-orange-100 text-orange-700" />}
                      {c.rakuten_flag && <FlagBadge label="楽天" color="bg-red-100 text-red-700" />}
                      {c.tags && c.tags.map((tag) => (
                        <span key={tag} className="inline-block bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px]">
                          {tag}
                        </span>
                      ))}
                      <WebsiteStatusBadge status={(c as any).website_status} />
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
                  className="text-xs border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1 min-w-0 bg-white"
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
            <tr className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="rounded border-gray-200 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">会社名</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">カテゴリ</th>
              <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">スコア</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">所在地</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">問い合わせ</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">担当者</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">ステータス</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">メモ</th>
              <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-zinc-400">操作</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const isOverdue = c.follow_up_date && new Date(c.follow_up_date) < new Date(new Date().toDateString());
              return (
                <tr key={c.id} className={`border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/30 ${selectedIds.has(c.id) ? "bg-blue-50" : isOverdue ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => handleSelectOne(c.id)}
                      className="rounded border-gray-200 text-blue-600 focus:ring-blue-500"
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
                      className="text-xs text-gray-400 dark:text-zinc-500 hover:underline flex items-center gap-1"
                      onClick={e => e.stopPropagation()}
                    >
                      {c.domain} <ExternalLink size={10} />
                    </a>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.ec_flag && <FlagBadge label="🛒 ECサイト" color="bg-blue-100 text-blue-700" />}
                      {c.ec_scale === "large" && <FlagBadge label="規模:大" color="bg-indigo-100 text-indigo-700" />}
                      {c.ec_scale === "medium" && <FlagBadge label="規模:中" color="bg-teal-100 text-teal-700" />}
                      {c.ec_scale === "small" && <FlagBadge label="規模:小" color="bg-gray-100 text-gray-600" />}
                      {c.cms_type ? (
                        <CmsBadge cms={c.cms_type} />
                      ) : (
                        <>
                          {c.shopify_flag && <FlagBadge label="🛒 Shopify" color="bg-green-100 text-green-700" />}
                          {c.base_flag && <FlagBadge label="🛒 BASE" color="bg-orange-100 text-orange-700" />}
                          {c.makeshop_flag && <FlagBadge label="🛒 MakeShop" color="bg-blue-100 text-blue-700" />}
                          {c.futureshop_flag && <FlagBadge label="🛒 futureshop" color="bg-sky-100 text-sky-700" />}
                          {c.stores_flag && <FlagBadge label="🛒 STORES" color="bg-pink-100 text-pink-700" />}
                        </>
                      )}
                      {c.amazon_flag && <FlagBadge label="Amazon" color="bg-orange-100 text-orange-700" />}
                      {c.rakuten_flag && <FlagBadge label="楽天" color="bg-red-100 text-red-700" />}
                      {c.tags && c.tags.map((tag) => (
                        <span key={tag} className="inline-block bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px] leading-tight">
                          {tag}
                        </span>
                      ))}
                      <WebsiteStatusBadge status={(c as any).website_status} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">{c.category_main}</td>
                  <td className="px-3 py-2 text-center">
                    <ScoreBadge score={c.score_total} rank={c.score_rank} />
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-zinc-400 text-xs">
                    {c.prefecture}{c.city}
                    {c.phone && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-gray-400 dark:text-zinc-500">{c.phone}</span>
                        <a
                          href={toZoomPhoneUrl(c.phone)}
                          title="Zoom Phoneで発信"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors flex-shrink-0"
                        >
                          <Phone size={10} />
                          Zoom
                        </a>
                      </div>
                    )}
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
                      <span className="text-xs text-gray-400 dark:text-zinc-500">なし</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.assignee ? (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        {c.assignee.display_name || c.assignee.email}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={c.status}
                      onChange={(e) => onStatusChange(c.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {c.follow_up_date && <FollowUpBadge date={c.follow_up_date} />}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 max-w-[120px] truncate block">
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
                <td colSpan={10} className="px-3 py-8 text-center text-gray-400 dark:text-zinc-500">
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
