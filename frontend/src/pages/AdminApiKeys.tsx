import { useEffect, useState } from "react";
import { Key, Save, Loader2, CheckCircle, Building2, ExternalLink, Bot } from "lucide-react";
import { api } from "../api";

export default function AdminApiKeys() {
  const [gbizToken, setGbizToken] = useState("");
  const [gbizTokenSet, setGbizTokenSet] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicKeySet, setAnthropicKeySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.admin.getApiSettings().then((data) => {
      if (data.gbizinfo_api_token_set) {
        setGbizTokenSet(true);
        setGbizToken((data.gbizinfo_api_token as string) || "");
      }
      if (data.anthropic_api_key_set) {
        setAnthropicKeySet(true);
        setAnthropicKey((data.anthropic_api_key as string) || "");
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (gbizToken && !gbizToken.includes("••")) {
        payload.gbizinfo_api_token = gbizToken;
      }
      if (anthropicKey && !anthropicKey.includes("••")) {
        payload.anthropic_api_key = anthropicKey;
      }
      if (Object.keys(payload).length > 0) {
        await api.admin.updateApiSettings(payload);
        setSaved(true);
        if (payload.gbizinfo_api_token) setGbizTokenSet(true);
        if (payload.anthropic_api_key) setAnthropicKeySet(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const inputClass = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Key size={24} className="text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-800">システムAPI設定</h2>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
          <CheckCircle size={16} />
          設定を保存しました
        </div>
      )}

      {/* Anthropic API Key */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-violet-600" />
          <h3 className="text-lg font-semibold text-slate-800">Anthropic API設定</h3>
          <span className="ml-auto text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">営業AI</span>
        </div>

        <div className="bg-violet-50 border border-violet-100 rounded-lg p-4 space-y-2 text-sm text-violet-800">
          <p className="font-medium">Anthropic Claude とは</p>
          <p className="text-violet-700">
            営業AIの営業文生成に使用するAIサービスです。ClaudeはAnthropicが提供する高品質な日本語対応LLMです。
            このキーはCOOLWORKS管理者のみが設定でき、全クライアント組織で共有されます。
          </p>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800 font-medium"
          >
            Anthropic Console でAPIキーを取得
            <ExternalLink size={13} />
          </a>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            APIキー（sk-ant-...）
            {anthropicKeySet && (
              <span className="ml-2 text-emerald-600 text-xs font-normal">✓ 設定済み</span>
            )}
          </label>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">
            このキーは全組織の営業AI機能で共有されます。環境変数 ANTHROPIC_API_KEY が設定されている場合はそちらが優先されます。
          </p>
        </div>
      </div>

      {/* gBizINFO API Token */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-800">gBizINFO API設定</h3>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-2 text-sm text-indigo-800">
          <p className="font-medium">gBizINFO とは</p>
          <p className="text-indigo-700">
            経済産業省が提供する法人情報データベース。約400万社の会社名・住所・企業URLを取得できます。
            URL収集ページの「法人DB」タブからご利用いただけます。
          </p>
          <a
            href="https://info.gbiz.go.jp/api/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
          >
            APIトークンを取得する（無料・即時発行）
            <ExternalLink size={13} />
          </a>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            APIトークン
            {gbizTokenSet && (
              <span className="ml-2 text-emerald-600 text-xs font-normal">✓ 設定済み</span>
            )}
          </label>
          <input
            type="password"
            value={gbizToken}
            onChange={(e) => setGbizToken(e.target.value)}
            placeholder="gBizINFO APIトークンを入力"
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">
            このトークンは全組織で共有されます。申請はメールアドレスの登録のみで即時発行されます。
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        保存
      </button>
    </div>
  );
}
