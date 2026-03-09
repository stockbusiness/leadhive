import { useState, useEffect, useCallback } from "react";
import {
  Bot, Sparkles, Send, Edit3, Trash2, Check, X, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Eye, Ban, Info, Search,
  MessageSquare, CheckCircle2, Filter
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

function SendConfirmModal({ message, onClose, onConfirm }: {
  message: SalesMessage;
  onClose: () => void;
  onConfirm: (sendMethod: string) => void;
}) {
  const [sendMethod, setSendMethod] = useState("email");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await onConfirm(sendMethod);
    setSending(false);
  };

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
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-0.5">宛先</p>
            <p className="font-medium text-slate-800 text-sm">{message.company_name}</p>
            <p className="text-xs text-slate-600 mt-1">件名: {message.subject}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">送信方法</label>
            <div className="flex gap-3">
              {["email", "form", "sns"].map(m => (
                <button
                  key={m}
                  onClick={() => setSendMethod(m)}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${sendMethod === m ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  {m === "email" ? "メール" : m === "form" ? "フォーム" : "SNS"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            送信記録は監査ログに自動保存されます。配信停止URLが本文に含まれていることを確認してください。
          </p>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">キャンセル</button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            送信する
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalesAI() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState<"generate" | "messages" | "optout">("generate");

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
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    api.salesAi.checkApiKey().then(r => setHasApiKey(r.has_api_key)).catch(() => setHasApiKey(false));
  }, []);

  const loadCompanies = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await api.companies.list({ project_id: currentProject.id, per_page: 200, sort: "score_total", order: "desc" });
      setCompanies(res.companies || []);
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

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { if (activeTab === "messages") loadMessages(); }, [activeTab, loadMessages]);
  useEffect(() => { if (activeTab === "optout") loadOptOut(); }, [activeTab, loadOptOut]);

  const filteredCompanies = companies.filter(c =>
    !companySearch || (c.company_name || "").toLowerCase().includes(companySearch.toLowerCase())
  );

  const toggleCompany = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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

  const handleSendConfirm = async (sendMethod: string) => {
    if (!sendTarget) return;
    try {
      const updated = await api.salesAi.sendMessage(sendTarget.id, sendMethod);
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      setSendTarget(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "送信記録に失敗しました");
    }
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
            <p className="text-xs text-amber-700 mt-1">設定画面から <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> を環境変数に設定するか、管理者に連絡してください。営業文の生成にはAPIキーが必要です。</p>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-200">
        {[
          { key: "generate", label: "ターゲット選択・生成", icon: <Sparkles size={16} /> },
          { key: "messages", label: "レビュー・送信", icon: <MessageSquare size={16} /> },
          { key: "optout", label: "配信停止リスト", icon: <Ban size={16} /> },
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
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="企業名で検索..."
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className="flex-1 text-sm outline-none"
                />
                {selectedIds.length > 0 && (
                  <button onClick={() => setSelectedIds([])} className="text-xs text-slate-500 hover:text-slate-700">すべて解除</button>
                )}
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
