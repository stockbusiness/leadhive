import { useEffect, useState, useCallback } from "react";
import { Database, Search, Download, CheckSquare, ExternalLink, X, Crown, Lock, ArrowRight, Mail, Users, Briefcase, Bookmark, BookmarkPlus, ChevronDown, ChevronRight, Tag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import { ScoreBadge } from "../components/common";
import type { CompanyMaster, PlanData, PlanUsage, Segment } from "../types";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const SOURCE_LABELS: Record<string, string> = {
  auto: "自動収集",
  google_api: "Google API",
  directory: "ディレクトリ",
  shopify: "Shopify",
  maps: "Googleマップ",
  manual: "手動",
  unknown: "不明",
};

const UPGRADE_PLANS = [
  { name: "スターター", price: "¥4,980/月", imports: "月100件", highlight: false },
  { name: "プロ", price: "¥14,800/月", imports: "無制限", highlight: true },
  { name: "エンタープライズ", price: "要相談", imports: "無制限", highlight: false },
];

function UpgradeGate({ total }: { total: number }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-8 text-white text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-full mb-4">
          <Lock size={28} className="text-white" />
        </div>
        <h3 className="text-xl font-bold mb-2">マスターDBは有料プラン限定</h3>
        <p className="text-indigo-100 text-sm">
          現在 <span className="text-white font-bold text-lg">{total.toLocaleString()}件</span> の企業データにアクセスできます
        </p>
        <p className="text-indigo-200 text-xs mt-1">スターター以上のプランにアップグレードすると即座に利用可能</p>
      </div>

      <div className="p-6">
        <p className="text-sm font-semibold text-slate-600 mb-4 text-center">プラン比較</p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {UPGRADE_PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-lg border p-4 text-center ${
                p.highlight
                  ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              {p.highlight && (
                <div className="text-xs text-indigo-600 font-bold mb-1 flex items-center justify-center gap-1">
                  <Crown size={11} /> 人気
                </div>
              )}
              <p className="font-bold text-slate-800 text-sm">{p.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{p.price}</p>
              <div className="mt-2 text-xs bg-white rounded px-2 py-1 border border-slate-200">
                <span className="text-slate-500">インポート</span>
                <span className="font-semibold text-slate-700 ml-1">{p.imports}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-6">
          {[
            "全プロジェクト横断の企業データを横断検索",
            "スコア・業種・都道府県でフィルタリング",
            "CMS種別・ESCMS優先ターゲット検索",
            "条件保存（セグメント機能）",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckSquare size={15} className="text-indigo-500 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate("/settings?tab=plan")}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          プランを確認する <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function filterLabel(filters: Segment["filters"]): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`"${filters.q}"`);
  if (filters.category) parts.push(filters.category);
  if (filters.prefecture) parts.push(filters.prefecture);
  if (filters.min_score) parts.push(`スコア${filters.min_score}以上`);
  if (filters.cms_type) parts.push(filters.cms_type);
  if (filters.has_email === "true") parts.push("メールあり");
  if (filters.escms_target) parts.push("ESCMS優先");
  if (filters.has_recruitment) parts.push("採用情報あり");
  return parts.length > 0 ? parts.join(" / ") : "フィルターなし";
}

export default function MasterDB() {
  const { currentProject } = useProject();
  const [stats, setStats] = useState<{ total: number; by_category: Record<string, number>; by_source: Record<string, number> } | null>(null);
  const [planInfo, setPlanInfo] = useState<{ plan: PlanData | null; usage: PlanUsage } | null>(null);
  const [items, setItems] = useState<CompanyMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ success: number; duplicate: number; error: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [prefecture, setPrefecture] = useState("all");
  const [minScore, setMinScore] = useState<number | "">("");
  const [cmsType, setCmsType] = useState("all");
  const [hasEmail, setHasEmail] = useState<"" | "true" | "false">("");
  const [escmsTarget, setEscmsTarget] = useState(false);
  const [hasRecruitment, setHasRecruitment] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentPanelOpen, setSegmentPanelOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [segmentDesc, setSegmentDesc] = useState("");
  const [savingSegment, setSavingSegment] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  useEffect(() => {
    api.master.stats().then(setStats).catch(() => {});
    api.plans.current().then(setPlanInfo).catch(() => {});
    api.segments.list().then((d) => setSegments(d.segments)).catch(() => {});
  }, []);

  const isFreePlan = planInfo?.plan?.max_master_db_imports === 0;
  const importLimit = planInfo?.plan?.max_master_db_imports ?? null;
  const importsUsed = planInfo?.usage?.master_db_imports_this_month ?? 0;
  const importsRemaining = (importLimit !== null && importLimit > 0) ? importLimit - importsUsed : null;

  const handleSearch = useCallback(() => {
    setLoading(true);
    setImportResult(null);
    setSelectedDomains(new Set());
    const params: Record<string, any> = { limit: 100 };
    if (q.trim()) params.q = q.trim();
    if (category !== "all") params.category = category;
    if (prefecture !== "all") params.prefecture = prefecture;
    if (minScore !== "") params.min_score = minScore;
    if (cmsType !== "all") params.cms_type = cmsType;
    if (hasEmail === "true") params.has_email = true;
    if (hasEmail === "false") params.has_email = false;
    if (escmsTarget) params.escms_target = true;
    if (hasRecruitment) params.has_recruitment = true;
    if (currentProject?.id) params.project_id = currentProject.id;
    api.master.search(params)
      .then((data) => {
        setItems(data.items);
        setHasSearched(true);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, category, prefecture, minScore, cmsType, hasEmail, escmsTarget, hasRecruitment, currentProject]);

  const applySegment = (seg: Segment) => {
    const f = seg.filters;
    setQ(f.q || "");
    setCategory(f.category || "all");
    setPrefecture(f.prefecture || "all");
    setMinScore(f.min_score ?? "");
    setCmsType(f.cms_type || "all");
    setHasEmail(f.has_email ?? "");
    setEscmsTarget(!!f.escms_target);
    setHasRecruitment(!!f.has_recruitment);
    setActiveSegmentId(seg.id);
    setSegmentPanelOpen(false);
    setTimeout(() => {
      const btn = document.getElementById("master-search-btn");
      if (btn) btn.click();
    }, 50);
  };

  const getCurrentFilters = (): Segment["filters"] => {
    const f: Segment["filters"] = {};
    if (q.trim()) f.q = q.trim();
    if (category !== "all") f.category = category;
    if (prefecture !== "all") f.prefecture = prefecture;
    if (minScore !== "") f.min_score = minScore as number;
    if (cmsType !== "all") f.cms_type = cmsType;
    if (hasEmail) f.has_email = hasEmail;
    if (escmsTarget) f.escms_target = true;
    if (hasRecruitment) f.has_recruitment = true;
    return f;
  };

  const handleSaveSegment = async () => {
    if (!segmentName.trim()) return;
    setSavingSegment(true);
    try {
      const filters = getCurrentFilters();
      const data = await api.segments.create(segmentName.trim(), segmentDesc.trim(), filters);
      setSegments((prev) => [data.segment, ...prev]);
      setShowSaveDialog(false);
      setSegmentName("");
      setSegmentDesc("");
      setActiveSegmentId(data.segment.id);
      setSegmentPanelOpen(true);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "保存に失敗しました");
    }
    setSavingSegment(false);
  };

  const handleDeleteSegment = async (id: number) => {
    if (!confirm("このセグメントを削除しますか？")) return;
    try {
      await api.segments.delete(id);
      setSegments((prev) => prev.filter((s) => s.id !== id));
      if (activeSegmentId === id) setActiveSegmentId(null);
    } catch {
      alert("削除に失敗しました");
    }
  };

  const handleSelectAll = () => {
    if (selectedDomains.size === items.length) {
      setSelectedDomains(new Set());
    } else {
      setSelectedDomains(new Set(items.map((i) => i.domain)));
    }
  };

  const handleSelectOne = (domain: string) => {
    const newSet = new Set(selectedDomains);
    if (newSet.has(domain)) newSet.delete(domain);
    else newSet.add(domain);
    setSelectedDomains(newSet);
  };

  const handleImport = async () => {
    if (!currentProject?.id) {
      alert("プロジェクトを選択してください");
      return;
    }
    if (selectedDomains.size === 0) {
      alert("インポートする企業を選択してください");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.master.import(Array.from(selectedDomains), currentProject.id);
      setImportResult(result);
      setSelectedDomains(new Set());
      handleSearch();
      api.plans.current().then(setPlanInfo).catch(() => {});
    } catch {
      alert("インポートに失敗しました");
    }
    setImporting(false);
  };

  const categories = stats ? Object.keys(stats.by_category).filter(Boolean) : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database size={24} className="text-indigo-600" />
            マスターデータベース
          </h2>
          <p className="text-sm text-slate-500 mt-1">全プロジェクト横断の企業プール。検索して現在のプロジェクトにインポートできます。</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <p className="text-sm text-slate-500">総登録件数</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.total.toLocaleString()}</p>
          </div>
          {Object.entries(stats.by_source).slice(0, 3).map(([src, cnt]) => (
            <div key={src} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{SOURCE_LABELS[src] || src}</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{(cnt as number).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {isFreePlan ? (
        <UpgradeGate total={stats?.total ?? 0} />
      ) : (
        <>
          {importsRemaining !== null && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <Crown size={16} className="text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-800">
                今月の残りインポート回数:
                <span className={`font-bold ml-1 ${importsRemaining <= 10 ? "text-red-600" : "text-amber-900"}`}>
                  {importsRemaining}件
                </span>
                <span className="text-amber-600"> / {importLimit}件</span>
              </span>
            </div>
          )}

          {/* Segment Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => setSegmentPanelOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Bookmark size={15} className="text-indigo-500" />
                保存済みセグメント
                {segments.length > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-normal">
                    {segments.length}件
                  </span>
                )}
              </span>
              {segmentPanelOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
            </button>

            {segmentPanelOpen && (
              <div className="border-t border-slate-100">
                {segments.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-sm">
                    <Tag size={28} className="mx-auto mb-2 opacity-30" />
                    <p>保存済みセグメントはありません</p>
                    <p className="text-xs mt-1">検索条件を絞り込んだあと「セグメントとして保存」で登録できます</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {segments.map((seg) => (
                      <div
                        key={seg.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group ${activeSegmentId === seg.id ? "bg-indigo-50" : ""}`}
                      >
                        <button
                          onClick={() => applySegment(seg)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className={`text-sm font-medium ${activeSegmentId === seg.id ? "text-indigo-700" : "text-slate-800"}`}>
                            {seg.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{filterLabel(seg.filters)}</p>
                          {seg.description && (
                            <p className="text-xs text-slate-500 truncate">{seg.description}</p>
                          )}
                        </button>
                        <button
                          onClick={() => applySegment(seg)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          適用
                        </button>
                        <button
                          onClick={() => handleDeleteSegment(seg.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Search size={16} />
                企業検索
                {activeSegmentId && (
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-normal flex items-center gap-1">
                    <Bookmark size={10} />
                    {segments.find((s) => s.id === activeSegmentId)?.name}
                    <button
                      onClick={() => setActiveSegmentId(null)}
                      className="ml-0.5 hover:text-indigo-900"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="会社名・ドメイン・カテゴリ・都道府県で検索..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">全カテゴリ</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <select
                  value={prefecture}
                  onChange={(e) => setPrefecture(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">全都道府県</option>
                  {PREFECTURES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">最低スコア</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                  className="w-20 border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">CMS種別</label>
                <select
                  value={cmsType}
                  onChange={(e) => setCmsType(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">全て</option>
                  <option value="Shopify">Shopify</option>
                  <option value="WordPress">WordPress</option>
                  <option value="BASE">BASE</option>
                  <option value="MakeShop">MakeShop</option>
                  <option value="futureshop">futureshop</option>
                  <option value="カラーミー">カラーミー</option>
                  <option value="EC-CUBE">EC-CUBE</option>
                  <option value="Wix">Wix</option>
                  <option value="STORES">STORES</option>
                  <option value="none">未検出</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">メール</label>
                <select
                  value={hasEmail}
                  onChange={(e) => setHasEmail(e.target.value as any)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">全て</option>
                  <option value="true">あり</option>
                  <option value="false">なし</option>
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={escmsTarget}
                  onChange={(e) => setEscmsTarget(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-violet-700 font-medium">ESCMS優先</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasRecruitment}
                  onChange={(e) => setHasRecruitment(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                採用情報あり
              </label>
              <button
                id="master-search-btn"
                onClick={handleSearch}
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Search size={15} />
                {loading ? "検索中..." : "検索"}
              </button>
              <button
                onClick={() => {
                  setSegmentName("");
                  setSegmentDesc("");
                  setShowSaveDialog(true);
                }}
                className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                title="現在のフィルター条件をセグメントとして保存"
              >
                <BookmarkPlus size={15} className="text-indigo-500" />
                セグメント保存
              </button>
            </div>
          </div>

          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-4">
              <CheckSquare size={18} className="text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">
                インポート完了: 成功 {importResult.success}件 / 重複スキップ {importResult.duplicate}件 / エラー {importResult.error}件
              </span>
              <button onClick={() => setImportResult(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">
                <X size={16} />
              </button>
            </div>
          )}

          {hasSearched && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-600">
                  検索結果: <strong>{items.length}</strong>件
                  {selectedDomains.size > 0 && (
                    <span className="ml-2 text-indigo-600">{selectedDomains.size}件選択中</span>
                  )}
                </span>
                {selectedDomains.size > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing || !currentProject?.id}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Download size={14} />
                    {importing ? "インポート中..." : `現在のプロジェクトにインポート (${selectedDomains.size}件)`}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && selectedDomains.size === items.length}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">会社名</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">CMS</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">カテゴリ</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-600">スコア</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">所在地</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-600">情報</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-600">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.domain}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${selectedDomains.has(item.domain) ? "bg-indigo-50" : ""} ${item.already_in_project ? "opacity-60" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedDomains.has(item.domain)}
                            onChange={() => handleSelectOne(item.domain)}
                            disabled={item.already_in_project}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            {item.company_name || item.domain}
                            {item.escms_target_flag && (
                              <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold">ESCMS</span>
                            )}
                          </div>
                          <a
                            href={item.website_url || `https://${item.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                          >
                            {item.domain} <ExternalLink size={10} />
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          {item.cms_type ? (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              item.cms_type === "Shopify" ? "bg-green-100 text-green-700" :
                              item.cms_type === "WordPress" ? "bg-blue-100 text-blue-700" :
                              item.cms_type === "BASE" ? "bg-orange-100 text-orange-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {item.cms_type}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{item.category_main || "-"}</td>
                        <td className="px-3 py-2 text-center">
                          <ScoreBadge score={item.score_total} rank={item.score_rank} />
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-xs">
                          {item.prefecture}{item.city}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.email && (
                              <span title={item.email} className="text-blue-500"><Mail size={13} /></span>
                            )}
                            {item.has_recruitment && (
                              <span title="採用情報あり" className="text-emerald-500"><Users size={13} /></span>
                            )}
                            {(item.sns_links && Object.values(item.sns_links as Record<string,any>).some(Boolean)) && (
                              <span title="SNSあり" className="text-indigo-400"><Briefcase size={13} /></span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {item.already_in_project ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">登録済み</span>
                          ) : (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">未登録</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                          検索結果がありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasSearched && (
            <div className="text-center py-16 text-slate-400">
              <Database size={48} className="mx-auto mb-3 opacity-30" />
              <p>キーワードを入力して検索してください</p>
              <p className="text-xs mt-1">全プロジェクトの収集済み企業から横断検索できます</p>
            </div>
          )}
        </>
      )}

      {/* Save Segment Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <BookmarkPlus size={18} className="text-indigo-500" />
                セグメントとして保存
              </h3>
              <button onClick={() => setShowSaveDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 border border-slate-200">
              <p className="font-medium text-slate-600 mb-1">現在のフィルター条件</p>
              <p>{filterLabel(getCurrentFilters())}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  セグメント名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="例: ESCMS優先・兵庫県"
                  maxLength={80}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">メモ（任意）</label>
                <textarea
                  value={segmentDesc}
                  onChange={(e) => setSegmentDesc(e.target.value)}
                  placeholder="このセグメントの用途や注意点など"
                  rows={2}
                  maxLength={200}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveSegment}
                disabled={savingSegment || !segmentName.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Bookmark size={14} />
                {savingSegment ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
