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
  score_rank: string;
  status: string;
  notes: string;
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
                        className="text-xs text-blue-500 hover:underline"
                      >
                        あり
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
                          <button onClick={() => startEdit(c)} className="text-blue-500 hover:text-blue-700 p-1">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 p-1">
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
