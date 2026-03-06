import { CheckCircle, AlertTriangle, XCircle, ShieldBan } from "lucide-react";
import type { ScrapeResult } from "../../types";

const colors: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700",
  duplicate: "bg-amber-50 text-amber-700",
  rejected: "bg-slate-100 text-slate-600",
  error: "bg-red-50 text-red-700",
};

const icons: Record<string, React.ReactNode> = {
  success: <CheckCircle size={14} />,
  duplicate: <AlertTriangle size={14} />,
  rejected: <ShieldBan size={14} />,
  error: <XCircle size={14} />,
};

export default function ResultRow({ result }: { result: ScrapeResult }) {
  return (
    <div className={`flex items-center gap-2 text-sm p-2 rounded ${colors[result.status] || colors.error}`}>
      {icons[result.status] || icons.error}
      <span className="truncate flex-1">{result.url}</span>
      <span className="ml-auto text-xs whitespace-nowrap">{result.message || "成功"}</span>
    </div>
  );
}
