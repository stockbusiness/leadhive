import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, CalendarClock, ChevronRight, CheckCircle2 } from "lucide-react";
import { api } from "../../api";

type FollowUpItem = {
  id: number;
  company_name: string;
  follow_up_date: string;
  status: string;
  score_rank: string;
  score_total: number;
};

type NotifData = {
  today: FollowUpItem[];
  overdue: FollowUpItem[];
  today_count: number;
  overdue_count: number;
  total: number;
};

const RANK_BADGE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-amber-100 text-amber-800 border-amber-200",
  D: "bg-slate-100 text-slate-600 border-slate-200",
};

const REFRESH_MS = 5 * 60 * 1000;

export default function NotificationPanel({ buttonClassName }: { buttonClassName?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifData | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.notifications.followUps();
      setData(d);
    } catch {
      // silent fail — auth may not be ready yet
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const total = data?.total ?? 0;

  const handleItemClick = (id: number) => {
    setOpen(false);
    navigate(`/companies/${id}`);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) load(); }}
        className={buttonClassName ?? "relative p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"}
        aria-label="フォローアップ通知"
      >
        <BellRing size={18} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <BellRing size={14} className="text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-white">フォローアップ通知</span>
            {total > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{total}件</span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {total === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 size={28} className="text-emerald-400 mb-2" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">期限のフォローアップはありません</p>
                <p className="text-xs text-gray-400 mt-1">すべて対応済みです</p>
              </div>
            ) : (
              <>
                {(data?.today?.length ?? 0) > 0 && (
                  <div>
                    <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <CalendarClock size={11} />
                        今日のフォローアップ（{data!.today_count}件）
                      </p>
                    </div>
                    {data!.today.slice(0, 5).map(item => (
                      <ItemRow key={item.id} item={item} onClick={handleItemClick} />
                    ))}
                    {data!.today.length > 5 && (
                      <p className="text-xs text-center text-gray-400 py-1.5">他 {data!.today.length - 5} 件</p>
                    )}
                  </div>
                )}

                {(data?.overdue?.length ?? 0) > 0 && (
                  <div>
                    <div className="px-4 py-1.5 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                        <CalendarClock size={11} />
                        期限超過（{data!.overdue_count}件）
                      </p>
                    </div>
                    {data!.overdue.slice(0, 5).map(item => (
                      <ItemRow key={item.id} item={item} overdue onClick={handleItemClick} />
                    ))}
                    {data!.overdue.length > 5 && (
                      <p className="text-xs text-center text-gray-400 py-1.5">他 {data!.overdue.length - 5} 件</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <button
              onClick={() => { setOpen(false); navigate("/pipeline"); }}
              className="w-full text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium flex items-center justify-center gap-1"
            >
              パイプラインで確認 <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, overdue, onClick }: { item: FollowUpItem; overdue?: boolean; onClick: (id: number) => void }) {
  const rankClass = RANK_BADGE[item.score_rank] || RANK_BADGE["D"];
  return (
    <button
      onClick={() => onClick(item.id)}
      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-750 text-left"
    >
      <span className={`text-xs px-1.5 py-0.5 rounded border font-bold flex-shrink-0 ${rankClass}`}>
        {item.score_rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{item.company_name}</p>
        <p className={`text-xs ${overdue ? "text-red-500" : "text-amber-600"}`}>{item.follow_up_date}</p>
      </div>
      <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
    </button>
  );
}
