import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  GanttChartSquare, RefreshCw, ChevronDown, CalendarClock,
  ExternalLink, Building2, Filter, X, AlertCircle,
} from "lucide-react";
import { api } from "../api";
import type { PipelineCard } from "../types";
import type { Project } from "../types";
import { SCORE_BADGE_COLORS } from "../constants";

const STATUSES = [
  "未確認", "対象候補", "除外", "アプローチ前",
  "フォーム送信済", "返信あり", "面談化", "代理店化", "失注",
];

const COLUMN_STYLES: Record<string, { header: string; badge: string; bg: string; border: string }> = {
  "未確認":      { header: "bg-slate-100 text-slate-700", badge: "bg-slate-200 text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
  "対象候補":    { header: "bg-blue-100 text-blue-800",   badge: "bg-blue-200 text-blue-800",   bg: "bg-blue-50",  border: "border-blue-200" },
  "除外":        { header: "bg-red-100 text-red-800",     badge: "bg-red-200 text-red-800",     bg: "bg-red-50",   border: "border-red-200" },
  "アプローチ前": { header: "bg-indigo-100 text-indigo-800", badge: "bg-indigo-200 text-indigo-800", bg: "bg-indigo-50", border: "border-indigo-200" },
  "フォーム送信済": { header: "bg-violet-100 text-violet-800", badge: "bg-violet-200 text-violet-800", bg: "bg-violet-50", border: "border-violet-200" },
  "返信あり":    { header: "bg-purple-100 text-purple-800", badge: "bg-purple-200 text-purple-800", bg: "bg-purple-50", border: "border-purple-200" },
  "面談化":      { header: "bg-amber-100 text-amber-800",  badge: "bg-amber-200 text-amber-800",  bg: "bg-amber-50",  border: "border-amber-200" },
  "代理店化":    { header: "bg-emerald-100 text-emerald-800", badge: "bg-emerald-200 text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200" },
  "失注":        { header: "bg-gray-100 text-gray-600",   badge: "bg-gray-200 text-gray-600",   bg: "bg-gray-50",  border: "border-gray-200" },
};

type ColumnData = { status: string; companies: PipelineCard[] };

export default function Pipeline() {
  const navigate = useNavigate();
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [dragging, setDragging] = useState<{ id: number; fromStatus: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.companies.getPipeline(selectedProject);
      setColumns(data.columns);
      setTotal(data.total);
    } catch {
      setError("パイプラインデータの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    api.projects.list().then(d => setProjects(d.projects || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStatusMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moveCard = useCallback(async (cardId: number, fromStatus: string, toStatus: string) => {
    if (fromStatus === toStatus) return;
    setUpdatingId(cardId);
    setColumns(prev =>
      prev.map(col => {
        if (col.status === fromStatus) {
          return { ...col, companies: col.companies.filter(c => c.id !== cardId) };
        }
        if (col.status === toStatus) {
          const fromCol = prev.find(c => c.status === fromStatus);
          const card = fromCol?.companies.find(c => c.id === cardId);
          if (!card) return col;
          return { ...col, companies: [{ ...card, status: toStatus }, ...col.companies] };
        }
        return col;
      })
    );
    try {
      await api.companies.patchStatus(cardId, toStatus);
    } catch {
      loadPipeline();
    } finally {
      setUpdatingId(null);
    }
  }, [loadPipeline]);

  const handleDragStart = (e: React.DragEvent, id: number, fromStatus: string) => {
    setDragging({ id, fromStatus });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, toStatus: string) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragging) return;
    moveCard(dragging.id, dragging.fromStatus, toStatus);
    setDragging(null);
  };

  const counts: Record<string, number> = {};
  columns.forEach(col => { counts[col.status] = col.companies.length; });

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <GanttChartSquare size={22} className="text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">営業パイプライン</h1>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              {total.toLocaleString()} 社
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-gray-400" />
              <select
                value={selectedProject ?? ""}
                onChange={e => setSelectedProject(e.target.value ? Number(e.target.value) : undefined)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="">全プロジェクト</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadPipeline}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              更新
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {STATUSES.map(s => {
            const style = COLUMN_STYLES[s] || COLUMN_STYLES["未確認"];
            return (
              <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.badge} whitespace-nowrap flex-shrink-0`}>
                {s}
                <span className="font-bold">{counts[s] ?? 0}</span>
              </span>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full px-4 py-3" style={{ minWidth: `${STATUSES.length * 220}px` }}>
          {STATUSES.map(status => {
            const col = columns.find(c => c.status === status);
            const cards = col?.companies || [];
            const style = COLUMN_STYLES[status] || COLUMN_STYLES["未確認"];
            const isOver = dragOver === status;

            return (
              <div
                key={status}
                className={`flex flex-col rounded-xl border-2 transition-all duration-150 flex-shrink-0 w-52 ${style.border} ${isOver ? "scale-[1.01] shadow-lg" : ""} ${style.bg}`}
                onDragOver={e => { e.preventDefault(); setDragOver(status); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, status)}
              >
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${style.header} font-semibold text-sm`}>
                  <span>{status}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${style.badge}`}>{cards.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2" style={{ minHeight: "120px", maxHeight: "calc(100vh - 200px)" }}>
                  {loading && cards.length === 0 && (
                    <div className="text-center py-4 text-xs text-gray-400">読み込み中...</div>
                  )}
                  {!loading && cards.length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-400">企業なし</div>
                  )}
                  {cards.map(card => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      statuses={STATUSES}
                      isUpdating={updatingId === card.id}
                      menuRef={statusMenuId === card.id ? menuRef : undefined}
                      isMenuOpen={statusMenuId === card.id}
                      onMenuToggle={() => setStatusMenuId(prev => prev === card.id ? null : card.id)}
                      onStatusChange={(toStatus) => {
                        setStatusMenuId(null);
                        moveCard(card.id, status, toStatus);
                      }}
                      onNavigate={() => navigate(`/companies/${card.id}`)}
                      onDragStart={e => handleDragStart(e, card.id, status)}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface KanbanCardProps {
  card: PipelineCard;
  statuses: string[];
  isUpdating: boolean;
  menuRef?: React.RefObject<HTMLDivElement>;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onStatusChange: (status: string) => void;
  onNavigate: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function KanbanCard({
  card, statuses, isUpdating, menuRef, isMenuOpen,
  onMenuToggle, onStatusChange, onNavigate, onDragStart, onDragEnd,
}: KanbanCardProps) {
  const rankColor = SCORE_BADGE_COLORS[card.score_rank] || SCORE_BADGE_COLORS["D"];
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = card.follow_up_date && card.follow_up_date < today;
  const isToday = card.follow_up_date === today;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all select-none ${isUpdating ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p
          className="text-xs font-semibold text-gray-900 dark:text-white leading-snug flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2"
          onClick={onNavigate}
        >
          {card.company_name || "(名称不明)"}
        </p>
        <span className={`text-xs px-1.5 py-0.5 rounded border font-bold flex-shrink-0 ${rankColor}`}>
          {card.score_rank}
        </span>
      </div>

      {card.domain && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-xs text-gray-400 truncate">{card.domain}</span>
          <a
            href={`https://${card.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-gray-400 hover:text-indigo-500 flex-shrink-0"
          >
            <ExternalLink size={10} />
          </a>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">{card.score_total}点</span>
        {card.shopify_flag && (
          <span className="text-xs px-1 py-0.5 rounded bg-green-100 text-green-700 font-medium">Shopify</span>
        )}
        {card.ec_flag && !card.shopify_flag && (
          <span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">EC</span>
        )}
        {card.cms_type && !card.shopify_flag && (
          <span className="text-xs px-1 py-0.5 rounded bg-slate-100 text-slate-600">{card.cms_type}</span>
        )}
      </div>

      {card.follow_up_date && (
        <div className={`flex items-center gap-1 mb-2 text-xs rounded px-1.5 py-0.5 w-fit ${
          isOverdue ? "bg-red-100 text-red-700" :
          isToday ? "bg-amber-100 text-amber-700" :
          "bg-gray-100 text-gray-600"
        }`}>
          <CalendarClock size={10} />
          {isOverdue ? "期限超過: " : isToday ? "今日: " : ""}
          {card.follow_up_date}
        </div>
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={onMenuToggle}
          className="w-full flex items-center justify-between text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <span className="flex items-center gap-1">
            <Building2 size={10} />
            ステータス変更
          </span>
          <ChevronDown size={10} />
        </button>

        {isMenuOpen && (
          <div className="absolute bottom-full mb-1 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl min-w-40 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">ステータス変更</span>
              <button onClick={onMenuToggle} className="text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            </div>
            {statuses.map(s => {
              const style = COLUMN_STYLES[s] || COLUMN_STYLES["未確認"];
              return (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  disabled={s === card.status}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${s === card.status ? "opacity-50 cursor-not-allowed font-semibold" : ""}`}
                >
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${style.badge}`}>{s}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
