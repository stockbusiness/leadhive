import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LifeBuoy, Plus, ChevronRight, Loader2, X, Send, AlertCircle,
  CheckCircle2, Clock, AlertTriangle, InboxIcon
} from "lucide-react";
import { api } from "../api";

type Ticket = {
  id: number;
  ticket_number: string;
  subject: string;
  category: string;
  category_label: string;
  priority: string;
  priority_label: string;
  status: string;
  status_label: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-500",
  normal: "bg-blue-50 text-blue-600",
  urgent: "bg-red-100 text-red-600",
};

const CATEGORIES = [
  { value: "technical", label: "技術的な問題" },
  { value: "billing", label: "請求・プランについて" },
  { value: "general", label: "一般的なご質問" },
  { value: "other", label: "その他" },
];

const PRIORITIES = [
  { value: "low", label: "低" },
  { value: "normal", label: "通常" },
  { value: "urgent", label: "緊急" },
];

const STATUS_FILTERS = [
  { value: "", label: "すべて" },
  { value: "open", label: "受付中" },
  { value: "in_progress", label: "対応中" },
  { value: "resolved", label: "解決済み" },
  { value: "closed", label: "クローズ" },
];

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Support() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({ subject: "", category: "general", priority: "normal", message: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = async (status = statusFilter) => {
    setLoading(true);
    try {
      const data = await api.support.list(status);
      setTickets(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFilterChange = (s: string) => {
    setStatusFilter(s);
    load(s);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const ticket = await api.support.create(form);
      setShowCreate(false);
      setForm({ subject: "", category: "general", priority: "normal", message: "" });
      navigate(`/support/${ticket.id}`);
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || "送信に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl">
            <LifeBuoy size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">サポート</h1>
            <p className="text-sm text-slate-500">問題の報告・質問・ご要望</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          新規チケット
        </button>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* チケット一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <InboxIcon size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">チケットがありません</p>
            <p className="text-xs mt-1">「新規チケット」から問い合わせを作成してください</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/support/${t.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{t.ticket_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || "bg-slate-100 text-slate-500"}`}>
                        {t.status_label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] || ""}`}>
                        {t.priority_label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.category_label} · {t.message_count}件のメッセージ · {fmtDate(t.updated_at)}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-slate-400 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 新規作成モーダル */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">新規サポートチケット</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  カテゴリ <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  優先度
                </label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        form.priority === p.value
                          ? p.value === "urgent"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-blue-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  件名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="問題や質問の概要を入力してください"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  詳細 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5}
                  placeholder="問題の詳細、再現手順、エラーメッセージなどをご記入ください"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {createError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={14} />
                  {createError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.subject.trim() || !form.message.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  送信
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
