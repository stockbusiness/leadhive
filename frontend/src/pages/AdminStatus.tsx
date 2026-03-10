import { useEffect, useState } from "react";
import { Activity, Plus, Pencil, Trash2, Loader2, X, Save, AlertCircle, CheckCircle2 } from "lucide-react";
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

const SEVERITIES = [
  { value: "minor", label: "軽微" },
  { value: "major", label: "重大" },
  { value: "critical", label: "緊急" },
];

const STATUSES = [
  { value: "investigating", label: "調査中" },
  { value: "identified", label: "原因特定" },
  { value: "monitoring", label: "監視中" },
  { value: "resolved", label: "解決済み" },
];

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-amber-100 text-amber-700",
  major: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  investigating: "bg-amber-50 text-amber-700",
  identified: "bg-orange-50 text-orange-700",
  monitoring: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
};

const emptyForm = { title: "", body: "", severity: "minor", status: "investigating" };

function fmtDate(s: string) {
  return new Date(s).toLocaleString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminStatus() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    api.adminStatus.list().then(setItems).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (item: Incident) => {
    setEditing(item);
    setForm({ title: item.title, body: item.body || "", severity: item.severity, status: item.status });
    setError("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.adminStatus.update(editing.id, form);
      } else {
        await api.adminStatus.create(form);
      }
      setShowModal(false);
      setSuccess(editing ? "更新しました" : "インシデントを作成しました");
      setTimeout(() => setSuccess(""), 3000);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.adminStatus.delete(id);
      setDeleteId(null);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "削除に失敗しました");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl">
            <Activity size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">ステータスページ管理</h1>
            <p className="text-sm text-slate-500">インシデントの公開・管理</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          インシデント追加
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={15} />
          {success}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Activity size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">インシデントがありません</p>
            <p className="text-xs mt-1">現在すべてのシステムが正常稼働中です</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[item.severity] || "bg-slate-100 text-slate-500"}`}>
                      {item.severity_label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || "bg-slate-100 text-slate-500"}`}>
                      {item.status_label}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  {item.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.body}</p>}
                  <p className="text-xs text-slate-400 mt-1">{fmtDate(item.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{editing ? "インシデント編集" : "インシデント追加"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">タイトル <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="例: 一部のユーザーでログインができない問題"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">詳細</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={3}
                  placeholder="状況の詳細・影響範囲・対応状況など"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">重大度</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">ステータス</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="bg-red-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">インシデントを削除しますか？</h3>
            <p className="text-sm text-slate-500 mb-5">この操作は元に戻せません。</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
                キャンセル
              </button>
              <button onClick={() => handleDelete(deleteId!)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold">
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
