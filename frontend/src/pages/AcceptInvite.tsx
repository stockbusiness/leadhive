import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const [inviteInfo, setInviteInfo] = useState<{ email: string; org_name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.auth.getInvite(token)
      .then(data => setInviteInfo(data))
      .catch(() => setError("招待リンクが無効または期限切れです"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (password.length < 8) { setSubmitError("パスワードは8文字以上で入力してください"); return; }
    if (password !== confirmPassword) { setSubmitError("パスワードが一致しません"); return; }

    setSubmitting(true);
    try {
      const res = await api.auth.acceptInvite(token!, { display_name: displayName, password });
      localStorage.setItem("leadhive_token", res.access_token);
      updateUser(res.user);
      navigate("/");
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || "参加処理に失敗しました");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md text-center space-y-4">
          <XCircle size={48} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">招待リンクが無効です</h2>
          <p className="text-slate-500">{error}</p>
          <a href="/login" className="block text-blue-600 hover:underline text-sm">ログインページへ</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="bg-blue-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">招待を承認する</h1>
          <p className="text-sm text-slate-500 mt-1">
            <strong>{inviteInfo?.org_name}</strong> に <strong>{inviteInfo?.email}</strong> として参加
          </p>
          <p className="text-xs text-slate-400 mt-1">
            ロール: {inviteInfo?.role === "admin" ? "管理者" : "メンバー"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">表示名（任意）</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">パスワード（8文字以上）</label>
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
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <XCircle size={16} />
              {submitError}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            組織に参加する
          </button>
        </form>
      </div>
    </div>
  );
}
