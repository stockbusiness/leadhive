import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Building2, Globe, Phone, Mail, MapPin, Tag, ExternalLink,
  Edit2, Loader2, Clock, ChevronRight, Activity, FileText, User, Sparkles,
  Send, Copy, Check, RefreshCw, ChevronDown, ChevronUp, Users, Briefcase, MonitorSmartphone
} from "lucide-react";
import { api } from "../api";
import type { Company, StatusHistoryEntry, ActivityLogEntry } from "../types";
import ScoreBadge from "../components/common/ScoreBadge";
import FlagBadge from "../components/common/FlagBadge";
import CompanyEditModal from "../components/companies/CompanyEditModal";
import { STATUSES } from "../constants";

const STATUS_COLORS: Record<string, string> = {
  "未確認": "bg-slate-100 text-slate-700",
  "確認済み": "bg-blue-100 text-blue-700",
  "コンタクト済み": "bg-indigo-100 text-indigo-700",
  "返信あり": "bg-violet-100 text-violet-700",
  "商談中": "bg-yellow-100 text-yellow-700",
  "提案済み": "bg-orange-100 text-orange-700",
  "契約交渉中": "bg-amber-100 text-amber-700",
  "代理店化": "bg-emerald-100 text-emerald-700",
  "不採用": "bg-red-100 text-red-700",
};

