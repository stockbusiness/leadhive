import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";

export default function Unsubscribe() {
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email") || "";
    const token = params.get("token") || "";
    setEmail(emailParam);

    if (!emailParam || !token) {
      setStatus("error");
      setErrorMsg("無効なリンクです。URLを確認してください。");
      return;
    }

    fetch(`/api/public/unsubscribe?email=${encodeURIComponent(emailParam)}&token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "配信停止処理に失敗しました");
        }
        setStatus(data.already_unsubscribed ? "already" : "success");
      })
      .catch(e => {
        setStatus("error");
        setErrorMsg(e.message || "エラーが発生しました");
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Mail size={16} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">LeadHive</span>
        </div>

        <div className="p-8 text-center space-y-5">
          {status === "loading" && (
            <>
              <Loader2 size={48} className="text-slate-400 animate-spin mx-auto" />
              <div>
                <h1 className="text-xl font-bold text-slate-800">処理中...</h1>
                <p className="text-sm text-slate-500 mt-1">配信停止の処理をしています。しばらくお待ちください。</p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">配信停止が完了しました</h1>
                {email && (
                  <p className="text-sm text-slate-500 mt-2">
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{email}</span><br />
                    への今後のメール送信は停止されます。
                  </p>
                )}
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs text-slate-500">
                  このアドレスは配信停止リストに追加されました。<br />
                  再度メールを受け取りたい場合は、送信者にご連絡ください。
                </p>
              </div>
            </>
          )}

          {status === "already" && (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">配信停止済みです</h1>
                {email && (
                  <p className="text-sm text-slate-500 mt-2">
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{email}</span><br />
                    は既に配信停止リストに登録されています。
                  </p>
                )}
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <XCircle size={40} className="text-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">エラーが発生しました</h1>
                <p className="text-sm text-slate-500 mt-2">{errorMsg}</p>
              </div>
              <p className="text-xs text-slate-400">
                配信停止をご希望の場合は、メール送信者に直接ご連絡ください。
              </p>
            </>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-4 text-center">
          <p className="text-xs text-slate-400">© COOLWORKS株式会社 / LeadHive</p>
        </div>
      </div>
    </div>
  );
}
