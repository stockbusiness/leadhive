import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import type { Company } from "../../types";
import { STATUSES } from "../../constants";
import ScoreBadge from "../common/ScoreBadge";

interface Props {
  companies: Company[];
  onStatusChange: (companyId: number, newStatus: string) => Promise<void>;
}

function CompanyCard({ company, isDragging }: { company: Company; isDragging?: boolean }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: company.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasFollowUp = company.follow_up_date && new Date(company.follow_up_date) <= new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={e => { e.stopPropagation(); navigate(`/companies/${company.id}`); }}
          className="text-sm font-medium text-slate-800 hover:text-blue-600 text-left leading-tight line-clamp-2"
        >
          {company.company_name || company.domain || "（名称未設定）"}
        </button>
        <div className="flex-shrink-0">
          <ScoreBadge score={company.score_total} rank={company.score_rank} />
        </div>
      </div>
      {company.category_main && (
        <p className="text-xs text-slate-500 mb-1 truncate">{company.category_main}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {company.ec_flag && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">🛒 ECサイト</span>}
        {company.cms_type ? (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            company.cms_type === "Shopify" ? "bg-green-100 text-green-700" :
            company.cms_type === "BASE" ? "bg-orange-100 text-orange-700" :
            company.cms_type === "MakeShop" ? "bg-blue-100 text-blue-700" :
            company.cms_type === "futureshop" ? "bg-sky-100 text-sky-700" :
            company.cms_type === "STORES" ? "bg-pink-100 text-pink-700" :
            company.cms_type === "EC-CUBE" ? "bg-amber-100 text-amber-700" :
            company.cms_type === "Wix" ? "bg-sky-100 text-sky-700" :
            company.cms_type === "WordPress" ? "bg-blue-100 text-blue-700" :
            "bg-slate-100 text-slate-600"
          }`}>
            {["Shopify", "BASE", "EC-CUBE", "MakeShop", "futureshop", "STORES"].includes(company.cms_type) ? `🛒 ${company.cms_type}` : company.cms_type}
          </span>
        ) : (
          <>
            {company.shopify_flag && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">🛒 Shopify</span>}
            {company.base_flag && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">🛒 BASE</span>}
            {company.makeshop_flag && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">🛒 MakeShop</span>}
            {company.futureshop_flag && <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">🛒 futureshop</span>}
            {company.stores_flag && <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">🛒 STORES</span>}
          </>
        )}
        {company.assignee && (
          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded truncate max-w-[80px]">
            {company.assignee.display_name || company.assignee.email}
          </span>
        )}
        {hasFollowUp && (
          <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
            期限
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  companies,
  activeId,
}: {
  status: string;
  companies: Company[];
  activeId: number | null;
}) {
  const colColors: Record<string, string> = {
    "未確認": "bg-slate-100",
    "確認済み": "bg-blue-50",
    "コンタクト済み": "bg-indigo-50",
    "返信あり": "bg-violet-50",
    "商談中": "bg-yellow-50",
    "提案済み": "bg-orange-50",
    "契約交渉中": "bg-amber-50",
    "代理店化": "bg-emerald-50",
    "不採用": "bg-red-50",
  };

  return (
    <div className="flex-shrink-0 w-56">
      <div className={`rounded-lg ${colColors[status] || "bg-slate-50"} p-2`}>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-semibold text-slate-700 truncate">{status}</h3>
          <span className="text-xs text-slate-500 bg-white rounded-full w-5 h-5 flex items-center justify-center font-medium flex-shrink-0">
            {companies.length}
          </span>
        </div>
        <SortableContext items={companies.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[80px]">
            {companies.map(c => (
              <CompanyCard key={c.id} company={c} isDragging={activeId === c.id} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function CompanyKanban({ companies, onStatusChange }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const grouped: Record<string, Company[]> = {};
  STATUSES.forEach(s => { grouped[s] = []; });
  companies.forEach(c => {
    if (grouped[c.status]) grouped[c.status].push(c);
    else grouped["未確認"].push(c);
  });

  const activeCompany = activeId ? companies.find(c => c.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeCompany = companies.find(c => c.id === active.id);
    if (!activeCompany) return;

    const overStatus = STATUSES.find(s => s === over.id);
    const overCompany = companies.find(c => c.id === over.id);
    const targetStatus = overStatus || overCompany?.status;

    if (targetStatus && targetStatus !== activeCompany.status) {
      await onStatusChange(activeCompany.id, targetStatus);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) return;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "400px" }}>
        {STATUSES.map(status => (
          <SortableContext key={status} id={status} items={grouped[status].map(c => c.id)} strategy={verticalListSortingStrategy}>
            <KanbanColumn status={status} companies={grouped[status]} activeId={activeId} />
          </SortableContext>
        ))}
      </div>
      <DragOverlay>
        {activeCompany && (
          <div className="bg-white border border-blue-400 rounded-lg p-3 shadow-xl w-56">
            <p className="text-sm font-medium text-slate-800 line-clamp-2">
              {activeCompany.company_name || activeCompany.domain}
            </p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
