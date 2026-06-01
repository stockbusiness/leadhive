import { useState, useEffect, useCallback } from "react";
import {
  Bot, Sparkles, Send, Edit3, Trash2, Check, X, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Eye, Ban, Info, Search,
  MessageSquare, CheckCircle2, Filter, Mail, Globe, Settings, XCircle,
  BarChart2, TrendingUp, FileText, AlertCircle, Clock, Calendar, Play, Zap
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

function EditModal({ message, onClose, onSave }: {
  message: SalesMessage;
  onClose: () => void;
  onSave: (updated: SalesMessage) => void;
}) {
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">件名</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">本文</label>
            <textarea
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
            保存する
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

function SendConfirmModal({ message, onClose, onConfirm }: {
  message: SalesMessage;
  onClose: () => void;
  onConfirm: (sendMethod: string) => Promise<{ send_result?: string; send_detail?: string }>;
}) {
  const [sendMethod, setSendMethod] = useState("email");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<SendPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  useEffect(() => {
    setPreviewLoading(true);
    api.salesAi.getSendPreview(message.id)
      .then(r => { setPreview(r); setPreviewLoading(false); })
      .catch(() => setPreviewLoading(false));
  }, [message.id]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await onConfirm(sendMethod);
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">フォーム自動送信について</p>
              <p>・AIがコンタクトフォームの項目を自動判別して入力・送信します</p>
              <p>・送信者名/メール/会社名はアカウント設定から自動取得されます</p>
              {preview?.contact_url
                ? <p className="text-green-700">・コンタクトURLあり — フォームを検出できる可能性が高いです</p>
                : <p className="text-amber-700">・コンタクトURLが未登録のため、トップページから自動探索します</p>
              }
              <p className="text-slate-500">※ reCAPTCHA / JavaScript必須フォームは非対応です</p>
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
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genSuccess, setGenSuccess] = useState("");

  const [messages, setMessages] = useState<SalesMessage[]>([]);
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
  const [scheduleLastRunCount, setScheduleLastRunCount] = useState(0);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);
  const [scheduleSaveMsg, setScheduleSaveMsg] = useState("");

  useEffect(() => {
    api.salesAi.checkApiKey().then(r => setHasApiKey(r.has_api_key)).catch(() => setHasApiKey(false));
  }, []);

  const loadCompanies = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await api.companies.list({ project_id: currentProject.id, per_page: 200, sort: "score_total", order: "desc" });
      setCompanies((res.companies || []) as any);
    } catch {}
  }, [currentProject]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const res = await api.salesAi.listMessages(msgFilter || undefined);
      setMessages(res.messages || []);
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
  }, []);

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

  const filteredCompanies = companies.filter(c => {
    if (companySearch && !(c.company_name || "").toLowerCase().includes(companySearch.toLowerCase())) return false;
    if (filterRanks.length > 0 && !filterRanks.includes(c.score_rank)) return false;
    if (filterEcOnly && !c.ec_flag) return false;
    if (filterEmailOnly && !c.email) return false;
    return true;
  });

  const toggleCompany = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    const ids = filteredCompanies.slice(0, 50).map(c => c.id);
    setSelectedIds(ids);
  };

  const toggleRankFilter = (rank: string) => {
    setFilterRanks(prev => prev.includes(rank) ? prev.filter(r => r !== rank) : [...prev, rank]);
  };

  const handleGenerateBatch = async () => {
    if (selectedIds.length === 0) { setGenError("企業を1件以上選択してください"); return; }
    setGenerating(true);
    setGenError("");
    setGenSuccess("");
    try {
      const res = await api.salesAi.generateBatch(selectedIds, templateType, currentProject?.id);
      setGenSuccess(`${res.total_generated}件の営業文を生成しました。「レビュー・送信」タブで確認できます。`);
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

  const handleSendConfirm = async (sendMethod: string): Promise<{ send_result?: string; send_detail?: string }> => {
    if (!sendTarget) return {};
    const updated = await api.salesAi.sendMessage(sendTarget.id, sendMethod);
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
              <div className="space-y-2">
                {(["shopify", "ec_support", "partner"] as TemplateType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTemplateType(t)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      templateType === t ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className={`text-sm font-medium ${templateType === t ? "text-violet-700" : "text-slate-700"}`}>{TEMPLATE_LABELS[t]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{TEMPLATE_DESCRIPTIONS[t]}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm text-slate-600 mb-3">
                <span className="font-semibold text-slate-800">{selectedIds.length}件</span> 選択中（最大50件）
              </p>
              {genSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                  {genSuccess}
                </div>
              )}
              {genError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{genError}</div>
              )}
              <button
                onClick={handleGenerateBatch}
                disabled={generating || selectedIds.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? "生成中..." : `${selectedIds.length}件を一括生成`}
              </button>
              <p className="text-xs text-slate-400 mt-2 text-center">生成には1件あたり数秒かかります</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-100 space-y-2">
                <div className="flex items-center gap-3">
                  <Search size={16} className="text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="企業名で検索..."
                    value={companySearch}
                    onChange={e => setCompanySearch(e.target.value)}
                    className="flex-1 text-sm outline-none"
                  />
                  {selectedIds.length > 0 && (
                    <button onClick={() => setSelectedIds([])} className="text-xs text-slate-500 hover:text-slate-700 flex-shrink-0">すべて解除</button>
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
                  {(filterRanks.length > 0 || filterEcOnly || filterEmailOnly) && (
                    <button
                      onClick={() => { setFilterRanks([]); setFilterEcOnly(false); setFilterEmailOnly(false); }}
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
                      絞込結果を全選択（最大50件）
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  {filteredCompanies.length}件表示 / 全{companies.length}件
                </p>
              </div>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {filteredCompanies.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {currentProject ? "企業データがありません" : "プロジェクトを選択してください"}
                  </div>
                ) : (
                  filteredCompanies.slice(0, 100).map(c => {
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
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
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
            <button onClick={loadMessages} className="ml-auto text-slate-500 hover:text-slate-700">
              <RefreshCw size={16} className={loadingMessages ? "animate-spin" : ""} />
            </button>
          </div>

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
              {messages.map(m => (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "総メッセージ数", value: stats?.total_messages ?? 0, icon: <FileText size={18} />, color: "bg-slate-100 text-slate-600" },
                  { label: "送信済み", value: stats?.total_sent ?? 0, icon: <CheckCircle2 size={18} />, color: "bg-green-100 text-green-700" },
                  { label: "送信失敗", value: stats?.total_failed ?? 0, icon: <AlertCircle size={18} />, color: "bg-red-100 text-red-700" },
                  { label: "配信停止数", value: stats?.opt_out_count ?? 0, icon: <Ban size={18} />, color: "bg-amber-100 text-amber-700" },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${card.color}`}>
                      {card.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
                    </div>
                  </div>
                ))}
              </div>

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
