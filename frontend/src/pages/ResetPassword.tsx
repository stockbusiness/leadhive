import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { api } from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("パスワードは8文字以上で入力してください"); return; }
    if (!/[A-Z]/.test(password)) { setError("パスワードに大文字を1文字以上含めてください"); return; }
    if (!/[a-z]/.test(password)) { setError("パスワードに小文字を1文字以上含めてください"); return; }
    if (!/[0-9]/.test(password)) { setError("パスワードに数字を1文字以上含めてください"); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError("パスワードに記号（!@#$など）を1文字以上含めてください"); return; }
    if (password !== confirmPassword) { setError("パスワードが一致しません"); return; }

    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "リセットに失敗しました");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md text-center space-y-4">
          <XCircle size={48} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">無効なリセットリンク</h2>
          <Link to="/login" className="block text-blue-600 hover:underline text-sm">ログインページへ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">LeadHive</h1>
          <p className="text-sm text-slate-500 mt-1">営業先リスト自動化ツール</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <CheckCircle size={48} className="text-emerald-500 mx-auto" />
            <h2 className="text-lg font-semibold text-slate-800">パスワードをリセットしました</h2>
            <p className="text-sm text-slate-500">ログインページへ自動的に移動します...</p>
            <Link to="/login" className="block text-blue-600 hover:underline text-sm">今すぐログインページへ</Link>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">新しいパスワードを設定</h2>
              <p className="text-sm text-slate-500 mt-1">8文字以上のパスワードを入力してください。</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">新しいパスワード（8文字以上）</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">パスワード（確認）</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                パスワードをリセット
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
