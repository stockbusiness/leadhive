import { useEffect, useState } from "react";
import { Plus, Trash2, Search, BarChart2, List, TrendingUp, Zap, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Lightbulb, MapPin } from "lucide-react";
import HelpTooltip from "../components/HelpTooltip";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api";
import { CATEGORIES, DEFAULT_KEYWORDS, KEYWORD_SUGGESTIONS, REGION_SUGGESTIONS } from "../constants";
import type { SearchKeyword, KeywordAnalytics, KeywordAnalyticsSummary } from "../types";
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

  const fetchKeywords = () => {
    api.keywords.list().then((data) => setKeywords(data.keywords));
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

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

  const addDefaultKeywords = () => {
    Promise.all(DEFAULT_KEYWORDS.map((kw) => api.keywords.create(kw))).then(() => fetchKeywords());
  };

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">検索条件管理</h2>
          <HelpTooltip text="キーワードと業種・地域を設定して企業を自動収集します。キーワードは複数登録でき、スケジュール収集にも使われます。" />
        </div>
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
                  {keywords.map((kw) => (
                    <tr key={kw.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{kw.keyword}</td>
                      <td className="px-4 py-3 text-slate-600">{kw.category || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{kw.region || "-"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{kw.exclude_keywords || "-"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {kw.created_at ? new Date(kw.created_at).toLocaleDateString("ja-JP") : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(kw.id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {keywords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        キーワードが登録されていません。上のフォームから追加するか、「デフォルトキーワード追加」ボタンを押してください。
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
