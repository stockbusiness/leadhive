import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/[-\s]/g, "");
  return /^\d{10,13}$/.test(digits);
}

function validateCorporateNumber(number: string): boolean {
  if (!/^\d{13}$/.test(number)) return false;
  const digits = number.split("").map(Number);
  const checkDigit = digits[0];
  let sum = 0;
  for (let i = 1; i <= 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 2 : 1);
  }
  const remainder = sum % 9;
  const expected = remainder === 0 ? 0 : 9 - remainder;
  return checkDigit === expected;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [corporateNumber, setCorporateNumber] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [corpLookupState, setCorpLookupState] = useState<"idle" | "loading" | "success" | "unavailable" | "notfound" | "error">("idle");
  const [corpLookupMsg, setCorpLookupMsg] = useState("");

  const corpNumberValid = validateCorporateNumber(corporateNumber);

  useEffect(() => {
    if (corporateNumber.length < 13) {
      setCorpLookupState("idle");
      setCorpLookupMsg("");
    }
  }, [corporateNumber]);

  const handleCorpLookup = async () => {
    setCorpLookupState("loading");
    setCorpLookupMsg("");
    try {
      const res = await axios.get(`/api/public/corporate/${corporateNumber}`);
      const data = res.data;
      if (data.error === "lookup_unavailable") {
        setCorpLookupState("unavailable");
        setCorpLookupMsg(data.message);
      } else if (data.error === "not_found") {
        setCorpLookupState("notfound");
        setCorpLookupMsg("該当する法人情報が見つかりませんでした。会社名を手動で入力してください。");
      } else {
        if (data.name) setOrgName(data.name);
        setCorpLookupState("success");
        setCorpLookupMsg(`「${data.name}」の法人情報を取得しました${data.address ? `（${data.address}）` : ""}`);
      }
    } catch {
      setCorpLookupState("error");
      setCorpLookupMsg("法人情報の取得に失敗しました。会社名を手動で入力してください。");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("担当者名を入力してください");
      return;
    }
    if (!validatePhone(phone)) {
      setError("電話番号はハイフンあり/なし、10〜13桁の数字で入力してください");
      return;
    }
    if (!orgName.trim()) {
      setError("会社名・組織名を入力してください");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }
    if (!agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です");
      return;
    }

    setLoading(true);
    try {
      const result = await register(orgName, email, password, displayName, phone, corporateNumber || undefined);
      if (result.requires_verification) {
        navigate("/verify-email", {
          state: {
            email: result.email,
            email_sent: result.email_sent,
            verify_url: result.verify_url,
          },
        });
      } else {
        navigate("/onboarding");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">LeadHive</h1>
          <p className="text-sm text-slate-500 mt-1">営業先リスト自動化ツール</p>
        </div>
        <h2 className="text-xl font-semibold text-slate-700 mb-6">新規アカウント登録</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              担当者名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              電話番号 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="03-1234-5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              会社名・組織名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="株式会社〇〇"
            />
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">法人の場合（任意）</p>
            <label className="block text-sm font-medium text-slate-700 mb-1">法人番号（13桁）</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={corporateNumber}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 13);
                  setCorporateNumber(v);
                }}
                maxLength={13}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1234567890123"
              />
              <button
                type="button"
                onClick={handleCorpLookup}
                disabled={!corpNumberValid || corpLookupState === "loading"}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {corpLookupState === "loading" ? "取得中..." : "法人情報を取得"}
              </button>
            </div>
            {corporateNumber.length === 13 && !corpNumberValid && (
              <p className="text-xs text-red-500 mt-1">法人番号のチェックデジットが正しくありません</p>
            )}
            {corpLookupState === "success" && (
              <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                ✓ {corpLookupMsg}
              </div>
            )}
            {corpLookupState === "unavailable" && (
              <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                ℹ {corpLookupMsg}
              </div>
            )}
            {(corpLookupState === "notfound" || corpLookupState === "error") && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ⚠ {corpLookupMsg}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              パスワード（8文字以上） <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="agree" className="text-xs text-slate-600 cursor-pointer leading-relaxed">
              <span className="text-blue-600 hover:underline cursor-pointer">利用規約</span>と
              <span className="text-blue-600 hover:underline cursor-pointer">プライバシーポリシー</span>
              に同意します
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !agreed}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
          >
            {loading ? "登録中..." : "アカウントを作成"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          既にアカウントをお持ちの方は{" "}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
