import { useState, useEffect } from "react";
import { Globe, Loader2, CheckCircle, XCircle, Zap, Play } from "lucide-react";
import { api } from "../api";
import { ResultRow } from "../components/common";
import type { SearchKeyword, ScrapeResult, CollectSummary } from "../types";

export default function Scraper() {
  const [singleUrl, setSingleUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [bulkResults, setBulkResults] = useState<ScrapeResult[]>([]);
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectResults, setCollectResults] = useState<any>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<number | "all">("all");

  useEffect(() => {
    api.keywords.list().then((data) => {
      setKeywords(data.keywords.filter((k) => k.is_active));
    });
  }, []);

  const handleSingleScrape = async () => {
    if (!singleUrl.trim()) return;
    setLoading(true);
    setSingleResult(null);
    try {
      const data = await api.scraper.single(singleUrl);
      setSingleResult(data);
    } catch (err: any) {
      setSingleResult({ error: err.response?.data?.detail || "エラーが発生しました" });
    }
    setLoading(false);
  };

  const handleBulkScrape = async () => {
    const urls = bulkUrls.split("\n").map((u) => u.trim()).filter((u) => u);
    if (urls.length === 0) return;
    setLoading(true);
    setBulkResults([]);
    try {
      const data = await api.scraper.bulk(urls);
      setBulkResults(data.results);
    } catch {
      setBulkResults([{ url: "", status: "error", message: "エラーが発生しました" }]);
    }
    setLoading(false);
  };

  const handleAutoCollect = async () => {
    setCollectLoading(true);
    setCollectResults(null);
    try {
      const data = selectedKeyword === "all"
        ? await api.collector.all()
        : await api.collector.single(selectedKeyword);
      setCollectResults(data);
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
    }
    setCollectLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">URL収集・スクレイピング</h2>

      <AutoCollectSection
        keywords={keywords}
        selectedKeyword={selectedKeyword}
        onSelectKeyword={setSelectedKeyword}
        loading={collectLoading}
        results={collectResults}
        onCollect={handleAutoCollect}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SingleScrapeSection
          url={singleUrl}
          onUrlChange={setSingleUrl}
          loading={loading}
          result={singleResult}
          onScrape={handleSingleScrape}
        />
        <BulkScrapeSection
          urls={bulkUrls}
          onUrlsChange={setBulkUrls}
          loading={loading}
          results={bulkResults}
          onScrape={handleBulkScrape}
        />
      </div>
    </div>
  );
}

function AutoCollectSection({
  keywords, selectedKeyword, onSelectKeyword, loading, results, onCollect,
}: {
  keywords: SearchKeyword[];
  selectedKeyword: number | "all";
  onSelectKeyword: (v: number | "all") => void;
  loading: boolean;
  results: any;
  onCollect: () => void;
}) {
  return (
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
            onChange={(e) => onSelectKeyword(e.target.value === "all" ? "all" : Number(e.target.value))}
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
          onClick={onCollect}
          disabled={loading || keywords.length === 0}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          収集開始
        </button>
      </div>

      {keywords.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
          キーワードが登録されていません。「検索条件管理」画面でキーワードを追加してください。
        </p>
      )}

      {results && (
        <div className="mt-4 space-y-3">
          {results.error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <XCircle size={16} />
                {results.error}
              </p>
            </div>
          ) : (
            <>
              {results.summary && <CollectSummaryCard summary={results.summary} />}
              {results.total_success !== undefined && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-800">
                    一括収集結果: {results.keywords_processed}キーワード処理
                  </p>
                  <div className="flex gap-4 mt-1 text-xs text-blue-600">
                    <span>成功: {results.total_success}</span>
                    <span>除外: {results.total_rejected}</span>
                    <span>重複: {results.total_duplicate}</span>
                  </div>
                </div>
              )}
              {results.details?.map((d: any, i: number) => (
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
              {results.results && !results.details && (
                <div className="space-y-1">
                  {results.results.map((r: ScrapeResult, i: number) => (
                    <ResultRow key={i} result={r} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SingleScrapeSection({
  url, onUrlChange, loading, result, onScrape,
}: {
  url: string; onUrlChange: (v: string) => void; loading: boolean; result: any; onScrape: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
        <Globe size={18} />
        単一URL取得
      </h3>
      <p className="text-sm text-slate-500">企業サイトのURLを入力すると、会社情報を自動で抽出・登録します。</p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && onScrape()}
        />
        <button
          onClick={onScrape}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
          取得
        </button>
      </div>

      {result && (
        <div className="mt-4">
          {result.error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <XCircle size={16} />
                {result.error}
              </p>
            </div>
          ) : result.company ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-emerald-700 flex items-center gap-2 font-medium">
                <CheckCircle size={16} />
                企業情報を取得・登録しました
              </p>
              <div className="text-sm text-slate-600 space-y-1">
                <p><span className="font-medium">会社名:</span> {result.company.company_name || "未取得"}</p>
                <p><span className="font-medium">ドメイン:</span> {result.company.domain}</p>
                <p><span className="font-medium">カテゴリ:</span> {result.company.category_main || "未分類"}</p>
                <p><span className="font-medium">スコア:</span> {result.company.score_total}点 (ランク{result.company.score_rank})</p>
                <p><span className="font-medium">問い合わせ:</span> {result.company.contact_url ? "あり" : "なし"}</p>
                <p><span className="font-medium">電話:</span> {result.company.phone || "未取得"}</p>
                <p><span className="font-medium">所在地:</span> {result.company.prefecture || "未取得"}{result.company.city || ""}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BulkScrapeSection({
  urls, onUrlsChange, loading, results, onScrape,
}: {
  urls: string; onUrlsChange: (v: string) => void; loading: boolean; results: ScrapeResult[]; onScrape: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
        <Globe size={18} />
        一括URL取得
      </h3>
      <p className="text-sm text-slate-500">複数のURLを1行ずつ入力して、一括で企業情報を取得します。</p>
      <textarea
        placeholder={"https://example1.com\nhttps://example2.com\nhttps://example3.com"}
        value={urls}
        onChange={(e) => onUrlsChange(e.target.value)}
        rows={6}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={onScrape}
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
        一括取得
      </button>

      {results.length > 0 && (
        <div className="mt-4 space-y-1">
          {results.map((r, i) => (
            <ResultRow key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectSummaryCard({ summary }: { summary: CollectSummary }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p className="text-sm font-medium text-slate-700">「{summary.keyword}」の収集結果</p>
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
