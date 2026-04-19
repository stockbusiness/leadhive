import { useEffect, useState, useRef } from "react";
import { Star, RotateCcw, Save, Info, TrendingUp, TrendingDown, RefreshCw, ShoppingBag, History, CheckCircle2 } from "lucide-react";

const RULE_LABELS: Record<string, string> = {
  ec_flag: "ECサイト判定",
  escms_target_flag: "ESCMS対象フラグ",
  shopify_flag: "Shopify利用",
  production_flag: "制作系フラグ",
  consulting_flag: "コンサル系フラグ",
  operation_flag: "運用系フラグ",
  contact_url: "問い合わせURL有り",
  multi_platform: "複数ECモール利用",
  sns_count_3: "SNS 3件以上",
  has_recruitment: "採用情報有り",
  sns_count_1: "SNS 1件以上",
  phone: "電話番号有り",
  location: "所在地情報有り",
  info_missing_penalty: "情報不足ペナルティ",
  no_contact_penalty: "問い合わせ無しペナルティ",
  not_ec_related_penalty: "EC無関係ペナルティ",
};

type Rules = Record<string, number>;
type RescoreStatus = { running: boolean; done: number; total: number; updated_companies: number; updated_masters: number };
type EcDetectStatus = { running: boolean; done: number; total: number; updated: number; updated_master: number; skipped: number; errors: number; include_master: boolean };
type EcDetectHistoryEntry = { started_at: string; finished_at: string; only_missing: boolean; include_master: boolean; total: number; updated: number; updated_master: number; skipped: number; errors: number };

