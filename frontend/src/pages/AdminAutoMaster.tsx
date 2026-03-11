import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import {
  DatabaseZap, Play, RotateCcw, CheckCircle, XCircle,
  Loader2, RefreshCw, MapPin, Calendar, Layers, History, ChevronDown, ChevronRight,
} from "lucide-react";

interface JobLogEntry {
  id: number;
  job_id: string;
  job_type: string | null;
  status: string;
  message: string | null;
  current: number;
  total: number;
  source_count: number;
  saved_count: number;
  error_count: number;
  started_at: string | null;
  finished_at: string | null;
}

interface Status {
  enabled: boolean;
  city_idx: number;
  total_cities: number;
  current_city: string;
  current_prefecture: string;
  keyword_idx: number;
  current_keyword: string;
  keywords: string[];
  page_idx: number;
  max_companies: number;
  max_enrich: number;
  schedule_hour: number;
  last_run: string;
  last_count: number;
  total_collected: number;
  master_db_count: number;
  has_gbiz_token: boolean;
  enrich_enabled: boolean;
  enrich_max: number;
  enrich_last_run: string;
  enrich_total: number;
  enrich_progress: string;
  has_serper_key: boolean;
  no_url_count: number;
  scheduler_timezone: string;
  estimated_max: number;
  total_combinations: number;
  max_pages_per_combo: number;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: enabled ? "translateX(26px)" : "translateX(4px)" }}
      />
    </button>
  );
}

