import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Search, Globe, Building2,
  GanttChartSquare, FileText, Mail, Settings, Bell,
  ChevronRight, ArrowRight, Lightbulb, CheckCircle2,
  BookOpen, Star, Users, Brain, Zap, ListChecks,
} from "lucide-react";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
}

const SECTIONS: GuideSection[] = [
  { id: "flow", title: "全体の流れ", icon: <ListChecks size={16} />, color: "text-slate-600" },
  { id: "project", title: "プロジェクト管理", icon: <FolderKanban size={16} />, color: "text-violet-600" },
  { id: "keyword", title: "キーワード登録", icon: <Search size={16} />, color: "text-blue-600" },
  { id: "collection", title: "企業の自動収集", icon: <Globe size={16} />, color: "text-emerald-600" },
  { id: "companies", title: "企業リストの整理", icon: <Building2 size={16} />, color: "text-indigo-600" },
  { id: "pipeline", title: "営業パイプライン", icon: <GanttChartSquare size={16} />, color: "text-amber-600" },
  { id: "activity", title: "活動記録", icon: <FileText size={16} />, color: "text-teal-600" },
  { id: "email", title: "メール送信", icon: <Mail size={16} />, color: "text-rose-600" },
  { id: "dashboard", title: "ダッシュボード", icon: <LayoutDashboard size={16} />, color: "text-cyan-600" },
  { id: "settings", title: "初期設定", icon: <Settings size={16} />, color: "text-slate-600" },
  { id: "auto", title: "自動収集設定", icon: <Bell size={16} />, color: "text-purple-600" },
];

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <div className="flex-1 text-sm text-slate-700 leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}

function UseCase({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
      <Lightbulb size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-800 leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mt-4">
      <Star size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 leading-relaxed">{children}</p>
    </div>
  );
}

function SectionTitle({ id, icon, title, color }: { id: string; icon: React.ReactNode; title: string; color: string }) {
  return (
    <h2 id={id} className={`flex items-center gap-2.5 text-xl font-bold text-slate-800 mb-3 scroll-mt-6 ${color}`}>
      <span className={`${color}`}>{icon}</span>
      <span className="text-slate-800">{title}</span>
    </h2>
  );
}

function ActionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors mt-3"
    >
      {children}
      <ArrowRight size={13} />
    </Link>
  );
}

