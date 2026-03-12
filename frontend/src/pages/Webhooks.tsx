import { useState, useEffect } from "react";
import { Link2, Plus, Trash2, TestTube2, ToggleLeft, ToggleRight, Edit2, X, Check, AlertCircle, CheckCircle2, Loader2, Copy } from "lucide-react";
import { api } from "../api";

const EVENT_LABELS: Record<string, string> = {
  "company.created": "企業が追加された",
  "company.stage_changed": "ステージが変更された",
  "company.enriched": "エンリッチメント完了",
  "collection.completed": "収集ジョブが完了した",
  "member.invited": "メンバーが招待された",
  "member.joined": "メンバーが参加した",
};

interface Webhook {
  id: number;
  name: string;
  url: string;
  has_secret: boolean;
  events: string[];
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  last_status_code: number | null;
  failure_count: number;
}

export default function Webhooks() {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; msg: string }>>({});
  const [testLoading, setTestLoading] = useState<number | null>(null);

  const [form, setForm] = useState({ name: "", url: "", secret: "", events: [] as string[], is_active: true });

  useEffect(() => {
    load();
    api.webhooks.listEvents().then(r => setEvents(r.events));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.webhooks.list();
      setHooks(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function openCreate() {
    setForm({ name: "", url: "", secret: "", events: [], is_active: true });
    setEditId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(h: Webhook) {
    setForm({ name: h.name, url: h.url, secret: "", events: h.events, is_active: h.is_active });
    setEditId(h.id);
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    setError("");
    if (!form.name.trim()) { setError("名前を入力してください"); return; }
    if (!form.url.trim()) { setError("URLを入力してください"); return; }
    if (form.events.length === 0) { setError("イベントを1つ以上選択してください"); return; }
    try {
      const payload: any = { name: form.name, url: form.url, events: form.events, is_active: form.is_active };
      if (form.secret) payload.secret = form.secret;
      if (editId !== null) {
        await api.webhooks.update(editId, payload);
        setSuccess("Webhookを更新しました");
      } else {
        await api.webhooks.create(payload);
        setSuccess("Webhookを作成しました");
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "保存に失敗しました");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("このWebhookを削除しますか？")) return;
    try {
      await api.webhooks.delete(id);
      setSuccess("削除しました");
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "削除に失敗しました");
    }
  }

  async function handleToggle(h: Webhook) {
    try {
      await api.webhooks.update(h.id, { is_active: !h.is_active });
      load();
    } catch { /* ignore */ }
  }

  async function handleTest(id: number) {
    setTestLoading(id);
    try {
      const res = await api.webhooks.test(id);
      setTestResult(prev => ({
        ...prev,
        [id]: res.success
          ? { ok: true, msg: `成功 (HTTP ${res.status_code})` }
          : { ok: false, msg: res.error || `失敗 (HTTP ${res.status_code})` },
      }));
    } catch (err: any) {
      setTestResult(prev => ({
        ...prev,
        [id]: { ok: false, msg: err.response?.data?.detail || "テスト送信に失敗しました" },
      }));
    } finally {
      setTestLoading(null);
    }
  }

  function toggleEvent(ev: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link2 className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Webhook設定</h1>
            <p className="text-sm text-slate-400 mt-0.5">LeadHiveのイベントを外部サービスへリアルタイム通知します</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Webhook追加
        </button>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 text-green-400 bg-green-900/20 border border-green-800 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
          <button onClick={() => setSuccess("")} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && !showForm && (
        <div className="mb-4 flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Webhook一覧 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : hooks.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">まだWebhookが設定されていません</p>
          <button onClick={openCreate} className="mt-4 text-blue-400 hover:text-blue-300 text-sm underline">
            最初のWebhookを追加する
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {hooks.map(h => (
            <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white text-sm">{h.name}</span>
                    {h.is_active ? (
                      <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 rounded-full px-2 py-0.5">有効</span>
                    ) : (
                      <span className="text-xs bg-slate-800 text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">無効</span>
                    )}
                    {h.failure_count > 0 && (
                      <span className="text-xs bg-red-900/50 text-red-400 border border-red-800 rounded-full px-2 py-0.5">
                        失敗 {h.failure_count}回
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate font-mono">{h.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {h.events.map(ev => (
                      <span key={ev} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-800/50 rounded px-1.5 py-0.5">
                        {EVENT_LABELS[ev] || ev}
                      </span>
                    ))}
                  </div>
                  {h.last_triggered_at && (
                    <p className="text-xs text-slate-500 mt-2">
                      最終送信: {new Date(h.last_triggered_at).toLocaleString("ja-JP")}
                      {h.last_status_code && ` · HTTP ${h.last_status_code}`}
                    </p>
                  )}
                  {testResult[h.id] && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${testResult[h.id].ok ? "text-green-400" : "text-red-400"}`}>
                      {testResult[h.id].ok ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {testResult[h.id].msg}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTest(h.id)}
                    disabled={testLoading === h.id}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    title="テスト送信"
                  >
                    {testLoading === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleToggle(h)}
                    className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title={h.is_active ? "無効化" : "有効化"}
                  >
                    {h.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(h)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 利用方法ガイド */}
      <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Webhookの仕組み</h3>
        <div className="space-y-2 text-sm text-slate-400">
          <p>選択したイベントが発生すると、LeadHiveが指定のURLへHTTP POSTを送信します。</p>
          <p>シークレットキーを設定すると、リクエストヘッダー <code className="text-blue-300 bg-slate-800 px-1 rounded">X-LeadHive-Signature: sha256=...</code> に署名が付与されます。</p>
          <p>送信先サーバーは <strong className="text-white">200-299</strong> のHTTPレスポンスを返す必要があります。</p>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800">
          <p className="text-xs text-slate-500">対応イベント: {events.join(" / ")}</p>
        </div>
      </div>

      {/* フォームモーダル */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">{editId !== null ? "Webhookを編集" : "Webhookを追加"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5 font-medium">名前 *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例: Slack通知"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5 font-medium">エンドポイントURL *</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://hooks.example.com/..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5 font-medium">シークレットキー（任意）</label>
                <input
                  value={form.secret}
                  onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                  placeholder={editId !== null ? "変更しない場合は空白" : "HMAC-SHA256署名用のシークレット"}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2 font-medium">イベント *</label>
                <div className="space-y-2">
                  {events.map(ev => (
                    <label key={ev} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.events.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        {EVENT_LABELS[ev] || ev}
                        <span className="ml-2 text-xs text-slate-500 font-mono">({ev})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-checked:bg-blue-600 rounded-full transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </label>
                <span className="text-sm text-slate-300">このWebhookを有効にする</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                {editId !== null ? "更新" : "作成"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
