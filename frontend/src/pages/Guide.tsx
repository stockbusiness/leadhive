import { useState } from "react";
import { Link } from "react-router-dom";
import PageMeta from "../components/PageMeta";
import {
  LayoutDashboard, FolderKanban, Search, Globe, Building2,
  GanttChartSquare, FileText, Mail, Settings, Bell,
  ChevronRight, ArrowRight, Lightbulb, CheckCircle2,
  BookOpen, Star, Users, ListChecks, Zap,
} from "lucide-react";

const SECTIONS = [
  { id: "flow",      title: "全体の流れ" },
  { id: "project",   title: "プロジェクト管理" },
  { id: "keyword",   title: "キーワード登録" },
  { id: "collection",title: "企業の自動収集" },
  { id: "companies", title: "企業リストの整理" },
  { id: "pipeline",  title: "営業パイプライン" },
  { id: "activity",  title: "活動記録" },
  { id: "email",     title: "メール送信" },
  { id: "dashboard", title: "ダッシュボード" },
  { id: "settings",  title: "初期設定" },
  { id: "auto",      title: "自動収集設定" },
];

export default function Guide() {
  const [activeTab, setActiveTab] = useState("flow");

  const scrollTo = (id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageMeta
        title="機能ガイド - LeadHiveの使い方"
        description="LeadHiveの機能ガイド。企業収集・スコアリング・パイプライン・AI分析・メール送信など、各機能の操作方法をステップ形式で解説します。"
        path="/guide"
        schemaType="Article"
        breadcrumbs={[{ name: "機能ガイド", url: "/guide" }]}
        articlePublished="2025-01-01"
        articleModified="2026-04-01"
      />

      {/* Header */}
      <div className="bg-slate-900 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
            <Link to="/" className="hover:text-blue-400">ホーム</Link>
            <ChevronRight size={12} />
            <span>機能ガイド</span>
          </div>
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <Zap size={24} />
          </div>
          <h1 className="text-3xl font-bold mb-2">LeadHive 機能ガイド</h1>
          <p className="text-slate-400 text-base">
            はじめて LeadHive を使う方に向けて、各機能の用途と使い方をわかりやすく説明します。
          </p>
        </div>
      </div>

      {/* Mobile TOC */}
      <div className="bg-white border-b border-slate-200 overflow-x-auto lg:hidden">
        <div className="flex gap-1 px-4 py-3 min-w-max">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                activeTab === s.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-10 flex gap-10">

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-48 flex-shrink-0">
          <div className="sticky top-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">目次</p>
            <nav className="space-y-0.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                    activeTab === s.id
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </nav>
            <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
              <Link to="/manual" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 py-1">
                <BookOpen size={12} />詳細マニュアル
              </Link>
              <Link to="/faq" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 py-1">
                <Lightbulb size={12} />よくある質問
              </Link>
              <Link to="/support" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 py-1">
                <Users size={12} />サポートに連絡
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-16">

          {/* ===== 全体の流れ ===== */}
          <section id="flow" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks size={20} className="text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">全体の流れ</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              LeadHive は「企業リストをつくる → 評価する → 営業する」という流れで使います。
              まずはこの大きな流れを頭に入れてから、各機能を使い始めましょう。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {[
                { step: "STEP 1", label: "企業を集める", desc: "キーワードを登録して、関連する企業を自動でリストアップします", color: "border-blue-200 bg-blue-50" },
                { step: "STEP 2", label: "企業を評価する", desc: "集めた企業をチェックし、対象企業・不要な企業に仕分けします", color: "border-violet-200 bg-violet-50" },
                { step: "STEP 3", label: "アプローチする", desc: "メールやフォーム送信で企業にコンタクトを取ります", color: "border-emerald-200 bg-emerald-50" },
                { step: "STEP 4", label: "進捗を管理する", desc: "返信・面談・成約まで、営業の進み具合をパイプラインで追います", color: "border-amber-200 bg-amber-50" },
              ].map((item) => (
                <div key={item.step} className={`p-4 rounded-xl border ${item.color}`}>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{item.step}</span>
                  <p className="font-semibold text-slate-800 text-sm mt-1">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-400 mb-3">はじめて使う方はこの順番で進めましょう</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {["① 設定", "② プロジェクト作成", "③ キーワード登録", "④ URL収集", "⑤ 企業確認", "⑥ 営業開始！"].map((item, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-lg font-medium">{item}</span>
                    {i < 5 && <ArrowRight size={12} className="text-slate-500" />}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ===== プロジェクト管理 ===== */}
          <section id="project" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban size={20} className="text-violet-600" />
              <h2 className="text-xl font-bold text-slate-900">プロジェクト管理</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">複数の営業テーマや担当エリアを分けて管理したいとき。「東京エリア」「Shopify導入企業向け」のように分けられます。</p>
            </div>
            <ol className="space-y-3 mb-4">
              {[
                "左メニューの「プロジェクト管理」をクリックします。",
                "右上の「新しいプロジェクトを作成」ボタンをクリックします。",
                "プロジェクト名（例：「Shopify系 東京」）を入力して保存します。",
                "ページ上部のプロジェクト選択メニューから、使いたいプロジェクトを選びます。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
              <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">プロジェクトは後からいくつでも追加できます。まずは「メインプロジェクト」など、わかりやすい名前で1つ作るところから始めましょう。</p>
            </div>
            <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              プロジェクト管理を開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* ===== キーワード登録 ===== */}
          <section id="keyword" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Search size={20} className="text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">キーワード登録（検索条件の設定）</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">どんな企業を集めたいかを設定するページです。「美容サロン 東京」などのキーワードをもとに、Google 検索から企業を自動で探してきます。</p>
            </div>
            <ol className="space-y-3 mb-5">
              {[
                "左メニューの「検索条件管理」をクリックします。",
                "「キーワード」欄に探したい業種を入力します。例：「美容室 大阪」「Shopify 制作会社」",
                "必要に応じてカテゴリや除外キーワードを入力して「追加」ボタンを押します。",
                "「デフォルトキーワード追加」ボタンを使うと、よく使われるキーワードをまとめて登録できます。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
              <p className="text-xs font-bold text-slate-600 mb-2">キーワードの組み合わせ例</p>
              <div className="space-y-1.5 text-xs text-slate-600">
                {[
                  "「美容サロン」+「東京」→ 東京の美容院を収集",
                  "「Shopify 制作」→ Shopify構築会社を収集",
                  "「税理士事務所 大阪」→ 大阪の税理士を収集",
                ].map((ex) => (
                  <div key={ex} className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                    <span>{ex}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
              <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">キーワードは複数登録するほど多くの企業が集まります。最初は5〜10個ほど登録してみましょう。</p>
            </div>
            <Link to="/keywords" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              キーワード管理を開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* ===== 企業の自動収集 ===== */}
          <section id="collection" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={20} className="text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900">企業の自動収集（URL収集）</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">登録したキーワードをもとに、Google 検索から企業の情報を自動で集めます。手作業でリストを作る必要がありません。</p>
            </div>
            <ol className="space-y-3 mb-5">
              {[
                "左メニューの「URL収集」をクリックします。",
                "使いたいプロジェクトが選ばれているか確認します。",
                "「収集を開始」ボタンをクリックします。登録したキーワードを順番に検索し、企業のURLを自動で取得します。",
                "収集が終わったら「候補企業一覧」に結果が表示されます。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
              <p className="text-xs font-bold text-amber-700 mb-1">⚠️ 事前準備が必要です</p>
              <p className="text-xs text-amber-800">URL収集を使うには Google Custom Search API キーが必要です。「設定」ページで入力してください。</p>
            </div>
            <Link to="/scraper" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              URL収集を開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* ===== 企業リストの整理 ===== */}
          <section id="companies" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={20} className="text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-900">企業リストの整理（候補企業一覧）</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">集めた企業の一覧を確認し、「この企業にアプローチしよう」「これは対象外」などの仕分けができます。</p>
            </div>
            <ol className="space-y-3 mb-5">
              {[
                "左メニューの「候補企業一覧」をクリックします。",
                "企業名をクリックすると詳細ページが開き、会社情報・メモ・活動記録を確認できます。",
                "各企業の「ステータス」を変更して進捗を管理します。（未確認 → 対象候補 → アプローチ前 → フォーム送信済 → 返信あり → 面談化 → 代理店化）",
                "「フラグ」アイコンで優先度を設定したり、不要な企業は「除外」に変更して整理します。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
              <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">まずは「未確認」の企業を「対象候補」または「除外」に仕分けましょう。スコアの高い企業から優先して確認すると効率的です。</p>
            </div>
            <Link to="/companies" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              候補企業一覧を開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* ===== 営業パイプライン ===== */}
          <section id="pipeline" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <GanttChartSquare size={20} className="text-amber-600" />
              <h2 className="text-xl font-bold text-slate-900">営業パイプライン</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">営業の進捗を一目で確認できる画面です。「アプローチ前」「返信あり」「面談化」など、どの段階に何社いるかを視覚的に把握できます。</p>
            </div>
            <ol className="space-y-3 mb-5">
              {[
                "左メニューの「パイプライン」をクリックします。",
                "ステータスごとに縦列に企業が並んで表示されます。",
                "企業カードをドラッグして別の列に移動すると、ステータスが自動で更新されます。",
                "企業カードをクリックすると詳細を確認・編集できます。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
              <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">パイプラインには「対象候補」以降のステータスの企業が表示されます。企業一覧でステータスを「対象候補」に変えると、パイプラインに表示されるようになります。</p>
            </div>
            <Link to="/pipeline" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              パイプラインを開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* ===== 活動記録 ===== */}
          <section id="activity" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={20} className="text-teal-600" />
              <h2 className="text-xl font-bold text-slate-900">活動記録（企業ページから入力）</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">「〇〇社に電話した」「メールを送った」など、企業ごとの営業活動を日時とともに記録できます。チームで使う場合も誰がいつ何をしたか把握できます。</p>
            </div>
            <ol className="space-y-3 mb-5">
              {[
                "企業一覧から記録したい企業をクリックし、詳細ページを開きます。",
                "「活動を追加」ボタンをクリックします。",
                "活動の種類（電話・メール・訪問など）と内容を入力して保存します。",
                "「次回フォローアップ日」を設定しておくと、ダッシュボードでリマインダーが表示されます。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">活動記録を残しておくと、担当者が変わっても過去の対応状況がすぐわかります。短いメモでも残しておくことをお勧めします。</p>
            </div>
          </section>

          {/* ===== メール送信 ===== */}
          <section id="email" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={20} className="text-rose-600" />
              <h2 className="text-xl font-bold text-slate-900">メール送信（テンプレート＋一括送信）</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">選んだ企業に対して、メールをまとめて送ることができます。{"{{会社名}}"} などの変数を使えば、企業ごとに内容が自動で差し込まれます。</p>
            </div>

            <p className="text-sm font-semibold text-slate-700 mb-3">【手順1】テンプレートを作る</p>
            <ol className="space-y-3 mb-5">
              {[
                "左メニューの「メモテンプレート」をクリックします。",
                "「メール」タブを選び、件名と本文を入力します。",
                "本文に {{会社名}} と書くと、送信時に各企業の会社名が自動で入ります。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
              <p className="text-xs font-bold text-slate-600 mb-2">使える変数一覧</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600">
                {[
                  ["{{会社名}}", "企業の会社名"],
                  ["{{URL}}", "企業のウェブサイト"],
                  ["{{担当者名}}", "担当者名"],
                  ["{{都道府県}}", "都道府県"],
                  ["{{市区町村}}", "市区町村"],
                  ["{{電話番号}}", "電話番号"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-blue-700 text-xs">{key}</code>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-700 mb-3">【手順2】企業を選んで一括送信する</p>
            <ol className="space-y-3 mb-4">
              {[
                "「候補企業一覧」でメールを送りたい企業のチェックボックスにチェックを入れます。",
                "画面上部に表示される「一括メール送信」ボタンをクリックします。",
                "送信モーダルが開くので、件名・本文を入力（またはテンプレートから呼び出す）します。",
                "プレビューで内容を確認し、「送信開始」をクリックします。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
              <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">メール送信には「設定」ページで SMTP または SendGrid の設定が必要です。送信履歴は「一括メール送信」ページで確認できます。</p>
            </div>
            <div className="flex gap-2">
              <Link to="/templates" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                テンプレートを開く <ArrowRight size={13} />
              </Link>
              <Link to="/companies" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                企業一覧を開く <ArrowRight size={13} />
              </Link>
            </div>
          </section>

          {/* ===== ダッシュボード ===== */}
          <section id="dashboard" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard size={20} className="text-cyan-600" />
              <h2 className="text-xl font-bold text-slate-900">ダッシュボードの見方</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">今の営業活動の全体像を一目で確認できる画面です。何社集めたか、どのステータスに何社いるか、今日フォローアップが必要な企業はどこかがわかります。</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                { label: "上段の数字カード", desc: "総企業数・対象候補数・アプローチ数・面談数など、現在の状況をまとめた数字です" },
                { label: "今日のアクション", desc: "フォローアップ期限が今日・返信があった企業など、今すぐ対応が必要な案件が表示されます" },
                { label: "ステータス別グラフ", desc: "企業がどのステータスに何社いるか、棒グラフや円グラフで確認できます" },
                { label: "スコア分布", desc: "LeadHive が各企業に付けたスコアの分布を確認できます。高スコアの企業を優先しましょう" },
              ].map((item) => (
                <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-slate-700 mb-1">{item.label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              ダッシュボードを開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* ===== 初期設定 ===== */}
          <section id="settings" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={20} className="text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">初期設定（最初に行うこと）</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">LeadHive の主な機能を使う前に、いくつかの設定が必要です。最初にこの設定を済ませておきましょう。</p>
            </div>
            <div className="space-y-4 mb-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">必須</span>
                  <p className="text-sm font-bold text-slate-800">Google Custom Search API キーの設定</p>
                </div>
                <p className="text-xs text-slate-500 mb-3">URL収集（企業の自動収集）を使うために必要です。Google Cloud Console で無料で取得できます。</p>
                <ol className="space-y-2">
                  {[
                    <span>Google Cloud Console にアクセスしてログインします。</span>,
                    <span>「APIとサービス」→「認証情報」→「APIキーを作成」でキーを取得します。</span>,
                    <span>LeadHive の「設定」ページの「Google API Key」欄に貼り付けて保存します。</span>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="text-xs text-slate-700 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">任意</span>
                  <p className="text-sm font-bold text-slate-800">メール送信設定（SMTP または SendGrid）</p>
                </div>
                <p className="text-xs text-slate-500">一括メール送信機能を使う場合に必要です。Gmail や会社のメールサーバー（SMTP）、または SendGrid のどちらかを設定します。</p>
              </div>
            </div>
            <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              設定を開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* ===== 自動収集設定 ===== */}
          <section id="auto" className="scroll-mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={20} className="text-purple-600" />
              <h2 className="text-xl font-bold text-slate-900">自動収集設定（毎日自動でリストを更新）</h2>
            </div>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Lightbulb size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">毎日決まった時間に自動でURL収集を実行したいときに使います。手動で「収集開始」を押す必要がなくなります。</p>
            </div>
            <ol className="space-y-3 mb-5">
              {[
                "左メニューの「設定」をクリックします。",
                "「自動収集スケジュール」セクションを見つけます。",
                "「自動収集を有効にする」をオンにして、実行したい時刻（例：毎朝6時）を設定します。",
                "保存すると、毎日その時刻に自動で登録済みのキーワードを収集します。",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
              <Star size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">自動収集の結果は「収集履歴」ページで確認できます。</p>
            </div>
            <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              設定を開く <ArrowRight size={13} />
            </Link>
          </section>

          {/* Footer */}
          <div className="border-t border-slate-200 pt-8">
            <p className="text-sm text-slate-500 mb-4">このガイドで解決しない場合は、以下からご確認ください。</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/manual" className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <BookOpen size={15} />詳細マニュアル
              </Link>
              <Link to="/faq" className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <Lightbulb size={15} />よくある質問（FAQ）
              </Link>
              <Link to="/support" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Users size={15} />サポートに問い合わせる
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
