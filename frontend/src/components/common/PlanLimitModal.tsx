import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, X, ArrowRight, MessageCircle, CreditCard, Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../api";
import type { PlanData } from "../../types";

const PLAN_TABLE = [
  { name: "フリー", price: "¥0", members: "1名", projects: "1件", companies: "200件", ai: "3回/月" },
  { name: "スターター", price: "¥4,980/月", members: "3名", projects: "3件", companies: "1,000件", ai: "20回/月" },
  { name: "プロ", price: "¥14,800/月", members: "10名", projects: "10件", companies: "5,000件", ai: "100回/月" },
  { name: "エンタープライズ", price: "要相談", members: "無制限", projects: "無制限", companies: "無制限", ai: "無制限" },
];

interface Props {
  message: string;
  onClose: () => void;
}

export default function PlanLimitModal({ message, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [paidPlans, setPaidPlans] = useState<PlanData[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    api.plans.list().then((data) => {
      const paid = data.plans.filter(
        (p) => p.is_active && p.price_monthly && p.price_monthly > 0 && p.stripe_price_id
      );
      setPaidPlans(paid);
    }).catch(() => {});
  }, []);

  const handleUpgradeManual = () => {
    onClose();
    navigate("/admin/plans");
  };

  const handleStripeCheckout = async (planId: number) => {
    setCheckoutLoading(planId);
    setCheckoutError("");
    try {
      const { url } = await api.stripe.createCheckout(planId);
      window.location.href = url;
    } catch (e: any) {
      setCheckoutError(e?.response?.data?.detail || "決済ページの作成に失敗しました");
      setCheckoutLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Crown size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">プランの上限に達しました</h3>
              <p className="text-amber-100 text-sm">継続してご利用いただくにはプランのアップグレードが必要です</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            {message}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">プラン比較</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-medium">プラン</th>
                    <th className="text-center px-3 py-2 font-medium">月額</th>
                    <th className="text-center px-3 py-2 font-medium">メンバー</th>
                    <th className="text-center px-3 py-2 font-medium">企業数</th>
                    <th className="text-center px-3 py-2 font-medium">AI分析</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_TABLE.map((p, i) => (
                    <tr
                      key={p.name}
                      className={`border-t border-slate-100 ${i === PLAN_TABLE.length - 1 ? "bg-gradient-to-r from-blue-50 to-indigo-50" : ""}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className={`font-semibold ${i === PLAN_TABLE.length - 1 ? "text-blue-700" : "text-slate-700"}`}>
                          {p.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{p.price}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{p.members}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{p.companies}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{p.ai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {checkoutError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {checkoutError}
            </div>
          )}

          {isAdmin ? (
            <div className="space-y-3">
              {paidPlans.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Stripeで決済</p>
                  <div className="space-y-2">
                    {paidPlans.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => handleStripeCheckout(plan.id)}
                        disabled={checkoutLoading !== null}
                        className="w-full flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-medium hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} />
                          <span>{plan.name}</span>
                          <span className="text-violet-200 text-xs">
                            ¥{(plan.price_monthly || 0).toLocaleString()}/月
                          </span>
                        </div>
                        {checkoutLoading === plan.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <ExternalLink size={14} className="text-violet-200" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={handleUpgradeManual}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-colors"
                >
                  プラン管理へ
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <MessageCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  プランのアップグレードは管理者が行えます。組織の管理者にご相談ください。
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
