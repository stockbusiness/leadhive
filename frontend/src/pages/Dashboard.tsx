import { useEffect, useState } from "react";
import axios from "axios";
import { Building2, Search, Phone, Star, AlertCircle, Zap, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface CompanyBrief {
  id: number;
  company_name: string;
  domain: string;
  score_total: number;
  score_rank: string;
  category_main: string;
  created_at: string;
}

interface DashboardData {
  total: number;
  unique_domains: number;
  unconfirmed: number;
  high_score: number;
  with_contact: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  by_rank: Record<string, number>;
  by_prefecture: Record<string, number>;
  recent_companies: CompanyBrief[];
  api_usage_today: number;
  api_daily_limit: number;
}

const RANK_COLORS: Record<string, string> = {
  A: "#10b981",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#94a3b8",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    axios.get("/api/dashboard").then((res) => setData(res.data));
  }, []);

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  const categoryData = Object.entries(data.by_category)
    .filter(([k]) => k)
    .map(([name, value]) => ({ name, value }));

  const rankData = Object.entries(data.by_rank)
    .filter(([k]) => k)
    .map(([name, value]) => ({ name: `ランク${name}`, value, fill: RANK_COLORS[name] || "#94a3b8" }));

  const statusData = Object.entries(data.by_status)
    .filter(([k]) => k)
    .map(([name, value]) => ({ name, value }));

  const prefectureData = Object.entries(data.by_prefecture)
    .filter(([k]) => k)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  const usagePercent = Math.min(100, (data.api_usage_today / data.api_daily_limit) * 100);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">ダッシュボード</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard label="総収集件数" value={data.total} icon={<Building2 size={20} />} color="bg-blue-500" />
        <StatCard label="重複除外後" value={data.unique_domains} icon={<Search size={20} />} color="bg-indigo-500" />
        <StatCard label="未確認" value={data.unconfirmed} icon={<AlertCircle size={20} />} color="bg-amber-500" />
        <StatCard label="高スコア (A/B)" value={data.high_score} icon={<Star size={20} />} color="bg-emerald-500" />
        <StatCard label="問い合わせあり" value={data.with_contact} icon={<Phone size={20} />} color="bg-purple-500" />
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-slate-500">API使用量</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {data.api_usage_today}<span className="text-sm font-normal text-slate-400">/{data.api_daily_limit}</span>
              </p>
            </div>
            <div className="bg-cyan-500 text-white p-2 rounded-lg"><Zap size={20} /></div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-amber-500" : "bg-cyan-500"}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">残り {data.api_daily_limit - data.api_usage_today} 回</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-3">カテゴリ別内訳</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">データなし</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-3">スコアランク分布</h3>
          {rankData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={rankData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="件数" radius={[4, 4, 0, 0]}>
                  {rankData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">データなし</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-3">ステータス別</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="件数" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">データなし</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-3">都道府県別（上位10）</h3>
          {prefectureData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={prefectureData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="件数" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">データなし</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Clock size={16} />
          最近追加された企業
        </h3>
        {data.recent_companies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-medium text-slate-600">会社名</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">カテゴリ</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-600">スコア</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">追加日時</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_companies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{c.company_name || c.domain}</td>
                    <td className="px-3 py-2 text-slate-600">{c.category_main || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        c.score_rank === "A" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                        c.score_rank === "B" ? "bg-blue-100 text-blue-800 border-blue-200" :
                        c.score_rank === "C" ? "bg-amber-100 text-amber-800 border-amber-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {c.score_rank} {c.score_total}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("ja-JP") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">まだ企業が追加されていません</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={`${color} text-white p-2 rounded-lg`}>{icon}</div>
      </div>
    </div>
  );
}
