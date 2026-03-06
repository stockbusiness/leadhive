import { useEffect, useState } from "react";
import axios from "axios";
import { FileText, Plus, Trash2 } from "lucide-react";

interface MemoTemplate {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchTemplates = () => {
    axios.get("/api/templates").then((res) => {
      setTemplates(res.data.templates);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return;
    setAdding(true);
    axios.post("/api/templates", { title: title.trim(), content: content.trim() }).then(() => {
      setTitle("");
      setContent("");
      setAdding(false);
      fetchTemplates();
    }).catch(() => setAdding(false));
  };

  const handleDelete = (id: number) => {
    if (confirm("このテンプレートを削除しますか？")) {
      axios.delete(`/api/templates/${id}`).then(() => fetchTemplates());
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <FileText size={24} />
        メモテンプレート管理
      </h2>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-3">新規テンプレート追加</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="テンプレート名（例：初回アプローチ）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="テンプレート内容（例：○月○日 初回メール送信。担当者名:____）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !title.trim() || !content.trim()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            {adding ? "追加中..." : "追加"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            テンプレートがありません。上のフォームから追加してください。
          </div>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-800">{t.title}</h4>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{t.content}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("ja-JP") : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-red-400 hover:text-red-600 p-1 ml-3"
                  title="削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
