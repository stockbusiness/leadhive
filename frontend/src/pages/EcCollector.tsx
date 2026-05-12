import { useEffect, useRef, useState } from "react";
import {
  ShoppingCart, Play, RefreshCw, CheckCircle2, AlertTriangle, MapPin,
  ChevronRight, ExternalLink, Grid3x3, Search, Zap, RotateCcw, ChevronDown,
} from "lucide-react";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import type { EcKeywordTemplate } from "../types";

const EC_PLATFORMS = [
  "Shopify", "BASE", "STORES", "MakeShop", "futureshop",
  "カラーミー", "EC-CUBE", "WooCommerce", "Yahoo!ショッピング", "楽天",
];

const REGIONS = ["", "東京", "大阪", "愛知", "神奈川", "埼玉", "福岡", "北海道", "宮城", "広島"];

const MATRIX_CATEGORIES = [
  { id: "apparel", label: "アパレル", icon: "👗" },
  { id: "food", label: "食品・グルメ", icon: "🍱" },
  { id: "beauty", label: "コスメ・美容", icon: "💄" },
  { id: "sports", label: "スポーツ", icon: "⚽" },
  { id: "interior", label: "インテリア", icon: "🪑" },
  { id: "d2c", label: "D2C・ブランド", icon: "🏷️" },
  { id: "shopify_users", label: "Shopify運営", icon: "🛍️" },
  { id: "all", label: "全般EC", icon: "🛒" },
];

const MAJOR_PREFECTURES = [
  "北海道", "宮城", "東京", "神奈川", "埼玉", "千葉", "愛知",
  "大阪", "京都", "兵庫", "広島", "福岡",
];

type JobStatus = "idle" | "running" | "done" | "error";
type TabId = "genre" | "platform" | "matrix" | "similar";

interface CollectResult {
  added: number;
  skipped: number;
  errors?: string[];
}

function useJobProgress() {
  const esRef = useRef<EventSource | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<CollectResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const listen = (jobId: string) => {
    esRef.current?.close();
    const es = new EventSource(`/api/collect/progress/${jobId}`);
    esRef.current = es;
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.status === "running" || data.type === "progress") {
          setProgressMsg(data.message || "収集中...");
          setProgressCurrent(data.current ?? 0);
          setProgressTotal(data.total ?? 0);
        } else if (data.status === "done" || data.status === "completed" || data.type === "done") {
          setJobStatus("done");
          setProgressMsg("収集完了！");
          setResult({
            added: data.added ?? data.result?.total_success ?? data.success_count ?? 0,
            skipped: data.skipped ?? data.result?.total_duplicate ?? 0,
            errors: data.errors ?? [],
          });
          es.close();
        } else if (data.status === "error" || data.status === "interrupted" || data.type === "error") {
          setJobStatus("error");
          const defaultMsg = data.status === "interrupted"
            ? "サーバー再起動によりジョブが中断されました。再度お試しください。"
            : "収集中にエラーが発生しました";
          setErrorMsg(data.message || defaultMsg);
          es.close();
        }
      } catch {}
    };
    es.onerror = () => {
      setJobStatus("error");
      setErrorMsg("接続が切れました。しばらく待つか、再試行してください。");
      es.close();
    };
  };

  const reset = () => {
    esRef.current?.close();
    setJobStatus("idle");
    setProgressMsg("");
    setProgressCurrent(0);
    setProgressTotal(0);
    setResult(null);
    setErrorMsg(null);
  };

  useEffect(() => () => { esRef.current?.close(); }, []);

  return { jobStatus, setJobStatus, progressMsg, progressCurrent, progressTotal, result, errorMsg, setErrorMsg, listen, reset };
}

