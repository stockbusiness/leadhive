import { useState, useRef, useEffect, useCallback } from "react";
import { ShoppingBag, Play, CheckCircle, XCircle, Loader2, ChevronRight, BarChart3, RefreshCw, MapPin, ExternalLink, Globe, Info, Mail } from "lucide-react";
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
  // 北海道・東北
  "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
  // 関東
  "東京", "神奈川", "埼玉", "千葉", "茨城", "栃木", "群馬",
  // 中部
  "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知",
  // 近畿
  "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
  // 中国
  "鳥取", "島根", "岡山", "広島", "山口",
  // 四国
  "徳島", "香川", "愛媛", "高知",
  // 九州・沖縄
  "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄",
];

interface JobResult {
  total_success: number;
  total_duplicate: number;
  total_rejected: number;
  keywords_processed: number;
}

interface SavedJob {
  job_id: string;
  status: "running" | "done" | "error";
  category_id: CategoryId;
  category_label: string;
  category_icon: string;
  region: string;
  project_id?: number;
  started_at: string;
  result?: JobResult;
  error?: string;
}

const LS_KEY = "leadhive_ec_job";

function saveJob(data: SavedJob) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
function loadJob(): SavedJob | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearJob() {
  try { localStorage.removeItem(LS_KEY); } catch {}
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("all");
  const [region, setRegion] = useState("");
  const [running, setRunning] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressPhase, setProgressPhase] = useState<"search" | "save" | "">("");
  const [progressSaved, setProgressSaved] = useState(0);
  const [progressDup, setProgressDup] = useState(0);
  const [progressRej, setProgressRej] = useState(0);
  const [progressUrlsFound, setProgressUrlsFound] = useState(0);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collectedCompanies, setCollectedCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [savedJobMeta, setSavedJobMeta] = useState<{ label: string; icon: string; region: string } | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [ecEmailIds, setEcEmailIds] = useState<number[]>([]);
  const [fetchingEmailIds, setFetchingEmailIds] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentJobIdRef = useRef<string | null>(null);

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

  const pollJobStatus = useCallback((job_id: string, savedMeta?: SavedJob) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.collector.jobStatus(job_id);
        if (!data.found) {
          clearInterval(pollRef.current!);
          setRunning(false);
          setError("ジョブが見つかりません");
          clearJob();
          return;
        }
        if (data.message) setProgressMsg(data.message);
        if (data.current !== undefined) setProgressCurrent(data.current);
        if (data.total !== undefined) setProgressTotal(data.total);
        if (data.phase !== undefined) setProgressPhase(data.phase);
        if (data.saved_count !== undefined) setProgressSaved(data.saved_count);
        if (data.dup_count !== undefined) setProgressDup(data.dup_count);
        if (data.rej_count !== undefined) setProgressRej(data.rej_count);
        if (data.urls_found !== undefined) setProgressUrlsFound(data.urls_found);

        if (data.status === "done") {
          clearInterval(pollRef.current!);
          const jobResult = data.result ?? savedMeta?.result ?? null;
          setResult(jobResult);
          setProgressMsg("");
          setRunning(false);
          const saved = loadJob();
          if (saved) { saved.status = "done"; saved.result = jobResult ?? undefined; saveJob(saved); }
          fetchRecentEcCompanies();
        } else if (data.status === "error" || data.status === "interrupted") {
          clearInterval(pollRef.current!);
          setError(data.message || (data.status === "interrupted" ? "サーバー再起動によりジョブが中断されました。再度お試しください。" : "エラーが発生しました"));
          setProgressMsg("");
          setRunning(false);
          clearJob();
        }
      } catch {
      }
    }, 3000);
  }, []);

  useEffect(() => {
    const saved = loadJob();
    if (!saved) return;

    if (saved.status === "done") {
      const preset = CATEGORY_PRESETS.find(c => c.id === saved.category_id);
      if (preset) setSelectedCategory(saved.category_id);
      setSavedJobMeta({ label: saved.category_label, icon: saved.category_icon, region: saved.region });
      if (saved.result) setResult(saved.result);
      fetchRecentEcCompanies();
      return;
    }

    if (saved.status === "running") {
      const preset = CATEGORY_PRESETS.find(c => c.id === saved.category_id);
      if (preset) setSelectedCategory(saved.category_id);
      setSavedJobMeta({ label: saved.category_label, icon: saved.category_icon, region: saved.region });
      setRunning(true);
      setProgressMsg("バックグラウンドで収集中...");
      currentJobIdRef.current = saved.job_id;
      pollJobStatus(saved.job_id, saved);
    }
  }, []);

  const handleStart = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setSavedJobMeta(null);
    setProgressMsg("EC専用収集を開始しています...");
    setProgressCurrent(0);
    setProgressTotal(0);
    stopAll();

    const preset = CATEGORY_PRESETS.find(c => c.id === selectedCategory)!;

    try {
      const { job_id } = await api.collector.ecDiscovery({
        category_id: selectedCategory,
        region: region || undefined,
        project_id: currentProject?.id,
      });

      currentJobIdRef.current = job_id;

      saveJob({
        job_id,
        status: "running",
        category_id: selectedCategory,
        category_label: preset.label,
        category_icon: preset.icon,
        region,
        project_id: currentProject?.id,
        started_at: new Date().toISOString(),
      });

      const es = new EventSource(`/api/collect/progress/${job_id}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.message) setProgressMsg(msg.message);
          if (msg.current !== undefined) setProgressCurrent(msg.current);
          if (msg.total !== undefined) setProgressTotal(msg.total);
          if (msg.phase !== undefined) setProgressPhase(msg.phase);
          if (msg.saved_count !== undefined) setProgressSaved(msg.saved_count);
          if (msg.dup_count !== undefined) setProgressDup(msg.dup_count);
          if (msg.rej_count !== undefined) setProgressRej(msg.rej_count);
          if (msg.urls_found !== undefined) setProgressUrlsFound(msg.urls_found);

          if (msg.type === "done") {
            stopAll();
            const jobResult = msg.result as JobResult;
            setResult(jobResult);
            setProgressMsg("");
            setRunning(false);
            const saved = loadJob();
            if (saved) { saved.status = "done"; saved.result = jobResult; saveJob(saved); }
            fetchRecentEcCompanies();
          } else if (msg.type === "error") {
            stopAll();
            setError(msg.message || "エラーが発生しました");
            setProgressMsg("");
            setRunning(false);
            clearJob();
          }
        } catch {}
      };

      es.onerror = () => {
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        if (currentJobIdRef.current) {
          pollJobStatus(currentJobIdRef.current);
        }
      };
    } catch (err: any) {
      setError(err?.response?.data?.detail || "収集の開始に失敗しました");
      setProgressMsg("");
      setRunning(false);
      clearJob();
    }
  };

  const handleReset = () => {
    stopAll();
    setRunning(false);
    setResult(null);
    setError(null);
    setProgressMsg("");
    setProgressCurrent(0);
    setProgressTotal(0);
    setProgressPhase("");
    setProgressSaved(0);
    setProgressDup(0);
    setProgressRej(0);
    setProgressUrlsFound(0);
    setCollectedCompanies([]);
    setSavedJobMeta(null);
    clearJob();
    currentJobIdRef.current = null;
  };

  const handleCancel = async () => {
    const jobId = currentJobIdRef.current;
    if (jobId) {
      try {
        await api.collector.cancelJob(jobId);
      } catch (_) {}
    }
    handleReset();
  };

  const progressPercent = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;
  const selectedPreset = CATEGORY_PRESETS.find(c => c.id === selectedCategory)!;
  const displayMeta = savedJobMeta ?? { label: selectedPreset.label, icon: selectedPreset.icon, region };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-2 rounded-lg">
          <ShoppingBag size={24} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">EC収集</h2>
          <p className="text-sm text-slate-500">業種プリセットから一括でECサイトを発見・収集します</p>
        </div>
      </div>

      {!running && !result && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-0.5">業種プリセットを選択</h3>
              <p className="text-xs text-slate-500">収集したいECサイトの業種を選択してください。ワンクリックで自動的にキーワード検索を実行します。</p>
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
                {region && (
                  <span className="ml-2 text-slate-500">
                    / <span className="font-medium">{region}</span>
                  </span>
                )}
                {currentProject && (
                  <span className="ml-2 text-slate-400">
                    → {currentProject.name}
                  </span>
                )}
              </div>
              <button
                onClick={handleStart}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Play size={16} />
                EC収集を開始
              </button>
            </div>
          </div>
        </>
      )}

      {running && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Loader2 size={22} className="text-emerald-600 animate-spin flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">EC収集中...</p>
                <p className="text-sm text-slate-500 truncate">{progressMsg || "処理中..."}</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs text-slate-500 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              キャンセル
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span className="flex items-center gap-1.5">
                {progressPhase === "search" ? (
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-medium">
                    🔍 検索フェーズ
                  </span>
                ) : progressPhase === "save" ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-medium">
                    💾 保存フェーズ
                  </span>
                ) : (
                  <span className="text-slate-400">準備中</span>
                )}
              </span>
              <span className="text-slate-400">
                {progressTotal > 0 ? `${progressCurrent + 1} / ${progressTotal} ステップ` : "処理中..."}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${progressPhase === "search" ? "bg-blue-500" : "bg-emerald-500"}`}
                style={{ width: progressTotal > 0 ? `${progressPercent}%` : "5%" }}
              />
            </div>
            {progressTotal > 0 && (
              <p className="text-right text-xs text-slate-400 mt-1">{progressPercent}%</p>
            )}
          </div>

          {/* 詳細ステータス */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-center border border-slate-100">
              <p className="text-[11px] text-slate-400 mb-0.5">探索URL数</p>
              <p className="text-lg font-bold text-slate-700">{progressUrlsFound.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg px-3 py-2.5 text-center border border-emerald-100">
              <p className="text-[11px] text-emerald-600 mb-0.5">保存済み</p>
              <p className="text-lg font-bold text-emerald-700">{progressSaved.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 rounded-lg px-3 py-2.5 text-center border border-amber-100">
              <p className="text-[11px] text-amber-600 mb-0.5">重複スキップ</p>
              <p className="text-lg font-bold text-amber-700">{progressDup.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-center border border-slate-100">
              <p className="text-[11px] text-slate-400 mb-0.5">除外</p>
              <p className="text-lg font-bold text-slate-500">{progressRej.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              収集はバックグラウンドで実行中です。他のページを使いながらお待ちいただけます。このページに戻ると進捗・結果を確認できます。
            </p>
          </div>
        </div>
      )}

      {error && !running && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5">
          <div className="flex items-start gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">エラーが発生しました</p>
              <p className="text-sm text-slate-600 mt-1">{error}</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={14} />
              やり直す
            </button>
          </div>
        </div>
      )}

      {result && !running && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <CheckCircle size={22} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-800 text-lg">EC収集が完了しました</p>
                <p className="text-sm text-slate-500">
                  {displayMeta.icon} {displayMeta.label}
                  {displayMeta.region ? ` / ${displayMeta.region}` : ""}
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
                <div className="text-xs text-purple-600 mt-1 font-medium">キーワード数</div>
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
                        title={c.website_url}
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