const ACTION_ICONS: Record<string, string> = {
  "電話": "📞",
  "メール": "✉️",
  "フォーム送信": "📝",
  "面談": "🤝",
  "その他": "📌",
};

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "history" | "activities" | "ai">("info");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [emailTone, setEmailTone] = useState<"formal" | "casual">("formal");
  const [emailNote, setEmailNote] = useState("");
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [emailResult, setEmailResult] = useState<{ subject: string; body: string } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSectionOpen, setEmailSectionOpen] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const companyId = Number(id);

  const load = async () => {
    try {
      const [companyData, histData, actData] = await Promise.all([
        api.companies.get(companyId),
        api.companies.getHistory(companyId),
        api.companies.getActivities(companyId),
      ]);
      setCompany(companyData.company);
      setHistory(histData.history);
      setActivities(actData.activities);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleSaved = async () => {
    await load();
    setEditOpen(false);
  };

  const handleAiAnalyze = async () => {
    if (!company) return;
    setAiAnalyzing(true);
    setAiError(null);
    try {
      const data = await api.companies.aiAnalyze(company.id);
      if (data.error) {
        setAiError(data.error);
      } else {
        await load();
      }
    } catch (err: any) {
      setAiError(err.response?.data?.detail || "AI分析に失敗しました");
    }
    setAiAnalyzing(false);
  };

  const handleGenerateEmail = async () => {
    if (!company) return;
    setEmailGenerating(true);
    setEmailError(null);
    setEmailResult(null);
    try {
      const data = await api.companies.generateEmail(company.id, emailTone, emailNote);
      if (data.error) {
        setEmailError(data.error);
      } else if (data.email) {
        setEmailResult(data.email);
      }
    } catch (err: any) {
      setEmailError(err.response?.data?.detail || "メール生成に失敗しました");
    }
    setEmailGenerating(false);
  };

  const copyText = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-slate-500">企業が見つかりません</p>
        <button onClick={() => navigate("/companies")} className="mt-2 text-blue-600 hover:underline text-sm">一覧へ戻る</button>
      </div>
    );
  }

  const hasFollowUp = company.follow_up_date && new Date(company.follow_up_date) <= new Date();

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/companies")} className="text-slate-400 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <nav className="flex items-center gap-1 text-sm text-slate-500 min-w-0">
          <Link to="/companies" className="hover:text-blue-600 flex-shrink-0">候補企業一覧</Link>
          <ChevronRight size={14} className="flex-shrink-0" />
          <span className="text-slate-800 font-medium truncate">{company.company_name || company.domain}</span>
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 md:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="bg-slate-100 rounded-lg p-2.5 flex-shrink-0">
              <Building2 size={24} className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-snug">{company.company_name || "（名称未設定）"}</h1>
              {company.website_url && (
                <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1 truncate">
                  <Globe size={14} className="flex-shrink-0" />
                  <span className="truncate">{company.domain || company.website_url}</span>
                  <ExternalLink size={12} className="flex-shrink-0" />
                </a>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[company.status] || "bg-slate-100 text-slate-700"}`}>
                  {company.status}
                </span>
                {hasFollowUp && (
                  <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    <Clock size={10} />
                    期限: {company.follow_up_date}
                  </span>
                )}
                {company.follow_up_date && !hasFollowUp && (
                  <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    <Clock size={10} />
                    フォローアップ: {company.follow_up_date}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <ScoreBadge score={company.score_total} rank={company.score_rank} />
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Edit2 size={14} />
              編集
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-100">
          <InfoItem icon={<MapPin size={14} />} label="所在地" value={[company.prefecture, company.city].filter(Boolean).join(" ") || "—"} />
          <InfoItem icon={<Phone size={14} />} label="電話" value={company.phone || "—"} />
          <div>
            <p className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Mail size={12} /> メール</p>
            {company.email ? (
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-slate-700 truncate max-w-[140px]">{company.email}</span>
                <button
                  onClick={() => copyText(company.email, setCopiedEmail)}
                  className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                  title="コピー"
                >
                  {copiedEmail ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                </button>
              </div>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
          <InfoItem icon={<Tag size={14} />} label="カテゴリ" value={company.category_main || "—"} />
          {(company.contact_name || company.contact_title) && (
            <InfoItem icon={<User size={14} />} label="担当者" value={[company.contact_name, company.contact_title].filter(Boolean).join(" / ")} />
          )}
        </div>

        {company.contact_url && (
          <div className="mt-4">
            <a href={company.contact_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <ExternalLink size={14} />
              問い合わせページを開く
            </a>
          </div>
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          {company.shopify_flag && <FlagBadge label="Shopify" color="bg-green-100 text-green-700" />}
          {company.ec_flag && <FlagBadge label="EC" color="bg-blue-100 text-blue-700" />}
          {company.amazon_flag && <FlagBadge label="Amazon" color="bg-orange-100 text-orange-700" />}
          {company.rakuten_flag && <FlagBadge label="楽天" color="bg-red-100 text-red-700" />}
          {company.consulting_flag && <FlagBadge label="コンサル" color="bg-indigo-100 text-indigo-700" />}
          {company.operation_flag && <FlagBadge label="運営代行" color="bg-teal-100 text-teal-700" />}
          {company.production_flag && <FlagBadge label="制作" color="bg-violet-100 text-violet-700" />}
          {company.escms_target_flag && (
            <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
              <MonitorSmartphone size={11} /> ESCMS優先
            </span>
          )}
          {company.has_recruitment && (
            <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              <Users size={11} /> 採用中
            </span>
          )}
        </div>

        {(company.cms_type || (company.sns_links && Object.values(company.sns_links).some(Boolean))) && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {company.cms_type && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-16 flex-shrink-0">CMS</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  company.cms_type === "Shopify" ? "bg-green-100 text-green-700" :
                  company.cms_type === "WordPress" ? "bg-blue-100 text-blue-700" :
                  company.cms_type === "BASE" ? "bg-orange-100 text-orange-700" :
                  company.cms_type === "EC-CUBE" ? "bg-amber-100 text-amber-700" :
                  company.cms_type === "Wix" ? "bg-sky-100 text-sky-700" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  {company.cms_type}
                </span>
              </div>
            )}
            {company.sns_links && Object.values(company.sns_links).some(Boolean) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 w-16 flex-shrink-0">SNS</span>
                {company.sns_links.twitter && (
                  <a href={company.sns_links.twitter} target="_blank" rel="noopener noreferrer"
                     className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded hover:bg-sky-100 flex items-center gap-1">
                    <ExternalLink size={10} /> X / Twitter
                  </a>
                )}
                {company.sns_links.instagram && (
                  <a href={company.sns_links.instagram} target="_blank" rel="noopener noreferrer"
                     className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded hover:bg-pink-100 flex items-center gap-1">
                    <ExternalLink size={10} /> Instagram
                  </a>
                )}
                {company.sns_links.facebook && (
                  <a href={company.sns_links.facebook} target="_blank" rel="noopener noreferrer"
                     className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100 flex items-center gap-1">
                    <ExternalLink size={10} /> Facebook
                  </a>
                )}
                {company.sns_links.youtube && (
                  <a href={company.sns_links.youtube} target="_blank" rel="noopener noreferrer"
                     className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded hover:bg-red-100 flex items-center gap-1">
                    <ExternalLink size={10} /> YouTube
                  </a>
                )}
                {company.sns_links.line && (
                  <a href={company.sns_links.line} target="_blank" rel="noopener noreferrer"
                     className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded hover:bg-green-100 flex items-center gap-1">
                    <ExternalLink size={10} /> LINE
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {company.assignee && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-slate-50 rounded-lg">
            <User size={14} className="text-slate-500" />
            <span className="text-sm text-slate-600">担当者:</span>
            <span className="text-sm font-medium text-slate-800">{company.assignee.display_name || company.assignee.email}</span>
          </div>
        )}

        {company.tags && company.tags.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {company.tags.map(t => (
              <span key={t} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { key: "info", label: "メモ", icon: <FileText size={14} /> },
            { key: "ai", label: "AIサマリー", icon: <Sparkles size={14} /> },
            { key: "activities", label: `アクティビティ (${activities.length})`, icon: <Activity size={14} /> },
            { key: "history", label: `ステータス履歴 (${history.length})`, icon: <Clock size={14} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "info" && (
            <div>
              {company.notes ? (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{company.notes}</pre>
              ) : (
                <p className="text-slate-400 text-sm">メモはありません</p>
              )}
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">企業のウェブサイトをAIが分析し、営業に役立つサマリーを生成します。</p>
                  {company.ai_summary?.generated_at && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      最終生成: {new Date(company.ai_summary.generated_at).toLocaleString("ja-JP")}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleAiAnalyze}
                  disabled={aiAnalyzing || !company.website_url}
                  className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {aiAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {company.ai_summary ? "再生成" : "AIサマリーを生成"}
                </button>
              </div>

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{aiError}</div>
              )}

              {aiAnalyzing && (
                <div className="flex items-center gap-3 p-4 bg-violet-50 rounded-lg">
                  <Loader2 size={18} className="animate-spin text-violet-600" />
                  <span className="text-sm text-violet-700">AIがウェブサイトを分析中...</span>
                </div>
              )}

              {!aiAnalyzing && company.ai_summary && (
                <div className="grid gap-3">
                  {[
                    { key: "事業内容", icon: "🏢" },
                    { key: "顧客層", icon: "👥" },
                    { key: "強み", icon: "⭐" },
                    { key: "サービス", icon: "📦" },
                    { key: "価格帯", icon: "💰" },
                  ].map(({ key, icon }) => {
                    const val = (company.ai_summary as any)?.[key];
                    if (!val || val === "情報なし") return null;
                    return (
                      <div key={key} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{icon}</span>
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{key}</span>
                        </div>
                        <p className="text-sm text-slate-700">{val}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {!aiAnalyzing && !company.ai_summary && !aiError && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Sparkles size={32} className="mb-3 text-slate-300" />
                  <p className="text-sm">「AIサマリーを生成」ボタンで分析を開始できます</p>
                  {!company.website_url && (
                    <p className="text-xs text-red-400 mt-1">※ WebサイトURLが必要です</p>
                  )}
                </div>
              )}

              {/* ===== アウトリーチメール生成 ===== */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                <button
                  onClick={() => setEmailSectionOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Send size={16} className="text-blue-600" />
                    <span className="font-semibold text-sm text-slate-700">アウトリーチメール生成</span>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">AI</span>
                  </div>
                  {emailSectionOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {emailSectionOpen && (
                  <div className="p-4 space-y-4 bg-white">
                    {!company.ai_summary && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        AIサマリーがあるとより精度の高いメールが生成されます。先に「AIサマリーを生成」することを推奨します。
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">トーン</p>
                        <div className="flex gap-2">
                          {(["formal", "casual"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setEmailTone(t)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${emailTone === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"}`}
                            >
                              {t === "formal" ? "フォーマル" : "カジュアル"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-600 mb-1.5">追加指示（任意）</p>
                        <input
                          type="text"
                          value={emailNote}
                          onChange={(e) => setEmailNote(e.target.value)}
                          placeholder="例: Shopify移行について触れてほしい"
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateEmail}
                      disabled={emailGenerating}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {emailGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {emailGenerating ? "生成中..." : emailResult ? "再生成" : "メールを生成"}
                    </button>

                    {emailGenerating && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <Loader2 size={16} className="animate-spin text-blue-600" />
                        <span className="text-sm text-blue-700">AIがメール文案を作成中...</span>
                      </div>
                    )}

                    {emailError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{emailError}</div>
                    )}

                    {emailResult && !emailGenerating && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">件名</label>
                            <button
                              onClick={() => copyText(emailResult.subject, setCopiedSubject)}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
                            >
                              {copiedSubject ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              {copiedSubject ? "コピー済み" : "コピー"}
                            </button>
                          </div>
                          <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-sm text-slate-800 font-medium">
                            {emailResult.subject}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">本文</label>
                            <button
                              onClick={() => copyText(emailResult.body, setCopiedBody)}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
                            >
                              {copiedBody ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              {copiedBody ? "コピー済み" : "コピー"}
                            </button>
                          </div>
                          <textarea
                            value={emailResult.body.replace(/\\n/g, "\n")}
                            onChange={(e) => setEmailResult({ ...emailResult, body: e.target.value })}
                            rows={8}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>

                        <button
                          onClick={() => copyText(
                            `件名: ${emailResult.subject}\n\n${emailResult.body.replace(/\\n/g, "\n")}`,
                            setCopiedAll
                          )}
                          className="flex items-center gap-2 w-full justify-center border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                        >
                          {copiedAll ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          {copiedAll ? "コピーしました" : "件名＋本文をまとめてコピー"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "activities" && (
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-slate-400 text-sm">アクティビティログはありません</p>
              ) : (
                activities.map(a => (
                  <div key={a.id} className="flex gap-3">
                    <span className="text-lg">{ACTION_ICONS[a.action_type] || "📌"}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">{a.action_type}</span>
                        <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {a.description && <p className="text-sm text-slate-600 mt-0.5">{a.description}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-slate-400 text-sm">変更履歴はありません</p>
              ) : (
                history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400 text-xs w-36 flex-shrink-0">
                      {new Date(h.changed_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.old_status] || "bg-slate-100 text-slate-700"}`}>{h.old_status || "—"}</span>
                    <ChevronRight size={14} className="text-slate-400" />
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.new_status] || "bg-slate-100 text-slate-700"}`}>{h.new_status}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {editOpen && company && (
        <CompanyEditModal
          company={company}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
    </div>
  );
}
