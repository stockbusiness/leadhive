import { useEffect, useState } from "react";
import { Plus, Trash2, Search, BarChart2, List, TrendingUp, Zap, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Lightbulb, MapPin, ShoppingCart, CheckCircle2, Pencil, Check, X, Sparkles, Link, Tag } from "lucide-react";
import HelpTooltip from "../components/HelpTooltip";
import HelpPanel from "../components/HelpPanel";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api";
import { CATEGORIES, DEFAULT_KEYWORDS, KEYWORD_SUGGESTIONS, REGION_SUGGESTIONS } from "../constants";
import type { SearchKeyword, KeywordAnalytics, KeywordAnalyticsSummary, EcKeywordTemplate, AiKeywordSuggestion } from "../types";
import { useProject } from "../contexts/ProjectContext";

function EfficiencyBadge({ rate, runs }: { rate: number; runs: number }) {
  if (runs === 0) return <span className="text-xs text-slate-400">-</span>;
  if (rate >= 50) return <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">高</span>;
  if (rate >= 20) return <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">中</span>;
  return <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">低</span>;
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function AnalyticsTab({ projectId }: { projectId: number | null }) {
  const [analytics, setAnalytics] = useState<KeywordAnalytics[]>([]);
  const [summary, setSummary] = useState<KeywordAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.keywords.analytics(projectId ?? undefined).then((data) => {
      setAnalytics(data.analytics);
      setSummary(data.summary);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const chartData = analytics.slice(0, 10).map((a) => ({
    name: a.keyword_text.length > 15 ? a.keyword_text.slice(0, 15) + "…" : a.keyword_text,
    fullName: a.keyword_text,
    獲得数: a.success_count,
    重複: a.duplicate_count,
    拒否: a.rejected_count,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <RefreshCw size={20} className="animate-spin mr-2" />
        読み込み中...
      </div>
    );
  }

  if (!summary || analytics.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-10 text-center">
        <BarChart2 size={40} className="mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500 font-medium">収集履歴がありません</p>
        <p className="text-sm text-slate-400 mt-1">キーワードを使って収集を実行すると、ここに分析データが表示されます。</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{summary.keyword_count} キーワードの収集実績</p>
        <button onClick={load} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5">
          <RefreshCw size={12} />
          更新
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<TrendingUp size={14} />}
          label="総収集企業数"
          value={summary.total_companies_collected.toLocaleString()}
          sub="全キーワード合計"
        />
        <SummaryCard
          icon={<Search size={14} />}
          label="総API呼出数"
          value={summary.total_api_calls.toLocaleString()}
          sub="発見URL合計"
        />
        <SummaryCard
          icon={<Zap size={14} />}
          label="平均成功率"
          value={`${summary.avg_success_rate}%`}
          sub="発見→獲得の割合"
        />
        <SummaryCard
          icon={<BarChart2 size={14} />}
          label="総実行回数"
          value={summary.total_runs.toLocaleString()}
          sub="全コレクション合計"
        />
      </div>

      {(() => {
        const eligible = analytics.filter(a => a.total_found >= 5);
        const top3 = [...eligible].sort((a, b) => b.success_rate - a.success_rate).slice(0, 3);
        const bottom3 = analytics
          .filter(a => a.total_runs >= 2 && a.success_rate < 20)
          .sort((a, b) => a.success_rate - b.success_rate)
          .slice(0, 3);
        if (top3.length === 0 && bottom3.length === 0) return null;
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {top3.length > 0 && (
              <div className="bg-white rounded-lg border border-emerald-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={15} className="text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-700">成功率 上位キーワード</h3>
                </div>
                <div className="space-y-2">
                  {top3.map((a, i) => (
                    <div key={a.keyword_id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${i === 0 ? "bg-emerald-500 text-white" : i === 1 ? "bg-emerald-300 text-white" : "bg-emerald-100 text-emerald-700"}`}>{i + 1}</span>
                        <span className="text-xs text-slate-700 truncate">{a.keyword_text}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 flex-shrink-0">{a.success_rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bottom3.length > 0 && (
              <div className="bg-white rounded-lg border border-red-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={15} className="text-red-500" />
                  <h3 className="text-sm font-semibold text-slate-700">要改善キーワード（成功率&lt;20%）</h3>
                </div>
                <div className="space-y-2">
                  {bottom3.map((a, i) => (
                    <div key={a.keyword_id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="text-xs text-slate-700 truncate">{a.keyword_text}</span>
                      </div>
                      <span className="text-xs font-bold text-red-500 flex-shrink-0">{a.success_rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 text-sm mb-4">獲得数上位10キーワード</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => [`${value}件`, name]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
              />
              <Bar dataKey="獲得数" stackId="a" fill="#3b82f6" radius={[0, 3, 3, 0]} />
              <Bar dataKey="重複" stackId="a" fill="#e2e8f0" />
              <Bar dataKey="拒否" stackId="a" fill="#fca5a5" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-end text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />獲得</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" />重複</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-300 inline-block" />拒否</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-700 text-sm">キーワード別詳細</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">キーワード</th>
                <th className="text-center px-3 py-3">実行回数</th>
                <th className="text-center px-3 py-3">発見数</th>
                <th className="text-center px-3 py-3">獲得数</th>
                <th className="text-center px-3 py-3">成功率</th>
                <th className="text-center px-3 py-3">重複率</th>
                <th className="text-center px-3 py-3">拒否率</th>
                <th className="text-center px-3 py-3">効率</th>
                <th className="text-right px-3 py-3">最終実行</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((a, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px]">
                    <span className="truncate block" title={a.keyword_text}>{a.keyword_text}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">{a.total_runs}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{a.total_found.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-semibold text-blue-600">{a.success_count.toLocaleString()}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-medium ${a.success_rate >= 50 ? "text-emerald-600" : a.success_rate >= 20 ? "text-amber-600" : "text-red-500"}`}>
                      {a.success_rate}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-500">{a.duplicate_rate}%</td>
                  <td className="px-3 py-3 text-center text-slate-500">{a.rejected_rate}%</td>
                  <td className="px-3 py-3 text-center">
                    <EfficiencyBadge rate={a.success_rate} runs={a.total_runs} />
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-slate-400">
                    {a.last_run_at ? new Date(a.last_run_at).toLocaleDateString("ja-JP") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analytics.some((a) => a.error_count > 0) && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>一部キーワードでスクレイピングエラーが発生しています。除外キーワードやURLフィルタを確認してください。</span>
        </div>
      )}
    </div>
  );
}

export default function Keywords() {
  const { currentProject: selectedProject } = useProject();
  const [tab, setTab] = useState<"manage" | "analytics">("manage");
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);
  const [form, setForm] = useState({
    keyword: "",
    category: "",
    region: "",
    exclude_keywords: "",
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestIndustry, setActiveSuggestIndustry] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ keyword: "", category: "", region: "", exclude_keywords: "" });
  const [showEcTemplates, setShowEcTemplates] = useState(false);
  const [ecTemplates, setEcTemplates] = useState<EcKeywordTemplate[]>([]);
  const [selectedEcTemplate, setSelectedEcTemplate] = useState<string | null>(null);
  const [addingEcTemplate, setAddingEcTemplate] = useState(false);
  const [addedEcTemplates, setAddedEcTemplates] = useState<Set<string>>(new Set());

  const [showAiSuggest, setShowAiSuggest] = useState(false);
  const [aiSuggestUrl, setAiSuggestUrl] = useState("");
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestError, setAiSuggestError] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<AiKeywordSuggestion[]>([]);
  const [aiSuggestTitle, setAiSuggestTitle] = useState("");
  const [aiAddedSet, setAiAddedSet] = useState<Set<string>>(new Set());

  const fetchKeywords = () => {
    api.keywords.list().then((data) => setKeywords(data.keywords));
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  useEffect(() => {
    if (showEcTemplates && ecTemplates.length === 0) {
      api.keywords.ecTemplates().then((data) => {
        setEcTemplates(data.templates);
        if (data.templates.length > 0) setSelectedEcTemplate(data.templates[0].id);
      });
    }
  }, [showEcTemplates]);

  const handleAdd = () => {
    if (!form.keyword.trim()) return;
    api.keywords.create(form).then(() => {
      setForm({ keyword: "", category: "", region: "", exclude_keywords: "" });
      fetchKeywords();
    });
  };

  const handleDelete = (id: number) => {
    api.keywords.delete(id).then(() => fetchKeywords());
  };

  const handleEditStart = (kw: SearchKeyword) => {
    setEditingId(kw.id);
    setEditForm({
      keyword: kw.keyword,
      category: kw.category || "",
      region: kw.region || "",
      exclude_keywords: kw.exclude_keywords || "",
    });
  };

  const handleEditSave = (id: number) => {
    api.keywords.update(id, editForm).then(() => {
      setEditingId(null);
      fetchKeywords();
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const addDefaultKeywords = () => {
    Promise.all(DEFAULT_KEYWORDS.map((kw) => api.keywords.create(kw))).then(() => fetchKeywords());
  };

  const handleAiSuggest = async () => {
    if (!aiSuggestUrl.trim()) return;
    setAiSuggestLoading(true);
    setAiSuggestError("");
    setAiSuggestions([]);
    setAiAddedSet(new Set());
    try {
      const data = await api.keywords.aiSuggest(aiSuggestUrl.trim());
      setAiSuggestions(data.suggestions);
      setAiSuggestTitle(data.title);
    } catch (e: any) {
      setAiSuggestError(e?.response?.data?.detail || "分析に失敗しました");
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const handleAiAddOne = async (s: AiKeywordSuggestion) => {
    const projectId = selectedProject?.id;
    await api.keywords.create({ keyword: s.keyword, category: s.category, region: s.region, project_id: projectId });
    setAiAddedSet((prev) => new Set([...prev, s.keyword]));
    fetchKeywords();
  };

  const handleAiAddAll = async () => {
    const projectId = selectedProject?.id;
    const pending = aiSuggestions.filter((s) => !aiAddedSet.has(s.keyword));
    await Promise.all(pending.map((s) => api.keywords.create({ keyword: s.keyword, category: s.category, region: s.region, project_id: projectId })));
    setAiAddedSet(new Set(aiSuggestions.map((s) => s.keyword)));
    fetchKeywords();
  };

  const addEcTemplateKeywords = async (templateId: string) => {
    const tmpl = ecTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;
    setAddingEcTemplate(true);
    try {
      const projectId = selectedProject?.id;
      await Promise.all(
        tmpl.keywords.map((kw) =>
          api.keywords.create({ ...kw, project_id: projectId })
        )
      );
      setAddedEcTemplates((prev) => new Set([...prev, templateId]));
      fetchKeywords();
    } finally {
      setAddingEcTemplate(false);
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">検索条件管理</h2>
          <HelpTooltip text="キーワードと業種・地域を設定して企業を自動収集します。キーワードは複数登録でき、スケジュール収集にも使われます。" />
        </div>
        <div className="flex items-center gap-2">
          <HelpPanel
            title="検索条件管理のヘルプ"
            manualLinks={[
              { label: "初期セットアップ", description: "キーワード登録の手順を解説", to: "/manual#setup" },
              { label: "企業の収集", description: "キーワードから企業を収集する流れ", to: "/manual#collection" },
              { label: "キーワード分析", description: "各キーワードの成果を確認する方法", to: "/manual#keywords_analytics" },
            ]}
            tips={[
              "「業種キーワード」+「会社」+「地域」の組み合わせが最も収集精度が高くなります",
              "除外キーワードを設定すると不要な企業を自動でフィルタリングできます",
              "「デフォルトキーワード追加」で代表的なキーワードを一括登録できます",
              "分析タブで各キーワードの獲得率を確認し、効率の良いものに絞り込みましょう",
            ]}
          />
          {tab === "manage" && (
            <button
              onClick={addDefaultKeywords}
              className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors"
            >
              <Search size={16} />
              <span className="hidden sm:inline">デフォルトキーワード追加</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("manage")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "manage" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
        >
          <List size={15} />
          管理
        </button>
        <button
          onClick={() => setTab("analytics")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "analytics" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
        >
          <BarChart2 size={15} />
          分析
        </button>
      </div>

      {tab === "manage" ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3">
            <h3 className="font-semibold text-slate-700">新しいキーワードを追加</h3>

            {/* メイン入力行 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2 relative">
                <input
                  type="text"
                  placeholder="例: Web制作 会社 東京 　（業種 + 会社種別 + 地域）"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">カテゴリ選択</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="対象地域（例: 東京）"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="除外キーワード"
                  value={form.exclude_keywords}
                  onChange={(e) => setForm({ ...form, exclude_keywords: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAdd}
                  className="flex items-center justify-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  <Plus size={15} />
                  追加
                </button>
              </div>
            </div>

            {/* 入力ヒントトグル */}
            <div>
              <button
                onClick={() => setShowSuggestions((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Lightbulb size={13} />
                キーワード入力例を見る
                {showSuggestions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showSuggestions && (
                <div className="mt-3 border border-blue-100 rounded-lg bg-blue-50 p-3 space-y-3">
                  <p className="text-xs text-slate-500 font-medium">
                    「<span className="text-blue-700 font-semibold">業種キーワード</span>」＋「<span className="text-blue-700 font-semibold">会社 / 事務所</span>」＋「<span className="text-blue-700 font-semibold">地域</span>」の組み合わせが効果的です
                  </p>

                  {/* 業種タブ */}
                  <div className="flex flex-wrap gap-1.5">
                    {KEYWORD_SUGGESTIONS.map((s, i) => (
                      <button
                        key={s.industry}
                        onClick={() => setActiveSuggestIndustry(i)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          activeSuggestIndustry === i
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                        }`}
                      >
                        {s.industry}
                      </button>
                    ))}
                  </div>

                  {/* 選択業種の例 */}
                  <div>
                    <p className="text-xs text-slate-400 mb-1.5">クリックでキーワード欄に入力：</p>
                    <div className="flex flex-wrap gap-2">
                      {KEYWORD_SUGGESTIONS[activeSuggestIndustry].examples.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => setForm((f) => ({ ...f, keyword: ex }))}
                          className="text-xs px-3 py-1.5 bg-white hover:bg-blue-100 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 地域クイック追加 */}
                  <div className="pt-1 border-t border-blue-100">
                    <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                      <MapPin size={11} />地域を末尾に追加：
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {REGION_SUGGESTIONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setForm((f) => ({
                            ...f,
                            keyword: f.keyword ? `${f.keyword.trimEnd()} ${r}` : r,
                          }))}
                          className="text-xs px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-full transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AIキーワード提案 */}
          <div className="bg-white rounded-lg shadow-sm border border-violet-200 overflow-hidden">
            <button
              onClick={() => setShowAiSuggest((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold text-slate-700 text-sm">
                <Sparkles size={16} className="text-violet-500" />
                AIキーワード提案
                <span className="text-xs font-normal text-slate-400 hidden sm:inline">— 商品LP・URLからターゲットキーワードを自動生成</span>
              </span>
              {showAiSuggest ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showAiSuggest && (
              <div className="border-t border-violet-100 p-4 space-y-4">
                {/* URL入力 */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    商品・サービスのランディングページURLを入力すると、AIがターゲット企業を探すための検索キーワードを10件提案します。
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="url"
                        placeholder="https://example.com/lp/product"
                        value={aiSuggestUrl}
                        onChange={(e) => setAiSuggestUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAiSuggest()}
                        className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <button
                      onClick={handleAiSuggest}
                      disabled={aiSuggestLoading || !aiSuggestUrl.trim()}
                      className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {aiSuggestLoading ? (
                        <><RefreshCw size={14} className="animate-spin" />分析中...</>
                      ) : (
                        <><Sparkles size={14} />AIで分析</>
                      )}
                    </button>
                  </div>
                </div>

                {/* エラー */}
                {aiSuggestError && (
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    {aiSuggestError}
                  </div>
                )}

                {/* ローディング表示 */}
                {aiSuggestLoading && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-violet-400" />
                    LPを読み込んでAIが分析中です…（10〜20秒かかる場合があります）
                  </div>
                )}

                {/* 結果 */}
                {aiSuggestions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {aiSuggestTitle ? `「${aiSuggestTitle}」の` : ""}提案キーワード {aiSuggestions.length}件
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">各キーワードを個別に追加、または一括追加できます</p>
                      </div>
                      {aiSuggestions.some((s) => !aiAddedSet.has(s.keyword)) && (
                        <button
                          onClick={handleAiAddAll}
                          className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-violet-700 transition-colors font-medium"
                        >
                          <Plus size={13} />
                          未追加をすべて追加
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {aiSuggestions.map((s, i) => {
                        const added = aiAddedSet.has(s.keyword);
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                              added
                                ? "bg-emerald-50 border-emerald-200"
                                : "bg-slate-50 border-slate-200 hover:border-violet-200 hover:bg-violet-50"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800">{s.keyword}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {s.category && (
                                  <span className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                                    <Tag size={10} />
                                    {s.category}
                                  </span>
                                )}
                                {s.region && (
                                  <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                    <MapPin size={10} />
                                    {s.region}
                                  </span>
                                )}
                              </div>
                              {s.reason && (
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.reason}</p>
                              )}
                            </div>
                            <button
                              onClick={() => !added && handleAiAddOne(s)}
                              disabled={added}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                                added
                                  ? "bg-emerald-100 text-emerald-700 cursor-default"
                                  : "bg-violet-600 text-white hover:bg-violet-700"
                              }`}
                            >
                              {added ? (
                                <><CheckCircle2 size={12} />追加済み</>
                              ) : (
                                <><Plus size={12} />追加</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EC特化キーワードテンプレート */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => setShowEcTemplates((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold text-slate-700 text-sm">
                <ShoppingCart size={16} className="text-purple-500" />
                ECサイトオーナー向け　業種別キーワードテンプレート
                <span className="text-xs font-normal text-slate-400 hidden sm:inline">— ワンクリックで複数キーワードを一括登録</span>
              </span>
              {showEcTemplates ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {showEcTemplates && (
              <div className="border-t border-slate-200 p-4 space-y-4">
                {ecTemplates.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">読み込み中...</p>
                ) : (
                  <>
                    {/* 業種タブ */}
                    <div className="flex flex-wrap gap-2">
                      {ecTemplates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedEcTemplate(t.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            selectedEcTemplate === t.id
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-300 hover:border-purple-400 hover:text-purple-600"
                          }`}
                        >
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                          {addedEcTemplates.has(t.id) && <CheckCircle2 size={12} className="text-green-400" />}
                        </button>
                      ))}
                    </div>
                    {/* 選択した業種の詳細 */}
                    {selectedEcTemplate && (() => {
                      const tmpl = ecTemplates.find((t) => t.id === selectedEcTemplate);
                      if (!tmpl) return null;
                      return (
                        <div className="bg-purple-50 rounded-lg p-4 space-y-3 border border-purple-100">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-purple-800">{tmpl.icon} {tmpl.label}</p>
                              <p className="text-xs text-purple-600 mt-0.5">{tmpl.description}</p>
                            </div>
                            <button
                              onClick={() => addEcTemplateKeywords(tmpl.id)}
                              disabled={addingEcTemplate || addedEcTemplates.has(tmpl.id)}
                              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                                addedEcTemplates.has(tmpl.id)
                                  ? "bg-green-100 text-green-700 border border-green-300 cursor-default"
                                  : "bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                              }`}
                            >
                              {addedEcTemplates.has(tmpl.id) ? (
                                <><CheckCircle2 size={14} /> 追加済み</>
                              ) : addingEcTemplate ? (
                                <><RefreshCw size={14} className="animate-spin" /> 追加中...</>
                              ) : (
                                <><Plus size={14} /> {tmpl.keywords.length}件を一括追加</>
                              )}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {tmpl.keywords.map((kw, i) => (
                              <button
                                key={i}
                                onClick={() => setForm((f) => ({ ...f, keyword: kw.keyword, category: kw.category, region: kw.region }))}
                                className="text-xs px-2.5 py-1 bg-white hover:bg-purple-100 text-slate-700 hover:text-purple-700 border border-purple-200 hover:border-purple-400 rounded-full transition-colors"
                              >
                                {kw.keyword}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">キーワード</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">カテゴリ</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">地域</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">除外</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">登録日</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => {
                    const isEditing = editingId === kw.id;
                    return (
                      <tr key={kw.id} className={`border-b border-slate-100 ${isEditing ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                        {isEditing ? (
                          <>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={editForm.keyword}
                                onChange={(e) => setEditForm({ ...editForm, keyword: e.target.value })}
                                className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={editForm.category}
                                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">-</option>
                                {CATEGORIES.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={editForm.region}
                                onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                                placeholder="地域"
                                className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={editForm.exclude_keywords}
                                onChange={(e) => setEditForm({ ...editForm, exclude_keywords: e.target.value })}
                                placeholder="除外"
                                className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-2 text-slate-500 text-xs">
                              {kw.created_at ? new Date(kw.created_at).toLocaleDateString("ja-JP") : "-"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEditSave(kw.id)}
                                  className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-100"
                                  title="保存"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={handleEditCancel}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                                  title="キャンセル"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-medium text-slate-800">{kw.keyword}</td>
                            <td className="px-4 py-3 text-slate-600">{kw.category || "-"}</td>
                            <td className="px-4 py-3 text-slate-600">{kw.region || "-"}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{kw.exclude_keywords || "-"}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {kw.created_at ? new Date(kw.created_at).toLocaleDateString("ja-JP") : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEditStart(kw)}
                                  className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"
                                  title="編集"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => handleDelete(kw.id)}
                                  className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                  title="削除"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {keywords.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <Search size={22} className="text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-600 mb-1">キーワードが登録されていません</p>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                              上のフォームからキーワードを追加するか、「デフォルトキーワード追加」ボタンで代表的なキーワードを一括登録できます
                            </p>
                          </div>
                          <button
                            onClick={addDefaultKeywords}
                            className="text-xs bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            デフォルトキーワードを追加する
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <AnalyticsTab projectId={selectedProject?.id ?? null} />
      )}
    </div>
  );
}
