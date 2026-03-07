import { useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";
import { api } from "../../api";

type Announcement = { id: number; title: string; content: string; created_at: string | null };

const DISMISSED_KEY = "dismissed_announcements";

function getDismissed(): number[] {
  try { return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; }
}
function dismiss(id: number) {
  const cur = getDismissed();
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...cur, id]));
}

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    api.announcements.list().then(r => {
      const dismissed = getDismissed();
      setItems((r.announcements || []).filter((a: Announcement) => !dismissed.includes(a.id)));
    }).catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5 px-4 pt-3">
      {items.map(a => (
        <div key={a.id} className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Megaphone size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-blue-800 text-sm">{a.title}</span>
            <span className="text-blue-700 text-sm ml-2">{a.content}</span>
          </div>
          <button
            onClick={() => { dismiss(a.id); setItems(prev => prev.filter(x => x.id !== a.id)); }}
            className="text-blue-400 hover:text-blue-600 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
