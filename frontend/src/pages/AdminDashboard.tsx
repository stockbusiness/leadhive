import { useEffect, useState } from "react";
import { LayoutDashboard, Building2, Users, FolderKanban, Database, Zap, BarChart2, Loader2, RefreshCw, TrendingUp } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.adminDashboard.get();
      setStats(r);
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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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
    </div>
  );
}
