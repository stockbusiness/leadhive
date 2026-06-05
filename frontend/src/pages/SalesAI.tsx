import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot, Sparkles, Send, Edit3, Trash2, Check, X, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Eye, Ban, Info, Search,
  MessageSquare, CheckCircle2, Filter, Mail, Globe, Settings, XCircle,
  BarChart2, TrendingUp, FileText, AlertCircle, Clock, Calendar, Play, Zap,
  ListChecks, Variable, PlusCircle
} from "lucide-react";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";

type TemplateType = "shopify" | "ec_support" | "partner";
type MessageStatus = "draft" | "reviewed" | "sent" | "failed";

interface SalesMessage {
  id: number;
  company_id: number;
  company_name?: string;
  template_type: TemplateType;
  subject: string;
  body: string;
  ai_prompt_id?: string;
  status: MessageStatus;
  reviewed_at?: string;
  sent_at?: string;
  open_count?: number;
  opened_at?: string;
  send_note?: string;
  created_at?: string;
}

interface Company {
  id: number;
  company_name: string;
  score_rank: string;
  score_total: number;
  ec_flag?: boolean;
  ec_score?: number;
  cms_type?: string;
  email?: string;
  prefecture?: string;
  category_main?: string;
  project_id?: number;
  contact_url?: string;
  status?: string;
  domain?: string;
  has_failed_msg?: boolean;
}

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  shopify: "Shopify提案型",
  ec_support: "EC支援提案型",
  partner: "パートナー提案型",
};

const TEMPLATE_DESCRIPTIONS: Record<TemplateType, string> = {
  shopify: "Shopifyへの移行・ECサイト強化を提案",
  ec_support: "EC運営支援・業務改善を提案",
  partner: "業務提携・パートナーシップを提案",
};

const STATUS_LABELS: Record<MessageStatus, string> = {
  draft: "下書き",
  reviewed: "レビュー済",
  sent: "送信済",
  failed: "失敗",
};

const STATUS_COLORS: Record<MessageStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  reviewed: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const RANK_COLORS: Record<string, string> = {
  A: "bg-red-100 text-red-700 border-red-200",
  B: "bg-orange-100 text-orange-700 border-orange-200",
  C: "bg-yellow-100 text-yellow-700 border-yellow-200",
  D: "bg-slate-100 text-slate-600 border-slate-200",
};

const VARIABLES = [
  { label: "{{会社名}}", value: "{{会社名}}", hint: "企業の会社名" },
  { label: "{{担当者名}}", value: "{{担当者名}}", hint: "企業の担当者名" },
  { label: "{{担当者役職}}", value: "{{担当者役職}}", hint: "担当者の役職" },
  { label: "{{都道府県}}", value: "{{都道府県}}", hint: "企業の所在都道府県" },
];

function insertAtCursor(el: HTMLTextAreaElement | HTMLInputElement, text: string): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const newVal = el.value.slice(0, start) + text + el.value.slice(end);
  setTimeout(() => {
    el.selectionStart = el.selectionEnd = start + text.length;
    el.focus();
  }, 0);
  return newVal;
}

