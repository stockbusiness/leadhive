import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, CheckCircle, XCircle } from "lucide-react";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "送信に失敗しました");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">LeadHive</h1>
          <p className="text-sm text-slate-500 mt-1">営業先リスト自動化ツール</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle size={48} className="text-emerald-500 mx-auto" />
            <h2 className="text-lg font-semibold text-slate-800">メールを送信しました</h2>
            <p className="text-sm text-slate-500">
              登録済みのアドレスであれば、パスワードリセット用リンクを送信しました。
              メールをご確認ください（迷惑メールフォルダもご確認ください）。
            </p>
            <Link to="/login" className="block text-blue-600 hover:underline text-sm">ログインページへ戻る</Link>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">パスワードを忘れた方</h2>
              <p className="text-sm text-slate-500 mt-1">登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <XCircle size={16} />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                リセットリンクを送信
              </button>
            </form>
            <p className="text-center text-sm text-slate-500">
              <Link to="/login" className="text-blue-600 hover:underline">ログインページへ戻る</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
