import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ChevronRight, X, Rocket } from "lucide-react";
import { api } from "../api";

interface SetupStatus {
  has_email_config: boolean;
  keyword_count: number;
  company_count: number;
}

const DISMISS_KEY = "leadhive_setup_card_dismissed";

export default function SetupProgressCard() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    api.settings.setupStatus().then(setStatus).catch(() => {});
  }, []);

  if (dismissed || !status) return null;

  const steps = [
    {
      label: "キーワードを登録する",
      done: status.keyword_count > 0,
      to: "/keywords",
      hint: `現在 ${status.keyword_count} 件登録済み`,
    },
    {
      label: "メール送信を設定する",
      done: status.has_email_config,
      to: "/settings",
      hint: "SMTP または SendGrid で設定できます",
    },
    {
      label: "企業を収集する",
      done: status.company_count > 0,
      to: "/scraper",
      hint: `現在 ${status.company_count} 社登録済み`,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-100 p-2 rounded-xl">
            <Rocket size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {allDone ? "セットアップ完了！" : "セットアップを完了しましょう"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {allDone
                ? "すべての初期設定が完了しています"
                : `${doneCount} / ${steps.length} 完了 — あと ${steps.length - doneCount} 項目残っています`}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          title="非表示にする"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{progressPct}%</span>
        </div>
      </div>

      <ul className="px-5 pb-4 space-y-2">
        {steps.map((step) => (
          <li key={step.label}>
            {step.done ? (
              <div className="flex items-center gap-3 py-1.5">
                <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-slate-400 line-through">{step.label}</span>
              </div>
            ) : (
              <Link
                to={step.to}
                className="flex items-center gap-3 py-1.5 group"
              >
                <Circle size={18} className="text-slate-300 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                    {step.label}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">{step.hint}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
