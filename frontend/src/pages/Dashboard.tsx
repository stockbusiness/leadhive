import { useEffect, useState } from "react";
import { Building2, Search, Phone, Star, AlertCircle, Zap, Clock, TrendingUp, Bell, ChevronRight, CalendarClock, MessageCircle, Crown, Users, AlertTriangle, Lock, ShoppingCart } from "lucide-react";
import HelpTooltip from "../components/HelpTooltip";
import SetupProgressCard from "../components/SetupProgressCard";
import HelpPanel from "../components/HelpPanel";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { api } from "../api";
import { RANK_COLORS, PIE_COLORS, SCORE_BADGE_COLORS } from "../constants";
import { StatCard } from "../components/common";
import type { DashboardData, Company, PlanData } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useProject } from "../contexts/ProjectContext";

const FUNNEL_STATUSES = ["未確認", "対象候補", "アプローチ前", "フォーム送信済", "返信あり", "面談化", "代理店化"];
const FUNNEL_COLORS = ["#94a3b8", "#60a5fa", "#818cf8", "#f59e0b", "#f97316", "#a855f7", "#10b981"];

function formatFollowUpDate(dateStr: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}日超過`, overdue: true };
  if (diff === 0) return { label: "今日", overdue: false };
  return { label: `${diff}日後`, overdue: false };
}

type TeamMember = {
  user_id: number; display_name: string; email: string;
  assigned_count: number; status_breakdown: Record<string, number>;
  activity_count_this_week: number; overdue_followups: number;
};
type TeamData = {
  members: TeamMember[];
  team_summary: { total_collected_this_month: number; approached_count: number; meeting_count: number; overdue_count: number };
};

export default function Dashboard() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const isSystemAdmin = !!user?.is_system_admin;
  const [data, setData] = useState<DashboardData | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanData | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "team">("overview");
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    api.dashboard.get().then(setData);
    api.plans.current().then((d) => setCurrentPlan(d.plan ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "team" && !teamData) {
      setTeamLoading(true);
      api.dashboard.team().then(setTeamData).catch(() => {}).finally(() => setTeamLoading(false));
    }
  }, [activeTab, teamData]);

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

  const funnelData = FUNNEL_STATUSES.map((s, i) => ({
    name: s,
    value: data.by_status[s] || 0,
    fill: FUNNEL_COLORS[i],
  })).filter(d => d.value > 0);

  const usagePercent = Math.min(100, (data.api_usage_today / data.api_daily_limit) * 100);

  const todayFollowups = data.today_followups || [];
  const topUncontacted = data.top_uncontacted || [];
  const repliedCompanies = data.replied_companies || [];
  const hasActions = todayFollowups.length > 0 || repliedCompanies.length > 0 || topUncontacted.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">ダッシュボード</h2>
            <HelpTooltip text="現在のプロジェクトの収集状況・スコア分布・フォローアップ予定をまとめて確認できます。" />
          </div>
          {currentPlan && (
            <span className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
              <Crown size={12} />
              {currentPlan.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <HelpPanel
            title="ダッシュボードのヘルプ"
            manualLinks={[
              { label: "はじめに・基本フロー", description: "LeadHiveの全体像と使い方の流れ", to: "/manual#overview" },
              { label: "ダッシュボードの見方", description: "各グラフ・数値の意味を解説", to: "/manual#dashboard" },
              { label: "初期セットアップ", description: "APIキー・メール設定など", to: "/manual#setup" },
            ]}
            tips={[
              "プロジェクトを切り替えるとグラフも切り替わります",
              "フォローアップ期限を設定すると、ダッシュボードに通知が表示されます",
              "チームタブは管理者・オーナーのみ閲覧できます",
            ]}
          />
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "overview" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <TrendingUp size={14} />
            概要
          </button>
          {(isSystemAdmin || user?.role === "admin") ? (
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "team" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users size={14} />
              チーム
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("plan-limit-exceeded", { detail: { message: "チームダッシュボードは有料プランで利用できます。" } }))}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium text-slate-400 cursor-not-allowed"
            >
              <Lock size={14} />
              チーム
            </button>
          )}
          </div>
        </div>
      </div>

      {/* ===== チーム進捗タブ ===== */}
      {activeTab === "team" && (
        <div className="space-y-5">
          {teamLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-400">読み込み中...</div>
          ) : teamData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<TrendingUp size={18} className="text-blue-600" />} label="今月の新規収集" value={teamData.team_summary.total_collected_this_month} color="bg-blue-50" />
                <StatCard icon={<Phone size={18} className="text-indigo-600" />} label="アプローチ済み" value={teamData.team_summary.approached_count} color="bg-indigo-50" />
                <StatCard icon={<Users size={18} className="text-green-600" />} label="面談・商談化" value={teamData.team_summary.meeting_count} color="bg-green-50" />
                <StatCard icon={<AlertTriangle size={18} className="text-red-600" />} label="期限超過" value={teamData.team_summary.overdue_count} color="bg-red-50" />
              </div>

              {teamData.members.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <Users size={16} className="text-slate-500" />
                    <h3 className="font-semibold text-slate-700">担当者別進捗</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">担当者</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">担当企業</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">今週の活動</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">期限超過</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 min-w-[200px]">ステータス内訳</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamData.members.map((m) => {
                          const approached = Object.entries(m.status_breakdown)
                            .filter(([s]) => ["フォーム送信済","コンタクト済み","返信あり","面談化","商談中","代理店化"].includes(s))
                            .reduce((sum, [, c]) => sum + c, 0);
                          return (
                            <tr key={m.user_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                                    {m.display_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-800 text-sm">{m.display_name}</div>
                                    <div className="text-xs text-slate-400">{m.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-700">{m.assigned_count}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{m.activity_count_this_week}</td>
                              <td className="px-4 py-3 text-right">
                                {m.overdue_followups > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                    <AlertTriangle size={12} />
                                    {m.overdue_followups}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {m.assigned_count > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[80px]">
                                      <div
                                        className="h-2 rounded-full bg-blue-500 transition-all"
                                        style={{ width: `${Math.min(100, (approached / m.assigned_count) * 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                      {approached}/{m.assigned_count} アプローチ済
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">未割当</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {teamData.members.some(m => m.assigned_count > 0) && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Users size={14} className="text-blue-500" />
                    担当企業数（担当者別）
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={teamData.members.map(m => ({ name: m.display_name, 担当: m.assigned_count, アプローチ: Object.entries(m.status_breakdown).filter(([s]) => ["フォーム送信済","コンタクト済み","返信あり","面談化","商談中","代理店化"].includes(s)).reduce((s,[,c]) => s+c, 0) }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                      <Bar dataKey="担当" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="アプローチ" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-slate-400">データを取得できませんでした</div>
          )}
        </div>
      )}

      {activeTab === "overview" && <>
      {/* ===== セットアップ進捗 ===== */}
      <SetupProgressCard />

      {/* ===== 今日のアクション ===== */}
      {hasActions && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200">
            <Bell size={16} className="text-indigo-600" />
            <h3 className="font-semibold text-slate-700">今日のアクション</h3>
            <span className="text-xs text-slate-500 ml-1">— 対応が必要な企業</span>
          </div>
          <div className="divide-y divide-slate-100">
            {todayFollowups.length > 0 && (
              <ActionGroup
                icon={<CalendarClock size={14} className="text-red-500" />}
                label="フォローアップ期限"
                badgeColor="bg-red-100 text-red-700"
                companies={todayFollowups}
                renderBadge={(c) => {
                  if (!c.follow_up_date) return null;
                  const { label, overdue } = formatFollowUpDate(c.follow_up_date);
                  return (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {label}
                    </span>
                  );
                }}
              />
            )}
            {repliedCompanies.length > 0 && (
              <ActionGroup
                icon={<MessageCircle size={14} className="text-purple-500" />}
                label="返信あり（要対応）"
                badgeColor="bg-purple-100 text-purple-700"
                companies={repliedCompanies}
              />
            )}
            {topUncontacted.length > 0 && (
              <ActionGroup
                icon={<Star size={14} className="text-emerald-500" />}
                label="未対応の高スコア企業"
                badgeColor="bg-emerald-100 text-emerald-700"
                companies={topUncontacted}
                renderBadge={(c) => (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${SCORE_BADGE_COLORS[c.score_rank] || SCORE_BADGE_COLORS.D}`}>
                    {c.score_rank} {c.score_total}点
                  </span>
                )}
              />
            )}
          </div>
        </div>
      )}

      {/* ===== 統計カード ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="総収集件数" value={data.total} icon={<Building2 size={20} />} color="bg-blue-500" />
        <StatCard label="重複除外後" value={data.unique_domains} icon={<Search size={20} />} color="bg-indigo-500" />
        <StatCard label="未確認" value={data.unconfirmed} icon={<AlertCircle size={20} />} color="bg-amber-500" />
        <StatCard label="高スコア (A/B)" value={data.high_score} icon={<Star size={20} />} color="bg-emerald-500" />
        <StatCard label="問い合わせあり" value={data.with_contact} icon={<Phone size={20} />} color="bg-purple-500" />
        <ApiUsageCard usage={data.api_usage_today} limit={data.api_daily_limit} percent={usagePercent} />
      </div>

      {/* ===== EC統計カード ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center gap-4">
          <div className="bg-orange-500 text-white p-2.5 rounded-lg flex-shrink-0">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">EC企業数</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{data.ec_companies ?? 0}<span className="text-sm font-normal text-slate-400 ml-1">社</span></p>
            <p className="text-xs text-slate-400 mt-0.5">EC判定フラグが立っている企業</p>
          </div>
        </div>

        <ChartCard title="ECプラットフォーム分布">
          {data.ec_platform_distribution && Object.keys(data.ec_platform_distribution).length > 0 ? (() => {
            const platformData = Object.entries(data.ec_platform_distribution!).map(([name, value]) => ({ name, value }));
            const PLATFORM_COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6"];
            return (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                  >
                    {platformData.map((_, i) => (
                      <Cell key={i} fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | string | undefined) => [`${v ?? 0}社`, ""]} />
                  <Legend
                    formatter={(value, entry) => (
                      <span style={{ fontSize: 11, color: "#475569" }}>
                        {value} {(entry.payload as { value?: number })?.value ?? 0}社
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            );
          })() : (
            <div className="flex flex-col items-center justify-center h-[200px] text-slate-400 text-sm gap-2">
              <ShoppingCart size={24} className="text-slate-300" />
              <p>プラットフォームデータなし</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ===== 営業ファネル ===== */}
      {funnelData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-500" />
            営業ファネル
          </h3>
          <div className="space-y-2">
            {funnelData.map((d, i) => {
              const max = Math.max(...funnelData.map(x => x.value));
              const pct = max > 0 ? (d.value / max) * 100 : 0;
              const prev = funnelData[i - 1];
              const convRate = prev && prev.value > 0 ? Math.round((d.value / prev.value) * 100) : null;
              return (
                <div key={d.name} className="flex items-center gap-3">
                  <div className="w-24 text-right text-xs text-slate-500 flex-shrink-0">{d.name}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-7 relative overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: d.fill }}
                    >
                      <span className="text-white text-xs font-bold drop-shadow">{d.value}</span>
                    </div>
                  </div>
                  <div className="w-16 text-xs text-slate-400 flex-shrink-0">
                    {convRate !== null && (
                      <span className={`font-medium ${convRate >= 30 ? "text-emerald-600" : convRate >= 10 ? "text-amber-600" : "text-red-500"}`}>
                        ↑{convRate}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3">※ 矢印は前ステータスからの転換率</p>
        </div>
      )}

      {/* ===== 既存グラフ ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="カテゴリ別内訳">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
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

      {data.daily_collection_trend && data.daily_collection_trend.length > 0 && (() => {
        const ecByDate = new Map((data.ec_daily_trend || []).map((d: any) => [d.date, d.count]));
        const combinedTrend = data.daily_collection_trend.map((d: any) => ({
          date: d.date,
          全体: d.count,
          EC企業: ecByDate.get(d.date) ?? 0,
        }));
        return (
          <ChartCard title={`直近30日の収集件数推移（${currentProject ? currentProject.name : "全プロジェクト"}）`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={combinedTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v) => `${v}`}
                  formatter={(v: any, name: string | undefined) => [`${v}件`, name ?? ""]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="全体" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="EC企業" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        );
      })()}

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
      </>}
    </div>
  );
}

function ActionGroup({
  icon, label, companies, renderBadge,
}: {
  icon: React.ReactNode;
  label: string;
  badgeColor: string;
  companies: Company[];
  renderBadge?: (c: Company) => React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="text-xs text-slate-400">({companies.length}件)</span>
      </div>
      <div className="space-y-1.5">
        {companies.map((c) => (
          <div key={c.id} className="flex items-center gap-3 text-sm">
            <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />
            <span className="flex-1 text-slate-700 truncate">{c.company_name || c.domain}</span>
            <span className="text-xs text-slate-400">{c.status}</span>
            {renderBadge && renderBadge(c)}
          </div>
        ))}
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
