import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { Mail, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { loginFromToken } = useAuth();

  const token = searchParams.get("token");
  const stateEmail: string = (location.state as any)?.email || "";
  const stateEmailSent: boolean = (location.state as any)?.email_sent ?? false;
  const stateVerifyUrl: string | null = (location.state as any)?.verify_url || null;

  const [email, setEmail] = useState(stateEmail);
  const [status, setStatus] = useState<"pending" | "verifying" | "success" | "error">(token ? "verifying" : "pending");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendUrl, setResendUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setStatus("verifying");
    axios.get(`/api/auth/verify-email/${token}`)
      .then((res) => {
        const { access_token, user: userData } = res.data;
        loginFromToken(access_token, userData);
        setStatus("success");
        setTimeout(() => {
          navigate(userData.onboarding_completed ? "/" : "/onboarding");
        }, 2500);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err?.response?.data?.detail || "確認リンクが無効または期限切れです");
      });
  }, [token]);

  const handleResend = async () => {
    if (!email.trim()) return;
    setResendLoading(true);
    setResendDone(false);
    setResendUrl(null);
    try {
      const res = await axios.post("/api/auth/resend-verification", { email });
      setResendDone(true);
      if (res.data.verify_url) setResendUrl(res.data.verify_url);
    } catch {
      setResendDone(true);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">LeadHive</h1>
          <p className="text-sm text-slate-500 mt-1">営業先リスト自動化ツール</p>
        </div>

        {status === "verifying" && (
          <div className="py-6">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">確認中...</h2>
            <p className="text-sm text-slate-500">メールアドレスを確認しています。</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-6">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">確認完了！</h2>
            <p className="text-sm text-slate-500">メールアドレスの確認が完了しました。<br />まもなくダッシュボードに移動します。</p>
          </div>
        )}

        {status === "error" && (
          <div className="py-4">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">確認に失敗しました</h2>
            <p className="text-sm text-red-600 mb-6">{errorMsg}</p>
            <p className="text-sm text-slate-500 mb-3">確認メールを再送することができます。</p>
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="登録メールアドレス"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleResend}
                disabled={resendLoading || !email.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {resendLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                再送
              </button>
            </div>
            {resendDone && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4">
                <p>確認メールを送信しました（アドレスが登録されている場合）。</p>
                {resendUrl && (
                  <p className="mt-1">
                    メールが届かない場合は{" "}
                    <Link to={resendUrl} className="underline font-medium">こちら</Link>
                    {" "}から確認できます。
                  </p>
                )}
              </div>
            )}
            <Link to="/login" className="text-sm text-blue-600 hover:underline">ログインに戻る</Link>
          </div>
        )}

        {status === "pending" && (
          <div className="py-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Mail className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-3">メールを確認してください</h2>

            {stateEmailSent ? (
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                <span className="font-medium text-slate-700">{stateEmail}</span> に確認メールを送信しました。
                <br />メール内のリンクをクリックして登録を完了してください。
              </p>
            ) : (
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                登録が受け付けられました。<br />
                確認メールを再送するか、下のリンクから直接確認できます。
              </p>
            )}

            {stateVerifyUrl && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-5">
                <p className="font-medium mb-1">SMTPが未設定のため、メールは送信されていません。</p>
                <p>
                  <Link to={stateVerifyUrl} className="underline font-medium">
                    こちらをクリックして確認する
                  </Link>
                </p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-5 mt-2">
              <p className="text-xs text-slate-400 mb-3">メールが届かない場合は再送できます</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="登録メールアドレス"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !email.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {resendLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  再送
                </button>
              </div>
              {resendDone && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
                  <p>確認メールを送信しました（アドレスが登録されている場合）。</p>
                  {resendUrl && (
                    <p className="mt-1">
                      メールが届かない場合は{" "}
                      <Link to={resendUrl} className="underline font-medium">こちら</Link>
                      {" "}から確認できます。
                    </p>
                  )}
                </div>
              )}
            </div>
            <Link to="/login" className="text-sm text-blue-600 hover:underline">ログインに戻る</Link>
          </div>
        )}
      </div>
    </div>
  );
}
