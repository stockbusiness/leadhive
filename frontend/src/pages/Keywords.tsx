import { useEffect, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { api } from "../api";
import { CATEGORIES, DEFAULT_KEYWORDS } from "../constants";
import type { SearchKeyword } from "../types";

export default function Keywords() {
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);
  const [form, setForm] = useState({
    keyword: "",
    category: "",
    region: "",
    exclude_keywords: "",
  });

  const fetchKeywords = () => {
    api.keywords.list().then((data) => setKeywords(data.keywords));
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleAdd = () => {
    if (!form.keyword.trim()) return;
    api.keywords.create(form).then(() => {
      setForm({ keyword: "", category: "", region: "", exclude_keywords: "" });
      fetchKeywords();
    });
  };

  const handleDelete = (id: number) => {
    api.keywords.delete(id).then(() => fetchKeywords());
  };

  const addDefaultKeywords = () => {
    Promise.all(DEFAULT_KEYWORDS.map((kw) => api.keywords.create(kw))).then(() => fetchKeywords());
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">検索条件管理</h2>
        <button
          onClick={addDefaultKeywords}
          className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors"
        >
          <Search size={16} />
          デフォルトキーワード追加
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-700 mb-3">新しいキーワードを追加</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="検索キーワード"
            value={form.keyword}
            onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">カテゴリ選択</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="対象地域"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="除外キーワード"
            value={form.exclude_keywords}
            onChange={(e) => setForm({ ...form, exclude_keywords: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            追加
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">キーワード</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">カテゴリ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">地域</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">除外</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">登録日</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw) => (
              <tr key={kw.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{kw.keyword}</td>
                <td className="px-4 py-3 text-slate-600">{kw.category || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{kw.region || "-"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{kw.exclude_keywords || "-"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {kw.created_at ? new Date(kw.created_at).toLocaleDateString("ja-JP") : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleDelete(kw.id)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {keywords.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  キーワードが登録されていません。上のフォームから追加するか、「デフォルトキーワード追加」ボタンを押してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
