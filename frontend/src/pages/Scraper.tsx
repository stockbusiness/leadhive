import { useState, useEffect, useRef } from "react";
import { Globe, Loader2, CheckCircle, XCircle, Zap, Play, List, ShoppingBag, MapPin, Building2, Search, ChevronDown, ChevronUp, DatabaseZap, ShieldBan, ExternalLink, AlertTriangle, Store } from "lucide-react";
import { Link } from "react-router-dom";
import HelpTooltip from "../components/HelpTooltip";
import { api } from "../api";
import { ResultRow } from "../components/common";
import { useProject } from "../contexts/ProjectContext";
import type { SearchKeyword, ScrapeResult, CollectSummary } from "../types";

type CollectTab = "google-api" | "ec-search" | "directory" | "shopify" | "google-maps" | "houjin-db" | "enrich";

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

  const [spMaxResults, setSpMaxResults] = useState(20);

  const [gmKeyword, setGmKeyword] = useState("");
  const [gmRegion, setGmRegion] = useState("東京");
  const [gmMaxResults, setGmMaxResults] = useState(20);

  const [gbizKeyword, setGbizKeyword] = useState("");
  const [gbizPrefecture, setGbizPrefecture] = useState("");
  const [gbizMaxResults, setGbizMaxResults] = useState(20);

  const [ecSearchKeyword, setEcSearchKeyword] = useState("");
  const [ecSearchNumResults, setEcSearchNumResults] = useState(100);
  const [ecSearchModifier, setEcSearchModifier] = useState("通販 ネットショップ");

  type StagedUrl = {
    id: string; url: string; name: string; source: string; selected: boolean; location?: string;
    address?: string; phone?: string; rating?: number; user_ratings_total?: number; has_url?: boolean;
    excluded?: boolean; exclude_reason?: string | null;
  };
  const [stagedUrls, setStagedUrls] = useState<StagedUrl[]>([]);
  const [activeCollectType, setActiveCollectType] = useState<string>("");
  const [stagingLoading, setStagingLoading] = useState(false);
  const [stagingError, setStagingError] = useState<string | null>(null);
  const [scrapeInProgress, setScrapeInProgress] = useState(false);
  const [scrapeProgressMsg, setScrapeProgressMsg] = useState("");
  const [scrapeProgressCurrent, setScrapeProgressCurrent] = useState(0);
  const [scrapeProgressTotal, setScrapeProgressTotal] = useState(0);
  const [scrapeResults, setScrapeResults] = useState<any>(null);
  const [searchEngine, setSearchEngine] = useState<{ active_engine: string; has_serper: boolean; has_google: boolean } | null>(null);

  useEffect(() => {
    api.keywords.list().then((data) => {
      setKeywords(data.keywords.filter((k) => k.is_active));
    });
    api.collector.searchEngineStatus().then(setSearchEngine).catch(() => {});
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

  const handleCollectUrls = async (type: string, extraParams: Record<string, unknown> = {}) => {
    setStagingLoading(true);
    setStagingError(null);
    setStagedUrls([]);
    setScrapeResults(null);
    setActiveCollectType(type);
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    try {
      const data = await api.collector.urlsPreview({ type, ...extraParams, project_id: currentProject?.id });
      if (data.error) {
        setStagingError(data.error);
      } else {
        setStagedUrls(
          data.urls.map((u: any, i: number) => ({
            ...u,
            id: `${i}-${u.url || u.name}`,
            selected: u.has_url !== false && !u.excluded,
          }))
        );
      }
    } catch (err: any) {
      setStagingError(err.response?.data?.detail || "URL収集エラーが発生しました");
    }
    setStagingLoading(false);
  };

  const handleScrapeStaged = async () => {
    const selected = stagedUrls.filter((u) => u.selected && u.url);
    if (!selected.length) return;
    setScrapeInProgress(true);
    setScrapeResults(null);
    setScrapeProgressMsg("スクレイピングを開始しています...");
    setScrapeProgressCurrent(0);
    setScrapeProgressTotal(selected.length);
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    try {
      const { job_id } = await api.collector.scrapeStaged(selected, currentProject?.id);
      const es = new EventSource(`/api/collect/progress/${job_id}`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.message) setScrapeProgressMsg(msg.message);
          if (msg.current !== undefined) setScrapeProgressCurrent(msg.current);
          if (msg.total !== undefined) setScrapeProgressTotal(msg.total);
          if (msg.type === "done") {
            setScrapeResults(msg.result);
            setScrapeProgressMsg("");
            setScrapeInProgress(false);
            es.close();
          } else if (msg.type === "error") {
            setScrapeResults({ error: msg.message });
            setScrapeProgressMsg("");
            setScrapeInProgress(false);
            es.close();
          }
        } catch {}
      };
      es.onerror = () => {
        setScrapeResults({ error: "接続エラーが発生しました" });
        setScrapeProgressMsg("");
        setScrapeInProgress(false);
        es.close();
      };
    } catch (err: any) {
      setScrapeResults({ error: err.response?.data?.detail || "スクレイピングエラーが発生しました" });
      setScrapeProgressMsg("");
      setScrapeInProgress(false);
    }
  };

  const handleScrapeOne = async (url: string) => {
    try {
      const data = await api.scraper.single(url);
      setScrapeResults((prev: any) => ({
        results: [...(prev?.results || []), { url, status: data.status || "success", message: data.company_name || url, company_id: data.company_id }],
        summary: { ...(prev?.summary || {}), success: (prev?.summary?.success || 0) + 1 },
      }));
    } catch (err: any) {
      setScrapeResults((prev: any) => ({
        results: [...(prev?.results || []), { url, status: "error", message: err.response?.data?.detail || "エラー" }],
      }));
    }
  };

  const toggleAll = (checked: boolean) => setStagedUrls((prev) => prev.map((u) => ({ ...u, selected: u.has_url === false ? false : checked })));
  const toggleOne = (id: string) => setStagedUrls((prev) => prev.map((u) => u.id === id ? { ...u, selected: !u.selected } : u));

  const tabs: { key: CollectTab; label: string; icon: typeof Zap }[] = [
    { key: "google-api", label: "Google API検索", icon: Zap },
    { key: "ec-search", label: "ECサイト検索", icon: Store },
    { key: "directory", label: "ディレクトリ収集", icon: List },
    { key: "shopify", label: "Shopifyパートナー", icon: ShoppingBag },
    { key: "google-maps", label: "Googleマップ", icon: MapPin },
    { key: "houjin-db", label: "法人DB", icon: Building2 },
    { key: "enrich", label: "情報補完", icon: DatabaseZap },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-800">URL収集・スクレイピング</h2>
        <HelpTooltip text="キーワードや業種に基づいて企業のウェブサイトURLを自動収集します。GoogleまたはSerperのAPIキーが必要です。" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setCollectResults(null); setStagedUrls([]); setStagingError(null); setScrapeResults(null); setActiveCollectType(""); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.key === "google-api" && searchEngine && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  searchEngine.active_engine === "serper"
                    ? "bg-emerald-100 text-emerald-700"
                    : searchEngine.active_engine === "google"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-red-100 text-red-600"
                }`}>
                  {searchEngine.active_engine === "serper" ? "Serper" : searchEngine.active_engine === "google" ? "Google" : "未設定"}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {activeTab === "google-api" && (
            <GoogleApiSection
              keywords={keywords}
              selectedKeyword={selectedKeyword}
              onSelectKeyword={setSelectedKeyword}
              loading={stagingLoading}
              onCollect={() => handleCollectUrls("google-api", {
                keyword_id: selectedKeyword !== "all" ? selectedKeyword : undefined,
              })}
            />
          )}

          {activeTab === "ec-search" && (
            <EcSearchSection
              keyword={ecSearchKeyword}
              onKeywordChange={setEcSearchKeyword}
              numResults={ecSearchNumResults}
              onNumResultsChange={setEcSearchNumResults}
              modifier={ecSearchModifier}
              onModifierChange={setEcSearchModifier}
              loading={stagingLoading}
              onCollect={() => handleCollectUrls("ec-search", {
                keyword: ecSearchKeyword,
                num_results: ecSearchNumResults,
                ec_modifier: ecSearchModifier,
              })}
            />
          )}

          {activeTab === "directory" && (
            <DirectorySection
              url={dirUrl}
              onUrlChange={setDirUrl}
              maxPages={dirMaxPages}
              onMaxPagesChange={setDirMaxPages}
              loading={stagingLoading}
              onCollect={() => handleCollectUrls("directory", { url: dirUrl, max_pages: dirMaxPages })}
            />
          )}

          {activeTab === "shopify" && (
            <ShopifySection
              maxResults={spMaxResults}
              onMaxResultsChange={setSpMaxResults}
              loading={stagingLoading}
              onCollect={() => handleCollectUrls("shopify", { max_results: spMaxResults })}
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
              loading={stagingLoading}
              onCollect={() => handleCollectUrls("google-maps", { keyword: gmKeyword, region: gmRegion, max_results: gmMaxResults })}
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
              loading={stagingLoading}
              onCollect={() => handleCollectUrls("houjin-db", { keyword: gbizKeyword, prefecture: gbizPrefecture, max_results: gbizMaxResults })}
            />
          )}

          {activeTab === "enrich" && (
            <EnrichSection
              projectId={currentProject?.id}
              esRef={esRef}
            />
          )}

          {stagingError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <XCircle size={16} className="flex-shrink-0" />
              {stagingError}
            </div>
          )}
        </div>
      </div>

      {stagedUrls.length > 0 && (
        activeCollectType === "google-maps" ? (
          <GmStagingCards
            urls={stagedUrls}
            onToggleAll={toggleAll}
            onToggleOne={toggleOne}
            onScrapeSelected={handleScrapeStaged}
            scrapeInProgress={scrapeInProgress}
            scrapeProgressMsg={scrapeProgressMsg}
            scrapeProgressCurrent={scrapeProgressCurrent}
            scrapeProgressTotal={scrapeProgressTotal}
            scrapeResults={scrapeResults}
          />
        ) : (
          <StagingTable
            urls={stagedUrls}
            onToggleAll={toggleAll}
            onToggleOne={toggleOne}
            onScrapeSelected={handleScrapeStaged}
            onScrapeOne={handleScrapeOne}
            scrapeInProgress={scrapeInProgress}
            scrapeProgressMsg={scrapeProgressMsg}
            scrapeProgressCurrent={scrapeProgressCurrent}
            scrapeProgressTotal={scrapeProgressTotal}
            scrapeResults={scrapeResults}
          />
        )
      )}

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
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          URLを収集
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
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          URLを収集
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
        Google Custom Search APIを使い、日本のShopifyパートナー・EC制作会社を自動収集します。
        事前に設定画面でGoogle APIキーとSearch Engine IDの登録が必要です。
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
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          URLを収集
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
        Google Places APIを使ってGoogleマップ上の企業情報をプレビュー収集します。
        住所・電話番号・評価が一覧表示されるので、保存したい企業を選択してスクレイピング保存できます。
        APIキーが必要です（設定画面で登録）。
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
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          マップで検索
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
        経済産業省の <strong>gBizINFO</strong>（約400万社）から企業名・住所を取得し、
        HPが未登録の企業はGoogle検索でサイトURLを自動検索します。
        URLが揃ったらステージング一覧でスクレイピング対象を確認・選択できます。
        <span className="text-amber-600 font-medium">※企業数に応じて数十秒かかる場合があります。</span>
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
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        URLを収集
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

function EcSearchSection({
  keyword, onKeywordChange, numResults, onNumResultsChange,
  modifier, onModifierChange, loading, onCollect,
}: {
  keyword: string; onKeywordChange: (v: string) => void;
  numResults: number; onNumResultsChange: (v: number) => void;
  modifier: string; onModifierChange: (v: string) => void;
  loading: boolean; onCollect: () => void;
}) {
  const EC_MODIFIERS = [
    { label: "通販・ネットショップ（汎用）", value: "通販 ネットショップ" },
    { label: "自社EC（独自ドメイン重視）", value: "自社EC 通販サイト" },
    { label: "Shopify利用企業", value: "Shopify 通販" },
    { label: "食品・産直EC", value: "食品 産直 通販" },
    { label: "アパレル・ファッションEC", value: "ファッション 通販 EC" },
    { label: "コスメ・美容EC", value: "コスメ 美容 通販" },
    { label: "BtoB・業務用EC", value: "業務用 法人向け 通販" },
    { label: "D2Cブランド", value: "D2C ブランド 通販" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
        <Store size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-slate-600">
          業種・商材キーワードにEC修飾語を組み合わせてSerper APIで検索し、ECサイトのURLをまとめて収集します。
          まとめサイト・比較サイトは自動的に除外候補として表示されます。
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">業種・商材キーワード</label>
          <input
            type="text"
            placeholder="例: アパレル、食品、コスメ、インテリア"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && keyword.trim() && !loading && onCollect()}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">EC検索モード</label>
          <select
            value={modifier}
            onChange={(e) => onModifierChange(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {EC_MODIFIERS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">最大取得件数</label>
          <select
            value={numResults}
            onChange={(e) => onNumResultsChange(Number(e.target.value))}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {[50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}件</option>
            ))}
          </select>
        </div>
        <button
          onClick={onCollect}
          disabled={loading || !keyword.trim()}
          className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
          ECサイトを収集
        </button>
        {!keyword.trim() && (
          <p className="text-xs text-slate-400">キーワードを入力してください</p>
        )}
      </div>
    </div>
  );
}

function EnrichSection({
  projectId,
  esRef,
}: {
  projectId?: number;
  esRef: React.MutableRefObject<EventSource | null>;
}) {
  const [noUrlCount, setNoUrlCount] = useState<number | null>(null);
  const [maxItems, setMaxItems] = useState(20);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api.collector.enrichCount(projectId).then((r) => setNoUrlCount(r.count)).catch(() => setNoUrlCount(null));
  }, [projectId]);

  const handleStart = async () => {
    if (!projectId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setProgressMsg("情報補完処理を開始しています...");
    setProgressCurrent(0);
    setProgressTotal(0);
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    try {
      const { job_id } = await api.collector.enrichStart({ project_id: projectId, max_items: maxItems });
      const es = new EventSource(`/api/collect/progress/${job_id}`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.message) setProgressMsg(msg.message);
          if (msg.current !== undefined) setProgressCurrent(msg.current);
          if (msg.total !== undefined) setProgressTotal(msg.total);
          if (msg.type === "done") {
            setResult(msg.result);
            setProgressMsg("");
            setLoading(false);
            es.close();
            api.collector.enrichCount(projectId).then((r) => setNoUrlCount(r.count)).catch(() => {});
          } else if (msg.type === "error") {
            setError(msg.message);
            setProgressMsg("");
            setLoading(false);
            es.close();
          }
        } catch {}
      };
      es.onerror = () => {
        setError("接続エラーが発生しました");
        setProgressMsg("");
        setLoading(false);
        es.close();
      };
    } catch (err: any) {
      setError(err.response?.data?.detail || "補完処理の開始に失敗しました");
      setProgressMsg("");
      setLoading(false);
    }
  };

  const pct = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <DatabaseZap size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">URLなし企業の情報を自動補完</p>
            <p className="text-xs text-blue-600 mt-1 leading-relaxed">
              gBizINFOや法人DBから会社名・住所のみで登録された企業を対象に、公式サイトのURLを自動検索してスクレイピングします。<br />
              ① 法人番号でgBizINFO再検索 → ② Google検索でURL探索 → ③ スクレイピングで情報補完
            </p>
          </div>
        </div>
      </div>

      {noUrlCount !== null && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 ${
          noUrlCount === 0
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}>
          {noUrlCount === 0 ? (
            <><CheckCircle size={15} />このプロジェクトにURLなし企業はありません</>
          ) : (
            <><DatabaseZap size={15} />現在 <strong className="mx-1">{noUrlCount}件</strong> のURLなし企業があります</>
          )}
        </div>
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">最大処理件数</label>
          <select
            value={maxItems}
            onChange={(e) => setMaxItems(Number(e.target.value))}
            disabled={loading}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}件</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleStart}
          disabled={loading || noUrlCount === 0}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <DatabaseZap size={16} />}
          補完処理を開始
        </button>
      </div>

      {loading && progressMsg && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{progressMsg}</span>
            {progressTotal > 0 && <span>{progressCurrent}/{progressTotal}</span>}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: progressTotal > 0 ? `${pct}%` : "100%" }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <XCircle size={16} className="flex-shrink-0" />{error}
        </div>
      )}

      {result && (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CheckCircle size={15} className="text-green-600" />補完処理完了
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "補完成功", value: result.success, color: "text-green-600" },
              { label: "URL発見", value: result.found_url, color: "text-blue-600" },
              { label: "URL不明", value: result.no_url, color: "text-amber-600" },
              { label: "エラー", value: result.error, color: "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
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

type StagedUrlItem = {
  id: string; url: string; name: string; source: string; selected: boolean; location?: string;
  address?: string; phone?: string; rating?: number; user_ratings_total?: number; has_url?: boolean;
  excluded?: boolean; exclude_reason?: string | null;
};

function GmStagingCards({
  urls, onToggleAll, onToggleOne, onScrapeSelected,
  scrapeInProgress, scrapeProgressMsg, scrapeProgressCurrent, scrapeProgressTotal, scrapeResults,
}: {
  urls: StagedUrlItem[];
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onScrapeSelected: () => void;
  scrapeInProgress: boolean;
  scrapeProgressMsg: string;
  scrapeProgressCurrent: number;
  scrapeProgressTotal: number;
  scrapeResults: any;
}) {
  const [showResults, setShowResults] = useState(true);
  const eligibleUrls = urls.filter((u) => u.has_url !== false);
  const allChecked = eligibleUrls.length > 0 && eligibleUrls.every((u) => u.selected);
  const someChecked = urls.some((u) => u.selected);
  const selectedCount = urls.filter((u) => u.selected).length;
  const pct = scrapeProgressTotal > 0 ? Math.round((scrapeProgressCurrent / scrapeProgressTotal) * 100) : 0;

  const resultMap: Record<string, { status: string; message: string }> = {};
  if (scrapeResults?.results) {
    for (const r of scrapeResults.results) resultMap[r.url] = r;
  }

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      <span className="flex items-center gap-0.5 text-amber-500 text-xs">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < full ? "text-amber-400" : i === full && half ? "text-amber-300" : "text-slate-200"}>★</span>
        ))}
        <span className="ml-1 text-slate-600 font-medium">{rating.toFixed(1)}</span>
      </span>
    );
  };

  const renderResult = (url: string) => {
    const res = resultMap[url];
    if (!res) return null;
    if (res.status === "success") return <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle size={12} />保存済</span>;
    if (res.status === "duplicate") return <span className="flex items-center gap-1 text-amber-500 text-xs font-medium" title={res.message}><AlertTriangle size={12} />重複</span>;
    if (res.status === "rejected") return <span className="flex items-center gap-1 text-slate-500 text-xs font-medium" title={res.message}><ShieldBan size={12} />除外</span>;
    return <span className="flex items-center gap-1 text-red-500 text-xs font-medium" title={res.message}><XCircle size={12} />エラー</span>;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="rounded"
            />
            <MapPin size={15} className="text-red-500" />
            <span className="font-semibold text-slate-700 text-sm">Googleマップ検索結果（{urls.length}件）</span>
          </label>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {selectedCount}件選択
          </span>
        </div>
        <button
          onClick={onScrapeSelected}
          disabled={scrapeInProgress || selectedCount === 0}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {scrapeInProgress ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          選択企業を保存 ({selectedCount})
        </button>
      </div>

      {scrapeInProgress && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 space-y-1">
          <div className="flex justify-between text-xs text-red-700">
            <span>{scrapeProgressMsg}</span>
            {scrapeProgressTotal > 0 && <span>{scrapeProgressCurrent}/{scrapeProgressTotal}</span>}
          </div>
          <div className="w-full bg-red-200 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 bg-red-500 rounded-full transition-all duration-300" style={{ width: scrapeProgressTotal > 0 ? `${pct}%` : "50%" }} />
          </div>
        </div>
      )}

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {urls.map((u) => {
          const hasUrl = u.has_url !== false && u.url;
          const res = u.url ? resultMap[u.url] : undefined;
          return (
            <div
              key={u.id}
              onClick={() => hasUrl && onToggleOne(u.id)}
              className={`relative border rounded-lg p-3 transition-all cursor-pointer select-none ${
                !hasUrl
                  ? "border-slate-100 bg-slate-50 opacity-60 cursor-default"
                  : u.selected
                  ? "border-red-300 bg-red-50/40 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={u.selected}
                  disabled={!hasUrl}
                  onChange={() => hasUrl && onToggleOne(u.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 rounded flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold text-slate-800 text-sm leading-tight line-clamp-1">
                      {u.name || "名称不明"}
                    </span>
                    {res && <span className="flex-shrink-0">{renderResult(u.url)}</span>}
                  </div>

                  {u.rating !== undefined && u.rating !== null && (
                    <div className="mt-1 flex items-center gap-1">
                      {renderStars(u.rating)}
                      {u.user_ratings_total && (
                        <span className="text-xs text-slate-400">({u.user_ratings_total.toLocaleString()}件)</span>
                      )}
                    </div>
                  )}

                  {u.address && (
                    <p className="mt-1 text-xs text-slate-500 flex items-start gap-1 leading-tight">
                      <MapPin size={11} className="mt-0.5 flex-shrink-0 text-slate-400" />
                      <span className="line-clamp-2">{u.address}</span>
                    </p>
                  )}

                  {u.phone && (
                    <p className="mt-1 text-xs text-slate-600 font-medium">
                      📞 {u.phone}
                    </p>
                  )}

                  <div className="mt-2">
                    {hasUrl ? (
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 truncate"
                      >
                        <ExternalLink size={10} className="flex-shrink-0" />
                        <span className="truncate">{u.url.replace(/^https?:\/\//, "")}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">URLなし（保存対象外）</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {scrapeResults && !scrapeInProgress && (
        <div className="border-t border-slate-200">
          <button
            onClick={() => setShowResults((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {showResults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            保存結果
            {scrapeResults.summary && (
              <span className="ml-2 flex gap-3 text-xs font-normal">
                {scrapeResults.summary.success > 0 && <span className="text-emerald-600">✓ {scrapeResults.summary.success}件保存</span>}
                {scrapeResults.summary.duplicate > 0 && <span className="text-amber-500">△ {scrapeResults.summary.duplicate}件重複</span>}
                {scrapeResults.summary.error > 0 && <span className="text-red-500">✕ {scrapeResults.summary.error}件エラー</span>}
              </span>
            )}
          </button>
          {showResults && scrapeResults.error && (
            <div className="px-4 pb-3 text-sm text-red-600">{scrapeResults.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function StagingTable({
  urls, onToggleAll, onToggleOne, onScrapeSelected, onScrapeOne,
  scrapeInProgress, scrapeProgressMsg, scrapeProgressCurrent, scrapeProgressTotal, scrapeResults,
}: {
  urls: StagedUrlItem[];
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onScrapeSelected: () => void;
  onScrapeOne: (url: string) => void;
  scrapeInProgress: boolean;
  scrapeProgressMsg: string;
  scrapeProgressCurrent: number;
  scrapeProgressTotal: number;
  scrapeResults: any;
}) {
  const [showResults, setShowResults] = useState(true);
  const allChecked = urls.length > 0 && urls.every((u) => u.selected);
  const someChecked = urls.some((u) => u.selected);
  const selectedCount = urls.filter((u) => u.selected).length;
  const pct = scrapeProgressTotal > 0 ? Math.round((scrapeProgressCurrent / scrapeProgressTotal) * 100) : 0;

  const resultMap: Record<string, { status: string; message: string }> = {};
  if (scrapeResults?.results) {
    for (const r of scrapeResults.results) {
      resultMap[r.url] = r;
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-blue-600" />
          <span className="font-semibold text-slate-700 text-sm">
            URL一覧（{urls.length}件）
          </span>
          <span className="text-xs text-slate-400">— {selectedCount}件選択中</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onScrapeSelected}
            disabled={scrapeInProgress || selectedCount === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {scrapeInProgress ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            選択をスクレイピング ({selectedCount})
          </button>
        </div>
      </div>

      {scrapeInProgress && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-1">
          <div className="flex justify-between text-xs text-blue-700">
            <span>{scrapeProgressMsg}</span>
            {scrapeProgressTotal > 0 && <span>{scrapeProgressCurrent}/{scrapeProgressTotal}</span>}
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 bg-blue-600 rounded-full transition-all duration-300" style={{ width: scrapeProgressTotal > 0 ? `${pct}%` : "50%" }} />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="w-10 px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">企業名</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">URL</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">ソース</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">結果</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {urls.map((u) => {
              const res = resultMap[u.url];
              return (
                <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.selected ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={u.selected} onChange={() => onToggleOne(u.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700 max-w-[200px]">
                    <div className="truncate">{u.name || "—"}</div>
                    {u.location && <span className="text-xs text-slate-400">{u.location}</span>}
                    {u.excluded && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded" title={u.exclude_reason || "まとめサイト除外候補"}>
                        <ShieldBan size={9} /> 除外候補
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[300px]">
                    <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate block">
                      {u.url}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{u.source}</td>
                  <td className="px-3 py-2 text-center min-w-[90px]">
                    {res ? (
                      res.status === "success" ? (
                        <span className="flex items-center justify-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle size={13} /> 成功
                        </span>
                      ) : res.status === "duplicate" ? (
                        <span className="flex items-center justify-center gap-1 text-amber-500 text-xs" title={res.message || "既に登録済み"}>
                          <AlertTriangle size={13} /> 重複
                        </span>
                      ) : res.status === "rejected" ? (
                        <span className="flex flex-col items-center gap-0.5 text-slate-500 text-xs cursor-help" title={res.message || "除外"}>
                          <span className="flex items-center gap-1"><ShieldBan size={13} /> 除外</span>
                          {res.message && <span className="text-[10px] leading-tight max-w-[100px] truncate text-slate-400">{res.message}</span>}
                        </span>
                      ) : (
                        <span className="flex flex-col items-center gap-0.5 text-red-500 text-xs cursor-help" title={res.message || "エラー"}>
                          <span className="flex items-center gap-1"><XCircle size={13} /> エラー</span>
                          {res.message && <span className="text-[10px] leading-tight max-w-[100px] truncate text-red-400">{res.message}</span>}
                        </span>
                      )
                    ) : (
                      <button
                        onClick={() => onScrapeOne(u.url)}
                        disabled={scrapeInProgress}
                        className="text-xs text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
                        title="単独スクレイピング"
                      >
                        <Zap size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {scrapeResults && !scrapeInProgress && (
        <div className="border-t border-slate-200">
          <button
            onClick={() => setShowResults((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {showResults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            スクレイピング結果
            {scrapeResults.summary && (
              <span className="ml-auto text-xs text-slate-400">
                成功: {scrapeResults.summary?.success ?? 0} / エラー: {scrapeResults.summary?.error ?? 0}
              </span>
            )}
          </button>
          {showResults && (
            <div className="px-4 pb-4 space-y-2">
              {scrapeResults.error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                  <XCircle size={14} /> {scrapeResults.error}
                </div>
              )}
              {!scrapeResults.error && (scrapeResults.summary?.success ?? 0) > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle size={14} />
                    成功した <strong>{scrapeResults.summary?.success}</strong> 社は「候補企業一覧」に保存されました
                  </span>
                  <Link
                    to="/companies"
                    className="flex items-center gap-1 text-xs text-emerald-700 font-medium hover:text-emerald-900 transition-colors whitespace-nowrap ml-3"
                  >
                    候補企業一覧を確認 <ExternalLink size={12} />
                  </Link>
                </div>
              )}
              {scrapeResults.summary && <CollectSummaryCard summary={scrapeResults.summary} />}
              {scrapeResults.results?.map((r: ScrapeResult, i: number) => (
                <ResultRow key={i} result={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
