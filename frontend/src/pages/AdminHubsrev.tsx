import { useEffect, useState } from "react";
import { Link2, Save, Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff } from "lucide-react";
import axios from "axios";

type Settings = {
  hubsrev_enabled: string;
  hubsrev_webhook_url: string;
  hubsrev_api_key_set: boolean;
  hubsrev_api_key_masked: string;
  hubsrev_webhook_secret_set: boolean;
  hubsrev_webhook_secret_masked: string;
};

export default function AdminHubsrev() {
  const [settings, setSettings] = useState<Settings>({
    hubsrev_enabled: "true",
    hubsrev_webhook_url: "",
    hubsrev_api_key_set: false,
    hubsrev_api_key_masked: "",
    hubsrev_webhook_secret_set: false,
    hubsrev_webhook_secret_masked: "",
  });
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get("/api/admin/hubsrev/settings")
      .then((r) => { setSettings(r.data); setLoading(false); })
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
        hubsrev_enabled: settings.hubsrev_enabled,
        hubsrev_webhook_url: settings.hubsrev_webhook_url,
      };
      if (apiKey.trim()) payload.hubsrev_api_key = apiKey.trim();
      if (webhookSecret.trim()) payload.hubsrev_webhook_secret = webhookSecret.trim();
      await axios.put("/api/admin/hubsrev/settings", payload);
      if (apiKey.trim()) {
        setSettings((s) => ({ ...s, hubsrev_api_key_set: true, hubsrev_api_key_masked: apiKey.slice(0, 6) + "****" + apiKey.slice(-4) }));
        setApiKey("");
      }
      if (webhookSecret.trim()) {
        setSettings((s) => ({ ...s, hubsrev_webhook_secret_set: true, hubsrev_webhook_secret_masked: webhookSecret.slice(0, 6) + "****" + webhookSecret.slice(-4) }));
        setWebhookSecret("");
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
      const r = await axios.post("/api/admin/hubsrev/test");
      showMsg(r.data.message);
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || "テスト送信に失敗しました", true);
    } finally {
      setTesting(false);
    }
  };

  const enabled = settings.hubsrev_enabled !== "false";

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
          <h1 className="text-2xl font-bold text-slate-800">Hubsrev 連携設定</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            問い合わせフォーム・サポートチケットの内容を Hubsrev の統合受信ボックスへ自動転送します
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
        {/* 有効/無効 */}
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <div className="font-semibold text-slate-800 text-sm">Hubsrev 連携を有効にする</div>
            <div className="text-xs text-slate-500 mt-0.5">
              無効にすると問い合わせ・チケットの転送は停止します
            </div>
          </div>
          <button
            onClick={() => setSettings((s) => ({ ...s, hubsrev_enabled: enabled ? "false" : "true" }))}
            className={`relative inline-flex h-7 w-13 w-[52px] items-center rounded-full transition-colors duration-200 focus:outline-none ${enabled ? "bg-indigo-600" : "bg-slate-300"}`}
            title={enabled ? "ON（クリックでOFF）" : "OFF（クリックでON）"}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${enabled ? "translate-x-[28px]" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Hubsrev側のOutbound Webhook設定用URL */}
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
          <div className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
            <span>🔗</span> Hubsrev の「Outbound Webhook」に設定するURL（LeadHive受信エンドポイント）
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-blue-200 rounded px-3 py-2 text-xs text-slate-700 font-mono select-all break-all">
              https://leadhive.work/api/webhooks/hubsrev
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText("https://leadhive.work/api/webhooks/hubsrev");
              }}
              className="text-xs bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              コピー
            </button>
          </div>
          <p className="text-xs text-blue-600 mt-1.5">
            Hubsrev管理画面 → Webhook設定 → 新規Webhook作成 → エンドポイントURL にこのURLを貼り付けてください
          </p>
        </div>

        {/* Webhook URL */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            Hubsrev Webhook URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={settings.hubsrev_webhook_url}
            onChange={(e) => setSettings((s) => ({ ...s, hubsrev_webhook_url: e.target.value }))}
            placeholder="https://your-hubsrev-domain/api/webhook/inbox"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            disabled={!enabled}
          />
          <p className="text-xs text-slate-400 mt-1.5">Hubsrev 管理画面の「Webhook設定」→「受信用エンドポイント」から取得した URL を入力してください（LeadHive → Hubsrev への送信先）</p>
        </div>

        {/* API Key */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            API Key <span className="text-red-500">*</span>
            {settings.hubsrev_api_key_set && (
              <span className="ml-2 text-green-600 font-normal">（設定済み：{settings.hubsrev_api_key_masked}）</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.hubsrev_api_key_set ? "変更する場合のみ入力" : "hubsrev_xxxxxxxxxxxxxxxxxxxxxxxx"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              disabled={!enabled}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Hubsrev 管理画面の「API Key管理」から発行できます。値は暗号化して保存されます。</p>
        </div>

        {/* Webhook署名シークレット */}
        <div className="px-6 py-5 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            Webhook 署名シークレット <span className="text-red-500">*</span>
            {settings.hubsrev_webhook_secret_set && (
              <span className="ml-2 text-green-600 font-normal">（設定済み：{settings.hubsrev_webhook_secret_masked}）</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={settings.hubsrev_webhook_secret_set ? "変更する場合のみ入力" : "whsec_xxxxxxxxxxxxxxxxxxxxxxxx"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              disabled={!enabled}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Hubsrev の「Outbound Webhook設定」で発行された署名シークレットキーを入力してください。受信時に HMAC-SHA256 で署名検証します。値は暗号化して保存されます。</p>
        </div>

        {/* 転送タイミング説明 */}
        <div className="px-6 py-5 bg-slate-50 rounded-b-2xl">
          <div className="text-xs font-semibold text-slate-500 mb-2">転送される内容</div>
          <ul className="text-xs text-slate-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
              <span><strong>公式サイトの問い合わせフォーム</strong> — 新規送信時に <code className="bg-slate-200 px-1 rounded text-xs">sourceType: form</code> で転送</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
              <span><strong>サポートチケット新規作成</strong> — チケット番号と件名・本文を <code className="bg-slate-200 px-1 rounded text-xs">sourceType: form</code> で転送</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
              <span><strong>サポートチケット返信</strong> — ユーザーからのメッセージを <code className="bg-slate-200 px-1 rounded text-xs">sourceType: ticket_reply</code> で転送</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ボタン類 */}
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
          disabled={testing || !settings.hubsrev_api_key_set || !settings.hubsrev_webhook_url}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          テスト送信
        </button>
        <span className="text-xs text-slate-400">テスト送信で Hubsrev へのダミーデータ転送を確認できます</span>
      </div>
    </div>
  );
}
