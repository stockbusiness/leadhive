import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, Shield, ShieldCheck, Loader2, Copy, CheckCircle, XCircle, Clock, Mail } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";

interface OrgUser {
  id: number;
  email: string;
  display_name: string;
  role: string;
  org_id: number;
  created_at: string;
}

interface PendingInvitation {
  id: number;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url?: string; message: string; type: "success" | "error" } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const isAdmin = currentUser?.role === "admin";

  const loadUsers = async () => {
    try {
      const data = await api.users.list();
      setUsers(data.users);
      setInvitations(data.pending_invitations);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const data = await api.users.invite(inviteEmail.trim(), inviteRole);
      setInviteResult({ url: data.invite_url, message: data.message, type: "success" });
      setInviteEmail("");
      await loadUsers();
    } catch (err: any) {
      setInviteResult({ message: err.response?.data?.detail || "招待に失敗しました", type: "error" });
    }
    setInviting(false);
  };

  const handleCopyUrl = (url: string) => {
    const full = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(full);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await api.users.updateRole(userId, role);
      setMessage({ text: "ロールを変更しました", type: "success" });
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.detail || "変更に失敗しました", type: "error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!confirm(`${email} を削除しますか？この操作は取り消せません。`)) return;
    try {
      await api.users.delete(userId);
      setMessage({ text: "ユーザーを削除しました", type: "success" });
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.detail || "削除に失敗しました", type: "error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCancelInvite = async (id: number) => {
    try {
      await api.users.cancelInvitation(id);
      setMessage({ text: "招待をキャンセルしました", type: "success" });
      await loadUsers();
    } catch {
      setMessage({ text: "キャンセルに失敗しました", type: "error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Users size={24} className="text-slate-700" />
        <h2 className="text-2xl font-bold text-slate-800">メンバー管理</h2>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {message.text}
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <UserPlus size={18} className="text-slate-600" />
            <h3 className="font-semibold text-slate-700">メンバーを招待</h3>
          </div>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleInvite()}
              placeholder="招待するメールアドレス"
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">メンバー</option>
              <option value="admin">管理者</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {inviting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              招待送信
            </button>
          </div>
          {inviteResult && (
            <div className={`p-3 rounded-lg text-sm ${inviteResult.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {inviteResult.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {inviteResult.message}
              </div>
              {inviteResult.url && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500">招待URL:</span>
                  <code className="text-xs bg-white border rounded px-2 py-1 flex-1 truncate">{window.location.origin}{inviteResult.url}</code>
                  <button
                    onClick={() => handleCopyUrl(inviteResult.url!)}
                    className="flex items-center gap-1 text-xs bg-white border rounded px-2 py-1 hover:bg-slate-50"
                  >
                    {copiedToken ? <CheckCircle size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedToken ? "コピー済み" : "コピー"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Users size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-700">メンバー一覧 ({users.length}名)</h3>
        </div>
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
              <div className={`rounded-full p-2 flex-shrink-0 ${u.role === "admin" ? "bg-amber-100" : "bg-slate-100"}`}>
                {u.role === "admin" ? <ShieldCheck size={16} className="text-amber-600" /> : <Shield size={16} className="text-slate-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{u.display_name || u.email}</p>
                {u.display_name && <p className="text-xs text-slate-500 truncate">{u.email}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                {u.role === "admin" ? "管理者" : "メンバー"}
              </span>
              {isAdmin && u.id !== currentUser?.id && (
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="member">メンバー</option>
                    <option value="admin">管理者</option>
                  </select>
                  <button onClick={() => handleDeleteUser(u.id, u.email)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              {u.id === currentUser?.id && <span className="text-xs text-slate-400">（自分）</span>}
            </div>
          ))}
        </div>
      </div>

      {invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Clock size={18} className="text-slate-600" />
            <h3 className="font-semibold text-slate-700">招待中（未承諾）</h3>
          </div>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-amber-50">
                <Mail size={16} className="text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{inv.email}</p>
                  <p className="text-xs text-slate-500">
                    {inv.role === "admin" ? "管理者" : "メンバー"} • 期限: {new Date(inv.expires_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => handleCancelInvite(inv.id)} className="text-slate-400 hover:text-red-500 transition-colors text-xs">
                    キャンセル
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
