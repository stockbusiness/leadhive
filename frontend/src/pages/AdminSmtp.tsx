import { useEffect, useState } from "react";
import { Mail, Save, Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff } from "lucide-react";
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

const PRESETS = [
  { label: "Gmail", host: "smtp.gmail.com", port: "587" },
  { label: "SendGrid", host: "smtp.sendgrid.net", port: "587" },
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

  useEffect(() => {
    api.adminSmtp.get().then(r => {
      setForm(f => ({ ...f, ...r }));
      setPasswordSet(!!r.smtp_password_set);
      setLoading(false);
    }).catch(() => setLoading(false));
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

  const applyPreset = (p: typeof PRESETS[number]) => {
    setForm(f => ({ ...f, smtp_host: p.host, smtp_port: p.port }));
  };

  const inp = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 size={28} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Mail size={24} className="text-blue-600" />
          SMTP / メール設定
        </h1>
        <p className="text-sm text-slate-500 mt-1">フォローアップ通知やパスワードリセットメールに使用するSMTP設定</p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 flex-shrink-0" />{success}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
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
    </div>
  );
}
