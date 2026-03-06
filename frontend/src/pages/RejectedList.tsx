import { useEffect, useState } from "react";
import axios from "axios";
import { ShieldBan, Plus, Trash2 } from "lucide-react";

interface RejectedItem {
  id: number;
  domain: string;
  url: string;
  reason: string;
  created_at: string;
}

export default function RejectedList() {
  const [items, setItems] = useState<RejectedItem[]>([]);
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("手動追加");
  const [error, setError] = useState("");

  const fetchItems = () => {
    axios.get("/api/rejected").then((res) => setItems(res.data.rejected));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAdd = async () => {
    if (!domain.trim()) return;
    setError("");
    try {
      await axios.post("/api/rejected", { domain: domain.trim(), reason });
      setDomain("");
      setReason("手動追加");
      fetchItems();
    } catch (err: any) {
      setError(err.response?.data?.detail || "追加に失敗しました");
    }
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`/api/rejected/${id}`);
    fetchItems();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-800">拒否リスト</h2>
        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{items.length}件</span>
      </div>

      <p className="text-sm text-slate-500">
        ここに登録されたドメインは、自動収集時に除外されます。まとめサイトや比較サイトなど、代理店候補として不適切なサイトを登録してください。
        自動収集時にまとめサイトと判定されたサイトも自動的にここに追加されます。
      </p>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ShieldBan size={18} />
          ドメインを追加
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="手動追加">手動追加</option>
            <option value="まとめサイト">まとめサイト</option>
            <option value="比較サイト">比較サイト</option>
            <option value="ブログ">ブログ</option>
            <option value="SNS">SNS</option>
            <option value="不関連">不関連</option>
          </select>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            <Plus size={16} />
            追加
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">ドメイン</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">理由</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">登録日</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{item.domain}</td>
                <td className="px-4 py-3">
                  <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">
                    {item.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString("ja-JP") : "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  拒否リストは空です
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
