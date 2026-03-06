import { useEffect, useState } from "react";
import axios from "axios";
import { Building2, Search, Phone, Star, AlertCircle } from "lucide-react";

interface DashboardData {
  total: number;
  unique_domains: number;
  unconfirmed: number;
  high_score: number;
  with_contact: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  by_rank: Record<string, number>;
}

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

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">ダッシュボード</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="総収集件数"
          value={data.total}
          icon={<Building2 size={20} />}
          color="bg-blue-500"
        />
        <StatCard
          label="重複除外後"
          value={data.unique_domains}
          icon={<Search size={20} />}
          color="bg-indigo-500"
        />
        <StatCard
          label="未確認"
          value={data.unconfirmed}
          icon={<AlertCircle size={20} />}
          color="bg-amber-500"
        />
        <StatCard
          label="高スコア (A/B)"
          value={data.high_score}
          icon={<Star size={20} />}
          color="bg-emerald-500"
        />
        <StatCard
          label="問い合わせあり"
          value={data.with_contact}
          icon={<Phone size={20} />}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BreakdownCard title="カテゴリ別" data={data.by_category} />
        <BreakdownCard title="ステータス別" data={data.by_status} />
        <BreakdownCard title="スコアランク別" data={data.by_rank} />
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

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([k]) => k);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-700 mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">データなし</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, count]) => (
            <div key={key} className="flex justify-between items-center text-sm">
              <span className="text-slate-600">{key || "未分類"}</span>
              <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
