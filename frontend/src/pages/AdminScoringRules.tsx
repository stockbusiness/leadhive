import { useEffect, useState } from "react";
import { Star, RotateCcw, Save, Info, TrendingUp, TrendingDown } from "lucide-react";

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

export default function AdminScoringRules() {
  const [rules, setRules] = useState<Rules>({});
  const [defaults, setDefaults] = useState<Rules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scoring-rules");
      const data = await res.json();
      setRules(data.rules ?? {});
      setDefaults(data.defaults ?? {});
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
