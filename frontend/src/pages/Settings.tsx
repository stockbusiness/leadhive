import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, CheckCircle, XCircle, Loader2, Clock, Timer } from "lucide-react";
import { api } from "../api";

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [cx, setCx] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [cxSet, setCxSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [autoCollectEnabled, setAutoCollectEnabled] = useState(false);
  const [autoCollectTime, setAutoCollectTime] = useState("09:00");
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  useEffect(() => {
    api.settings.get().then((data) => {
      const s = data.settings;
      if (s.google_api_key) {
        setApiKeySet(s.google_api_key.is_set);
        if (s.google_api_key.is_set) setApiKey(s.google_api_key.value);
      }
      if (s.google_cx) {
        setCxSet(s.google_cx.is_set);
        if (s.google_cx.is_set) setCx(s.google_cx.value);
      }
      if (s.auto_collect_enabled) {
        setAutoCollectEnabled(s.auto_collect_enabled.value === "true");
      }
      if (s.auto_collect_time?.is_set) {
        setAutoCollectTime(s.auto_collect_time.value);
      }
    });
    api.settings.getScheduler().then((data) => {
      setSchedulerRunning(data.running);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const data: Record<string, string> = {};
      if (apiKey && !apiKey.includes("*")) data.google_api_key = apiKey;
      if (cx && !cx.includes("*")) data.google_cx = cx;
      data.auto_collect_enabled = autoCollectEnabled ? "true" : "false";
      data.auto_collect_time = autoCollectTime;

      await api.settings.update(data);
      setMessage({ type: "success", text: "設定を保存しました" });

      const res = await api.settings.get();
      const s = res.settings;
      setApiKeySet(s.google_api_key?.is_set || false);
      setCxSet(s.google_cx?.is_set || false);
      if (s.google_api_key?.is_set) setApiKey(s.google_api_key.value);
      if (s.google_cx?.is_set) setCx(s.google_cx.value);
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.detail || "保存に失敗しました" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const data = await api.settings.test();
      setMessage({
        type: data.success ? "success" : "error",
        text: data.message,
      });
    } catch {
      setMessage({ type: "error", text: "接続テストに失敗しました" });
    }
    setTesting(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">設定</h2>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <SettingsIcon size={20} className="text-slate-600" />
          <h3 className="font-semibold text-slate-700">Google Custom Search API 設定</h3>
        </div>

        <p className="text-sm text-slate-500">
          自動収集機能を利用するには、Google Custom Search APIのAPIキーとSearch Engine ID (cx)が必要です。
          <a
            href="https://developers.google.com/custom-search/v1/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline ml-1"
          >
            詳細はこちら
          </a>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Google API Key
              {apiKeySet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Google Cloud ConsoleでCustom Search APIを有効にして取得してください</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Search Engine ID (cx)
              {cxSet && <span className="text-emerald-600 text-xs ml-2">設定済み</span>}
            </label>
            <input
              type="text"
              value={cx}
              onChange={(e) => setCx(e.target.value)}
              placeholder="a1b2c3d4e5f6..."
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">Programmable Search Engineで作成したSearch Engine IDを入力してください</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            保存
          </button>
          <button
            onClick={handleTest}
            disabled={testing || (!apiKeySet && !apiKey)}
            className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            接続テスト
          </button>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Timer size={20} className="text-slate-600" />
          <h3 className="font-semibold text-slate-700">自動収集スケジュール</h3>
          {schedulerRunning && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">稼働中</span>
          )}
        </div>

        <p className="text-sm text-slate-500">
          有効にすると、指定した時刻にアクティブなキーワードで自動的にGoogle検索・収集を実行します。
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoCollectEnabled}
                onChange={(e) => setAutoCollectEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
            <span className="text-sm font-medium text-slate-700">自動収集を有効にする</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Clock size={14} className="inline mr-1" />
              実行時刻
            </label>
            <input
              type="time"
              value={autoCollectTime}
              onChange={(e) => setAutoCollectTime(e.target.value)}
              disabled={!autoCollectEnabled}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
            />
            <p className="text-xs text-slate-400 mt-1">毎日指定した時刻に自動収集を実行します（サーバー時刻基準）</p>
          </div>
        </div>
      </div>
    </div>
  );
}
