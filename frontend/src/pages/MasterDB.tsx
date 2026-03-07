import { useEffect, useState, useCallback } from "react";
import { Database, Search, Download, CheckSquare, ExternalLink, X } from "lucide-react";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import { ScoreBadge } from "../components/common";
import type { CompanyMaster } from "../types";

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

export default function MasterDB() {
  const { currentProject } = useProject();
  const [stats, setStats] = useState<{ total: number; by_category: Record<string, number>; by_source: Record<string, number> } | null>(null);
  const [items, setItems] = useState<CompanyMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ success: number; duplicate: number; error: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [prefecture, setPrefecture] = useState("all");
  const [minScore, setMinScore] = useState<number | "">("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    api.master.stats().then(setStats).catch(() => {});
  }, []);

  const handleSearch = useCallback(() => {
    setLoading(true);
    setImportResult(null);
    setSelectedDomains(new Set());
    const params: Record<string, any> = { limit: 100 };
    if (q.trim()) params.q = q.trim();
    if (category !== "all") params.category = category;
    if (prefecture !== "all") params.prefecture = prefecture;
    if (minScore !== "") params.min_score = minScore;
    if (currentProject?.id) params.project_id = currentProject.id;
    api.master.search(params)
      .then((data) => {
        setItems(data.items);
        setHasSearched(true);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, category, prefecture, minScore, currentProject]);

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

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <Search size={16} />
          企業検索
        </h3>
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
        <div className="flex gap-3 items-center">
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
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Search size={15} />
            {loading ? "検索中..." : "検索"}
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
                  <th className="text-left px-3 py-2 font-medium text-slate-600">カテゴリ</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-600">スコア</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">所在地</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">収集元</th>
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
                      <div className="font-medium text-slate-800">{item.company_name || item.domain}</div>
                      <a
                        href={item.website_url || `https://${item.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                      >
                        {item.domain} <ExternalLink size={10} />
                      </a>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.category_main || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <ScoreBadge score={item.score_total} rank={item.score_rank} />
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {item.prefecture}{item.city}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {SOURCE_LABELS[item.source] || item.source || "-"}
                      </span>
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
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
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
    </div>
  );
}
