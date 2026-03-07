import { useState, useEffect, useRef } from "react";
import { Globe, Loader2, CheckCircle, XCircle, Zap, Play, Search, List, ShoppingBag, AlertTriangle, MapPin, Building2 } from "lucide-react";
import { api } from "../api";
import { ResultRow } from "../components/common";
import { useProject } from "../contexts/ProjectContext";
import type { SearchKeyword, ScrapeResult, CollectSummary } from "../types";

type CollectTab = "google-api" | "directory" | "google-scrape" | "shopify" | "google-maps" | "houjin-db";

export default function Scraper() {
  const { currentProject } = useProject();
  const [singleUrl, setSingleUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [bulkResults, setBulkResults] = useState<ScrapeResult[]>([]);
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectResults, setCollectResults] = useState<any>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<number | "all">("all");
  const [activeTab, setActiveTab] = useState<CollectTab>("google-api");
  const [progressMsg, setProgressMsg] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const [dirUrl, setDirUrl] = useState("");
  const [dirMaxPages, setDirMaxPages] = useState(3);

  const [gsKeyword, setGsKeyword] = useState("");
  const [gsRegion, setGsRegion] = useState("");
  const [gsNum, setGsNum] = useState(10);

  const [spMaxResults, setSpMaxResults] = useState(20);

  const [gmKeyword, setGmKeyword] = useState("");
  const [gmRegion, setGmRegion] = useState("東京");
  const [gmMaxResults, setGmMaxResults] = useState(20);

  const [gbizKeyword, setGbizKeyword] = useState("");
  const [gbizPrefecture, setGbizPrefecture] = useState("");
  const [gbizMaxResults, setGbizMaxResults] = useState(20);

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
    setProgressMsg("収集を開始しています...");
    setProgressCurrent(0);
    setProgressTotal(0);

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    try {
      const params: { keyword_id?: number; project_id?: number } = {};
      if (selectedKeyword !== "all") params.keyword_id = selectedKeyword;
      if (currentProject?.id) params.project_id = currentProject.id;
      const { job_id } = await api.collector.startAsync(params);

      const es = new EventSource(`/api/collect/progress/${job_id}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.message) setProgressMsg(msg.message);
          if (msg.current !== undefined) setProgressCurrent(msg.current);
          if (msg.total !== undefined) setProgressTotal(msg.total);
          if (msg.type === "done") {
            setCollectResults(msg.result);
            setProgressMsg("");
            setCollectLoading(false);
            es.close();
          } else if (msg.type === "error") {
            setCollectResults({ error: msg.message });
            setProgressMsg("");
            setCollectLoading(false);
            es.close();
          }
        } catch {}
      };
      es.onerror = () => {
        setCollectResults({ error: "接続エラーが発生しました" });
        setProgressMsg("");
        setCollectLoading(false);
        es.close();
      };
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
      setProgressMsg("");
      setCollectLoading(false);
    }
  };

  const handleDirectoryCollect = async () => {
    if (!dirUrl.trim()) return;
    setCollectLoading(true);
    setCollectResults(null);
    try {
      const data = await api.collector.directory(dirUrl, dirMaxPages);
      setCollectResults(data);
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
    }
    setCollectLoading(false);
  };

  const handleGoogleScrape = async () => {
    if (!gsKeyword.trim()) return;
    setCollectLoading(true);
    setCollectResults(null);
    try {
      const data = await api.collector.googleScrape(gsKeyword, gsRegion, gsNum);
      setCollectResults(data);
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
    }
    setCollectLoading(false);
  };

  const handleShopifyCollect = async () => {
    setCollectLoading(true);
    setCollectResults(null);
    try {
      const data = await api.collector.shopifyPartners(spMaxResults);
      setCollectResults(data);
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
    }
    setCollectLoading(false);
  };

  const handleGoogleMapsCollect = async () => {
    if (!gmKeyword.trim()) return;
    setCollectLoading(true);
    setCollectResults(null);
    try {
      const data = await api.collector.googleMaps(gmKeyword, gmRegion, gmMaxResults);
      setCollectResults(data);
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
    }
    setCollectLoading(false);
  };

  const handleGbizCollect = async () => {
    if (!gbizKeyword.trim()) return;
    setCollectLoading(true);
    setCollectResults(null);
    setProgressMsg("");
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const { job_id } = await api.collector.startGbiz({
        project_id: currentProject?.id,
        keyword: gbizKeyword,
        prefecture: gbizPrefecture,
        max_results: gbizMaxResults,
      });
      const es = new EventSource(`/api/collect/progress/${job_id}`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.message) setProgressMsg(msg.message);
          if (msg.current !== undefined) setProgressCurrent(msg.current);
          if (msg.total !== undefined) setProgressTotal(msg.total);
          if (msg.type === "done") {
            setCollectResults(msg.result);
            setProgressMsg("");
            setCollectLoading(false);
            es.close();
          } else if (msg.type === "error") {
            setCollectResults({ error: msg.message });
            setProgressMsg("");
            setCollectLoading(false);
            es.close();
          }
        } catch {}
      };
      es.onerror = () => {
        setCollectResults({ error: "接続エラーが発生しました" });
        setProgressMsg("");
        setCollectLoading(false);
        es.close();
      };
    } catch (err: any) {
      setCollectResults({ error: err.response?.data?.detail || "収集エラーが発生しました" });
      setProgressMsg("");
      setCollectLoading(false);
    }
  };

  const tabs: { key: CollectTab; label: string; icon: typeof Zap }[] = [
    { key: "google-api", label: "Google API検索", icon: Zap },
    { key: "directory", label: "ディレクトリ収集", icon: List },
    { key: "google-scrape", label: "Google直接検索", icon: Search },
    { key: "shopify", label: "Shopifyパートナー", icon: ShoppingBag },
    { key: "google-maps", label: "Googleマップ", icon: MapPin },
    { key: "houjin-db", label: "法人DB", icon: Building2 },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">URL収集・スクレイピング</h2>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setCollectResults(null); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {activeTab === "google-api" && (
            <GoogleApiSection
              keywords={keywords}
              selectedKeyword={selectedKeyword}
              onSelectKeyword={setSelectedKeyword}
              loading={collectLoading}
              onCollect={handleAutoCollect}
              progressMsg={progressMsg}
              progressCurrent={progressCurrent}
              progressTotal={progressTotal}
            />
          )}

          {activeTab === "directory" && (
            <DirectorySection
              url={dirUrl}
              onUrlChange={setDirUrl}
              maxPages={dirMaxPages}
              onMaxPagesChange={setDirMaxPages}
              loading={collectLoading}
              onCollect={handleDirectoryCollect}
            />
          )}

          {activeTab === "google-scrape" && (
            <GoogleScrapeSection
              keyword={gsKeyword}
              onKeywordChange={setGsKeyword}
              region={gsRegion}
              onRegionChange={setGsRegion}
              num={gsNum}
              onNumChange={setGsNum}
              loading={collectLoading}
              onCollect={handleGoogleScrape}
            />
          )}

          {activeTab === "shopify" && (
            <ShopifySection
              maxResults={spMaxResults}
              onMaxResultsChange={setSpMaxResults}
              loading={collectLoading}
              onCollect={handleShopifyCollect}
            />
          )}

          {activeTab === "google-maps" && (
            <GoogleMapsSection
              keyword={gmKeyword}
              onKeywordChange={setGmKeyword}
              region={gmRegion}
              onRegionChange={setGmRegion}
              maxResults={gmMaxResults}
              onMaxResultsChange={setGmMaxResults}
              loading={collectLoading}
              onCollect={handleGoogleMapsCollect}
            />
          )}

          {activeTab === "houjin-db" && (
            <GbizSection
              keyword={gbizKeyword}
              onKeywordChange={setGbizKeyword}
              prefecture={gbizPrefecture}
              onPrefectureChange={setGbizPrefecture}
              maxResults={gbizMaxResults}
              onMaxResultsChange={setGbizMaxResults}
              loading={collectLoading}
              onCollect={handleGbizCollect}
              progressMsg={progressMsg}
              progressCurrent={progressCurrent}
              progressTotal={progressTotal}
            />
          )}

          <CollectResultsDisplay results={collectResults} />
        </div>
      </div>

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

function GoogleApiSection({
  keywords, selectedKeyword, onSelectKeyword, loading, onCollect, progressMsg, progressCurrent, progressTotal,
}: {
  keywords: SearchKeyword[];
  selectedKeyword: number | "all";
  onSelectKeyword: (v: number | "all") => void;
  loading: boolean;
  onCollect: () => void;
  progressMsg?: string;
  progressCurrent?: number;
  progressTotal?: number;
}) {
  const pct = progressTotal && progressTotal > 0 ? Math.round((progressCurrent! / progressTotal) * 100) : 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        登録済みの検索キーワードを使ってGoogle Custom Search APIで候補企業を自動収集します。
        APIキーが必要です（設定画面で登録）。
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
      {loading && progressMsg && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{progressMsg}</span>
            {progressTotal && progressTotal > 0 && (
              <span>{progressCurrent}/{progressTotal}</span>
            )}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: progressTotal && progressTotal > 0 ? `${pct}%` : "100%" }}
            />
          </div>
        </div>
      )}
      {keywords.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
          キーワードが登録されていません。「検索条件管理」画面でキーワードを追加してください。
        </p>
      )}
    </div>
  );
}

function DirectorySection({
  url, onUrlChange, maxPages, onMaxPagesChange, loading, onCollect,
}: {
  url: string; onUrlChange: (v: string) => void;
  maxPages: number; onMaxPagesChange: (v: number) => void;
  loading: boolean; onCollect: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        企業一覧ページ・ディレクトリサイトのURLを指定すると、掲載されている外部リンクから企業情報を自動収集します。
        ページネーションにも対応しています。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">ディレクトリページURL</label>
          <input
            type="text"
            placeholder="https://example.com/company-list"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">最大ページ数</label>
          <select
            value={maxPages}
            onChange={(e) => onMaxPagesChange(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{n}ページ</option>
            ))}
          </select>
        </div>
        <button
          onClick={onCollect}
          disabled={loading || !url.trim()}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <List size={16} />}
          収集開始
        </button>
      </div>
    </div>
  );
}

function GoogleScrapeSection({
  keyword, onKeywordChange, region, onRegionChange, num, onNumChange, loading, onCollect,
}: {
  keyword: string; onKeywordChange: (v: string) => void;
  region: string; onRegionChange: (v: string) => void;
  num: number; onNumChange: (v: number) => void;
  loading: boolean; onCollect: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Google検索結果ページを直接スクレイピングして企業を収集します。APIキー不要・無料で利用できます。
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Google検索結果の直接スクレイピングはGoogleの利用規約に抵触する可能性があります。
          過度なアクセスはIPブロックの原因になります。適度な間隔で利用してください。
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">検索キーワード</label>
          <input
            type="text"
            placeholder="Shopify 制作会社"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">地域</label>
            <input
              type="text"
              placeholder="東京"
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">件数</label>
            <select
              value={num}
              onChange={(e) => onNumChange(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>{n}件</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={onCollect}
          disabled={loading || !keyword.trim()}
          className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          検索収集
        </button>
      </div>
    </div>
  );
}

function ShopifySection({
  maxResults, onMaxResultsChange, loading, onCollect,
}: {
  maxResults: number; onMaxResultsChange: (v: number) => void;
  loading: boolean; onCollect: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Shopifyパートナーディレクトリおよび関連検索結果から、日本のShopifyパートナー企業を自動収集します。
      </p>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">最大取得件数</label>
          <select
            value={maxResults}
            onChange={(e) => onMaxResultsChange(Number(e.target.value))}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>{n}件</option>
            ))}
          </select>
        </div>
        <button
          onClick={onCollect}
          disabled={loading}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
          Shopifyパートナー収集
        </button>
      </div>
    </div>
  );
}

function GoogleMapsSection({
  keyword, onKeywordChange, region, onRegionChange, maxResults, onMaxResultsChange, loading, onCollect,
}: {
  keyword: string; onKeywordChange: (v: string) => void;
  region: string; onRegionChange: (v: string) => void;
  maxResults: number; onMaxResultsChange: (v: number) => void;
  loading: boolean; onCollect: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Google Places APIを使ってGoogleマップ上の企業情報を収集します。
        住所・電話番号・レビュー評価なども取得できます。APIキーが必要です（設定画面で登録）。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">検索キーワード</label>
          <input
            type="text"
            placeholder="Shopify 制作会社"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">地域</label>
            <input
              type="text"
              placeholder="東京"
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">件数</label>
            <select
              value={maxResults}
              onChange={(e) => onMaxResultsChange(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 40, 60].map((n) => (
                <option key={n} value={n}>{n}件</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={onCollect}
          disabled={loading || !keyword.trim()}
          className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
          マップ検索
        </button>
      </div>
    </div>
  );
}

const PREFECTURES_JP = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

function GbizSection({
  keyword, onKeywordChange, prefecture, onPrefectureChange,
  maxResults, onMaxResultsChange, loading, onCollect,
  progressMsg, progressCurrent, progressTotal,
}: {
  keyword: string; onKeywordChange: (v: string) => void;
  prefecture: string; onPrefectureChange: (v: string) => void;
  maxResults: number; onMaxResultsChange: (v: number) => void;
  loading: boolean; onCollect: () => void;
  progressMsg?: string; progressCurrent?: number; progressTotal?: number;
}) {
  const pct = progressTotal && progressTotal > 0 ? Math.round((progressCurrent! / progressTotal) * 100) : 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        経済産業省の <strong>gBizINFO</strong>（約400万社）から法人リストを取得し、
        各社のホームページを探索してスクレイピングします。ゴミデータが混入しない高品質な収集が可能です。
        APIトークンが必要です（
        <a href="https://info.gbiz.go.jp/api/index.html" target="_blank" rel="noreferrer" className="text-blue-600 underline">
          無料・即時発行
        </a>
        。取得後は設定画面で登録してください）。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">会社名キーワード（部分一致）</label>
          <input
            type="text"
            placeholder="例: コンサルティング、EC、デジタル"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">都道府県</label>
          <select
            value={prefecture}
            onChange={(e) => onPrefectureChange(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全国</option>
            {PREFECTURES_JP.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">最大件数</label>
          <select
            value={maxResults}
            onChange={(e) => onMaxResultsChange(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}件</option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={onCollect}
        disabled={loading || !keyword.trim()}
        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
        法人DB収集開始
      </button>
      {loading && progressMsg && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{progressMsg}</span>
            {progressTotal && progressTotal > 0 && (
              <span>{progressCurrent}/{progressTotal}</span>
            )}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: progressTotal && progressTotal > 0 ? `${pct}%` : "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CollectResultsDisplay({ results }: { results: any }) {
  if (!results) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
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

function CollectSummaryCard({ summary }: { summary: any }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p className="text-sm font-medium text-slate-700">
        {summary.keyword ? `「${summary.keyword}」の収集結果` : `収集結果（${summary.source || ""}）`}
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
