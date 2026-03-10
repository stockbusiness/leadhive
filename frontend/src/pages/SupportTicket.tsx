import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Send, Loader2, AlertCircle, Shield, User as UserIcon, CheckCircle2, XCircle } from "lucide-react";
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
  messages: Message[];
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ja-JP", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SupportTicket() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const data = await api.support.get(Number(id));
      setTicket(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const sendReply = async () => {
    if (!reply.trim() || !ticket) return;
    setSending(true);
    setError("");
    try {
      await api.support.addMessage(ticket.id, reply.trim());
      setReply("");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!ticket || !window.confirm("このチケットをクローズしますか？")) return;
    setClosing(true);
    try {
      await api.support.close(ticket.id);
      await load();
    } finally {
      setClosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendReply();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 text-slate-400">
        <AlertCircle size={32} className="mx-auto mb-2" />
        <p>チケットが見つかりません</p>
        <Link to="/support" className="text-blue-600 text-sm mt-2 block">一覧に戻る</Link>
      </div>
    );
  }

  const isClosed = ticket.status === "closed";

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-12">
      {/* ヘッダー */}
      <div className="flex items-start gap-3">
        <Link to="/support" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mt-1 transition-colors flex-shrink-0">
          <ChevronLeft size={15} />
          一覧
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-slate-400">{ticket.ticket_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status] || "bg-slate-100 text-slate-500"}`}>
              {ticket.status_label}
            </span>
            <span className="text-xs text-slate-400">{ticket.category_label}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">{ticket.subject}</h1>
          <p className="text-xs text-slate-400 mt-0.5">作成: {fmtDate(ticket.created_at)}</p>
        </div>
        {!isClosed && (
          <button
            onClick={closeTicket}
            disabled={closing}
            className="flex items-center gap-1.5 text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:border-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          >
            {closing ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            クローズ
          </button>
        )}
      </div>

      {/* メッセージスレッド */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {ticket.messages.map((msg) => (
            <div key={msg.id} className={`p-5 ${msg.is_staff ? "bg-blue-50" : ""}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 ${msg.is_staff ? "bg-blue-600" : "bg-slate-400"}`}>
                  {msg.is_staff ? <Shield size={13} /> : <UserIcon size={13} />}
                </div>
                <span className={`text-sm font-semibold ${msg.is_staff ? "text-blue-700" : "text-slate-700"}`}>
                  {msg.sender_name}
                  {msg.is_staff && <span className="ml-1.5 text-xs font-normal bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">サポートチーム</span>}
                </span>
                <span className="text-xs text-slate-400 ml-auto">{fmtDate(msg.created_at)}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed ml-9">{msg.body}</p>
            </div>
          ))}
        </div>

        {ticket.status === "resolved" && (
          <div className="flex items-center gap-2 px-5 py-3 bg-emerald-50 border-t border-emerald-100 text-sm text-emerald-700">
            <CheckCircle2 size={15} />
            このチケットは解決済みです。問題が続く場合はメッセージを送信してください。
          </div>
        )}
        {isClosed && (
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
            <XCircle size={15} />
            このチケットはクローズされています。
          </div>
        )}
      </div>

      {/* 返信欄 */}
      {!isClosed && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="返信を入力してください（Ctrl+Enter で送信）"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              返信する
            </button>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