export default function AdminScoringRules() {
  const [rules, setRules] = useState<Rules>({});
  const [defaults, setDefaults] = useState<Rules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreStatus, setRescoreStatus] = useState<RescoreStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ecDetecting, setEcDetecting] = useState(false);
  const [ecDetectStatus, setEcDetectStatus] = useState<EcDetectStatus | null>(null);
  const ecPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [includeMaster, setIncludeMaster] = useState(true);
  const [ecHistory, setEcHistory] = useState<EcDetectHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [rulesRes, histRes] = await Promise.all([
        fetch("/api/admin/scoring-rules"),
        fetch("/api/admin/ec-detect-bulk/history"),
      ]);
      const rulesData = await rulesRes.json();
      setRules(rulesData.rules ?? {});
      setDefaults(rulesData.defaults ?? {});
      const histData = await histRes.json();
      setEcHistory(histData.history ?? []);
    } catch {
      setMessage({ type: "err", text: "読み込みに失敗しました" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key: string, val: string) => {
    const num = parseInt(val, 10);
    setRules((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/scoring-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        setMessage({ type: "ok", text: "保存しました" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "err", text: "保存に失敗しました" });
      }
    } catch {
      setMessage({ type: "err", text: "保存に失敗しました" });
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm("デフォルト値に戻しますか？")) return;
    setSaving(true);
    try {
      await fetch("/api/admin/scoring-rules/reset", { method: "POST" });
      await load();
      setMessage({ type: "ok", text: "デフォルト値に戻しました" });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "err", text: "リセットに失敗しました" });
    }
    setSaving(false);
  };

  const handleRescore = async () => {
    if (!confirm("現在のスコアリングルールで全企業のスコアを再計算します。よろしいですか？")) return;
    setRescoring(true);
    setRescoreStatus(null);
    try {
      const res = await fetch("/api/admin/scoring-rules/bulk-rescore", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setMessage({ type: "err", text: data.message || "再スコアリングを開始できませんでした" });
        setRescoring(false);
        return;
      }
      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch("/api/admin/scoring-rules/bulk-rescore/status").then(r => r.json());
          setRescoreStatus(sr);
          if (!sr.running) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRescoring(false);
            setMessage({ type: "ok", text: `再スコアリング完了: 企業${sr.updated_companies}件 / マスター${sr.updated_masters}件を更新しました` });
            setTimeout(() => setMessage(null), 6000);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setRescoring(false);
        }
      }, 1500);
    } catch {
      setMessage({ type: "err", text: "再スコアリングの開始に失敗しました" });
      setRescoring(false);
    }
  };

  const handleEcDetect = async (onlyMissing: boolean) => {
    const label = onlyMissing ? "CMS未検出の企業のみ" : "全企業";
    const masterNote = includeMaster ? "（マスターDB含む）" : "";
    if (!confirm(`${label}${masterNote}のWebサイトを再スキャンしてECプラットフォームを検出します。よろしいですか？`)) return;
    setEcDetecting(true);
    setEcDetectStatus(null);
    try {
      const res = await fetch(
        `/api/admin/ec-detect-bulk?only_missing=${onlyMissing}&include_master=${includeMaster}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!data.ok) {
        setMessage({ type: "err", text: data.message || "EC検出を開始できませんでした" });
        setEcDetecting(false);
        return;
      }
      ecPollRef.current = setInterval(async () => {
        try {
          const sr: EcDetectStatus = await fetch("/api/admin/ec-detect-bulk/status").then(r => r.json());
          setEcDetectStatus(sr);
          if (!sr.running) {
            if (ecPollRef.current) clearInterval(ecPollRef.current);
            setEcDetecting(false);
            const masterMsg = sr.include_master ? ` / マスター${sr.updated_master}件更新` : "";
            setMessage({ type: "ok", text: `EC再検出完了: 企業${sr.updated}件更新${masterMsg} / スキップ${sr.skipped}件 / エラー${sr.errors}件` });
            setTimeout(() => setMessage(null), 8000);
            // 履歴を更新
            const histData = await fetch("/api/admin/ec-detect-bulk/history").then(r => r.json());
            setEcHistory(histData.history ?? []);
          }
        } catch {
          if (ecPollRef.current) clearInterval(ecPollRef.current);
          setEcDetecting(false);
        }
      }, 2000);
    } catch {
      setMessage({ type: "err", text: "EC再検出の開始に失敗しました" });
      setEcDetecting(false);
    }
  };

  const positive = Object.entries(rules).filter(([, v]) => v >= 0);
  const negative = Object.entries(rules).filter(([, v]) => v < 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
            <Star size={22} className="text-yellow-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">スコアリングルール編集</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">企業スコア計算のポイント設定（0〜100点にクランプ）</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRescore}
            disabled={rescoring || saving}
            className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg text-sm hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={rescoring ? "animate-spin" : ""} />
            {rescoring ? "再計算中..." : "全企業を再スコアリング"}
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <RotateCcw size={14} />
            リセット
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${message.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {rescoring && rescoreStatus && rescoreStatus.total > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 space-y-1">
          <div className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-400">
            <span>再スコアリング進捗</span>
            <span>{rescoreStatus.done} / {rescoreStatus.total} 件</span>
          </div>
          <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-2">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.round((rescoreStatus.done / rescoreStatus.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">ECプラットフォーム一括再検出</h2>
          </div>
          {ecHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <History size={13} />
              {showHistory ? "履歴を隠す" : `実行履歴 (${ecHistory.length}件)`}
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          既存企業のWebサイトを再スキャンし、CMS種別（Shopify・BASE・WooCommerce等）とECフラグを更新します。
        </p>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeMaster}
            onChange={e => setIncludeMaster(e.target.checked)}
            className="w-4 h-4 accent-emerald-600"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">マスターDBも対象に含める</span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleEcDetect(true)}
            disabled={ecDetecting || rescoring}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={ecDetecting ? "animate-spin" : ""} />
            {ecDetecting ? "検出中..." : "未検出企業を再スキャン"}
          </button>
          <button
            onClick={() => handleEcDetect(false)}
            disabled={ecDetecting || rescoring}
            className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} />
            全企業を再スキャン
          </button>
        </div>

        {ecDetecting && ecDetectStatus && ecDetectStatus.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
              <span>EC検出進捗</span>
              <span>
                {ecDetectStatus.done} / {ecDetectStatus.total} 件
                （企業 {ecDetectStatus.updated}更新
                {ecDetectStatus.include_master ? ` / マスター ${ecDetectStatus.updated_master}更新` : ""}
                / エラー {ecDetectStatus.errors}）
              </span>
            </div>
            <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.round((ecDetectStatus.done / ecDetectStatus.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {showHistory && ecHistory.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">実行履歴</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ecHistory.map((h, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2.5">
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">
                        {new Date(h.started_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                        {h.only_missing ? "未検出のみ" : "全件"}
                      </span>
                      {h.include_master && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          マスター含む
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      対象 {h.total}件 → 企業 {h.updated}更新
                      {h.include_master ? ` / マスター ${h.updated_master}更新` : ""}
                      {h.errors > 0 && <span className="text-red-500 ml-1">/ エラー {h.errors}件</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 flex gap-2 text-sm text-blue-700 dark:text-blue-300">
        <Info size={15} className="flex-shrink-0 mt-0.5" />
        <span>変更したルールは新しいスコア計算（スクレイピング・再計算）時から適用されます。既存企業のスコアは次回のスコア再計算時に更新されます。</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">読み込み中...</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
              <TrendingUp size={15} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">加点ルール</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {positive.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {RULE_LABELS[key] ?? key}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {defaults[key] !== undefined && val !== defaults[key] && (
                      <span className="text-xs text-slate-400">デフォ: {defaults[key]}</span>
                    )}
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-20 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-slate-400 w-6">pt</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
              <TrendingDown size={15} className="text-red-600" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">減点ルール（ペナルティ）</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {negative.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {RULE_LABELS[key] ?? key}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {defaults[key] !== undefined && val !== defaults[key] && (
                      <span className="text-xs text-slate-400">デフォ: {defaults[key]}</span>
                    )}
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-20 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-slate-400 w-6">pt</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
