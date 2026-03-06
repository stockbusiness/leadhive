import { useState } from "react";
import axios from "axios";
import { Globe, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface ScrapeResult {
  url: string;
  status: "success" | "error" | "duplicate";
  message?: string;
  company_id?: number;
}

export default function Scraper() {
  const [singleUrl, setSingleUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [bulkResults, setBulkResults] = useState<ScrapeResult[]>([]);

  const handleSingleScrape = async () => {
    if (!singleUrl.trim()) return;
    setLoading(true);
    setSingleResult(null);
    try {
      const res = await axios.post("/api/scrape", { url: singleUrl });
      setSingleResult(res.data);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "エラーが発生しました";
      setSingleResult({ error: detail });
    }
    setLoading(false);
  };

  const handleBulkScrape = async () => {
    const urls = bulkUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u);
    if (urls.length === 0) return;
    setLoading(true);
    setBulkResults([]);
    try {
      const res = await axios.post("/api/scrape/bulk", { urls });
      setBulkResults(res.data.results);
    } catch (err: any) {
      setBulkResults([{ url: "", status: "error", message: "エラーが発生しました" }]);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">URL収集・スクレイピング</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Globe size={18} />
            単一URL取得
          </h3>
          <p className="text-sm text-slate-500">
            企業サイトのURLを入力すると、会社情報を自動で抽出・登録します。
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://example.com"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleSingleScrape()}
            />
            <button
              onClick={handleSingleScrape}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
              取得
            </button>
          </div>

          {singleResult && (
            <div className="mt-4">
              {singleResult.error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700 flex items-center gap-2">
                    <XCircle size={16} />
                    {singleResult.error}
                  </p>
                </div>
              ) : singleResult.company ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-emerald-700 flex items-center gap-2 font-medium">
                    <CheckCircle size={16} />
                    企業情報を取得・登録しました
                  </p>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><span className="font-medium">会社名:</span> {singleResult.company.company_name || "未取得"}</p>
                    <p><span className="font-medium">ドメイン:</span> {singleResult.company.domain}</p>
                    <p><span className="font-medium">カテゴリ:</span> {singleResult.company.category_main || "未分類"}</p>
                    <p><span className="font-medium">スコア:</span> {singleResult.company.score_total}点 (ランク{singleResult.company.score_rank})</p>
                    <p><span className="font-medium">問い合わせ:</span> {singleResult.company.contact_url ? "あり" : "なし"}</p>
                    <p><span className="font-medium">電話:</span> {singleResult.company.phone || "未取得"}</p>
                    <p><span className="font-medium">所在地:</span> {singleResult.company.prefecture || "未取得"}{singleResult.company.city || ""}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Globe size={18} />
            一括URL取得
          </h3>
          <p className="text-sm text-slate-500">
            複数のURLを1行ずつ入力して、一括で企業情報を取得します。
          </p>
          <textarea
            placeholder={"https://example1.com\nhttps://example2.com\nhttps://example3.com"}
            value={bulkUrls}
            onChange={(e) => setBulkUrls(e.target.value)}
            rows={6}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleBulkScrape}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            一括取得
          </button>

          {bulkResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {bulkResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm p-2 rounded ${
                    r.status === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : r.status === "duplicate"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {r.status === "success" ? (
                    <CheckCircle size={14} />
                  ) : r.status === "duplicate" ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <XCircle size={14} />
                  )}
                  <span className="truncate">{r.url}</span>
                  <span className="ml-auto text-xs">{r.message || "成功"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
