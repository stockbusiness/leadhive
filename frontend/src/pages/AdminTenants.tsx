import { useEffect, useState } from "react";
import { Building2, Users, Database, FolderKanban, Crown, Pencil, Check, X, Loader2, RefreshCw, AlertTriangle, TrendingUp, Clock, ShoppingBag } from "lucide-react";
import { api } from "../api";

type Tenant = {
  id: number;
  name: string;
  plan_id: number | null;
  plan_name: string | null;
  member_count: number;
  company_count: number;
  project_count: number;
  collections_this_month: number;
  last_login_at: string | null;
  is_churn_risk: boolean;
  created_at: string | null;
  feature_ec_discovery: boolean;
};

type Plan = {
  id: number;
  name: string;
  price_monthly: number | null;
};

function StatBadge({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-600">
      <span className="text-slate-400">{icon}</span>
      <span className="font-medium text-slate-700">{value.toLocaleString()}</span>
      <span className="text-slate-400 text-xs">{label}</span>
    </div>
  );
}

function PlanBadge({ name }: { name: string | null }) {
  if (!name) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">未割当</span>;
  const colors: Record<string, string> = {
    "エンタープライズ": "bg-purple-100 text-purple-700",
    "プロ": "bg-blue-100 text-blue-700",
    "スターター": "bg-green-100 text-green-700",
    "フリー": "bg-slate-100 text-slate-600",
  };
  const color = Object.entries(colors).find(([k]) => name.includes(k))?.[1] ?? "bg-amber-100 text-amber-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Crown size={10} />
      {name}
    </span>
  );
}

function formatLastLogin(dateStr: string | null): { text: string; daysAgo: number | null } {
  if (!dateStr) return { text: "未ログイン", daysAgo: null };
  const d = new Date(dateStr);
  const now = new Date();
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo === 0) return { text: "今日", daysAgo: 0 };
  if (daysAgo === 1) return { text: "昨日", daysAgo: 1 };
  if (daysAgo < 30) return { text: `${daysAgo}日前`, daysAgo };
  return { text: d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }), daysAgo };
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        api.tenants.list(),
        api.plans.list(),
      ]);
      setTenants(tenantsRes.tenants);
      setPlans(plansRes.plans as Plan[]);
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const startEdit = (t: Tenant) => {
    setEditingId(t.id);
    setEditPlanId(t.plan_id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPlanId(null);
  };

  const saveEdit = async (orgId: number) => {
    setSaving(true);
    try {
      await api.tenants.update(orgId, { plan_id: editPlanId ?? undefined });
      setSuccess("プランを更新しました");
      setTimeout(() => setSuccess(""), 3000);
      setEditingId(null);
      await fetchData();
    } catch {
      setError("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const toggleEcDiscovery = async (orgId: number, enabled: boolean) => {
    try {
      await api.tenants.update(orgId, { feature_ec_discovery: enabled });
      setTenants(prev => prev.map(t => t.id === orgId ? { ...t, feature_ec_discovery: enabled } : t));
      setSuccess(`EC収集機能を${enabled ? "有効" : "無効"}にしました`);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("更新に失敗しました");
    }
  };

  const churnRiskCount = tenants.filter(t => t.is_churn_risk).length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 size={24} className="text-blue-600" />
            テナント管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">登録されているすべての組織とそのプランを管理します</p>
        </div>
        <div className="flex items-center gap-3">
          {churnRiskCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
              <AlertTriangle size={14} />
              解約リスク: <strong>{churnRiskCount}</strong> 件
            </div>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            更新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-1">ID</div>
            <div className="col-span-2">組織名</div>
            <div className="col-span-2">プラン</div>
            <div className="col-span-2">利用状況</div>
            <div className="col-span-1">最終利用日</div>
            <div className="col-span-1 text-center">今月収集</div>
            <div className="col-span-1 text-center">EC収集</div>
            <div className="col-span-1 text-center">状態</div>
            <div className="col-span-1 text-right">操作</div>
          </div>

          {tenants.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">組織が登録されていません</div>
          ) : (
            tenants.map(t => {
              const loginInfo = formatLastLogin(t.last_login_at);
              return (
                <div key={t.id} className={`grid grid-cols-12 gap-2 px-4 py-3.5 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 transition-colors ${t.is_churn_risk ? "bg-red-50/30" : ""}`}>
                  <div className="col-span-1 text-xs text-slate-400 font-mono">{t.id}</div>

                  <div className="col-span-2">
                    <span className="font-medium text-slate-800 text-sm">{t.name}</span>
                  </div>

                  <div className="col-span-2">
                    {editingId === t.id ? (
                      <select
                        value={editPlanId ?? ""}
                        onChange={e => setEditPlanId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">未割当</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.price_monthly != null ? ` (¥${p.price_monthly.toLocaleString()})` : " (無料)"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <PlanBadge name={t.plan_name} />
                    )}
                  </div>

                  <div className="col-span-2">
                    <div className="flex flex-col gap-0.5">
                      <StatBadge icon={<Users size={12} />} value={t.member_count} label="メンバー" />
                      <StatBadge icon={<Building2 size={12} />} value={t.company_count} label="企業" />
                      <StatBadge icon={<FolderKanban size={12} />} value={t.project_count} label="PJ" />
                    </div>
                  </div>

                  <div className="col-span-1">
                    {t.last_login_at ? (
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className={loginInfo.daysAgo !== null && loginInfo.daysAgo > 14 ? "text-orange-400" : "text-slate-400"} />
                        <span className={`text-xs ${loginInfo.daysAgo !== null && loginInfo.daysAgo > 14 ? "text-orange-600 font-medium" : "text-slate-500"}`}>
                          {loginInfo.text}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">未ログイン</span>
                    )}
                  </div>

                  <div className="col-span-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp size={12} className="text-teal-500" />
                      <span className="text-sm font-semibold text-slate-700">{t.collections_this_month}</span>
                    </div>
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => toggleEcDiscovery(t.id, !t.feature_ec_discovery)}
                      title={t.feature_ec_discovery ? "EC収集を無効にする" : "EC収集を有効にする"}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        t.feature_ec_discovery
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      <ShoppingBag size={11} />
                      {t.feature_ec_discovery ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="col-span-1 text-center">
                    {t.is_churn_risk ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        <AlertTriangle size={10} />
                        30日未利用
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        正常
                      </span>
                    )}
                  </div>

                  <div className="col-span-1 flex justify-end gap-1">
                    {editingId === t.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(t.id)}
                          disabled={saving}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="保存"
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                          title="キャンセル"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="プランを変更"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        <Database size={14} />
        <span>合計 <strong className="text-slate-700">{tenants.length}</strong> テナント</span>
        <span className="mx-2 text-slate-300">|</span>
        <Users size={14} />
        <span>総メンバー <strong className="text-slate-700">{tenants.reduce((s, t) => s + t.member_count, 0)}</strong> 名</span>
        <span className="mx-2 text-slate-300">|</span>
        <Building2 size={14} />
        <span>総企業数 <strong className="text-slate-700">{tenants.reduce((s, t) => s + t.company_count, 0).toLocaleString()}</strong> 件</span>
        {churnRiskCount > 0 && (
          <>
            <span className="mx-2 text-slate-300">|</span>
            <AlertTriangle size={14} className="text-red-500" />
            <span>解約リスク <strong className="text-red-600">{churnRiskCount}</strong> 件</span>
          </>
        )}
      </div>
    </div>
  );
}
