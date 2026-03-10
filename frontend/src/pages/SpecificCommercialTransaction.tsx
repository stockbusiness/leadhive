import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronLeft, Loader2 } from "lucide-react";
import { api } from "../api";

const FIELD_LABELS: { key: string; label: string }[] = [
  { key: "legal_seller_name", label: "販売業者" },
  { key: "legal_representative", label: "代表責任者" },
  { key: "legal_address", label: "所在地" },
  { key: "legal_phone", label: "電話番号" },
  { key: "legal_email", label: "メールアドレス" },
  { key: "legal_url", label: "URL" },
  { key: "legal_service_name", label: "サービス名" },
  { key: "legal_price_note", label: "販売価格" },
  { key: "legal_payment_method", label: "支払方法" },
  { key: "legal_payment_timing", label: "支払時期" },
  { key: "legal_delivery_timing", label: "サービス提供時期" },
  { key: "legal_cancellation", label: "返品・キャンセルについて" },
  { key: "legal_environment", label: "動作環境" },
  { key: "legal_other", label: "その他" },
];

export default function SpecificCommercialTransaction() {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.publicLegal.get()
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors">
            <Building2 size={22} className="text-blue-600" />
            <span className="font-bold text-lg">LeadHive</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            トップに戻る
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-8">
            <h1 className="text-2xl font-bold text-white">特定商取引法に基づく表記</h1>
            <p className="text-blue-100 text-sm mt-1">
              特定商取引に関する法律第11条に基づき、以下の通り表示します。
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {FIELD_LABELS.map(({ key, label }) => {
                const value = data[key] || "";
                if (!value) return null;
                return (
                  <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 px-8 py-5">
                    <div className="text-sm font-semibold text-slate-600 md:pt-0.5">
                      {label}
                    </div>
                    <div className="md:col-span-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {key === "legal_email" ? (
                        <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
                          {value}
                        </a>
                      ) : key === "legal_url" ? (
                        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              ※ 本ページの内容は予告なく変更される場合があります。最新情報は本ページをご確認ください。
            </p>
            <p className="text-xs text-slate-400 mt-1">
              最終更新: {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-slate-500">
          <Link to="/terms" className="hover:text-slate-700">利用規約</Link>
          <Link to="/privacy-policy" className="hover:text-slate-700">プライバシーポリシー</Link>
          <Link to="/contact" className="hover:text-slate-700">お問い合わせ</Link>
        </div>
      </main>
    </div>
  );
}