function EditModal({ message, onClose, onSave }: {
  message: SalesMessage;
  onClose: () => void;
  onSave: (updated: SalesMessage) => void;
}) {
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.salesAi.updateMessage(message.id, { subject, body });
      onSave(res);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const insertVar = (v: string, target: "body" | "subject") => {
    if (target === "body" && bodyRef.current) {
      setBody(insertAtCursor(bodyRef.current, v));
    } else if (target === "subject" && subjectRef.current) {
      setSubject(insertAtCursor(subjectRef.current, v));
    }
  };

  const applyOpeningNote = () => {
    if (!openingNote.trim()) return;
    setBody(prev => openingNote.trim() + "\n\n" + prev);
    setOpeningNote("");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">営業文を編集</h3>
            <p className="text-xs text-slate-500 mt-0.5">{message.company_name} / {TEMPLATE_LABELS[message.template_type]}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Variable size={12} />
              変数を挿入（クリックでカーソル位置に挿入）
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button
                  key={v.value}
                  onClick={() => insertVar(v.value, "body")}
                  title={`本文に挿入: ${v.hint}`}
                  className="text-xs px-2 py-1 bg-violet-100 text-violet-700 rounded border border-violet-200 hover:bg-violet-200 font-mono transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">※ 送信時に企業ごとの実際の値に自動で置き換わります</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">件名</label>
            <div className="flex gap-2 mb-1.5">
              {VARIABLES.slice(0, 2).map(v => (
                <button
                  key={v.value}
                  onClick={() => insertVar(v.value, "subject")}
                  title={`件名に挿入: ${v.hint}`}
                  className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 hover:bg-slate-200 font-mono transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
            <input
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
              <PlusCircle size={12} />
              冒頭に一言を追加（本文の先頭に挿入）
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={openingNote}
                onChange={e => setOpeningNote(e.target.value)}
                placeholder="例: 先日〇〇の件でお問い合わせいただいた件に関連して…"
                className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyOpeningNote(); } }}
              />
              <button
                onClick={applyOpeningNote}
                disabled={!openingNote.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <PlusCircle size={13} />
                挿入
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">本文</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">{body.length}文字</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">キャンセル</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            保存する（レビュー済みに変更）
          </button>
        </div>
      </div>
    </div>
  );
}

interface SendPreview {
  company_name: string | null;
  email: string;
  contact_url: string;
  opted_out: boolean;
  smtp_configured: boolean;
  can_send_email: boolean;
}

interface FormSenderProfile {
  id: number;
  name: string;
  display_name: string;
  title: string;
  phone: string;
  email: string;
  is_default: boolean;
}

function SendConfirmModal({ message, onClose, onConfirm }: {
  message: SalesMessage;
  onClose: () => void;
  onConfirm: (sendMethod: string, profileId?: number) => Promise<{ send_result?: string; send_detail?: string }>;
}) {
  const [sendMethod, setSendMethod] = useState("email");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<SendPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [formProfiles, setFormProfiles] = useState<FormSenderProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>(undefined);

  useEffect(() => {
    setPreviewLoading(true);
    api.salesAi.getSendPreview(message.id)
      .then(r => { setPreview(r); setPreviewLoading(false); })
      .catch(() => setPreviewLoading(false));
    api.formProfiles.list().then(d => {
      setFormProfiles(d.profiles);
      const def = d.profiles.find((p: FormSenderProfile) => p.is_default);
      if (def) setSelectedProfileId(def.id);
    }).catch(() => {});
  }, [message.id]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await onConfirm(sendMethod, sendMethod === "form" ? selectedProfileId : undefined);
      const ok = res?.send_result === "sent";
      setResult({ ok, detail: res?.send_detail || (ok ? "送信しました" : "送信に失敗しました") });
    } catch (e: any) {
      setResult({ ok: false, detail: e?.response?.data?.detail || "送信に失敗しました" });
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-8 text-center space-y-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${result.ok ? "bg-green-100" : "bg-red-100"}`}>
              {result.ok
                ? <CheckCircle2 size={32} className="text-green-600" />
                : <XCircle size={32} className="text-red-600" />}
            </div>
            <div>
              <h3 className={`text-lg font-bold ${result.ok ? "text-green-700" : "text-red-700"}`}>
                {result.ok ? "送信完了" : "送信失敗"}
              </h3>
              <p className="text-sm text-slate-600 mt-1">{result.detail}</p>
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-5 border-b border-slate-200">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">送信確認</h3>
            <p className="text-sm text-slate-500">この操作は取り消せません</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">宛先企業</p>
              <p className="font-medium text-slate-800 text-sm">{message.company_name}</p>
              <p className="text-xs text-slate-600 mt-1">件名: {message.subject}</p>
            </div>
            {previewLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <RefreshCw size={12} className="animate-spin" /> 宛先情報を確認中...
              </div>
            ) : preview ? (
              <div className="border-t border-slate-200 pt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-slate-400 flex-shrink-0" />
                  {preview.email ? (
                    <span className="text-sm font-mono text-slate-700">{preview.email}</span>
                  ) : (
                    <span className="text-xs text-slate-400">メールアドレス未登録</span>
                  )}
                </div>
                {preview.contact_url && (
                  <div className="flex items-center gap-2">
                    <Globe size={13} className="text-slate-400 flex-shrink-0" />
                    <a href={preview.contact_url} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate">{preview.contact_url}</a>
                  </div>
                )}
                {preview.opted_out && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    <Ban size={12} /> 配信停止リストに登録済み — 送信できません
                  </div>
                )}
                {sendMethod === "email" && !preview.smtp_configured && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                    <Settings size={12} className="mt-0.5 flex-shrink-0" />
                    <span>SMTPが未設定です。設定画面でSMTPを設定すると実際に送信されます。</span>
                  </div>
                )}
                {sendMethod === "email" && preview.smtp_configured && preview.email && !preview.opted_out && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                    <CheckCircle2 size={12} /> SMTP設定済み — 実際にメール送信されます
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">送信方法</label>
            <div className="flex gap-2">
              {[
                { key: "email", label: "メール送信", icon: Mail },
                { key: "form", label: "フォーム (自動)", icon: Globe },
                { key: "manual", label: "その他 (手動記録)", icon: Check },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSendMethod(key)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 text-xs rounded-lg border transition-colors ${sendMethod === key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          {sendMethod === "form" && (
            <div className="space-y-3">
              {formProfiles.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">送信者プロフィール</label>
                  <select
                    value={selectedProfileId ?? ""}
                    onChange={e => setSelectedProfileId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">プロフィールを選択（デフォルト: 自分の設定）</option>
                    {formProfiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.display_name ? ` — ${p.display_name}` : ""}{p.title ? ` / ${p.title}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedProfileId && (() => {
                    const prof = formProfiles.find(p => p.id === selectedProfileId);
                    return prof ? (
                      <p className="text-xs text-slate-500 mt-1">
                        名前: {prof.display_name || "—"} / 役職: {prof.title || "—"} / 電話: {prof.phone || "—"}
                      </p>
                    ) : null;
                  })()}
                  <p className="text-xs text-blue-500 mt-1">
                    プロフィールの管理は <a href="/form-profiles" target="_blank" className="underline">フォーム送信プロフィール設定</a> から
                  </p>
                </div>
              )}
              {formProfiles.length === 0 && (
                <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  送信者プロフィールが未設定です。<a href="/form-profiles" target="_blank" className="text-blue-500 underline">フォーム送信プロフィール設定</a>で登録するか、自分のプロフィール設定が使われます。
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">フォーム自動送信について</p>
                <p>・AIがコンタクトフォームの項目を自動判別して入力・送信します</p>
                {preview?.contact_url
                  ? <p className="text-green-700">・コンタクトURLあり — フォームを検出できる可能性が高いです</p>
                  : <p className="text-amber-700">・コンタクトURLが未登録のため、トップページから自動探索します</p>
                }
                <p className="text-slate-500">※ reCAPTCHA / JavaScript必須フォームは非対応です</p>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            送信記録は監査ログに自動保存されます。特定電子メール法を遵守し、受信者の同意を確認してから送信してください。
          </p>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">キャンセル</button>
          <button
            onClick={handleSend}
            disabled={sending || previewLoading || (preview?.opted_out ?? false)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {sendMethod === "email" && preview?.can_send_email
              ? "メール送信する"
              : sendMethod === "form"
              ? "フォーム自動送信する"
              : "送信済みとして記録"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkReviewModal({ messages, onClose, onSaved, formProfiles }: {
  messages: SalesMessage[];
  onClose: () => void;
  onSaved: () => void;
  formProfiles: FormSenderProfile[];
}) {
  const [rows, setRows] = useState<SalesMessage[]>(messages.map(m => ({ ...m })));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<number | undefined>(
    formProfiles.find(p => p.is_default)?.id
  );
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const updateRow = (id: number, field: "subject" | "body", val: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const saveRow = async (id: number) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    setSaving(id);
    try {
      const res = await api.salesAi.updateMessage(id, { subject: row.subject, body: row.body });
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...res } : r));
      setEditingId(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  const handleBulkFormSend = async () => {
    setSending(true);
    setSendError(null);
    try {
      const res = await api.salesAi.bulkSendForm(profileId, rows.map(r => r.id));
      setSendResult(res);
      onSaved();
    } catch (e: any) {
      setSendError(e?.response?.data?.detail || "一括送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  if (sendResult) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-green-700">一括フォーム送信完了</h3>
          <div className="text-sm text-slate-600 space-y-1">
            <p>送信成功: <span className="font-bold text-green-700">{sendResult.sent}件</span></p>
            {sendResult.skipped > 0 && <p>スキップ（URL無効）: {sendResult.skipped}件</p>}
            {sendResult.failed > 0 && <p className="text-red-600">失敗: {sendResult.failed}件</p>}
          </div>
          <button onClick={onClose} className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">閉じる</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ListChecks size={20} className="text-blue-600" />
              一括レビュー＆フォーム送信
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{rows.length}件 — 各行をクリックして件名・本文を編集できます</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-36">企業名</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">件名</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">本文（冒頭）</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.id} className={`transition-colors ${editingId === row.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-800 truncate max-w-[128px]">{row.company_name || `ID:${row.company_id}`}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[row.status]}`}>{STATUS_LABELS[row.status]}</span>
                  </td>
                  <td className="px-4 py-2">
                    {editingId === row.id ? (
                      <input
                        type="text"
                        value={row.subject}
                        onChange={e => updateRow(row.id, "subject", e.target.value)}
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ) : (
                      <p className="text-xs text-slate-700 truncate max-w-[220px]">{row.subject}</p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === row.id ? (
                      <textarea
                        value={row.body}
                        onChange={e => updateRow(row.id, "body", e.target.value)}
                        rows={4}
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
                      />
                    ) : (
                      <p className="text-xs text-slate-500 line-clamp-2">{row.body}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => saveRow(row.id)}
                          disabled={saving === row.id}
                          className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving === row.id ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                          保存
                        </button>
                        <button
                          onClick={() => { setRows(prev => prev.map(r => r.id === row.id ? { ...messages.find(m => m.id === row.id)! } : r)); setEditingId(null); }}
                          className="text-xs text-slate-500 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingId(row.id)}
                        className="flex items-center gap-1 text-xs border border-slate-300 text-slate-600 px-2 py-1 rounded hover:bg-slate-100"
                      >
                        <Edit3 size={11} />
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-3">
          {sendError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {sendError}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {formProfiles.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 font-medium flex-shrink-0">送信者プロフィール:</label>
                <select
                  value={profileId ?? ""}
                  onChange={e => setProfileId(e.target.value ? Number(e.target.value) : undefined)}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">プロフィール未選択</option>
                  {formProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.display_name ? ` — ${p.display_name}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">キャンセル</button>
              <button
                onClick={handleBulkFormSend}
                disabled={sending || editingId !== null}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {sending ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
                {sending ? "送信中..." : `${rows.length}件をフォーム一括送信`}
              </button>
            </div>
          </div>
          {editingId !== null && (
            <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={12} />編集中の行を先に保存または取消してください</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatsData {
  status_counts: Record<string, number>;
  template_counts: Record<string, number>;
  method_counts: Record<string, number>;
  result_counts: Record<string, number>;
  daily_sends: { date: string; count: number }[];
  opt_out_count: number;
  total_messages: number;
  total_sent: number;
  total_failed: number;
  total_draft: number;
  total_reviewed: number;
}

interface AuditLogEntry {
  id: number;
  company_name: string | null;
  company_id: number;
  send_method: string;
  result: string;
  note: string | null;
  sent_at: string | null;
  message_id: number | null;
}

export default function SalesAI() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState<"generate" | "messages" | "optout" | "stats" | "schedule">("generate");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [templateType, setTemplateType] = useState<TemplateType>("shopify");
  const [customTemplateId, setCustomTemplateId] = useState<number | null>(null);
  const [customTemplates, setCustomTemplates] = useState<{ id: number; title: string; content: string }[]>([]);
  const [analyzeSite, setAnalyzeSite] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genSuccess, setGenSuccess] = useState("");

  const [autoBatching, setAutoBatching] = useState(false);
  const [autoBatchDone, setAutoBatchDone] = useState(0);
  const [autoBatchTotal, setAutoBatchTotal] = useState(0);
  const [autoBatchBatch, setAutoBatchBatch] = useState(0);
  const [autoBatchTotalBatches, setAutoBatchTotalBatches] = useState(0);

  const [fullAutoConfirm, setFullAutoConfirm] = useState(false);
  const [fullAutoPhase, setFullAutoPhase] = useState<"generating" | "sending" | "done" | null>(null);
  const [fullAutoProgress, setFullAutoProgress] = useState({ done: 0, total: 0, batch: 0, totalBatches: 0 });
  const [fullAutoResult, setFullAutoResult] = useState<{ generated: number; sent: number; failed: number } | null>(null);
  const [fullAutoError, setFullAutoError] = useState<string | null>(null);

  const [bgJobId, setBgJobId] = useState<string | null>(null);
  const [bgJobStatus, setBgJobStatus] = useState<any | null>(null);
  const bgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [messages, setMessages] = useState<SalesMessage[]>([]);
  const [messagesTotal, setMessagesTotal] = useState<number>(0);
  const [messagesLimited, setMessagesLimited] = useState<boolean>(false);
  const [msgFilter, setMsgFilter] = useState<string>("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [editTarget, setEditTarget] = useState<SalesMessage | null>(null);
  const [sendTarget, setSendTarget] = useState<SalesMessage | null>(null);

  const [optOutList, setOptOutList] = useState<any[]>([]);
  const [optOutEmail, setOptOutEmail] = useState("");
  const [optOutDomain, setOptOutDomain] = useState("");
  const [optOutReason, setOptOutReason] = useState("");
  const [addingOptOut, setAddingOptOut] = useState(false);

  const [companySearch, setCompanySearch] = useState("");
  const [filterRanks, setFilterRanks] = useState<string[]>([]);
  const [filterEcOnly, setFilterEcOnly] = useState(false);
  const [filterEmailOnly, setFilterEmailOnly] = useState(false);
  const [filterFormOnly, setFilterFormOnly] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterExcludePublic, setFilterExcludePublic] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [scheduleProjects, setScheduleProjects] = useState<{id:number;name:string}[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleHour, setScheduleHour] = useState(8);
  const [scheduleStatuses, setScheduleStatuses] = useState<string[]>(["未確認", "アプローチ前"]);
  const [scheduleMinScore, setScheduleMinScore] = useState(0);
  const [scheduleMaxPerRun, setScheduleMaxPerRun] = useState(10);
  const [scheduleTemplateType, setScheduleTemplateType] = useState<TemplateType>("shopify");
  const [scheduleProjectId, setScheduleProjectId] = useState<number | null>(null);
  const [scheduleLastRunAt, setScheduleLastRunAt] = useState<string | null>(null);
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [openaiKeySaving, setOpenaiKeySaving] = useState(false);
  const [openaiKeyMsg, setOpenaiKeyMsg] = useState<string | null>(null);
  const [openaiKeyMsgType, setOpenaiKeyMsgType] = useState<"success" | "error">("success");
  const [openaiTesting, setOpenaiTesting] = useState(false);
  const [scheduleLastRunCount, setScheduleLastRunCount] = useState(0);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);

  const [skipExisting, setSkipExisting] = useState(false);
  const [bulkSelectCount, setBulkSelectCount] = useState(50);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendResult, setBulkSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [bulkSendConfirm, setBulkSendConfirm] = useState(false);

  const [bulkFormSending, setBulkFormSending] = useState(false);
  const [bulkFormResult, setBulkFormResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);
  const [bulkFormError, setBulkFormError] = useState<string | null>(null);
  const [bulkFormConfirm, setBulkFormConfirm] = useState(false);
  const [bulkFormProfileId, setBulkFormProfileId] = useState<number | undefined>(undefined);
  const [bulkFormProfiles, setBulkFormProfiles] = useState<FormSenderProfile[]>([]);

  const [selectedMsgIds, setSelectedMsgIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [clearingQueue, setClearingQueue] = useState(false);
  const [clearQueueConfirm, setClearQueueConfirm] = useState(false);
  const [scheduleSaveMsg, setScheduleSaveMsg] = useState("");
  const [openingMemo, setOpeningMemo] = useState("");
  const [showBulkReview, setShowBulkReview] = useState(false);

  const startBgPolling = (jobId: string) => {
    if (bgPollRef.current) clearInterval(bgPollRef.current);
    bgPollRef.current = setInterval(async () => {
      try {
        const s = await api.salesAi.getJobStatus(jobId);
        setBgJobStatus(s);
        if (s.status === "done" || s.status === "error" || s.status === "cancelled") {
          clearInterval(bgPollRef.current!);
          bgPollRef.current = null;
          loadMessages();
        }
      } catch {
        clearInterval(bgPollRef.current!);
        bgPollRef.current = null;
      }
    }, 3000);
  };

  const handleCancelBgJob = async () => {
    if (!bgJobId) return;
    try {
      await api.salesAi.cancelJob(bgJobId);
      setBgJobStatus((prev: any) => prev ? { ...prev, status: "cancelling" } : prev);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "キャンセルに失敗しました");
    }
  };

  useEffect(() => {
    api.salesAi.checkApiKey().then(r => setHasApiKey(r.has_api_key)).catch(() => setHasApiKey(false));
    api.templates.list().then(r => {
      const emailTpls = (r.templates || []).filter((t: any) => t.is_email_template);
      setCustomTemplates(emailTpls);
    }).catch(() => {});
    api.formProfiles.list().then(d => {
      setBulkFormProfiles(d.profiles || []);
      const def = (d.profiles || []).find((p: FormSenderProfile) => p.is_default);
      if (def) setBulkFormProfileId(def.id);
    }).catch(() => {});
    api.salesAi.getActiveJobs().then(d => {
      const jobs = d.jobs || [];
      if (jobs.length > 0) {
        const job = jobs[0];
        setBgJobId(job.job_id);
        setBgJobStatus(job);
        startBgPolling(job.job_id);
      }
    }).catch(() => {});
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const params: { project_id?: number; show_all?: boolean } = {};
      if (showAllProjects) {
        params.show_all = true;
      } else if (currentProject) {
        params.project_id = currentProject.id;
      }
      const res = await api.companies.forSalesAi(params);
      setCompanies((res.companies || []) as any);
    } catch {}
  }, [currentProject, showAllProjects]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const res = await api.salesAi.listMessages(msgFilter || undefined);
      setMessages(res.messages || []);
      setMessagesTotal(res.total ?? (res.messages?.length ?? 0));
      setMessagesLimited(res.limited ?? false);
    } catch {} finally {
      setLoadingMessages(false);
    }
  }, [msgFilter]);

  const loadOptOut = useCallback(async () => {
    try {
      const res = await api.salesAi.listOptOut();
      setOptOutList(res.opt_out_list || []);
    } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [statsRes, logsRes] = await Promise.all([
        api.salesAi.getStats(),
        api.salesAi.getAuditLogs(50),
      ]);
      setStats(statsRes);
      setAuditLogs(logsRes.audit_logs || []);
    } catch {} finally {
      setLoadingStats(false);
    }
  }, []);

  const loadScheduleSettings = useCallback(async () => {
    try {
      const res = await api.salesAi.getAutoGenerateSettings();
      setScheduleEnabled(res.enabled);
      setScheduleHour(res.hour);
      setScheduleStatuses(res.statuses || ["未確認", "アプローチ前"]);
      setScheduleMinScore(res.min_score);
      setScheduleMaxPerRun(res.max_per_run);
      setScheduleTemplateType(res.template_type);
      setScheduleProjectId(res.project_id ?? null);
      setScheduleLastRunAt(res.last_run_at ?? null);
      setScheduleLastRunCount(res.last_run_count);
      setScheduleProjects(res.projects || []);
    } catch {}
    try {
      const s = await api.settings.get();
      const ok = s?.settings?.openai_api_key;
      setOpenaiKeySet(ok?.is_set || false);
    } catch {}
  }, []);

  const handleTestOpenaiKey = async () => {
    setOpenaiTesting(true);
    setOpenaiKeyMsg(null);
    try {
      const res = await api.settings.openaiTest(openaiKeyInput || undefined);
      setOpenaiKeyMsgType(res.success ? "success" : "error");
      setOpenaiKeyMsg(res.success ? `✅ ${res.message}` : `❌ ${res.message}`);
    } catch {
      setOpenaiKeyMsgType("error");
      setOpenaiKeyMsg("❌ テストに失敗しました");
    } finally {
      setOpenaiTesting(false);
    }
  };

  const handleSaveOpenaiKey = async () => {
    if (!openaiKeyInput || openaiKeyInput.includes("*")) return;
    setOpenaiKeySaving(true);
    setOpenaiKeyMsg(null);
    try {
      await api.settings.update({ openai_api_key: openaiKeyInput });
      setOpenaiKeySet(true);
      setOpenaiKeyInput("");
      setOpenaiKeyMsgType("success");
      setOpenaiKeyMsg("✅ 保存しました");
    } catch {
      setOpenaiKeyMsgType("error");
      setOpenaiKeyMsg("❌ 保存に失敗しました");
    } finally {
      setOpenaiKeySaving(false);
    }
  };

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { if (activeTab === "messages") loadMessages(); }, [activeTab, loadMessages]);
  useEffect(() => { if (activeTab === "optout") loadOptOut(); }, [activeTab, loadOptOut]);
  useEffect(() => { if (activeTab === "stats") loadStats(); }, [activeTab, loadStats]);
  useEffect(() => { if (activeTab === "schedule") loadScheduleSettings(); }, [activeTab, loadScheduleSettings]);

  const handleScheduleSave = async () => {
    setScheduleSaving(true);
    setScheduleSaveMsg("");
    try {
      await api.salesAi.updateAutoGenerateSettings({
        enabled: scheduleEnabled,
        hour: scheduleHour,
        statuses: scheduleStatuses,
        min_score: scheduleMinScore,
        max_per_run: scheduleMaxPerRun,
        template_type: scheduleTemplateType,
        project_id: scheduleProjectId,
      });
      setScheduleSaveMsg("保存しました");
      setTimeout(() => setScheduleSaveMsg(""), 3000);
    } catch (e: any) {
      setScheduleSaveMsg(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleScheduleRunNow = async () => {
    if (!confirm("今すぐ自動生成を実行しますか？対象企業への営業文ドラフトが作成されます。")) return;
    setScheduleRunning(true);
    setScheduleSaveMsg("");
    try {
      await api.salesAi.runAutoGenerateNow();
      setScheduleSaveMsg("バックグラウンドで生成を開始しました。数分後に「レビュー・送信」タブで確認できます。");
      setTimeout(() => setScheduleSaveMsg(""), 8000);
    } catch (e: any) {
      setScheduleSaveMsg(e?.response?.data?.detail || "実行に失敗しました");
    } finally {
      setScheduleRunning(false);
    }
  };

  const toggleScheduleStatus = (status: string) => {
    setScheduleStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const SENT_STATUSES = new Set(["フォーム送信済", "メール送信済", "コンタクト済み", "返信あり", "面談化", "商談中", "代理店化", "成約", "失注", "NG"]);
  const filteredCompanies = companies.filter(c => {
    // 送信済み・商談中・成約・NGは常に除外
    if (SENT_STATUSES.has(c.status ?? "")) return false;
    // 送信失敗メッセージがある企業は除外（再送しても失敗するため）
    if (c.has_failed_msg) return false;
    if (companySearch && !(c.company_name || "").toLowerCase().includes(companySearch.toLowerCase())) return false;
    if (filterRanks.length > 0 && !filterRanks.includes(c.score_rank)) return false;
    if (filterEcOnly && !c.ec_flag) return false;
    if (filterEmailOnly && !c.email) return false;
    if (filterFormOnly && !c.contact_url) return false;
    if (filterCategory && c.category_main !== filterCategory) return false;
    if (filterExcludePublic) {
      const d = (c.domain || "").toLowerCase();
      if (d.endsWith(".go.jp") || d.endsWith(".lg.jp") || d.endsWith(".or.jp") || d.endsWith(".ac.jp") || d.endsWith(".ed.jp")) return false;
    }
    return true;
  });
  // Mode C用: フォームURL登録済み＆未送信の企業のみ
  const filteredCompaniesWithForm = filteredCompanies.filter(c => !!c.contact_url);
  // 送信失敗企業の件数
  const failedMsgCompanies = companies.filter(c => c.has_failed_msg);

  const categoryOptions = Array.from(new Set(companies.map(c => c.category_main).filter(Boolean))) as string[];

  const toggleCompany = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    const ids = filteredCompanies.slice(0, bulkSelectCount).map(c => c.id);
    setSelectedIds(ids);
  };

  const toggleRankFilter = (rank: string) => {
    setFilterRanks(prev => prev.includes(rank) ? prev.filter(r => r !== rank) : [...prev, rank]);
  };

  const applyOpeningMemoToMessages = async (generatedIds: number[]) => {
    if (!openingMemo.trim() || generatedIds.length === 0) return;
    const memo = openingMemo.trim();
    try {
      const allMsgs = await api.salesAi.listMessages();
      const msgMap: Record<number, any> = {};
      for (const m of (allMsgs.messages || [])) {
        msgMap[m.id] = m;
      }
      await Promise.allSettled(
        generatedIds.map(async (id) => {
          try {
            const msg = msgMap[id];
            if (msg) {
              await api.salesAi.updateMessage(id, {
                subject: msg.subject,
                body: memo + "\n\n" + msg.body,
              });
            }
          } catch {}
        })
      );
    } catch {}
  };

  const handleGenerateBatch = async () => {
    if (selectedIds.length === 0) { setGenError("企業を1件以上選択してください"); return; }
    setGenerating(true);
    setGenError("");
    setGenSuccess("");
    try {
      const res = await api.salesAi.generateBatch(selectedIds, templateType, currentProject?.id, customTemplateId ?? undefined, skipExisting, analyzeSite);
      const skippedMsg = res.total_skipped > 0 ? `（${res.total_skipped}件はスキップ）` : "";
      if (openingMemo.trim() && res.generated_ids?.length > 0) {
        await applyOpeningMemoToMessages(res.generated_ids);
        setGenSuccess(`${res.total_generated}件の営業文を生成し、冒頭一言を追加しました${skippedMsg}。「レビュー・送信」タブで確認できます。`);
      } else {
        setGenSuccess(`${res.total_generated}件の営業文を生成しました${skippedMsg}。「レビュー・送信」タブで確認できます。`);
      }
      if (res.errors?.length > 0) {
        setGenError(`${res.errors.length}件は生成できませんでした: ${res.errors[0]?.error}`);
      }
      setSelectedIds([]);
      setActiveTab("messages");
      loadMessages();
    } catch (e: any) {
      setGenError(e?.response?.data?.detail || "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoBatch = async () => {
    const ids = filteredCompanies.map(c => c.id);
    if (ids.length === 0) { setGenError("対象企業がありません"); return; }
    const BATCH = Math.min(Math.max(1, bulkSelectCount), 50);
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH));

    setAutoBatching(true);
    setAutoBatchDone(0);
    setAutoBatchTotal(ids.length);
    setAutoBatchBatch(0);
    setAutoBatchTotalBatches(chunks.length);
    setGenError("");
    setGenSuccess("");

    let totalGenerated = 0;
    for (let i = 0; i < chunks.length; i++) {
      setAutoBatchBatch(i + 1);
      try {
        const res = await api.salesAi.generateBatch(chunks[i], templateType, currentProject?.id, customTemplateId ?? undefined, skipExisting, analyzeSite);
        totalGenerated += res.total_generated || 0;
        setAutoBatchDone((i + 1) * BATCH > ids.length ? ids.length : (i + 1) * BATCH);
      } catch (e: any) {
        setGenError(`バッチ${i + 1}でエラーが発生しました: ${e?.response?.data?.detail || e?.message || "不明なエラー"}`);
        break;
      }
    }

    setAutoBatching(false);
    setGenSuccess(`全${totalGenerated}件の営業文を生成しました。「レビュー・送信」タブで確認できます。`);
    setSelectedIds([]);
    loadMessages();
  };

  const handleStartBgJob = async (autoSendForm: boolean) => {
    const ids = filteredCompanies.map(c => c.id);
    if (ids.length === 0) { setGenError("対象企業がありません"); return; }
    try {
      const res = await api.salesAi.startBgJob(
        ids, templateType, currentProject?.id, customTemplateId ?? undefined,
        skipExisting, analyzeSite, autoSendForm, autoSendForm ? bulkFormProfileId : undefined,
      );
      setBgJobId(res.job_id);
      setBgJobStatus({ job_id: res.job_id, status: "running", phase: "generating", done: 0, total: ids.length, batch: 0, total_batches: 0, generated: 0, sent: 0, failed: 0, auto_send_form: autoSendForm });
      setFullAutoConfirm(false);
      startBgPolling(res.job_id);
    } catch (e: any) {
      setGenError(e?.response?.data?.detail || "ジョブ開始に失敗しました");
    }
  };

  const handleFullAutoSend = async () => {
    const ids = filteredCompanies.map(c => c.id);
    if (ids.length === 0) { setGenError("対象企業がありません"); return; }
    const BATCH = Math.min(Math.max(1, bulkSelectCount), 50);
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH));

    setFullAutoConfirm(false);
    setFullAutoPhase("generating");
    setFullAutoProgress({ done: 0, total: ids.length, batch: 0, totalBatches: chunks.length });
    setFullAutoResult(null);
    setFullAutoError(null);
    setAutoBatching(true);

    let totalGenerated = 0;
    const allGeneratedIds: number[] = [];

    for (let i = 0; i < chunks.length; i++) {
      setFullAutoProgress(p => ({ ...p, batch: i + 1, done: Math.min((i + 1) * BATCH, ids.length) }));
      try {
        const res = await api.salesAi.generateBatch(chunks[i], templateType, currentProject?.id, customTemplateId ?? undefined, skipExisting, analyzeSite);
        totalGenerated += res.total_generated || 0;
        if (res.generated_ids) allGeneratedIds.push(...res.generated_ids);
      } catch (e: any) {
        setFullAutoError(`生成バッチ${i + 1}でエラー: ${e?.response?.data?.detail || e?.message || "不明なエラー"}`);
        setAutoBatching(false);
        setFullAutoPhase(null);
        return;
      }
    }

    setFullAutoPhase("sending");
    try {
      const sendIds = allGeneratedIds.length > 0 ? allGeneratedIds : undefined;
      const res = await api.salesAi.bulkSendForm(bulkFormProfileId, sendIds);
      setFullAutoResult({ generated: totalGenerated, sent: res.sent || 0, failed: res.failed || 0 });
      setFullAutoPhase("done");
      loadMessages();
    } catch (e: any) {
      setFullAutoError(`フォーム送信エラー: ${e?.response?.data?.detail || e?.message || "不明なエラー"}`);
      setFullAutoPhase(null);
    } finally {
      setAutoBatching(false);
      setSelectedIds([]);
    }
  };

  const handleBulkSend = async () => {
    setBulkSending(true);
    setBulkSendResult(null);
    setBulkSendConfirm(false);
    try {
      const res = await api.salesAi.bulkSend("manual");
      setBulkSendResult(res);
      loadMessages();
    } catch (e: any) {
      setGenError(e?.response?.data?.detail || "一括送信に失敗しました");
    } finally {
      setBulkSending(false);
    }
  };

  const handleBulkFormSend = async () => {
    setBulkFormSending(true);
    setBulkFormResult(null);
    setBulkFormError(null);
    // confirmUIは送信完了まで表示し続ける（setBulkFormConfirm(false)はここでは呼ばない）
    try {
      const res = await api.salesAi.bulkSendForm(bulkFormProfileId);
      setBulkFormResult(res);
      setBulkFormConfirm(false);
      loadMessages();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "フォーム一括送信に失敗しました（サーバーエラー）";
      setBulkFormError(msg);
      setBulkFormConfirm(false);
    } finally {
      setBulkFormSending(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMsgIds.length === 0) return;
    setBulkDeleting(true);
    try {
      await api.salesAi.bulkDeleteMessages(selectedMsgIds);
      setSelectedMsgIds([]);
      loadMessages();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "一括削除に失敗しました");
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleMsgSelect = (id: number) =>
    setSelectedMsgIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSelectAll = (visibleIds: number[]) =>
    setSelectedMsgIds(prev =>
      visibleIds.every(id => prev.includes(id)) ? prev.filter(id => !visibleIds.includes(id)) : [...new Set([...prev, ...visibleIds])]
    );

  const handleSendConfirm = async (sendMethod: string, profileId?: number): Promise<{ send_result?: string; send_detail?: string }> => {
    if (!sendTarget) return {};
    const updated = await api.salesAi.sendMessage(sendTarget.id, sendMethod, undefined, profileId);
    setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    return { send_result: updated.send_result, send_detail: updated.send_detail };
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この営業文を削除しますか？")) return;
    try {
      await api.salesAi.deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.detail || "削除に失敗しました");
    }
  };

  const handleClearQueue = async () => {
    setClearingQueue(true);
    try {
      const res = await api.salesAi.clearQueue();
      setClearQueueConfirm(false);
      loadMessages();
      alert(res.message || `送信キューを削除しました`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "削除に失敗しました");
    } finally {
      setClearingQueue(false);
    }
  };

  const handleAddOptOut = async () => {
    if (!optOutEmail && !optOutDomain) { alert("メールアドレスまたはドメインを入力してください"); return; }
    setAddingOptOut(true);
    try {
      await api.salesAi.addOptOut({ email: optOutEmail || undefined, domain: optOutDomain || undefined, reason: optOutReason || undefined });
      setOptOutEmail("");
      setOptOutDomain("");
      setOptOutReason("");
      loadOptOut();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "追加に失敗しました");
    } finally {
      setAddingOptOut(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">営業AI</h1>
          <p className="text-sm text-slate-500">Phase 2 — Claude AIで営業文の叩き台を生成し、担当者がレビューして送信</p>
        </div>
      </div>

      {hasApiKey === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Anthropic APIキーが設定されていません</p>
            <p className="text-xs text-amber-700 mt-1">システム管理者（COOLWORKS）がシステムAPI設定画面でAnthropicキーを登録することで利用可能になります。営業文の生成にはAPIキーが必要です。</p>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-200">
        {[
          { key: "generate", label: "ターゲット選択・生成", icon: <Sparkles size={16} /> },
          { key: "messages", label: "レビュー・送信", icon: <MessageSquare size={16} /> },
          { key: "optout", label: "配信停止リスト", icon: <Ban size={16} /> },
          { key: "stats", label: "送信統計", icon: <BarChart2 size={16} /> },
          { key: "schedule", label: "自動生成スケジュール", icon: <Calendar size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Filter size={16} className="text-slate-500" />
                テンプレート選択
              </h3>
              <p className="text-xs text-slate-400 font-medium mb-1">AI生成テンプレート</p>
              <div className="space-y-2">
                {(["shopify", "ec_support", "partner"] as TemplateType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTemplateType(t); setCustomTemplateId(null); }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      customTemplateId === null && templateType === t ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className={`text-sm font-medium ${customTemplateId === null && templateType === t ? "text-violet-700" : "text-slate-700"}`}>{TEMPLATE_LABELS[t]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{TEMPLATE_DESCRIPTIONS[t]}</p>
                  </button>
                ))}
              </div>

              {customTemplates.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-medium mb-2">設定済みのメールテンプレート</p>
                  <div className="space-y-2">
                    {customTemplates.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => setCustomTemplateId(tpl.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          customTemplateId === tpl.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={12} className={customTemplateId === tpl.id ? "text-emerald-600" : "text-slate-400"} />
                          <p className={`text-sm font-medium truncate ${customTemplateId === tpl.id ? "text-emerald-700" : "text-slate-700"}`}>{tpl.title}</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">変数置換で一括生成（AI不使用）</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              {genSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                  {genSuccess}
                </div>
              )}
              {genError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{genError}</div>
              )}

              {autoBatching && !fullAutoPhase && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-violet-700 font-medium">
                    <span>自動バッチ生成中… バッチ {autoBatchBatch}/{autoBatchTotalBatches}</span>
                    <span>{autoBatchDone}/{autoBatchTotal} 件完了</span>
                  </div>
                  <div className="w-full bg-violet-200 rounded-full h-2">
                    <div
                      className="bg-violet-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${autoBatchTotal > 0 ? Math.round((autoBatchDone / autoBatchTotal) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-violet-500">このまま画面を開いたままにしてください</p>
                </div>
              )}

              {fullAutoPhase && fullAutoPhase !== "done" && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg px-3 py-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-orange-700 font-semibold">
                    <RefreshCw size={12} className="animate-spin" />
                    {fullAutoPhase === "generating"
                      ? `【フェーズ1】生成中… バッチ ${fullAutoProgress.batch}/${fullAutoProgress.totalBatches}`
                      : "【フェーズ2】フォーム送信中… しばらくお待ちください"}
                  </div>
                  {fullAutoPhase === "generating" && (
                    <>
                      <div className="w-full bg-orange-200 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${fullAutoProgress.total > 0 ? Math.round((fullAutoProgress.done / fullAutoProgress.total) * 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-orange-500">{fullAutoProgress.done}/{fullAutoProgress.total} 件生成完了</p>
                    </>
                  )}
                  {fullAutoPhase === "sending" && (
                    <p className="text-xs text-orange-500">生成した文章をフォームへ自動送信しています…</p>
                  )}
                  <p className="text-xs text-orange-400">画面を閉じずにお待ちください</p>
                </div>
              )}

              {bgJobStatus && (
                <div className={`rounded-lg px-3 py-3 space-y-2 border-2 ${
                  bgJobStatus.status === "done" ? "bg-emerald-50 border-emerald-400" :
                  bgJobStatus.status === "error" ? "bg-red-50 border-red-400" :
                  bgJobStatus.status === "cancelled" ? "bg-slate-50 border-slate-400" :
                  bgJobStatus.status === "cancelling" ? "bg-orange-50 border-orange-400" :
                  "bg-sky-50 border-sky-400"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {bgJobStatus.status === "done" ? (
                        <CheckCircle2 size={13} className="text-emerald-600" />
                      ) : bgJobStatus.status === "error" ? (
                        <span className="text-red-600">⚠️</span>
                      ) : bgJobStatus.status === "cancelled" ? (
                        <span className="text-slate-500">✕</span>
                      ) : (
                        <RefreshCw size={13} className="animate-spin text-sky-600" />
                      )}
                      <span className={
                        bgJobStatus.status === "done" ? "text-emerald-700" :
                        bgJobStatus.status === "error" ? "text-red-700" :
                        bgJobStatus.status === "cancelled" ? "text-slate-600" :
                        bgJobStatus.status === "cancelling" ? "text-orange-600" :
                        "text-sky-700"
                      }>
                        {bgJobStatus.status === "done"
                          ? "バックグラウンド処理が完了しました"
                          : bgJobStatus.status === "error"
                          ? "エラーが発生しました"
                          : bgJobStatus.status === "cancelled"
                          ? "キャンセルされました"
                          : bgJobStatus.status === "cancelling"
                          ? "キャンセル中… 現在の処理が完了次第停止します"
                          : bgJobStatus.phase === "sending"
                          ? "【フェーズ2】バックグラウンドでフォーム送信中…"
                          : `【フェーズ1】バックグラウンドで生成中… バッチ ${bgJobStatus.batch}/${bgJobStatus.total_batches}`}
                      </span>
                    </div>
                    <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-mono flex-shrink-0">ID: {bgJobStatus.job_id}</span>
                  </div>
                  {bgJobStatus.status === "running" && bgJobStatus.phase === "generating" && (
                    <>
                      <div className="w-full bg-sky-200 rounded-full h-2">
                        <div className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${bgJobStatus.total > 0 ? Math.round((bgJobStatus.done / bgJobStatus.total) * 100) : 0}%` }} />
                      </div>
                      <p className="text-xs text-sky-600">{bgJobStatus.done}/{bgJobStatus.total} 件生成完了</p>
                    </>
                  )}
                  {bgJobStatus.status === "running" && bgJobStatus.phase === "sending" && (
                    <div className="space-y-1">
                      <p className="text-xs text-sky-600">
                        送信成功: {bgJobStatus.sent ?? 0}件 ／ 失敗: {bgJobStatus.failed ?? 0}件 ／ スキップ: {bgJobStatus.skipped ?? 0}件
                      </p>
                      {bgJobStatus.fail_reasons && Object.keys(bgJobStatus.fail_reasons).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(bgJobStatus.fail_reasons as Record<string, number>).map(([reason, count]) => (
                            <span key={reason} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                              {reason}: {count}件
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {bgJobStatus.status === "done" && (
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-600">
                        生成: {bgJobStatus.generated}件
                        {bgJobStatus.auto_send_form && <> ／ 送信成功: {bgJobStatus.sent}件 ／ 失敗: {bgJobStatus.failed}件</>}
                      </p>
                      {bgJobStatus.auto_send_form && bgJobStatus.fail_reasons && Object.keys(bgJobStatus.fail_reasons).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-red-600 font-medium">失敗内訳:</span>
                          {Object.entries(bgJobStatus.fail_reasons as Record<string, number>).map(([reason, count]) => (
                            <span key={reason} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                              {reason}: {count}件
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {bgJobStatus.status === "error" && bgJobStatus.error && (
                    <p className="text-xs text-red-600">{bgJobStatus.error}</p>
                  )}
                  {(bgJobStatus.status === "done" || bgJobStatus.status === "error" || bgJobStatus.status === "cancelled") && (
                    <button onClick={() => { setBgJobId(null); setBgJobStatus(null); }} className="text-xs text-slate-500 underline">閉じる</button>
                  )}
                  {bgJobStatus.status === "running" && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-sky-400">画面を閉じても処理は続きます。再度開くと進捗が表示されます。</p>
                      <button
                        onClick={handleCancelBgJob}
                        className="text-xs text-red-500 border border-red-300 rounded px-2 py-0.5 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        中断する
                      </button>
                    </div>
                  )}
                </div>
              )}

              {fullAutoResult && fullAutoPhase === "done" && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-3 space-y-1">
                  <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={13} /> 全自動送信が完了しました</p>
                  <p className="text-xs text-emerald-600">生成: {fullAutoResult.generated}件 ／ 送信成功: {fullAutoResult.sent}件 ／ 失敗: {fullAutoResult.failed}件</p>
                  <button onClick={() => { setFullAutoResult(null); setFullAutoPhase(null); }} className="text-xs text-emerald-500 underline mt-1">閉じる</button>
                </div>
              )}

              {fullAutoError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {fullAutoError}
                  <button onClick={() => setFullAutoError(null)} className="ml-2 underline text-red-500">閉じる</button>
                </div>
              )}

              {/* ── 共通オプション ─────────────────────────── */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                <p className="text-xs font-semibold text-slate-600">生成オプション（全モード共通）</p>
                <div className="bg-white border border-blue-200 rounded-lg p-2.5 space-y-1.5">
                  <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                    <PlusCircle size={11} /> 冒頭一言メモ
                  </p>
                  <textarea
                    value={openingMemo}
                    onChange={e => setOpeningMemo(e.target.value)}
                    rows={2}
                    placeholder="例: 先日〇〇の展示会でお名刺をいただきました…（空欄なら追加しません）"
                    className="w-full border border-blue-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} className="w-3.5 h-3.5 accent-violet-600" />
                    <span className="text-xs text-slate-600">生成済みはスキップ</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={analyzeSite} onChange={e => setAnalyzeSite(e.target.checked)} disabled={!!customTemplateId} className="w-3.5 h-3.5 accent-violet-600" />
                    <span className={`text-xs ${customTemplateId ? "text-slate-400" : "text-slate-600"}`}>サイトAI分析</span>
                    {analyzeSite && !customTemplateId && <span className="text-[10px] bg-violet-100 text-violet-700 px-1 py-0.5 rounded-full font-medium">推奨</span>}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">バッチサイズ</span>
                  <input
                    type="number" min={1} max={50} value={bulkSelectCount}
                    onChange={e => setBulkSelectCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-14 text-xs border border-slate-300 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                  <span className="text-xs text-slate-400">件ずつ処理</span>
                </div>
              </div>

              {/* ── モード選択カード ───────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">送信モードを選ぶ</p>

                {/* MODE A: 手動選択生成 */}
                <div className="border-2 border-violet-200 rounded-xl overflow-hidden">
                  <div className="bg-violet-600 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-white">
                      <Sparkles size={13} />
                      <span className="text-xs font-bold">モードA　手動選択生成</span>
                    </div>
                    <span className="text-[10px] bg-violet-400 text-white px-1.5 py-0.5 rounded-full font-medium">{selectedIds.length}件選択中</span>
                  </div>
                  <div className="bg-white px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">① 企業を手動選択</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">② AI生成</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">③ 手動レビュー</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">④ 手動送信</span>
                    </div>
                    <p className="text-[10px] text-slate-400">💡 特定企業を選んで丁寧に対応したい時</p>
                    <button
                      onClick={handleGenerateBatch}
                      disabled={generating || autoBatching || selectedIds.length === 0}
                      className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {generating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {generating ? "生成中..." : selectedIds.length === 0 ? "右リストで企業を選択してください" : `選択した${selectedIds.length}件を生成`}
                    </button>
                  </div>
                </div>

                {/* 送信失敗バナー */}
                {failedMsgCompanies.length > 0 && (
                  <div className="border-2 border-red-300 bg-red-50 rounded-xl px-3 py-2.5 flex items-start gap-2.5">
                    <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-red-700">
                        送信失敗: {failedMsgCompanies.length}社が送信対象から除外されています
                      </p>
                      <p className="text-[10px] text-red-500 mt-0.5">
                        過去の送信エラーにより除外中。原因を確認後、下書きに戻して再試行してください。
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`送信失敗した${failedMsgCompanies.length}社のメッセージを下書きに戻して再送信可能にしますか？`)) return;
                        try {
                          const r = await api.salesAi.resetFailed(currentProject?.id);
                          alert(`${r.reset_count}件を下書きにリセットしました`);
                          loadCompanies();
                          loadMessages();
                          loadStats();
                        } catch {
                          alert("リセットに失敗しました");
                        }
                      }}
                      className="flex-shrink-0 text-[10px] bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700 transition-colors font-semibold whitespace-nowrap"
                    >
                      下書きに戻す
                    </button>
                  </div>
                )}

                {/* MODE B: 全件バッチ生成 */}
                <div className="border-2 border-emerald-200 rounded-xl overflow-hidden">
                  <div className="bg-emerald-600 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-white">
                      <Zap size={13} />
                      <span className="text-xs font-bold">モードB　全件バッチ生成</span>
                    </div>
                    <span className="text-[10px] bg-emerald-400 text-white px-1.5 py-0.5 rounded-full font-medium">{filteredCompanies.length}件対象</span>
                  </div>
                  <div className="bg-white px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">① 自動生成（全件）</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">② 手動レビュー</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">③ 手動送信</span>
                    </div>
                    <p className="text-[10px] text-slate-400">💡 まとめて生成して内容を確認してから送りたい時</p>
                    <button
                      onClick={handleAutoBatch}
                      disabled={generating || autoBatching || !!bgJobStatus?.status?.match(/running/) || filteredCompanies.length === 0}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {autoBatching && !fullAutoPhase ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                      {autoBatching && !fullAutoPhase ? `バッチ ${autoBatchBatch}/${autoBatchTotalBatches} 処理中…` : `全${filteredCompanies.length}件を生成（画面を開いたまま）`}
                    </button>
                    <button
                      onClick={() => handleStartBgJob(false)}
                      disabled={generating || autoBatching || bgJobStatus?.status === "running" || filteredCompanies.length === 0}
                      className="w-full flex items-center justify-center gap-2 border-2 border-emerald-500 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw size={12} />
                      バックグラウンドで生成（画面を閉じてもOK）
                    </button>
                  </div>
                </div>

                {/* MODE C: 全自動モード */}
                <div className="border-2 border-orange-300 rounded-xl overflow-hidden">
                  <div className="bg-orange-500 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-white">
                      <Zap size={13} />
                      <span className="text-xs font-bold">モードC　全自動生成＆送信</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] bg-orange-400 text-white px-1.5 py-0.5 rounded-full font-medium">{filteredCompaniesWithForm.length}件対象</span>
                      <span className="text-[10px] bg-orange-300 text-white px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                    </div>
                  </div>
                  <div className="bg-white px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">① 自動生成（全件）</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">② 自動フォーム送信</span>
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium ml-1">確認なし</span>
                    </div>
                    <p className="text-[10px] text-slate-400">💡 大量リストをそのまま即送信したい時</p>
                    {bulkFormProfiles.length > 0 && (
                      <select
                        value={bulkFormProfileId ?? ""}
                        onChange={e => setBulkFormProfileId(e.target.value ? Number(e.target.value) : undefined)}
                        disabled={autoBatching || bgJobStatus?.status === "running"}
                        className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white disabled:opacity-50"
                      >
                        <option value="">送信者プロフィール未選択</option>
                        {bulkFormProfiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name}{p.display_name ? ` — ${p.display_name}` : ""}</option>
                        ))}
                      </select>
                    )}
                    {fullAutoConfirm ? (
                      <div className="bg-orange-50 border border-orange-300 rounded-lg p-2.5 space-y-2">
                        <p className="text-xs text-orange-800 font-semibold">⚠️ 実行前確認</p>
                        <p className="text-xs text-orange-700">
                          <strong>{filteredCompaniesWithForm.length}件</strong>（フォームURL登録済み・未送信）を生成して、確認なしで<strong>フォーム送信まで自動実行</strong>します。
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button onClick={handleFullAutoSend} className="text-xs bg-orange-600 text-white px-2 py-1.5 rounded-lg hover:bg-orange-700 font-semibold transition-colors">
                            画面を開いたまま実行
                          </button>
                          <button onClick={() => handleStartBgJob(true)} className="text-xs bg-orange-800 text-white px-2 py-1.5 rounded-lg hover:bg-orange-900 font-semibold transition-colors flex items-center justify-center gap-1">
                            <RefreshCw size={10} /> バックグラウンド実行
                          </button>
                          <button onClick={() => setFullAutoConfirm(false)} className="col-span-2 text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFullAutoConfirm(true)}
                        disabled={generating || autoBatching || bgJobStatus?.status === "running" || filteredCompaniesWithForm.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Zap size={12} />
                        全{filteredCompaniesWithForm.length}件を全自動生成＆フォーム送信
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowAllProjects(v => !v); setSelectedIds([]); }}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors flex-shrink-0 ${
                      showAllProjects
                        ? "bg-slate-700 text-white border-slate-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {showAllProjects ? "全プロジェクト表示中" : "現在のプロジェクト"}
                  </button>
                  <div className="flex items-center gap-1.5 flex-1 border border-slate-200 rounded-lg px-2 py-1">
                    <Search size={13} className="text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="企業名で検索..."
                      value={companySearch}
                      onChange={e => setCompanySearch(e.target.value)}
                      className="flex-1 text-sm outline-none min-w-0"
                    />
                  </div>
                  {selectedIds.length > 0 && (
                    <button onClick={() => setSelectedIds([])} className="text-xs text-slate-500 hover:text-slate-700 flex-shrink-0">解除</button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 mr-1">絞込:</span>
                  {["A", "B", "C", "D"].map(rank => (
                    <button
                      key={rank}
                      onClick={() => toggleRankFilter(rank)}
                      className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${
                        filterRanks.includes(rank)
                          ? "bg-violet-600 text-white border-violet-600"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {rank}ランク
                    </button>
                  ))}
                  <button
                    onClick={() => setFilterEcOnly(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      filterEcOnly ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ECのみ
                  </button>
                  <button
                    onClick={() => setFilterEmailOnly(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      filterEmailOnly ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    メールあり
                  </button>
                  <button
                    onClick={() => setFilterFormOnly(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      filterFormOnly ? "bg-cyan-600 text-white border-cyan-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    フォームURLあり
                  </button>
                  <button
                    onClick={() => setFilterExcludePublic(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      filterExcludePublic ? "bg-orange-600 text-white border-orange-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                    title="go.jp / lg.jp / or.jp / ac.jp / ed.jp ドメインを除外"
                  >
                    🏢 公的組織を除外
                  </button>
                  {(filterRanks.length > 0 || filterEcOnly || filterEmailOnly || filterFormOnly || filterCategory || filterExcludePublic) && (
                    <button
                      onClick={() => { setFilterRanks([]); setFilterEcOnly(false); setFilterEmailOnly(false); setFilterFormOnly(false); setFilterCategory(""); setFilterExcludePublic(false); }}
                      className="text-xs text-slate-400 hover:text-slate-600 ml-1"
                    >
                      リセット
                    </button>
                  )}
                  <div className="ml-auto">
                    <button
                      onClick={selectAllFiltered}
                      disabled={filteredCompanies.length === 0}
                      className="text-xs px-2.5 py-0.5 rounded border border-violet-400 text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors"
                    >
                      先頭{bulkSelectCount}件を選択
                    </button>
                  </div>
                </div>

                {categoryOptions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 flex-shrink-0">業種:</span>
                    <select
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                      className="text-xs border border-slate-200 rounded px-2 py-0.5 text-slate-600 flex-1 max-w-[200px]"
                    >
                      <option value="">すべて表示</option>
                      {categoryOptions.sort().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400">{filteredCompanies.length}件 / 全{companies.length}件</span>
                  </div>
                )}

                {categoryOptions.length === 0 && (
                  <p className="text-xs text-slate-400">
                    {filteredCompanies.length}件表示 / 全{companies.length}件
                    {companies.length === 0 && !showAllProjects && currentProject && (
                      <span className="ml-2 text-amber-500">
                        ※ このプロジェクトに企業がありません。「全プロジェクト表示中」に切り替えてください。
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {filteredCompanies.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {currentProject ? "企業データがありません" : "プロジェクトを選択してください"}
                  </div>
                ) : (
                  filteredCompanies.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => selectedIds.length < 50 || isSelected ? toggleCompany(c.id) : undefined}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-violet-50" : "hover:bg-slate-50"
                        } ${!isSelected && selectedIds.length >= 50 ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? "bg-violet-600 border-violet-600" : "border-slate-300"
                        }`}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{c.company_name || "—"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.cms_type && <span className="text-xs text-slate-400">{c.cms_type}</span>}
                            {c.prefecture && <span className="text-xs text-slate-400">{c.prefecture}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {c.ec_flag && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">EC</span>}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${RANK_COLORS[c.score_rank] || RANK_COLORS.D}`}>
                            {c.score_rank}
                          </span>
                          <span className="text-xs text-slate-500">{c.score_total}pt</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "messages" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {["", "draft", "reviewed", "sent"].map(s => (
                <button
                  key={s}
                  onClick={() => { setMsgFilter(s); }}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    msgFilter === s ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s === "" ? "すべて" : STATUS_LABELS[s as MessageStatus]}
                </button>
              ))}
            </div>

            {messages.some(m => m.status !== "sent" && m.status !== "failed") && (
              <button
                onClick={() => setShowBulkReview(true)}
                className="flex items-center gap-1.5 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition-colors"
              >
                <ListChecks size={12} /> 一括レビュー＆フォーム送信
              </button>
            )}

            {messages.some(m => m.status === "draft" || m.status === "reviewed") && (
              clearQueueConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-700 font-medium">
                    下書き・レビュー済み {messages.filter(m => m.status === "draft" || m.status === "reviewed").length}件を全削除しますか？
                  </span>
                  <button
                    onClick={handleClearQueue}
                    disabled={clearingQueue}
                    className="flex items-center gap-1 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {clearingQueue ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    削除する
                  </button>
                  <button onClick={() => setClearQueueConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg">キャンセル</button>
                </div>
              ) : (
                <button
                  onClick={() => setClearQueueConfirm(true)}
                  className="flex items-center gap-1.5 text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12} /> 送信キューをクリア
                </button>
              )
            )}

            {messages.some(m => m.status === "reviewed") && !bulkSendResult && (
              bulkSendConfirm ? (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-slate-600">レビュー済み{messages.filter(m => m.status === "reviewed").length}件を一括送信（手動記録）しますか？</span>
                  <button
                    onClick={handleBulkSend}
                    disabled={bulkSending}
                    className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {bulkSending ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    確認して送信
                  </button>
                  <button onClick={() => setBulkSendConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg">キャンセル</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkSendConfirm(true)}
                  className="ml-auto flex items-center gap-1.5 text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Send size={12} /> 一括送信
                </button>
              )
            )}

            {bulkSendResult && (
              <div className="ml-auto flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-xs text-emerald-700 font-medium">{bulkSendResult.sent}件を送信しました</span>
                {bulkSendResult.failed > 0 && <span className="text-xs text-red-600">（{bulkSendResult.failed}件失敗）</span>}
                <button onClick={() => setBulkSendResult(null)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
              </div>
            )}

            {messages.some(m => m.status !== "sent" && m.status !== "failed") && !bulkFormResult && (
              bulkFormConfirm ? (
                <div className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border ${bulkFormSending ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
                  {!bulkFormSending && bulkFormProfiles.length > 0 && (
                    <select
                      value={bulkFormProfileId ?? ""}
                      onChange={e => setBulkFormProfileId(e.target.value ? Number(e.target.value) : undefined)}
                      className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-[160px]"
                    >
                      <option value="">プロフィール未選択</option>
                      {bulkFormProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.display_name ? ` — ${p.display_name}` : ""}</option>
                      ))}
                    </select>
                  )}
                  {bulkFormSending ? (
                    <span className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                      <RefreshCw size={12} className="animate-spin" />
                      フォーム送信処理中です。しばらくお待ちください…
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">{messages.filter(m => m.status !== "sent" && m.status !== "failed").length}件をフォーム送信しますか？</span>
                  )}
                  <button
                    onClick={handleBulkFormSend}
                    disabled={bulkFormSending}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {bulkFormSending ? <RefreshCw size={12} className="animate-spin" /> : <Globe size={12} />}
                    {bulkFormSending ? "送信中..." : "確認して送信"}
                  </button>
                  {!bulkFormSending && (
                    <button onClick={() => setBulkFormConfirm(false)} className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg">キャンセル</button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setBulkFormConfirm(true)}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Globe size={12} /> フォーム一括送信
                </button>
              )
            )}

            {bulkFormResult && (
              <div className="flex items-center gap-3 bg-emerald-50 border-2 border-emerald-400 rounded-lg px-4 py-2.5 shadow-sm">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm text-emerald-800 font-semibold">{bulkFormResult.sent}件のフォーム送信が完了しました</span>
                  {bulkFormResult.skipped > 0 && (
                    <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {bulkFormResult.skipped}件スキップ（無効URL/エラーページ）
                    </span>
                  )}
                  {bulkFormResult.failed > 0 && (
                    <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      {bulkFormResult.failed}件失敗
                    </span>
                  )}
                </div>
                <button onClick={() => setBulkFormResult(null)} className="ml-auto text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={14} /></button>
              </div>
            )}

            {bulkFormError && (
              <div className="flex items-center gap-3 bg-red-50 border-2 border-red-400 rounded-lg px-4 py-2.5 shadow-sm">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
                <span className="text-sm text-red-800 font-semibold flex-1">{bulkFormError}</span>
                <button onClick={() => setBulkFormError(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={14} /></button>
              </div>
            )}

            <button onClick={loadMessages} className={`${!messages.some(m => m.status === "reviewed") && !bulkSendResult && !bulkFormResult ? "ml-auto" : ""} text-slate-500 hover:text-slate-700`}>
              <RefreshCw size={16} className={loadingMessages ? "animate-spin" : ""} />
            </button>
          </div>

          {messagesLimited && !loadingMessages && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">
              <AlertCircle size={13} className="flex-shrink-0" />
              最新500件を表示中（全{messagesTotal.toLocaleString()}件）。古いメッセージはCSVエクスポートまたはステータスフィルターでご確認ください。
            </div>
          )}

          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={20} className="animate-spin text-slate-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <MessageSquare size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">営業文がありません</p>
              <p className="text-xs text-slate-400 mt-1">「ターゲット選択・生成」タブで企業を選んで生成してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.filter(m => m.status !== "sent" && (msgFilter === "" || m.status === msgFilter)).length > 0 && (
                <div className="flex items-center gap-3 px-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        messages.filter(m => m.status !== "sent" && (msgFilter === "" || m.status === msgFilter)).length > 0 &&
                        messages.filter(m => m.status !== "sent" && (msgFilter === "" || m.status === msgFilter)).map(m => m.id).every(id => selectedMsgIds.includes(id))
                      }
                      onChange={() => toggleSelectAll(messages.filter(m => m.status !== "sent" && (msgFilter === "" || m.status === msgFilter)).map(m => m.id))}
                      className="w-4 h-4 accent-red-500"
                    />
                    <span className="text-xs text-slate-500">全選択</span>
                  </label>
                  {selectedMsgIds.length > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {bulkDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {selectedMsgIds.length}件を一括削除
                    </button>
                  )}
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`bg-white rounded-xl border p-5 transition-colors ${selectedMsgIds.includes(m.id) ? "border-red-300 bg-red-50/30" : "border-slate-200"}`}>
                  <div className="flex items-start gap-3">
                    {m.status !== "sent" && (
                      <input
                        type="checkbox"
                        checked={selectedMsgIds.includes(m.id)}
                        onChange={() => toggleMsgSelect(m.id)}
                        className="mt-1 w-4 h-4 accent-red-500 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status]}`}>
                            {STATUS_LABELS[m.status]}
                          </span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {TEMPLATE_LABELS[m.template_type]}
                          </span>
                          <span className="text-sm font-medium text-slate-700">{m.company_name}</span>
                        </div>
                        <p className="font-medium text-slate-800 truncate">件名: {m.subject}</p>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{m.body}</p>
                        {m.sent_at && (
                          <p className="text-xs text-slate-400 mt-1">送信: {new Date(m.sent_at).toLocaleString("ja-JP")}</p>
                        )}
                        {m.status === "failed" && m.send_note && (
                          <p className="text-xs text-red-500 mt-1 flex items-start gap-1">
                            <span className="flex-shrink-0">⚠</span>
                            <span>{m.send_note}</span>
                          </p>
                        )}
                        {m.status === "sent" && (
                          <p className="text-xs mt-0.5">
                            {(m.open_count ?? 0) > 0 ? (
                              <span className="text-green-600 font-medium">
                                ✓ 開封済 {m.open_count}回
                                {m.opened_at && ` (初回: ${new Date(m.opened_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })})`}
                              </span>
                            ) : (
                              <span className="text-slate-400">未開封</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {m.status !== "sent" && (
                          <>
                            <button
                              onClick={() => setEditTarget(m)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                            >
                              <Edit3 size={13} />
                              編集
                            </button>
                            <button
                              onClick={() => setSendTarget(m)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              <Send size={13} />
                              送信
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {m.status === "sent" && (
                          <div className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle2 size={14} />
                            送信済
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "optout" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Ban size={16} className="text-red-500" />
              配信停止の追加
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={optOutEmail}
                  onChange={e => setOptOutEmail(e.target.value)}
                  placeholder="info@example.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ドメイン（任意）</label>
                <input
                  type="text"
                  value={optOutDomain}
                  onChange={e => setOptOutDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">理由（任意）</label>
                <input
                  type="text"
                  value={optOutReason}
                  onChange={e => setOptOutReason(e.target.value)}
                  placeholder="配信停止依頼"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>
            <button
              onClick={handleAddOptOut}
              disabled={addingOptOut}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {addingOptOut ? <RefreshCw size={14} className="animate-spin" /> : <Ban size={14} />}
              配信停止リストに追加
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">配信停止リスト（{optOutList.length}件）</h3>
            </div>
            {optOutList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">配信停止リストは空です</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {optOutList.map(e => (
                  <div key={e.id} className="flex items-center gap-4 px-4 py-3">
                    <Ban size={14} className="text-red-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-800">{e.email || e.domain}</p>
                      {e.reason && <p className="text-xs text-slate-400">{e.reason}</p>}
                    </div>
                    <p className="text-xs text-slate-400">{e.added_at ? new Date(e.added_at).toLocaleDateString("ja-JP") : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editTarget && (
        <EditModal
          message={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={updated => {
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
            setEditTarget(null);
          }}
        />
      )}

      {showBulkReview && (
        <BulkReviewModal
          messages={messages.filter(m => m.status !== "sent" && m.status !== "failed")}
          formProfiles={bulkFormProfiles}
          onClose={() => setShowBulkReview(false)}
          onSaved={() => { setShowBulkReview(false); loadMessages(); }}
        />
      )}
      {activeTab === "stats" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">送信統計ダッシュボード</h2>
            <button onClick={loadStats} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <RefreshCw size={14} className={loadingStats ? "animate-spin" : ""} />
              更新
            </button>
          </div>

          {loadingStats && !stats ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" />読み込み中...
            </div>
          ) : (
            <>
              {/* ── サマリー数値カード ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 送信待ち */}
                <div className="bg-white rounded-xl border border-violet-200 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-violet-600">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-violet-100 flex-shrink-0">
                      <Clock size={15} />
                    </div>
                    <span className="text-xs font-medium">送信待ち</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800 leading-none pl-1">
                    {((stats?.status_counts?.draft ?? 0) + (stats?.status_counts?.reviewed ?? 0)).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 pl-1">
                    未送信の下書き・確認済みメッセージ数
                  </p>
                </div>

                {/* 送信完了 */}
                <div className="bg-white rounded-xl border border-green-200 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100 flex-shrink-0">
                      <CheckCircle2 size={15} />
                    </div>
                    <span className="text-xs font-medium">送信完了</span>
                  </div>
                  <div className="flex items-end gap-2 pl-1">
                    <p className="text-3xl font-bold text-slate-800 leading-none">
                      {(stats?.total_sent ?? 0).toLocaleString()}
                    </p>
                    {(() => {
                      const tried = (stats?.total_sent ?? 0) + (stats?.total_failed ?? 0);
                      const rate = tried > 0 ? Math.round((stats?.total_sent ?? 0) / tried * 100) : 0;
                      return tried > 0 ? (
                        <span className="text-sm font-semibold text-green-600 mb-0.5">({rate}%)</span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-xs text-slate-400 pl-1">
                    フォーム・メール送信に成功した件数
                    {(() => {
                      const tried = (stats?.total_sent ?? 0) + (stats?.total_failed ?? 0);
                      return tried > 0 ? `（試行 ${tried.toLocaleString()}件中）` : "";
                    })()}
                  </p>
                </div>

                {/* 配信停止 */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-100 flex-shrink-0">
                      <Ban size={15} />
                    </div>
                    <span className="text-xs font-medium">配信停止リスト</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800 leading-none pl-1">
                    {(stats?.opt_out_count ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 pl-1">
                    受信拒否・配信停止の申し出があった企業数
                  </p>
                </div>

                {/* 送信エラー（リセットボタン付き） */}
                <div className="bg-white rounded-xl border border-red-200 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 flex-shrink-0">
                      <AlertCircle size={15} />
                    </div>
                    <span className="text-xs font-medium">送信エラー</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-800 leading-none pl-1">
                    {(stats?.total_failed ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 pl-1">
                    フォーム・メール送信に失敗した件数
                  </p>
                  {(stats?.total_failed ?? 0) > 0 && (
                    <button
                      onClick={async () => {
                        if (!confirm(`失敗した${stats?.total_failed}件を下書きに戻しますか？\n再送信したい場合は下書きに戻してから再実行してください。`)) return;
                        try {
                          const r = await api.salesAi.resetFailed(currentProject?.id);
                          alert(`${r.reset_count}件を下書きにリセットしました`);
                          loadStats();
                          loadMessages();
                        } catch {
                          alert("リセットに失敗しました");
                        }
                      }}
                      className="w-full text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                    >
                      下書きに戻して再送信できる状態にする
                    </button>
                  )}
                </div>
              </div>

              {/* ── ステータス内訳サマリーバー ── */}
              {(stats?.total_messages ?? 0) > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
                  <p className="text-xs font-semibold text-slate-500 mb-3">全 {(stats?.total_messages ?? 0).toLocaleString()}件の内訳</p>
                  <div className="flex rounded-full overflow-hidden h-3 mb-3">
                    {(() => {
                      const total = stats?.total_messages || 1;
                      const draft = stats?.status_counts?.draft ?? 0;
                      const reviewed = stats?.status_counts?.reviewed ?? 0;
                      const sent = stats?.total_sent ?? 0;
                      const failed = stats?.total_failed ?? 0;
                      const processing = stats?.status_counts?.processing ?? 0;
                      const accounted = draft + reviewed + sent + failed + processing;
                      const other = Math.max(0, total - accounted);
                      const segments = [
                        { value: sent, color: "bg-green-500", label: "送信完了" },
                        { value: reviewed, color: "bg-blue-400", label: "確認済み" },
                        { value: failed, color: "bg-red-400", label: "エラー" },
                        { value: processing, color: "bg-yellow-400", label: "処理中" },
                        { value: other, color: "bg-orange-300", label: "その他" },
                        { value: draft, color: "bg-slate-300", label: "下書き" },
                      ].filter(s => s.value > 0);
                      return segments.map((s, i) => (
                        <div
                          key={i}
                          className={`${s.color} transition-all`}
                          style={{ width: `${(s.value / total) * 100}%` }}
                          title={`${s.label}: ${s.value.toLocaleString()}件`}
                        />
                      ));
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {(() => {
                      const draft = stats?.status_counts?.draft ?? 0;
                      const reviewed = stats?.status_counts?.reviewed ?? 0;
                      const sent = stats?.total_sent ?? 0;
                      const failed = stats?.total_failed ?? 0;
                      const processing = stats?.status_counts?.processing ?? 0;
                      const total = stats?.total_messages ?? 0;
                      const accounted = draft + reviewed + sent + failed + processing;
                      const other = Math.max(0, total - accounted);
                      return [
                        { label: "下書き（未送信）", value: draft, dot: "bg-slate-400" },
                        { label: "確認済み（送信待ち）", value: reviewed, dot: "bg-blue-400" },
                        { label: "送信完了", value: sent, dot: "bg-green-500" },
                        { label: "送信エラー", value: failed, dot: "bg-red-400" },
                        ...(processing > 0 ? [{ label: "処理中", value: processing, dot: "bg-yellow-400" }] : []),
                        ...(other > 0 ? [{ label: "その他", value: other, dot: "bg-orange-300" }] : []),
                      ].map(({ label, value, dot }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                          <span className="text-xs text-slate-500">{label}</span>
                          <span className="text-xs font-semibold text-slate-700">{value.toLocaleString()}件</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-sm text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp size={15} className="text-violet-500" />ステータス別
                  </h3>
                  <div className="space-y-2">
                    {[
                      { key: "draft", label: "下書き", color: "bg-slate-400" },
                      { key: "reviewed", label: "確認済み", color: "bg-blue-400" },
                      { key: "sent", label: "送信済み", color: "bg-green-500" },
                      { key: "failed", label: "失敗", color: "bg-red-500" },
                    ].map(({ key, label, color }) => {
                      const val = stats?.status_counts[key] ?? 0;
                      const total = stats?.total_messages || 1;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-16 flex-shrink-0">{label}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.round(val / total * 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-700 w-6 text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-sm text-slate-700 mb-4 flex items-center gap-2">
                    <FileText size={15} className="text-violet-500" />テンプレート別
                  </h3>
                  <div className="space-y-2">
                    {[
                      { key: "shopify", label: "Shopify提案" },
                      { key: "ec_support", label: "EC支援提案" },
                      { key: "partner", label: "パートナー提案" },
                    ].map(({ key, label }) => {
                      const val = stats?.template_counts[key] ?? 0;
                      const total = stats?.total_messages || 1;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-violet-500 transition-all" style={{ width: `${Math.round(val / total * 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-700 w-6 text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-sm text-slate-700 mb-4 flex items-center gap-2">
                    <Send size={15} className="text-violet-500" />送信方法別
                  </h3>
                  {Object.keys(stats?.method_counts || {}).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">送信履歴なし</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(stats?.method_counts || {}).map(([method, count]) => {
                        const totalSent = Object.values(stats?.method_counts || {}).reduce((a, b) => a + b, 0) || 1;
                        const label = method === "email" ? "メール" : method === "form" ? "フォーム" : method === "manual" ? "手動記録" : method;
                        return (
                          <div key={method} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-16 flex-shrink-0">{label}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                              <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${Math.round(count / totalSent * 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-slate-700 w-6 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-sm text-slate-700 mb-4 flex items-center gap-2">
                  <BarChart2 size={15} className="text-violet-500" />過去14日間の送信推移
                </h3>
                {(() => {
                  const dailyData = stats?.daily_sends || [];
                  const maxCount = Math.max(...dailyData.map(d => d.count), 1);
                  return (
                    <div className="flex items-end gap-1 h-24">
                      {dailyData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="relative w-full">
                            <div
                              className="w-full bg-violet-500 hover:bg-violet-600 rounded-t transition-all cursor-default"
                              style={{ height: `${Math.max(d.count / maxCount * 72, d.count > 0 ? 4 : 0)}px` }}
                              title={`${d.date}: ${d.count}件`}
                            />
                          </div>
                          {i % 2 === 0 && <span className="text-[9px] text-slate-400 -rotate-45 origin-top-left">{d.date}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                    <Clock size={15} className="text-violet-500" />最近の送信ログ
                  </h3>
                  <span className="text-xs text-slate-400">{auditLogs.length}件</span>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">送信履歴がありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">企業名</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">送信方法</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">結果</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">詳細</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">日時</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800 text-xs">{log.company_name || `ID:${log.company_id}`}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {log.send_method === "email" ? "メール" : log.send_method === "form" ? "フォーム" : log.send_method === "manual" ? "手動記録" : log.send_method}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                log.result === "sent" ? "bg-green-100 text-green-700" :
                                log.result === "failed" ? "bg-red-100 text-red-700" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {log.result === "sent" ? "✓ 送信済" : log.result === "failed" ? "✗ 失敗" : log.result}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{log.note || "-"}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">
                              {log.sent_at ? new Date(log.sent_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <Zap size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">半自動送信モード</p>
              <p className="text-xs text-blue-700 mt-0.5">
                毎日指定時刻に対象企業の営業文を自動生成し「ドラフト」として保存します。
                送信は「レビュー・送信」タブで人間が確認・承認してから行います。
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Calendar size={16} className="text-violet-600" />
                スケジュール設定
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-slate-600">自動生成を有効化</span>
                <div
                  onClick={() => setScheduleEnabled(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${scheduleEnabled ? "bg-violet-600" : "bg-slate-300"}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${scheduleEnabled ? "translate-x-5.5 ml-0.5" : "ml-0.5"}`} />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">実行時刻</label>
                <select
                  value={scheduleHour}
                  onChange={e => setScheduleHour(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({length: 24}, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">1回の最大生成件数</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={scheduleMaxPerRun}
                  onChange={e => setScheduleMaxPerRun(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">対象ステータス</label>
              <div className="flex flex-wrap gap-2">
                {["未確認", "アプローチ前", "アプローチ中", "資料送付済", "フォロー中"].map(s => (
                  <button
                    key={s}
                    onClick={() => toggleScheduleStatus(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      scheduleStatuses.includes(s)
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-slate-600 border-slate-300 hover:border-violet-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">最低スコアランク</label>
              <div className="flex gap-2">
                {[{label: "すべて", value: 0}, {label: "C以上", value: 2}, {label: "B以上", value: 3}, {label: "Aのみ", value: 4}].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setScheduleMinScore(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      scheduleMinScore === opt.value
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-slate-600 border-slate-300 hover:border-violet-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">テンプレート</label>
                <select
                  value={scheduleTemplateType}
                  onChange={e => setScheduleTemplateType(e.target.value as TemplateType)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="shopify">Shopify移行提案</option>
                  <option value="ec_support">EC支援・売上改善</option>
                  <option value="partner">代理店パートナー</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">対象プロジェクト</label>
                <select
                  value={scheduleProjectId ?? ""}
                  onChange={e => setScheduleProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">全プロジェクト</option>
                  {scheduleProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {scheduleSaveMsg && (
              <div className={`p-3 rounded-lg text-sm ${scheduleSaveMsg.includes("失敗") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                {scheduleSaveMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleScheduleSave}
                disabled={scheduleSaving}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {scheduleSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                設定を保存
              </button>
              <button
                onClick={handleScheduleRunNow}
                disabled={scheduleRunning}
                className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors"
              >
                {scheduleRunning ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                今すぐ実行
              </button>
            </div>
          </div>

          {(scheduleLastRunAt || scheduleLastRunCount > 0) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">最終実行</h4>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock size={14} className="text-slate-400" />
                  {scheduleLastRunAt
                    ? new Date(scheduleLastRunAt).toLocaleString("ja-JP")
                    : "未実行"}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText size={14} className="text-slate-400" />
                  {scheduleLastRunCount}件のドラフトを生成
                </div>
              </div>
            </div>
          )}

          {/* OpenAI APIキー設定 */}
          <div className="bg-white rounded-xl border border-violet-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" />
            <h3 className="font-semibold text-slate-800 text-sm">OpenAI APIキー設定</h3>
            {openaiKeySet && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">設定済み</span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            設定するとフォーム送信時のフィールドマッピング精度が上がります（なくても送信可能です）。
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">APIキー取得 →</a>
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={openaiKeyInput}
              onChange={e => { setOpenaiKeyInput(e.target.value); setOpenaiKeyMsg(null); }}
              placeholder="sk-..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              onClick={handleTestOpenaiKey}
              disabled={openaiTesting || openaiKeySaving}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {openaiTesting ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
              接続テスト
            </button>
            <button
              onClick={handleSaveOpenaiKey}
              disabled={openaiKeySaving || !openaiKeyInput || openaiKeyInput.includes("*")}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {openaiKeySaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              保存
            </button>
          </div>
          {openaiKeyMsg && (
            <p className={`text-xs font-medium ${openaiKeyMsgType === "success" ? "text-emerald-700" : "text-red-600"}`}>{openaiKeyMsg}</p>
          )}
          </div>
        </div>
      )}

      {sendTarget && (
        <SendConfirmModal
          message={sendTarget}
          onClose={() => setSendTarget(null)}
          onConfirm={handleSendConfirm}
        />
      )}
    </div>
  );
}
