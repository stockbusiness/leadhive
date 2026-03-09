import { useEffect, useState } from "react";
import { Key, Save, Loader2, CheckCircle, Building2, ExternalLink, Bot, Search, ChevronDown, ChevronUp, CreditCard, Mail, Info } from "lucide-react";
import { api } from "../api";

function StepsPanel({ steps, open, onToggle, color }: {
  steps: { num: number; text: string; note?: string }[];
  open: boolean;
  onToggle: () => void;
  color: "emerald" | "violet" | "indigo";
}) {
  const colors = {
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-600 text-white", btn: "text-emerald-600 hover:text-emerald-800" },
    violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  badge: "bg-violet-600 text-white",  btn: "text-violet-600 hover:text-violet-800" },
    indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700",  badge: "bg-indigo-600 text-white",  btn: "text-indigo-600 hover:text-indigo-800" },
  };
  const c = colors[color];

  return (
    <div className={`${c.bg} ${c.border} border rounded-lg overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium ${c.btn} transition-colors`}
      >
        <span className="flex items-center gap-2">
          <Info size={15} />
          APIキー取得手順を見る
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className={`px-4 pb-4 space-y-2 border-t ${c.border}`}>
          <ol className="space-y-2 mt-3">
            {steps.map((s) => (
              <li key={s.num} className="flex gap-3 items-start">
                <span className={`${c.badge} rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>
                  {s.num}
                </span>
                <div>
                  <span className={`text-sm ${c.text}`}>{s.text}</span>
                  {s.note && <p className="text-xs text-slate-500 mt-0.5">{s.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function AdminApiKeys() {
  const [gbizToken, setGbizToken] = useState("");
  const [gbizTokenSet, setGbizTokenSet] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicKeySet, setAnthropicKeySet] = useState(false);
  const [serperKey, setSerperKey] = useState("");
  const [serperKeySet, setSerperKeySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [serperStepsOpen, setSerperStepsOpen] = useState(false);
  const [anthropicStepsOpen, setAnthropicStepsOpen] = useState(false);
  const [gbizStepsOpen, setGbizStepsOpen] = useState(false);

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
      if (data.serper_api_key_set) {
        setSerperKeySet(true);
        setSerperKey((data.serper_api_key as string) || "");
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (gbizToken && !gbizToken.includes("••")) payload.gbizinfo_api_token = gbizToken;
      if (anthropicKey && !anthropicKey.includes("••")) payload.anthropic_api_key = anthropicKey;
      if (serperKey && !serperKey.includes("••")) payload.serper_api_key = serperKey;
      if (Object.keys(payload).length > 0) {
        await api.admin.updateApiSettings(payload);
        setSaved(true);
        if (payload.gbizinfo_api_token) setGbizTokenSet(true);
        if (payload.anthropic_api_key) setAnthropicKeySet(true);
        if (payload.serper_api_key) setSerperKeySet(true);
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
        <div>
          <h2 className="text-2xl font-bold text-slate-800">システムAPI設定</h2>
          <p className="text-sm text-slate-500 mt-0.5">COOLWORKS管理者のみ設定可能。全クライアント組織で共有されます。</p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
          <CheckCircle size={16} />
          設定を保存しました
        </div>
      )}

      {/* Serper API Key */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Search size={20} className="text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-800">Serper API設定</h3>
          <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">URL収集エンジン</span>
        </div>

        <div className="text-sm text-slate-600 space-y-1">
          <p>Google検索をAPIで利用できるサービス。キーワード収集で使用する検索エンジンです。</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">月2,500回まで無料</span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md">Google CSEより優先</span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md">即時利用可能</span>
          </div>
        </div>

        <StepsPanel
          open={serperStepsOpen}
          onToggle={() => setSerperStepsOpen((v) => !v)}
          color="emerald"
          steps={[
            { num: 1, text: "serper.dev にアクセスする", note: "https://serper.dev" },
            { num: 2, text: "「Get Started for Free」をクリックしてアカウントを作成", note: "メールアドレスとパスワードのみ。クレジットカード不要。" },
            { num: 3, text: "メール認証リンクをクリックしてログイン" },
            { num: 4, text: "ダッシュボードの「API Key」タブを開く" },
            { num: 5, text: "表示されたAPIキーをコピーして下の入力欄に貼り付ける" },
            { num: 6, text: "「保存」ボタンをクリック", note: "保存後すぐにキーワード収集でSerperが使われるようになります。" },
          ]}
        />

        <a
          href="https://serper.dev/api-key"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
        >
          <ExternalLink size={14} />
          Serper.dev を開く（無料登録）
        </a>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            APIキー
            {serperKeySet && <span className="ml-2 text-emerald-600 text-xs font-normal">✓ 設定済み</span>}
          </label>
          <input
            type="password"
            value={serperKey}
            onChange={(e) => setSerperKey(e.target.value)}
            placeholder="Serper APIキーを入力（例: abc123def456...）"
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">
            設定時はSerperが優先、未設定時はクライアントのGoogle Custom Search API設定にフォールバックします。
          </p>
        </div>
      </div>

      {/* Anthropic API Key */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-violet-600" />
          <h3 className="text-lg font-semibold text-slate-800">Anthropic API設定</h3>
          <span className="ml-auto text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">営業AI</span>
        </div>

        <div className="text-sm text-slate-600 space-y-1">
          <p>営業AI（Claude）の営業文生成に使用するAPIです。高品質な日本語対応LLMです。</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-1 rounded-md">
              <CreditCard size={11} />
              従量課金（要クレカ登録）
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md">Claude Sonnet使用</span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md">全組織共有</span>
          </div>
        </div>

        <StepsPanel
          open={anthropicStepsOpen}
          onToggle={() => setAnthropicStepsOpen((v) => !v)}
          color="violet"
          steps={[
            { num: 1, text: "console.anthropic.com にアクセスしてログイン（またはアカウント作成）", note: "https://console.anthropic.com" },
            { num: 2, text: "左メニューの「Settings」→「API Keys」を開く" },
            { num: 3, text: "「Create Key」ボタンをクリックして名前を付けてキーを生成" },
            { num: 4, text: "生成された「sk-ant-api03-...」で始まるキーをコピー", note: "このキーは生成時のみ表示されます。必ずコピーしてください。" },
            { num: 5, text: "「Billing」→「Add payment method」でクレジットカードを登録", note: "API使用量に応じた従量課金。Claude Sonnetは1,000トークンあたり約$0.003。" },
            { num: 6, text: "コピーしたキーを下の入力欄に貼り付けて「保存」をクリック" },
          ]}
        />

        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium"
        >
          <ExternalLink size={14} />
          Anthropic Console を開く
        </a>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            APIキー（sk-ant-...）
            {anthropicKeySet && <span className="ml-2 text-emerald-600 text-xs font-normal">✓ 設定済み</span>}
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
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-800">gBizINFO API設定</h3>
          <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">法人DB収集</span>
        </div>

        <div className="text-sm text-slate-600 space-y-1">
          <p>経済産業省が提供する法人情報データベース。約400万社の会社名・住所・企業URLを収集できます。</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">
              <Mail size={11} />
              完全無料・即時発行
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md">政府公式API</span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md">URL収集→法人DBタブで使用</span>
          </div>
        </div>

        <StepsPanel
          open={gbizStepsOpen}
          onToggle={() => setGbizStepsOpen((v) => !v)}
          color="indigo"
          steps={[
            { num: 1, text: "gBizINFOのAPI申請ページにアクセス", note: "https://info.gbiz.go.jp/api/index.html" },
            { num: 2, text: "「利用申請はこちら」ボタンをクリック" },
            { num: 3, text: "メールアドレスを入力して「申請する」をクリック", note: "クレジットカード不要。メールアドレスのみで申請完了。" },
            { num: 4, text: "申請したメールアドレス宛にAPIトークンが届く", note: "通常数分以内にメールが届きます。迷惑メールフォルダもご確認ください。" },
            { num: 5, text: "届いたAPIトークンをコピーして下の入力欄に貼り付ける" },
            { num: 6, text: "「保存」ボタンをクリック。URL収集→「法人DB」タブから利用可能になります。" },
          ]}
        />

        <a
          href="https://info.gbiz.go.jp/api/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <ExternalLink size={14} />
          gBizINFO API申請ページを開く（無料・即時発行）
        </a>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            APIトークン
            {gbizTokenSet && <span className="ml-2 text-emerald-600 text-xs font-normal">✓ 設定済み</span>}
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
