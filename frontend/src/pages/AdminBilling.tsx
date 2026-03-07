import { useEffect, useState } from "react";
import { CreditCard, Loader2, RefreshCw, AlertCircle, CheckCircle, XCircle, DollarSign, TrendingUp, X } from "lucide-react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

type Charge = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  org_id: string;
  org_name: string;
  created_at: string;
};

type Summary = { total: number; success_count: number; fail_count: number };

function StatusBadge({ status }: { status: string }) {
  if (status === "succeeded") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={10} />成功</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"><XCircle size={10} />失敗</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">{status}</span>;
}

function formatAmount(amount: number, currency: string) {
  if (currency === "jpy") return `¥${amount.toLocaleString()}`;
  return `${(amount / 100).toLocaleString()} ${currency.toUpperCase()}`;
}

export default function AdminBilling() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.adminBilling.list();
      setConfigured(r.configured);
      setCharges(r.charges || []);
      setSummary(r.summary || null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CreditCard size={24} className="text-blue-600" />
            請求・履歴管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">Stripe 経由の決済履歴を確認します</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          <RefreshCw size={14} />更新
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {!loading && !configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle size={32} className="text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-slate-800 mb-2">Stripe が設定されていません</h2>
          <p className="text-sm text-slate-600 mb-4">請求履歴を表示するには、Stripe の API キーを設定してください。</p>
          <button onClick={() => navigate("/admin/stripe")} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            Stripe 設定へ
          </button>
        </div>
      )}

      {!loading && configured && summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">総売上（成功）</div>
            <div className="text-2xl font-bold text-slate-800">¥{summary.total.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">成功件数</div>
            <div className="text-2xl font-bold text-green-600">{summary.success_count}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">失敗件数</div>
            <div className="text-2xl font-bold text-red-500">{summary.fail_count}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
      ) : configured && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-2">日時</div>
            <div className="col-span-2">金額</div>
            <div className="col-span-2">ステータス</div>
            <div className="col-span-3">組織</div>
            <div className="col-span-3">Payment ID</div>
          </div>
          {charges.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">決済データがありません</div>
          ) : (
            charges.map(c => (
              <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 transition-colors text-sm">
                <div className="col-span-2 text-xs text-slate-500">
                  {new Date(c.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="col-span-2 font-semibold text-slate-800">{formatAmount(c.amount, c.currency)}</div>
                <div className="col-span-2"><StatusBadge status={c.status} /></div>
                <div className="col-span-3 text-slate-600 text-xs truncate">{c.org_name}</div>
                <div className="col-span-3 text-slate-400 text-xs font-mono truncate">{c.id}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
