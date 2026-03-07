import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Save, Loader2, Building2, Crown, Check, Minus } from "lucide-react";
import { api } from "../api";
import type { PlanData, OrgWithPlan } from "../types";

const EMPTY_PLAN: Omit<PlanData, "id" | "created_at" | "updated_at"> = {
  name: "",
  description: null,
  price_monthly: null,
  max_members: null,
  max_projects: null,
  max_companies: null,
  max_ai_analyses_monthly: null,
  max_master_db_imports: null,
  max_csv_export: null,
  api_daily_limit: null,
  is_active: true,
};

function LimitCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400 text-xs">無制限</span>;
  return <span className="text-slate-700 text-sm font-medium">{value.toLocaleString()}</span>;
}

function MasterDBLimitCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-slate-400 text-xs">無制限</span>;
  if (value === 0) return <span className="text-red-500 text-xs font-medium">不可</span>;
  return <span className="text-slate-700 text-sm font-medium">{value.toLocaleString()}件/月</span>;
}

function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: Partial<PlanData> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!plan?.id;
  const [form, setForm] = useState<Omit<PlanData, "id" | "created_at" | "updated_at">>(
    plan?.id
      ? {
          name: plan.name || "",
          description: plan.description || null,
          price_monthly: plan.price_monthly ?? null,
          max_members: plan.max_members ?? null,
          max_projects: plan.max_projects ?? null,
          max_companies: plan.max_companies ?? null,
          max_ai_analyses_monthly: plan.max_ai_analyses_monthly ?? null,
          max_master_db_imports: plan.max_master_db_imports ?? null,
          max_csv_export: plan.max_csv_export ?? null,
          api_daily_limit: plan.api_daily_limit ?? null,
          is_active: plan.is_active ?? true,
        }
      : { ...EMPTY_PLAN }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setLimit = (key: keyof typeof form, raw: string) => {
    const val = raw === "" ? null : parseInt(raw, 10);
    setForm((f) => ({ ...f, [key]: isNaN(val as number) ? null : val }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("プラン名を入力してください"); return; }
    setSaving(true);
    setError("");
    try {
      if (isEdit && plan?.id) {
        await api.plans.update(plan.id, form);
      } else {
        await api.plans.create(form);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const limitField = (label: string, key: keyof typeof form) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        value={form[key] === null ? "" : String(form[key])}
        onChange={(e) => setLimit(key, e.target.value)}
        placeholder="空欄=無制限"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-800">
            {isEdit ? "プランを編集" : "新しいプランを作成"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">プラン名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: スタータープラン"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">説明</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="プランの説明（任意）"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">月額料金（円）</label>
            <input
              type="number"
              min="0"
              value={form.price_monthly === null ? "" : String(form.price_monthly)}
              onChange={(e) => setLimit("price_monthly", e.target.value)}
              placeholder="例: 9800"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">上限設定（空欄 = 無制限）</p>
            <div className="grid grid-cols-2 gap-3">
              {limitField("最大メンバー数（人）", "max_members")}
              {limitField("最大プロジェクト数", "max_projects")}
              {limitField("最大企業登録数", "max_companies")}
              {limitField("月次AI分析回数", "max_ai_analyses_monthly")}
              {limitField("マスターDBインポート/月（0=不可）", "max_master_db_imports")}
              {limitField("CSVエクスポート行数上限（0=不可）", "max_csv_export")}
              {limitField("API日次上限（Google）", "api_daily_limit")}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? "bg-blue-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-slate-700">{form.is_active ? "有効" : "無効"}</span>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [orgs, setOrgs] = useState<OrgWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Partial<PlanData> | null | "new">(null);
  const [assignLoading, setAssignLoading] = useState<number | null>(null);

  const load = async () => {
    const [plansData, orgsData] = await Promise.all([
      api.plans.list(),
      api.plans.organizations(),
    ]);
    setPlans(plansData.plans);
    setOrgs(orgsData.organizations);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (plan: PlanData) => {
    if (!confirm(`プラン「${plan.name}」を削除しますか？`)) return;
    try {
      await api.plans.delete(plan.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "削除に失敗しました");
    }
  };

  const handleAssign = async (orgId: number, planId: number | null) => {
    setAssignLoading(orgId);
    try {
      if (planId === null) {
        const org = orgs.find((o) => o.id === orgId);
        if (org?.plan_id) {
          await api.plans.unassign(org.plan_id, orgId);
        }
      } else {
        await api.plans.assign(planId, orgId);
      }
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "割り当てに失敗しました");
    } finally {
      setAssignLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Crown size={22} className="text-amber-500" />
            プラン管理
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">サブスクリプションプランと組織への割り当てを管理します</p>
        </div>
        <button
          onClick={() => setEditingPlan("new")}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">プランを追加</span>
        </button>
      </div>

      {/* Plans Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-700 text-sm">プラン一覧</h3>
        </div>
        {plans.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-400">
            <Crown size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">プランがまだ作成されていません</p>
            <button
              onClick={() => setEditingPlan("new")}
              className="mt-3 text-blue-600 text-sm hover:underline"
            >
              最初のプランを作成する
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">プラン名</th>
                  <th className="text-right px-3 py-3">月額</th>
                  <th className="text-center px-3 py-3">メンバー</th>
                  <th className="text-center px-3 py-3">プロジェクト</th>
                  <th className="text-center px-3 py-3">企業数</th>
                  <th className="text-center px-3 py-3">AI分析/月</th>
                  <th className="text-center px-3 py-3">マスターDB</th>
                  <th className="text-center px-3 py-3">CSV出力</th>
                  <th className="text-center px-3 py-3">状態</th>
                  <th className="text-center px-3 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-800">{plan.name}</p>
                        {plan.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{plan.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {plan.price_monthly !== null ? (
                        <span className="font-medium text-slate-800">¥{plan.price_monthly.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">未設定</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center"><LimitCell value={plan.max_members} /></td>
                    <td className="px-3 py-3 text-center"><LimitCell value={plan.max_projects} /></td>
                    <td className="px-3 py-3 text-center"><LimitCell value={plan.max_companies} /></td>
                    <td className="px-3 py-3 text-center"><LimitCell value={plan.max_ai_analyses_monthly} /></td>
                    <td className="px-3 py-3 text-center"><MasterDBLimitCell value={plan.max_master_db_imports} /></td>
                    <td className="px-3 py-3 text-center"><MasterDBLimitCell value={plan.max_csv_export} /></td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${plan.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {plan.is_active ? <Check size={10} /> : <Minus size={10} />}
                        {plan.is_active ? "有効" : "無効"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingPlan(plan)}
                          className="text-blue-500 hover:text-blue-700 p-1.5"
                          title="編集"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(plan)}
                          className="text-red-400 hover:text-red-600 p-1.5"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Organization Assignments */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Building2 size={15} className="text-slate-500" />
            組織へのプラン割り当て
          </h3>
        </div>
        {orgs.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-400 text-sm">組織が見つかりません</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orgs.map((org) => {
              const assigned = plans.find((p) => p.id === org.plan_id);
              return (
                <div key={org.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{org.name}</p>
                    <p className="text-xs text-slate-400">ID: {org.id}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {assignLoading === org.id ? (
                      <Loader2 size={14} className="animate-spin text-slate-400" />
                    ) : null}
                    <select
                      value={org.plan_id ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleAssign(org.id, val === "" ? null : parseInt(val));
                      }}
                      disabled={assignLoading === org.id}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                    >
                      <option value="">プランなし</option>
                      {plans.filter((p) => p.is_active).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.price_monthly ? ` (¥${p.price_monthly.toLocaleString()}/月)` : ""}
                        </option>
                      ))}
                    </select>
                    {assigned && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        {assigned.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingPlan !== null && (
        <PlanModal
          plan={editingPlan === "new" ? null : editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => { setEditingPlan(null); load(); }}
        />
      )}
    </div>
  );
}
