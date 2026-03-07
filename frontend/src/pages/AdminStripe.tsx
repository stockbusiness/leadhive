import { useEffect, useState } from "react";
import {
  CreditCard, Eye, EyeOff, Save, Loader2, CheckCircle2,
  AlertCircle, RefreshCw, ExternalLink, X, Zap,
} from "lucide-react";
import { api } from "../api";
import type { PlanData } from "../types";

type StripeMode = "test" | "live";

interface StripeSettings {
  stripe_secret_key: string;
  stripe_publishable_key: string;
  stripe_webhook_secret: string;
  stripe_mode: StripeMode;
  stripe_secret_key_set?: boolean;
  stripe_webhook_secret_set?: boolean;
}

const EMPTY_SETTINGS: StripeSettings = {
  stripe_secret_key: "",
  stripe_publishable_key: "",
  stripe_webhook_secret: "",
  stripe_mode: "test",
};

export default function AdminStripe() {
  const [settings, setSettings] = useState<StripeSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [plans, setPlans] = useState<PlanData[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    loadPlans();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.stripe.getSettings();
      setSettings({
        stripe_secret_key: (data.stripe_secret_key as string) || "",
        stripe_publishable_key: (data.stripe_publishable_key as string) || "",
        stripe_webhook_secret: (data.stripe_webhook_secret as string) || "",
        stripe_mode: ((data.stripe_mode as string) || "test") as StripeMode,
        stripe_secret_key_set: data.stripe_secret_key_set as boolean,
        stripe_webhook_secret_set: data.stripe_webhook_secret_set as boolean,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await api.plans.list();
      setPlans(data.plans.filter((p) => p.is_active && p.price_monthly !== null && p.price_monthly > 0));
    } finally {
      setPlansLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    setTestResult(null);
    try {
      const payload: Record<string, string> = {
        stripe_mode: settings.stripe_mode,
      };
      if (settings.stripe_publishable_key) payload.stripe_publishable_key = settings.stripe_publishable_key;
      if (settings.stripe_secret_key && !settings.stripe_secret_key.includes("••••")) {
        payload.stripe_secret_key = settings.stripe_secret_key;
      }
      if (settings.stripe_webhook_secret && !settings.stripe_webhook_secret.includes("••••")) {
        payload.stripe_webhook_secret = settings.stripe_webhook_secret;
      }
      await api.stripe.updateSettings(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadSettings();
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.stripe.testConnection();
      setTestResult({ success: true, message: `接続成功: ${result.display_name} (${result.account_id})` });
    } catch (e: any) {
      setTestResult({ success: false, message: e?.response?.data?.detail || "接続に失敗しました" });
    } finally {
      setTesting(false);
    }
  };

  const handlePlanPriceIdSave = async (plan: PlanData, newPriceId: string) => {
    try {
      await api.plans.update(plan.id, {
        name: plan.name,
        description: plan.description,
        price_monthly: plan.price_monthly,
        max_members: plan.max_members,
        max_projects: plan.max_projects,
        max_companies: plan.max_companies,
        max_ai_analyses_monthly: plan.max_ai_analyses_monthly,
        max_master_db_imports: plan.max_master_db_imports,
        max_csv_export: plan.max_csv_export,
        api_daily_limit: plan.api_daily_limit,
        stripe_price_id: newPriceId || null,
        is_active: plan.is_active,
      });
      await loadPlans();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "保存に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const isConfigured = settings.stripe_secret_key_set || (settings.stripe_secret_key && !settings.stripe_secret_key.includes("••••"));

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CreditCard size={22} className="text-violet-500" />
          Stripe 設定
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Stripe APIキーと各プランのPrice IDを設定します。
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-violet-600 hover:underline inline-flex items-center gap-0.5"
          >
            Stripeダッシュボード <ExternalLink size={11} />
          </a>
        </p>
      </div>

      {/* Mode toggle */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">動作モード</h3>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(["test", "live"] as StripeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSettings((s) => ({ ...s, stripe_mode: mode }))}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  settings.stripe_mode === mode
                    ? mode === "live"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white text-slate-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {mode === "test" ? "テスト" : "本番"}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-3">
          {settings.stripe_mode === "live" ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              本番モードが選択されています。実際の決済が行われます。
            </p>
          ) : (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              テストモードが選択されています。実際の決済は行われません。
              <a href="https://stripe.com/docs/testing" target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                テストカード情報
              </a>
            </p>
          )}
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">APIキー</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Stripe ダッシュボードの「開発者 → APIキー」から取得してください
          </p>
        </div>

        <div className="p-5 space-y-4">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle size={15} />
              {saveError}
              <button onClick={() => setSaveError("")} className="ml-auto"><X size={14} /></button>
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={15} />
              設定を保存しました
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              シークレットキー
              <span className="ml-1 text-slate-400 font-normal">
                （{settings.stripe_mode === "test" ? "sk_test_..." : "sk_live_..."}）
              </span>
            </label>
            <div className="relative">
              <input
                type={showSecretKey ? "text" : "password"}
                value={settings.stripe_secret_key}
                onChange={(e) => setSettings((s) => ({ ...s, stripe_secret_key: e.target.value }))}
                placeholder={settings.stripe_secret_key_set ? "設定済み（変更する場合のみ入力）" : "sk_test_..."}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={() => setShowSecretKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecretKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              公開可能キー
              <span className="ml-1 text-slate-400 font-normal">
                （{settings.stripe_mode === "test" ? "pk_test_..." : "pk_live_..."}）
              </span>
            </label>
            <input
              type="text"
              value={settings.stripe_publishable_key}
              onChange={(e) => setSettings((s) => ({ ...s, stripe_publishable_key: e.target.value }))}
              placeholder={settings.stripe_mode === "test" ? "pk_test_..." : "pk_live_..."}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Webhook シークレット
              <span className="ml-1 text-slate-400 font-normal">（whsec_...）</span>
            </label>
            <div className="relative">
              <input
                type={showWebhookSecret ? "text" : "password"}
                value={settings.stripe_webhook_secret}
                onChange={(e) => setSettings((s) => ({ ...s, stripe_webhook_secret: e.target.value }))}
                placeholder={settings.stripe_webhook_secret_set ? "設定済み（変更する場合のみ入力）" : "whsec_..."}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={() => setShowWebhookSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showWebhookSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Webhook URL: <span className="font-mono">{window.location.origin}/api/payments/webhook</span>
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || (!isConfigured)}
              className="flex items-center gap-2 border border-violet-300 text-violet-700 bg-violet-50 px-4 py-2 rounded-lg text-sm hover:bg-violet-100 disabled:opacity-40 transition-colors"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              接続テスト
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存
            </button>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${testResult.success ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {testResult.success ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Per-plan Price IDs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            プラン別 Stripe Price ID
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            各プランに対応するStripeのPrice IDを設定すると、ユーザーがStripeで決済できるようになります
          </p>
        </div>

        <div className="p-5">
          {plansLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">有料プランが見つかりません。先にプラン管理で有料プランを作成してください。</p>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <PlanPriceRow key={plan.id} plan={plan} onSave={handlePlanPriceIdSave} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Webhook setup guide */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h4 className="font-semibold text-amber-800 text-sm mb-2">Webhook の設定方法</h4>
        <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
          <li>
            <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="underline">
              Stripeダッシュボード → Webhook
            </a>
            　を開く
          </li>
          <li>「エンドポイントを追加」をクリック</li>
          <li>URL: <span className="font-mono bg-amber-100 px-1 rounded">{window.location.origin}/api/payments/webhook</span></li>
          <li>イベント「<span className="font-mono">checkout.session.completed</span>」を選択</li>
          <li>作成後、「署名シークレット」をコピーして上記の「Webhookシークレット」欄に貼り付け</li>
        </ol>
      </div>
    </div>
  );
}

function PlanPriceRow({
  plan,
  onSave,
}: {
  plan: PlanData;
  onSave: (plan: PlanData, priceId: string) => Promise<void>;
}) {
  const [value, setValue] = useState(plan.stripe_price_id || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const original = plan.stripe_price_id || "";

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(plan, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = value !== original;

  return (
    <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
      <div className="w-28 flex-shrink-0">
        <p className="font-semibold text-slate-700 text-sm">{plan.name}</p>
        <p className="text-xs text-slate-400">
          ¥{(plan.price_monthly || 0).toLocaleString()}/月
        </p>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="price_1AbcDefGhiJklMnopQrsT"
        className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          saved
            ? "bg-emerald-100 text-emerald-700"
            : isDirty
            ? "bg-violet-600 text-white hover:bg-violet-700"
            : "bg-slate-200 text-slate-400 cursor-not-allowed"
        }`}
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Save size={12} />}
        {saved ? "保存済み" : "保存"}
      </button>
    </div>
  );
}
