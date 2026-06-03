import { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Search,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Trash2,
  ExternalLink,
  Video,
} from "lucide-react";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";

const RESULT_OPTIONS = [
  { label: "不在", color: "bg-slate-100 text-slate-700 border-slate-300", icon: "📵" },
  { label: "留守電", color: "bg-slate-100 text-slate-600 border-slate-300", icon: "📨" },
  { label: "折り返し", color: "bg-amber-100 text-amber-700 border-amber-300", icon: "🔄" },
  { label: "NG", color: "bg-red-100 text-red-700 border-red-300", icon: "🚫" },
  { label: "興味あり", color: "bg-blue-100 text-blue-700 border-blue-300", icon: "👍" },
  { label: "商談決定", color: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: "🎉" },
];

const RESULT_BADGE: Record<string, string> = {
  不在: "bg-slate-100 text-slate-600",
  留守電: "bg-slate-100 text-slate-600",
  折り返し: "bg-amber-100 text-amber-700",
  NG: "bg-red-100 text-red-700",
  興味あり: "bg-blue-100 text-blue-700",
  商談決定: "bg-emerald-100 text-emerald-700",
};

const RANK_COLOR: Record<string, string> = {
  A: "bg-red-500 text-white",
  B: "bg-orange-500 text-white",
  C: "bg-yellow-500 text-white",
  D: "bg-slate-400 text-white",
};

function toZoomPhoneUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  const e164 = digits.startsWith("0") ? "+81" + digits.slice(1) : "+" + digits;
  return `zoomus://phone?action=dial&phoneNumber=${encodeURIComponent(e164)}`;
}

function ScriptRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-sm text-slate-700 space-y-2 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="font-bold text-slate-800 mt-3 first:mt-0 text-xs uppercase tracking-wide text-blue-700">
              {line.replace("## ", "")}
            </p>
          );
        }
        if (!line.trim()) return null;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function TeleApo() {
  const { currentProject, projects } = useProject();

  const [companies, setCompanies] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [projectId, setProjectId] = useState<number | undefined>(undefined);

  const [selected, setSelected] = useState<any | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [script, setScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [stats, setStats] = useState({ total_today: 0, connected: 0, connect_rate: 0, appointments: 0, appointment_rate: 0 });

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentProject) setProjectId(currentProject.id);
  }, [currentProject]);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.teleApo.companies({
        project_id: projectId,
        score_rank: filterRank || undefined,
        status: filterStatus || undefined,
        search: search || undefined,
        limit: 200,
      });
      setCompanies(res.companies || []);
      setTotal(res.total || 0);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, filterRank, filterStatus, search]);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.teleApo.stats();
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    loadCompanies();
    loadStats();
  }, [loadCompanies, loadStats]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadCompanies(), 400);
  };

  const openPanel = async (co: any) => {
    setSelected(co);
    setPanelOpen(true);
    setNote("");
    setSavedResult("");
    setSaveSuccess(false);
    setScript("");
    setShowScript(false);
    setHistoryLoading(true);
    try {
      const res = await api.teleApo.logs(co.id);
      setCallHistory(res.logs || []);
    } catch {
      setCallHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveLog = async (result: string) => {
    if (!selected) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.teleApo.createLog({ company_id: selected.id, result, note });
      setSavedResult(result);
      setSaveSuccess(true);
      setNote("");
      await loadStats();
      const updated = { ...selected, last_call_result: result, last_called_at: new Date().toISOString() };
      setSelected(updated);
      setCompanies(prev => prev.map(c => c.id === selected.id ? updated : c));
      const res = await api.teleApo.logs(selected.id);
      setCallHistory(res.logs || []);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert("記録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!selected) return;
    setScriptLoading(true);
    setShowScript(true);
    try {
      const res = await api.teleApo.generateScript(selected.id);
      setScript(res.script || "");
    } catch {
      setScript("スクリプトの生成に失敗しました。");
    } finally {
      setScriptLoading(false);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm("この架電記録を削除しますか？")) return;
    try {
      await api.teleApo.deleteLog(logId);
      setCallHistory(prev => prev.filter(l => l.id !== logId));
      await loadStats();
    } catch {}
  };

  const formatDate = (s: string) => {
    if (!s) return "";
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header stats */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Phone size={18} className="text-blue-600" />
            テレアポ
          </h1>
          <button onClick={() => { loadCompanies(); loadStats(); }} className="text-slate-400 hover:text-slate-600 p-1">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "本日架電", value: stats.total_today, unit: "件" },
            { label: "接続率", value: `${stats.connect_rate}`, unit: "%" },
            { label: "アポ獲得", value: stats.appointments, unit: "件" },
            { label: "アポ率", value: `${stats.appointment_rate}`, unit: "%" },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-1.5">
              <p className="text-[9px] text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                {s.value}<span className="text-[10px] font-normal text-slate-500">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex gap-2 flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="会社名・電話番号"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={filterRank}
          onChange={e => setFilterRank(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:outline-none"
        >
          <option value="">全ランク</option>
          {["A", "B", "C", "D"].map(r => <option key={r} value={r}>{r}ランク</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:outline-none"
        >
          <option value="">全ステータス</option>
          {["未確認", "対象候補", "アプローチ前", "アプローチ済", "商談中", "成約", "NG"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {projects.length > 1 && (
          <select
            value={projectId || ""}
            onChange={e => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:outline-none"
          >
            <option value="">全プロジェクト</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Company list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Phone size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">電話番号のある企業がありません</p>
            <p className="text-xs mt-1">企業情報に電話番号を登録してください</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {companies.map(co => (
              <button
                key={co.id}
                onClick={() => openPanel(co)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3"
              >
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${RANK_COLOR[co.score_rank] || "bg-slate-300 text-white"}`}>
                    {co.score_rank}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{co.company_name}</p>
                    {co.last_call_result && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_BADGE[co.last_call_result] || "bg-slate-100 text-slate-600"}`}>
                        {co.last_call_result}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">{co.phone}</span>
                    {co.prefecture && <span className="text-[10px] text-slate-400">{co.prefecture}</span>}
                    {co.last_called_at && (
                      <span className="text-[10px] text-slate-400">最終: {formatDate(co.last_called_at)}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        <p className="text-center text-[10px] text-slate-400 py-3">{total}件中{companies.length}件表示</p>
      </div>

      {/* Call panel (slide-over on mobile, side panel on desktop) */}
      {panelOpen && selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setPanelOpen(false)} />
          <div className="w-full max-w-md bg-white dark:bg-slate-800 flex flex-col shadow-2xl overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${RANK_COLOR[selected.score_rank] || "bg-slate-300 text-white"}`}>
                  {selected.score_rank}
                </span>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{selected.company_name}</p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Phone number — big, clickable */}
              <div className="px-4 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                <div className="flex gap-2">
                  <a
                    href={`tel:${selected.phone}`}
                    className="flex-1 flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 transition-colors"
                  >
                    <PhoneCall size={20} />
                    <div>
                      <p className="text-xs opacity-80 mb-0.5">電話で発信</p>
                      <p className="text-lg font-bold tracking-wider font-mono">{selected.phone}</p>
                    </div>
                  </a>
                  <a
                    href={toZoomPhoneUrl(selected.phone)}
                    title="Zoom Phoneで発信"
                    className="flex flex-col items-center justify-center gap-1 bg-[#2D8CFF] hover:bg-[#1a7ae0] text-white rounded-xl px-4 py-3 transition-colors flex-shrink-0"
                  >
                    <Video size={20} />
                    <span className="text-xs font-bold leading-none">Zoom</span>
                  </a>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap text-xs">
                  {selected.category_main && <span className="text-slate-500">{selected.category_main}</span>}
                  {selected.status && <span className="text-slate-500">ステータス: {selected.status}</span>}
                  {selected.contact_name && (
                    <span className="text-slate-600">担当: {selected.contact_title && `${selected.contact_title} `}{selected.contact_name}</span>
                  )}
                  {selected.website_url && (
                    <a href={selected.website_url} target="_blank" rel="noopener noreferrer"
                       className="text-blue-600 flex items-center gap-0.5">
                      <ExternalLink size={10} />サイト
                    </a>
                  )}
                </div>
              </div>

              {/* AI Script */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setShowScript(v => !v)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
                >
                  <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-purple-500" />AIトークスクリプト</span>
                  <ChevronDown size={14} className={`transition-transform ${showScript ? "rotate-180" : ""}`} />
                </button>
                {showScript && (
                  <div>
                    {!script && !scriptLoading && (
                      <button
                        onClick={handleGenerateScript}
                        className="w-full py-2 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Sparkles size={13} />スクリプトを生成
                      </button>
                    )}
                    {scriptLoading && (
                      <div className="flex items-center justify-center py-4 text-purple-600">
                        <Loader2 size={18} className="animate-spin mr-2" />
                        <span className="text-xs">生成中…</span>
                      </div>
                    )}
                    {script && !scriptLoading && (
                      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-xs relative">
                        <ScriptRenderer text={script} />
                        <button
                          onClick={handleGenerateScript}
                          className="mt-2 text-[10px] text-purple-600 flex items-center gap-1"
                        >
                          <RefreshCw size={10} />再生成
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Result recording */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-green-600" />架電結果を記録
                </p>
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs mb-2 bg-emerald-50 px-2 py-1.5 rounded-lg">
                    <CheckCircle2 size={13} />「{savedResult}」を記録しました
                  </div>
                )}
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="メモ（任意）"
                  rows={2}
                  className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-blue-400 resize-none mb-2"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {RESULT_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => handleSaveLog(opt.label)}
                      disabled={saving}
                      className={`flex flex-col items-center justify-center py-2 px-1 text-xs font-medium border rounded-lg transition-all ${opt.color} ${saving ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 active:scale-95"}`}
                    >
                      <span className="text-base mb-0.5">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Call history */}
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">架電履歴</p>
                {historyLoading ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                ) : callHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">まだ架電記録がありません</p>
                ) : (
                  <div className="space-y-1.5">
                    {callHistory.map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-xs bg-slate-50 dark:bg-slate-700 rounded-lg px-2.5 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${RESULT_BADGE[log.result] || "bg-slate-100 text-slate-600"}`}>
                          {log.result}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-500 text-[10px]">{formatDate(log.called_at)} · {log.caller_name}</p>
                          {log.note && <p className="text-slate-700 dark:text-slate-300 mt-0.5 truncate">{log.note}</p>}
                        </div>
                        <button onClick={() => handleDeleteLog(log.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
