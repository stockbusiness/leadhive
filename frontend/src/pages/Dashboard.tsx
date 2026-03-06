import { useEffect, useState } from "react";
import { Building2, Search, Phone, Star, AlertCircle, Zap, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { api } from "../api";
import { RANK_COLORS, PIE_COLORS, SCORE_BADGE_COLORS } from "../constants";
import { StatCard } from "../components/common";
import type { DashboardData } from "../types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.dashboard.get().then(setData);
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
        <ApiUsageCard usage={data.api_usage_today} limit={data.api_daily_limit} percent={usagePercent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="カテゴリ別内訳">
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
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="スコアランク分布">
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
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="ステータス別">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="件数" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="都道府県別（上位10）">
          {prefectureData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={prefectureData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="件数" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
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
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${SCORE_BADGE_COLORS[c.score_rank] || SCORE_BADGE_COLORS.D}`}>
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

function ApiUsageCard({ usage, limit, percent }: { usage: number; limit: number; percent: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm text-slate-500">API使用量</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {usage}<span className="text-sm font-normal text-slate-400">/{limit}</span>
          </p>
        </div>
        <div className="bg-cyan-500 text-white p-2 rounded-lg"><Zap size={20} /></div>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-cyan-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">残り {limit - usage} 回</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <p className="text-sm text-slate-400 py-8 text-center">データなし</p>;
}
