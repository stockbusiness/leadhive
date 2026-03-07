import { lazy, Suspense, useState } from "react";
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
  Users,
  X,
  Save,
  Loader2,
} from "lucide-react";
import { ProjectProvider, useProject } from "./contexts/ProjectContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { api } from "./api";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
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
const UserManagement = lazy(() => import("./pages/UserManagement"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: any = { display_name: displayName };
      if (newPassword) {
        if (!currentPassword) { setError("現在のパスワードを入力してください"); setSaving(false); return; }
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      const res = await api.auth.updateProfile(payload);
      updateUser({ display_name: res.user.display_name, email: res.user.email });
      setSuccess("プロフィールを更新しました");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">プロフィール編集</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{success}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="山田 太郎"
            />
          </div>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600 mb-3">パスワード変更（任意）</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">現在のパスワード</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">新しいパスワード</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="6文字以上"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">キャンセル</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { projects, currentProject, setCurrentProjectId } = useProject();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold">LeadHive</h1>
          <p className="text-xs text-slate-400">営業先リスト自動化ツール</p>
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
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          <SidebarLink to="/" icon={<LayoutDashboard size={18} />} label="ダッシュボード" />
          <SidebarLink to="/companies" icon={<Building2 size={18} />} label="候補企業一覧" />
          <SidebarLink to="/keywords" icon={<Search size={18} />} label="検索条件管理" />
          <SidebarLink to="/scraper" icon={<Globe size={18} />} label="URL収集" />
          <SidebarLink to="/history" icon={<History size={18} />} label="収集履歴" />
          <SidebarLink to="/rejected" icon={<ShieldBan size={18} />} label="拒否リスト" />
          <SidebarLink to="/templates" icon={<FileText size={18} />} label="メモテンプレート" />
          <SidebarLink to="/master" icon={<Database size={18} />} label="マスターDB" />
          <SidebarLink to="/projects" icon={<FolderKanban size={18} />} label="プロジェクト管理" />
          {user?.role === "admin" && (
            <SidebarLink to="/users" icon={<Users size={18} />} label="メンバー管理" />
          )}
        </nav>
        <div className="p-2 border-t border-slate-700 space-y-1">
          <SidebarLink to="/manual" icon={<BookOpen size={18} />} label="マニュアル" />
          <SidebarLink to="/settings" icon={<Settings size={18} />} label="設定" />
        </div>
        {user && (
          <div className="px-3 py-3 border-t border-slate-700 bg-slate-950">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 mb-2 w-full hover:bg-slate-800 rounded-md px-1 py-1 transition-colors"
            >
              <div className="bg-blue-600 rounded-full p-1.5 flex-shrink-0">
                <User size={12} />
              </div>
              <div className="overflow-hidden text-left">
                <p className="text-xs text-white font-medium truncate">{user.display_name || user.org_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </button>
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
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/keywords" element={<Keywords />} />
            <Route path="/scraper" element={<Scraper />} />
            <Route path="/history" element={<CollectionHistory />} />
            <Route path="/rejected" element={<RejectedList />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/master" element={<MasterDB />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UserManagement />} />
          </Routes>
        </Suspense>
      </main>
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </div>
  );
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={<HomeRoute />} />
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
