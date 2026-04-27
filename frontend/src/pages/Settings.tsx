import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { Settings as SettingsIcon, Save, CheckCircle, XCircle, Loader2, Clock, Timer, MessageSquare, Mail, Search, MapPin, Bell, Sparkles, Crown, PartyPopper, DatabaseZap, ShieldCheck, Trash2, Download, LogOut, ExternalLink, AlertTriangle, QrCode, Zap } from "lucide-react";
import axios from "axios";
import HelpTooltip from "../components/HelpTooltip";
import HelpPanel from "../components/HelpPanel";
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

function SaveButton({ saving, onClick, disabled }: { saving: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
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

function PlanCurrentSection({ isAdmin }: { isAdmin: boolean }) {
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
          {isAdmin && plan.price_monthly !== null && plan.price_monthly > 0 && (
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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

  const [placesApiKey, setPlacesApiKey] = useState("");
  const [placesApiKeySet, setPlacesApiKeySet] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPlacesGuide, setShowPlacesGuide] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("LeadHive");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false);
  const [smtpHostSet, setSmtpHostSet] = useState(false);
  const [smtpUserSet, setSmtpUserSet] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpMessage, setSmtpMessage] = useState<MessageState | null>(null);

  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackWebhookSet, setSlackWebhookSet] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackMessage, setSlackMessage] = useState<MessageState | null>(null);
  const [slackTriggers, setSlackTriggers] = useState<Record<string, boolean>>({ rank_a_added: true, email_opened: true });
  const [slackTriggersSaving, setSlackTriggersSaving] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [crApiKey, setCrApiKey] = useState("");
  const [crApiKeySet, setCrApiKeySet] = useState(false);
  const [crHmacSecret, setCrHmacSecret] = useState("");
  const [crHmacSecretSet, setCrHmacSecretSet] = useState(false);
  const [crTenantId, setCrTenantId] = useState("");
  const [crProductCode, setCrProductCode] = useState("");
  const [crBaseUrl, setCrBaseUrl] = useState("https://app.commitrev.com");
  const [crSaving, setCrSaving] = useState(false);
  const [crTesting, setCrTesting] = useState(false);
  const [crMessage, setCrMessage] = useState<MessageState | null>(null);
  const [lbApiKeySet, setLbApiKeySet] = useState(false);
  const [lbApiKeyMasked, setLbApiKeyMasked] = useState("");
  const [lbNewKey, setLbNewKey] = useState("");
  const [lbGenerating, setLbGenerating] = useState(false);
  const [lbRevoking, setLbRevoking] = useState(false);
  const [lbMessage, setLbMessage] = useState<MessageState | null>(null);

  const [autoCollectEnabled, setAutoCollectEnabled] = useState(false);
  const [autoCollectTime, setAutoCollectTime] = useState("09:00");
  const [autoEnrichEnabled, setAutoEnrichEnabled] = useState(true);
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const [followupNotifyEnabled, setFollowupNotifyEnabled] = useState(false);
  const [followupNotifyChannel, setFollowupNotifyChannel] = useState("email");

  const [serperApiKey, setSerperApiKey] = useState("");
  const [serperApiKeySet, setSerperApiKeySet] = useState(false);
  const [serperTesting, setSerperTesting] = useState(false);
  const [serperMessage, setSerperMessage] = useState<MessageState | null>(null);

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiApiKeySet, setOpenaiApiKeySet] = useState(false);

  const [sgApiKey, setSgApiKey] = useState("");
  const [sgApiKeySet, setSgApiKeySet] = useState(false);
  const [sgFromEmail, setSgFromEmail] = useState("");
  const [sgFromName, setSgFromName] = useState("LeadHive");
  const [sgTesting, setSgTesting] = useState(false);
  const [sgTestEmail, setSgTestEmail] = useState("");
  const [sgMessage, setSgMessage] = useState<MessageState | null>(null);

  useEffect(() => {
    api.settings.get().then((data) => {
      const s = data.settings;
      if (s.google_places_api_key) { setPlacesApiKeySet(s.google_places_api_key.is_set); if (s.google_places_api_key.is_set) setPlacesApiKey(s.google_places_api_key.value); }
      if (s.slack_webhook_url) { setSlackWebhookSet(s.slack_webhook_url.is_set); if (s.slack_webhook_url.is_set) setSlackWebhookUrl(s.slack_webhook_url.value); }
      if (s.auto_collect_enabled) setAutoCollectEnabled(s.auto_collect_enabled.value === "true");
      if (s.auto_collect_time?.is_set) setAutoCollectTime(s.auto_collect_time.value);
      if (s.auto_enrich_enabled) setAutoEnrichEnabled(s.auto_enrich_enabled.value !== "false");
      if (s.smtp_host) { setSmtpHostSet(s.smtp_host.is_set); if (s.smtp_host.is_set) setSmtpHost(s.smtp_host.value); }
      if (s.smtp_port?.is_set) setSmtpPort(s.smtp_port.value);
      if (s.smtp_user) { setSmtpUserSet(s.smtp_user.is_set); if (s.smtp_user.is_set) setSmtpUser(s.smtp_user.value); }
      if (s.smtp_password) { setSmtpPasswordSet(s.smtp_password.is_set); if (s.smtp_password.is_set) setSmtpPassword(s.smtp_password.value); }
      if (s.smtp_from_email?.is_set) setSmtpFromEmail(s.smtp_from_email.value);
      if (s.smtp_from_name?.is_set) setSmtpFromName(s.smtp_from_name.value);
      if (s.smtp_use_tls?.is_set) setSmtpUseTls(s.smtp_use_tls.value !== "false");
      if (s.followup_notify_enabled) setFollowupNotifyEnabled(s.followup_notify_enabled.value === "true");
      if (s.followup_notify_channel?.is_set) setFollowupNotifyChannel(s.followup_notify_channel.value);
      if (s.serper_api_key) { setSerperApiKeySet(s.serper_api_key.is_set); if (s.serper_api_key.is_set) setSerperApiKey(s.serper_api_key.value); }
      if (s.openai_api_key) { setOpenaiApiKeySet(s.openai_api_key.is_set); if (s.openai_api_key.is_set) setOpenaiApiKey(s.openai_api_key.value); }
      if (s.sendgrid_api_key) { setSgApiKeySet(s.sendgrid_api_key.is_set); if (s.sendgrid_api_key.is_set) setSgApiKey(s.sendgrid_api_key.value); }
      if (s.sendgrid_from_email?.is_set) setSgFromEmail(s.sendgrid_from_email.value);
      if (s.sendgrid_from_name?.is_set) setSgFromName(s.sendgrid_from_name.value);
    });
    api.settings.getScheduler().then((data) => setSchedulerRunning(data.running)).catch(() => {});
    api.auth.me().then((u: any) => {
      if (u?.role === "admin") {
        setIsOrgAdmin(true);
      }
      if (u?.is_system_admin) {
        setIsSystemAdmin(true);
        fetch("/api/admin/slack-triggers").then(r => r.json()).then(d => {
          if (d.triggers) setSlackTriggers(d.triggers);
        }).catch(() => {});
        fetch("/api/admin/commitrev/settings").then(r => r.json()).then((d: any) => {
          if (d.commitrev_api_key) { setCrApiKeySet(d.commitrev_api_key.is_set); if (d.commitrev_api_key.is_set) setCrApiKey(d.commitrev_api_key.value); }
          if (d.commitrev_hmac_secret) { setCrHmacSecretSet(d.commitrev_hmac_secret.is_set); if (d.commitrev_hmac_secret.is_set) setCrHmacSecret(d.commitrev_hmac_secret.value); }
          if (d.commitrev_tenant_id?.is_set) setCrTenantId(d.commitrev_tenant_id.value);
          if (d.commitrev_product_code?.is_set) setCrProductCode(d.commitrev_product_code.value);
          if (d.commitrev_base_url?.value) setCrBaseUrl(d.commitrev_base_url.value);
        }).catch(() => {});
        fetch("/api/lumiqbrain/admin/settings").then(r => r.json()).then((d: any) => {
          if (d.lumiqbrain_api_key) {
            setLbApiKeySet(d.lumiqbrain_api_key.is_set);
            setLbApiKeyMasked(d.lumiqbrain_api_key.masked || "");
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const buildPayload = () => {
    const data: Record<string, string> = {};
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
    if (serperApiKey && !serperApiKey.includes("*")) data.serper_api_key = serperApiKey;
    if (openaiApiKey && !openaiApiKey.includes("*")) data.openai_api_key = openaiApiKey;
    if (sgApiKey && !sgApiKey.includes("*")) data.sendgrid_api_key = sgApiKey;
    if (sgFromEmail) data.sendgrid_from_email = sgFromEmail;
    if (sgFromName) data.sendgrid_from_name = sgFromName;
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
      setPlacesApiKeySet(s.google_places_api_key?.is_set || false);
      setSmtpPasswordSet(s.smtp_password?.is_set || false);
      if (s.google_places_api_key?.is_set) setPlacesApiKey(s.google_places_api_key.value);
      if (s.slack_webhook_url?.is_set) { setSlackWebhookSet(true); setSlackWebhookUrl(s.slack_webhook_url.value); }
      if (s.smtp_password?.is_set) setSmtpPassword(s.smtp_password.value);
      if (s.sendgrid_api_key) { setSgApiKeySet(s.sendgrid_api_key.is_set); if (s.sendgrid_api_key.is_set) setSgApiKey(s.sendgrid_api_key.value); }
      if (s.sendgrid_from_email?.is_set) setSgFromEmail(s.sendgrid_from_email.value);
      if (s.sendgrid_from_name?.is_set) setSgFromName(s.sendgrid_from_name.value);
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

  const handleSlackTriggersSave = async () => {
    setSlackTriggersSaving(true);
    try {
      await fetch("/api/admin/slack-triggers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggers: slackTriggers }),
      });
      setSlackMessage({ type: "success", text: "通知トリガーを保存しました" });
      setTimeout(() => setSlackMessage(null), 3000);
    } catch {
      setSlackMessage({ type: "error", text: "保存に失敗しました" });
    }
    setSlackTriggersSaving(false);
  };

  const handleSmtpSave = async () => {
    setSmtpSaving(true);
    setSmtpMessage(null);
    if (smtpHost && !smtpPasswordSet && !smtpPassword) {
      setSmtpMessage({ type: "error", text: "SMTPパスワードを入力してください。パスワードが空の場合は保存されません。" });
      setSmtpSaving(false);
      return;
    }
    try {
      const payload: Record<string, string> = {};
      if (smtpHost) payload.smtp_host = smtpHost;
      if (smtpPort) payload.smtp_port = smtpPort;
      if (smtpUser) payload.smtp_user = smtpUser;
      if (smtpPassword && !smtpPassword.includes("*")) payload.smtp_password = smtpPassword;
      if (smtpFromEmail) payload.smtp_from_email = smtpFromEmail;
      if (smtpFromName) payload.smtp_from_name = smtpFromName;
      payload.smtp_use_tls = smtpUseTls ? "true" : "false";
      await api.settings.update(payload);
      const res = await api.settings.get();
      const s = res.settings;
      setSmtpHostSet(s.smtp_host?.is_set || false);
      setSmtpUserSet(s.smtp_user?.is_set || false);
      setSmtpPasswordSet(s.smtp_password?.is_set || false);
      if (s.smtp_host?.is_set) setSmtpHost(s.smtp_host.value);
      if (s.smtp_port?.is_set) setSmtpPort(s.smtp_port.value);
      if (s.smtp_user?.is_set) setSmtpUser(s.smtp_user.value);
      if (s.smtp_password?.is_set) setSmtpPassword(s.smtp_password.value);
      const missingFields: string[] = [];
      if (!s.smtp_host?.is_set) missingFields.push("ホスト");
      if (!s.smtp_user?.is_set) missingFields.push("ユーザー名");
      if (!s.smtp_password?.is_set) missingFields.push("パスワード");
      if (missingFields.length > 0) {
        setSmtpMessage({ type: "error", text: `保存しましたが、未設定の項目があります: ${missingFields.join("・")}` });
      } else {
        setSmtpMessage({ type: "success", text: "SMTP設定をすべて保存しました（ホスト・ユーザー名・パスワード: すべて設定済み）" });
      }
    } catch (err: any) {
      setSmtpMessage({ type: "error", text: err.response?.data?.detail || "保存に失敗しました" });
    }
    setSmtpSaving(false);
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    setSmtpMessage(null);
    try {
      const params: Record<string, string> = {};
      if (smtpTestEmail) params.test_to = smtpTestEmail;
      if (smtpHost) params.smtp_host = smtpHost;
      if (smtpPort) params.smtp_port = smtpPort;
      if (smtpUser) params.smtp_user = smtpUser;
      if (smtpPassword && !smtpPassword.includes("*")) params.smtp_password = smtpPassword;
      if (smtpFromEmail) params.smtp_from_email = smtpFromEmail;
      if (smtpFromName) params.smtp_from_name = smtpFromName;
      params.smtp_use_tls = smtpUseTls ? "true" : "false";
      const data = await api.settings.smtpTest(params);
      setSmtpMessage({ type: data.success ? "success" : "error", text: data.message });
    } catch {
      setSmtpMessage({ type: "error", text: "SMTPテスト送信に失敗しました" });
    }
    setSmtpTesting(false);
  };

  const handleSendgridTest = async () => {
    setSgTesting(true);
    setSgMessage(null);
    try {
      const data = await api.settings.sendgridTest(sgTestEmail || undefined);
      setSgMessage({ type: data.success ? "success" : "error", text: data.message });
    } catch (e: any) {
      setSgMessage({ type: "error", text: e?.response?.data?.detail || "SendGridテスト送信に失敗しました" });
    }
    setSgTesting(false);
  };

  const handleCrSave = async () => {
    setCrSaving(true);
    setCrMessage(null);
    try {
      const payload: Record<string, string> = {};
      if (crApiKey && !crApiKey.includes("*")) payload.commitrev_api_key = crApiKey;
      if (crHmacSecret && !crHmacSecret.includes("*")) payload.commitrev_hmac_secret = crHmacSecret;
      if (crTenantId) payload.commitrev_tenant_id = crTenantId;
      if (crProductCode) payload.commitrev_product_code = crProductCode;
      if (crBaseUrl) payload.commitrev_base_url = crBaseUrl;
      const res = await fetch("/api/admin/commitrev/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      setCrMessage({ type: "success", text: d.message || "保存しました" });
      setTimeout(() => setCrMessage(null), 3000);
    } catch {
      setCrMessage({ type: "error", text: "保存に失敗しました" });
    }
    setCrSaving(false);
  };

  const handleCrTest = async () => {
    setCrTesting(true);
    setCrMessage(null);
    try {
      const res = await fetch("/api/admin/commitrev/test", { method: "POST" });
      const d = await res.json();
      setCrMessage({ type: d.success ? "success" : "error", text: d.message });
    } catch {
      setCrMessage({ type: "error", text: "接続テストに失敗しました" });
    }
    setCrTesting(false);
  };

  const handleLbGenerateKey = async () => {
    if (!confirm("既存のAPIキーは無効になります。新しいキーを生成しますか？")) return;
    setLbGenerating(true);
    setLbMessage(null);
    setLbNewKey("");
    try {
      const res = await fetch("/api/lumiqbrain/admin/generate-key", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setLbNewKey(d.api_key || "");
        setLbApiKeySet(true);
        const masked = d.api_key ? "*".repeat(24) + d.api_key.slice(-8) : "";
        setLbApiKeyMasked(masked);
        setLbMessage({ type: "success", text: d.message || "APIキーを生成しました" });
      } else {
        setLbMessage({ type: "error", text: d.detail || "生成に失敗しました" });
      }
    } catch {
      setLbMessage({ type: "error", text: "生成に失敗しました" });
    }
    setLbGenerating(false);
  };

  const handleLbRevokeKey = async () => {
    if (!confirm("APIキーを無効化します。lumiqbrainからのアクセスができなくなります。続行しますか？")) return;
    setLbRevoking(true);
    setLbMessage(null);
    try {
      const res = await fetch("/api/lumiqbrain/admin/revoke-key", { method: "DELETE" });
      const d = await res.json();
      if (res.ok) {
        setLbApiKeySet(false);
        setLbApiKeyMasked("");
        setLbNewKey("");
        setLbMessage({ type: "success", text: d.message || "APIキーを無効化しました" });
      } else {
        setLbMessage({ type: "error", text: d.detail || "無効化に失敗しました" });
      }
    } catch {
      setLbMessage({ type: "error", text: "無効化に失敗しました" });
    }
    setLbRevoking(false);
  };

  const inputClass = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-slate-800">設定</h2>
          <HelpTooltip text="自動収集スケジュール・通知設定・APIキーなど、LeadHiveの動作をカスタマイズできます。" />
        </div>
        <HelpPanel
          title="設定のヘルプ"
          manualLinks={[
            { label: "初期セットアップ", description: "Serper APIキーとメール設定の手順", to: "/manual#setup" },
            { label: "通知・自動収集", description: "スケジュール収集とSlack通知の設定", to: "/manual#notifications" },
            { label: "管理者設定", description: "組織・プラン・チーム管理の方法", to: "/manual#admin_settings" },
          ]}
          tips={[
            "Serper APIキーはserper.devで取得できます（月2,500件まで無料）",
            "SendGridを設定するとメール開封率・クリック率を追跡できます",
            "SMTP設定はGmail / さくら / Xserver等に対応しています",
            "自動収集を有効にすると毎日指定時刻にキーワード収集が実行されます",
          ]}
        />
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <ShieldCheck size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            設定の閲覧のみ可能です。変更するには管理者権限が必要です。
          </p>
        </div>
      )}

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

      <PlanCurrentSection isAdmin={isOrgAdmin} />

      {message && <MessageBox msg={message} />}

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
        <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<Mail size={20} className="text-slate-600" />} title="SMTPメール設定" />
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            <strong>本番環境ではSMTPポート（465/587）がブロックされます。</strong>
            メール送信には下の <strong>SendGrid設定</strong> を推奨します。SMTPはローカル開発環境でのみ動作確認できます。
          </p>
        </div>
        <p className="text-sm text-slate-500">
          メンバー招待やパスワードリセットにSMTPメール送信を使用します。設定しない場合は招待URLのコピーで対応できます。
          <a href="https://support.google.com/mail/answer/7126229" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">Gmailの設定方法</a>
          <span className="text-slate-300 mx-1">|</span>
          <a href="https://www.sakura.ne.jp/manual/rs/ope/mail/smtp.html" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">さくらサーバーの設定方法</a>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>SMTPホスト {smtpHostSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>ポート</label>
            <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>SMTPユーザー名 {smtpUserSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="your@email.com" className={inputClass} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>SMTPパスワード {smtpPasswordSet ? <span className="text-emerald-600 text-xs ml-2">設定済み</span> : <span className="text-red-500 text-xs ml-2">未設定（必須）</span>}</label>
            <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder={smtpPasswordSet ? "変更する場合のみ入力" : "パスワードを入力してください（必須）"} className={inputClass} />
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
          <SaveButton saving={smtpSaving} onClick={handleSmtpSave} disabled={!isAdmin} />
          <button onClick={handleSmtpTest} disabled={!isAdmin || smtpTesting || !smtpHost} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {smtpTesting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            テスト送信
          </button>
        </div>
        {smtpMessage && <MessageBox msg={smtpMessage} />}
        {smtpHost && !smtpPasswordSet && !smtpPassword && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <span><strong>パスワードが未入力です。</strong>「SMTPパスワード」欄にパスワードを入力してから保存してください。パスワードなしでは保存されません。</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader
          icon={<Zap size={20} className="text-amber-500" />}
          title="SendGrid API 設定"
          badge={
            <span className="flex items-center gap-1">
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">本番環境推奨</span>
              {sgApiKeySet && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">設定済み</span>}
            </span>
          }
        />
        <p className="text-sm text-slate-500">
          本番環境ではSMTPポートがブロックされるため、<strong className="text-slate-700">SendGridが唯一有効なメール配信手段</strong>です。設定された場合、SMTPより優先されます。
          <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">APIキーの取得（無料プランあり）</a>
        </p>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelClass}>SendGrid APIキー {sgApiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
            <input type="password" value={sgApiKey} onChange={e => setSgApiKey(e.target.value)} placeholder={sgApiKeySet ? "変更する場合のみ入力" : "SG.xxxxxxxxxxxxxxxx"} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>送信元メールアドレス</label>
              <input type="email" value={sgFromEmail} onChange={e => setSgFromEmail(e.target.value)} placeholder="noreply@yourcompany.com" className={inputClass} />
              <p className="text-xs text-slate-400 mt-1">SendGrid で Sender 認証済みのアドレス</p>
            </div>
            <div>
              <label className={labelClass}>送信者名</label>
              <input type="text" value={sgFromName} onChange={e => setSgFromName(e.target.value)} placeholder="LeadHive" className={inputClass} />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <label className={labelClass}>テスト送信先（省略時は自分のアドレス）</label>
          <input type="email" value={sgTestEmail} onChange={e => setSgTestEmail(e.target.value)} placeholder="test@example.com" className={inputClass} />
        </div>
        <div className="flex gap-3">
          <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
          <button onClick={handleSendgridTest} disabled={!isAdmin || sgTesting || !sgApiKeySet} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600 transition-colors disabled:opacity-50">
            {sgTesting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            テスト送信
          </button>
        </div>
        {sgMessage && <MessageBox msg={sgMessage} />}
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
          <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
          <button onClick={handleSlackTest} disabled={!isAdmin || slackTesting || (!slackWebhookSet && !slackWebhookUrl)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {slackTesting ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
            テスト送信
          </button>
        </div>

        {isSystemAdmin && (
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">通知トリガー設定（システム管理者）</p>
            <div className="space-y-2">
              {[
                { key: "rank_a_added", label: "Aランク企業が追加されたとき" },
                { key: "email_opened", label: "送信メールが開封されたとき" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!slackTriggers[key]}
                    onChange={e => setSlackTriggers(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">{label}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleSlackTriggersSave}
              disabled={slackTriggersSaving}
              className="flex items-center gap-2 bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {slackTriggersSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              トリガーを保存
            </button>
          </div>
        )}

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
        <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
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
        <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
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
        <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <SectionHeader icon={<Search size={20} className="text-blue-600" />} title="検索API設定（Serper）" />
        <p className="text-sm text-slate-500">
          企業収集機能に使用する
          <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline mx-1">serper.dev</a>
          のAPIキーを設定してください。無料プランで月2,500件の検索が利用できます。
        </p>
        <div>
          <label className={labelClass}>Serper APIキー {serperApiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}</label>
          <input
            type="password"
            value={serperApiKey}
            onChange={e => setSerperApiKey(e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className={inputClass}
          />
          <p className="text-xs text-slate-400 mt-1">
            <a href="https://serper.dev/api-key" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">serper.dev/api-key</a>
            {" "}から発行できます。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              setSerperTesting(true);
              setSerperMessage(null);
              try {
                const res = await api.settings.test();
                setSerperMessage({ type: res.success ? "success" : "error", text: res.message });
              } catch {
                setSerperMessage({ type: "error", text: "接続テストに失敗しました" });
              } finally {
                setSerperTesting(false);
              }
            }}
            disabled={!isAdmin || serperTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {serperTesting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            接続テスト
          </button>
          {serperMessage && (
            <span className={`text-sm flex items-center gap-1 ${serperMessage.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
              {serperMessage.type === "success" ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {serperMessage.text}
            </span>
          )}
        </div>
        <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
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
        <SaveButton saving={saving} onClick={handleSave} disabled={!isAdmin} />
      </div>

      {isSystemAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-indigo-200 p-6 space-y-5">
          <SectionHeader
            icon={<ExternalLink size={20} className="text-indigo-600" />}
            title="CommitRev アフィリエイト連携"
            badge={<span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">システム管理者専用</span>}
          />
          <p className="text-sm text-slate-500">
            CommitRevと連携すると、ユーザー登録・プラン契約・アップグレード・月次更新のイベントが自動的に送信されます。
            パートナーへの紹介報酬が正確に計算されます。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>
                スコープ付きAPIキー（推奨）
                {crApiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}
              </label>
              <input
                type="password"
                value={crApiKey}
                onChange={e => setCrApiKey(e.target.value)}
                placeholder="cr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."
                className={inputClass}
              />
              <p className="text-xs text-slate-400 mt-1">CommitRevポータル → APIキー管理 → スコープ付きAPIキーで発行（scopeは <code>events</code> 以上）</p>
            </div>

            <div>
              <label className={labelClass}>
                HMAC シークレット（代替）
                {crHmacSecretSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}
              </label>
              <input
                type="password"
                value={crHmacSecret}
                onChange={e => setCrHmacSecret(e.target.value)}
                placeholder="HMACシークレットキー"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>テナントID（HMAC認証時のみ必要）</label>
              <input
                type="text"
                value={crTenantId}
                onChange={e => setCrTenantId(e.target.value)}
                placeholder="例: 42"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>プロダクトコード <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={crProductCode}
                onChange={e => setCrProductCode(e.target.value)}
                placeholder="例: leadhive"
                className={inputClass}
              />
              <p className="text-xs text-slate-400 mt-1">CommitRevで登録したプロダクトのコード</p>
            </div>

            <div>
              <label className={labelClass}>ベースURL</label>
              <input
                type="text"
                value={crBaseUrl}
                onChange={e => setCrBaseUrl(e.target.value)}
                placeholder="https://app.commitrev.com"
                className={inputClass}
              />
            </div>
          </div>

          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700 space-y-1">
            <p className="font-medium">自動送信されるイベント</p>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <span>✓ <code>lead_created</code> — ユーザー新規登録時</span>
              <span>✓ <code>contract_signed</code> — 初回有料プラン契約時</span>
              <span>✓ <code>plan_conversion</code> — 上位プランへのアップグレード時</span>
              <span>✓ <code>monthly_renewal</code> — Stripe月次更新時</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCrSave}
              disabled={crSaving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {crSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              保存する
            </button>
            <button
              onClick={handleCrTest}
              disabled={crTesting || (!crApiKeySet && !crHmacSecretSet)}
              className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {crTesting ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
              接続テスト
            </button>
          </div>
          {crMessage && <MessageBox msg={crMessage} />}
        </div>
      )}

      {isSystemAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-violet-200 p-6 space-y-5">
          <SectionHeader
            icon={<DatabaseZap size={20} className="text-violet-600" />}
            title="lumiqbrain 外部API連携"
            badge={<span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">システム管理者専用</span>}
          />
          <p className="text-sm text-slate-500">
            lumiqbrain プラットフォームが LeadHive のデータにアクセスするための APIキーを管理します。
            APIキーは <code className="bg-slate-100 px-1 rounded text-xs">X-API-Key</code> ヘッダーで送信します。
          </p>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <ShieldCheck size={18} className={lbApiKeySet ? "text-emerald-600" : "text-slate-400"} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">
                {lbApiKeySet ? "APIキー設定済み" : "APIキー未設定"}
                {lbApiKeySet && lbApiKeyMasked && (
                  <span className="ml-2 font-mono text-xs text-slate-500">{lbApiKeyMasked}</span>
                )}
              </p>
              <p className="text-xs text-slate-400">エンドポイント: /api/lumiqbrain/company · /companies · /stats</p>
            </div>
          </div>

          {lbNewKey && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-medium text-emerald-700 mb-1">新しいAPIキー（この画面でのみ表示されます）</p>
              <code className="block text-sm font-mono text-emerald-900 break-all select-all">{lbNewKey}</code>
              <p className="text-xs text-emerald-600 mt-1">lumiqbrain の設定画面に貼り付けてください。</p>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleLbGenerateKey}
              disabled={lbGenerating}
              className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {lbGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {lbApiKeySet ? "APIキーを再生成" : "APIキーを生成"}
            </button>
            {lbApiKeySet && (
              <button
                onClick={handleLbRevokeKey}
                disabled={lbRevoking}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {lbRevoking ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                APIキーを無効化
              </button>
            )}
          </div>
          {lbMessage && <MessageBox msg={lbMessage} />}
        </div>
      )}

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
