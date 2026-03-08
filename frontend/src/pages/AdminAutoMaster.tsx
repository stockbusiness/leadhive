import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  DatabaseZap, Play, RotateCcw, CheckCircle, XCircle,
  Loader2, RefreshCw, MapPin, Calendar, Layers,
} from "lucide-react";

interface Status {
  enabled: boolean;
  pref_idx: number;
  current_prefecture: string;
  prefectures: string[];
  keyword_idx: number;
  current_keyword: string;
  keywords: string[];
  max_pages: number;
  max_enrich: number;
  schedule_hour: number;
  last_run: string;
  last_count: number;
  total_collected: number;
  master_db_count: number;
  has_gbiz_token: boolean;
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
  const runSnapshotRef = useRef<{ pref_idx: number; keyword_idx: number; last_run: string } | null>(null);

  const [form, setForm] = useState({
    enabled: false,
    max_pages: 5,
    max_enrich: 10,
    schedule_hour: 3,
  });

  const load = () => {
    setLoading(true);
    axios.get("/api/admin/auto-master/status").then((r) => {
      const s: Status = r.data;
      setStatus(s);
      setForm({
        enabled: s.enabled,
        max_pages: s.max_pages,
        max_enrich: s.max_enrich,
        schedule_hour: s.schedule_hour,
      });
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return () => stopPolling();
  }, []);

  const handleSave = () => {
    setSaving(true);
    setSaveMsg("");
    axios.post("/api/admin/auto-master/settings", {
      auto_master_enabled: form.enabled ? "true" : "false",
      auto_master_max_pages: String(form.max_pages),
      auto_master_max_enrich: String(form.max_enrich),
      auto_master_schedule_hour: String(form.schedule_hour),
    }).then(() => {
      setSaveMsg("保存しました");
      load();
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
      ? { pref_idx: status.pref_idx, keyword_idx: status.keyword_idx, last_run: status.last_run }
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
            ? (s.pref_idx !== snap.pref_idx || s.keyword_idx !== snap.keyword_idx || s.last_run !== snap.last_run)
            : false;
          if (done || elapsed >= 300) {
            stopPolling();
            setRunResult({ prefecture: snap ? `${s.prefectures[snap.pref_idx] ?? ""}` : "", fetched: 0, saved: s.last_count, enriched: 0 });
            setProgressMsg("");
            setRunning(false);
            setStatus(s);
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
          { label: "次回：都道府県・キーワード", value: `${status?.current_prefecture ?? "-"} / ${status?.current_keyword ?? "-"}`, color: "text-indigo-600", icon: <MapPin size={16} /> },
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

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
        <h3 className="text-base font-semibold text-slate-700">自動収集の設定</h3>

        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">自動収集を有効にする</p>
            <p className="text-xs text-slate-400">毎日指定した時刻に1都道府県分を自動収集します</p>
          </div>
          <Toggle enabled={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              最大取得ページ数 <span className="text-slate-400">（1ページ=最大1,000社）</span>
            </label>
            <select
              value={form.max_pages}
              onChange={(e) => setForm((f) => ({ ...f, max_pages: Number(e.target.value) }))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {[1, 2, 5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}ページ（最大{(n * 1000).toLocaleString()}社）</option>
              ))}
            </select>
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

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-base font-semibold text-slate-700">都道府県の巡回状況</h3>
        <p className="text-xs text-slate-500">
          赤枠が「次回処理する都道府県」です。実行するたびに1つずつ進みます（47都道府県で一周）。
        </p>
        <div className="flex flex-wrap gap-1.5">
          {status?.prefectures.map((pref, idx) => {
            const isCurrent = idx === status.pref_idx;
            const isDone = idx < status.pref_idx;
            return (
              <span
                key={pref}
                className={`text-xs px-2 py-1 rounded-md border font-medium transition-colors ${
                  isCurrent
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-300"
                    : isDone
                    ? "border-green-200 bg-green-50 text-green-600"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {isCurrent ? "▶ " : ""}{pref}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetProgress}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-300 rounded-md px-3 py-1.5 transition-colors"
          >
            <RotateCcw size={13} />進捗を北海道からリセット
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
          現在の対象（{status?.current_prefecture} / {status?.current_keyword}）の収集を手動で開始します。
          gBizINFOから取得 → URL検索 → スクレイピング → スコア・業種分類の順に処理します。<br />
          実行のたびに都道府県とキーワードが1つずつ進みます（47都道府県 × {status?.keywords?.length ?? 5}種類を網羅）。
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunNow}
            disabled={running || !status?.has_gbiz_token}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "実行中..." : `${status?.current_prefecture} / ${status?.current_keyword} を収集する`}
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

        {runResult && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <CheckCircle size={15} className="text-green-600" />
              {runResult.prefecture} の収集完了
            </p>
            {(runResult.fetched ?? 0) === 0 && (
              <div className="mb-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <XCircle size={14} className="shrink-0 mt-0.5" />
                <span>
                  gBizINFOから0件しか取得できませんでした。APIトークンが正しく設定されているか確認してください。
                  「システムAPI設定」ページの「gBizINFO APIトークン」に直接入力するか、環境変数 <code className="bg-amber-100 px-1 rounded">GbizAPIkey</code> が正しく設定されているか確認してください。
                </span>
              </div>
            )}
            {(runResult.fetched ?? 0) > 0 && (runResult.saved ?? 0) === 0 && (
              <div className="mb-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <DatabaseZap size={14} className="shrink-0 mt-0.5" />
                <span>
                  {runResult.fetched}件取得しましたが、URLを持つ企業がなかったため保存件数は0です。
                  Google APIキーを設定すると、URLなし企業のURLを自動検索して保存件数が増えます。
                </span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "gBizINFO取得", value: runResult.fetched, color: "text-blue-600" },
                { label: "DB保存件数", value: runResult.saved, color: "text-green-600" },
                { label: "URL補完", value: runResult.enriched, color: "text-indigo-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
