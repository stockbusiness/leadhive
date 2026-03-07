import { lazy, Suspense } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Search,
  Globe,
  Settings,
  ShieldBan,
  History,
  FileText,
  FolderKanban,
  ChevronDown,
  Database,
  BookOpen,
  LogOut,
  User,
} from "lucide-react";
import { ProjectProvider, useProject } from "./contexts/ProjectContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Companies = lazy(() => import("./pages/Companies"));
const Keywords = lazy(() => import("./pages/Keywords"));
const Scraper = lazy(() => import("./pages/Scraper"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const RejectedList = lazy(() => import("./pages/RejectedList"));
const CollectionHistory = lazy(() => import("./pages/CollectionHistory"));
const Templates = lazy(() => import("./pages/Templates"));
const Projects = lazy(() => import("./pages/Projects"));
const MasterDB = lazy(() => import("./pages/MasterDB"));
const Manual = lazy(() => import("./pages/Manual"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

function AppContent() {
  const { projects, currentProject, setCurrentProjectId } = useProject();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold">ESCMS</h1>
          <p className="text-xs text-slate-400">代理店候補収集ツール</p>
        </div>
        <div className="px-3 py-2 border-b border-slate-700">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">プロジェクト</label>
          <div className="relative">
            <select
              value={currentProject?.id || ""}
              onChange={(e) => setCurrentProjectId(Number(e.target.value))}
              className="w-full bg-slate-800 text-sm text-white rounded px-2 py-1.5 pr-7 border border-slate-600 appearance-none focus:outline-none focus:border-blue-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <SidebarLink to="/" icon={<LayoutDashboard size={18} />} label="ダッシュボード" />
          <SidebarLink to="/companies" icon={<Building2 size={18} />} label="候補企業一覧" />
          <SidebarLink to="/keywords" icon={<Search size={18} />} label="検索条件管理" />
          <SidebarLink to="/scraper" icon={<Globe size={18} />} label="URL収集" />
          <SidebarLink to="/history" icon={<History size={18} />} label="収集履歴" />
          <SidebarLink to="/rejected" icon={<ShieldBan size={18} />} label="拒否リスト" />
          <SidebarLink to="/templates" icon={<FileText size={18} />} label="メモテンプレート" />
          <SidebarLink to="/master" icon={<Database size={18} />} label="マスターDB" />
          <SidebarLink to="/projects" icon={<FolderKanban size={18} />} label="プロジェクト管理" />
        </nav>
        <div className="p-2 border-t border-slate-700 space-y-1">
          <SidebarLink to="/manual" icon={<BookOpen size={18} />} label="マニュアル" />
          <SidebarLink to="/settings" icon={<Settings size={18} />} label="設定" />
        </div>
        {user && (
          <div className="px-3 py-3 border-t border-slate-700 bg-slate-950">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-600 rounded-full p-1.5 flex-shrink-0">
                <User size={12} />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-white font-medium truncate">{user.org_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              <LogOut size={12} />
              ログアウト
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/keywords" element={<Keywords />} />
            <Route path="/scraper" element={<Scraper />} />
            <Route path="/history" element={<CollectionHistory />} />
            <Route path="/rejected" element={<RejectedList />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/master" element={<MasterDB />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ProjectProvider>
                  <AppContent />
                </ProjectProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
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