export default function AdminAutoMaster() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [running, setRunning] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [runResult, setRunResult] = useState<any>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runSnapshotRef = useRef<{ city_idx: number; keyword_idx: number; page_idx: number; last_run: string } | null>(null);

  const [form, setForm] = useState({
    enabled: false,
    max_companies: 1000,
    max_enrich: 10,
    max_pages_per_combo: 10,
    schedule_hour: 3,
    enrich_enabled: true,
    enrich_max: 100,
    scheduler_timezone: "Asia/Tokyo",
    serper_api_key: "",
  });
  const [serverTime, setServerTime] = useState<{ server_time: string; utc_offset: string } | null>(null);

  const [runningEnrich, setRunningEnrich] = useState(false);
  const [progressMsgEnrich, setProgressMsgEnrich] = useState("");
  const [runEnrichResult, setRunEnrichResult] = useState<{ saved: number } | null>(null);
  const [runEnrichError, setRunEnrichError] = useState<string | null>(null);
  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [jobLogs, setJobLogs] = useState<JobLogEntry[]>([]);
  const [jobLogsOpen, setJobLogsOpen] = useState(false);
  const [jobLogsLoading, setJobLogsLoading] = useState(false);

  const loadJobLogs = useCallback(() => {
    setJobLogsLoading(true);
    axios.get("/api/admin/auto-master/job-logs?limit=20")
      .then((r) => setJobLogs(r.data.logs))
      .catch(() => {})
      .finally(() => setJobLogsLoading(false));
  }, []);

  const load = (autoResumeEnrich = false) => {
    setLoading(true);
    axios.get("/api/admin/auto-master/status").then((r) => {
      const s: Status = r.data;
      setStatus(s);
      setForm({
        enabled: s.enabled,
        max_companies: s.max_companies,
        max_enrich: s.max_enrich,
        max_pages_per_combo: s.max_pages_per_combo ?? 10,
        schedule_hour: s.schedule_hour,
        enrich_enabled: s.enrich_enabled ?? true,
        enrich_max: s.enrich_max ?? 100,
        scheduler_timezone: s.scheduler_timezone ?? "Asia/Tokyo",
        serper_api_key: "",
      });
      // ページ読み込み時に補完が実行中ならポーリングを自動再開
      if (autoResumeEnrich && s.enrich_progress) {
        setRunningEnrich(true);
        setProgressMsgEnrich(s.enrich_progress);
        _startEnrichPolling(s.enrich_total ?? 0, s.enrich_last_run ?? "");
      }
    }).finally(() => setLoading(false));
  };

  const fetchServerTime = useCallback(() => {
    axios.get("/api/admin/auto-master/server-time")
      .then((r) => setServerTime(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(true);
    loadJobLogs();
    fetchServerTime();
    const stTimer = setInterval(fetchServerTime, 15000);
    return () => { stopPolling(); stopEnrichPolling(); clearInterval(stTimer); };
  }, [loadJobLogs, fetchServerTime]);

  const handleSave = () => {
    setSaving(true);
    setSaveMsg("");
    axios.post("/api/admin/auto-master/settings", {
      auto_master_enabled: form.enabled ? "true" : "false",
      auto_master_max_companies: String(form.max_companies),
      auto_master_max_enrich: String(form.max_enrich),
      auto_master_max_pages_per_combo: String(form.max_pages_per_combo),
      auto_master_schedule_hour: String(form.schedule_hour),
      auto_master_enrich_enabled: form.enrich_enabled ? "true" : "false",
      auto_master_enrich_max: String(form.enrich_max),
      scheduler_timezone: form.scheduler_timezone,
      ...(form.serper_api_key ? { serper_api_key: form.serper_api_key } : {}),
    }).then(() => {
      setSaveMsg("保存しました");
      load();
      fetchServerTime();
    }).catch(() => setSaveMsg("保存に失敗しました")).finally(() => setSaving(false));
  };

  const handleResetProgress = () => {
    if (!confirm("都道府県の進捗を北海道（最初）にリセットしますか？")) return;
    axios.post("/api/admin/auto-master/reset-progress").then(() => load());
  };

  const handleClearMasterData = () => {
    if (!confirm("自動収集で保存したマスターDBデータをすべて削除します。この操作は取り消せません。よろしいですか？")) return;
    axios.post("/api/admin/auto-master/clear-master-data")
      .then((r) => {
        alert(`${r.data.deleted}件を削除しました。進捗もリセットされました。`);
        load();
      })
      .catch(() => alert("削除に失敗しました"));
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleRunNow = () => {
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    setProgressMsg("処理を開始しています...");
    stopPolling();

    const snapshot = status
      ? { city_idx: status.city_idx, keyword_idx: status.keyword_idx, page_idx: status.page_idx, last_run: status.last_run }
      : null;
    runSnapshotRef.current = snapshot;

    axios.post("/api/admin/auto-master/run-now").then(() => {
      setProgressMsg("収集実行中...");
      let elapsed = 0;
      pollRef.current = setInterval(() => {
        elapsed += 3;
        axios.get("/api/admin/auto-master/status").then((r) => {
          const s: Status = r.data;
          const snap = runSnapshotRef.current;
          const done = snap
            ? (s.city_idx !== snap.city_idx || s.keyword_idx !== snap.keyword_idx ||
               s.page_idx !== snap.page_idx || s.last_run !== snap.last_run)
            : false;
          if (done || elapsed >= 300) {
            stopPolling();
            setRunResult({
              prefecture: snap ? `${s.current_prefecture}・${s.current_city}` : "",
              fetched: null,
              saved: s.last_count,
              skipped: null,
              enriched: null,
              next: `${s.current_prefecture}・${s.current_city}/${s.current_keyword}（p${s.page_idx}〜）`,
            });
            setProgressMsg("");
            setRunning(false);
            setStatus(s);
            loadJobLogs();
          } else {
            const msgs = ["収集実行中...", "gBizINFOから企業データを取得中...", "マスターDBに保存中..."];
            setProgressMsg(msgs[Math.floor(elapsed / 5) % msgs.length]);
          }
        }).catch(() => {});
      }, 3000);
    }).catch((err) => {
      setRunError(err.response?.data?.detail || "実行に失敗しました");
      setProgressMsg("");
      setRunning(false);
    });
  };

  const stopEnrichPolling = () => {
    if (enrichPollRef.current) {
      clearInterval(enrichPollRef.current);
      enrichPollRef.current = null;
    }
  };

  const _startEnrichPolling = (prevTotal: number, prevLastRun: string) => {
    stopEnrichPolling();
    let progressStarted = false;
    let lastProgressVal = "";
    let lastProgressChangedAt = Date.now();
    const WATCHDOG_MS = 5 * 60 * 1000; // 5分間進捗変化なし → クラッシュ扱い
    const MAX_POLL_MS = 2 * 60 * 60 * 1000; // 最大2時間

    const startedAt = Date.now();

    enrichPollRef.current = setInterval(() => {
      axios.get("/api/admin/auto-master/status").then((r) => {
        const s: Status = r.data;
        const elapsed = Date.now() - startedAt;

        if (s.enrich_progress) {
          progressStarted = true;
          if (s.enrich_progress !== lastProgressVal) {
            lastProgressVal = s.enrich_progress;
            lastProgressChangedAt = Date.now();
          }
          setProgressMsgEnrich(s.enrich_progress);
          setStatus(s);
          return;
        }

        // 完了検出条件
        const completedNormally = progressStarted && !s.enrich_progress;
        const lastRunChanged = s.enrich_last_run !== prevLastRun;
        const totalIncreased = (s.enrich_total ?? 0) > prevTotal;
        const watchdogFired = progressStarted && (Date.now() - lastProgressChangedAt > WATCHDOG_MS);
        const hardTimeout = elapsed >= MAX_POLL_MS;

        const done = completedNormally || lastRunChanged || totalIncreased || watchdogFired || hardTimeout;

        if (done) {
          stopEnrichPolling();
          const saved = (s.enrich_total ?? 0) - prevTotal;
          setRunEnrichResult({ saved: Math.max(saved, 0) });
          setProgressMsgEnrich("");
          setRunningEnrich(false);
          setStatus(s);
          loadJobLogs();
        } else if (!progressStarted) {
          setProgressMsgEnrich("処理開始待機中...");
        }
      }).catch(() => {});
    }, 3000);
  };

  const handleRunEnrich = () => {
    setRunningEnrich(true);
    setRunEnrichResult(null);
    setRunEnrichError(null);
    setProgressMsgEnrich("URL補完を開始しています...");
    stopEnrichPolling();

    const prevTotal = status?.enrich_total ?? 0;
    const prevLastRun = status?.enrich_last_run ?? "";

    axios.post("/api/admin/auto-master/run-enrich").then(() => {
      setProgressMsgEnrich("処理開始待機中...");
      _startEnrichPolling(prevTotal, prevLastRun);
    }).catch((err) => {
      setRunEnrichError(err.response?.data?.detail || "実行に失敗しました");
      setProgressMsgEnrich("");
      setRunningEnrich(false);
    });
  };


  const formatDateTime = (iso: string) => {
    if (!iso) return "未実行";
    try {
      const d = new Date(iso + "Z");
      return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    } catch { return iso; }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-slate-500">
        <Loader2 size={20} className="animate-spin" />読み込み中...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <DatabaseZap size={24} className="text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-800">マスターDB自動収集</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            都道府県を順番に自動巡回してgBizINFOから企業データを収集し、スコア・業種分類を付与します
          </p>
        </div>
      </div>

      {!status?.has_gbiz_token && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <XCircle size={16} className="shrink-0" />
          gBizINFO APIトークンが設定されていません。「システムAPI設定」ページで先に設定してください。
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "マスターDB総件数", value: status?.master_db_count?.toLocaleString() ?? "0", color: "text-blue-600", icon: <Layers size={16} /> },
          { label: "前回保存件数", value: String(status?.last_count ?? 0), color: "text-green-600", icon: <CheckCircle size={16} /> },
          { label: "収集対象（市区町村）", value: `${(status?.city_idx ?? 0) + 1} / ${status?.total_cities ?? 0}`, color: "text-indigo-600", icon: <MapPin size={16} /> },
          { label: "前回実行日時", value: formatDateTime(status?.last_run ?? ""), color: "text-slate-600", icon: <Calendar size={16} /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${color}`}>
              {icon}{label}
            </div>
            <p className={`text-lg font-bold ${color} break-all leading-snug`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-blue-600 mb-1">推定収集可能企業数</div>
          <p className="text-2xl font-bold text-blue-700">{(status?.estimated_max ?? 0).toLocaleString()}<span className="text-sm font-normal text-slate-500 ml-1">社</span></p>
          <p className="text-xs text-slate-400 mt-1">{status?.total_cities ?? 0}市区町村 × {status?.keywords?.length ?? 12}キーワード × {status?.max_pages_per_combo ?? 10}ページ × 100件</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 mb-1">全組み合わせ数</div>
          <p className="text-2xl font-bold text-slate-700">{(status?.total_combinations ?? 0).toLocaleString()}<span className="text-sm font-normal text-slate-500 ml-1">通り</span></p>
          <p className="text-xs text-slate-400 mt-1">市区町村 × キーワード（各最大{status?.max_pages_per_combo ?? 10}ページ）</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            🕐 タイムゾーン設定
          </h3>
          {serverTime && (
            <div className="text-right">
              <div className="text-xs text-slate-500">サーバー現在時刻</div>
              <div className="text-sm font-bold text-slate-700 tabular-nums">{serverTime.server_time} <span className="text-xs font-normal text-slate-400">(UTC{serverTime.utc_offset})</span></div>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          スケジューラーが参照するタイムゾーンを設定します。設定した時刻が<strong>このタイムゾーン</strong>で解釈されます。
        </p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">タイムゾーン</label>
          <select
            value={form.scheduler_timezone}
            onChange={(e) => setForm((f) => ({ ...f, scheduler_timezone: e.target.value }))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Asia/Tokyo">Asia/Tokyo（JST UTC+9）日本</option>
            <option value="Asia/Seoul">Asia/Seoul（KST UTC+9）韓国</option>
            <option value="Asia/Shanghai">Asia/Shanghai（CST UTC+8）中国</option>
            <option value="Asia/Singapore">Asia/Singapore（SGT UTC+8）シンガポール</option>
            <option value="America/New_York">America/New_York（EST/EDT）米国東部</option>
            <option value="America/Los_Angeles">America/Los_Angeles（PST/PDT）米国西部</option>
            <option value="America/Chicago">America/Chicago（CST/CDT）米国中部</option>
            <option value="Europe/London">Europe/London（GMT/BST）英国</option>
            <option value="Europe/Paris">Europe/Paris（CET/CEST）欧州中部</option>
            <option value="Australia/Sydney">Australia/Sydney（AEST/AEDT）オーストラリア東部</option>
            <option value="UTC">UTC（協定世界時）</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            設定を保存
          </button>
          {saveMsg && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={14} />{saveMsg}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
        <h3 className="text-base font-semibold text-slate-700">自動収集の設定</h3>

        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">自動収集を有効にする</p>
            <p className="text-xs text-slate-400">毎日指定した時刻に1都道府県分を自動収集します</p>
          </div>
          <Toggle enabled={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">実行時刻（時）</label>
            <select
              value={form.schedule_hour}
              onChange={(e) => setForm((f) => ({ ...f, schedule_hour: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              1回の収集件数 <span className="text-slate-400">（目標新規保存数に達したら停止）</span>
            </label>
            <select
              value={form.max_companies}
              onChange={(e) => setForm((f) => ({ ...f, max_companies: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {[200, 500, 1000, 2000, 5000, 10000].map((n) => (
                <option key={n} value={n}>{n.toLocaleString()}件</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              1コンボあたり最大ページ数 <span className="text-slate-400">（ページ × 100社）</span>
            </label>
            <select
              value={form.max_pages_per_combo}
              onChange={(e) => setForm((f) => ({ ...f, max_pages_per_combo: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {[1, 3, 5, 10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}ページ（最大{(n * 100).toLocaleString()}社/コンボ）</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              設定ページ数を超えたら次の市区町村へ移動。推定収集可能数: <strong className="text-blue-600">{(986 * 12 * form.max_pages_per_combo * 100).toLocaleString()}社</strong>
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              URL補完 最大件数 <span className="text-slate-400">（Google検索）</span>
            </label>
            <select
              value={form.max_enrich}
              onChange={(e) => setForm((f) => ({ ...f, max_enrich: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {[0, 5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>{n === 0 ? "0件（URLなし企業はスキップ）" : `${n}件`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            設定を保存
          </button>
          {saveMsg && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={14} />{saveMsg}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white border border-indigo-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <span className="text-indigo-600">✦</span> マスターDB 自動URL補完
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">AM 5:00 実行</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">URLが未取得のマスターDB企業をGoogle検索で自動補完し、スクレイピングでCMS・メール・スコアを付与します。</p>
          </div>
          <Toggle enabled={form.enrich_enabled} onChange={(v) => setForm((f) => ({ ...f, enrich_enabled: v }))} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs bg-indigo-50 rounded-lg p-3 border border-indigo-100">
          <div>
            <div className="text-slate-500">URLなし企業数</div>
            <div className="text-xl font-bold text-indigo-700">{(status?.no_url_count ?? 0).toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-1">社</span></div>
          </div>
          <div>
            <div className="text-slate-500">累計補完済み</div>
            <div className="text-xl font-bold text-green-700">{(status?.enrich_total ?? 0).toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-1">社</span></div>
          </div>
          <div>
            <div className="text-slate-500">前回実行</div>
            <div className="text-sm font-semibold text-slate-700">{status?.enrich_last_run || "未実行"}</div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">1回の補完件数 <span className="text-slate-400">（最大）</span></label>
          <select
            value={form.enrich_max}
            onChange={(e) => setForm((f) => ({ ...f, enrich_max: Number(e.target.value) }))}
            disabled={!form.enrich_enabled}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:opacity-50 disabled:bg-slate-100"
          >
            {[50, 100, 200, 300, 500].map((n) => (
              <option key={n} value={n}>{n}社 / 日</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">1社あたりGoogle検索 + スクレイピングで2〜4秒かかります。100社 ≈ 約5分。</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Serper API Key
            {status?.has_serper_key && <span className="ml-2 text-green-600 font-semibold">✓ 設定済み</span>}
          </label>
          <input
            type="password"
            value={form.serper_api_key}
            onChange={(e) => setForm((f) => ({ ...f, serper_api_key: e.target.value }))}
            placeholder={status?.has_serper_key ? "変更する場合のみ入力" : "Serper APIキーを入力（Google検索精度向上）"}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            設定するとDuckDuckGo代わりにGoogle検索APIを使用。serper.dev で無料取得可能（500回/月）。
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            設定を保存
          </button>
          <button
            onClick={handleRunEnrich}
            disabled={runningEnrich}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {runningEnrich ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            今すぐ実行
          </button>
          {saveMsg && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={14} />{saveMsg}
            </span>
          )}
        </div>

        {runningEnrich && (() => {
          const match = progressMsgEnrich.match(/^(\d+)\/(\d+)/);
          const current = match ? parseInt(match[1]) : 0;
          const total = match ? parseInt(match[2]) : 0;
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          const isWaiting = !match;
          const foundMatch = progressMsgEnrich.match(/URL発見[:：](\d+)件/);
          const foundCount = foundMatch ? parseInt(foundMatch[1]) : null;
          return (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                <Loader2 size={15} className="animate-spin flex-shrink-0" />
                <span>{isWaiting ? progressMsgEnrich : `URL補完実行中...`}</span>
              </div>
              {!isWaiting && (
                <>
                  <div className="flex justify-between text-xs text-indigo-600 font-semibold">
                    <span>
                      {current}社処理済み / {total}社対象
                      {foundCount !== null && <span className="ml-2 text-green-600">（URL発見: {foundCount}件）</span>}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })()}
        {runEnrichError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <XCircle size={15} className="flex-shrink-0" />
            <div>
              <p className="font-semibold">実行エラー</p>
              <p className="text-xs mt-0.5">{runEnrichError}</p>
            </div>
          </div>
        )}
        {runEnrichResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
            <p className="font-semibold mb-1 flex items-center gap-1"><CheckCircle size={14} /> URL補完完了</p>
            <p>補完済み: <strong>+{runEnrichResult.saved}社</strong>　累計: {(status?.enrich_total ?? 0).toLocaleString()}社</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-base font-semibold text-slate-700">市区町村の巡回状況</h3>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
          <span>▶ 次回収集: <strong className="text-blue-700">{status?.current_prefecture}・{status?.current_city} / {status?.current_keyword}</strong></span>
          <span className="text-slate-400">|</span>
          <span>開始ページ: <strong className="text-indigo-600">p{status?.page_idx ?? 1}</strong></span>
          <span className="text-slate-400">|</span>
          <span>進捗: <strong className="text-green-600">{(status?.city_idx ?? 0) + 1}</strong> / {status?.total_cities ?? 0} 市区町村</span>
        </div>
        <p className="text-xs text-slate-500">
          市区町村単位で順番に収集します。1コンボあたり最大{status?.max_pages_per_combo ?? 10}ページ（最大{((status?.max_pages_per_combo ?? 10) * 100).toLocaleString()}社）収集したら次の市区町村へ移動します。
          目標件数に達したら続きのページから再開。全{status?.total_cities ?? 0}市区町村 × {status?.keywords?.length ?? 12}キーワード × {status?.max_pages_per_combo ?? 10}ページで最大{(status?.estimated_max ?? 0).toLocaleString()}社を網羅します。
        </p>

        {/* 進捗バー */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>市区町村の進捗</span>
            <span>{Math.round(((status?.city_idx ?? 0) / Math.max(status?.total_cities ?? 1, 1)) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.round(((status?.city_idx ?? 0) / Math.max(status?.total_cities ?? 1, 1)) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetProgress}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-300 rounded-md px-3 py-1.5 transition-colors"
          >
            <RotateCcw size={13} />進捗を最初からリセット
          </button>
          <button
            onClick={handleClearMasterData}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 border border-red-300 rounded-md px-3 py-1.5 transition-colors"
          >
            <XCircle size={13} />収集データを全削除
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-base font-semibold text-slate-700">今すぐ実行</h3>
        <p className="text-xs text-slate-500">
          現在の対象（{status?.current_prefecture}・{status?.current_city} / {status?.current_keyword} p{status?.page_idx ?? 1}〜）を手動で収集します。<br />
          目標件数の新規保存が完了したら停止し、次回は続きのページから再開します。
          全ページを収集し終えると次の市区町村へ進みます（{status?.total_cities ?? 0}市区町村 × {status?.keywords?.length ?? 12}種類を網羅）。
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunNow}
            disabled={running || !status?.has_gbiz_token}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "実行中..." : `${status?.current_prefecture}・${status?.current_city} / ${status?.current_keyword} を収集する`}
          </button>
          <button
            onClick={load}
            disabled={running}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <RefreshCw size={14} />更新
          </button>
        </div>

        {running && progressMsg && (
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              <span>{progressMsg}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-indigo-500 rounded-full animate-pulse" style={{ width: "100%" }} />
            </div>
          </div>
        )}

        {runError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <XCircle size={15} className="shrink-0" />{runError}
          </div>
        )}

        {/* Job History */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <button
            onClick={() => { setJobLogsOpen((v) => !v); if (!jobLogsOpen) loadJobLogs(); }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <History size={15} className="text-indigo-500" />
              実行履歴
              {jobLogs.length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-normal">
                  {jobLogs.length}件
                </span>
              )}
            </span>
            {jobLogsOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
          </button>

          {jobLogsOpen && (
            <div className="border-t border-slate-100">
              {jobLogsLoading ? (
                <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" /> 読み込み中...
                </div>
              ) : jobLogs.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">
                  実行履歴がありません。「今すぐ実行」でジョブを開始すると履歴が記録されます。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-4 py-2 font-medium text-slate-500">開始時刻</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500">種別</th>
                        <th className="text-center px-4 py-2 font-medium text-slate-500">状態</th>
                        <th className="text-center px-4 py-2 font-medium text-slate-500">保存</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500">メッセージ</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-500">所要時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobLogs.map((log) => {
                        const start = log.started_at ? new Date(log.started_at + "Z") : null;
                        const finish = log.finished_at ? new Date(log.finished_at + "Z") : null;
                        const duration = start && finish
                          ? Math.round((finish.getTime() - start.getTime()) / 1000)
                          : null;
                        return (
                          <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                              {start ? start.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—"}
                            </td>
                            <td className="px-4 py-2 text-slate-500">
                              {log.job_type || "—"}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {log.status === "done" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <CheckCircle size={12} /> 完了
                                </span>
                              ) : log.status === "error" ? (
                                <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                                  <XCircle size={12} /> エラー
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-blue-500 font-medium">
                                  <Loader2 size={12} className="animate-spin" /> 実行中
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center font-semibold text-slate-700">
                              {log.saved_count > 0 ? (
                                <span className="text-green-600">{log.saved_count}</span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-2 text-slate-500 max-w-xs truncate">
                              {log.message || "—"}
                            </td>
                            <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                              {duration !== null ? `${duration}秒` : log.status === "running" ? "実行中" : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {runResult && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <CheckCircle size={15} className="text-green-600" />
              {runResult.prefecture} の収集完了
            </p>
            {(runResult.fetched ?? 0) === 0 && (runResult.saved ?? 0) === 0 && (
              <div className="mb-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <XCircle size={14} className="shrink-0 mt-0.5" />
                <span>
                  gBizINFOから0件しか取得できませんでした。APIトークンが正しく設定されているか確認してください。
                  「システムAPI設定」ページの「gBizINFO APIトークン」に直接入力するか、環境変数 <code className="bg-amber-100 px-1 rounded">GbizAPIkey</code> が正しく設定されているか確認してください。
                </span>
              </div>
            )}
            {(runResult.saved ?? 0) === 0 && (runResult.skipped ?? 0) > 0 && (
              <div className="mb-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <DatabaseZap size={14} className="shrink-0 mt-0.5" />
                <span>
                  取得した企業はすべて既にDB登録済みでした。次回は続きのページから収集します。
                  Google APIキーを設定すると、URLなし企業のURLを自動検索して保存件数が増えます。
                </span>
              </div>
            )}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "gBizINFO取得", value: runResult.fetched, color: "text-blue-600" },
                { label: "新規保存", value: runResult.saved, color: "text-green-600" },
                { label: "重複スキップ", value: runResult.skipped, color: "text-amber-600" },
                { label: "URL補完", value: runResult.enriched, color: "text-indigo-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${value === null ? "text-slate-300" : color}`}>
                    {value === null ? "—" : value}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {runResult.next && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <span className="text-blue-500">▶</span>
                次回の収集開始位置: <strong className="text-blue-700">{runResult.next}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
