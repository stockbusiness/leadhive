import { useEffect, useState } from "react";
import { Zap, Save, Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff } from "lucide-react";
import axios from "axios";

type ObSettings = {
  base_url: string;
  product_key: string;
  webhook_secret_set: boolean;
  webhook_secret_masked: string;
};

export default function AdminOnbizu() {
  const [settings, setSettings] = useState<ObSettings>({
    base_url: "",
    product_key: "",
    webhook_secret_set: false,
    webhook_secret_masked: "",
  });
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setSuccess(""); setError(""); }, 5000);
  };

  useEffect(() => {
    axios.get("/api/admin/onbizu/settings")
      .then((r) => {
        const d = r.data;
        setSettings({
          base_url: d.onbizu_base_url?.value || "",
          product_key: d.onbizu_product_key?.value || "",
          webhook_secret_set: d.onbizu_webhook_secret?.is_set ?? false,
          webhook_secret_masked: d.onbizu_webhook_secret?.value || "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        onbizu_base_url: settings.base_url,
        onbizu_product_key: settings.product_key,
      };
      if (webhookSecret.trim()) payload.onbizu_webhook_secret = webhookSecret.trim();
      await axios.put("/api/admin/onbizu/settings", payload);
      if (webhookSecret.trim()) {
        const masked = webhookSecret.slice(0, 4) + "****" + webhookSecret.slice(-4);
        setSettings((s) => ({ ...s, webhook_secret_set: true, webhook_secret_masked: masked }));
        setWebhookSecret("");
      }
      showMsg("Onbizu設定を保存しました");
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "保存に失敗しました", true);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await axios.post("/api/admin/onbizu/test");
      if (r.data.success) showMsg(r.data.message);
      else showMsg(r.data.message, true);
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "接続テストに失敗しました", true);
    } finally {
      setTesting(false);
    }
  };

  const canTest = settings.webhook_secret_set || webhookSecret.trim().length > 0;
  const isConfigured = settings.base_url && settings.product_key && settings.webhook_secret_set;

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-violet-100 text-violet-700 rounded-xl p-2.5">
          <Zap size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Onbizu 連携設定</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            ユーザー登録・ログイン・オンボーディング完了・有料転換のイベントを Onbizu へ自動送信します
          </p>
        </div>
      </div>

      {isConfigured && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-700 rounded-xl px-4 py-3 mb-6 text-sm">
          <CheckCircle size={15} />
          <span>Onbizu 連携が有効です。ユーザーイベントは自動送信されています。</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-6 text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 mb-6">
        <h2 className="text-base font-semibold text-slate-700">接続設定</h2>

        <div>
          <label className={labelClass}>Onbizu ベースURL</label>
          <input
            type="url"
            value={settings.base_url}
            onChange={(e) => setSettings((s) => ({ ...s, base_url: e.target.value }))}
            placeholder="https://your-onbizu-domain.example.com"
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">管理コンソールのドメインを入力してください（末尾スラッシュなし）</p>
        </div>

        <div>
          <label className={labelClass}>プロダクトキー</label>
          <input
            type="text"
            value={settings.product_key}
            onChange={(e) => setSettings((s) => ({ ...s, product_key: e.target.value }))}
            placeholder="main"
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">管理コンソール → プロダクト管理 で確認できます</p>
        </div>

        <div>
          <label className={labelClass}>
            Webhook シークレット
            {settings.webhook_secret_set && (
              <span className="ml-2 text-xs text-emerald-600 font-normal">設定済み</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={webhookSecret || settings.webhook_secret_masked}
              onChange={(e) => setWebhookSecret(e.target.value)}
              onFocus={() => { if (!webhookSecret) setWebhookSecret(""); }}
              placeholder={settings.webhook_secret_set ? "変更する場合のみ入力" : "Webhook シークレットを入力"}
              className={inputClass + " pr-10"}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowSecret((v) => !v)}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            管理コンソール → プロダクト管理 → webhookSecret（HMAC-SHA256 署名に使用）
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-3">接続テスト</h2>
        <p className="text-sm text-slate-500 mb-4">
          Onbizu へテスト用の <code className="bg-slate-100 px-1 rounded">user_login</code> イベントを送信して接続を確認します。
        </p>
        <button
          onClick={test}
          disabled={testing || !canTest}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {testing ? "送信中..." : "テスト送信"}
        </button>
        {!canTest && (
          <p className="text-xs text-slate-400 mt-2">※ Webhook シークレットを設定してからテストしてください</p>
        )}
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-3">送信されるイベント一覧</h2>
        <div className="space-y-2 text-sm">
          {[
            { event: "user_registered", timing: "新規ユーザー登録時", effect: "ウェルカム・オンボーディング開始" },
            { event: "user_login", timing: "ログイン成功時", effect: "最終活動日の更新・停滞フラグの解除" },
            { event: "step_completed / org_name_set", timing: "初期設定 STEP2：組織名を設定したとき", effect: "進捗率の更新・停滞検知の起点" },
            { event: "step_completed / project_created", timing: "初期設定 STEP3：プロジェクトを作成したとき", effect: "進捗率の更新・停滞検知の起点" },
            { event: "step_completed / keywords_saved", timing: "初期設定 STEP4：キーワードを登録したとき", effect: "進捗率の更新・停滞検知の起点" },
            { event: "onboarding_completed", timing: "初期設定 STEP5：セットアップ完了時", effect: "完了日を記録" },
            { event: "conversion", timing: "有料プランへの転換時（管理者操作）", effect: "コンバージョン数の更新" },
          ].map(({ event, timing, effect }) => (
            <div key={event} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2 border-b border-slate-200 last:border-0">
              <code className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-mono whitespace-nowrap flex-shrink-0">{event}</code>
              <div>
                <span className="text-slate-600">{timing}</span>
                <span className="text-slate-400 ml-2 text-xs">→ {effect}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
