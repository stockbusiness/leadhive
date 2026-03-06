import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
      <p className="text-sm text-slate-500">
        全{total}件中 {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}件
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm text-slate-600">{page} / {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
