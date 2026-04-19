import { useEffect, useRef, useState } from "react";
import { ShoppingCart, Play, RefreshCw, CheckCircle2, AlertTriangle, MapPin, ChevronRight, ExternalLink } from "lucide-react";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import type { EcKeywordTemplate } from "../types";

const EC_PLATFORMS = ["Shopify", "BASE", "WooCommerce", "STORES", "MakeShop", "futureshop", "カラーミー", "EC-CUBE"];

const REGIONS = ["", "東京", "大阪", "愛知", "神奈川", "埼玉", "福岡", "北海道", "宮城", "広島", "全国"];

type JobStatus = "idle" | "running" | "done" | "error";

interface CollectResult {
  added: number;
  skipped: number;
  errors?: string[];
}

export default function EcCollector() {
  const { currentProject } = useProject();
  const [templates, setTemplates] = useState<EcKeywordTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<CollectResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    api.keywords.ecTemplates().then((data) => {
      setTemplates(data.templates);
      if (data.templates.length > 0) setSelectedCategory(data.templates[0].id);
    });
    return () => {
      esRef.current?.close();
    };
  }, []);

  const selectedTemplate = templates.find((t) => t.id === selectedCategory);

  const startCollection = async () => {
    if (!selectedCategory) return;
    setJobStatus("running");
    setProgressMsg("収集を開始しています...");
    setProgressCurrent(0);
    setProgressTotal(0);
    setResult(null);
    setErrorMsg(null);

    try {
      const { job_id } = await api.collector.ecDiscovery({
        category_id: selectedCategory,
        region: region || undefined,
        project_id: currentProject?.id,
      });

      const es = new EventSource(`/api/collect/progress/${job_id}`);
      esRef.current = es;

      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.status === "running") {
            setProgressMsg(data.message || "収集中...");
            setProgressCurrent(data.current ?? 0);
            setProgressTotal(data.total ?? 0);
          } else if (data.status === "done" || data.status === "completed") {
            setJobStatus("done");
            setProgressMsg("収集完了！");
            setResult({
              added: data.added ?? data.success_count ?? 0,
              skipped: data.skipped ?? 0,
              errors: data.errors ?? [],
            });
            es.close();
          } else if (data.status === "error") {
            setJobStatus("error");
            setErrorMsg(data.message || "収集中にエラーが発生しました");
            es.close();
          }
        } catch {}
      };

      es.onerror = () => {
        if (jobStatus === "running") {
          setJobStatus("error");
          setErrorMsg("接続が切れました。ページを再読み込みして再度お試しください。");
        }
        es.close();
      };
    } catch (err: any) {
      setJobStatus("error");
      setErrorMsg(err?.response?.data?.detail || "収集を開始できませんでした");
    }
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

  const progressPct = progressTotal > 0 ? Math.min(100, (progressCurrent / progressTotal) * 100) : 0;

  return (
    <div className="p-3 md:p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart size={22} className="text-purple-500" />
          ECサイト専用収集
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          業種別プリセットを選択してECサイトオーナー企業を自動収集します。
          Googleで検索し、ECプラットフォームを検出した企業のみをリストに追加します。
        </p>
      </div>

      {/* 業種選択 */}
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
                disabled={jobStatus === "running"}
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

      {/* 地域選択 */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">2</span>
          対象地域を設定（任意）
        </h3>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r || "all"}
              onClick={() => setRegion(r)}
              disabled={jobStatus === "running"}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                region === r
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-slate-300 text-slate-600 hover:border-purple-300 hover:text-purple-600"
              } disabled:opacity-50`}
            >
              {r ? <><MapPin size={11} /> {r}</> : "全国"}
            </button>
          ))}
        </div>
      </div>

      {/* 検出対象プラットフォーム */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">3</span>
          検出対象ECプラットフォーム
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {EC_PLATFORMS.map((p) => (
            <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
              🛒 {p}
            </span>
          ))}
          <span className="text-xs text-slate-400 self-center ml-1">など</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          ※ 収集後、サイトを解析してECプラットフォームを自動検出します。EC企業のみをリストに追加します。
        </p>
      </div>

      {/* 収集開始ボタン */}
      {jobStatus === "idle" && (
        <button
          onClick={startCollection}
          disabled={!selectedCategory || !currentProject}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Play size={16} />
          EC企業の収集を開始
          <ChevronRight size={16} />
        </button>
      )}
      {!currentProject && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle size={12} /> プロジェクトを選択してから収集を開始してください
        </p>
      )}

      {/* 進行状況 */}
      {jobStatus === "running" && (
        <div className="bg-white rounded-lg border border-purple-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="text-purple-500 animate-spin" />
              <span className="font-semibold text-slate-700 text-sm">EC企業を収集中...</span>
            </div>
            <button
              onClick={reset}
              className="text-xs text-slate-400 hover:text-slate-600 border border-slate-300 px-3 py-1 rounded-lg"
            >
              キャンセル
            </button>
          </div>
          <div className="space-y-2">
            <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-purple-500 h-3 rounded-full transition-all duration-500"
                style={{ width: progressTotal > 0 ? `${progressPct}%` : "30%" }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{progressMsg}</span>
              {progressTotal > 0 && (
                <span>{progressCurrent} / {progressTotal}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 完了 */}
      {jobStatus === "done" && result && (
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
            <a
              href="/companies?ec_only=true"
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink size={14} />
              EC企業一覧を確認
            </a>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={14} />
              もう一度収集
            </button>
          </div>
        </div>
      )}

      {/* エラー */}
      {jobStatus === "error" && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={16} />
            <span className="font-semibold text-sm">エラーが発生しました</span>
          </div>
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-red-700 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
          >
            <RefreshCw size={14} />
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
