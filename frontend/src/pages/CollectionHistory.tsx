import { useEffect, useState } from "react";
import axios from "axios";
import { History, CheckCircle, XCircle, Copy, AlertTriangle } from "lucide-react";

interface CollectionLog {
  id: number;
  keyword_id: number;
  keyword_text: string;
  total_found: number;
  success_count: number;
  duplicate_count: number;
  rejected_count: number;
  error_count: number;
  created_at: string;
}

export default function CollectionHistory() {
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/collect/history").then((res) => {
      setLogs(res.data.logs);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <History size={24} />
        収集履歴
      </h2>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            収集履歴がありません。URL収集画面から企業を収集してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">日時</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">キーワード</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">検出数</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    <span className="flex items-center justify-center gap-1"><CheckCircle size={13} className="text-emerald-500" />成功</span>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    <span className="flex items-center justify-center gap-1"><Copy size={13} className="text-blue-500" />重複</span>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    <span className="flex items-center justify-center gap-1"><XCircle size={13} className="text-amber-500" />除外</span>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    <span className="flex items-center justify-center gap-1"><AlertTriangle size={13} className="text-red-500" />エラー</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString("ja-JP") : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{log.keyword_text}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{log.total_found}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {log.success_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {log.duplicate_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {log.rejected_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {log.error_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
