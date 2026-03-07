import { useEffect, useState } from "react";
import { Sliders, Save, Loader2, CheckCircle, AlertCircle, Bot, FileDown, Database, Building2, MapPin, Bell, CreditCard } from "lucide-react";
import { api } from "../api";

type FlagKey =
  | "feature_ai_analysis"
  | "feature_csv_export"
  | "feature_master_db"
  | "feature_gbizinfo"
  | "feature_google_maps"
  | "feature_slack_notify"
  | "feature_self_upgrade";

type Flags = Record<FlagKey, boolean>;

const FLAG_META: Array<{
  key: FlagKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}> = [
  { key: "feature_ai_analysis", label: "AI企業分析", description: "OpenAI を使った企業ページのAI要約・分析機能を有効にします", icon: <Bot size={16} />, category: "AI機能" },
  { key: "feature_csv_export", label: "CSVエクスポート", description: "企業リストのCSVダウンロード機能を有効にします", icon: <FileDown size={16} />, category: "エクスポート機能" },
  { key: "feature_master_db", label: "マスターDB", description: "法人マスターデータベースのインポート・参照機能を有効にします", icon: <Database size={16} />, category: "収集機能" },
  { key: "feature_gbizinfo", label: "gBizINFO 法人DB収集", description: "経済産業省のgBizINFO APIを使った法人情報の自動収集を有効にします", icon: <Building2 size={16} />, category: "収集機能" },
  { key: "feature_google_maps", label: "Googleマップ収集", description: "Google Places API を使ったGoogleマップからの企業収集を有効にします", icon: <MapPin size={16} />, category: "収集機能" },
  { key: "feature_slack_notify", label: "Slack通知", description: "フォローアップ期限などのSlack通知機能を有効にします", icon: <Bell size={16} />, category: "通知機能" },
  { key: "feature_self_upgrade", label: "セルフアップグレード", description: "ユーザーがStripe経由で自分でプランをアップグレードできる機能を有効にします", icon: <CreditCard size={16} />, category: "課金機能" },
];

const categories = [...new Set(FLAG_META.map(f => f.category))];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4.5" : "translate-x-0.5"}`} style={{ transform: enabled ? "translateX(18px)" : "translateX(2px)" }} />
    </button>
  );
}

export default function AdminFeatures() {
  const [flags, setFlags] = useState<Flags>({
    feature_ai_analysis: true,
    feature_csv_export: true,
    feature_master_db: true,
    feature_gbizinfo: true,
    feature_google_maps: true,
    feature_slack_notify: true,
    feature_self_upgrade: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.adminFeatures.get().then(r => {
      setFlags(r as Flags);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await api.adminFeatures.save(flags);
      setSuccess("機能フラグを保存しました");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const setAllTo = (v: boolean) => {
    const next = { ...flags };
    FLAG_META.forEach(f => { next[f.key] = v; });
    setFlags(next);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sliders size={24} className="text-blue-600" />
            機能フラグ
          </h1>
          <p className="text-sm text-slate-500 mt-1">システム全体で有効/無効にする機能を管理します</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAllTo(true)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors">すべて有効</button>
          <button onClick={() => setAllTo(false)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-colors">すべて無効</button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 flex-shrink-0" />{success}</div>}

      <div className="space-y-4 mb-6">
        {categories.map(cat => (
          <div key={cat} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cat}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {FLAG_META.filter(f => f.category === cat).map(f => (
                <div key={f.key} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-lg ${flags[f.key] ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{f.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{f.description}</p>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <Toggle enabled={flags[f.key]} onChange={v => setFlags(prev => ({ ...prev, [f.key]: v }))} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          設定を保存
        </button>
      </div>
    </div>
  );
}
