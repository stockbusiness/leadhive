import { useEffect, useState, useCallback } from "react";
import { Download, CheckSquare, Copy, X, GitMerge, MoveRight } from "lucide-react";
import { api } from "../api";
import { Pagination } from "../components/common";
import { CompanyFilterBar, CompanyTable, CompanyEditModal } from "../components/companies";
import { STATUSES } from "../constants";
import type { Company, Project } from "../types";
import { useProject } from "../contexts/ProjectContext";

interface DuplicateGroup {
  normalized_domain: string;
  companies: Company[];
}

export default function Companies() {
  const { projects, currentProject } = useProject();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    score_rank: "",
    has_contact: "",
    search: "",
    tag: "",
  });
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [mergeSelections, setMergeSelections] = useState<Record<string, number>>({});
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetProjectId, setMoveTargetProjectId] = useState<number | "">("");
  const [moveLoading, setMoveLoading] = useState(false);

  const fetchCompanies = useCallback(() => {
    const params: Record<string, string | number | boolean> = { page, per_page: 50 };
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.score_rank) params.score_rank = filters.score_rank;
    if (filters.has_contact) params.has_contact = filters.has_contact === "true";
    if (filters.search) params.search = filters.search;
    if (filters.tag) params.tag = filters.tag;

    api.companies.list(params).then((data) => {
      setCompanies(data.companies);
      setTotal(data.total);
    });
  }, [page, filters]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filters]);

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

  const handleRescrape = (id: number) => {
    api.companies.rescrape(id).then((data: any) => {
      if (data.error) {
        alert(data.error);
      } else {
        fetchCompanies();
      }
    }).catch(() => alert("再スクレイピングに失敗しました"));
  };

  const handleBulkStatusChange = () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkLoading(true);
    api.companies
      .bulkStatus(Array.from(selectedIds), bulkStatus)
      .then(() => {
        setSelectedIds(new Set());
        setBulkStatus("");
        fetchCompanies();
      })
      .finally(() => setBulkLoading(false));
  };

  const handleMoveProject = async () => {
    if (!moveTargetProjectId || selectedIds.size === 0) return;
    setMoveLoading(true);
    try {
      const result = await api.companies.moveProject(Array.from(selectedIds), moveTargetProjectId as number);
      alert(`移動完了: ${result.moved}件移動、${result.skipped}件スキップ（重複）`);
      setShowMoveModal(false);
      setSelectedIds(new Set());
      setMoveTargetProjectId("");
      fetchCompanies();
    } catch {
      alert("移動に失敗しました");
    }
    setMoveLoading(false);
  };

  const handleDuplicateCheck = () => {
    setDuplicateLoading(true);
    api.companies
      .getDuplicates()
      .then((data) => {
        setDuplicateGroups(data.duplicate_groups);
        setMergeSelections({});
        setShowDuplicateModal(true);
      })
      .catch(() => alert("重複チェックに失敗しました"))
      .finally(() => setDuplicateLoading(false));
  };

  const handleMerge = (group: DuplicateGroup) => {
    const mainId = mergeSelections[group.normalized_domain];
    if (!mainId) {
      alert("メイン企業を選択してください");
      return;
    }
    const mergeIds = group.companies
      .filter((c) => c.id !== mainId)
      .map((c) => c.id);
    if (!confirm(`${mergeIds.length}件の企業をマージしますか？マージされた企業は削除されます。`)) return;
    api.companies
      .merge(mainId, mergeIds)
      .then(() => {
        setDuplicateGroups((prev) =>
          prev.filter((g) => g.normalized_domain !== group.normalized_domain)
        );
        fetchCompanies();
      })
      .catch(() => alert("マージに失敗しました"));
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">候補企業一覧</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDuplicateCheck}
            disabled={duplicateLoading}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <Copy size={16} />
            {duplicateLoading ? "チェック中..." : "重複チェック"}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors"
          >
            <Download size={16} />
            CSV出力
          </button>
        </div>
      </div>

      <CompanyFilterBar filters={filters} onFilterChange={setFilters} />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <CheckSquare size={18} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size}件選択中
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">ステータスを選択...</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={handleBulkStatusChange}
            disabled={!bulkStatus || bulkLoading}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkLoading ? "処理中..." : "一括変更"}
          </button>
          <button
            onClick={() => setShowMoveModal(true)}
            className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors"
          >
            <MoveRight size={14} />
            プロジェクト移動
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-slate-500 hover:text-slate-700 ml-auto"
          >
            選択解除
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <CompanyTable
          companies={companies}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onStatusChange={handleStatusChange}
          onEdit={setEditingCompany}
          onDelete={handleDelete}
          onRescrape={handleRescrape}
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

      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MoveRight size={20} />
                プロジェクト間移動
              </h3>
              <button onClick={() => setShowMoveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                <strong>{selectedIds.size}件</strong>の企業を別のプロジェクトに移動します。
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">移動先プロジェクト</label>
                <select
                  value={moveTargetProjectId}
                  onChange={(e) => setMoveTargetProjectId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">プロジェクトを選択...</option>
                  {projects.filter((p) => p.id !== currentProject?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400">
                移動先に同じドメインの企業が既に存在する場合はスキップされます。
              </p>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleMoveProject}
                disabled={!moveTargetProjectId || moveLoading}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                <MoveRight size={15} />
                {moveLoading ? "移動中..." : "移動実行"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                重複企業チェック結果
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {duplicateGroups.length}グループ検出
                </span>
              </h3>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {duplicateGroups.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  重複企業は見つかりませんでした
                </div>
              ) : (
                duplicateGroups.map((group) => (
                  <div
                    key={group.normalized_domain}
                    className="border border-slate-200 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-700">
                        {group.normalized_domain}
                        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          {group.companies.length}件
                        </span>
                      </h4>
                      <button
                        onClick={() => handleMerge(group)}
                        disabled={!mergeSelections[group.normalized_domain]}
                        className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <GitMerge size={14} />
                        マージ実行
                      </button>
                    </div>

                    <div className="space-y-2">
                      {group.companies.map((c) => (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            mergeSelections[group.normalized_domain] === c.id
                              ? "border-blue-400 bg-blue-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`merge-${group.normalized_domain}`}
                            checked={mergeSelections[group.normalized_domain] === c.id}
                            onChange={() =>
                              setMergeSelections((prev) => ({
                                ...prev,
                                [group.normalized_domain]: c.id,
                              }))
                            }
                            className="text-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-800 truncate">
                              {c.company_name || "名称未設定"}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {c.website_url}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span>ID: {c.id}</span>
                              <span>スコア: {c.score_total}</span>
                              <span>ランク: {c.score_rank}</span>
                              {c.phone && <span>TEL: {c.phone}</span>}
                              {c.email && <span>Mail: {c.email}</span>}
                              <span>ステータス: {c.status}</span>
                            </div>
                          </div>
                          {mergeSelections[group.normalized_domain] === c.id && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                              メイン
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      メインに残す企業を選択してください。他の企業の情報はメインに統合され、削除されます。
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
