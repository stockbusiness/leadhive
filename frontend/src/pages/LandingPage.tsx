import { Link } from "react-router-dom";
import {
  Building2, Search, Zap, BarChart3, Users,
  CheckCircle2, ArrowRight, Globe, Mail, ChevronRight,
  Kanban, FileSpreadsheet, UserCheck, Star,
  Sparkles, TrendingUp, Target, ListChecks,
} from "lucide-react";

const FEATURES = [
  {
    icon: <Search className="text-blue-500" size={24} />,
    title: "営業先を自動収集",
    description: "Google検索・Googleマップ・各種Webソースから、条件に合う営業先を全自動で収集。手作業ゼロでリストを構築できます。",
  },
  {
    icon: <Zap className="text-amber-500" size={24} />,
    title: "スマートスコアリング",
    description: "問い合わせフォームの有無・Web更新頻度・規模感など複数の評価軸で自動スコアリング。優先度の高い営業先を一目で識別。",
  },
  {
    icon: <Kanban className="text-violet-500" size={24} />,
    title: "カンバン進捗管理",
    description: "「未確認」から「成約」まで9段階のステータスをカンバンボードで視覚管理。ドラッグ&ドロップで進捗を即更新できます。",
  },
  {
    icon: <Mail className="text-emerald-500" size={24} />,
    title: "アプローチ支援",
    description: "メールテンプレートの変数自動展開、問い合わせフォーム入力補助コピー機能で、アプローチ作業を大幅に効率化します。",
  },
  {
    icon: <Users className="text-indigo-500" size={24} />,
    title: "チーム管理",
    description: "メンバー招待・ロール管理・担当者アサイン機能で、営業チームの分業と進捗共有をシームレスに実現します。",
  },
  {
    icon: <BarChart3 className="text-rose-500" size={24} />,
    title: "営業ダッシュボード",
    description: "収集件数トレンド・カテゴリ分布・ランク別集計など、営業活動の全体像をリアルタイムで把握できます。",
  },
  {
    icon: <FileSpreadsheet className="text-teal-500" size={24} />,
    title: "CSV一括インポート",
    description: "既存のリストをCSVで一括インポート。会社名・URL・ステータス・担当者などをそのまま取り込めます。",
  },
  {
    icon: <Globe className="text-orange-500" size={24} />,
    title: "マルチプロジェクト",
    description: "業種・地域・担当チームごとに独立したプロジェクトを作成。同一組織内で複数の収集プロジェクトを並行管理できます。",
  },
];

const STEPS = [
  {
    step: "01",
    title: "キーワードを登録",
    description: "ターゲット業種・エリア・条件などの検索キーワードを登録するだけ。",
  },
  {
    step: "02",
    title: "自動収集スタート",
    description: "Google検索・Googleマップなど複数ソースから営業先を自動スクレイピング・収集。",
  },
  {
    step: "03",
    title: "スコアで優先度を選別",
    description: "自動スコアリングで有望先を可視化。フィルタリングして絞り込んでリスト化。",
  },
  {
    step: "04",
    title: "アプローチ&進捗管理",
    description: "メール・フォーム送信をアプリ内でサポート。カンバンで進捗を管理し成約まで追跡。",
  },
];

