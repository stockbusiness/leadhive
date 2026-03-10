import { useEffect, useState } from "react";
import { HelpCircle, Plus, Pencil, Trash2, Loader2, X, Save, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "../api";

type FaqItem = {
  id: number;
  question: string;
  answer: string;
  category: string;
  category_label: string;
  display_order: number;
  is_active: boolean;
};

const CATEGORIES = [
  { value: "general", label: "一般" },
  { value: "technical", label: "技術的な問題" },
  { value: "billing", label: "料金・プラン" },
  { value: "account", label: "アカウント" },
  { value: "other", label: "その他" },
];

const emptyForm = { question: "", answer: "", category: "general", display_order: 0, is_active: true };

export default function AdminFaq() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    api.adminFaq.list().then(setItems).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, display_order: items.length + 1 });
    setError("");
    setShowModal(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditing(item);
    setForm({ question: item.question, answer: item.answer, category: item.category, display_order: item.display_order, is_active: item.is_active });
    setError("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.adminFaq.update(editing.id, form);
      } else {
        await api.adminFaq.create(form);
      }
      setShowModal(false);
      setSuccess(editing ? "更新しました" : "作成しました");
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
      await api.adminFaq.delete(id);
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
            <HelpCircle size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">FAQ管理</h1>
            <p className="text-sm text-slate-500">よくある質問の登録・編集</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          FAQ追加
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
            <HelpCircle size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">FAQがありません</p>
            <p className="text-xs mt-1">「FAQ追加」から登録してください</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                      {item.is_active ? "公開" : "非公開"}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.category_label}</span>
                    <span className="text-xs text-slate-300">順: {item.display_order}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{item.question}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.answer}</p>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{editing ? "FAQ編集" : "FAQ追加"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">カテゴリ</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">質問 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  placeholder="よくある質問を入力"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">回答 <span className="text-red-500">*</span></label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  rows={6}
                  placeholder="回答を入力してください"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">表示順</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">公開状態</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                      form.is_active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-500"
                    }`}
                  >
                    {form.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                    {form.is_active ? "公開" : "非公開"}
                  </button>
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
            <h3 className="text-base font-bold text-slate-900 mb-1">FAQを削除しますか？</h3>
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
