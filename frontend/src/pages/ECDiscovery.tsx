import { useState, useRef, useEffect, useCallback } from "react";
import {
  ShoppingBag, Play, CheckCircle, XCircle, Loader2, ChevronRight,
  BarChart3, RefreshCw, MapPin, ExternalLink, Globe, Info, Mail,
  ChevronDown, Search, Zap, AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import type { Company } from "../types";
import EmailCampaignModal from "../components/EmailCampaignModal";

type CategoryId =
  | "all" | "apparel" | "food" | "cosme" | "btob" | "handmade" | "interior" | "d2c" | "shopify_users"
  | "sports" | "electronics" | "toys_hobby" | "pet" | "baby_kids" | "health" | "garden" | "car_bike"
  | "jewelry" | "stationery" | "music" | "anime_game" | "craft" | "woocommerce" | "base_stores"
  | "makeshop" | "futureshop_ecbeing" | "regional_brand" | "luxury";

interface CategoryPreset {
  id: CategoryId;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const CATEGORY_PRESETS: CategoryPreset[] = [
  { id: "all",               label: "すべて",              description: "全業種のECサイトを幅広く探索",                    icon: "🌐", color: "bg-slate-100 border-slate-300 text-slate-700" },
  { id: "apparel",           label: "アパレル",            description: "レディース・メンズファッション、自社ECブランド",   icon: "👗", color: "bg-pink-50 border-pink-300 text-pink-700" },
  { id: "food",              label: "食品・グルメ",         description: "産直・お取り寄せ・定期便食品EC",                  icon: "🍱", color: "bg-orange-50 border-orange-300 text-orange-700" },
  { id: "cosme",             label: "コスメ・美容",         description: "スキンケア・化粧品D2Cブランド",                   icon: "💄", color: "bg-rose-50 border-rose-300 text-rose-700" },
  { id: "btob",              label: "BtoB EC",             description: "法人向け卸売・業務用受発注システム",               icon: "🏭", color: "bg-blue-50 border-blue-300 text-blue-700" },
  { id: "handmade",          label: "ハンドメイド",         description: "作家・手作り作品の自社販売サイト",                icon: "🎨", color: "bg-purple-50 border-purple-300 text-purple-700" },
  { id: "interior",          label: "インテリア・雑貨",     description: "家具・セレクトショップ・雑貨EC",                 icon: "🪑", color: "bg-amber-50 border-amber-300 text-amber-700" },
  { id: "d2c",               label: "D2C ブランド",        description: "直販・サブスク・定期便の自社EC",                  icon: "📦", color: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { id: "shopify_users",     label: "Shopify",             description: "Shopify導入中のEC事業者",                        icon: "🛒", color: "bg-green-50 border-green-300 text-green-700" },
  { id: "sports",            label: "スポーツ・アウトドア", description: "キャンプ・釣り・ゴルフ・フィットネス用品EC",       icon: "⛺", color: "bg-teal-50 border-teal-300 text-teal-700" },
  { id: "electronics",       label: "家電・PC・ガジェット", description: "カメラ・オーディオ・スマホ周辺機器EC",            icon: "💻", color: "bg-indigo-50 border-indigo-300 text-indigo-700" },
  { id: "toys_hobby",        label: "おもちゃ・ホビー",     description: "プラモ・フィギュア・ボードゲームEC",              icon: "🎮", color: "bg-violet-50 border-violet-300 text-violet-700" },
  { id: "pet",               label: "ペット用品",           description: "ドッグフード・ペットケア・用品EC",                icon: "🐾", color: "bg-lime-50 border-lime-300 text-lime-700" },
  { id: "baby_kids",         label: "ベビー・キッズ",       description: "子供服・知育玩具・育児用品EC",                   icon: "👶", color: "bg-sky-50 border-sky-300 text-sky-700" },
  { id: "health",            label: "健康・サプリ",         description: "プロテイン・サプリ・健康食品D2C",                 icon: "💊", color: "bg-cyan-50 border-cyan-300 text-cyan-700" },
  { id: "garden",            label: "ガーデニング・植物",   description: "観葉植物・種子・園芸用品EC",                     icon: "🌿", color: "bg-green-50 border-green-300 text-green-700" },
  { id: "car_bike",          label: "車・バイク・自転車",   description: "カー用品・バイクパーツ・自転車EC",               icon: "🚗", color: "bg-zinc-100 border-zinc-300 text-zinc-700" },
  { id: "jewelry",           label: "ジュエリー・小物",     description: "アクセサリー・時計・バッグ・財布EC",             icon: "💎", color: "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-700" },
  { id: "stationery",        label: "文具・ステーショナリー", description: "手帳・ペン・ラッピング・画材EC",               icon: "✏️", color: "bg-yellow-50 border-yellow-300 text-yellow-700" },
  { id: "music",             label: "楽器・音楽機材",       description: "ギター・DTM機材・音響機器EC",                    icon: "🎸", color: "bg-red-50 border-red-300 text-red-700" },
  { id: "anime_game",        label: "アニメ・ゲーム",       description: "フィギュア・グッズ・コスプレ・トレカEC",          icon: "🎌", color: "bg-pink-50 border-pink-200 text-pink-800" },
  { id: "craft",             label: "工芸品・伝統工芸",     description: "漆器・陶芸・染め物・和雑貨EC",                  icon: "🏺", color: "bg-stone-50 border-stone-300 text-stone-700" },
  { id: "woocommerce",       label: "WooCommerce / EC-CUBE", description: "WooCommerce・EC-CUBE構築の自社ECサイト",        icon: "🔧", color: "bg-purple-50 border-purple-200 text-purple-800" },
  { id: "base_stores",       label: "BASE / STORES",        description: "BASE・STORESで運営する個人・小規模EC",           icon: "🏪", color: "bg-orange-50 border-orange-200 text-orange-800" },
  { id: "makeshop",          label: "MakeShop / カラーミー", description: "MakeShop・カラーミーショップ運営EC事業者",      icon: "🛍️", color: "bg-blue-50 border-blue-200 text-blue-800" },
  { id: "futureshop_ecbeing", label: "futureshop / ecbeing", description: "futureshop・ecbeing構築の中大規模EC事業者",    icon: "🏢", color: "bg-slate-50 border-slate-200 text-slate-800" },
  { id: "regional_brand",    label: "地域ブランド・産直",   description: "地方特産品・地産地消・地域工芸の通販EC",          icon: "🗾", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { id: "luxury",            label: "高級・プレミアム",     description: "ラグジュアリー・オーダーメイド・プレミアム通販",  icon: "✨", color: "bg-amber-50 border-amber-200 text-amber-800" },
];

const REGIONS = [
  "",
  "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
  "東京", "神奈川", "埼玉", "千葉", "茨城", "栃木", "群馬",
  "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知",
  "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
  "鳥取", "島根", "岡山", "広島", "山口",
  "徳島", "香川", "愛媛", "高知",
  "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄",
];

type Phase = "preset" | "staging" | "scraping" | "done";

type StagedUrl = {
  id: string;
  url: string;
  name: string;
  source: string;
  excluded: boolean;
  exclude_reason?: string;
  selected: boolean;
};

interface ScrapeResult {
  total_success: number;
  total_duplicate: number;
  total_rejected: number;
  keywords_processed: number;
  agency_removed?: number;
}

const CMS_COLORS: Record<string, string> = {
  Shopify: "bg-green-100 text-green-800",
  BASE: "bg-orange-100 text-orange-800",
  WooCommerce: "bg-purple-100 text-purple-800",
  STORES: "bg-pink-100 text-pink-800",
  MakeShop: "bg-blue-100 text-blue-800",
  futureshop: "bg-cyan-100 text-cyan-800",
  "カラーミー": "bg-red-100 text-red-800",
  "EC-CUBE": "bg-indigo-100 text-indigo-800",
};

export default function ECDiscovery() {
  const { currentProject } = useProject();
  const [phase, setPhase] = useState<Phase>("preset");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("all");
  const [region, setRegion] = useState("");

  // Staging phase state
  const [stagedUrls, setStagedUrls] = useState<StagedUrl[]>([]);
  const [stagingLoading, setStagingLoading] = useState(false);
  const [stagingError, setStagingError] = useState<string | null>(null);
  const [keywordBatchStart, setKeywordBatchStart] = useState(0);
  const [totalKeywords, setTotalKeywords] = useState(0);
  const [isLastBatch, setIsLastBatch] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  // Scraping phase state
  const [scrapeProgressMsg, setScrapeProgressMsg] = useState("");
  const [scrapeProgressCurrent, setScrapeProgressCurrent] = useState(0);
  const [scrapeProgressTotal, setScrapeProgressTotal] = useState(0);
  const [scrapeSaved, setScrapeSaved] = useState(0);
  const [scrapeDup, setScrapeDup] = useState(0);
  const [scrapeRej, setScrapeRej] = useState(0);
  const [scrapeJobId, setScrapeJobId] = useState<string | null>(null);

  // Done state
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collectedCompanies, setCollectedCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [ecEmailIds, setEcEmailIds] = useState<number[]>([]);
  const [fetchingEmailIds, setFetchingEmailIds] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => { return () => stopAll(); }, [stopAll]);

  const fetchRecentEcCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const data = await api.companies.list({
        ec_only: true,
        sort_by: "created_at",
        sort_order: "desc",
        per_page: 10,
        page: 1,
        project_id: currentProject?.id,
      });
      setCollectedCompanies(data.companies);
    } catch {
      setCollectedCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const pollJobStatus = useCallback((job_id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.collector.jobStatus(job_id);
        if (!data.found) {
          clearInterval(pollRef.current!);
          setError("ジョブが見つかりません");
          setPhase("preset");
          return;
        }
        if (data.message) setScrapeProgressMsg(data.message);
        if (data.current !== undefined) setScrapeProgressCurrent(data.current);
        if (data.total !== undefined) setScrapeProgressTotal(data.total);
        if (data.saved_count !== undefined) setScrapeSaved(data.saved_count);
        if (data.dup_count !== undefined) setScrapeDup(data.dup_count);
        if (data.rej_count !== undefined) setScrapeRej(data.rej_count);

        if (data.status === "done") {
          clearInterval(pollRef.current!);
          const summary = data.result?.summary ?? data.result ?? {};
          setResult({
            total_success: summary.success ?? scrapeSaved,
            total_duplicate: summary.duplicate ?? scrapeDup,
            total_rejected: summary.rejected ?? scrapeRej,
            keywords_processed: totalKeywords,
            agency_removed: summary.agency_removed,
          });
          setScrapeProgressMsg("");
          setPhase("done");
          fetchRecentEcCompanies();
        } else if (data.status === "error" || data.status === "interrupted") {
          clearInterval(pollRef.current!);
          setError(data.message || "エラーが発生しました");
          setPhase("preset");
        }
      } catch {}
    }, 3000);
  }, [scrapeSaved, scrapeDup, scrapeRej, totalKeywords]);

  // ============================================================
  // Phase 1 → 2: プリセット選択後、最初のキーワードバッチを検索
  // ============================================================
  const handleStart = async () => {
    setStagingLoading(true);
    setStagingError(null);
    setStagedUrls([]);
    setKeywordBatchStart(0);
    setIsLastBatch(false);
    setError(null);
    setResult(null);
    setPhase("staging");

    try {
      const data = await api.collector.urlsPreview({
        type: "ec-discovery",
        category_id: selectedCategory,
        region: region || undefined,
        project_id: currentProject?.id,
        keyword_batch_start: 0,
        existing_urls: [],
      });
      if ((data as any).error) {
        setStagingError((data as any).error);
      } else {
        const d = data as any;
        setStagedUrls(
          (d.urls as any[]).map((u: any, i: number) => ({
            ...u,
            id: `0-${i}-${u.url}`,
            selected: !u.excluded,
          }))
        );
        setKeywordBatchStart(d.next_keyword_start ?? 3);
        setTotalKeywords(d.total_keywords ?? 0);
        setIsLastBatch(d.is_last_batch ?? false);
      }
    } catch (err: any) {
      setStagingError(err.response?.data?.detail || "検索エラーが発生しました");
    }
    setStagingLoading(false);
  };

  // ============================================================
  // Phase 2: 「次へ」 — さらにキーワードを検索してURLを追加
  // ============================================================
  const handleLoadMore = async () => {
    if (stagingLoading || isLastBatch) return;
    setStagingLoading(true);
    setStagingError(null);

    try {
      const existingUrls = stagedUrls.map(u => u.url);
      const data = await api.collector.urlsPreview({
        type: "ec-discovery",
        category_id: selectedCategory,
        region: region || undefined,
        project_id: currentProject?.id,
        keyword_batch_start: keywordBatchStart,
        existing_urls: existingUrls,
      });
      if ((data as any).error) {
        setStagingError((data as any).error);
      } else {
        const d = data as any;
        const existingSet = new Set(existingUrls);
        const newUrls = (d.urls as any[])
          .filter((u: any) => !existingSet.has(u.url))
          .map((u: any, i: number) => ({
            ...u,
            id: `${keywordBatchStart}-${i}-${u.url}`,
            selected: !u.excluded,
          }));
        setStagedUrls(prev => [...prev, ...newUrls]);
        setKeywordBatchStart(d.next_keyword_start ?? keywordBatchStart + 3);
        setIsLastBatch(d.is_last_batch ?? true);
      }
    } catch (err: any) {
      setStagingError(err.response?.data?.detail || "追加収集エラーが発生しました");
    }
    setStagingLoading(false);
  };

  // ============================================================
  // Phase 2 → 3: 選択URLをスクレイピング
  // ============================================================
  const handleScrapeStaged = async () => {
    const selected = stagedUrls.filter(u => u.selected && u.url);
    if (!selected.length) return;

    setPhase("scraping");
    setScrapeProgressMsg("スクレイピングを開始しています...");
    setScrapeProgressCurrent(0);
    setScrapeProgressTotal(selected.length);
    setScrapeSaved(0);
    setScrapeDup(0);
    setScrapeRej(0);
    stopAll();

    try {
      const { job_id } = await api.collector.scrapeStaged(
        selected.map(u => ({ url: u.url, name: u.name, source: u.source })),
        currentProject?.id,
        true
      );
      setScrapeJobId(job_id);

      const es = new EventSource(`/api/collect/progress/${job_id}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.message) setScrapeProgressMsg(msg.message);
          if (msg.current !== undefined) setScrapeProgressCurrent(msg.current);
          if (msg.total !== undefined) setScrapeProgressTotal(msg.total);
          if (msg.saved_count !== undefined) setScrapeSaved(msg.saved_count);
          if (msg.dup_count !== undefined) setScrapeDup(msg.dup_count);
          if (msg.rej_count !== undefined) setScrapeRej(msg.rej_count);

          if (msg.type === "done") {
            stopAll();
            const summary = msg.result?.summary ?? msg.result ?? {};
            setResult({
              total_success: summary.success ?? scrapeSaved,
              total_duplicate: summary.duplicate ?? scrapeDup,
              total_rejected: summary.rejected ?? scrapeRej,
              keywords_processed: totalKeywords,
              agency_removed: summary.agency_removed,
            });
            setScrapeProgressMsg("");
            setPhase("done");
            fetchRecentEcCompanies();
          } else if (msg.type === "error") {
            stopAll();
            setError(msg.message || "エラーが発生しました");
            setPhase("preset");
          }
        } catch {}
      };

      es.onerror = () => {
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        pollJobStatus(job_id);
      };
    } catch (err: any) {
      setError(err?.response?.data?.detail || "スクレイピングの開始に失敗しました");
      setPhase("preset");
    }
  };

  const handleCancelScrape = async () => {
    if (scrapeJobId) {
      try { await api.collector.cancelJob(scrapeJobId); } catch {}
    }
    stopAll();
    setPhase("staging");
    setScrapeProgressMsg("");
  };

  const handleReset = () => {
    stopAll();
    setPhase("preset");
    setStagedUrls([]);
    setStagingError(null);
    setKeywordBatchStart(0);
    setTotalKeywords(0);
    setIsLastBatch(false);
    setResult(null);
    setError(null);
    setCollectedCompanies([]);
    setScrapeJobId(null);
    setScrapeProgressMsg("");
  };

  const toggleAll = (checked: boolean) =>
    setStagedUrls(prev => prev.map(u => ({ ...u, selected: u.excluded ? false : checked })));
  const toggleOne = (id: string) =>
    setStagedUrls(prev => prev.map(u => u.id === id ? { ...u, selected: !u.selected } : u));

  const selectedPreset = CATEGORY_PRESETS.find(c => c.id === selectedCategory)!;
  const visibleUrls = showExcluded ? stagedUrls : stagedUrls.filter(u => !u.excluded);
  const selectedCount = stagedUrls.filter(u => u.selected).length;
  const excludedCount = stagedUrls.filter(u => u.excluded).length;
  const scrapePercent = scrapeProgressTotal > 0 ? Math.round((scrapeProgressCurrent / scrapeProgressTotal) * 100) : 0;
  const kw_progress = totalKeywords > 0 ? Math.round((keywordBatchStart / totalKeywords) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-2 rounded-lg">
          <ShoppingBag size={24} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">EC収集</h2>
          <p className="text-sm text-slate-500">業種プリセットで検索 → URLを確認 → スクレイピングで詳細取得</p>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-red-800 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 text-xs border border-red-300 px-2 py-1 rounded">
            閉じる
          </button>
        </div>
      )}

      {/* ====== Phase: preset ====== */}
      {phase === "preset" && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-0.5">業種プリセットを選択</h3>
              <p className="text-xs text-slate-500">収集したいECサイトの業種を選択してください。</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CATEGORY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedCategory(preset.id)}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
                      selectedCategory === preset.id
                        ? `${preset.color} border-opacity-100 shadow-sm scale-[1.01]`
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">{preset.icon}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{preset.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5 leading-snug">{preset.description}</div>
                    </div>
                    {selectedCategory === preset.id && (
                      <CheckCircle size={16} className="flex-shrink-0 ml-auto mt-0.5 text-emerald-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-slate-500" />
              <h3 className="font-semibold text-slate-800">地域を絞り込む（任意）</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r || "none"}
                  onClick={() => setRegion(r)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    region === r
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {r || "指定なし"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-slate-600">
                <span className="font-medium">選択中:</span>{" "}
                <span className="inline-flex items-center gap-1">
                  <span>{selectedPreset.icon}</span>
                  <span className="font-semibold">{selectedPreset.label}</span>
                </span>
                {region && <span className="ml-2 text-slate-500">/ <span className="font-medium">{region}</span></span>}
                {currentProject && <span className="ml-2 text-slate-400">→ {currentProject.name}</span>}
              </div>
              <button
                onClick={handleStart}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Search size={16} />
                URLを検索する
              </button>
            </div>
          </div>
        </>
      )}

      {/* ====== Phase: staging ====== */}
      {phase === "staging" && (
        <div className="space-y-3">
          {/* ステージングヘッダー（進捗 + 戻るボタン） */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${selectedPreset.color.split(" ")[0]}`}>
                  <span className="text-lg">{selectedPreset.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{selectedPreset.label}{region ? ` / ${region}` : ""}</p>
                  <p className="text-xs text-slate-500">
                    {totalKeywords > 0
                      ? `${Math.min(keywordBatchStart, totalKeywords)} / ${totalKeywords} キーワード検索済み`
                      : "検索中..."}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-slate-500 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0"
              >
                ← 戻る
              </button>
            </div>

            {/* キーワード進捗バー */}
            {totalKeywords > 0 && (
              <div className="mt-3">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(kw_progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ══ アクションボタン（常に画面上部に表示） ══ */}
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl px-4 py-3 space-y-2.5">
            {/* 件数サマリー */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {selectedCount}件選択中
                </span>
                {excludedCount > 0 && (
                  <span className="text-xs text-slate-500">除外 {excludedCount}件</span>
                )}
              </div>
              {stagingLoading && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <Loader2 size={12} className="animate-spin" />
                  検索中...
                </div>
              )}
            </div>

            {/* ボタン行 */}
            <div className="flex gap-2">
              <button
                onClick={handleLoadMore}
                disabled={stagingLoading || isLastBatch}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-medium text-sm border transition-colors ${
                  isLastBatch
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : stagingLoading
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-white text-blue-600 border-blue-400 hover:bg-blue-50"
                }`}
              >
                {stagingLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ChevronRight size={13} />
                )}
                {isLastBatch ? "検索完了" : "次のキーワードへ"}
              </button>
              <button
                onClick={handleScrapeStaged}
                disabled={selectedCount === 0 || stagingLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-colors ${
                  selectedCount === 0
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                }`}
              >
                <Zap size={13} />
                スクレイピング開始（{selectedCount}件）
              </button>
            </div>

            <p className="text-[10px] text-emerald-700">
              💡「次のキーワードへ」でさらにURLを追加。満足したら「スクレイピング開始」でリストに保存。
            </p>
          </div>

          {/* staging エラー */}
          {stagingError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{stagingError}</p>
            </div>
          )}

          {/* URLリスト */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-sm">収集したECサイト</h3>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {stagedUrls.filter(u => !u.excluded).length}件
                </span>
                {excludedCount > 0 && (
                  <button
                    onClick={() => setShowExcluded(v => !v)}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
                  >
                    {showExcluded ? "除外非表示" : `除外${excludedCount}件▼`}
                  </button>
                )}
              </div>
              {!stagingLoading && stagedUrls.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAll(true)} className="text-xs text-blue-600 hover:underline">全選択</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => toggleAll(false)} className="text-xs text-slate-500 hover:underline">全解除</button>
                </div>
              )}
            </div>

            {stagingLoading && stagedUrls.length === 0 ? (
              <div className="p-10 flex flex-col items-center gap-3 text-slate-400">
                <Loader2 size={28} className="animate-spin text-emerald-500" />
                <p className="text-sm">ECサイトを検索中...</p>
              </div>
            ) : visibleUrls.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                <Globe size={32} className="mx-auto mb-2 text-slate-300" />
                URLが見つかりませんでした
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleUrls.map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors ${u.excluded ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={u.selected}
                      onChange={() => toggleOne(u.id)}
                      disabled={u.excluded}
                      className="flex-shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{u.name || u.url}</p>
                      <p className="text-xs text-slate-400 truncate">{u.url}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {u.excluded && u.exclude_reason && (
                        <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded" title={u.exclude_reason}>
                          除外
                        </span>
                      )}
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stagingLoading && stagedUrls.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin text-emerald-500 flex-shrink-0" />
                さらに検索中...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== Phase: scraping ====== */}
      {phase === "scraping" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Loader2 size={22} className="text-emerald-600 animate-spin flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">スクレイピング中...</p>
                <p className="text-sm text-slate-500 truncate">{scrapeProgressMsg || "処理中..."}</p>
              </div>
            </div>
            <button
              onClick={handleCancelScrape}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs text-slate-500 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              キャンセル
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-medium">
                🔍 スクレイピング中
              </span>
              <span className="text-slate-400">
                {scrapeProgressTotal > 0
                  ? `${scrapeProgressCurrent + 1} / ${scrapeProgressTotal} 件`
                  : "処理中..."}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full transition-all duration-500 bg-emerald-500"
                style={{ width: scrapeProgressTotal > 0 ? `${scrapePercent}%` : "5%" }}
              />
            </div>
            {scrapeProgressTotal > 0 && (
              <p className="text-right text-xs text-slate-400 mt-1">{scrapePercent}%</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-lg px-3 py-2.5 text-center border border-emerald-100">
              <p className="text-[11px] text-emerald-600 mb-0.5">保存済み</p>
              <p className="text-lg font-bold text-emerald-700">{scrapeSaved.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 rounded-lg px-3 py-2.5 text-center border border-amber-100">
              <p className="text-[11px] text-amber-600 mb-0.5">重複スキップ</p>
              <p className="text-lg font-bold text-amber-700">{scrapeDup.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-center border border-slate-100">
              <p className="text-[11px] text-slate-400 mb-0.5">除外</p>
              <p className="text-lg font-bold text-slate-500">{scrapeRej.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              スクレイピングはバックグラウンドで実行中です。他のページを使いながらお待ちいただけます。
            </p>
          </div>
        </div>
      )}

      {/* ====== Phase: done ====== */}
      {phase === "done" && result && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <CheckCircle size={22} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-800 text-lg">EC収集が完了しました</p>
                <p className="text-sm text-slate-500">
                  {selectedPreset.icon} {selectedPreset.label}
                  {region ? ` / ${region}` : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-100">
                <div className="text-3xl font-bold text-emerald-700">{result.total_success}</div>
                <div className="text-xs text-emerald-600 mt-1 font-medium">新規取得</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                <div className="text-3xl font-bold text-blue-700">{result.total_duplicate}</div>
                <div className="text-xs text-blue-600 mt-1 font-medium">重複スキップ</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-100">
                <div className="text-3xl font-bold text-slate-600">{result.total_rejected}</div>
                <div className="text-xs text-slate-500 mt-1 font-medium">除外済み</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
                <div className="text-3xl font-bold text-purple-700">{result.keywords_processed}</div>
                <div className="text-xs text-purple-600 mt-1 font-medium">検索キーワード数</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                最近取得したEC企業
                {collectedCompanies.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-500">（直近10件）</span>
                )}
              </h3>
              {loadingCompanies && <Loader2 size={16} className="text-slate-400 animate-spin" />}
            </div>
            {loadingCompanies ? (
              <div className="p-6 text-center text-slate-400 text-sm">読み込み中...</div>
            ) : collectedCompanies.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">取得済みのEC企業がありません</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {collectedCompanies.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/companies/${c.id}`}
                          className="font-medium text-slate-800 hover:text-blue-600 transition-colors text-sm truncate"
                        >
                          {c.company_name}
                        </Link>
                        {c.cms_type && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CMS_COLORS[c.cms_type] ?? "bg-slate-100 text-slate-700"}`}>
                            🛒 {c.cms_type}
                          </span>
                        )}
                        {!c.cms_type && c.ec_flag && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">🛒 EC</span>
                        )}
                      </div>
                      {c.prefecture && (
                        <p className="text-xs text-slate-400 mt-0.5">{c.prefecture}</p>
                      )}
                    </div>
                    {c.website_url && (
                      <a
                        href={c.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        <Globe size={15} />
                      </a>
                    )}
                    <Link
                      to={`/companies/${c.id}`}
                      className="flex-shrink-0 text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      <ExternalLink size={15} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/companies?ec_only=true"
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
            >
              <BarChart3 size={16} />
              EC企業一覧をすべて確認
              <ChevronRight size={14} />
            </Link>
            <button
              onClick={async () => {
                setFetchingEmailIds(true);
                try {
                  const params: Record<string, string | number | boolean> = { ec_only: true };
                  if (currentProject?.id) params.project_id = currentProject.id;
                  const data = await api.companies.getAllIds(params);
                  if (data.ids.length === 0) {
                    alert("メールアドレスを持つEC企業が見つかりませんでした");
                    return;
                  }
                  setEcEmailIds(data.ids);
                  setShowEmailModal(true);
                } catch {
                  alert("EC企業IDの取得に失敗しました");
                } finally {
                  setFetchingEmailIds(false);
                }
              }}
              disabled={fetchingEmailIds}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm disabled:opacity-60"
            >
              {fetchingEmailIds ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              収集したEC企業にメール送信
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-300 px-5 py-2.5 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              <RefreshCw size={16} />
              もう一度収集する
            </button>
          </div>
        </div>
      )}

      {showEmailModal && (
        <EmailCampaignModal
          companyIds={ecEmailIds}
          companies={[]}
          onClose={() => setShowEmailModal(false)}
          onDone={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}
