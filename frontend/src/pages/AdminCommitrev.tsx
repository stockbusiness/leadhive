import { useEffect, useState } from "react";
import { Link2, Save, Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff, Zap } from "lucide-react";
import axios from "axios";

type CrSettings = {
  api_key_set: boolean;
  api_key_masked: string;
  hmac_secret_set: boolean;
  hmac_secret_masked: string;
  tenant_id: string;
  product_code: string;
  base_url: string;
  partner_apply_url: string;
};

export default function AdminCommitrev() {
  const [settings, setSettings] = useState<CrSettings>({
    api_key_set: false,
    api_key_masked: "",
    hmac_secret_set: false,
    hmac_secret_masked: "",
    tenant_id: "",
    product_code: "",
    base_url: "https://app.commitrev.com",
    partner_apply_url: "",
  });
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hmacSecret, setHmacSecret] = useState("");
  const [showHmac, setShowHmac] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get("/api/admin/commitrev/settings")
      .then((r) => {
        const d = r.data;
        setSettings({
          api_key_set: d.commitrev_api_key?.is_set ?? false,
          api_key_masked: d.commitrev_api_key?.value ?? "",
          hmac_secret_set: d.commitrev_hmac_secret?.is_set ?? false,
          hmac_secret_masked: d.commitrev_hmac_secret?.value ?? "",
          tenant_id: d.commitrev_tenant_id?.value ?? "",
          product_code: d.commitrev_product_code?.value ?? "",
          base_url: d.commitrev_base_url?.value || "https://app.commitrev.com",
          partner_apply_url: d.commitrev_partner_apply_url?.value || "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setSuccess(""); setError(""); }, 4000);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        commitrev_tenant_id: settings.tenant_id,
        commitrev_product_code: settings.product_code,
        commitrev_base_url: settings.base_url,
        commitrev_partner_apply_url: settings.partner_apply_url,
      };
      if (apiKey.trim()) payload.commitrev_api_key = apiKey.trim();
      if (hmacSecret.trim()) payload.commitrev_hmac_secret = hmacSecret.trim();
      await axios.put("/api/admin/commitrev/settings", payload);
      if (apiKey.trim()) {
        const masked = apiKey.slice(0, 6) + "****" + apiKey.slice(-4);
        setSettings((s) => ({ ...s, api_key_set: true, api_key_masked: masked }));
        setApiKey("");
      }
      if (hmacSecret.trim()) {
        const masked = hmacSecret.slice(0, 6) + "****" + hmacSecret.slice(-4);
        setSettings((s) => ({ ...s, hmac_secret_set: true, hmac_secret_masked: masked }));
        setHmacSecret("");
      }
      showMsg("設定を保存しました");
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "保存に失敗しました", true);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await axios.post("/api/admin/commitrev/test");
      if (r.data.success) showMsg(r.data.message);
      else showMsg(r.data.message, true);
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "接続テストに失敗しました", true);
    } finally {
      setTesting(false);
    }
  };

  const canTest = settings.api_key_set || settings.hmac_secret_set;

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
        <div className="bg-indigo-100 text-indigo-700 rounded-xl p-2.5">
          <Link2 size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">CommitRev 連携設定</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            ユーザー登録・プラン契約・アップグレード・月次更新のイベントをCommitRevへ自動送信します
          </p>
        </div>
      </div>

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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* スコープ付きAPIキー */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            スコープ付きAPIキー（推奨）
            {settings.api_key_set && (
              <span className="ml-2 text-green-600 font-normal">（設定済み：{settings.api_key_masked}）</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.api_key_set ? "変更する場合のみ入力" : "cr_xxxxxxxxxxxxxxxxxxxxxxxx..."}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            CommitRevポータル → APIキー管理 → スコープ付きAPIキー で発行（scope: <code className="bg-slate-100 px-1 rounded">events</code> 以上）。値は暗号化して保存されます。
          </p>
        </div>

        {/* HMACシークレット */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            HMACシークレット（代替）
            {settings.hmac_secret_set && (
              <span className="ml-2 text-green-600 font-normal">（設定済み：{settings.hmac_secret_masked}）</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showHmac ? "text" : "password"}
              value={hmacSecret}
              onChange={(e) => setHmacSecret(e.target.value)}
              placeholder={settings.hmac_secret_set ? "変更する場合のみ入力" : "HMACシークレットキー"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
            <button
              type="button"
              onClick={() => setShowHmac((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showHmac ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            APIキーが未設定の場合に使用します。テナントID と併せて設定してください。値は暗号化して保存されます。
          </p>
        </div>

        {/* テナントID */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            テナントID
            <span className="ml-1 font-normal text-slate-400">（HMACシークレット使用時のみ必要）</span>
          </label>
          <input
            type="text"
            value={settings.tenant_id}
            onChange={(e) => setSettings((s) => ({ ...s, tenant_id: e.target.value }))}
            placeholder="例: 42"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
          <p className="text-xs text-slate-400 mt-1.5">CommitRevのテナント管理画面で確認できる数値IDです。</p>
        </div>

        {/* プロダクトコード */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            プロダクトコード <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={settings.product_code}
            onChange={(e) => setSettings((s) => ({ ...s, product_code: e.target.value }))}
            placeholder="例: leadhive"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
          <p className="text-xs text-slate-400 mt-1.5">CommitRevのプロダクト管理で登録したプロダクトコードを入力してください。</p>
        </div>

        {/* ベースURL */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">ベースURL</label>
          <input
            type="url"
            value={settings.base_url}
            onChange={(e) => setSettings((s) => ({ ...s, base_url: e.target.value }))}
            placeholder="https://app.commitrev.com"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
          <p className="text-xs text-slate-400 mt-1.5">通常は変更不要です。</p>
        </div>

        {/* パートナー申請URL */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            パートナー申請URL
            {settings.partner_apply_url && (
              <span className="ml-2 text-green-600 font-normal">（設定済み）</span>
            )}
          </label>
          <input
            type="url"
            value={settings.partner_apply_url}
            onChange={(e) => setSettings((s) => ({ ...s, partner_apply_url: e.target.value }))}
            placeholder="https://app.commitrev.com/apply/your-tenant-code"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            CommitRevのパートナー申請フォームURL。設定すると <a href="/partner" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">/partner</a> ページのCTAボタンが有効になります。
          </p>
        </div>

        {/* 自動送信イベント説明 */}
        <div className="px-6 py-5 bg-indigo-50 rounded-b-2xl">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-3">
            <Zap size={13} />
            LeadHive から CommitRev へ自動送信されるイベント
          </div>
          <ul className="text-xs text-slate-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
              <span><strong>ユーザー新規登録時</strong> — <code className="bg-white border border-indigo-100 px-1 rounded">lead_created</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
              <span><strong>フリー → 有料プラン（初回契約）</strong> — <code className="bg-white border border-indigo-100 px-1 rounded">contract_signed</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0"></span>
              <span><strong>有料 → 上位プラン（アップグレード）</strong> — <code className="bg-white border border-green-100 px-1 rounded">plan_conversion</code> <span className="text-green-600 font-semibold">← アップセル</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
              <span><strong>Stripe月次更新</strong> — <code className="bg-white border border-indigo-100 px-1 rounded">monthly_renewal</code></span>
            </li>
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            全イベントに <code className="bg-white px-1 rounded">customer_id</code>（メールアドレス）が含まれるため、CommitRev側でパートナーへの帰属が自動的に判定されます。
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6 flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          保存する
        </button>
        <button
          onClick={test}
          disabled={testing || !canTest}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          接続テスト
        </button>
        <span className="text-xs text-slate-400">テスト送信でCommitRevへの疎通を確認できます</span>
      </div>
    </div>
  );
}
