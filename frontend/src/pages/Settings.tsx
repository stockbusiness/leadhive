import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Settings as SettingsIcon, Save, CheckCircle, XCircle, Loader2, Clock, Timer, MessageSquare, Mail, Search, MapPin, Bell, Sparkles, Crown, PartyPopper, DatabaseZap, ShieldCheck, Trash2, Download, LogOut, ExternalLink, AlertTriangle, QrCode } from "lucide-react";
import axios from "axios";
import HelpTooltip from "../components/HelpTooltip";
import { api } from "../api";
import type { PlanData, PlanUsage } from "../types";

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

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-700 font-medium">{used.toLocaleString()} / 無制限</span>
      </div>
    );
  }
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className={`font-medium ${pct >= 90 ? "text-red-600" : "text-slate-700"}`}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanCurrentSection() {
  const [plan, setPlan] = useState<PlanData | null | undefined>(undefined);
  const [usage, setUsage] = useState<PlanUsage | null>(null);

  useEffect(() => {
    api.plans.current().then((data) => {
      setPlan(data.plan ?? null);
      setUsage(data.usage);
    }).catch(() => setPlan(null));
  }, []);

  if (plan === undefined) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-4">
      <SectionHeader icon={<Crown size={20} className="text-amber-500" />} title="現在のプラン" />
      {plan === null ? (
        <p className="text-sm text-slate-500">プランが設定されていません。管理者にお問い合わせください。</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-slate-800">{plan.name}</span>
            {plan.price_monthly !== null && (
              <span className="text-sm text-slate-500">¥{plan.price_monthly.toLocaleString()} / 月</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${plan.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {plan.is_active ? "有効" : "無効"}
            </span>
          </div>
          {plan.description && (
            <p className="text-sm text-slate-500">{plan.description}</p>
          )}
          {plan.price_monthly !== null && plan.price_monthly > 0 && (
            <div className="pt-1">
              <button
                onClick={async () => {
                  try {
                    const res = await api.stripe.createCustomerPortal();
                    window.location.href = res.url;
                  } catch {
                    alert("サブスクリプション管理ページを開けませんでした。まず有料プランへのアップグレードが必要です。");
                  }
                }}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <ExternalLink size={14} />
                サブスクリプションを管理する（請求・解約）
              </button>
            </div>
          )}
          {usage && (
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">使用量</p>
              <UsageBar label="メンバー" used={usage.members} limit={plan.max_members} />
              <UsageBar label="プロジェクト" used={usage.projects} limit={plan.max_projects} />
              <UsageBar label="登録企業数" used={usage.companies} limit={plan.max_companies} />
              <UsageBar label="AI分析（今月）" used={usage.ai_analyses_this_month} limit={plan.max_ai_analyses_monthly} />
              {plan.max_master_db_imports === 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">マスターDBインポート（今月）</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">スターター以上で利用可能</span>
                </div>
              ) : (
                <UsageBar label="マスターDBインポート（今月）" used={usage.master_db_imports_this_month} limit={plan.max_master_db_imports} />
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">CSVエクスポート上限</span>
                {plan.max_csv_export === null ? (
                  <span className="text-slate-500">無制限</span>
                ) : plan.max_csv_export === 0 ? (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">スターター以上で利用可能</span>
                ) : (
                  <span className="font-medium text-slate-700">{plan.max_csv_export.toLocaleString()}件 / 回</span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [upgradeSuccess, setUpgradeSuccess] = useState(searchParams.get("upgrade") === "success");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  useEffect(() => {
    if (upgradeSuccess) {
      const t = setTimeout(() => {
        setUpgradeSuccess(false);
        setSearchParams({}, { replace: true });
      }, 8000);
      return () => clearTimeout(t);
    }
  }, [upgradeSuccess, setSearchParams]);

  const [apiKey, setApiKey] = useState("");
  const [cx, setCx] = useState("");
  const [placesApiKey, setPlacesApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [cxSet, setCxSet] = useState(false);
  const [placesApiKeySet, setPlacesApiKeySet] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);
  const [showPlacesGuide, setShowPlacesGuide] = useState(false);

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
  const [autoEnrichEnabled, setAutoEnrichEnabled] = useState(true);
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
      if (s.auto_enrich_enabled) setAutoEnrichEnabled(s.auto_enrich_enabled.value !== "false");
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
    data.auto_enrich_enabled = autoEnrichEnabled ? "true" : "false";
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
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-800">設定</h2>
        <HelpTooltip text="Google API・自動収集スケジュール・通知設定など、LeadHiveの動作をカスタマイズできます。" />
      </div>

      {upgradeSuccess && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-300 rounded-xl px-5 py-4">
          <PartyPopper size={20} className="text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">アップグレード完了！</p>
            <p className="text-sm text-emerald-600">プランが変更されました。新しい機能をお楽しみください。</p>
          </div>
          <button onClick={() => { setUpgradeSuccess(false); setSearchParams({}, { replace: true }); }} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <XCircle size={18} />
          </button>
        </div>
      )}

      <PlanCurrentSection />

      {message && <MessageBox msg={message} />}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<Search size={20} className="text-slate-600" />} title="Google Custom Search API 設定" />
        <p className="text-sm text-slate-500">
          自動収集機能を利用するには、Google Custom Search APIのAPIキーとSearch Engine ID (cx)が必要です。
          <strong className="text-slate-700">1日100回まで無料</strong>で利用できます。
        </p>

        <button
          onClick={() => setShowApiGuide(v => !v)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <span>{showApiGuide ? "▼" : "▶"}</span>
          APIキーと検索エンジンIDの取得手順を見る
        </button>

        {showApiGuide && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-5 text-sm">
            <div>
              <p className="font-bold text-blue-800 mb-2">① Google API Key の取得</p>
              <ol className="space-y-1.5 text-blue-700 list-none">
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">1</span>
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a> を開き、Googleアカウントでログイン
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">2</span>
                  上部の「プロジェクトを選択」→「新しいプロジェクト」でプロジェクトを作成（名前は任意）
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">3</span>
                  左メニュー「APIとサービス」→「ライブラリ」→ 検索欄に <strong>「Custom Search API」</strong> と入力して有効化
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">4</span>
                  左メニュー「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」をクリック
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">5</span>
                  生成された <strong>「AIzaSy...」</strong> から始まるキーをコピーして「Google API Key」欄に貼り付け
                </li>
              </ol>
            </div>

            <div className="border-t border-blue-200 pt-4">
              <p className="font-bold text-blue-800 mb-2">② Search Engine ID (cx) の取得</p>
              <ol className="space-y-1.5 text-blue-700 list-none">
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">1</span>
                  <a href="https://programmablesearchengine.google.com/controlpanel/create" target="_blank" rel="noopener noreferrer" className="underline font-medium">Programmable Search Engine</a> を開く
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">2</span>
                  「検索エンジン名」に任意の名前を入力（例：LeadHive）
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">3</span>
                  「検索対象」で <strong>「ウェブ全体を検索する」</strong> を選択して「作成」をクリック
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">4</span>
                  作成完了後、「コントロールパネルへ」→「基本」タブを開く
                </li>
                <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">5</span>
                  「検索エンジン ID」欄に表示される <strong>「a1b2c3...」</strong> 形式のIDをコピーして貼り付け
                </li>
              </ol>
              <p className="text-xs text-blue-600 mt-2 bg-blue-100 rounded px-3 py-1.5">
                ※ 設定後「ウェブ全体を検索」が有効になっていることをコントロールパネルで確認してください。
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Google API Key {apiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIzaSy..." className={inputClass} />
            <p className="text-xs text-slate-400 mt-1">Google Cloud Console → APIとサービス → 認証情報 → APIキー で取得</p>
          </div>
          <div>
            <label className={labelClass}>Search Engine ID (cx) {cxSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="text" value={cx} onChange={e => setCx(e.target.value)} placeholder="a1b2c3d4e5f6..." className={inputClass} />
            <p className="text-xs text-slate-400 mt-1">Programmable Search Engine → コントロールパネル → 基本 → 検索エンジンID で取得</p>
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
        <p className="text-sm text-slate-500">GoogleマップからエリアごとにEC・Shopify関連企業を収集するためのAPIキーです。</p>

        <button
          onClick={() => setShowPlacesGuide(v => !v)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <span>{showPlacesGuide ? "▼" : "▶"}</span>
          Places APIキーの取得手順を見る
        </button>

        {showPlacesGuide && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5 text-sm">
            <p className="font-bold text-blue-800 mb-2">Google Places API Key の取得</p>
            <ol className="space-y-1.5 text-blue-700 list-none">
              <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">1</span>
                <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a> で、Custom Search API と同じプロジェクトを選択
              </li>
              <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">2</span>
                「APIとサービス」→「ライブラリ」→ 検索欄に <strong>「Places API」</strong> と入力して有効化
              </li>
              <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">3</span>
                「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」で新しいキーを作成
              </li>
              <li><span className="inline-block w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold text-center leading-5 mr-1.5">4</span>
                生成された <strong>「AIzaSy...」</strong> から始まるキーをコピーして「Google Places API Key」欄に貼り付け
              </li>
            </ol>
            <p className="text-xs text-blue-600 mt-2 bg-blue-100 rounded px-3 py-1.5">
              ※ Custom Search API と同じAPIキーを使うことも可能ですが、利用制限を分けて管理したい場合は別キーを推奨します。
            </p>
          </div>
        )}

        <div>
          <label className={labelClass}>Google Places API Key {placesApiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
          <input type="password" value={placesApiKey} onChange={e => setPlacesApiKey(e.target.value)} placeholder="AIzaSy..." className={inputClass} />
          <p className="text-xs text-slate-400 mt-1">Google Cloud Console → APIとサービス → 認証情報 で取得（Places APIを有効化）</p>
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
        <SectionHeader
          icon={<DatabaseZap size={20} className="text-indigo-600" />}
          title="自動情報補完スケジュール"
        />
        <p className="text-sm text-slate-500">
          有効にすると、毎日 AM 4:00 にURLが未取得の企業を自動的にgBizINFO・Google検索で補完します。
          gBizINFO APIトークンが設定されている場合に効果を発揮します。
        </p>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={autoEnrichEnabled} onChange={e => setAutoEnrichEnabled(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
          <span className="text-sm font-medium text-slate-700">自動情報補完を有効にする</span>
        </div>
        <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 space-y-1">
          <p>① 法人番号でgBizINFOを再検索 → URLを取得</p>
          <p>② Google検索で会社名からURLを探索</p>
          <p>③ URLが見つかればスクレイピングしてCMS・メールを補完</p>
          <p className="text-indigo-500 font-medium mt-1">1プロジェクトあたり最大50社 / 日</p>
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

      <TwoFactorSection />
      <DangerZoneSection />

    </div>
  );
}


function TwoFactorSection() {
  const [user, setUser] = useState<{ totp_enabled?: boolean } | null>(null);
  const [step, setStep] = useState<"idle" | "setup" | "confirm">("idle");
  const [qrImage, setQrImage] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<MessageState | null>(null);

  useEffect(() => {
    api.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.auth.setup2fa();
      setQrImage(res.qr_image);
      setSecret(res.secret);
      setStep("setup");
    } catch {
      setMsg({ type: "error", text: "セットアップの開始に失敗しました" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code || code.length !== 6) {
      setMsg({ type: "error", text: "6桁のコードを入力してください" });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.auth.confirm2fa(code, secret);
      localStorage.setItem("access_token", res.access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.access_token}`;
      setUser(res.user);
      setStep("idle");
      setCode("");
      setMsg({ type: "success", text: "2段階認証を有効にしました" });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.detail || "コードが正しくありません" });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword) {
      setMsg({ type: "error", text: "パスワードを入力してください" });
      return;
    }
    if (!confirm("2段階認証を無効にしますか？")) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.auth.disable2fa(disablePassword);
      localStorage.setItem("access_token", res.access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.access_token}`;
      setUser(res.user);
      setDisablePassword("");
      setMsg({ type: "success", text: "2段階認証を無効にしました" });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.detail || "無効化に失敗しました" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
      <SectionHeader icon={<ShieldCheck size={20} className="text-blue-600" />} title="2段階認証（TOTP）" />
      <p className="text-sm text-slate-500">
        Google Authenticatorなどの認証アプリを使って、ログイン時に追加の確認コードを要求します。
      </p>

      {msg && <MessageBox msg={msg} />}

      {user?.totp_enabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle size={16} />
            2段階認証は有効です
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">無効化するにはパスワードを入力</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={disablePassword}
                onChange={e => setDisablePassword(e.target.value)}
                placeholder="パスワード"
                className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleDisable}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : "無効化"}
              </button>
            </div>
          </div>
        </div>
      ) : step === "idle" ? (
        <button
          onClick={handleSetup}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
          2段階認証を設定する
        </button>
      ) : step === "setup" ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">1. 認証アプリ（Google Authenticator等）でQRコードをスキャンしてください。</p>
          {qrImage && <img src={qrImage} alt="QR Code" className="border rounded-lg p-2 w-48 h-48" />}
          <p className="text-xs text-slate-500">手動入力する場合のシークレット: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{secret}</code></p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">2. 認証アプリに表示された6桁のコードを入力</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-32 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest font-mono"
              />
              <button
                onClick={handleConfirm}
                disabled={loading || code.length !== 6}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : "確認して有効化"}
              </button>
              <button onClick={() => setStep("idle")} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import axios from "axios";

function DangerZoneSection() {
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [msg, setMsg] = useState<MessageState | null>(null);

  const handleLogoutAll = async () => {
    if (!confirm("他の全デバイスからログアウトします。現在のセッションは継続されます。")) return;
    setLogoutLoading(true);
    try {
      const res = await api.auth.logoutAll();
      localStorage.setItem("access_token", res.access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.access_token}`;
      setMsg({ type: "success", text: "全デバイスからログアウトしました" });
    } catch {
      setMsg({ type: "error", text: "操作に失敗しました" });
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const blob = await api.auth.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leadhive_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type: "success", text: "データをエクスポートしました" });
    } catch {
      setMsg({ type: "error", text: "エクスポートに失敗しました" });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMsg({ type: "error", text: "パスワードを入力してください" });
      return;
    }
    setDeleteLoading(true);
    try {
      await api.auth.deleteAccount(deletePassword);
      localStorage.removeItem("access_token");
      delete axios.defaults.headers.common["Authorization"];
      window.location.href = "/";
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.detail || "削除に失敗しました" });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-red-100 pb-3">
        <AlertTriangle size={20} className="text-red-500" />
        <h3 className="font-semibold text-red-700">アカウント管理</h3>
      </div>

      {msg && <MessageBox msg={msg} />}

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">全デバイスからログアウト</p>
            <p className="text-xs text-slate-500 mt-0.5">他のすべてのデバイスのセッションを無効にします</p>
          </div>
          <button
            onClick={handleLogoutAll}
            disabled={logoutLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            {logoutLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            ログアウト
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">データをエクスポート</p>
            <p className="text-xs text-slate-500 mt-0.5">登録企業・プロジェクト情報をJSON形式でダウンロード（GDPR対応）</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            エクスポート
          </button>
        </div>

        <div className="py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-700">アカウントを削除</p>
              <p className="text-xs text-slate-500 mt-0.5">アカウントと全データを削除します。この操作は取り消せません。</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(v => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 whitespace-nowrap"
            >
              <Trash2 size={14} />
              削除する
            </button>
          </div>
          {showDeleteConfirm && (
            <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
              <p className="text-sm text-red-700 font-medium">本当にアカウントを削除しますか？</p>
              <p className="text-xs text-red-600">全データが削除され、Stripeサブスクリプションもキャンセルされます。</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="現在のパスワードを入力"
                  className="flex-1 border border-red-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : "削除確認"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
