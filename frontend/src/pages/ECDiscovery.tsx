import { useState, useRef, useEffect } from "react";
import { ShoppingBag, Play, CheckCircle, XCircle, Loader2, ChevronRight, BarChart3, RefreshCw, MapPin, ExternalLink, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import type { Company } from "../types";

type CategoryId = "all" | "apparel" | "food" | "cosme" | "btob" | "handmade" | "interior" | "d2c" | "shopify_users";

interface CategoryPreset {
  id: CategoryId;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const CATEGORY_PRESETS: CategoryPreset[] = [
  { id: "all", label: "すべて", description: "全業種のECサイトを幅広く探索", icon: "🌐", color: "bg-slate-100 border-slate-300 text-slate-700" },
  { id: "apparel", label: "アパレル", description: "レディース・メンズファッション、自社ECブランド", icon: "👗", color: "bg-pink-50 border-pink-300 text-pink-700" },
  { id: "food", label: "食品・グルメ", description: "産直・お取り寄せ・定期便食品EC", icon: "🍱", color: "bg-orange-50 border-orange-300 text-orange-700" },
  { id: "cosme", label: "コスメ・美容", description: "スキンケア・化粧品D2Cブランド", icon: "💄", color: "bg-rose-50 border-rose-300 text-rose-700" },
  { id: "btob", label: "BtoB EC", description: "法人向け卸売・業務用受発注システム", icon: "🏭", color: "bg-blue-50 border-blue-300 text-blue-700" },
  { id: "handmade", label: "ハンドメイド", description: "作家・手作り作品の自社販売サイト", icon: "🎨", color: "bg-purple-50 border-purple-300 text-purple-700" },
  { id: "interior", label: "インテリア・雑貨", description: "家具・セレクトショップ・雑貨EC", icon: "🪑", color: "bg-amber-50 border-amber-300 text-amber-700" },
  { id: "d2c", label: "D2C ブランド", description: "直販・サブスク・定期便の自社EC", icon: "📦", color: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { id: "shopify_users", label: "Shopify ユーザー", description: "Shopify導入中のEC事業者", icon: "🛒", color: "bg-green-50 border-green-300 text-green-700" },
];

const REGIONS = [
  "", "東京", "大阪", "名古屋", "福岡", "札幌", "仙台", "広島", "京都", "神奈川", "埼玉", "千葉",
];

interface JobResult {
  total_success: number;
  total_duplicate: number;
  total_rejected: number;
  keywords_processed: number;
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
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collectedCompanies, setCollectedCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (esRef.current) { esRef.current.close(); }
    };
  }, []);

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

  const handleStart = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setProgressMsg("EC専用収集を開始しています...");
    setProgressCurrent(0);
    setProgressTotal(0);

    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    try {
      const { job_id } = await api.collector.ecDiscovery({
        category_id: selectedCategory,
        region: region || undefined,
        project_id: currentProject?.id,
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
            setResult(msg.result as JobResult);
            setProgressMsg("");
            setRunning(false);
            es.close();
            fetchRecentEcCompanies();
          } else if (msg.type === "error") {
            setError(msg.message || "エラーが発生しました");
            setProgressMsg("");
            setRunning(false);
            es.close();
          }
        } catch {}
      };

      es.onerror = () => {
        setError("接続エラーが発生しました");
        setProgressMsg("");
        setRunning(false);
        es.close();
      };
    } catch (err: any) {
      setError(err?.response?.data?.detail || "収集の開始に失敗しました");
      setProgressMsg("");
      setRunning(false);
    }
  };

  const handleReset = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setRunning(false);
    setResult(null);
    setError(null);
    setProgressMsg("");
    setProgressCurrent(0);
    setProgressTotal(0);
    setCollectedCompanies([]);
  };

  const progressPercent = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;
  const selectedPreset = CATEGORY_PRESETS.find(c => c.id === selectedCategory)!;

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
          <div className="flex items-center gap-3">
            <Loader2 size={22} className="text-emerald-600 animate-spin flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">EC収集中...</p>
              <p className="text-sm text-slate-500 truncate">{progressMsg || "処理中..."}</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>進捗</span>
              <span>{progressCurrent} / {progressTotal || "?"} キーワード</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                style={{ width: progressTotal > 0 ? `${progressPercent}%` : "5%" }}
              />
            </div>
            {progressTotal > 0 && (
              <p className="text-right text-xs text-slate-400 mt-1">{progressPercent}%</p>
            )}
          </div>

          <p className="text-xs text-slate-400">収集が完了するまでこのページを閉じないでください。</p>
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
                <div className="text-xs text-purple-600 mt-1 font-medium">キーワード数</div>
              </div>
            </div>
          </div>

          {/* 取得企業インライン一覧 */}
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
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-300 px-5 py-2.5 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              <RefreshCw size={16} />
              もう一度収集する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
