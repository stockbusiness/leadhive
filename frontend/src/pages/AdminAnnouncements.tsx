import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2, Loader2, RefreshCw, Globe, Building2, ToggleLeft, ToggleRight, Pencil, X, Save } from "lucide-react";
import { api } from "../api";

type Announcement = {
  id: number;
  title: string;
  content: string;
  target_org_id: number | null;
  target_org_name: string | null;
  is_active: boolean;
  created_at: string | null;
};

type Org = { id: number; name: string };

const EMPTY = { title: "", content: "", target_org_id: null as number | null, is_active: true };

export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [annRes, tenantRes] = await Promise.all([
        api.adminAnnouncements.list(),
        api.tenants.list(),
      ]);
      setItems(annRes.announcements);
      setOrgs(tenantRes.tenants.map((t: any) => ({ id: t.id, name: t.name })));
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({ title: a.title, content: a.content, target_org_id: a.target_org_id, is_active: a.is_active });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError("タイトルと内容は必須です"); return; }
    setSaving(true);
    setError("");
    try {
      if (editId !== null) {
        await api.adminAnnouncements.update(editId, form);
        setSuccess("更新しました");
      } else {
        await api.adminAnnouncements.create(form);
        setSuccess("作成しました");
      }
      setTimeout(() => setSuccess(""), 3000);
      setShowForm(false);
      load();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await api.adminAnnouncements.update(a.id, { ...a, is_active: !a.is_active });
      setItems(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x));
    } catch { setError("更新に失敗しました"); }
  };

  const remove = async (id: number) => {
    if (!confirm("このお知らせを削除しますか？")) return;
    try {
      await api.adminAnnouncements.delete(id);
      setItems(prev => prev.filter(x => x.id !== id));
      setSuccess("削除しました");
      setTimeout(() => setSuccess(""), 3000);
    } catch { setError("削除に失敗しました"); }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone size={24} className="text-blue-600" />
            お知らせ配信
          </h1>
          <p className="text-sm text-slate-500 mt-1">ユーザーへのお知らせを作成・管理します</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
            <RefreshCw size={14} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={14} />お知らせを作成
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{success}</div>}

      {showForm && (
        <div className="mb-6 bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">{editId !== null ? "お知らせを編集" : "新規お知らせ"}</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">タイトル</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="お知らせタイトル"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">内容</label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={4}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="お知らせ本文を入力してください"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">配信対象</label>
              <select
                value={form.target_org_id ?? ""}
                onChange={e => setForm(f => ({ ...f, target_org_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全テナント（全体配信）</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm text-slate-600">公開する</label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm bg-white border border-slate-200 rounded-xl">
          お知らせがありません
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div key={a.id} className={`bg-white border rounded-xl p-4 shadow-sm ${a.is_active ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-800 text-sm">{a.title}</span>
                    {a.is_active
                      ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded font-medium">公開中</span>
                      : <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded font-medium">非公開</span>
                    }
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      {a.target_org_id ? <><Building2 size={10} />{a.target_org_name}</> : <><Globe size={10} />全テナント</>}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-slate-400 mt-2">{a.created_at ? new Date(a.created_at).toLocaleString("ja-JP") : ""}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(a)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title={a.is_active ? "非公開にする" : "公開する"}>
                    {a.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="編集">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(a.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="削除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
