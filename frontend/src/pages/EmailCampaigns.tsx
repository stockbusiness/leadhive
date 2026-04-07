import { useState, useEffect } from "react";
import { Mail, ChevronDown, ChevronUp, Eye, MousePointer, AlertCircle, CheckCircle, Clock, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import HelpPanel from "../components/HelpPanel";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  status: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  open_rate: number;
  click_rate: number;
  created_at: string;
  auto_status_on_open?: string;
  auto_status_on_click?: string;
}

interface LogEntry {
  id: number;
  company_id: number;
  company_name: string;
  to_email: string;
  status: string;
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  open_count: number;
  click_count: number;
  error_message?: string;
}

interface CampaignDetail extends Campaign {
  html_body: string;
  text_body?: string;
  logs: LogEntry[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  running: { label: "送信中", color: "text-blue-600 bg-blue-50 border-blue-200" },
  done: { label: "完了", color: "text-green-600 bg-green-50 border-green-200" },
  error: { label: "エラー", color: "text-red-600 bg-red-50 border-red-200" },
};

const LOG_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "待機中", color: "text-slate-500" },
  sent: { label: "送信済", color: "text-green-600" },
  failed: { label: "失敗", color: "text-red-600" },
  bounced: { label: "バウンス", color: "text-orange-600" },
  spam: { label: "スパム報告", color: "text-red-700" },
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DetailModal({ campaign, onClose }: { campaign: CampaignDetail; onClose: () => void }) {
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = filterStatus
    ? campaign.logs.filter((l) => l.status === filterStatus)
    : campaign.logs;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{campaign.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">件名: {campaign.subject}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 px-5 py-4 border-b border-slate-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">{campaign.sent_count}</p>
            <p className="text-xs text-slate-500">送信成功</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{campaign.opened_count}</p>
            <p className="text-xs text-slate-500">開封 ({campaign.open_rate}%)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{campaign.clicked_count}</p>
            <p className="text-xs text-slate-500">クリック ({campaign.click_rate}%)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{campaign.failed_count}</p>
            <p className="text-xs text-slate-500">失敗</p>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="text-sm text-slate-600">フィルタ:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">すべて ({campaign.logs.length})</option>
            {Object.entries(LOG_STATUS_LABELS).map(([k, v]) => {
              const count = campaign.logs.filter((l) => l.status === k).length;
              return count > 0 ? (
                <option key={k} value={k}>{v.label} ({count})</option>
              ) : null;
            })}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">企業名</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">メール</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">ステータス</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">送信日時</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">開封</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">クリック</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">データがありません</td>
                </tr>
              ) : (
                filtered.map((log) => {
                  const st = LOG_STATUS_LABELS[log.status] || { label: log.status, color: "text-slate-500" };
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">{log.company_name || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{log.to_email}</td>
                      <td className={`px-4 py-2 font-medium ${st.color}`}>
                        {st.label}
                        {log.error_message && (
                          <span className="ml-1 text-xs text-red-400" title={log.error_message}>⚠</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{fmtDate(log.sent_at)}</td>
                      <td className="px-4 py-2">
                        {log.opened_at ? (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Eye size={13} /> {log.open_count}回
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {log.clicked_at ? (
                          <span className="flex items-center gap-1 text-purple-600">
                            <MousePointer size={13} /> {log.click_count}回
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function EmailCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.emailCampaigns.list().then((data) => {
      setCampaigns(data.campaigns);
      setTotal(data.total);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (detailId == null) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    api.emailCampaigns.get(detailId).then(setDetail).finally(() => setDetailLoading(false));
  }, [detailId]);

  const refresh = () => {
    api.emailCampaigns.list().then((data) => {
      setCampaigns(data.campaigns);
      setTotal(data.total);
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mail size={20} className="text-blue-500" />
            一括メール送信履歴
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            企業一覧から選択した企業への一括メール送信の履歴を確認できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpPanel
            title="一括メール送信のヘルプ"
            manualLinks={[
              { label: "営業AI・メール一括送信", description: "一括送信の手順と設定方法", to: "/manual#salesai" },
              { label: "メール送信設定", description: "SMTP・SendGrid の設定方法", to: "/manual#setup" },
            ]}
            tips={[
              "企業一覧でチェックボックスを選択し、「一括メール送信」ボタンから送信できます",
              "テンプレート変数（{{会社名}}など）を使うと差し込み送信が可能です",
              "SendGrid を設定すると開封率・クリック率が追跡できます",
              "ステータスを「開封時に変更」「クリック時に変更」と設定すると自動でパイプラインが動きます",
            ]}
          />
          <button
            onClick={refresh}
            className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            更新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Mail size={24} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600 mb-1">まだキャンペーンがありません</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                企業一覧で企業を選択し、「一括メール送信」ボタンから送信するとここに履歴が表示されます
              </p>
            </div>
            <Link
              to="/companies"
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              企業一覧へ
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-500">
            合計 {total} 件
          </div>
          <div className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const st = STATUS_LABELS[c.status] || { label: c.status, color: "text-slate-500 bg-slate-50 border-slate-200" };
              return (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 truncate">{c.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate mt-0.5">件名: {c.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(c.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-5 text-sm shrink-0">
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-slate-800">{c.sent_count}/{c.total_count}</p>
                      <p className="text-xs text-slate-400">送信</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-blue-600 flex items-center gap-1">
                        <Eye size={13} /> {c.open_rate}%
                      </p>
                      <p className="text-xs text-slate-400">開封率</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold text-purple-600 flex items-center gap-1">
                        <MousePointer size={13} /> {c.click_rate}%
                      </p>
                      <p className="text-xs text-slate-400">クリック率</p>
                    </div>
                    <button
                      onClick={() => setDetailId(c.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
                    >
                      詳細
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detailId != null && (
        detailLoading ? (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
          </div>
        ) : detail ? (
          <DetailModal campaign={detail} onClose={() => setDetailId(null)} />
        ) : null
      )}
    </div>
  );
}
