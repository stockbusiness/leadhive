import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Lock, Unlock,
  Download, RefreshCw, Loader2, User, Eye, Activity,
} from "lucide-react";

interface SecurityEvent {
  id: number;
  event_type: string;
  user_id: number | null;
  user_email: string | null;
  org_id: number | null;
  ip_address: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

interface Stats {
  total_events: number;
  failed_logins_24h: number;
  locked_accounts: number;
  logins_7d: number;
  exports_7d: number;
}

interface LockedUser {
  id: number;
  email: string;
  display_name: string | null;
  org_id: number;
  failed_login_count: number;
  locked_until: string;
}

const EVENT_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  login_success:   { label: "ログイン成功",       color: "text-green-700 bg-green-50 border-green-200",   icon: <CheckCircle size={13} /> },
  login_failed:    { label: "ログイン失敗",       color: "text-amber-700 bg-amber-50 border-amber-200",   icon: <AlertTriangle size={13} /> },
  login_blocked:   { label: "ロック中ブロック",   color: "text-red-700 bg-red-50 border-red-200",         icon: <XCircle size={13} /> },
  account_locked:  { label: "アカウントロック",   color: "text-red-700 bg-red-50 border-red-200",         icon: <Lock size={13} /> },
  user_unlocked:   { label: "ロック解除",         color: "text-blue-700 bg-blue-50 border-blue-200",      icon: <Unlock size={13} /> },
  password_changed:{ label: "パスワード変更",     color: "text-indigo-700 bg-indigo-50 border-indigo-200",icon: <User size={13} /> },
  data_exported:   { label: "データエクスポート", color: "text-purple-700 bg-purple-50 border-purple-200",icon: <Download size={13} /> },
};

function EventBadge({ type }: { type: string }) {
  const conf = EVENT_LABELS[type] ?? { label: type, color: "text-slate-600 bg-slate-50 border-slate-200", icon: <Activity size={13} /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${conf.color}`}>
      {conf.icon}{conf.label}
    </span>
  );
}

function formatJST(iso: string) {
  if (!iso) return "-";
  try {
    return new Date(iso + (iso.endsWith("Z") ? "" : "Z")).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  } catch { return iso; }
}

export default function AdminSecurity() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [lockedUsers, setLockedUsers] = useState<LockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [filterType, setFilterType] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState("");

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get("/api/security/stats"),
      axios.get("/api/security/events?limit=200"),
      axios.get("/api/security/locked-users"),
    ]).then(([sRes, eRes, lRes]) => {
      setStats(sRes.data);
      setEvents(eRes.data.events);
      setLockedUsers(lRes.data.users);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleUnlock = async (userId: number) => {
    setUnlocking(userId);
    try {
      await axios.post(`/api/security/unlock-user/${userId}`);
      loadAll();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "ロック解除に失敗しました");
    } finally {
      setUnlocking(null);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloading(true);
    setDownloadMsg("");
    try {
      const res = await axios.get("/api/security/backup/companies", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      const disp = res.headers["content-disposition"] || "";
      const m = disp.match(/filename=(.+)/);
      a.href = url;
      a.download = m ? m[1] : "backup.csv";
      a.click();
      URL.revokeObjectURL(url);
      setDownloadMsg("CSVダウンロード完了");
    } catch { setDownloadMsg("ダウンロードに失敗しました"); }
    finally { setDownloading(false); }
  };

  const handleDownloadJson = async () => {
    setDownloading(true);
    setDownloadMsg("");
    try {
      const res = await axios.get("/api/security/backup/full", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      const disp = res.headers["content-disposition"] || "";
      const m = disp.match(/filename=(.+)/);
      a.href = url;
      a.download = m ? m[1] : "backup.json";
      a.click();
      URL.revokeObjectURL(url);
      setDownloadMsg("JSONバックアップダウンロード完了");
    } catch { setDownloadMsg("ダウンロードに失敗しました"); }
    finally { setDownloading(false); }
  };

  const filtered = filterType ? events.filter((e) => e.event_type === filterType) : events;

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-slate-500">
        <Loader2 size={20} className="animate-spin" />読み込み中...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-800">セキュリティ管理</h2>
            <p className="text-sm text-slate-500 mt-0.5">ログイン監視・アカウントロック管理・データバックアップ</p>
          </div>
        </div>
        <button onClick={loadAll} className="flex items-center gap-2 text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
          <RefreshCw size={14} />更新
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "総イベント数", value: stats?.total_events ?? 0, color: "text-slate-700", bg: "bg-slate-50" },
          { label: "ログイン失敗（24h）", value: stats?.failed_logins_24h ?? 0, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "ロック中アカウント", value: stats?.locked_accounts ?? 0, color: "text-red-700", bg: "bg-red-50" },
          { label: "ログイン成功（7日）", value: stats?.logins_7d ?? 0, color: "text-green-700", bg: "bg-green-50" },
          { label: "エクスポート（7日）", value: stats?.exports_7d ?? 0, color: "text-purple-700", bg: "bg-purple-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border border-slate-200 p-4 ${bg}`}>
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {lockedUsers.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
          <h3 className="text-base font-semibold text-red-800 flex items-center gap-2">
            <Lock size={16} /> ロック中アカウント ({lockedUsers.length}件)
          </h3>
          <div className="space-y-2">
            {lockedUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-red-100">
                <div>
                  <div className="text-sm font-medium text-slate-800">{u.email}</div>
                  <div className="text-xs text-slate-500">
                    失敗 {u.failed_login_count}回 　ロック解除: {formatJST(u.locked_until)}
                  </div>
                </div>
                <button
                  onClick={() => handleUnlock(u.id)}
                  disabled={unlocking === u.id}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {unlocking === u.id ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                  ロック解除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <Download size={16} className="text-indigo-600" /> データバックアップ
        </h3>
        <p className="text-sm text-slate-500">
          収集済みの企業データをダウンロードできます。CSVはExcelで開けます。JSONはシステム全体のバックアップです。
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleDownloadCsv}
            disabled={downloading}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            企業データ CSV ダウンロード
          </button>
          <button
            onClick={handleDownloadJson}
            disabled={downloading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            全データ JSONバックアップ（管理者）
          </button>
          {downloadMsg && (
            <span className="text-sm text-green-700 flex items-center gap-1">
              <CheckCircle size={14} />{downloadMsg}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">バックアップのダウンロードは監査ログに記録されます。</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <Eye size={16} className="text-slate-500" /> セキュリティ監査ログ
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{filtered.length}件</span>
          </h3>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">すべて</option>
            {Object.entries(EVENT_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-medium text-slate-600">日時（JST）</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">イベント</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">ユーザー</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">IPアドレス</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">詳細</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap tabular-nums">{formatJST(e.created_at)}</td>
                  <td className="px-3 py-2"><EventBadge type={e.event_type} /></td>
                  <td className="px-3 py-2 text-slate-700">{e.user_email || <span className="text-slate-400">-</span>}</td>
                  <td className="px-3 py-2 text-slate-500 tabular-nums">{e.ip_address || "-"}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-xs truncate">
                    {e.details ? Object.entries(e.details).map(([k, v]) => `${k}:${v}`).join(" / ") : "-"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400">イベントがありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
