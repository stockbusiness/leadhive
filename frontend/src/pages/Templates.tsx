import { useEffect, useState } from "react";
import { FileText, Mail, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import type { MemoTemplate } from "../types";

export default function Templates() {
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"memo" | "email">("memo");

  const fetchTemplates = () => {
    api.templates.list().then((data) => {
      setTemplates(data.templates);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const isEmailTab = activeTab === "email";

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return;
    setAdding(true);
    api.templates.create({
      title: title.trim(),
      content: content.trim(),
      is_email_template: isEmailTab,
    }).then(() => {
      setTitle("");
      setContent("");
      setAdding(false);
      fetchTemplates();
    }).catch(() => setAdding(false));
  };

  const handleDelete = (id: number) => {
    if (confirm("このテンプレートを削除しますか？")) {
      api.templates.delete(id).then(() => fetchTemplates());
    }
  };

  const filteredTemplates = templates.filter(
    (t) => !!t.is_email_template === isEmailTab
  );

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
        テンプレート管理
      </h2>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("memo")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "memo"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText size={16} />
          メモテンプレート
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "email"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Mail size={16} />
          メールテンプレート
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-3">
          {isEmailTab ? "新規メールテンプレート追加" : "新規メモテンプレート追加"}
        </h3>
        {isEmailTab && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3 text-xs text-blue-700">
            <p className="font-medium mb-1">利用可能な変数:</p>
            <p>{"{会社名}"} {"{担当者名}"} {"{メールアドレス}"} {"{電話番号}"} {"{都道府県}"} {"{市区町村}"} {"{WebサイトURL}"}</p>
            <p className="mt-1 text-blue-500">※ タイトルはメールの件名として使用されます</p>
          </div>
        )}
        <div className="space-y-3">
          <input
            type="text"
            placeholder={isEmailTab ? "件名テンプレート（例：{会社名} 様へのご提案）" : "テンプレート名（例：初回アプローチ）"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder={isEmailTab ? "メール本文（例：{会社名} {担当者名}様\n\nお世話になっております。）" : "テンプレート内容（例：○月○日 初回メール送信。担当者名:____）"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={isEmailTab ? 6 : 3}
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
        {filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            {isEmailTab ? "メールテンプレートがありません。上のフォームから追加してください。" : "メモテンプレートがありません。上のフォームから追加してください。"}
          </div>
        ) : (
          filteredTemplates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-800">{t.title}</h4>
                    {isEmailTab && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">件名</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{t.content}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("ja-JP") : ""}
                  </p>
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 p-1 ml-3" title="削除">
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
