import { useEffect, useState } from "react";
import { Scale, Save, Loader2, CheckCircle, AlertCircle, ExternalLink, RotateCcw } from "lucide-react";
import { api } from "../api";

const FIELDS: { key: string; label: string; hint?: string; multiline?: boolean; required?: boolean }[] = [
  { key: "legal_seller_name", label: "販売業者名", hint: "会社名・屋号", required: true },
  { key: "legal_representative", label: "代表責任者", hint: "代表者氏名", required: true },
  { key: "legal_address", label: "所在地", hint: "住所（郵便番号を含む）", required: true },
  { key: "legal_phone", label: "電話番号", hint: "Stripe審査には実際の電話番号が必要です", required: true },
  { key: "legal_email", label: "メールアドレス", hint: "問い合わせ用メールアドレス", required: true },
  { key: "legal_url", label: "URL", hint: "サービスのURL（https://...）" },
  { key: "legal_service_name", label: "サービス名", required: true },
  { key: "legal_price_note", label: "販売価格", hint: "プランごとの料金、税込み表示を推奨", multiline: true, required: true },
  { key: "legal_payment_method", label: "支払方法", hint: "クレジットカード等の決済手段", multiline: true, required: true },
  { key: "legal_payment_timing", label: "支払時期", hint: "請求タイミング・サイクルの説明", multiline: true, required: true },
  { key: "legal_delivery_timing", label: "サービス提供時期", hint: "決済後いつから利用できるか", multiline: true, required: true },
  { key: "legal_cancellation", label: "返品・キャンセルについて", hint: "解約方法・返金ポリシー", multiline: true, required: true },
  { key: "legal_environment", label: "動作環境", hint: "対応ブラウザ・OS等", multiline: true },
  { key: "legal_other", label: "その他特記事項", hint: "任意（空欄の場合は非表示）", multiline: true },
];

const DEFAULTS: Record<string, string> = {
  legal_seller_name: "COOLWORKS株式会社",
  legal_representative: "田中 智一郎",
  legal_address: "〒651-0084 兵庫県神戸市中央区磯辺通１丁目１番１８号 カサベラ国際プラザビル７０７号室",
  legal_phone: "",
  legal_email: "info@leadhive.work",
  legal_url: "https://leadhive.work",
  legal_service_name: "LeadHive",
  legal_price_note: "スターター: ¥4,980/月、プロ: ¥14,800/月（税込）。詳細はプランページをご参照ください。",
  legal_payment_method: "クレジットカード決済（Visa / Mastercard / American Express / JCB）",
  legal_payment_timing: "月額サブスクリプション形式。お申し込み月の決済完了後、翌月以降は毎月自動更新されます。",
  legal_delivery_timing: "決済完了後、即時サービスをご利用いただけます。",
  legal_cancellation: "月額プランはマイページよりいつでも解約可能です。解約後は次回更新日以降の請求は発生しません。サービスの性質上、既払い料金の返金は原則として承っておりません。ただし、サービスに重大な欠陥がある場合は個別にご相談ください。",
  legal_environment: "最新版のGoogle Chrome / Mozilla Firefox / Microsoft Edge / Safari（PCブラウザ推奨）、安定したインターネット接続環境",
  legal_other: "",
};

export default function AdminLegal() {
  const [form, setForm] = useState<Record<string, string>>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.adminLegal.get()
      .then(d => setForm(prev => ({ ...prev, ...d })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (key: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  const reset = (key: string) =>
    setForm(f => ({ ...f, [key]: DEFAULTS[key] ?? "" }));

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.adminLegal.save(form);
      setSuccess("保存しました");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  const missingRequired = FIELDS.filter(f => f.required && !form[f.key]?.trim());

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale size={22} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">特定商取引法に基づく表記</h1>
            <p className="text-sm text-slate-500 mt-0.5">Stripe審査・法律要件に対応した表示ページの内容を管理します</p>
          </div>
        </div>
        <a
          href="/legal/tokutei"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <ExternalLink size={14} />
          公開ページを確認
        </a>
      </div>

      {missingRequired.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">⚠ 以下の必須項目が未入力です（Stripe審査に必要）：</p>
          <ul className="list-disc list-inside space-y-0.5">
            {missingRequired.map(f => (
              <li key={f.key}>{f.label}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {FIELDS.map(({ key, label, hint, multiline, required }) => (
          <div key={key} className="px-6 py-5">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
              {label}
              {required && <span className="text-red-500 text-xs">必須</span>}
            </label>
            {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
            <div className="flex gap-2">
              {multiline ? (
                <textarea
                  value={form[key] ?? ""}
                  onChange={update(key)}
                  rows={3}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              ) : (
                <input
                  type="text"
                  value={form[key] ?? ""}
                  onChange={update(key)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {DEFAULTS[key] !== undefined && DEFAULTS[key] !== "" && (
                <button
                  onClick={() => reset(key)}
                  title="デフォルトに戻す"
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-slate-400">
          変更内容は即時に公開ページ（/legal/tokutei）に反映されます
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存する
        </button>
      </div>
    </div>
  );
}