export default function Guide() {
  const [activeSection, setActiveSection] = useState("flow");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = SECTIONS.map((s) => s.id);
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-slate-200 bg-white py-6">
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={16} className="text-blue-500" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">機能ガイド</span>
          </div>
          <p className="text-xs text-slate-400">初めてお使いの方へ</p>
        </div>
        <nav className="px-2 space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeSection === s.id
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <span className={activeSection === s.id ? "text-blue-600" : "text-slate-400"}>{s.icon}</span>
              {s.title}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-4 pt-4 border-t border-slate-100 space-y-1">
          <Link to="/manual" className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 py-1">
            <BookOpen size={12} />詳細マニュアル
          </Link>
          <Link to="/faq" className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 py-1">
            <Lightbulb size={12} />よくある質問
          </Link>
          <Link to="/support" className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 py-1">
            <Users size={12} />サポートに連絡
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 py-8 px-4 md:px-10 max-w-3xl">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <Link to="/" className="hover:text-blue-600">ホーム</Link>
            <ChevronRight size={12} />
            <span>機能ガイド</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">LeadHive 機能ガイド</h1>
          <p className="text-base text-slate-500 leading-relaxed">
            はじめて LeadHive を使う方に向けて、各機能の用途と具体的な使い方をわかりやすく説明します。
          </p>
        </div>

        {/* Mobile TOC */}
        <div className="lg:hidden mb-8 bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest">目次</p>
          <div className="grid grid-cols-2 gap-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 py-1 text-left"
              >
                <span className="text-slate-400">{s.icon}</span>
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* ===== 全体の流れ ===== */}
        <section id="flow" className="mb-14 scroll-mt-6">
          <SectionTitle id="flow" icon={<ListChecks size={20} />} title="全体の流れ" color="text-slate-600" />
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            LeadHive は「企業リストをつくる → 評価する → 営業する」という流れで使います。
            まずはこの大きな流れを頭に入れてから、各機能を使い始めましょう。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {[
              { step: "STEP 1", label: "企業を集める", desc: "キーワードを登録して、関連する企業を自動でリストアップします", color: "bg-blue-50 border-blue-200", icon: <Globe size={20} className="text-blue-500" /> },
              { step: "STEP 2", label: "企業を評価する", desc: "集めた企業をチェックし、対象企業・不要な企業に仕分けします", color: "bg-violet-50 border-violet-200", icon: <Star size={20} className="text-violet-500" /> },
              { step: "STEP 3", label: "アプローチする", desc: "メールやフォーム送信で企業にコンタクトを取ります", color: "bg-emerald-50 border-emerald-200", icon: <Mail size={20} className="text-emerald-500" /> },
              { step: "STEP 4", label: "進捗を管理する", desc: "返信・面談・成約まで、営業の進み具合をパイプラインで追います", color: "bg-amber-50 border-amber-200", icon: <GanttChartSquare size={20} className="text-amber-500" /> },
            ].map((item) => (
              <div key={item.step} className={`flex items-start gap-3 p-4 rounded-xl border ${item.color}`}>
                <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{item.step}</span>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800 rounded-2xl p-5 text-white">
            <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">はじめて使う方は、この順番で進めましょう</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[
                "① 設定（APIキー登録）",
                "② プロジェクト作成",
                "③ キーワード登録",
                "④ URL収集を実行",
                "⑤ 企業リストを確認",
                "⑥ 営業開始！",
              ].map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-lg font-medium">{item}</span>
                  {i < 5 && <ArrowRight size={12} className="text-slate-500" />}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ===== プロジェクト管理 ===== */}
        <section id="project" className="mb-14">
          <SectionTitle id="project" icon={<FolderKanban size={20} />} title="プロジェクト管理" color="text-violet-600" />
          <UseCase>複数の営業テーマや担当エリアを分けて管理したいとき。たとえば「東京エリア」「Shopify導入企業向け」「新規顧客開拓」のように分けられます。</UseCase>

          <div className="space-y-3 mb-4">
            <Step number={1}>
              左メニューの <strong>「プロジェクト管理」</strong> をクリックします。
            </Step>
            <Step number={2}>
              右上の <strong>「新しいプロジェクトを作成」</strong> ボタンをクリックします。
            </Step>
            <Step number={3}>
              プロジェクト名（例：「Shopify系 東京」）を入力して保存します。
            </Step>
            <Step number={4}>
              ページ上部のプロジェクト選択メニューから、使いたいプロジェクトを選びます。<br />
              <span className="text-xs text-slate-500 mt-1 block">企業一覧・キーワードなどのデータはプロジェクトごとに分かれます。</span>
            </Step>
          </div>

          <Tip>
            プロジェクトは後からいくつでも追加できます。まずは「メインプロジェクト」や「テスト」など、わかりやすい名前で1つ作るところから始めましょう。
          </Tip>
          <ActionLink to="/projects">プロジェクト管理を開く</ActionLink>
        </section>

        {/* ===== キーワード登録 ===== */}
        <section id="keyword" className="mb-14">
          <SectionTitle id="keyword" icon={<Search size={20} />} title="キーワード登録（検索条件の設定）" color="text-blue-600" />
          <UseCase>どんな企業を集めたいかを設定するページです。「美容サロン 東京」「税理士事務所」などのキーワードをもとに、Google 検索から企業を自動で探してきます。</UseCase>

          <div className="space-y-3 mb-4">
            <Step number={1}>
              左メニューの <strong>「検索条件管理」</strong> をクリックします。
            </Step>
            <Step number={2}>
              「キーワード」欄に探したい業種を入力します。<br />
              <span className="text-xs text-slate-500 mt-1 block">例：「美容室 大阪」「Shopify 制作会社」「税理士事務所 名古屋」</span>
            </Step>
            <Step number={3}>
              必要に応じてカテゴリや除外キーワードを入力して <strong>「追加」</strong> ボタンを押します。
            </Step>
            <Step number={4}>
              「デフォルトキーワード追加」ボタンを使うと、よく使われるキーワードをまとめて登録できます。
            </Step>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mt-4">
            <p className="text-xs font-bold text-slate-600 mb-2">キーワードの組み合わせ例</p>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>「<strong>美容サロン</strong>」+「<strong>東京</strong>」→ 東京の美容院を収集</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>「<strong>Shopify 制作</strong>」→ Shopify構築会社を収集</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>「<strong>税理士事務所 大阪</strong>」→ 大阪の税理士を収集</span>
              </div>
            </div>
          </div>

          <Tip>
            キーワードは複数登録するほど多くの企業が集まります。最初は5〜10個ほど登録してみましょう。「分析」タブでどのキーワードが多く企業を獲得しているか確認できます。
          </Tip>
          <ActionLink to="/keywords">キーワード管理を開く</ActionLink>
        </section>

        {/* ===== 企業の自動収集 ===== */}
        <section id="collection" className="mb-14">
          <SectionTitle id="collection" icon={<Globe size={20} />} title="企業の自動収集（URL収集）" color="text-emerald-600" />
          <UseCase>登録したキーワードをもとに、Google 検索から企業の情報（会社名・URL・メールアドレスなど）を自動で集めます。手作業でリストを作る必要がありません。</UseCase>

          <div className="space-y-3 mb-4">
            <Step number={1}>
              左メニューの <strong>「URL収集」</strong> をクリックします。
            </Step>
            <Step number={2}>
              使いたいプロジェクトが選ばれているか確認します。
            </Step>
            <Step number={3}>
              <strong>「収集を開始」</strong> ボタンをクリックします。<br />
              <span className="text-xs text-slate-500 mt-1 block">登録したキーワードを順番に検索し、見つかった企業のURLを自動で取得します。</span>
            </Step>
            <Step number={4}>
              収集が終わったら <strong>「候補企業一覧」</strong> に結果が表示されます。
            </Step>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
            <p className="text-xs font-bold text-amber-700 mb-2">⚠️ 事前準備が必要です</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              URL収集を使うには <strong>Google Custom Search API キー</strong> が必要です。
              「設定」ページで入力してください。取得方法はマニュアルの「初期セットアップ」に記載されています。
            </p>
          </div>

          <Tip>
            一度に収集できる件数はプランによって異なります。「収集履歴」で過去の実行ログを確認できます。
          </Tip>
          <ActionLink to="/scraper">URL収集を開く</ActionLink>
        </section>

        {/* ===== 企業リストの整理 ===== */}
        <section id="companies" className="mb-14">
          <SectionTitle id="companies" icon={<Building2 size={20} />} title="企業リストの整理（候補企業一覧）" color="text-indigo-600" />
          <UseCase>集めた企業の一覧を確認し、「この企業にアプローチしよう」「これは対象外」などの仕分けができます。メモを残したり、担当者を割り当てたりすることもできます。</UseCase>

          <div className="space-y-3 mb-4">
            <Step number={1}>
              左メニューの <strong>「候補企業一覧」</strong> をクリックします。
            </Step>
            <Step number={2}>
              企業名をクリックすると詳細ページが開き、会社情報・メモ・活動記録を確認できます。
            </Step>
            <Step number={3}>
              各企業の「ステータス」を変更して進捗を管理します。<br />
              <span className="text-xs text-slate-500 mt-1 block">未確認 → 対象候補 → アプローチ前 → フォーム送信済 → 返信あり → 面談化 → 代理店化</span>
            </Step>
            <Step number={4}>
              「フラグ」アイコンで優先度を設定したり、不要な企業は「除外」に変更して整理します。
            </Step>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-700 mb-2">リストビュー</p>
              <p className="text-xs text-slate-500 leading-relaxed">表形式で一覧表示。フィルターや検索で絞り込みができます。大量の企業を効率よく確認できます。</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-700 mb-2">カンバンビュー</p>
              <p className="text-xs text-slate-500 leading-relaxed">ステータスごとに縦列に並べて表示。ドラッグ操作でステータスを変更できます。</p>
            </div>
          </div>

          <Tip>
            まずは「未確認」の企業を「対象候補」または「除外」に仕分けましょう。スコアの高い企業から優先して確認すると効率的です。
          </Tip>
          <ActionLink to="/companies">候補企業一覧を開く</ActionLink>
        </section>

        {/* ===== 営業パイプライン ===== */}
        <section id="pipeline" className="mb-14">
          <SectionTitle id="pipeline" icon={<GanttChartSquare size={20} />} title="営業パイプライン" color="text-amber-600" />
          <UseCase>営業の進捗を一目で確認できる画面です。「アプローチ前」「返信あり」「面談化」など、どの段階に何社いるかを視覚的に把握できます。</UseCase>

          <div className="space-y-3 mb-4">
            <Step number={1}>
              左メニューの <strong>「パイプライン」</strong> をクリックします。
            </Step>
            <Step number={2}>
              ステータスごとに縦列に企業が並んで表示されます。
            </Step>
            <Step number={3}>
              企業カードをドラッグして別の列に移動すると、ステータスが自動で更新されます。
            </Step>
            <Step number={4}>
              企業カードをクリックすると詳細を確認・編集できます。
            </Step>
          </div>

          <Tip>
            パイプラインには「対象候補」以降のステータスの企業が表示されます。企業一覧でステータスを「対象候補」に変えると、パイプラインに表示されるようになります。
          </Tip>
          <ActionLink to="/pipeline">パイプラインを開く</ActionLink>
        </section>

        {/* ===== 活動記録 ===== */}
        <section id="activity" className="mb-14">
          <SectionTitle id="activity" icon={<FileText size={20} />} title="活動記録（企業ページから入力）" color="text-teal-600" />
          <UseCase>「〇〇社に電話した」「メールを送った」「資料を送付した」など、企業ごとの営業活動を日時とともに記録できます。チームで使う場合も誰がいつ何をしたか把握できます。</UseCase>

          <div className="space-y-3 mb-4">
            <Step number={1}>
              企業一覧から記録したい企業をクリックし、詳細ページを開きます。
            </Step>
            <Step number={2}>
              <strong>「活動を追加」</strong> ボタンをクリックします。
            </Step>
            <Step number={3}>
              活動の種類（電話・メール・訪問など）と内容を入力して保存します。
            </Step>
            <Step number={4}>
              「次回フォローアップ日」を設定しておくと、ダッシュボードでリマインダーが表示されます。
            </Step>
          </div>

          <Tip>
            活動記録を残しておくと、次に担当者が変わっても過去の対応状況がすぐわかります。短いメモでも残しておくことをお勧めします。
          </Tip>
        </section>

        {/* ===== メール送信 ===== */}
        <section id="email" className="mb-14">
          <SectionTitle id="email" icon={<Mail size={20} />} title="メール送信（テンプレート＋一括送信）" color="text-rose-600" />
          <UseCase>選んだ企業に対して、メールをまとめて送ることができます。「{{会社名}}」などの変数を使えば、企業ごとに内容を自動で差し込むことができます。</UseCase>

          <p className="text-sm font-semibold text-slate-700 mb-3 mt-5">【手順1】テンプレートを作る</p>
          <div className="space-y-3 mb-5">
            <Step number={1}>
              左メニューの <strong>「メモテンプレート」</strong> をクリックします。
            </Step>
            <Step number={2}>
              「メール」タブを選び、件名と本文を入力します。
            </Step>
            <Step number={3}>
              本文に <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{"{{会社名}}"}</code> と書くと、送信時に各企業の会社名が自動で入ります。
            </Step>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
            <p className="text-xs font-bold text-slate-600 mb-2">使える変数一覧</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600">
              {[
                ["{{会社名}}", "企業の会社名"],
                ["{{URL}}", "企業のウェブサイトURL"],
                ["{{担当者名}}", "担当者名（登録済みの場合）"],
                ["{{都道府県}}", "企業の都道府県"],
                ["{{市区町村}}", "企業の市区町村"],
                ["{{電話番号}}", "企業の電話番号"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-blue-700">{key}</code>
                  <span className="text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm font-semibold text-slate-700 mb-3">【手順2】企業を選んで一括送信する</p>
          <div className="space-y-3 mb-4">
            <Step number={1}>
              <strong>「候補企業一覧」</strong> でメールを送りたい企業のチェックボックスにチェックを入れます。
            </Step>
            <Step number={2}>
              画面上部に表示される <strong>「一括メール送信」</strong> ボタンをクリックします。
            </Step>
            <Step number={3}>
              送信モーダルが開くので、件名・本文を入力（またはテンプレートから呼び出す）します。
            </Step>
            <Step number={4}>
              プレビューで内容を確認し、<strong>「送信開始」</strong> をクリックします。
            </Step>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-2">
            <p className="text-xs font-bold text-blue-700 mb-1">📧 メール送信の事前準備</p>
            <p className="text-xs text-blue-800 leading-relaxed">
              メールを送るには「設定」ページで SMTP または SendGrid の設定が必要です。
              設定方法はヘルプパネルや設定ページ内の案内をご覧ください。
            </p>
          </div>

          <Tip>
            送信履歴は「一括メール送信」ページで確認できます。SendGrid を設定すると、誰がメールを開いたかも確認できるようになります。
          </Tip>
          <div className="flex gap-2 mt-3">
            <ActionLink to="/templates">テンプレートを開く</ActionLink>
            <ActionLink to="/companies">企業一覧を開く</ActionLink>
          </div>
        </section>

        {/* ===== ダッシュボード ===== */}
        <section id="dashboard" className="mb-14">
          <SectionTitle id="dashboard" icon={<LayoutDashboard size={20} />} title="ダッシュボードの見方" color="text-cyan-600" />
          <UseCase>今の営業活動の全体像を一目で確認できる画面です。何社集めたか、どのステータスに何社いるか、今日フォローアップが必要な企業はどこかがわかります。</UseCase>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
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

          <Tip>
            プロジェクトを切り替えるとグラフもそのプロジェクトのデータに変わります。ページ上部のプロジェクト選択メニューで切り替えてください。
          </Tip>
          <ActionLink to="/">ダッシュボードを開く</ActionLink>
        </section>

        {/* ===== 初期設定 ===== */}
        <section id="settings" className="mb-14">
          <SectionTitle id="settings" icon={<Settings size={20} />} title="初期設定（最初に行うこと）" color="text-slate-600" />
          <UseCase>LeadHive の主な機能を使う前に、いくつかの設定が必要です。最初にこの設定を済ませておきましょう。</UseCase>

          <div className="space-y-4 mb-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">必須</span>
                <p className="text-sm font-bold text-slate-800">Google Custom Search API キーの設定</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                URL収集（企業の自動収集）を使うために必要です。Google Cloud Console で無料で取得できます。
              </p>
              <div className="space-y-2">
                <Step number={1}>
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console</a> にアクセスしてログインします。
                </Step>
                <Step number={2}>
                  「APIとサービス」→「認証情報」→「APIキーを作成」でキーを取得します。
                </Step>
                <Step number={3}>
                  LeadHive の「設定」ページの「Google API Key」欄に貼り付けて保存します。
                </Step>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">任意</span>
                <p className="text-sm font-bold text-slate-800">メール送信設定（SMTP または SendGrid）</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                一括メール送信機能を使う場合に必要です。Gmail や会社のメールサーバー（SMTP）、または SendGrid（メール配信サービス）のどちらかを設定します。
                SendGrid の方が大量送信・開封率追跡に向いています。
              </p>
            </div>
          </div>

          <Tip>
            設定は後からいつでも変更できます。まずは Google API キーだけ設定して、収集を試してみましょう。
          </Tip>
          <ActionLink to="/settings">設定を開く</ActionLink>
        </section>

        {/* ===== 自動収集設定 ===== */}
        <section id="auto" className="mb-14">
          <SectionTitle id="auto" icon={<Bell size={20} />} title="自動収集設定（毎日自動でリストを更新）" color="text-purple-600" />
          <UseCase>毎日決まった時間に自動でURL収集を実行したいときに使います。手動で「収集開始」を押す必要がなくなります。</UseCase>

          <div className="space-y-3 mb-4">
            <Step number={1}>
              左メニューの <strong>「設定」</strong> をクリックします。
            </Step>
            <Step number={2}>
              「自動収集スケジュール」セクションを見つけます。
            </Step>
            <Step number={3}>
              「自動収集を有効にする」をオンにして、実行したい時刻（例：毎朝6時）を設定します。
            </Step>
            <Step number={4}>
              保存すると、毎日その時刻に自動で登録済みのキーワードを収集します。
            </Step>
          </div>

          <Tip>
            自動収集の結果は「収集履歴」ページで確認できます。また Slack 連携を設定すると、収集が完了したときに Slack に通知が届きます。
          </Tip>
          <ActionLink to="/settings">設定を開く</ActionLink>
        </section>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 mt-4">
          <p className="text-sm text-slate-500 mb-4">このガイドで解決しない場合は、以下からご確認ください。</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/manual"
              className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <BookOpen size={15} />
              詳細マニュアル
            </Link>
            <Link
              to="/faq"
              className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Lightbulb size={15} />
              よくある質問（FAQ）
            </Link>
            <Link
              to="/support"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <Users size={15} />
              サポートに問い合わせる
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
