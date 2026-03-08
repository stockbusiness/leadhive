import { useEffect, useState } from "react";
import { Users, Search, Trash2, Loader2, RefreshCw, Shield, UserCheck, Building2, MailWarning, Send, AlertTriangle, CheckCircle } from "lucide-react";
import { api } from "../api";

type AdminUser = {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  org_id: number;
  org_name: string;
  created_at: string | null;
  email_verified: boolean;
};

function RoleBadge({ role }: { role: string }) {
  return role === "admin"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700"><Shield size={10} />管理者</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600"><UserCheck size={10} />メンバー</span>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState<number | "">("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [changingId, setChangingId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendingAll, setResendingAll] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(7);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.adminAllUsers.list({
        search,
        role: roleFilter,
        org_id: orgFilter || undefined,
        verified: verifiedFilter || undefined,
      });
      setUsers(r.users);
      const uniqueOrgs: { id: number; name: string }[] = [];
      const seen = new Set<number>();
      for (const u of r.users) {
        if (!seen.has(u.org_id)) { seen.add(u.org_id); uniqueOrgs.push({ id: u.org_id, name: u.org_name }); }
      }
      setOrgs(uniqueOrgs);
    } catch {
      setError("ユーザー一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, roleFilter, orgFilter, verifiedFilter]);

  const changeRole = async (userId: number, newRole: string) => {
    setChangingId(userId);
    try {
      await api.adminAllUsers.updateRole(userId, newRole);
      showSuccess("ロールを変更しました");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      setError("ロール変更に失敗しました");
    } finally {
      setChangingId(null);
    }
  };

  const deleteUser = async (userId: number, email: string) => {
    if (!confirm(`${email} を削除しますか？`)) return;
    setDeletingId(userId);
    try {
      await api.adminAllUsers.delete(userId);
      showSuccess("ユーザーを削除しました");
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e: any) {
      setError(e?.response?.data?.detail || "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  const resendVerification = async (userId: number, email: string) => {
    setResendingId(userId);
    setError("");
    try {
      const r = await api.adminAllUsers.resendVerification(userId);
      if (r.email_sent) {
        showSuccess(`${email} に確認メールを再送しました`);
      } else {
        showSuccess(`トークンを作成しました（SMTP未設定）: ${r.verify_url || ""}`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "再送に失敗しました");
    } finally {
      setResendingId(null);
    }
  };

  const resendAll = async () => {
    if (!confirm("未確認の全ユーザーに確認メールを再送しますか？")) return;
    setResendingAll(true);
    setError("");
    try {
      const r = await api.adminAllUsers.resendAll();
      showSuccess(r.message);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "一括再送に失敗しました");
    } finally {
      setResendingAll(false);
    }
  };

  const cleanupUnverified = async () => {
    setCleaningUp(true);
    setCleanupConfirm(false);
    setError("");
    try {
      const r = await api.adminAllUsers.cleanupUnverified(cleanupDays);
      showSuccess(r.message);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "削除に失敗しました");
    } finally {
      setCleaningUp(false);
    }
  };

  const unverifiedCount = users.filter(u => !u.email_verified).length;
  const orgGroups = new Map<string, number>();
  users.forEach(u => orgGroups.set(u.org_name, (orgGroups.get(u.org_name) || 0) + 1));

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users size={24} className="text-blue-600" />
            全ユーザー管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">全テナントのユーザーを横断管理します</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          <RefreshCw size={14} />更新
        </button>
      </div>

      {unverifiedCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <MailWarning size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                メール未確認ユーザーが {unverifiedCount} 件あります
              </p>
              <p className="text-xs text-amber-600 mt-0.5">確認メールを再送するか、一定期間経過後に削除できます。</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={resendAll}
                disabled={resendingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {resendingAll ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                一括再送
              </button>
              <button
                onClick={() => setCleanupConfirm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 size={12} />
                古いものを削除
              </button>
            </div>
          </div>

          {cleanupConfirm && (
            <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-amber-700 font-medium">登録から</span>
              <select
                value={cleanupDays}
                onChange={e => setCleanupDays(Number(e.target.value))}
                className="text-xs border border-amber-300 rounded px-2 py-1 bg-white focus:outline-none"
              >
                <option value={1}>1日</option>
                <option value={3}>3日</option>
                <option value={7}>7日</option>
                <option value={14}>14日</option>
                <option value={30}>30日</option>
              </select>
              <span className="text-xs text-amber-700 font-medium">以上経過した未確認ユーザーを削除</span>
              <button
                onClick={cleanupUnverified}
                disabled={cleaningUp}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors"
              >
                {cleaningUp ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
                実行する
              </button>
              <button onClick={() => setCleanupConfirm(false)} className="text-xs text-amber-600 hover:underline">キャンセル</button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="メール・名前で検索"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全ロール</option>
          <option value="admin">管理者</option>
          <option value="member">メンバー</option>
        </select>
        <select value={orgFilter} onChange={e => setOrgFilter(e.target.value ? Number(e.target.value) : "")}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全組織</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全ステータス</option>
          <option value="unverified">未確認のみ</option>
          <option value="verified">確認済みのみ</option>
        </select>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Users size={14} className="text-blue-500" />
          <span><strong className="text-slate-700">{users.length}</strong> ユーザー</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Building2 size={14} className="text-green-500" />
          <span><strong className="text-slate-700">{orgGroups.size}</strong> 組織</span>
        </div>
        {unverifiedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-amber-600">
            <MailWarning size={14} />
            <span><strong>{unverifiedCount}</strong> 未確認</span>
          </div>
        )}
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle size={15} />{success}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-1">ID</div>
          <div className="col-span-3">メール</div>
          <div className="col-span-2">名前</div>
          <div className="col-span-2">組織</div>
          <div className="col-span-1">ロール</div>
          <div className="col-span-1">認証</div>
          <div className="col-span-1">登録日</div>
          <div className="col-span-1 text-right">操作</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">ユーザーが見つかりません</div>
        ) : (
          users.map(u => (
            <div key={u.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 last:border-0 items-center hover:bg-slate-50 transition-colors text-sm ${!u.email_verified ? "bg-amber-50/40" : ""}`}>
              <div className="col-span-1 text-xs text-slate-400 font-mono">{u.id}</div>
              <div className="col-span-3 text-slate-700 truncate">{u.email}</div>
              <div className="col-span-2 text-slate-600 truncate">{u.display_name || "—"}</div>
              <div className="col-span-2 text-slate-600 truncate text-xs">{u.org_name}</div>
              <div className="col-span-1">
                <select
                  value={u.role}
                  onChange={e => changeRole(u.id, e.target.value)}
                  disabled={changingId === u.id}
                  className="text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="member">メンバー</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
              <div className="col-span-1">
                {u.email_verified ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle size={9} />確認済
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                    <MailWarning size={9} />未確認
                  </span>
                )}
              </div>
              <div className="col-span-1 text-xs text-slate-400">
                {u.created_at ? new Date(u.created_at).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" }) : "—"}
              </div>
              <div className="col-span-1 flex justify-end gap-1">
                {!u.email_verified && (
                  <button
                    onClick={() => resendVerification(u.id, u.email)}
                    disabled={resendingId === u.id}
                    className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                    title="確認メールを再送"
                  >
                    {resendingId === u.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                )}
                <button
                  onClick={() => deleteUser(u.id, u.email)}
                  disabled={deletingId === u.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="削除"
                >
                  {deletingId === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
