import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Download, CheckSquare, Copy, X, GitMerge, MoveRight, Upload, LayoutList, Kanban, FileDown, Lock, Mail, LayoutDashboard, Filter, Search } from "lucide-react";
import { api } from "../api";
import { Pagination } from "../components/common";
import { CompanyFilterBar, CompanyTable, CompanyEditModal } from "../components/companies";
import CompanyKanban from "../components/companies/CompanyKanban";
import EmailCampaignModal from "../components/EmailCampaignModal";
import HelpPanel from "../components/HelpPanel";
import { STATUSES } from "../constants";
import type { Company, Project, PlanData } from "../types";
import { useProject } from "../contexts/ProjectContext";
import { useAuth } from "../contexts/AuthContext";

interface DuplicateGroup {
  normalized_domain: string;
  companies: Company[];
}

type ViewMode = "list" | "kanban";

export default function Companies() {
  const { projects, currentProject } = useProject();
  const { user } = useAuth();
  const isAdmin = !!user?.is_system_admin;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    category: searchParams.get("category") || "",
    status: searchParams.get("status") || "",
    score_rank: searchParams.get("score_rank") || "",
    has_contact: searchParams.get("has_contact") || "",
    search: searchParams.get("search") || "",
    tag: searchParams.get("tag") || "",
    assignee_id: searchParams.get("assignee_id") || "",
    follow_up_filter: searchParams.get("follow_up_filter") || "",
    cms_type: searchParams.get("cms_type") || "",
    ec_only: searchParams.get("ec_only") || "",
    ec_scale: searchParams.get("ec_scale") || "",
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("leadhive_view_mode") as ViewMode) || "list";
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [xlsxExporting, setXlsxExporting] = useState(false);
  const [csvPlan, setCsvPlan] = useState<PlanData | null | undefined>(undefined);
  const [showEmailCampaignModal, setShowEmailCampaignModal] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [allSelectedMode, setAllSelectedMode] = useState(false);
  const [scanningForms, setScanningForms] = useState(false);
  const [scanFormMsg, setScanFormMsg] = useState<string | null>(null);

  useEffect(() => {
    api.plans.current().then((d) => setCsvPlan(d.plan ?? null)).catch(() => setCsvPlan(null));
  }, []);

  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const fetchCompanies = useCallback(() => {
    const params: Record<string, string | number | boolean> = {
      page: viewMode === "kanban" ? 1 : page,
      per_page: viewMode === "kanban" ? 500 : 50,
    };
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.score_rank) params.score_rank = filters.score_rank;
    if (filters.has_contact) params.has_contact = filters.has_contact === "true";
    if (filters.search) params.search = filters.search;
    if (filters.tag) params.tag = filters.tag;
    if (filters.assignee_id === "unassigned") params.assignee_id = 0;
    else if (filters.assignee_id) params.assignee_id = Number(filters.assignee_id);
    if (filters.follow_up_filter) params.follow_up_filter = filters.follow_up_filter;
    if (filters.cms_type) params.cms_type = filters.cms_type;
    if (filters.ec_only === "true") params.ec_only = true;
    if (filters.ec_scale) params.ec_scale = filters.ec_scale;

    api.companies.list(params).then((data) => {
      setCompanies(data.companies);
      setTotal(data.total);
    });
  }, [page, filters, viewMode]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    setSelectedIds(new Set());
    setAllSelectedMode(false);
  }, [page, filters]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("leadhive_view_mode", mode);
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    setExportMessage(null);
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.score_rank) params.set("score_rank", filters.score_rank);
    if (filters.has_contact) params.set("has_contact", filters.has_contact);
    if (filters.cms_type) params.set("cms_type", filters.cms_type);
    if (filters.ec_only === "true") params.set("ec_only", "true");
    if (filters.ec_scale) params.set("ec_scale", filters.ec_scale);
    if (currentProject?.id) params.set("project_id", String(currentProject.id));
    try {
      const { blob, count, limit } = await api.companies.exportCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `companies_export_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const msg = limit !== null
        ? `${count}件をエクスポートしました（プランの上限: ${limit}件）`
        : `${count}件をエクスポートしました`;
      setExportMessage(msg);
      setTimeout(() => setExportMessage(null), 4000);
    } catch {
    } finally {
      setExportLoading(false);
    }
  };

  const csvExportLabel = (() => {
    if (csvPlan === undefined) return "CSV出力";
    if (csvPlan?.max_csv_export === null || csvPlan === null) return "CSV出力";
    return `CSV出力（上位${csvPlan.max_csv_export.toLocaleString()}件）`;
  })();

  const handleXlsxExport = async () => {
    setXlsxExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      if (filters.score_rank) params.set("score_rank", filters.score_rank);
      if (filters.cms_type) params.set("cms_type", filters.cms_type);
      if (filters.ec_only === "true") params.set("ec_only", "true");
      if (filters.ec_scale) params.set("ec_scale", filters.ec_scale);
      if (currentProject?.id) params.set("project_id", String(currentProject.id));
      const resp = await fetch(`/api/companies/export.xlsx?${params.toString()}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `companies_export.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Excel出力に失敗しました");
    }
    setXlsxExporting(false);
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

  const handleSelectAllFiltered = async () => {
    setSelectingAll(true);
    try {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      if (filters.score_rank) params.score_rank = filters.score_rank;
      if (filters.has_contact) params.has_contact = filters.has_contact === "true";
      if (filters.search) params.search = filters.search;
      if (filters.tag) params.tag = filters.tag;
      if (filters.assignee_id === "unassigned") params.assignee_id = 0;
      else if (filters.assignee_id) params.assignee_id = Number(filters.assignee_id);
      if (filters.follow_up_filter) params.follow_up_filter = filters.follow_up_filter;
      if (filters.cms_type) params.cms_type = filters.cms_type;
      if (filters.ec_only === "true") params.ec_only = true;
      if (filters.ec_scale) params.ec_scale = filters.ec_scale;
      if (currentProject?.id) params.project_id = currentProject.id;
      const data = await api.companies.getAllIds(params);
      setSelectedIds(new Set(data.ids));
      setAllSelectedMode(true);
    } catch {
      alert("全件選択に失敗しました");
    } finally {
      setSelectingAll(false);
    }
  };

  const handleBulkScanForms = async () => {
    if (selectedIds.size === 0) return;
    setScanningForms(true);
    setScanFormMsg(null);
    try {
      const result = await api.companies.bulkScanForms(Array.from(selectedIds));
      setScanFormMsg(`スキャン完了: ${result.scanned}件中 ${result.found}件でフォームURL検出`);
      fetchCompanies();
      setTimeout(() => setScanFormMsg(null), 6000);
    } catch {
      setScanFormMsg("スキャンに失敗しました");
      setTimeout(() => setScanFormMsg(null), 4000);
    } finally {
      setScanningForms(false);
    }
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

  const handleImport = async () => {
    if (!importFile || !currentProject) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.companies.importCsv(importFile, currentProject.id);
      setImportResult({ added: result.added, skipped: result.skipped, errors: result.errors });
      fetchCompanies();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">候補企業一覧</h2>
        <div className="flex items-center flex-wrap gap-2">
          <HelpPanel
            title="候補企業一覧のヘルプ"
            manualLinks={[
              { label: "候補企業の管理・評価", description: "ステータス変更・スコア・フラグの使い方", to: "/manual#companies" },
              { label: "企業の収集方法", description: "URLスクレイピングと自動収集の流れ", to: "/manual#collection" },
              { label: "営業パイプライン", description: "カンバンビューでの進捗管理", to: "/manual#pipeline" },
            ]}
            tips={[
              "ステータスを「対象候補」に変えるとパイプラインに表示されます",
              "チェックボックスで複数選択し、一括でステータス変更できます",
              "スコア順にソートして優先度の高い企業から着手しましょう",
              "CSVインポートで既存リストを一括登録できます",
            ]}
          />
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-slate-800 font-medium" : "text-slate-500 hover:text-slate-700"}`}
            >
              <LayoutList size={15} />
              <span className="hidden sm:inline">リスト</span>
            </button>
            <button
              onClick={() => handleViewModeChange("kanban")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${viewMode === "kanban" ? "bg-white shadow-sm text-slate-800 font-medium" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Kanban size={15} />
              <span className="hidden sm:inline">カンバン</span>
            </button>
          </div>
          <button
            onClick={handleDuplicateCheck}
            disabled={duplicateLoading}
            className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <Copy size={15} />
            <span className="hidden sm:inline">{duplicateLoading ? "チェック中..." : "重複チェック"}</span>
          </button>
          <button
            onClick={() => { setShowImportModal(true); setImportResult(null); setImportFile(null); }}
            className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-violet-700 transition-colors"
          >
            <Upload size={15} />
            <span className="hidden sm:inline">CSVインポート</span>
          </button>
          {isAdmin ? (
            <button
              onClick={handleExportCSV}
              disabled={exportLoading}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Download size={15} className={exportLoading ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{exportLoading ? "出力中..." : csvExportLabel}</span>
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("plan-limit-exceeded", { detail: { message: "CSVエクスポートは有料プランで利用できます。" } }))}
              className="flex items-center gap-1.5 bg-slate-300 text-slate-500 px-3 py-2 rounded-lg text-sm cursor-not-allowed"
            >
              <Lock size={15} />
              <span className="hidden sm:inline">CSV出力</span>
            </button>
          )}
          <button
            onClick={handleXlsxExport}
            disabled={xlsxExporting}
            className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            <FileDown size={15} className={xlsxExporting ? "animate-bounce" : ""} />
            <span className="hidden sm:inline">{xlsxExporting ? "出力中..." : "Excel出力"}</span>
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <Download size={16} className="text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-700 font-medium">{exportMessage}</span>
          <button onClick={() => setExportMessage(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <X size={14} />
          </button>
        </div>
      )}

      {(filters.cms_type || filters.ec_only === "true") && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
          <Filter size={16} className="text-indigo-500 flex-shrink-0" />
          <span className="text-sm text-indigo-800 font-medium">
            {filters.ec_only === "true"
              ? "🛍️ ECサイト企業でフィルター中"
              : `🔍 CMS/プラットフォーム「${filters.cms_type}」でフィルター中`}
          </span>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 ml-auto text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <LayoutDashboard size={14} />
            ダッシュボードに戻る
          </button>
        </div>
      )}

      <CompanyFilterBar filters={filters} onFilterChange={handleFilterChange} />

      {selectedIds.size > 0 && viewMode === "list" && (
        <div className="space-y-0">
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex-wrap">
            <CheckSquare size={18} className="text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size}件選択中
            </span>
            {!allSelectedMode && total > companies.length && (
              <button
                onClick={handleSelectAllFiltered}
                disabled={selectingAll}
                className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 disabled:opacity-50"
              >
                {selectingAll ? "取得中..." : `フィルター条件の全${total}件を選択する`}
              </button>
            )}
            {allSelectedMode && (
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                全件選択中
              </span>
            )}
            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {isAdmin ? (
                <>
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
                </>
              ) : (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("plan-limit-exceeded", { detail: { message: "ステータス一括変更は有料プランで利用できます。" } }))}
                  className="flex items-center gap-1.5 bg-slate-200 text-slate-500 px-3 py-1 rounded text-sm cursor-not-allowed"
                >
                  <Lock size={13} />
                  一括変更
                </button>
              )}
              <button
                onClick={() => setShowMoveModal(true)}
                className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors"
              >
                <MoveRight size={14} />
                <span className="hidden sm:inline">プロジェクト移動</span>
              </button>
              <button
                onClick={handleBulkScanForms}
                disabled={scanningForms}
                className="flex items-center gap-1.5 bg-cyan-600 text-white px-3 py-1.5 rounded text-sm hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
                title="選択企業のサイトをスキャンしてお問い合わせフォームURLを事前検出・保存します"
              >
                <Search size={14} className={scanningForms ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{scanningForms ? "スキャン中..." : "フォームURL検出"}</span>
              </button>
              <button
                onClick={() => setShowEmailCampaignModal(true)}
                className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition-colors font-medium"
              >
                <Mail size={14} />
                一括メール送信
              </button>
              <button
                onClick={() => { setSelectedIds(new Set()); setAllSelectedMode(false); }}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                解除
              </button>
            </div>
          </div>
          {scanFormMsg && (
            <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2 mt-2">
              <Search size={14} className="text-cyan-600 flex-shrink-0" />
              <span className="text-sm text-cyan-800 font-medium">{scanFormMsg}</span>
              <button onClick={() => setScanFormMsg(null)} className="ml-auto text-cyan-400 hover:text-cyan-600"><X size={13} /></button>
            </div>
          )}
        </div>
      )}

      {viewMode === "list" ? (
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
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <CompanyKanban companies={companies} onStatusChange={async (id, status) => { await api.companies.update(id, { status }); fetchCompanies(); }} />
        </div>
      )}

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

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Upload size={18} />
                CSVインポート
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <FileDown size={14} className="text-violet-600 flex-shrink-0" />
                <span>CSVのフォーマットを確認するには</span>
                <a
                  href={api.companies.csvTemplateUrl()}
                  download
                  className="text-violet-600 hover:underline font-medium"
                >
                  テンプレートをダウンロード
                </a>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">CSVファイルを選択</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 border border-slate-300 rounded-lg p-1"
                />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>対応カラム: <code className="bg-slate-100 px-1 rounded">name</code>, <code className="bg-slate-100 px-1 rounded">website_url</code>, <code className="bg-slate-100 px-1 rounded">email</code>, <code className="bg-slate-100 px-1 rounded">phone</code>, <code className="bg-slate-100 px-1 rounded">prefecture</code>, <code className="bg-slate-100 px-1 rounded">city</code>, <code className="bg-slate-100 px-1 rounded">memo</code>, <code className="bg-slate-100 px-1 rounded">status</code>, <code className="bg-slate-100 px-1 rounded">category_main</code>, <code className="bg-slate-100 px-1 rounded">rank</code></p>
                <p>重複するURLは自動的にスキップされます。</p>
              </div>
              {importResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">インポート結果</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-700">追加: <strong>{importResult.added}件</strong></span>
                    <span className="text-amber-600">スキップ: <strong>{importResult.skipped}件</strong></span>
                    {importResult.errors.length > 0 && (
                      <span className="text-red-600">エラー: <strong>{importResult.errors.length}件</strong></span>
                    )}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="text-xs text-red-600 bg-red-50 rounded p-2 max-h-24 overflow-y-auto">
                      {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {importResult ? "閉じる" : "キャンセル"}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  <Upload size={14} />
                  {importing ? "インポート中..." : "インポート実行"}
                </button>
              )}
            </div>
          </div>
        </div>
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
                            <div className="text-xs text-slate-500 truncate">{c.website_url}</div>
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
                            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">メイン</span>
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

      {showEmailCampaignModal && (
        <EmailCampaignModal
          companyIds={Array.from(selectedIds)}
          companies={companies.filter((c) => selectedIds.has(c.id))}
          onClose={() => setShowEmailCampaignModal(false)}
          onDone={() => setShowEmailCampaignModal(false)}
        />
      )}
    </div>
  );
}
