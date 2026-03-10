import { useEffect, useRef, useState } from "react";
import { LifeBuoy, Loader2, Send, AlertCircle, Shield, User as UserIcon, ChevronLeft, XCircle, CheckCircle2, InboxIcon } from "lucide-react";
import { api } from "../api";

type Message = {
  id: number;
  is_staff: boolean;
  sender_name: string;
  body: string;
  created_at: string;
};

type Ticket = {
  id: number;
  ticket_number: string;
  subject: string;
  category_label: string;
  priority: string;
  priority_label: string;
  status: string;
  status_label: string;
  user_email: string;
  user_name: string;
  message_count: number;
  messages?: Message[];
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

const STATUSES = [
  { value: "open", label: "受付中" },
  { value: "in_progress", label: "対応中" },
  { value: "resolved", label: "解決済み" },
  { value: "closed", label: "クローズ" },
];

const STATUS_FILTERS = [
  { value: "", label: "すべて" },
  { value: "open", label: "受付中" },
  { value: "in_progress", label: "対応中" },
  { value: "resolved", label: "解決済み" },
  { value: "closed", label: "クローズ" },
];

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ja-JP", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadTickets = async (status = statusFilter) => {
    setLoading(true);
    try {
      const data = await api.adminSupport.list(status);
      setTickets(data);
    } finally {
      setLoading(false);
    }
  };

  const loadTicket = async (id: number) => {
    setLoadingDetail(true);
    try {
      const data = await api.adminSupport.get(id);
      setSelected(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => { loadTickets(); }, []);

  useEffect(() => {
    if (selected) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [selected?.messages]);

  const handleFilterChange = (s: string) => {
    setStatusFilter(s);
    loadTickets(s);
  };

  const selectTicket = (t: Ticket) => {
    setSelected(null);
    setReply("");
    loadTicket(t.id);
  };

  const handleStatusChange = async (status: string) => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      await api.adminSupport.updateStatus(selected.id, status);
      await loadTicket(selected.id);
      loadTickets();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    setError("");
    try {
      await api.adminSupport.addMessage(selected.id, reply.trim());
      setReply("");
      await loadTicket(selected.id);
      loadTickets();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendReply();
    }
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-80px)] -mt-4 -mx-4 overflow-hidden">
      {/* 左: チケット一覧 */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <LifeBuoy size={16} className="text-blue-600" />
            <h1 className="text-sm font-bold text-slate-900">サポートチケット</h1>
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <InboxIcon size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs">チケットがありません</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => selectTicket(t)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected?.id === t.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-mono text-slate-400">{t.ticket_number}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || ""}`}>
                        {t.status_label}
                      </span>
                      {t.priority === "urgent" && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-600">緊急</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{t.user_email}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{fmtDate(t.updated_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 右: チケット詳細 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {!selected && !loadingDetail ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <LifeBuoy size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm">チケットを選択してください</p>
            </div>
          </div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : selected ? (
          <>
            {/* ヘッダー */}
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs font-mono text-slate-400">{selected.ticket_number}</span>
                  <span className="text-xs text-slate-400">{selected.category_label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[selected.priority] || ""}`}>
                    {selected.priority_label}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 truncate">{selected.subject}</p>
                <p className="text-xs text-slate-400">{selected.user_email} · {fmtDate(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={selected.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className={`text-xs border rounded-lg px-2 py-1.5 font-medium bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${STATUS_COLORS[selected.status] || ""}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* メッセージ */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.is_staff ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ${msg.is_staff ? "bg-blue-600" : "bg-slate-400"}`}>
                    {msg.is_staff ? <Shield size={14} /> : <UserIcon size={14} />}
                  </div>
                  <div className={`max-w-[75%] ${msg.is_staff ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">{msg.sender_name}</span>
                      <span className="text-xs text-slate-400">{fmtDate(msg.created_at)}</span>
                    </div>
                    <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line leading-relaxed ${
                      msg.is_staff
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                    }`}>
                      {msg.body}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* 返信欄 */}
            {selected.status !== "closed" && (
              <div className="bg-white border-t border-slate-200 p-4">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  placeholder="返信を入力してください（Ctrl+Enter で送信）"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {error && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                    <AlertCircle size={12} />
                    {error}
                  </p>
                )}
                <div className="flex justify-end mt-2">
                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                  >
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    返信 (スタッフ)
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