function ProgressBlock({ jobStatus, progressMsg, progressCurrent, progressTotal, result, errorMsg, onReset }: {
  jobStatus: JobStatus;
  progressMsg: string;
  progressCurrent: number;
  progressTotal: number;
  result: CollectResult | null;
  errorMsg: string | null;
  onReset: () => void;
}) {
  const pct = progressTotal > 0 ? Math.min(100, (progressCurrent / progressTotal) * 100) : 0;
  if (jobStatus === "running") return (
    <div className="bg-white rounded-lg border border-purple-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-purple-500 animate-spin" />
          <span className="font-semibold text-slate-700 text-sm">EC企業を収集中...</span>
        </div>
        <button onClick={onReset} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-300 px-3 py-1 rounded-lg">キャンセル</button>
      </div>
      <div className="space-y-2">
        <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
          <div className="bg-purple-500 h-3 rounded-full transition-all duration-500" style={{ width: progressTotal > 0 ? `${pct}%` : "30%" }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{progressMsg}</span>
          {progressTotal > 0 && <span>{progressCurrent} / {progressTotal}</span>}
        </div>
      </div>
    </div>
  );
  if (jobStatus === "done" && result) return (
    <div className="bg-white rounded-lg border border-emerald-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={20} className="text-emerald-500" />
        <span className="font-semibold text-emerald-700">収集完了！</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
          <p className="text-2xl font-bold text-emerald-700">{result.added}</p>
          <p className="text-xs text-emerald-600 mt-0.5">新規追加</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
          <p className="text-2xl font-bold text-slate-600">{result.skipped}</p>
          <p className="text-xs text-slate-500 mt-0.5">スキップ</p>
        </div>
        <div className={`rounded-lg p-3 text-center border ${(result.errors?.length ?? 0) > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
          <p className={`text-2xl font-bold ${(result.errors?.length ?? 0) > 0 ? "text-red-600" : "text-slate-400"}`}>{result.errors?.length ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">エラー</p>
        </div>
      </div>
      <div className="flex gap-3">
        <a href="/companies?ec_only=true" className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <ExternalLink size={14} /> EC企業一覧を確認
        </a>
        <button onClick={onReset} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw size={14} /> もう一度収集
        </button>
      </div>
    </div>
  );
  if (jobStatus === "error") return (
    <div className="bg-red-50 rounded-lg border border-red-200 p-4 space-y-3">
      <div className="flex items-center gap-2 text-red-700">
        <AlertTriangle size={16} /><span className="font-semibold text-sm">エラーが発生しました</span>
      </div>
      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      <button onClick={onReset} className="flex items-center gap-1.5 text-sm text-red-700 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors">
        <RefreshCw size={14} /> 再試行
      </button>
    </div>
  );
  return null;
}

export default function EcCollector() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState<TabId>("genre");

  const [templates, setTemplates] = useState<EcKeywordTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [region, setRegion] = useState("");

  const [platform, setPlatform] = useState("Shopify");
  const [platformKeyword, setPlatformKeyword] = useState("");
  const [platformRegion, setPlatformRegion] = useState("");

  const [matrixCats, setMatrixCats] = useState<string[]>(["all"]);
  const [matrixPrefs, setMatrixPrefs] = useState<string[]>(["東京"]);

  const [similarCms, setSimilarCms] = useState("");
  const [similarCategory, setSimilarCategory] = useState("");

  const [rescoreLoading, setRescoreLoading] = useState(false);
  const [rescoreResult, setRescoreResult] = useState<string | null>(null);

  const job = useJobProgress();

  useEffect(() => {
    api.keywords.ecTemplates().then((data) => {
      setTemplates(data.templates);
      if (data.templates.length > 0) setSelectedCategory(data.templates[0].id);
    });
  }, []);

  const selectedTemplate = templates.find((t) => t.id === selectedCategory);

  const startCollection = async () => {
    if (!currentProject) return;
    job.reset();
    job.setJobStatus("running");
    try {
      if (activeTab === "genre") {
        if (!selectedCategory) return;
        const { job_id } = await api.collector.ecDiscovery({
          category_id: selectedCategory,
          region: region || undefined,
          project_id: currentProject.id,
        });
        job.listen(job_id);
      } else if (activeTab === "platform") {
        const { job_id } = await api.collector.ecPlatform({
          platform,
          keyword: platformKeyword || undefined,
          region: platformRegion || undefined,
          project_id: currentProject.id,
        });
        job.listen(job_id);
      } else if (activeTab === "matrix") {
        if (matrixCats.length === 0 || matrixPrefs.length === 0) {
          job.setJobStatus("error");
          job.setErrorMsg("カテゴリと都道府県を1つ以上選択してください");
          return;
        }
        const { job_id } = await api.collector.ecMatrix({
          category_ids: matrixCats,
          prefectures: matrixPrefs,
          project_id: currentProject.id,
        });
        job.listen(job_id);
      } else if (activeTab === "similar") {
        if (!similarCms && !similarCategory) {
          job.setJobStatus("error");
          job.setErrorMsg("CMS種類かカテゴリを入力してください");
          return;
        }
        const { job_id } = await api.collector.ecSimilar({
          cms_type: similarCms || undefined,
          category: similarCategory || undefined,
          project_id: currentProject.id,
        });
        job.listen(job_id);
      }
    } catch (err: any) {
      job.setJobStatus("error");
      job.setErrorMsg(err?.response?.data?.detail || "収集を開始できませんでした");
    }
  };

  const toggleMatrixCat = (id: string) => {
    setMatrixCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleMatrixPref = (p: string) => {
    setMatrixPrefs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleRescore = async () => {
    if (!currentProject) return;
    setRescoreLoading(true);
    setRescoreResult(null);
    try {
      const res = await api.companies.bulkRescore({ project_id: currentProject.id });
      setRescoreResult(res.message);
    } catch {
      setRescoreResult("再計算に失敗しました");
    } finally {
      setRescoreLoading(false);
    }
  };

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "genre", label: "業種別", icon: <ShoppingCart size={14} /> },
    { id: "platform", label: "プラットフォーム", icon: <Search size={14} /> },
    { id: "matrix", label: "マトリクス", icon: <Grid3x3 size={14} /> },
    { id: "similar", label: "類似EC", icon: <Zap size={14} /> },
  ];

  return (
    <div className="p-3 md:p-6 space-y-5 max-w-4xl">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart size={22} className="text-purple-500" />
          ECサイト専用収集
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          4つの収集モードでECサイトオーナー企業を網羅的に収集します。
        </p>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); job.reset(); }}
            disabled={job.jobStatus === "running"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-white text-purple-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            } disabled:opacity-50`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ① 業種別収集タブ */}
      {activeTab === "genre" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">1</span>
              収集する業種を選択
            </h3>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-400">読み込み中...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedCategory(t.id)}
                    disabled={job.jobStatus === "running"}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                      selectedCategory === t.id
                        ? "border-purple-500 bg-purple-50 shadow-sm"
                        : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className={`text-xs font-semibold ${selectedCategory === t.id ? "text-purple-700" : "text-slate-700"}`}>{t.label}</span>
                    <span className="text-[10px] text-slate-400">{t.keywords.length}キーワード</span>
                  </button>
                ))}
              </div>
            )}
            {selectedTemplate && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <p className="text-xs text-purple-700 font-medium mb-1.5">{selectedTemplate.icon} {selectedTemplate.label} — {selectedTemplate.description}</p>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.keywords.map((kw, i) => (
                    <span key={i} className="text-xs bg-white border border-purple-200 text-slate-600 px-2 py-0.5 rounded-full">{kw.keyword}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">2</span>
              対象地域（任意）
            </h3>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button key={r || "all"} onClick={() => setRegion(r)} disabled={job.jobStatus === "running"}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    region === r ? "border-purple-500 bg-purple-50 text-purple-700" : "border-slate-300 text-slate-600 hover:border-purple-300"
                  } disabled:opacity-50`}>
                  {r ? <><MapPin size={11} />{r}</> : "全国"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ① プラットフォーム別タブ */}
      {activeTab === "platform" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-3">
                特定のECプラットフォームに絞ったsite:検索でEC企業を直接収集します。
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">プラットフォームを選択</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {EC_PLATFORMS.map((p) => (
                  <button key={p} onClick={() => setPlatform(p)} disabled={job.jobStatus === "running"}
                    className={`p-2 rounded-lg border-2 text-xs font-semibold text-center transition-all ${
                      platform === p ? "border-purple-500 bg-purple-50 text-purple-700" : "border-slate-200 hover:border-purple-300 text-slate-600"
                    } disabled:opacity-50`}>
                    🛒 {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">絞り込みキーワード（任意）</label>
                <input
                  type="text" value={platformKeyword} onChange={e => setPlatformKeyword(e.target.value)}
                  disabled={job.jobStatus === "running"}
                  placeholder="例: アパレル、コスメ…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">地域（任意）</label>
                <select value={platformRegion} onChange={e => setPlatformRegion(e.target.value)} disabled={job.jobStatus === "running"}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50">
                  <option value="">全国</option>
                  {REGIONS.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium mb-1">検索クエリ例（{platform}）</p>
              <p className="text-xs text-blue-600 font-mono">
                {platform === "Shopify" && `site:myshopify.com ${platformKeyword || "(キーワード)"}`}
                {platform === "BASE" && `site:base.shop ${platformKeyword || "(キーワード)"}`}
                {platform === "STORES" && `site:stores.jp ${platformKeyword || "(キーワード)"}`}
                {platform === "MakeShop" && `inurl:makeshop.jp ${platformKeyword || "(キーワード)"}`}
                {platform === "Yahoo!ショッピング" && `site:store.shopping.yahoo.co.jp ${platformKeyword || "(キーワード)"}`}
                {platform === "楽天" && `site:item.rakuten.co.jp ${platformKeyword || "(キーワード)"}`}
                {!["Shopify","BASE","STORES","MakeShop","Yahoo!ショッピング","楽天"].includes(platform) && `${platform} 通販サイト ${platformKeyword || "(キーワード)"} ${platformRegion || ""}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ⑤ マトリクスタブ */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
            <div>
              <p className="text-sm text-slate-500">
                業種 × 都道府県の全組み合わせで自動収集します。
                <span className="text-purple-600 font-semibold ml-1">{matrixCats.length}業種 × {matrixPrefs.length}地域 = {matrixCats.length * matrixPrefs.length}クエリ</span>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">対象業種</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MATRIX_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => toggleMatrixCat(cat.id)} disabled={job.jobStatus === "running"}
                    className={`flex items-center gap-2 p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      matrixCats.includes(cat.id) ? "border-purple-500 bg-purple-50 text-purple-700" : "border-slate-200 hover:border-purple-300 text-slate-600"
                    } disabled:opacity-50`}>
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {matrixCats.includes(cat.id) && <CheckCircle2 size={12} className="ml-auto text-purple-500" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-2 block">対象都道府県</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setMatrixPrefs(matrixPrefs.length === MAJOR_PREFECTURES.length ? [] : [...MAJOR_PREFECTURES])}
                  disabled={job.jobStatus === "running"}
                  className="text-xs px-2.5 py-1 rounded-full border border-purple-300 text-purple-600 hover:bg-purple-50 disabled:opacity-50"
                >
                  {matrixPrefs.length === MAJOR_PREFECTURES.length ? "全解除" : "全選択"}
                </button>
                {MAJOR_PREFECTURES.map(pref => (
                  <button key={pref} onClick={() => toggleMatrixPref(pref)} disabled={job.jobStatus === "running"}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      matrixPrefs.includes(pref)
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-slate-300 text-slate-600 hover:border-purple-300"
                    } disabled:opacity-50`}>
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            {matrixCats.length > 0 && matrixPrefs.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <strong>{matrixCats.length * matrixPrefs.length}件</strong>のクエリを実行します。
                  Serper APIのクレジット消費にご注意ください（約 {matrixCats.length * matrixPrefs.length * 3} リクエスト）。
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⑥ 類似EC発見タブ */}
      {activeTab === "similar" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
            <p className="text-sm text-slate-500">
              特定のECプラットフォームや業種カテゴリを元に、類似するEC企業を探索収集します。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">ECプラットフォーム（任意）</label>
                <select value={similarCms} onChange={e => setSimilarCms(e.target.value)} disabled={job.jobStatus === "running"}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50">
                  <option value="">指定なし</option>
                  {EC_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">業種カテゴリ（任意）</label>
                <input
                  type="text" value={similarCategory} onChange={e => setSimilarCategory(e.target.value)}
                  disabled={job.jobStatus === "running"}
                  placeholder="例: アパレル、食品…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                />
              </div>
            </div>
            {(similarCms || similarCategory) && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <p className="text-xs text-indigo-700 font-medium mb-1">探索クエリ例</p>
                <div className="space-y-0.5">
                  {similarCms && <p className="text-xs text-indigo-600 font-mono">{similarCms} 通販 ECサイト 運営</p>}
                  {similarCms && similarCategory && <p className="text-xs text-indigo-600 font-mono">{similarCms} {similarCategory} ネットショップ</p>}
                  {similarCategory && <p className="text-xs text-indigo-600 font-mono">{similarCategory} 通販 自社EC ブランド</p>}
                </div>
              </div>
            )}
            {!similarCms && !similarCategory && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle size={12} /> プラットフォームまたは業種カテゴリを入力してください
              </p>
            )}
          </div>
        </div>
      )}

      {/* 収集開始ボタン */}
      {job.jobStatus === "idle" && (
        <div className="flex items-center gap-3">
          <button
            onClick={startCollection}
            disabled={!currentProject || (activeTab === "genre" && !selectedCategory) || (activeTab === "similar" && !similarCms && !similarCategory)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Play size={16} />
            EC企業の収集を開始
            <ChevronRight size={16} />
          </button>
          {!currentProject && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={12} /> プロジェクトを選択してください
            </p>
          )}
        </div>
      )}

      <ProgressBlock
        jobStatus={job.jobStatus}
        progressMsg={job.progressMsg}
        progressCurrent={job.progressCurrent}
        progressTotal={job.progressTotal}
        result={job.result}
        errorMsg={job.errorMsg}
        onReset={job.reset}
      />

      {/* ④ ECスコア一括再計算 */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <RotateCcw size={14} className="text-slate-500" />
              ECスコア一括再計算
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              現在のプロジェクトの全企業のスコアを最新の採点ルールで再計算します
            </p>
          </div>
          <button
            onClick={handleRescore}
            disabled={rescoreLoading || !currentProject}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {rescoreLoading ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            {rescoreLoading ? "計算中..." : "再計算を実行"}
          </button>
        </div>
        {rescoreResult && (
          <p className={`text-xs mt-2 px-3 py-1.5 rounded-lg ${rescoreResult.includes("失敗") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
            {rescoreResult}
          </p>
        )}
      </div>
    </div>
  );
}
