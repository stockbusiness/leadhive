import { useEffect, useState } from "react";
import { Building2, Users, Database, FolderKanban, Crown, Pencil, Check, X, Loader2, RefreshCw } from "lucide-react";
import { api } from "../api";

type Tenant = {
  id: number;
  name: string;
  plan_id: number | null;
  plan_name: string | null;
  member_count: number;
  company_count: number;
  project_count: number;
  created_at: string | null;
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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 size={24} className="text-blue-600" />
            テナント管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">登録されているすべての組織とそのプランを管理します</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw size={14} />
          更新
        </button>
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
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-1">ID</div>
            <div className="col-span-3">組織名</div>
            <div className="col-span-3">プラン</div>
            <div className="col-span-3">利用状況</div>
            <div className="col-span-1">登録日</div>
            <div className="col-span-1 text-right">操作</div>
          </div>

          {tenants.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">組織が登録されていません</div>
          ) : (
            tenants.map(t => (
              <div key={t.id} className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-1 text-xs text-slate-400 font-mono">{t.id}</div>

                <div className="col-span-3">
                  <span className="font-medium text-slate-800 text-sm">{t.name}</span>
                </div>

                <div className="col-span-3">
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

                <div className="col-span-3">
                  <div className="flex flex-col gap-1">
                    <StatBadge icon={<Users size={13} />} value={t.member_count} label="メンバー" />
                    <StatBadge icon={<Building2 size={13} />} value={t.company_count} label="企業" />
                    <StatBadge icon={<FolderKanban size={13} />} value={t.project_count} label="プロジェクト" />
                  </div>
                </div>

                <div className="col-span-1 text-xs text-slate-400">
                  {t.created_at ? new Date(t.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—"}
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
            ))
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
      </div>
    </div>
  );
}
