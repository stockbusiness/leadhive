import { useEffect, useState } from "react";
import { Mail, Save, Loader2, CheckCircle, AlertCircle, RotateCcw, Info } from "lucide-react";
import { api } from "../api";

const DEFAULTS: Record<string, string> = {
  contact_notify_to: "info@leadhive.work",
  contact_notify_subject_prefix: "【LeadHive】",
  contact_autoreply_enabled: "true",
  contact_autoreply_subject: "【LeadHive】お問い合わせを受け付けました",
  contact_autoreply_intro:
    "この度はLeadHiveにお問い合わせいただきありがとうございます。\n以下の内容でお問い合わせを受け付けました。\n担当者より{response_days}以内にご連絡いたします。",
  contact_response_days: "2〜3営業日",
};

type Settings = typeof DEFAULTS;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminContact() {
  const [form, setForm] = useState<Settings>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.adminContact.get().then((data) => {
      setForm((f) => ({ ...f, ...data }));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const update = (key: keyof Settings) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.adminContact.save(form);
      setSuccess("設定を保存しました");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const reset = (key: keyof Settings) =>
    setForm((f) => ({ ...f, [key]: DEFAULTS[key] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-2.5 rounded-xl">
          <Mail size={22} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">問い合わせフォーム設定</h1>
          <p className="text-sm text-slate-500">通知メール・自動返信メールの宛先と内容を管理します</p>
        </div>
      </div>

      {/* 通知メール設定 */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-700">通知メール設定</h2>
          <p className="text-xs text-slate-500 mt-0.5">フォーム送信時に運営側が受け取るメールの設定</p>
        </div>
        <div className="p-5 space-y-4">
          <Field
            label="通知先メールアドレス"
            hint="複数の宛先はカンマで区切ってください。例: info@example.com, sales@example.com"
          >
            <input
              type="text"
              value={form.contact_notify_to}
              onChange={update("contact_notify_to")}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="info@leadhive.work, sales@leadhive.work"
            />
          </Field>

          <Field
            label="件名プレフィックス"
            hint={`通知メール件名の先頭に付くテキスト。例: ${form.contact_notify_subject_prefix}資料請求：株式会社〇〇 田中様`}
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={form.contact_notify_subject_prefix}
                onChange={update("contact_notify_subject_prefix")}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="【LeadHive】"
              />
              <button
                type="button"
                onClick={() => reset("contact_notify_subject_prefix")}
                className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                title="デフォルトに戻す"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </Field>
        </div>
      </section>

      {/* 自動返信設定 */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-700">自動返信メール設定</h2>
          <p className="text-xs text-slate-500 mt-0.5">フォーム送信者に自動送信される確認メールの設定</p>
        </div>
        <div className="p-5 space-y-4">
          <Field label="自動返信の有効/無効">
            <select
              value={form.contact_autoreply_enabled}
              onChange={update("contact_autoreply_enabled")}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="true">有効（送信する）</option>
              <option value="false">無効（送信しない）</option>
            </select>
          </Field>

          <Field label="自動返信メール件名">
            <div className="flex gap-2">
              <input
                type="text"
                value={form.contact_autoreply_subject}
                onChange={update("contact_autoreply_subject")}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="【LeadHive】お問い合わせを受け付けました"
              />
              <button
                type="button"
                onClick={() => reset("contact_autoreply_subject")}
                className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                title="デフォルトに戻す"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </Field>

          <Field
            label="返信目安日数"
            hint="自動返信本文の {response_days} に差し込まれます"
          >
            <input
              type="text"
              value={form.contact_response_days}
              onChange={update("contact_response_days")}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="2〜3営業日"
            />
          </Field>

          <Field
            label="自動返信の本文（冒頭）"
            hint="{response_days} は上の返信目安日数に自動で置き換わります"
          >
            <div className="space-y-2">
              <textarea
                value={form.contact_autoreply_intro}
                onChange={update("contact_autoreply_intro")}
                rows={5}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={DEFAULTS.contact_autoreply_intro}
              />
              <button
                type="button"
                onClick={() => reset("contact_autoreply_intro")}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <RotateCcw size={12} />
                デフォルトに戻す
              </button>
            </div>
          </Field>
        </div>
      </section>

      {/* プレビュー */}
      <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <div className="flex items-start gap-2 mb-3">
          <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs font-semibold text-blue-700">自動返信メールのプレビュー（冒頭テキスト）</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 px-4 py-3 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
          {(form.contact_autoreply_intro || DEFAULTS.contact_autoreply_intro).replace(
            "{response_days}",
            form.contact_response_days || "2〜3営業日"
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <CheckCircle size={15} />
          {success}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        設定を保存
      </button>
    </div>
  );
}
