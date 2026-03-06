import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  Save,
  MessageSquare,
  History,
} from "lucide-react";

interface Company {
  id: number;
  company_name: string;
  website_url: string;
  domain: string;
  contact_url: string;
  prefecture: string;
  city: string;
  phone: string;
  email: string;
  category_main: string;
  category_sub: string;
  shopify_flag: boolean;
  ec_flag: boolean;
  amazon_flag: boolean;
  rakuten_flag: boolean;
  consulting_flag: boolean;
  operation_flag: boolean;
  production_flag: boolean;
  score_total: number;
  score_adjustment: number;
  score_rank: string;
  status: string;
  notes: string;
}

interface StatusHistoryEntry {
  id: number;
  old_status: string;
  new_status: string;
  changed_at: string;
}

interface MemoTemplate {
  id: number;
  title: string;
  content: string;
}

const CATEGORIES = [
  "EC制作", "ECコンサル", "EC運営代行", "EC広告代理店",
  "Shopify支援", "Amazon支援", "楽天支援", "Web制作", "その他",
];

const STATUSES = [
  "未確認", "対象候補", "除外", "アプローチ前",
  "フォーム送信済", "返信あり", "面談化", "代理店化", "失注",
];

const RANKS = ["A", "B", "C", "D"];

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    score_rank: "",
    has_contact: "",
    search: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Company>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCompany, setModalCompany] = useState<Company | null>(null);
  const [modalEdit, setModalEdit] = useState<Partial<Company>>({});
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchCompanies = useCallback(() => {
    const params: Record<string, string | number | boolean> = { page, per_page: 50 };
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.score_rank) params.score_rank = filters.score_rank;
    if (filters.has_contact) params.has_contact = filters.has_contact === "true";
    if (filters.search) params.search = filters.search;

    axios.get("/api/companies", { params }).then((res) => {
      setCompanies(res.data.companies);
      setTotal(res.data.total);
    });
  }, [page, filters]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.score_rank) params.set("score_rank", filters.score_rank);
    if (filters.has_contact) params.set("has_contact", filters.has_contact);
    window.open(`/api/companies/csv?${params.toString()}`, "_blank");
  };

  const handleStatusChange = (id: number, newStatus: string) => {
    axios.put(`/api/companies/${id}`, { status: newStatus }).then(() => fetchCompanies());
  };

  const handleDelete = (id: number) => {
    if (confirm("この企業を削除しますか？")) {
      axios.delete(`/api/companies/${id}`).then(() => fetchCompanies());
    }
  };

  const startEdit = (company: Company) => {
    setEditingId(company.id);
    setEditData({ ...company });
  };

  const saveEdit = () => {
    if (editingId) {
      axios.put(`/api/companies/${editingId}`, editData).then(() => {
        setEditingId(null);
        setEditData({});
        fetchCompanies();
      });
    }
  };

  const openModal = (company: Company) => {
    setModalCompany(company);
    setModalEdit({ ...company });
    setModalOpen(true);
    axios.get(`/api/companies/${company.id}/history`).then((res) => setStatusHistory(res.data.history));
    axios.get("/api/templates").then((res) => setTemplates(res.data.templates));
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalCompany(null);
    setModalEdit({});
    setStatusHistory([]);
  };

  const saveModal = () => {
    if (!modalCompany) return;
    setSaving(true);
    axios.put(`/api/companies/${modalCompany.id}`, modalEdit).then(() => {
      setSaving(false);
      closeModal();
      fetchCompanies();
    }).catch(() => setSaving(false));
  };

  const applyTemplate = (content: string) => {
    const current = modalEdit.notes || "";
    setModalEdit({ ...modalEdit, notes: current ? `${current}\n${content}` : content });
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">候補企業一覧</h2>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors"
        >
          <Download size={16} />
          CSV出力
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="会社名・URL検索..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全カテゴリ</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全ステータス</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filters.score_rank}
            onChange={(e) => setFilters({ ...filters, score_rank: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全ランク</option>
            {RANKS.map((r) => (
              <option key={r} value={r}>ランク {r}</option>
            ))}
          </select>
          <select
            value={filters.has_contact}
            onChange={(e) => setFilters({ ...filters, has_contact: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">問い合わせ</option>
            <option value="true">あり</option>
            <option value="false">なし</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-medium text-slate-600">会社名</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">カテゴリ</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">スコア</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">所在地</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">問い合わせ</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">ステータス</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">メモ</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{c.company_name || c.domain}</div>
                    <a
                      href={c.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                    >
                      {c.domain} <ExternalLink size={10} />
                    </a>
                    <div className="flex gap-1 mt-1">
                      {c.shopify_flag && <FlagBadge label="Shopify" color="bg-green-100 text-green-700" />}
                      {c.amazon_flag && <FlagBadge label="Amazon" color="bg-orange-100 text-orange-700" />}
                      {c.rakuten_flag && <FlagBadge label="楽天" color="bg-red-100 text-red-700" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.category_main}</td>
                  <td className="px-3 py-2 text-center">
                    <ScoreBadge score={c.score_total} rank={c.score_rank} />
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-xs">
                    {c.prefecture}{c.city}
                    {c.phone && <div className="text-slate-400">{c.phone}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {c.contact_url ? (
                      <a
                        href={c.contact_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                      >
                        <MessageSquare size={12} />
                        問い合わせ
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">なし</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      className="text-xs border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {editingId === c.id ? (
                      <input
                        type="text"
                        value={editData.notes || ""}
                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                        className="text-xs border border-slate-300 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-xs text-slate-500 max-w-[120px] truncate block">
                        {c.notes || "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === c.id ? (
                        <>
                          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-800 p-1">
                            <Save size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openModal(c)} className="text-blue-500 hover:text-blue-700 p-1" title="詳細編集">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 p-1" title="削除">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                    企業データがありません。「URL収集」から企業を追加してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              全{total}件中 {(page - 1) * 50 + 1}-{Math.min(page * 50, total)}件
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-slate-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && modalCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">企業詳細編集</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">会社名</label>
                  <input
                    type="text"
                    value={modalEdit.company_name || ""}
                    onChange={(e) => setModalEdit({ ...modalEdit, company_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">WebサイトURL</label>
                  <input
                    type="text"
                    value={modalEdit.website_url || ""}
                    onChange={(e) => setModalEdit({ ...modalEdit, website_url: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">問い合わせURL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={modalEdit.contact_url || ""}
                      onChange={(e) => setModalEdit({ ...modalEdit, contact_url: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {modalEdit.contact_url && (
                      <a
                        href={modalEdit.contact_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded-md text-xs hover:bg-blue-600 whitespace-nowrap"
                      >
                        <ExternalLink size={12} />
                        開く
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={modalEdit.email || ""}
                    onChange={(e) => setModalEdit({ ...modalEdit, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">都道府県</label>
                  <input
                    type="text"
                    value={modalEdit.prefecture || ""}
                    onChange={(e) => setModalEdit({ ...modalEdit, prefecture: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">市区町村</label>
                  <input
                    type="text"
                    value={modalEdit.city || ""}
                    onChange={(e) => setModalEdit({ ...modalEdit, city: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">電話番号</label>
                  <input
                    type="text"
                    value={modalEdit.phone || ""}
                    onChange={(e) => setModalEdit({ ...modalEdit, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">カテゴリ</label>
                  <select
                    value={modalEdit.category_main || ""}
                    onChange={(e) => setModalEdit({ ...modalEdit, category_main: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">未分類</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ステータス</label>
                <select
                  value={modalEdit.status || ""}
                  onChange={(e) => setModalEdit({ ...modalEdit, status: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">フラグ</label>
                <div className="flex flex-wrap gap-3">
                  {([
                    ["shopify_flag", "Shopify対応"],
                    ["ec_flag", "EC特化"],
                    ["amazon_flag", "Amazon対応"],
                    ["rakuten_flag", "楽天対応"],
                    ["consulting_flag", "コンサル"],
                    ["operation_flag", "運営代行"],
                    ["production_flag", "制作対応"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!modalEdit[key]}
                        onChange={(e) => setModalEdit({ ...modalEdit, [key]: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">スコア手動調整</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    value={modalEdit.score_adjustment || 0}
                    onChange={(e) => setModalEdit({ ...modalEdit, score_adjustment: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className={`text-sm font-medium w-12 text-center ${
                    (modalEdit.score_adjustment || 0) > 0 ? "text-emerald-600" :
                    (modalEdit.score_adjustment || 0) < 0 ? "text-red-600" : "text-slate-600"
                  }`}>
                    {(modalEdit.score_adjustment || 0) > 0 ? "+" : ""}{modalEdit.score_adjustment || 0}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">自動スコアに加減算されます（-30 ~ +30）</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">メモ</label>
                  {templates.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) applyTemplate(e.target.value);
                        e.target.value = "";
                      }}
                      className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">テンプレート挿入...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.content}>{t.title}</option>
                      ))}
                    </select>
                  )}
                </div>
                <textarea
                  value={modalEdit.notes || ""}
                  onChange={(e) => setModalEdit({ ...modalEdit, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {statusHistory.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                    <History size={12} />
                    ステータス変更履歴
                  </h4>
                  <div className="bg-slate-50 rounded-md p-3 max-h-32 overflow-y-auto space-y-1.5">
                    {statusHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="text-slate-400 whitespace-nowrap">
                          {h.changed_at ? new Date(h.changed_at).toLocaleString("ja-JP") : ""}
                        </span>
                        <span className="bg-slate-200 px-1.5 py-0.5 rounded">{h.old_status}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{h.new_status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={saveModal}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score, rank }: { score: number; rank: string }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-800 border-emerald-200",
    B: "bg-blue-100 text-blue-800 border-blue-200",
    C: "bg-amber-100 text-amber-800 border-amber-200",
    D: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[rank] || colors.D}`}>
      {rank} {score}
    </span>
  );
}

function FlagBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}
