import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronLeft, Send, CheckCircle2, AlertCircle, Loader2, FileText, HelpCircle, MessageSquare } from "lucide-react";
import axios from "axios";
import PageMeta from "../components/PageMeta";

type InquiryType = "document" | "question" | "other";

const INQUIRY_TYPES: { key: InquiryType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    key: "document",
    label: "資料請求",
    description: "サービス資料・料金表をお送りします",
    icon: <FileText size={20} className="text-blue-500" />,
  },
  {
    key: "question",
    label: "サービスへのご質問",
    description: "機能・導入方法などのご質問",
    icon: <HelpCircle size={20} className="text-violet-500" />,
  },
  {
    key: "other",
    label: "その他",
    description: "上記以外のお問い合わせ",
    icon: <MessageSquare size={20} className="text-slate-500" />,
  },
];

const EMPTY_FORM = {
  inquiry_type: "" as InquiryType | "",
  company_name: "",
  name: "",
  email: "",
  phone: "",
  message: "",
};

export default function Contact() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const isValid =
    form.inquiry_type &&
    form.company_name.trim() &&
    form.name.trim() &&
    form.email.trim() &&
    form.email.includes("@") &&
    form.message.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError("");
    try {
      await axios.post("/api/contact", form);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageMeta
        title="お問い合わせ"
        description="LeadHiveへのお問い合わせ・資料請求・サービスのご質問はこちらから。2〜3営業日以内にご返信いたします。"
        path="/contact"
        schemaType="ContactPage"
        breadcrumbs={[{ name: "お問い合わせ", url: "/contact" }]}
      />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-base">LeadHive</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft size={15} />
            トップに戻る
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {submitted ? (
          <SuccessView />
        ) : (
          <>
            <div className="mb-8">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Contact</p>
              <h1 className="text-3xl font-extrabold text-slate-900">お問い合わせ</h1>
              <p className="text-sm text-slate-500 mt-2">
                資料請求・サービスへのご質問など、お気軽にお問い合わせください。<br />
                担当者より <strong className="text-slate-700">2〜3営業日以内</strong> にご返信いたします。
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* お問い合わせ種別 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  お問い合わせ種別 <span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {INQUIRY_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, inquiry_type: t.key }))}
                      className={`flex flex-col items-center text-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        form.inquiry_type === t.key
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      {t.icon}
                      <span className={`text-sm font-semibold ${form.inquiry_type === t.key ? "text-blue-700" : "text-slate-700"}`}>
                        {t.label}
                      </span>
                      <span className="text-xs text-slate-400 leading-tight">{t.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* お客様情報 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700">お客様情報</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      会社名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.company_name}
                      onChange={update("company_name")}
                      placeholder="株式会社〇〇"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      氏名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={update("name")}
                      placeholder="田中 太郎"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="taro@example.com"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      電話番号 <span className="text-xs text-slate-400">（任意）</span>
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={update("phone")}
                      placeholder="078-000-0000"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* お問い合わせ内容 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  お問い合わせ内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={update("message")}
                  rows={6}
                  placeholder={
                    form.inquiry_type === "document"
                      ? "資料請求の目的・ご検討中のプランなどをお聞かせください（任意）"
                      : form.inquiry_type === "question"
                      ? "ご質問の内容をできるだけ詳しくご記入ください"
                      : "お問い合わせ内容をご記入ください"
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-right">{form.message.length} 文字</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500">
                送信いただいた個人情報は、お問い合わせへの回答のみに使用し、第三者への提供は行いません。
                詳しくは<Link to="/privacy-policy" className="text-blue-600 hover:underline mx-0.5">プライバシーポリシー</Link>をご覧ください。
              </div>

              <button
                type="submit"
                disabled={!isValid || submitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> 送信中...</>
                ) : (
                  <><Send size={16} /> 送信する</>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-10 flex flex-wrap gap-4 text-sm text-slate-400 justify-center">
          <Link to="/company" className="hover:text-slate-700 transition-colors">会社概要</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-slate-700 transition-colors">利用規約</Link>
          <span>·</span>
          <Link to="/privacy-policy" className="hover:text-slate-700 transition-colors">プライバシーポリシー</Link>
          <span>·</span>
          <Link to="/" className="hover:text-slate-700 transition-colors">トップページ</Link>
        </div>
      </main>
    </div>
  );
}

function SuccessView() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 size={32} className="text-emerald-600" />
      </div>
      <h2 className="text-2xl font-extrabold text-slate-900 mb-3">送信完了</h2>
      <p className="text-slate-500 text-sm leading-relaxed mb-2">
        お問い合わせありがとうございます。<br />
        受付確認メールをご入力のアドレスに送信しました。
      </p>
      <p className="text-slate-400 text-sm mb-8">
        担当者より <strong className="text-slate-600">2〜3営業日以内</strong> にご連絡いたします。
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
        >
          トップページへ
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center justify-center gap-2 border border-slate-300 hover:border-blue-400 text-slate-700 px-6 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          アカウントを作成する
        </Link>
      </div>
    </div>
  );
}
