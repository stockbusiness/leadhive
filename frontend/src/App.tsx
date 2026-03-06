import { Routes, Route, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Search,
  Globe,
  Settings,
  ShieldBan,
  History,
  FileText,
} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Keywords from "./pages/Keywords";
import Scraper from "./pages/Scraper";
import SettingsPage from "./pages/Settings";
import RejectedList from "./pages/RejectedList";
import CollectionHistory from "./pages/CollectionHistory";
import Templates from "./pages/Templates";

function App() {
  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold">ESCMS</h1>
          <p className="text-xs text-slate-400">代理店候補収集ツール</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <SidebarLink to="/" icon={<LayoutDashboard size={18} />} label="ダッシュボード" />
          <SidebarLink to="/companies" icon={<Building2 size={18} />} label="候補企業一覧" />
          <SidebarLink to="/keywords" icon={<Search size={18} />} label="検索条件管理" />
          <SidebarLink to="/scraper" icon={<Globe size={18} />} label="URL収集" />
          <SidebarLink to="/history" icon={<History size={18} />} label="収集履歴" />
          <SidebarLink to="/rejected" icon={<ShieldBan size={18} />} label="拒否リスト" />
          <SidebarLink to="/templates" icon={<FileText size={18} />} label="メモテンプレート" />
        </nav>
        <div className="p-2 border-t border-slate-700">
          <SidebarLink to="/settings" icon={<Settings size={18} />} label="設定" />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/keywords" element={<Keywords />} />
          <Route path="/scraper" element={<Scraper />} />
          <Route path="/history" element={<CollectionHistory />} />
          <Route path="/rejected" element={<RejectedList />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

function SidebarLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default App;
