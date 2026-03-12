import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "leadhive_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  }

  function reject() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 transition-all duration-300">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Cookie className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-slate-200 leading-relaxed">
              当サービスでは、利便性向上のためクッキーを使用します。
              詳しくは{" "}
              <a href="/privacy-policy" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
                プライバシーポリシー
              </a>
              {" "}をご確認ください。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={reject}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md transition-colors"
          >
            必要なもののみ
          </button>
          <button
            onClick={accept}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            すべて承諾
          </button>
          <button
            onClick={reject}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
