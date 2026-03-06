import { useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { api } from "../api";
import { Pagination } from "../components/common";
import { CompanyFilterBar, CompanyTable, CompanyEditModal } from "../components/companies";
import type { Company } from "../types";

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
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const fetchCompanies = useCallback(() => {
    const params: Record<string, string | number | boolean> = { page, per_page: 50 };
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.score_rank) params.score_rank = filters.score_rank;
    if (filters.has_contact) params.has_contact = filters.has_contact === "true";
    if (filters.search) params.search = filters.search;

    api.companies.list(params).then((data) => {
      setCompanies(data.companies);
      setTotal(data.total);
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
    window.open(api.companies.exportCsvUrl(params), "_blank");
  };

  const handleStatusChange = (id: number, newStatus: string) => {
    api.companies.update(id, { status: newStatus }).then(() => fetchCompanies());
  };

  const handleDelete = (id: number) => {
    if (confirm("この企業を削除しますか？")) {
      api.companies.delete(id).then(() => fetchCompanies());
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

      <CompanyFilterBar filters={filters} onFilterChange={setFilters} />

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <CompanyTable
          companies={companies}
          onStatusChange={handleStatusChange}
          onEdit={setEditingCompany}
          onDelete={handleDelete}
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          perPage={50}
          onPageChange={setPage}
        />
      </div>

      {editingCompany && (
        <CompanyEditModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSaved={() => {
            setEditingCompany(null);
            fetchCompanies();
          }}
        />
      )}
    </div>
  );
}
