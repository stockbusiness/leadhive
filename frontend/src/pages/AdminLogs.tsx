import { useEffect, useState } from "react";
import { ScrollText, Search, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { api } from "../api";

type LogEntry = {
  id: number;
  action: string;
  actor_email: string;
  actor_org: string;
  target: string;
  detail: string;
  created_at: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_role_change: { label: "ロール変更", color: "bg-blue-100 text-blue-700" },
  user_delete: { label: "ユーザー削除", color: "bg-red-100 text-red-700" },
  tenant_plan_change: { label: "プラン変更", color: "bg-purple-100 text-purple-700" },
  announcement_create: { label: "お知らせ作成", color: "bg-green-100 text-green-700" },
  announcement_delete: { label: "お知らせ削除", color: "bg-orange-100 text-orange-700" },
};

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] || { label: action, color: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>{meta.label}</span>;
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.adminLogs.list({ page, limit, search, action: actionFilter });
      setLogs(r.logs);
      setTotal(r.total);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search, actionFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ScrollText size={24} className="text-blue-600" />
            システムログ
          </h1>
          <p className="text-sm text-slate-500 mt-1">管理者操作の監査ログを確認します</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          <RefreshCw size={14} />更新
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="メール・対象・詳細で検索"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全操作</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="text-sm text-slate-500 mb-3">合計 <strong className="text-slate-700">{total}</strong> 件</div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">日時</div>
          <div className="col-span-2">操作</div>
          <div className="col-span-3">実行者</div>
          <div className="col-span-2">対象</div>
          <div className="col-span-3">詳細</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">ログがありません</div>
        ) : (
          logs.map(l => (
            <div key={l.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 last:border-0 items-start hover:bg-slate-50 transition-colors text-sm">
              <div className="col-span-2 text-xs text-slate-400 whitespace-nowrap">
                {new Date(l.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="col-span-2"><ActionBadge action={l.action} /></div>
              <div className="col-span-3 text-slate-600 text-xs truncate">{l.actor_email || "—"}</div>
              <div className="col-span-2 text-slate-600 text-xs truncate">{l.target || "—"}</div>
              <div className="col-span-3 text-slate-500 text-xs">{l.detail || "—"}</div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 text-slate-400 hover:text-slate-700 disabled:opacity-40">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-slate-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 text-slate-400 hover:text-slate-700 disabled:opacity-40">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
