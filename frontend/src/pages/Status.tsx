import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, Clock, Loader2, ArrowLeft, Activity } from "lucide-react";
import { api } from "../api";

type Incident = {
  id: number;
  title: string;
  body: string | null;
  severity: string;
  severity_label: string;
  status: string;
  status_label: string;
  created_at: string;
  resolved_at: string | null;
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-amber-100 text-amber-700 border-amber-200",
  major: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  investigating: <Clock size={14} className="text-amber-500" />,
  identified: <AlertTriangle size={14} className="text-orange-500" />,
  monitoring: <Activity size={14} className="text-blue-500" />,
  resolved: <CheckCircle2 size={14} className="text-emerald-500" />,
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ja-JP", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Status() {
  const [data, setData] = useState<{ is_operational: boolean; incidents: Incident[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.statusPage.get().then(setData).finally(() => setLoading(false));
  }, []);

  const active = data?.incidents.filter((i) => i.status !== "resolved") ?? [];
  const resolved = data?.incidents.filter((i) => i.status === "resolved") ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className={`py-16 px-6 text-center text-white ${data?.is_operational ? "bg-emerald-700" : "bg-amber-600"}`}>
        <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-5">
          {loading ? (
            <Loader2 size={28} className="animate-spin" />
          ) : data?.is_operational ? (
            <CheckCircle2 size={28} />
          ) : (
            <AlertTriangle size={28} />
          )}
        </div>
        <h1 className="text-3xl font-bold mb-2">LeadHive システム状況</h1>
        {loading ? (
          <p className="text-white/70">読み込み中...</p>
        ) : data?.is_operational ? (
          <p className="text-emerald-100 text-lg font-medium">すべてのシステムが正常稼働中</p>
        ) : (
          <p className="text-amber-100 text-lg font-medium">{active.length}件のインシデントが発生中</p>
        )}
        <p className="text-white/50 text-sm mt-2">最終更新: {new Date().toLocaleString("ja-JP")}</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {!loading && active.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">現在のインシデント</h2>
            <div className="space-y-3">
              {active.map((inc) => (
                <IncidentCard key={inc.id} inc={inc} />
              ))}
            </div>
          </div>
        )}

        {!loading && resolved.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">解決済みのインシデント</h2>
            <div className="space-y-3">
              {resolved.map((inc) => (
                <IncidentCard key={inc.id} inc={inc} />
              ))}
            </div>
          </div>
        )}

        {!loading && data?.incidents.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-base font-semibold text-slate-700">直近のインシデントはありません</p>
            <p className="text-sm text-slate-400 mt-1">すべてのシステムが正常に稼働しています</p>
          </div>
        )}

        <div className="text-center pt-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={14} />
            トップに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

function IncidentCard({ inc }: { inc: Incident }) {
  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${inc.status === "resolved" ? "border-slate-200" : "border-amber-200"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{STATUS_ICONS[inc.status] || <Clock size={14} />}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-bold text-slate-800">{inc.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLORS[inc.severity] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
              {inc.severity_label}
            </span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{inc.status_label}</span>
          </div>
          {inc.body && <p className="text-sm text-slate-600 mt-1">{inc.body}</p>}
          <p className="text-xs text-slate-400 mt-2">
            {fmtDate(inc.created_at)}
            {inc.resolved_at && ` → 解決: ${fmtDate(inc.resolved_at)}`}
          </p>
        </div>
      </div>
    </div>
  );
}
