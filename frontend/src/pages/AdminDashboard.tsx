import { useEffect, useState } from "react";
import { LayoutDashboard, Building2, Users, FolderKanban, Database, Zap, BarChart2, Loader2, RefreshCw, TrendingUp, Brain, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { api } from "../api";

type DashStats = {
  org_count: number;
  user_count: number;
  project_count: number;
  company_count: number;
  month_collections: number;
  today_api_count: number;
  daily_collections: { date: string; count: number }[];
  plan_distribution: { name: string; count: number }[];
};

type AiCostRow = {
  org_id: number;
  org_name: string;
  month: string;
  total_input_tokens: number;
  total_output_tokens: number;
  call_count: number;
  cost_usd: number;
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#64748b"];

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-slate-800">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [aiCosts, setAiCosts] = useState<AiCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [r, costsRes] = await Promise.all([
        api.adminDashboard.get(),
        api.adminDashboard.aiCosts().catch(() => ({ costs: [] })),
      ]);
      setStats(r);
      setAiCosts(costsRes.costs);
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">{error}</div>
    </div>
  );

  const totalAiCostUsd = aiCosts.reduce((s, r) => s + r.cost_usd, 0);
  const totalAiCalls = aiCosts.reduce((s, r) => s + r.call_count, 0);

  const aiCostByOrg = Object.values(
    aiCosts.reduce<Record<number, { org_name: string; cost_usd: number; call_count: number }>>((acc, row) => {
      if (!acc[row.org_id]) acc[row.org_id] = { org_name: row.org_name, cost_usd: 0, call_count: 0 };
      acc[row.org_id].cost_usd += row.cost_usd;
      acc[row.org_id].call_count += row.call_count;
      return acc;
    }, {})
  ).sort((a, b) => b.cost_usd - a.cost_usd).slice(0, 10);

  const recentMonths = Array.from(new Set(aiCosts.map(r => r.month))).sort().reverse().slice(0, 3);
  const aiCostTrend = recentMonths.map(m => ({
    month: m,
    cost: aiCosts.filter(r => r.month === m).reduce((s, r) => s + r.cost_usd, 0),
    calls: aiCosts.filter(r => r.month === m).reduce((s, r) => s + r.call_count, 0),
  })).reverse();

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutDashboard size={24} className="text-blue-600" />
            管理ダッシュボード
          </h1>
          <p className="text-sm text-slate-500 mt-1">システム全体の利用状況をリアルタイムで確認</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          <RefreshCw size={14} />更新
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={<Building2 size={18} className="text-blue-600" />} label="テナント数" value={stats?.org_count ?? 0} color="bg-blue-50" />
        <StatCard icon={<Users size={18} className="text-green-600" />} label="ユーザー数" value={stats?.user_count ?? 0} color="bg-green-50" />
        <StatCard icon={<FolderKanban size={18} className="text-purple-600" />} label="プロジェクト数" value={stats?.project_count ?? 0} color="bg-purple-50" />
        <StatCard icon={<Database size={18} className="text-orange-600" />} label="総企業数" value={stats?.company_count ?? 0} color="bg-orange-50" />
        <StatCard icon={<TrendingUp size={18} className="text-teal-600" />} label="今月の収集数" value={stats?.month_collections ?? 0} sub="収集成功件数" color="bg-teal-50" />
        <StatCard icon={<Zap size={18} className="text-yellow-600" />} label="本日のAPI使用量" value={stats?.today_api_count ?? 0} sub="Google API リクエスト" color="bg-yellow-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-blue-500" />
            過去7日間の収集件数
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats?.daily_collections ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="count" name="収集数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-purple-500" />
            プラン別テナント数
          </h2>
          {stats?.plan_distribution && stats.plan_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.plan_distribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, count }) => `${name}: ${count}`}
                  labelLine={false}
                >
                  {stats.plan_distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">データなし</div>
          )}
        </div>
      </div>

      {/* ===== AI コスト管理セクション ===== */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Brain size={18} className="text-violet-600" />
          <h2 className="text-lg font-bold text-slate-800">AI コスト管理</h2>
          <span className="text-xs text-slate-400 ml-1">GPT-4o-mini 基準（入力 $0.15/1M・出力 $0.60/1M）</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-violet-600 font-medium">累計コスト</span>
              <DollarSign size={16} className="text-violet-500" />
            </div>
            <div className="text-2xl font-bold text-violet-800">${totalAiCostUsd.toFixed(4)}</div>
            <div className="text-xs text-violet-400 mt-0.5">全期間合計</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-indigo-600 font-medium">API呼び出し回数</span>
              <Zap size={16} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-indigo-800">{totalAiCalls.toLocaleString()}</div>
            <div className="text-xs text-indigo-400 mt-0.5">全期間合計</div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-blue-600 font-medium">今月コスト</span>
              <BarChart2 size={16} className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-800">
              ${(aiCostTrend[aiCostTrend.length - 1]?.cost ?? 0).toFixed(4)}
            </div>
            <div className="text-xs text-blue-400 mt-0.5">{aiCostTrend[aiCostTrend.length - 1]?.month ?? "—"}</div>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-teal-600 font-medium">集計テナント数</span>
              <Building2 size={16} className="text-teal-500" />
            </div>
            <div className="text-2xl font-bold text-teal-800">{aiCostByOrg.length}</div>
            <div className="text-xs text-teal-400 mt-0.5">AI使用中</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {aiCostByOrg.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Building2 size={14} className="text-violet-500" />
                組織別累計コスト（上位10）
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aiCostByOrg} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                  <YAxis type="category" dataKey="org_name" width={90} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(v: any) => [`$${Number(v).toFixed(4)}`, "コスト"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="cost_usd" name="コスト (USD)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-center h-48 text-slate-400 text-sm">
              AI使用履歴なし
            </div>
          )}

          {aiCostTrend.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-indigo-500" />
                月次コスト推移
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aiCostTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                  <Tooltip
                    formatter={(v: any, name: string) => [name === "cost" ? `$${Number(v).toFixed(4)}` : v, name === "cost" ? "コスト" : "API呼び出し"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="cost" name="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-center h-48 text-slate-400 text-sm">
              月次データなし
            </div>
          )}
        </div>

        {aiCosts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-4">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Brain size={14} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-700">月別・組織別詳細</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">組織</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">月</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">入力トークン</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">出力トークン</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">API呼出</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">コスト (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {aiCosts.slice(0, 30).map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{row.org_name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.month}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{row.total_input_tokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{row.total_output_tokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{row.call_count}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-violet-700">${row.cost_usd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
