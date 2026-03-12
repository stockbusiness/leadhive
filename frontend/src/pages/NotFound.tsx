import { Link, useNavigate } from "react-router-dom";
import { Home, ArrowLeft, Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-8xl font-bold text-slate-700 select-none leading-none">404</div>
          <div className="mt-4 flex items-center justify-center gap-2 text-blue-400">
            <Search className="w-5 h-5" />
            <span className="text-sm font-medium tracking-wider uppercase">Page Not Found</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          ページが見つかりません
        </h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          お探しのページは存在しないか、移動・削除された可能性があります。<br />
          URLをご確認のうえ、再度お試しください。
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            前のページに戻る
          </button>
          <Link
            to={user ? "/" : "/company"}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            {user ? "ダッシュボードへ" : "トップページへ"}
          </Link>
        </div>

        <div className="mt-12 text-xs text-slate-600">
          <span>LeadHive</span>
          <span className="mx-2">·</span>
          <a href="mailto:support@leadhive.work" className="hover:text-slate-400 transition-colors">
            support@leadhive.work
          </a>
        </div>
      </div>
    </div>
  );
}
