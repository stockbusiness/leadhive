import { useState, useEffect } from "react";
import axios from "axios";
import {
  Globe, Loader2, CheckCircle, XCircle, AlertTriangle,
  Zap, ShieldBan, Play,
} from "lucide-react";

interface ScrapeResult {
  url: string;
  status: "success" | "error" | "duplicate" | "rejected";
  message?: string;
  company_id?: number;
}

interface Keyword {
  id: number;
  keyword: string;
  category: string;
  is_active: boolean;
}

interface CollectSummary {
  keyword: string;
  total: number;
  success: number;
  duplicate: number;
  rejected: number;
  error: number;
}

export default function Scraper() {
  const [singleUrl, setSingleUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [bulkResults, setBulkResults] = useState<ScrapeResult[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectResults, setCollectResults] = useState<any>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<number | "all">("all");

  useEffect(() => {
    axios.get("/api/keywords").then((res) => {
      setKeywords(res.data.keywords.filter((k: Keyword) => k.is_active));
    });
  }, []);

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

  const handleAutoCollect = async () => {
    setCollectLoading(true);
    setCollectResults(null);
    try {
      if (selectedKeyword === "all") {
        const res = await axios.post("/api/collect/all");
        setCollectResults(res.data);
      } else {
        const res = await axios.post("/api/collect", { keyword_id: selectedKeyword });
        setCollectResults(res.data);
      }
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
    }
    setCollectLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">URL収集・スクレイピング</h2>

      <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-4 space-y-4">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Zap size={18} className="text-blue-600" />
          自動収集（Google検索API）
        </h3>
        <p className="text-sm text-slate-500">
          登録済みの検索キーワードを使ってGoogle検索を実行し、候補企業を自動で収集します。
          まとめサイトは自動で除外・拒否リストに追加されます。
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">対象キーワード</label>
            <select
              value={selectedKeyword}
              onChange={(e) => setSelectedKeyword(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全キーワード一括収集</option>
              {keywords.map((kw) => (
                <option key={kw.id} value={kw.id}>
                  {kw.keyword} {kw.category ? `(${kw.category})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAutoCollect}
            disabled={collectLoading || keywords.length === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {collectLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            収集開始
          </button>
        </div>

        {keywords.length === 0 && (
          <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            キーワードが登録されていません。「検索条件管理」画面でキーワードを追加してください。
          </p>
        )}

        {collectResults && (
          <div className="mt-4 space-y-3">
            {collectResults.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 flex items-center gap-2">
                  <XCircle size={16} />
                  {collectResults.error}
                </p>
              </div>
            ) : (
              <>
                {collectResults.summary && (
                  <CollectSummaryCard summary={collectResults.summary} />
                )}
                {collectResults.total_success !== undefined && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800">
                      一括収集結果: {collectResults.keywords_processed}キーワード処理
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-blue-600">
                      <span>成功: {collectResults.total_success}</span>
                      <span>除外: {collectResults.total_rejected}</span>
                      <span>重複: {collectResults.total_duplicate}</span>
                    </div>
                  </div>
                )}
                {collectResults.details?.map((d: any, i: number) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-700 mb-2">
                      キーワード: {d.keyword}
                      {d.error && <span className="text-red-600 ml-2">{d.error}</span>}
                    </p>
                    {d.results?.map((r: ScrapeResult, j: number) => (
                      <ResultRow key={j} result={r} />
                    ))}
                    {d.summary && <CollectSummaryCard summary={d.summary} />}
                  </div>
                ))}
                {collectResults.results && !collectResults.details && (
                  <div className="space-y-1">
                    {collectResults.results.map((r: ScrapeResult, i: number) => (
                      <ResultRow key={i} result={r} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

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
            <div className="mt-4 space-y-1">
              {bulkResults.map((r, i) => (
                <ResultRow key={i} result={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ result }: { result: ScrapeResult }) {
  const colors: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700",
    duplicate: "bg-amber-50 text-amber-700",
    rejected: "bg-slate-100 text-slate-600",
    error: "bg-red-50 text-red-700",
  };
  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle size={14} />,
    duplicate: <AlertTriangle size={14} />,
    rejected: <ShieldBan size={14} />,
    error: <XCircle size={14} />,
  };

  return (
    <div className={`flex items-center gap-2 text-sm p-2 rounded ${colors[result.status] || colors.error}`}>
      {icons[result.status] || icons.error}
      <span className="truncate flex-1">{result.url}</span>
      <span className="ml-auto text-xs whitespace-nowrap">{result.message || "成功"}</span>
    </div>
  );
}

function CollectSummaryCard({ summary }: { summary: CollectSummary }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p className="text-sm font-medium text-slate-700">
        「{summary.keyword}」の収集結果
      </p>
      <div className="flex gap-4 mt-1 text-xs">
        <span className="text-slate-500">検索結果: {summary.total}</span>
        <span className="text-emerald-600">成功: {summary.success}</span>
        <span className="text-slate-500">除外: {summary.rejected}</span>
        <span className="text-amber-600">重複: {summary.duplicate}</span>
        <span className="text-red-500">エラー: {summary.error}</span>
      </div>
    </div>
  );
}
