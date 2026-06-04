import { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone, PhoneCall, Search, ChevronRight, ChevronLeft, X, Loader2,
  RefreshCw, Sparkles, ClipboardList, CheckCircle2, ChevronDown,
  Trash2, ExternalLink, Video, Copy, Check, Clock, Users, BarChart2,
  Download, Bell, BookOpen, Save, ChevronUp, ArrowRight, AlertCircle,
} from "lucide-react";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import { useAuth } from "../contexts/AuthContext";

const RESULT_OPTIONS = [
  { label: "不在",     color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500", icon: "📵", key: "1" },
  { label: "留守電",   color: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500", icon: "📨", key: "2" },
  { label: "折り返し", color: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700", icon: "🔄", key: "3" },
  { label: "NG",       color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700", icon: "🚫", key: "4" },
  { label: "興味あり", color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700", icon: "👍", key: "5" },
  { label: "商談決定", color: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700", icon: "🎉", key: "6" },
];

const RESULT_BADGE: Record<string, string> = {
  不在: "bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-200",
  留守電: "bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-200",
  折り返し: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  NG: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  興味あり: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  商談決定: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const RANK_COLOR: Record<string, string> = {
  A: "bg-red-500 text-white", B: "bg-orange-500 text-white",
  C: "bg-yellow-500 text-white", D: "bg-slate-400 text-white",
};

function toZoomPhoneUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  const e164 = digits.startsWith("0") ? "+81" + digits.slice(1) : "+" + digits;
  return `zoomus://phone?action=dial&phoneNumber=${encodeURIComponent(e164)}`;
}

function ScriptRenderer({ text }: { text: string }) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-200 space-y-2 leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return <p key={i} className="font-bold text-[11px] uppercase tracking-wide text-blue-700 dark:text-blue-400 mt-3 first:mt-0">{line.replace("## ", "")}</p>;
        if (!line.trim()) return null;
        return <p key={i} className="text-xs">{line}</p>;
      })}
    </div>
  );
}

function MiniBarChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map(d => (
        <div key={d.label} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full bg-blue-400 dark:bg-blue-500 rounded-t-sm"
            style={{ height: `${Math.max((d.total / max) * 32, d.total > 0 ? 4 : 1)}px` }}
            title={`${d.label}: ${d.total}件`}
          />
          <span className="text-[8px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function TeleApo() {
  const { currentProject, projects } = useProject();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "system_admin" || user?.is_system_admin;

  const [companies, setCompanies] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRank, setFilterRank] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState("score");
  const [excludeNg, setExcludeNg] = useState(false);

  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [panelOpen, setPanelOpen] = useState(false);
  const selected = selectedIdx >= 0 ? companies[selectedIdx] ?? null : null;

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [script, setScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [stats, setStats] = useState({ total_today: 0, connected: 0, connect_rate: 0, appointments: 0, appointment_rate: 0, daily: [] as any[] });
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [callbackAt, setCallbackAt] = useState("");
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);

  const [activeTab, setActiveTab] = useState<"list" | "callbacks" | "insights">("list");
  const [callbacks, setCallbacks] = useState<any[]>([]);
  const [callbacksLoading, setCallbacksLoading] = useState(false);

  const [teamStats, setTeamStats] = useState<any>(null);
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);
  const [showTeamStats, setShowTeamStats] = useState(false);

  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [customTemplate, setCustomTemplate] = useState("");
  const [showTemplateEdit, setShowTemplateEdit] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const [exportDays, setExportDays] = useState(30);
  const [exporting, setExporting] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (currentProject) setProjectId(currentProject.id);
  }, [currentProject]);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.teleApo.companies({
        project_id: projectId, score_rank: filterRank || undefined,
        status: filterStatus || undefined, search: search || undefined,
        sort, exclude_ng: excludeNg, limit: 200,
      });
      setCompanies(res.companies || []);
      setTotal(res.total || 0);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, filterRank, filterStatus, search, sort, excludeNg]);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.teleApo.stats(7);
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => { loadCompanies(); loadStats(); }, [loadCompanies, loadStats]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadCompanies(), 400);
  };

  const openPanel = async (idx: number) => {
    const co = companies[idx];
    if (!co) return;
    setSelectedIdx(idx);
    setPanelOpen(true);
    setNote(""); setSavedResult(""); setSaveSuccess(false);
    setScript(""); setShowScript(false); setScriptCopied(false);
    setCallbackAt(""); setShowCallbackPicker(false);
    stopTimer();
    setHistoryLoading(true);
    try {
      const res = await api.teleApo.logs(co.id);
      setCallHistory(res.logs || []);
    } catch { setCallHistory([]); }
    finally { setHistoryLoading(false); }
  };

  const handlePrev = () => { if (selectedIdx > 0) openPanel(selectedIdx - 1); };
  const handleNext = () => { if (selectedIdx < companies.length - 1) openPanel(selectedIdx + 1); };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimerRunning(false);
  };
  const startTimer = () => {
    setTimerSeconds(0);
    setTimerRunning(true);
    timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
  };
  const toggleTimer = () => { if (timerRunning) stopTimer(); else startTimer(); };
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleSaveLog = async (result: string) => {
    if (!selected) return;
    setSaving(true); setSaveSuccess(false);
    const duration = timerRunning || timerSeconds > 0 ? timerSeconds : undefined;
    stopTimer();
    try {
      await api.teleApo.createLog({
        company_id: selected.id, result, note,
        call_duration: duration,
        callback_at: (result === "折り返し" && callbackAt) ? new Date(callbackAt).toISOString() : undefined,
      });
      setSavedResult(result); setSaveSuccess(true); setNote("");
      await loadStats();
      const updated = { ...selected, last_call_result: result, last_called_at: new Date().toISOString() };
      setSelectedIdx(prev => prev);
      setCompanies(prev => prev.map((c, i) => i === selectedIdx ? updated : c));
      const res = await api.teleApo.logs(selected.id);
      setCallHistory(res.logs || []);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch { alert("記録に失敗しました"); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const opt = RESULT_OPTIONS.find(o => o.key === e.key);
      if (opt && !saving) handleSaveLog(opt.label);
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelOpen, selected, saving, selectedIdx]);

  const handleGenerateScript = async () => {
    if (!selected) return;
    setScriptLoading(true); setShowScript(true);
    try {
      const res = await api.teleApo.generateScript(selected.id);
      setScript(res.script || "");
    } catch { setScript("スクリプトの生成に失敗しました。"); }
    finally { setScriptLoading(false); }
  };

  const handleCopyScript = async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm("この架電記録を削除しますか？")) return;
    try {
      await api.teleApo.deleteLog(logId);
      setCallHistory(prev => prev.filter(l => l.id !== logId));
      await loadStats();
    } catch {}
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.teleApo.exportCsv(exportDays);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `call_logs_${new Date().toISOString().split("T")[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert("エクスポートに失敗しました"); }
    finally { setExporting(false); }
  };

  const loadCallbacks = async () => {
    setCallbacksLoading(true);
    try {
      const res = await api.teleApo.callbacks();
      setCallbacks(res.callbacks || []);
    } catch { setCallbacks([]); }
    finally { setCallbacksLoading(false); }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await api.teleApo.insights(30);
      setInsights(res);
    } catch {}
    finally { setInsightsLoading(false); }
  };

  const loadTeamStats = async () => {
    setTeamStatsLoading(true);
    try {
      const res = await api.teleApo.teamStats(7);
      setTeamStats(res);
    } catch {}
    finally { setTeamStatsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "callbacks") loadCallbacks();
    if (activeTab === "insights") loadInsights();
  }, [activeTab]);

  const handleSaveTemplate = async () => {
    try {
      await api.teleApo.saveScriptTemplate(customTemplate);
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 2000);
    } catch {}
  };

  useEffect(() => {
    api.teleApo.getScriptTemplate().then(r => setCustomTemplate(r.template || "")).catch(() => {});
  }, []);

  const formatDate = (s: string) => {
    if (!s) return "";
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const pendingCallbacks = companies.filter(c => c.pending_callback).length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* ── Header stats ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Phone size={18} className="text-blue-600" />テレアポ
          </h1>
          <div className="flex items-center gap-1.5">
            {pendingCallbacks > 0 && (
              <button
                onClick={() => setActiveTab("callbacks")}
                className="relative flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-1 rounded-full"
              >
                <Bell size={11} />折り返し {pendingCallbacks}件
              </button>
            )}
            {isAdmin && (
              <button onClick={() => { setShowTeamStats(true); loadTeamStats(); }} className="text-slate-400 hover:text-blue-600 p-1" title="チーム統計">
                <Users size={15} />
              </button>
            )}
            <button onClick={() => setShowWeeklyChart(v => !v)} className="text-slate-400 hover:text-blue-600 p-1" title="週次グラフ">
              <BarChart2 size={15} />
            </button>
            <button onClick={() => { loadCompanies(); loadStats(); }} className="text-slate-400 hover:text-slate-600 p-1">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Today's stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "本日架電", value: stats.total_today, unit: "件" },
            { label: "接続率",   value: `${stats.connect_rate}`,    unit: "%" },
            { label: "アポ獲得", value: stats.appointments,          unit: "件" },
            { label: "アポ率",   value: `${stats.appointment_rate}`, unit: "%" },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-1.5">
              <p className="text-[9px] text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                {s.value}<span className="text-[10px] font-normal text-slate-500">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* O6: Weekly mini chart */}
        {showWeeklyChart && stats.daily.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <p className="text-[10px] text-slate-400 mb-1">過去7日間の架電数</p>
            <MiniBarChart data={stats.daily} />
          </div>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 flex gap-1 flex-shrink-0">
        {[
          { key: "list", label: "架電リスト" },
          { key: "callbacks", label: `折り返し${callbacks.length > 0 ? ` (${callbacks.length})` : ""}` },
          { key: "insights", label: "ベストタイム" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`text-xs py-2 px-3 border-b-2 transition-colors ${activeTab === t.key ? "border-blue-500 text-blue-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Filters (list tab only) ───────────────────────────────── */}
      {activeTab === "list" && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex gap-2 flex-shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[120px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="会社名・電話番号"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-blue-400" />
          </div>
          <select value={filterRank} onChange={e => setFilterRank(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:outline-none">
            <option value="">全ランク</option>
            {["A","B","C","D"].map(r => <option key={r} value={r}>{r}ランク</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:outline-none">
            <option value="">全ステータス</option>
            {["未確認","対象候補","アプローチ前","アプローチ済","商談中","成約","NG"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {/* O3: Sort */}
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:outline-none">
            <option value="score">スコア順</option>
            <option value="uncalled_first">未架電優先</option>
            <option value="last_called">未架電→古い順</option>
          </select>
          {projects.length > 1 && (
            <select value={projectId || ""} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-white focus:outline-none">
              <option value="">全プロジェクト</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {/* E5: Exclude NG */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={excludeNg} onChange={e => setExcludeNg(e.target.checked)} className="rounded" />
            NG除外
          </label>
          {/* E6: CSV export */}
          <button onClick={handleExportCsv} disabled={exporting}
            className="flex items-center gap-1 text-xs px-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50">
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}CSV
          </button>
        </div>
      )}

      {/* ── Company list ─────────────────────────────────────────── */}
      {activeTab === "list" && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Phone size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">電話番号のある企業がありません</p>
              <p className="text-xs mt-1">企業情報に電話番号を登録してください</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {companies.map((co, idx) => (
                <button key={co.id} onClick={() => openPanel(idx)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${RANK_COLOR[co.score_rank] || "bg-slate-300 text-white"}`}>
                    {co.score_rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{co.company_name}</p>
                      {co.last_call_result && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULT_BADGE[co.last_call_result] || "bg-slate-100 text-slate-600"}`}>
                          {co.last_call_result}
                        </span>
                      )}
                      {co.pending_callback && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          📞折り返し
                        </span>
                      )}
                      {!co.last_called_at && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300">未架電</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">{co.phone}</span>
                      {co.prefecture && <span className="text-[10px] text-slate-400">{co.prefecture}</span>}
                      {co.last_called_at && <span className="text-[10px] text-slate-400">最終: {formatDate(co.last_called_at)}</span>}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
          <p className="text-center text-[10px] text-slate-400 py-3">{total}件中{companies.length}件表示</p>
        </div>
      )}

      {/* ── Callbacks tab (E1) ───────────────────────────────────── */}
      {activeTab === "callbacks" && (
        <div className="flex-1 overflow-y-auto">
          {callbacksLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : callbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Bell size={40} className="mb-3 opacity-30" />
              <p className="text-sm">折り返し予定はありません</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {callbacks.map(cb => (
                <div key={cb.log_id} className={`px-4 py-3 flex items-center gap-3 ${cb.is_overdue ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${RANK_COLOR[cb.score_rank] || "bg-slate-300 text-white"}`}>
                    {cb.score_rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white">{cb.company_name}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">{cb.phone}</p>
                    <p className={`text-xs mt-0.5 ${cb.is_overdue ? "text-red-600 font-medium" : "text-slate-500"}`}>
                      {cb.is_overdue ? "⚠️ 期限超過: " : "📅 "}
                      {formatDate(cb.callback_at)}
                    </p>
                    {cb.note && <p className="text-[10px] text-slate-400 truncate mt-0.5">{cb.note}</p>}
                  </div>
                  <a href={`tel:${cb.phone}`}
                    className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2">
                    <PhoneCall size={16} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Insights tab (E8) ────────────────────────────────────── */}
      {activeTab === "insights" && (
        <div className="flex-1 overflow-y-auto p-4">
          {insightsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : !insights ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <BarChart2 size={40} className="text-slate-300" />
              <p className="text-sm text-slate-400">30日間のデータを分析します</p>
              <button onClick={loadInsights} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">分析する</button>
            </div>
          ) : (
            <div className="space-y-5">
              {(insights.best_hour || insights.best_dow) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-1">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-300">💡 架電ベストタイム</p>
                  {insights.best_hour && (
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      時間帯: <strong>{insights.best_hour.label}</strong>（接続率 {insights.best_hour.connect_rate}%）
                    </p>
                  )}
                  {insights.best_dow && (
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      曜日: <strong>{insights.best_dow.label}曜日</strong>（接続率 {insights.best_dow.connect_rate}%）
                    </p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">時間帯別 接続率</p>
                <div className="space-y-1">
                  {insights.by_hour.filter((h: any) => h.total > 0).map((h: any) => (
                    <div key={h.key} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-10 flex-shrink-0">{h.label}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                        <div className="h-full bg-blue-400 dark:bg-blue-500 rounded-full flex items-center justify-end pr-1"
                          style={{ width: `${Math.max(h.connect_rate, 5)}%` }}>
                          <span className="text-[9px] text-white font-bold">{h.connect_rate}%</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 w-8 flex-shrink-0">{h.total}件</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">曜日別 接続率</p>
                <div className="grid grid-cols-7 gap-1">
                  {insights.by_dow.map((d: any) => (
                    <div key={d.key} className="text-center">
                      <p className="text-[10px] text-slate-500">{d.label}</p>
                      <div className={`text-xs font-bold py-1.5 rounded-lg ${d.connect_rate >= 50 ? "bg-green-100 text-green-700" : d.connect_rate >= 30 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                        {d.total > 0 ? `${d.connect_rate}%` : "-"}
                      </div>
                      <p className="text-[9px] text-slate-400">{d.total}件</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Team Stats Modal (E3) ─────────────────────────────────── */}
      {showTeamStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Users size={16} />チーム架電統計（直近7日間）</h2>
              <button onClick={() => setShowTeamStats(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {teamStatsLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
              ) : !teamStats || !teamStats.members?.length ? (
                <p className="text-center text-slate-400 py-8">データがありません</p>
              ) : (
                <div className="space-y-2">
                  {teamStats.members.map((m: any, i: number) => (
                    <div key={m.user_id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-slate-300"}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-white">{m.name}</p>
                        <p className="text-xs text-slate-500">接続率 {m.connect_rate}% / アポ率 {m.appointment_rate}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{m.appointments}件 🎉</p>
                        <p className="text-[10px] text-slate-400">{m.total}架電</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Call panel ───────────────────────────────────────────── */}
      {panelOpen && selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setPanelOpen(false)} />
          <div className="w-full max-w-md bg-white dark:bg-slate-800 flex flex-col shadow-2xl overflow-hidden">

            {/* Panel header + O2 prev/next */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={handlePrev} disabled={selectedIdx === 0}
                  className="text-slate-400 hover:text-blue-600 disabled:opacity-30 flex-shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${RANK_COLOR[selected.score_rank] || "bg-slate-300 text-white"}`}>
                  {selected.score_rank}
                </span>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{selected.company_name}</p>
                <span className="text-[10px] text-slate-400 flex-shrink-0">{selectedIdx + 1}/{companies.length}</span>
                <button onClick={handleNext} disabled={selectedIdx === companies.length - 1}
                  className="text-slate-400 hover:text-blue-600 disabled:opacity-30 flex-shrink-0">
                  <ChevronRight size={18} />
                </button>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Phone + E2 timer */}
              <div className="px-4 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                <div className="flex gap-2">
                  <a href={`tel:${selected.phone}`} onClick={() => { if (!timerRunning) startTimer(); }}
                    className="flex-1 flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 transition-colors">
                    <PhoneCall size={20} />
                    <div>
                      <p className="text-xs opacity-80 mb-0.5">電話で発信</p>
                      <p className="text-lg font-bold tracking-wider font-mono">{selected.phone}</p>
                    </div>
                  </a>
                  <a href={toZoomPhoneUrl(selected.phone)} onClick={() => { if (!timerRunning) startTimer(); }}
                    title="Zoom Phoneで発信"
                    className="flex flex-col items-center justify-center gap-1 bg-[#2D8CFF] hover:bg-[#1a7ae0] text-white rounded-xl px-4 py-3 transition-colors flex-shrink-0">
                    <Video size={20} />
                    <span className="text-xs font-bold leading-none">Zoom</span>
                  </a>
                </div>
                {/* E2: timer display */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    {selected.category_main && <span>{selected.category_main}</span>}
                    {selected.status && <span>ステータス: {selected.status}</span>}
                    {selected.contact_name && <span className="text-slate-600">担当: {selected.contact_title && `${selected.contact_title} `}{selected.contact_name}</span>}
                    {selected.website_url && (
                      <a href={selected.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 flex items-center gap-0.5">
                        <ExternalLink size={10} />サイト
                      </a>
                    )}
                  </div>
                  <button onClick={toggleTimer}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-mono ${timerRunning ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                    <Clock size={11} />{formatTimer(timerSeconds)}
                  </button>
                </div>
              </div>

              {/* E4: Script template editor */}
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <button onClick={() => setShowTemplateEdit(v => !v)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                  <BookOpen size={11} />スクリプトテンプレート
                  {showTemplateEdit ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {showTemplateEdit && (
                  <div className="mt-2">
                    <textarea value={customTemplate} onChange={e => setCustomTemplate(e.target.value)}
                      rows={4} placeholder="共通トーク要素を記入（AIスクリプト生成時に参考にします）"
                      className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none resize-none" />
                    <button onClick={handleSaveTemplate}
                      className={`mt-1 flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${templateSaved ? "bg-green-100 text-green-700" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
                      {templateSaved ? <Check size={11} /> : <Save size={11} />}
                      {templateSaved ? "保存しました" : "テンプレートを保存"}
                    </button>
                  </div>
                )}
              </div>

              {/* AI Script + O5 copy */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <button onClick={() => setShowScript(v => !v)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-purple-500" />AIトークスクリプト</span>
                  <ChevronDown size={14} className={`transition-transform ${showScript ? "rotate-180" : ""}`} />
                </button>
                {showScript && (
                  <div>
                    {!script && !scriptLoading && (
                      <button onClick={handleGenerateScript}
                        className="w-full py-2 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5">
                        <Sparkles size={13} />スクリプトを生成
                      </button>
                    )}
                    {scriptLoading && (
                      <div className="flex items-center justify-center py-4 text-purple-600">
                        <Loader2 size={18} className="animate-spin mr-2" /><span className="text-xs">生成中…</span>
                      </div>
                    )}
                    {script && !scriptLoading && (
                      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-xs relative">
                        <ScriptRenderer text={script} />
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={handleGenerateScript} className="text-[10px] text-purple-600 flex items-center gap-1">
                            <RefreshCw size={10} />再生成
                          </button>
                          <button onClick={handleCopyScript}
                            className={`text-[10px] flex items-center gap-1 ${scriptCopied ? "text-green-600" : "text-slate-500 hover:text-slate-700"}`}>
                            {scriptCopied ? <Check size={10} /> : <Copy size={10} />}
                            {scriptCopied ? "コピー済み" : "コピー"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* E1: Callback picker */}
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <button onClick={() => setShowCallbackPicker(v => !v)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600">
                  <Bell size={11} />折り返し予約
                  {showCallbackPicker ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {showCallbackPicker && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="datetime-local" value={callbackAt} onChange={e => setCallbackAt(e.target.value)}
                      className="flex-1 text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none" />
                    <span className="text-[10px] text-slate-400">結果「折り返し」で記録時に保存</span>
                  </div>
                )}
              </div>

              {/* Result recording + O4 keyboard hint */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <ClipboardList size={14} className="text-green-600" />架電結果を記録
                  </p>
                  <span className="text-[10px] text-slate-400">キー 1〜6 で即記録</span>
                </div>
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs mb-2 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5 rounded-lg">
                    <CheckCircle2 size={13} />「{savedResult}」を記録しました
                    {timerSeconds > 0 && <span className="text-[10px] text-slate-400 ml-1">（{formatTimer(timerSeconds)}）</span>}
                  </div>
                )}
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="メモ（任意）" rows={2}
                  className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-blue-400 resize-none mb-2" />
                <div className="grid grid-cols-3 gap-1.5">
                  {RESULT_OPTIONS.map(opt => (
                    <button key={opt.label} onClick={() => handleSaveLog(opt.label)} disabled={saving}
                      className={`flex flex-col items-center justify-center py-2 px-1 text-xs font-medium border rounded-lg transition-all ${opt.color} ${saving ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 active:scale-95"}`}>
                      <span className="text-base mb-0.5">{opt.icon}</span>
                      <span>{opt.label}</span>
                      <span className="text-[9px] opacity-60 mt-0.5">キー{opt.key}</span>
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
                          <p className="text-slate-500 text-[10px]">
                            {formatDate(log.called_at)} · {log.caller_name}
                            {log.call_duration ? ` · ${formatTimer(log.call_duration)}` : ""}
                          </p>
                          {log.note && <p className="text-slate-700 dark:text-slate-300 mt-0.5 truncate">{log.note}</p>}
                          {log.callback_at && (
                            <p className="text-amber-600 text-[10px] mt-0.5">📞 折り返し: {formatDate(log.callback_at)}</p>
                          )}
                        </div>
                        <button onClick={() => handleDeleteLog(log.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom nav hint */}
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center border-t border-slate-100 dark:border-slate-700">
                <button onClick={handlePrev} disabled={selectedIdx === 0}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 disabled:opacity-30">
                  <ChevronLeft size={14} />前の企業
                </button>
                <span className="text-[10px] text-slate-300">{selectedIdx + 1} / {companies.length}</span>
                <button onClick={handleNext} disabled={selectedIdx === companies.length - 1}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 disabled:opacity-30">
                  次の企業<ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