const STATS = [
  { value: "90%+", label: "リスト作成の時間削減" },
  { value: "10x", label: "スクリーニング効率" },
  { value: "全自動", label: "営業先収集・スコアリング" },
  { value: "一元化", label: "リスト・進捗・チーム管理" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={18} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">LeadHive</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              ログイン
            </Link>
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-slate-50 to-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-blue-100">
            <Sparkles size={14} />
            BtoB営業先の発掘を、全自動で
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight mb-6">
            営業先リストを、
            <br />
            <span className="text-blue-600">自動でつくる。</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            LeadHiveは、ターゲット企業の収集からスコアリング・進捗管理・チーム共有まで一元化したBtoB営業支援SaaSです。手動リサーチに費やす時間をゼロにします。
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/register"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-blue-200"
            >
              無料で始める
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium px-6 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-base"
            >
              ログイン
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
        {/* Hero visual */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="bg-slate-900 rounded-2xl shadow-2xl p-4 border border-slate-800">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="bg-slate-800 rounded-xl p-5 grid grid-cols-4 gap-3">
              {[
                { label: "収集済み営業先", value: "3,214件", color: "text-blue-400", bg: "bg-blue-950" },
                { label: "Aランク優先先", value: "187件", color: "text-emerald-400", bg: "bg-emerald-950" },
                { label: "アプローチ済み", value: "94件", color: "text-violet-400", bg: "bg-violet-950" },
                { label: "成約・受注", value: "31件", color: "text-amber-400", bg: "bg-amber-950" },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-lg p-3`}>
                  <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
              <div className="col-span-4 bg-slate-750 border border-slate-700 rounded-xl p-3">
                <div className="flex gap-2 overflow-x-auto">
                  {["未確認 52", "対象候補 38", "アプローチ前 25", "送信済 20", "返信あり 14", "面談化 9", "成約 31"].map(s => (
                    <div key={s} className="flex-shrink-0 bg-slate-700 rounded-lg p-2 min-w-[100px]">
                      <p className="text-xs text-slate-400 mb-2 truncate">{s.split(" ")[0]}</p>
                      <p className="text-lg font-bold text-white">{s.split(" ")[1]}</p>
                      {[...Array(Math.min(3, parseInt(s.split(" ")[1])))].map((_, i) => (
                        <div key={i} className="h-6 bg-slate-600 rounded mt-1 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-4 inset-x-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-slate-100 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold text-blue-600 mb-1">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-semibold text-sm mb-2 uppercase tracking-wider">課題</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              こんな悩みはありませんか？
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "リスト作成に時間がかかりすぎる",
                body: "Google検索・マップで手動リサーチ、スプレッドシートに転記…を毎週繰り返す作業に疲弊していませんか？",
                emoji: "😩",
              },
              {
                title: "情報が散在して管理できない",
                body: "スプレッドシート・メモ・メールボックスに情報が分散し、どの企業をどのフェーズで進めているか把握できていますか？",
                emoji: "🗂️",
              },
              {
                title: "チームで進捗が共有できない",
                body: "誰がどの企業を担当しているか分からず、重複アプローチや抜け漏れが発生していませんか？",
                emoji: "🤝",
              },
            ].map(p => (
              <div key={p.title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="text-4xl mb-4">{p.emoji}</div>
                <h3 className="font-bold text-slate-800 mb-2 text-lg">{p.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg shadow-blue-100">
              <TrendingUp size={16} />
              LeadHiveがこれらすべてを解決します
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-600 font-semibold text-sm mb-2 uppercase tracking-wider">機能</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              営業リスト化の全工程を<br />一つのツールで
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              営業先の収集から成約まで、営業プロセスのすべてをLeadHiveでカバーします。
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="bg-slate-50 w-11 h-11 rounded-xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-600 font-semibold text-sm mb-2 uppercase tracking-wider">使い方</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              4ステップで営業リストを自動化
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200" />
            {STEPS.map((s) => (
              <div key={s.step} className="relative flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-extrabold mb-4 shadow-lg shadow-blue-200 relative z-10">
                  {s.step}
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-20 px-6 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              導入でこう変わります
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              LeadHiveを使うことで、営業先リストの作成から成約までの時間を大幅に短縮できます。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                before: "週8〜10時間の手動リサーチ",
                after: "キーワード設定のみで全自動収集",
                icon: <Target size={20} />,
                color: "from-blue-600 to-blue-700",
              },
              {
                before: "バラバラなスプレッドシート管理",
                after: "全情報をひとつのダッシュボードで集約",
                icon: <ListChecks size={20} />,
                color: "from-violet-600 to-violet-700",
              },
              {
                before: "進捗が個人依存で属人化",
                after: "チーム全体で進捗・担当者を共有",
                icon: <UserCheck size={20} />,
                color: "from-emerald-600 to-emerald-700",
              },
            ].map(b => (
              <div key={b.before} className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center mb-4`}>
                  {b.icon}
                </div>
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Before</p>
                  <p className="text-slate-400 text-sm line-through">{b.before}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">After</p>
                  <p className="text-white font-semibold">{b.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kanban highlight */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 px-3 py-1 rounded-full text-xs font-semibold mb-5 border border-violet-100">
                <Kanban size={12} />
                カンバンビュー
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-4 leading-tight">
                営業進捗を<br />ひと目で把握できる
              </h2>
              <p className="text-slate-500 mb-6 leading-relaxed">
                9段階のステータスを列として並べたカンバンボードで、全営業先の進捗を可視化。カードをドラッグ&ドロップするだけでステータスが更新されます。
              </p>
              <ul className="space-y-2">
                {[
                  "ドラッグ&ドロップでステータス変更",
                  "担当者・フォローアップ期限をカードに表示",
                  "スコアランクをバッジで視覚確認",
                  "フィルタリングで担当者別・ランク別に絞り込み",
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                  { status: "未確認", count: 52, color: "bg-slate-200" },
                  { status: "対象候補", count: 38, color: "bg-blue-200" },
                  { status: "送信済", count: 20, color: "bg-indigo-200" },
                  { status: "返信あり", count: 14, color: "bg-violet-200" },
                ].map(col => (
                  <div key={col.status} className="flex-shrink-0 w-36">
                    <div className={`${col.color} rounded-xl p-3`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-700 truncate">{col.status}</p>
                        <span className="text-xs text-slate-500 bg-white w-5 h-5 rounded-full flex items-center justify-center">{col.count}</span>
                      </div>
                      {[...Array(Math.min(3, Math.floor(col.count / 12) + 1))].map((_, i) => (
                        <div key={i} className="bg-white rounded-lg p-2 mb-1.5 shadow-sm">
                          <div className="h-2 bg-slate-200 rounded w-3/4 mb-1" />
                          <div className="h-1.5 bg-slate-100 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} size={18} className="text-yellow-300 fill-yellow-300" />)}
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
            今すぐ営業リストの<br />自動化を始めよう
          </h2>
          <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto">
            登録無料。セットアップは数分で完了します。まずは無料でLeadHiveをお試しください。
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/register"
              className="flex items-center gap-2 bg-white text-blue-700 font-bold px-10 py-4 rounded-2xl text-lg hover:bg-blue-50 transition-colors shadow-xl"
            >
              無料で始める
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 text-white/90 hover:text-white font-medium px-6 py-4 rounded-2xl border border-white/30 hover:border-white/60 transition-colors text-base"
            >
              ログインはこちら
            </Link>
          </div>
          <p className="text-blue-200 text-sm mt-6">クレジットカード不要・すぐに使えます</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-white text-base">LeadHive</span>
            <span className="text-slate-600 text-sm ml-1">営業先リスト自動化ツール</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/login" className="hover:text-white transition-colors">ログイン</Link>
            <Link to="/register" className="hover:text-white transition-colors">新規登録</Link>
          </div>
          <p className="text-slate-600 text-sm">© 2025 LeadHive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
