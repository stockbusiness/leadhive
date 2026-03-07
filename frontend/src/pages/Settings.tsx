import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, CheckCircle, XCircle, Loader2, Clock, Timer, MessageSquare, Mail, Search, MapPin, Bell, Sparkles } from "lucide-react";
import { api } from "../api";

interface MessageState {
  type: "success" | "error";
  text: string;
}

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
      {icon}
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {badge}
    </div>
  );
}

function MessageBox({ msg }: { msg: MessageState }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
      msg.type === "success"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : "bg-red-50 text-red-700 border border-red-200"
    }`}>
      {msg.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {msg.text}
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      保存
    </button>
  );
}

export default function Settings() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [cx, setCx] = useState("");
  const [placesApiKey, setPlacesApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [cxSet, setCxSet] = useState(false);
  const [placesApiKeySet, setPlacesApiKeySet] = useState(false);
  const [testing, setTesting] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("LeadHive");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpMessage, setSmtpMessage] = useState<MessageState | null>(null);

  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackWebhookSet, setSlackWebhookSet] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackMessage, setSlackMessage] = useState<MessageState | null>(null);

  const [autoCollectEnabled, setAutoCollectEnabled] = useState(false);
  const [autoCollectTime, setAutoCollectTime] = useState("09:00");
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const [followupNotifyEnabled, setFollowupNotifyEnabled] = useState(false);
  const [followupNotifyChannel, setFollowupNotifyChannel] = useState("email");

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiApiKeySet, setOpenaiApiKeySet] = useState(false);

  useEffect(() => {
    api.settings.get().then((data) => {
      const s = data.settings;
      if (s.google_api_key) { setApiKeySet(s.google_api_key.is_set); if (s.google_api_key.is_set) setApiKey(s.google_api_key.value); }
      if (s.google_cx) { setCxSet(s.google_cx.is_set); if (s.google_cx.is_set) setCx(s.google_cx.value); }
      if (s.google_places_api_key) { setPlacesApiKeySet(s.google_places_api_key.is_set); if (s.google_places_api_key.is_set) setPlacesApiKey(s.google_places_api_key.value); }
      if (s.slack_webhook_url) { setSlackWebhookSet(s.slack_webhook_url.is_set); if (s.slack_webhook_url.is_set) setSlackWebhookUrl(s.slack_webhook_url.value); }
      if (s.auto_collect_enabled) setAutoCollectEnabled(s.auto_collect_enabled.value === "true");
      if (s.auto_collect_time?.is_set) setAutoCollectTime(s.auto_collect_time.value);
      if (s.smtp_host?.is_set) setSmtpHost(s.smtp_host.value);
      if (s.smtp_port?.is_set) setSmtpPort(s.smtp_port.value);
      if (s.smtp_user?.is_set) setSmtpUser(s.smtp_user.value);
      if (s.smtp_password) { setSmtpPasswordSet(s.smtp_password.is_set); if (s.smtp_password.is_set) setSmtpPassword(s.smtp_password.value); }
      if (s.smtp_from_email?.is_set) setSmtpFromEmail(s.smtp_from_email.value);
      if (s.smtp_from_name?.is_set) setSmtpFromName(s.smtp_from_name.value);
      if (s.smtp_use_tls?.is_set) setSmtpUseTls(s.smtp_use_tls.value !== "false");
      if (s.followup_notify_enabled) setFollowupNotifyEnabled(s.followup_notify_enabled.value === "true");
      if (s.followup_notify_channel?.is_set) setFollowupNotifyChannel(s.followup_notify_channel.value);
      if (s.openai_api_key) { setOpenaiApiKeySet(s.openai_api_key.is_set); if (s.openai_api_key.is_set) setOpenaiApiKey(s.openai_api_key.value); }
    });
    api.settings.getScheduler().then((data) => setSchedulerRunning(data.running)).catch(() => {});
  }, []);

  const buildPayload = () => {
    const data: Record<string, string> = {};
    if (apiKey && !apiKey.includes("*")) data.google_api_key = apiKey;
    if (cx && !cx.includes("*")) data.google_cx = cx;
    if (placesApiKey && !placesApiKey.includes("*")) data.google_places_api_key = placesApiKey;
    if (slackWebhookUrl && !slackWebhookUrl.includes("*")) data.slack_webhook_url = slackWebhookUrl;
    if (smtpHost) data.smtp_host = smtpHost;
    if (smtpPort) data.smtp_port = smtpPort;
    if (smtpUser) data.smtp_user = smtpUser;
    if (smtpPassword && !smtpPassword.includes("*")) data.smtp_password = smtpPassword;
    if (smtpFromEmail) data.smtp_from_email = smtpFromEmail;
    if (smtpFromName) data.smtp_from_name = smtpFromName;
    data.smtp_use_tls = smtpUseTls ? "true" : "false";
    data.auto_collect_enabled = autoCollectEnabled ? "true" : "false";
    data.auto_collect_time = autoCollectTime;
    data.followup_notify_enabled = followupNotifyEnabled ? "true" : "false";
    data.followup_notify_channel = followupNotifyChannel;
    if (openaiApiKey && !openaiApiKey.includes("*")) data.openai_api_key = openaiApiKey;
    return data;
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.settings.update(buildPayload());
      setMessage({ type: "success", text: "設定を保存しました" });
      const res = await api.settings.get();
      const s = res.settings;
      setApiKeySet(s.google_api_key?.is_set || false);
      setCxSet(s.google_cx?.is_set || false);
      setPlacesApiKeySet(s.google_places_api_key?.is_set || false);
      setSmtpPasswordSet(s.smtp_password?.is_set || false);
      if (s.google_api_key?.is_set) setApiKey(s.google_api_key.value);
      if (s.google_cx?.is_set) setCx(s.google_cx.value);
      if (s.google_places_api_key?.is_set) setPlacesApiKey(s.google_places_api_key.value);
      if (s.slack_webhook_url?.is_set) { setSlackWebhookSet(true); setSlackWebhookUrl(s.slack_webhook_url.value); }
      if (s.smtp_password?.is_set) setSmtpPassword(s.smtp_password.value);
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "保存に失敗しました" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const data = await api.settings.test();
      setMessage({ type: data.success ? "success" : "error", text: data.message });
    } catch {
      setMessage({ type: "error", text: "接続テストに失敗しました" });
    }
    setTesting(false);
  };

  const handleSlackTest = async () => {
    setSlackTesting(true);
    setSlackMessage(null);
    try {
      const data = await api.settings.slackTest();
      setSlackMessage({ type: data.success ? "success" : "error", text: data.message });
    } catch {
      setSlackMessage({ type: "error", text: "Slackテスト送信に失敗しました" });
    }
    setSlackTesting(false);
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    setSmtpMessage(null);
    try {
      const data = await api.settings.smtpTest(smtpTestEmail || undefined);
      setSmtpMessage({ type: data.success ? "success" : "error", text: data.message });
    } catch {
      setSmtpMessage({ type: "error", text: "SMTPテスト送信に失敗しました" });
    }
    setSmtpTesting(false);
  };

  const inputClass = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-800">設定</h2>

      {message && <MessageBox msg={message} />}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<Search size={20} className="text-slate-600" />} title="Google Custom Search API 設定" />
        <p className="text-sm text-slate-500">
          自動収集機能を利用するには、Google Custom Search APIのAPIキーとSearch Engine ID (cx)が必要です。
          <a href="https://developers.google.com/custom-search/v1/introduction" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">詳細はこちら</a>
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Google API Key {apiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIzaSy..." className={inputClass} />
            <p className="text-xs text-slate-400 mt-1">Google Cloud ConsoleでCustom Search APIを有効にして取得してください</p>
          </div>
          <div>
            <label className={labelClass}>Search Engine ID (cx) {cxSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="text" value={cx} onChange={e => setCx(e.target.value)} placeholder="a1b2c3d4e5f6..." className={inputClass} />
          </div>
        </div>
        <div className="flex gap-3">
          <SaveButton saving={saving} onClick={handleSave} />
          <button onClick={handleTest} disabled={testing || (!apiKeySet && !apiKey)} className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors disabled:opacity-50">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            接続テスト
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<MapPin size={20} className="text-slate-600" />} title="Google Places API 設定（Googleマップ収集）" />
        <div>
          <label className={labelClass}>Google Places API Key {placesApiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
          <input type="password" value={placesApiKey} onChange={e => setPlacesApiKey(e.target.value)} placeholder="AIzaSy..." className={inputClass} />
          <p className="text-xs text-slate-400 mt-1">Google Cloud ConsoleでPlaces APIを有効にして取得してください</p>
        </div>
        <SaveButton saving={saving} onClick={handleSave} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<Mail size={20} className="text-slate-600" />} title="SMTPメール設定" />
        <p className="text-sm text-slate-500">メンバー招待やパスワードリセットにSMTPメール送信を使用します。設定しない場合は招待URLのコピーで対応できます。</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>SMTPホスト</label>
            <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>ポート</label>
            <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>SMTPユーザー名</label>
            <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="your@email.com" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>SMTPパスワード {smtpPasswordSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="パスワード" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>送信元メールアドレス</label>
            <input type="email" value={smtpFromEmail} onChange={e => setSmtpFromEmail(e.target.value)} placeholder="noreply@yourcompany.com" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>送信元名</label>
            <input type="text" value={smtpFromName} onChange={e => setSmtpFromName(e.target.value)} placeholder="LeadHive" className={inputClass} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={smtpUseTls} onChange={e => setSmtpUseTls(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
          <span className="text-sm text-slate-700">STARTTLS を使用する（推奨: ポート587の場合）</span>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <label className={labelClass}>テスト送信先メールアドレス（省略時は自分のアドレス）</label>
          <div className="flex gap-2">
            <input type="email" value={smtpTestEmail} onChange={e => setSmtpTestEmail(e.target.value)} placeholder="test@example.com" className={inputClass} />
          </div>
        </div>
        <div className="flex gap-3">
          <SaveButton saving={saving} onClick={handleSave} />
          <button onClick={handleSmtpTest} disabled={smtpTesting || !smtpHost} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {smtpTesting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            テスト送信
          </button>
        </div>
        {smtpMessage && <MessageBox msg={smtpMessage} />}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<MessageSquare size={20} className="text-slate-600" />} title="Slack通知設定" />
        <p className="text-sm text-slate-500">
          Slack Incoming Webhook URLを設定すると、収集完了時にSlackへ通知を送信します。
          <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">Webhook URLの取得方法</a>
        </p>
        <div>
          <label className={labelClass}>Slack Webhook URL {slackWebhookSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
          <input type="password" value={slackWebhookUrl} onChange={e => setSlackWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." className={inputClass} />
        </div>
        <div className="flex gap-3">
          <SaveButton saving={saving} onClick={handleSave} />
          <button onClick={handleSlackTest} disabled={slackTesting || (!slackWebhookSet && !slackWebhookUrl)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {slackTesting ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
            テスト送信
          </button>
        </div>
        {slackMessage && <MessageBox msg={slackMessage} />}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader
          icon={<Timer size={20} className="text-slate-600" />}
          title="自動収集スケジュール"
          badge={schedulerRunning ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">稼働中</span> : undefined}
        />
        <p className="text-sm text-slate-500">有効にすると、指定した時刻にアクティブなキーワードで自動的にGoogle検索・収集を実行します。</p>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={autoCollectEnabled} onChange={e => setAutoCollectEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
            <span className="text-sm font-medium text-slate-700">自動収集を有効にする</span>
          </div>
          <div>
            <label className={labelClass}><Clock size={14} className="inline mr-1" />実行時刻</label>
            <input type="time" value={autoCollectTime} onChange={e => setAutoCollectTime(e.target.value)} disabled={!autoCollectEnabled} className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100" />
          </div>
        </div>
        <SaveButton saving={saving} onClick={handleSave} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<Bell size={20} className="text-slate-600" />} title="フォローアップ通知設定" />
        <p className="text-sm text-slate-500">
          有効にすると、毎朝9時にフォローアップ期限が当日または超過している企業を管理者へ通知します。
          通知にはSlack Webhook URLまたはSMTPメールの設定が必要です。
        </p>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={followupNotifyEnabled} onChange={e => setFollowupNotifyEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
            <span className="text-sm font-medium text-slate-700">フォローアップ通知を有効にする</span>
          </div>
          <div>
            <label className={labelClass}>通知チャンネル</label>
            <select
              value={followupNotifyChannel}
              onChange={e => setFollowupNotifyChannel(e.target.value)}
              disabled={!followupNotifyEnabled}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
            >
              <option value="email">メールのみ</option>
              <option value="slack">Slackのみ</option>
              <option value="both">メール + Slack</option>
            </select>
          </div>
        </div>
        <SaveButton saving={saving} onClick={handleSave} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<Sparkles size={20} className="text-violet-600" />} title="AI企業分析 設定（OpenAI）" />
        <p className="text-sm text-slate-500">
          OpenAI APIキーを設定すると、企業詳細ページでAIによる企業サマリーの自動生成が利用できます。
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">APIキーの取得</a>
        </p>
        <div>
          <label className={labelClass}>OpenAI APIキー {openaiApiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
          <input
            type="password"
            value={openaiApiKey}
            onChange={e => setOpenaiApiKey(e.target.value)}
            placeholder="sk-..."
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">GPT-4o-miniを使用します。1回の分析で約0.01〜0.03ドルの費用がかかります。</p>
        </div>
        <SaveButton saving={saving} onClick={handleSave} />
      </div>
    </div>
  );
}
