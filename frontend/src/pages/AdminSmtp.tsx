import { useEffect, useState } from "react";
import { Mail, Save, Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff, Zap } from "lucide-react";
import { api } from "../api";

type SmtpSettings = {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_password_set?: boolean;
  smtp_from_email: string;
  smtp_from_name: string;
};

type SendgridSettings = {
  sendgrid_api_key: string;
  sendgrid_api_key_set?: boolean;
  sendgrid_from_email: string;
  sendgrid_from_name: string;
};

type ResendSettings = {
  resend_api_key: string;
  resend_api_key_set?: boolean;
  resend_from_email: string;
  resend_from_name: string;
};

const PRESETS = [
  { label: "Gmail", host: "smtp.gmail.com", port: "587" },
  { label: "SendGrid (SMTP)", host: "smtp.sendgrid.net", port: "587" },
  { label: "Amazon SES (us-east-1)", host: "email-smtp.us-east-1.amazonaws.com", port: "587" },
  { label: "Mailgun", host: "smtp.mailgun.org", port: "587" },
];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 block mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function AdminSmtp() {
  const [tab, setTab] = useState<"smtp" | "sendgrid" | "resend">("smtp");

  const [form, setForm] = useState<SmtpSettings>({
    smtp_host: "", smtp_port: "587", smtp_user: "", smtp_password: "", smtp_from_email: "", smtp_from_name: "LeadHive",
  });
  const [passwordSet, setPasswordSet] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sg, setSg] = useState<SendgridSettings>({
    sendgrid_api_key: "", sendgrid_from_email: "", sendgrid_from_name: "LeadHive",
  });
  const [sgApiKeySet, setSgApiKeySet] = useState(false);
  const [showSgKey, setShowSgKey] = useState(false);
  const [sgLoading, setSgLoading] = useState(true);
  const [sgSaving, setSgSaving] = useState(false);
  const [sgTesting, setSgTesting] = useState(false);
  const [sgError, setSgError] = useState("");
  const [sgSuccess, setSgSuccess] = useState("");

  const [rs, setRs] = useState<ResendSettings>({
    resend_api_key: "", resend_from_email: "", resend_from_name: "LeadHive",
  });
  const [rsApiKeySet, setRsApiKeySet] = useState(false);
  const [showRsKey, setShowRsKey] = useState(false);
  const [rsLoading, setRsLoading] = useState(true);
  const [rsSaving, setRsSaving] = useState(false);
  const [rsTesting, setRsTesting] = useState(false);
  const [rsError, setRsError] = useState("");
  const [rsSuccess, setRsSuccess] = useState("");

  useEffect(() => {
    api.adminSmtp.get().then(r => {
      setForm(f => ({ ...f, ...r }));
      setPasswordSet(!!r.smtp_password_set);
      setLoading(false);
    }).catch(() => setLoading(false));

    api.adminSmtp.getSendgrid().then(r => {
      setSg({
        sendgrid_api_key: r.sendgrid_api_key || "",
        sendgrid_from_email: r.sendgrid_from_email || "",
        sendgrid_from_name: r.sendgrid_from_name || "LeadHive",
      });
      setSgApiKeySet(!!r.sendgrid_api_key_set);
      setSgLoading(false);
    }).catch(() => setSgLoading(false));

    api.adminSmtp.getResend().then(r => {
      setRs({
        resend_api_key: r.resend_api_key || "",
        resend_from_email: r.resend_from_email || "",
        resend_from_name: r.resend_from_name || "LeadHive",
      });
      setRsApiKeySet(!!r.resend_api_key_set);
      setRsLoading(false);
    }).catch(() => setRsLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await api.adminSmtp.save(form as any);
      setSuccess("SMTP設定を保存しました");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError(""); setSuccess("");
    try {
      const r = await api.adminSmtp.test();
      setSuccess(r.message);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "テスト送信に失敗しました");
    } finally {
      setTesting(false);
    }
  };

  const sgSave = async () => {
    setSgSaving(true);
    setSgError(""); setSgSuccess("");
    try {
      const payload: Record<string, string> = {
        sendgrid_from_email: sg.sendgrid_from_email,
        sendgrid_from_name: sg.sendgrid_from_name,
      };
      if (sg.sendgrid_api_key && !sg.sendgrid_api_key.includes("*")) {
        payload.sendgrid_api_key = sg.sendgrid_api_key;
      }
      await api.adminSmtp.saveSendgrid(payload);
      setSgSuccess("SendGrid設定を保存しました");
      setSgApiKeySet(true);
      setTimeout(() => setSgSuccess(""), 3000);
    } catch (e: any) {
      setSgError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSgSaving(false);
    }
  };

  const sgTest = async () => {
    setSgTesting(true);
    setSgError(""); setSgSuccess("");
    try {
      const r = await api.adminSmtp.testSendgrid();
      setSgSuccess(r.message);
    } catch (e: any) {
      setSgError(e?.response?.data?.detail || "テスト送信に失敗しました");
    } finally {
      setSgTesting(false);
    }
  };

  const rsSave = async () => {
    setRsSaving(true);
    setRsError(""); setRsSuccess("");
    try {
      const payload: Record<string, string> = {
        resend_from_email: rs.resend_from_email,
        resend_from_name: rs.resend_from_name,
      };
      if (rs.resend_api_key && !rs.resend_api_key.includes("*")) {
        payload.resend_api_key = rs.resend_api_key;
      }
      await api.adminSmtp.saveResend(payload);
      setRsSuccess("Resend設定を保存しました");
      setRsApiKeySet(true);
      setTimeout(() => setRsSuccess(""), 3000);
    } catch (e: any) {
      setRsError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setRsSaving(false);
    }
  };

  const rsTest = async () => {
    setRsTesting(true);
    setRsError(""); setRsSuccess("");
    try {
      const r = await api.adminSmtp.testResend();
      setRsSuccess(r.message);
    } catch (e: any) {
      setRsError(e?.response?.data?.detail || "テスト送信に失敗しました");
    } finally {
      setRsTesting(false);
    }
  };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setForm(f => ({ ...f, smtp_host: p.host, smtp_port: p.port }));
  };

  const inp = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (loading && sgLoading && rsLoading) return <div className="flex justify-center items-center h-64"><Loader2 size={28} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Mail size={24} className="text-blue-600" />
          メール送信設定
        </h1>
        <p className="text-sm text-slate-500 mt-1">システム全体のメール送信設定。テナント側の設定が優先されます。</p>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
        <button
          onClick={() => setTab("smtp")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "smtp" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
        >
          <Mail size={15} />
          SMTP
        </button>
        <button
          onClick={() => setTab("sendgrid")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "sendgrid" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
        >
          <Zap size={15} />
          SendGrid
          {sgApiKeySet && <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">設定済み</span>}
        </button>
        <button
          onClick={() => setTab("resend")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "resend" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
        >
          <Zap size={15} />
          Resend
          {rsApiKeySet && <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">設定済み</span>}
        </button>
      </div>

      {tab === "smtp" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 flex-shrink-0" />{success}</div>}

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">プリセット</p>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="SMTPホスト" required>
                <input className={inp} value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
              </Field>
            </div>
            <Field label="ポート" required>
              <input className={inp} value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))} placeholder="587" />
            </Field>
            <Field label="ユーザー名（メールアドレス）" required>
              <input className={inp} value={form.smtp_user} onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))} placeholder="user@gmail.com" />
            </Field>
            <div className="col-span-2">
              <Field label={`パスワード${passwordSet ? "（設定済み）" : ""}`} required>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inp} pr-10`}
                    value={form.smtp_password}
                    onChange={e => setForm(f => ({ ...f, smtp_password: e.target.value }))}
                    placeholder={passwordSet ? "変更する場合のみ入力" : "パスワードを入力"}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
            </div>
            <Field label="送信元メールアドレス">
              <input className={inp} value={form.smtp_from_email} onChange={e => setForm(f => ({ ...f, smtp_from_email: e.target.value }))} placeholder="noreply@leadhive.work" />
            </Field>
            <Field label="送信者名">
              <input className={inp} value={form.smtp_from_name} onChange={e => setForm(f => ({ ...f, smtp_from_name: e.target.value }))} placeholder="LeadHive" />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-4 flex gap-3">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存
            </button>
            <button onClick={test} disabled={testing}
              className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-60 border border-slate-300">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              テスト送信
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
            <p>・Gmail の場合は「アプリパスワード」を使用してください（2段階認証が必要）</p>
            <p>・ポート 465 は SSL、587 は STARTTLS として処理されます</p>
            <p>・テスト送信は管理者自身のメールアドレスに送信されます</p>
          </div>
        </div>
      )}

      {tab === "sendgrid" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          {sgError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{sgError}</div>}
          {sgSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 flex-shrink-0" />{sgSuccess}</div>}

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            <p className="font-semibold mb-1">SendGrid API 方式（推奨）</p>
            <p className="text-xs">SMTPより信頼性が高く、大量送信・配信統計・バウンス処理に対応します。SMTPと並行設定可能で、テナントが SendGrid を設定した場合はテナント側が優先されます。</p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
            <Field label={`SendGrid APIキー${sgApiKeySet ? "（設定済み）" : ""}`} required>
              <div className="relative">
                <input
                  type={showSgKey ? "text" : "password"}
                  className={`${inp} pr-10`}
                  value={sg.sendgrid_api_key}
                  onChange={e => setSg(s => ({ ...s, sendgrid_api_key: e.target.value }))}
                  placeholder={sgApiKeySet ? "変更する場合のみ入力" : "SG.xxxxxxxxxxxxxxxx"}
                />
                <button type="button" onClick={() => setShowSgKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showSgKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">SendGrid ダッシュボード</a> → Settings → API Keys → Create API Key（Mail Send 権限）
              </p>
            </Field>
            <Field label="送信元メールアドレス" required>
              <input className={inp} value={sg.sendgrid_from_email} onChange={e => setSg(s => ({ ...s, sendgrid_from_email: e.target.value }))} placeholder="noreply@leadhive.work" />
              <p className="text-xs text-slate-400 mt-1">SendGrid で Sender 認証済みのメールアドレスを使用してください</p>
            </Field>
            <Field label="送信者名">
              <input className={inp} value={sg.sendgrid_from_name} onChange={e => setSg(s => ({ ...s, sendgrid_from_name: e.target.value }))} placeholder="LeadHive" />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-4 flex gap-3">
            <button onClick={sgSave} disabled={sgSaving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {sgSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存
            </button>
            <button onClick={sgTest} disabled={sgTesting || !sgApiKeySet}
              className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-60 border border-slate-300">
              {sgTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              テスト送信
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
            <p>・APIキーは暗号化してデータベースに保存されます</p>
            <p>・SendGrid の Sender Authentication で送信元ドメインを認証してください</p>
            <p>・テスト送信はシステム管理者のメールアドレスに送信されます</p>
          </div>
        </div>
      )}

      {tab === "resend" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          {rsError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{rsError}</div>}
          {rsSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 flex-shrink-0" />{rsSuccess}</div>}

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            <p className="font-semibold mb-1">Resend API 方式（推奨）</p>
            <p className="text-xs">HTTPS経由で送信するため本番環境のポート制限に影響されません。月3,000通・日100通まで無料で利用できます。</p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
            <Field label={`Resend APIキー${rsApiKeySet ? "（設定済み）" : ""}`} required>
              <div className="relative">
                <input
                  type={showRsKey ? "text" : "password"}
                  className={`${inp} pr-10`}
                  value={rs.resend_api_key}
                  onChange={e => setRs(s => ({ ...s, resend_api_key: e.target.value }))}
                  placeholder={rsApiKeySet ? "変更する場合のみ入力" : "re_xxxxxxxxxxxxxxxx"}
                />
                <button type="button" onClick={() => setShowRsKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showRsKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Resend ダッシュボード</a> → API Keys → Create API Key（Sending access）
              </p>
            </Field>
            <Field label="送信元メールアドレス" required>
              <input className={inp} value={rs.resend_from_email} onChange={e => setRs(s => ({ ...s, resend_from_email: e.target.value }))} placeholder="noreply@leadhive.work" />
              <p className="text-xs text-slate-400 mt-1">Resend でドメイン認証済みのメールアドレスを使用してください</p>
            </Field>
            <Field label="送信者名">
              <input className={inp} value={rs.resend_from_name} onChange={e => setRs(s => ({ ...s, resend_from_name: e.target.value }))} placeholder="LeadHive" />
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-4 flex gap-3">
            <button onClick={rsSave} disabled={rsSaving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {rsSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存
            </button>
            <button onClick={rsTest} disabled={rsTesting || !rsApiKeySet}
              className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-60 border border-slate-300">
              {rsTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              テスト送信
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
            <p>・APIキーは暗号化してデータベースに保存されます</p>
            <p>・Resend のドメイン認証（DNS設定）を完了させてから送信元アドレスを設定してください</p>
            <p>・テスト送信はシステム管理者のメールアドレスに送信されます</p>
          </div>
        </div>
      )}
    </div>
  );
}
