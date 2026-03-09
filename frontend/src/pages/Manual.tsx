import { useEffect, useRef, useState } from "react";
import {
  BookOpen, ChevronRight, Settings, FolderKanban, Globe,
  Building2, Database, LayoutDashboard, FileText, Star,
  AlertTriangle, HelpCircle, Zap, Search, Bell,
  Brain, BarChart2, Crown, Mail, Copy, Sparkles,
  Users, ShieldBan, CreditCard, Key,
  GanttChartSquare, Calendar, Play, SendHorizonal, Ban, TrendingUp,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = [
  { id: "overview", title: "はじめに・基本フロー", icon: <BookOpen size={16} /> },
  { id: "setup", title: "初期セットアップ", icon: <Settings size={16} /> },
  { id: "projects", title: "プロジェクト管理", icon: <FolderKanban size={16} /> },
  { id: "collection", title: "企業の収集", icon: <Globe size={16} /> },
  { id: "companies", title: "候補企業の管理・評価", icon: <Building2 size={16} /> },
  { id: "scoring", title: "スコアリングの仕組み", icon: <Star size={16} /> },
  { id: "master", title: "マスターDB", icon: <Database size={16} /> },
  { id: "dashboard", title: "ダッシュボードの見方", icon: <LayoutDashboard size={16} /> },
  { id: "activities", title: "営業活動の記録", icon: <FileText size={16} /> },
  { id: "pipeline", title: "営業パイプライン", icon: <GanttChartSquare size={16} /> },
  { id: "salesai", title: "営業AI・メール一括送信", icon: <SendHorizonal size={16} /> },
  { id: "team", title: "チーム管理", icon: <Users size={16} /> },
  { id: "notifications", title: "通知・自動収集", icon: <Bell size={16} /> },
  { id: "ai", title: "AI企業分析", icon: <Brain size={16} /> },
  { id: "keywords_analytics", title: "キーワード分析", icon: <BarChart2 size={16} /> },
  { id: "plans", title: "プラン管理・上限", icon: <Crown size={16} /> },
  { id: "admin_settings", title: "管理者設定", icon: <ShieldBan size={16} /> },
  { id: "tips", title: "便利な機能", icon: <Zap size={16} /> },
  { id: "faq", title: "よくある質問", icon: <HelpCircle size={16} /> },
];

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </div>
      <div className="flex-1 text-slate-700">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-slate-50 hover:bg-blue-50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 border border-slate-200 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ id, icon, title }: { id: string; icon: React.ReactNode; title: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-xl font-bold text-slate-800 mb-4 scroll-mt-6">
      <span className="text-blue-600">{icon}</span>
      {title}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-slate-700 mt-6 mb-3 flex items-center gap-1.5"><ChevronRight size={16} className="text-blue-500" />{children}</h3>;
}

function InfoBox({ color = "blue", children }: { color?: "blue" | "amber" | "green" | "red"; children: React.ReactNode }) {
  const styles = {
    blue: "bg-blue-50 border-blue-300 text-blue-800",
    amber: "bg-amber-50 border-amber-300 text-amber-800",
    green: "bg-emerald-50 border-emerald-300 text-emerald-800",
    red: "bg-red-50 border-red-300 text-red-800",
  };
  return (
    <div className={`border-l-4 rounded-r px-4 py-3 text-sm my-3 ${styles[color]}`}>
      {children}
    </div>
  );
}

function FlowDiagram({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-col gap-1 my-4">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-start">
          <div className="bg-white border border-slate-300 rounded px-4 py-2 text-sm text-slate-700 w-full shadow-sm">
            {step}
          </div>
          {i < steps.length - 1 && (
            <div className="text-slate-400 text-lg leading-none ml-4">↓</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Manual() {
  const [activeId, setActiveId] = useState("overview");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = () => {
      const sectionEls = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
      for (let i = sectionEls.length - 1; i >= 0; i--) {
        if (sectionEls[i].getBoundingClientRect().top <= 80) {
          setActiveId(sectionEls[i].id);
          return;
        }
      }
      setActiveId("overview");
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-800">
            <BookOpen size={18} className="text-blue-600" />
            <span className="font-bold text-sm">ユーザーマニュアル</span>
          </div>
        </div>
        <nav className="p-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors ${
                activeId === s.id
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className={activeId === s.id ? "text-blue-600" : "text-slate-400"}>{s.icon}</span>
              {s.title}
            </button>
          ))}
        </nav>
      </aside>

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 space-y-14">

          {/* ========== はじめに ========== */}
          <section>
            <SectionTitle id="overview" icon={<BookOpen size={20} />} title="はじめに・基本フロー" />
            <p className="text-slate-600 mb-6">
              このツールは EC・Shopify 支援会社などの<strong>代理店候補企業を自動収集・評価・管理</strong>するシステムです。
              複数の収集方法でWebから企業情報を取得し、スコアリング・ステータス管理を通じて営業活動を支援します。
            </p>
            <SubTitle>基本的な運用フロー</SubTitle>
            <FlowDiagram steps={[
              "① プロジェクトを作成（目的別に管理）",
              "② Google APIキーを設定（Google検索収集を使う場合）",
              "③ 検索キーワードを登録",
              "④ 企業を自動収集（複数の収集方法から選択）",
              "⑤ 収集した企業をスコアで絞り込み・内容確認",
              "⑥ ステータスを更新しながら営業活動を記録",
              "⑦ 定期的に収集を回してリストを拡充し続ける",
            ]} />
          </section>

          {/* ========== 初期セットアップ ========== */}
          <section>
            <SectionTitle id="setup" icon={<Settings size={20} />} title="初期セットアップ" />

            <SubTitle>① Google API Key の取得</SubTitle>
            <div className="space-y-2 mb-3">
              <Step number={1}><a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google Cloud Console</a> を開き、Googleアカウントでログイン</Step>
              <Step number={2}>上部「プロジェクトを選択」→「新しいプロジェクト」で任意の名前でプロジェクトを作成</Step>
              <Step number={3}>左メニュー「APIとサービス」→「ライブラリ」→ <strong>「Custom Search API」</strong> を検索して有効化</Step>
              <Step number={4}>左メニュー「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」をクリック</Step>
              <Step number={5}>生成された <code className="bg-slate-100 px-1 rounded text-xs">AIzaSy...</code> から始まるキーをコピー → 設定画面の「Google API Key」に貼り付け</Step>
            </div>
            <InfoBox color="blue">
              Google Custom Search API は <strong>1日100回まで無料</strong>です。ダッシュボードのAPI使用量カードで残り回数を確認できます。
            </InfoBox>

            <SubTitle>② Search Engine ID (cx) の取得</SubTitle>
            <div className="space-y-2 mb-3">
              <Step number={1}><a href="https://programmablesearchengine.google.com/controlpanel/create" target="_blank" rel="noreferrer" className="text-blue-600 underline">Programmable Search Engine</a> を開く</Step>
              <Step number={2}>「検索エンジン名」に任意の名前を入力（例：LeadHive）</Step>
              <Step number={3}>「検索対象」で <strong>「ウェブ全体を検索する」</strong> を選択して「作成」をクリック</Step>
              <Step number={4}>作成完了後、「コントロールパネルへ」→「基本」タブを開く</Step>
              <Step number={5}>「検索エンジン ID」欄の <code className="bg-slate-100 px-1 rounded text-xs">a1b2c3...</code> 形式のIDをコピー → 設定画面の「Search Engine ID (cx)」に貼り付け</Step>
            </div>
            <InfoBox color="amber">
              コントロールパネルで「<strong>ウェブ全体を検索</strong>」が有効になっていることを確認してください。OFFのままだと収集範囲が極端に狭くなります。
            </InfoBox>

            <div className="space-y-2">
              <Step number={6}>設定画面で両方入力後 <strong>「保存」</strong> → <strong>「接続テスト」</strong> で動作確認</Step>
            </div>

            <SubTitle>③ Google Places API Key の取得（Googleマップ収集用）</SubTitle>
            <div className="space-y-2 mb-3">
              <Step number={1}>Google Cloud Console で同じプロジェクトを選択</Step>
              <Step number={2}>「APIとサービス」→「ライブラリ」→ <strong>「Places API」</strong> を検索して有効化</Step>
              <Step number={3}>「認証情報」→「認証情報を作成」→「APIキー」で新しいキーを作成</Step>
              <Step number={4}>生成されたキーを設定画面の「Google Places API Key」に貼り付けて保存</Step>
            </div>
            <InfoBox color="blue">
              Custom Search API と同じAPIキーをPlacesでも使用できますが、用途別に分けて管理することを推奨します。
            </InfoBox>

            <SubTitle>オンボーディングウィザード（初回ログイン時）</SubTitle>
            <p className="text-sm text-slate-600 mb-2">
              新規アカウント作成後、初回ログイン時に <strong>6ステップのウィザード</strong>が自動起動し、設定に必要な手順をガイドします。
            </p>
            <Table
              headers={["ステップ", "内容"]}
              rows={[
                ["① ようこそ", "LeadHiveの概要説明"],
                ["② 組織名の設定", "組織名・会社名の入力"],
                ["③ プロジェクト作成", "最初の営業リストプロジェクトを作成"],
                ["④ キーワード登録", "ターゲット業種・条件のキーワードを追加"],
                ["⑤ Google APIキー設定", "Google APIキーとSearch Engine IDを入力・テスト"],
                ["⑥ 完了", "セットアップ完了・収集開始"],
              ]}
            />
            <InfoBox color="green">
              ウィザードは途中でスキップ・あとから再設定も可能です。完了後はいつでも設定画面から変更できます。
            </InfoBox>

            <SubTitle>Slack 通知の設定（任意）</SubTitle>
            <div className="space-y-2">
              <Step number={1}>設定画面「Slack通知設定」に Webhook URL を入力・保存</Step>
              <Step number={2}><strong>「テスト送信」</strong> ボタンで疎通確認</Step>
            </div>
          </section>

          {/* ========== プロジェクト管理 ========== */}
          <section>
            <SectionTitle id="projects" icon={<FolderKanban size={20} />} title="プロジェクト管理" />
            <p className="text-slate-600 mb-4">
              「Shopify代理店候補」「EC運営代行候補」「関西エリア限定」のように、<strong>目的・条件ごとにデータを分けて管理</strong>するための単位です。
            </p>

            <SubTitle>プロジェクトの作成</SubTitle>
            <div className="space-y-2">
              <Step number={1}>サイドバーの <strong>「プロジェクト管理」</strong> を開く</Step>
              <Step number={2}><strong>「新規プロジェクト」</strong> ボタンをクリック</Step>
              <Step number={3}>名前・説明・業種を入力して <strong>「作成」</strong></Step>
            </div>

            <SubTitle>プロジェクトの切り替え</SubTitle>
            <p className="text-sm text-slate-600">サイドバー上部のドロップダウンから切り替えます。切り替えると全画面のデータが選択プロジェクトに絞り込まれます。</p>

            <SubTitle>カスタマイズ（上級）</SubTitle>
            <Table
              headers={["設定項目", "説明"]}
              rows={[
                ["カテゴリ定義", "どのキーワードがヒットしたらどのカテゴリに分類するかを設定"],
                ["フラグ定義", "Shopify判定・EC判定などの検出キーワードをカスタマイズ"],
                ["スコアリングルール", "各フラグの点数をプロジェクトの目的に合わせて調整"],
              ]}
            />
          </section>

          {/* ========== 企業の収集 ========== */}
          <section>
            <SectionTitle id="collection" icon={<Globe size={20} />} title="企業の収集" />

            <Table
              headers={["収集方法", "説明", "APIキー"]}
              rows={[
                ["Google API 検索", "Google Custom Search APIで指定キーワードを検索", <Badge color="bg-blue-100 text-blue-800">必要</Badge>],
                ["ディレクトリ収集", "企業一覧ページのリンクから一括収集", <Badge color="bg-emerald-100 text-emerald-800">不要</Badge>],
                ["Google 直接検索", "Google検索結果を直接スクレイピング", <Badge color="bg-emerald-100 text-emerald-800">不要</Badge>],
                ["Shopify パートナー", "Shopifyパートナーディレクトリから収集", <Badge color="bg-emerald-100 text-emerald-800">不要</Badge>],
                ["Google マップ", "Google Places APIでマップ上の企業を収集", <Badge color="bg-blue-100 text-blue-800">必要</Badge>],
                ["法人DB（gBizINFO）", "経済産業省の約400万社法人DBから会社名・住所・URLを収集", <Badge color="bg-indigo-100 text-indigo-800">管理者設定</Badge>],
              ]}
            />

            <SubTitle>Google API 検索（最も精度が高い方法）</SubTitle>
            <div className="space-y-2">
              <Step number={1}>サイドバーの <strong>「URL収集」</strong> を開き「Google API検索」タブを選択</Step>
              <Step number={2}>収集したいキーワードを選択（「全キーワード一括収集」も可）</Step>
              <Step number={3}><strong>「収集開始」</strong> → プログレスバーでリアルタイム進捗を確認</Step>
            </div>
            <InfoBox color="blue">
              キーワードが未登録の場合は <strong>「検索条件管理」</strong> 画面で先に追加してください。
            </InfoBox>

            <SubTitle>検索キーワードの登録</SubTitle>
            <div className="space-y-2">
              <Step number={1}>サイドバーの <strong>「検索条件管理」</strong> を開く</Step>
              <Step number={2}><strong>「キーワードを追加」</strong> をクリック</Step>
              <Step number={3}>キーワード（例: <code className="bg-slate-100 px-1 rounded text-xs">Shopify 制作会社</code>）、カテゴリ、地域、除外キーワードを入力して保存</Step>
            </div>

            <SubTitle>ディレクトリ収集</SubTitle>
            <p className="text-sm text-slate-600 mb-2">業界団体の会員一覧や比較サイトの掲載企業リストなどのURLを入力すると、リンク先の企業をまとめて収集できます。</p>
            <div className="space-y-2">
              <Step number={1}>「URL収集」→「ディレクトリ収集」タブ</Step>
              <Step number={2}>企業一覧ページのURLを入力し、最大ページ数を設定</Step>
              <Step number={3}><strong>「収集開始」</strong></Step>
            </div>

            <SubTitle>URLを直接入力して取得</SubTitle>
            <p className="text-sm text-slate-600">特定の企業サイトを手動で追加したい場合は「URL収集」画面下部の「単一URL取得」または「一括URL取得」を使用します。</p>

            <SubTitle>gBizINFO 法人DB収集</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              経済産業省が提供する<strong>gBizINFO</strong>（法人情報データベース）から約400万社の会社名・住所・企業URLを取得します。
              URL未登録の法人はGoogle直接検索でホームページを特定し、通常の収集パイプライン（スクレイピング→スコアリング）と同じ処理で登録されます。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>「URL収集」を開き <strong>「法人DB」</strong> タブを選択</Step>
              <Step number={2}>都道府県・検索キーワード・最大件数を設定</Step>
              <Step number={3}><strong>「収集開始」</strong> → プログレスバーで進捗確認</Step>
            </div>
            <InfoBox color="amber">
              この機能を利用するには、管理者が <strong>「システムAPI設定」</strong>（/admin/api-keys）から gBizINFO APIトークンを登録する必要があります。
              トークンは <a href="https://info.gbiz.go.jp/api/index.html" target="_blank" rel="noreferrer" className="underline">gBizINFO のサイト</a>から無料・即時発行されます。
            </InfoBox>

            <SubTitle>自動収集スケジュール</SubTitle>
            <div className="space-y-2">
              <Step number={1}>設定画面の「自動収集スケジュール」で <strong>「有効にする」</strong> をON</Step>
              <Step number={2}>実行時刻を設定して保存</Step>
            </div>
            <InfoBox color="amber">
              自動収集はサーバーが起動中の場合のみ実行されます。アクティブなキーワードが対象になります。
            </InfoBox>
          </section>

          {/* ========== 候補企業の管理・評価 ========== */}
          <section>
            <SectionTitle id="companies" icon={<Building2 size={20} />} title="候補企業の管理・評価" />

            <SubTitle>一覧の見方</SubTitle>
            <Table
              headers={["列", "説明"]}
              rows={[
                ["会社名", "会社名とドメイン。Shopify/Amazon/楽天フラグのバッジも表示"],
                ["カテゴリ", "自動分類されたカテゴリ（EC制作、Shopify支援など）"],
                ["スコア", "0〜100点のスコアとランク（A/B/C/D）"],
                ["所在地", "都道府県・市区町村・電話番号"],
                ["問い合わせ", "問い合わせページへのリンク"],
                ["ステータス", "現在の営業ステータス"],
              ]}
            />

            <SubTitle>絞り込みフィルター</SubTitle>
            <p className="text-sm text-slate-600 mb-2">画面上部のフィルターバーで以下の条件を組み合わせられます：</p>
            <div className="flex flex-wrap gap-2">
              {["カテゴリ", "ステータス", "スコアランク A/B/C/D", "問い合わせあり/なし", "フリーワード検索", "タグ"].map(f => (
                <Badge key={f} color="bg-slate-100 text-slate-700">{f}</Badge>
              ))}
            </div>

            <SubTitle>ステータス管理</SubTitle>
            <Table
              headers={["ステータス", "意味"]}
              rows={[
                [<Badge color="bg-slate-100 text-slate-700">未確認</Badge>, "収集直後。まだ内容を確認していない"],
                [<Badge color="bg-blue-100 text-blue-800">対象候補</Badge>, "確認してアプローチ対象と判断した"],
                [<Badge color="bg-red-100 text-red-800">除外</Badge>, "業種不一致等でアプローチ不要と判断"],
                [<Badge color="bg-indigo-100 text-indigo-800">アプローチ前</Badge>, "アプローチ準備完了"],
                [<Badge color="bg-amber-100 text-amber-800">フォーム送信済</Badge>, "問い合わせフォームからコンタクト済み"],
                [<Badge color="bg-orange-100 text-orange-800">返信あり</Badge>, "先方から返信が来た"],
                [<Badge color="bg-purple-100 text-purple-800">面談化</Badge>, "面談の約束が取れた"],
                [<Badge color="bg-emerald-100 text-emerald-800">代理店化</Badge>, "代理店契約が完了した"],
                [<Badge color="bg-gray-100 text-gray-600">失注</Badge>, "断られた・見込みなし"],
              ]}
            />

            <SubTitle>詳細編集モーダル</SubTitle>
            <p className="text-sm text-slate-600 mb-2">企業行の「鉛筆アイコン」をクリックして開きます。</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                "基本情報（会社名・URL・電話・メール・所在地）",
                "コンタクト担当者名・役職（contact_name / contact_title）",
                "カテゴリ・フラグ（Shopify/EC/Amazon/楽天等）",
                "スコア手動調整（-30〜+30点）",
                "メモ・内部ノート",
                "タグの付与・削除",
                "ステータス変更履歴の閲覧",
                "営業活動ログの記録",
                "メールテンプレートの呼び出し",
                "SMTPメール送信・送信履歴",
              ].map(item => (
                <div key={item} className="flex items-start gap-1.5 text-sm text-slate-700">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </div>
              ))}
            </div>
            <InfoBox color="blue">
              <strong>コンタクト担当者名・役職</strong>を登録しておくと、AIメール生成時に宛名として自動的に使用されます。
            </InfoBox>

            <SubTitle>一括操作（複数選択）</SubTitle>
            <p className="text-sm text-slate-600 mb-2">チェックボックスで複数企業を選択するとバルクアクションバーが表示されます：</p>
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <p className="text-sm font-semibold text-slate-700 mb-1">一括ステータス変更</p>
                <p className="text-xs text-slate-600">複数の企業のステータスをドロップダウンで選択してまとめて変更します。</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <p className="text-sm font-semibold text-slate-700 mb-1">プロジェクト間移動</p>
                <p className="text-xs text-slate-600">選択した企業を別のプロジェクトに移動します。移動先に同ドメインが既にある場合は自動スキップされます。</p>
              </div>
            </div>

            <SubTitle>再スクレイピング</SubTitle>
            <p className="text-sm text-slate-600">企業行の「回転矢印アイコン」をクリックすると、WebサイトをFetch し直して情報を最新に更新します。手動で調整したスコアは保持されます。</p>

            <SubTitle>CSVインポート</SubTitle>
            <p className="text-sm text-slate-600 mb-3">既存の企業リスト（スプレッドシート等）を CSV ファイルで一括登録できます。</p>
            <div className="space-y-2 mb-3">
              <Step number={1}>候補企業一覧右上の <strong>「CSVインポート」</strong> ボタンをクリック</Step>
              <Step number={2}>CSVファイルを選択してアップロード</Step>
              <Step number={3}>インポート件数と結果が表示される</Step>
            </div>
            <InfoBox color="blue">
              推奨列：<code className="bg-slate-100 px-1 rounded text-xs">会社名</code>・<code className="bg-slate-100 px-1 rounded text-xs">URL</code>・<code className="bg-slate-100 px-1 rounded text-xs">電話番号</code>・<code className="bg-slate-100 px-1 rounded text-xs">メール</code>・<code className="bg-slate-100 px-1 rounded text-xs">都道府県</code>。
              同一ドメインが既に登録済みの場合は自動スキップされます。
            </InfoBox>

            <SubTitle>CSVエクスポート</SubTitle>
            <p className="text-sm text-slate-600">フィルターで絞り込んだ状態で右上の「CSV出力」ボタンを押すと、現在の表示条件のデータが出力されます。全件出力する場合はフィルターをリセットしてから実行してください。</p>
          </section>

          {/* ========== スコアリング ========== */}
          <section>
            <SectionTitle id="scoring" icon={<Star size={20} />} title="スコアリングの仕組み" />
            <p className="text-slate-600 mb-4">収集した企業は <strong>0〜100点</strong> で自動採点されます。スコアに応じてA〜Dのランクが付与されます。</p>

            <SubTitle>スコアランク</SubTitle>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { rank: "A", range: "80〜100点", color: "bg-emerald-50 border-emerald-300", badge: "bg-emerald-100 text-emerald-800", note: "優先アプローチ" },
                { rank: "B", range: "60〜79点", color: "bg-blue-50 border-blue-300", badge: "bg-blue-100 text-blue-800", note: "積極検討" },
                { rank: "C", range: "40〜59点", color: "bg-amber-50 border-amber-300", badge: "bg-amber-100 text-amber-800", note: "要確認" },
                { rank: "D", range: "0〜39点", color: "bg-slate-50 border-slate-300", badge: "bg-slate-100 text-slate-600", note: "優先度低" },
              ].map(r => (
                <div key={r.rank} className={`border rounded p-3 text-center ${r.color}`}>
                  <Badge color={r.badge}>ランク {r.rank}</Badge>
                  <p className="text-xs text-slate-600 mt-1">{r.range}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{r.note}</p>
                </div>
              ))}
            </div>

            <SubTitle>採点ルール（デフォルト）</SubTitle>
            <Table
              headers={["条件", "点数"]}
              rows={[
                ["Shopify フラグあり", <span className="font-semibold text-emerald-700">+20点</span>],
                ["制作フラグあり", <span className="font-semibold text-emerald-700">+15点</span>],
                ["コンサルフラグあり", <span className="font-semibold text-emerald-700">+15点</span>],
                ["運営代行フラグあり", <span className="font-semibold text-emerald-700">+15点</span>],
                ["問い合わせURLあり", <span className="font-semibold text-emerald-700">+10点</span>],
                ["Amazon + 楽天の両フラグあり", <span className="font-semibold text-emerald-700">+10点</span>],
                ["電話番号あり", <span className="font-semibold text-emerald-700">+5点</span>],
                ["所在地（都道府県/市区町村）あり", <span className="font-semibold text-emerald-700">+5点</span>],
                ["情報が2項目未満（会社名/電話/メール/所在地）", <span className="font-semibold text-red-600">-10点</span>],
                ["問い合わせURLなし", <span className="font-semibold text-red-600">-15点</span>],
                ["EC関連フラグが一つもなし", <span className="font-semibold text-red-600">-20点</span>],
              ]}
            />

            <SubTitle>手動スコア調整</SubTitle>
            <p className="text-sm text-slate-600">企業の詳細編集モーダルから <strong>-30〜+30点</strong> の手動調整が可能です。再スクレイピング後も調整値は保持されます。</p>

            <SubTitle>プロジェクト別カスタマイズ</SubTitle>
            <p className="text-sm text-slate-600">プロジェクト設定画面でスコアリングルール（各フラグの点数）をプロジェクトの目的に合わせて上書きできます。</p>
          </section>

          {/* ========== マスターDB ========== */}
          <section>
            <SectionTitle id="master" icon={<Database size={20} />} title="マスターDB" />
            <p className="text-slate-600 mb-4">
              マスターDBは<strong>全プロジェクト共通の企業プール</strong>です。どのプロジェクトで収集した企業も、収集と同時にマスターDBに自動登録されます。
            </p>

            <SubTitle>活用シーン</SubTitle>
            <div className="space-y-2">
              {[
                "別プロジェクトの成果を再利用したい（「東京特化」で収集した企業を「全国」プロジェクトでも使う）",
                "過去に収集した企業を新しいプロジェクトで再活用したい",
                "まとめて大量の企業を素早くインポートしたい",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-blue-500 flex-shrink-0 mt-0.5">●</span>
                  {item}
                </div>
              ))}
            </div>

            <SubTitle>プロジェクトへのインポート手順</SubTitle>
            <div className="space-y-2">
              <Step number={1}>サイドバーで対象プロジェクトに切り替えておく</Step>
              <Step number={2}>サイドバーの <strong>「マスターDB」</strong> を開く</Step>
              <Step number={3}>キーワード・カテゴリ・都道府県・最低スコアで検索</Step>
              <Step number={4}><Badge color="bg-emerald-100 text-emerald-800">登録済み</Badge> バッジのない企業にチェックを入れる</Step>
              <Step number={5}><strong>「現在のプロジェクトにインポート」</strong> → 完了メッセージで件数を確認</Step>
            </div>
            <InfoBox color="blue">
              「登録済み」バッジの企業は現プロジェクトに既に存在するためインポート対象外です。
            </InfoBox>
          </section>

          {/* ========== ダッシュボード ========== */}
          <section>
            <SectionTitle id="dashboard" icon={<LayoutDashboard size={20} />} title="ダッシュボードの見方" />

            <SubTitle>タブの切り替え（概要 / チーム）</SubTitle>
            <p className="text-sm text-slate-600 mb-2">ダッシュボード右上の切り替えボタンで <strong>「概要」</strong>タブと<strong>「チーム」</strong>タブを切り替えられます。</p>
            <Table
              headers={["タブ", "表示内容"]}
              rows={[
                ["概要", "全体の統計カード・グラフ・ファネル・最近の企業一覧"],
                ["チーム", "チームメンバー別の担当企業数・アプローチ進捗・期限超過・今週の活動数"],
              ]}
            />

            <SubTitle>概要タブ — 統計カード</SubTitle>
            <Table
              headers={["カード", "説明"]}
              rows={[
                ["総収集件数", "プロジェクト内の全企業数"],
                ["重複除外後", "ユニークドメイン数（実質的な企業数）"],
                ["未確認", "まだステータスが「未確認」の企業数"],
                ["高スコア（A/B）", "ランクA・Bの企業数（優先アプローチ対象）"],
                ["問い合わせあり", "問い合わせURLを持つ企業数"],
                ["API使用量", "本日のGoogle API使用回数（上限100回/日）"],
              ]}
            />

            <SubTitle>概要タブ — グラフ一覧</SubTitle>
            <Table
              headers={["グラフ", "種類", "説明"]}
              rows={[
                ["カテゴリ別内訳", "円グラフ", "企業のカテゴリ分布"],
                ["スコアランク分布", "棒グラフ", "A〜Dランクの件数"],
                ["ステータス別", "横棒グラフ", "各営業ステータスの件数"],
                ["都道府県別（上位10）", "横棒グラフ", "所在地の分布"],
                ["直近30日の収集件数推移", "折れ線グラフ", "日別の収集実績・トレンド"],
              ]}
            />
            <InfoBox color="blue">全グラフは現在選択中のプロジェクトのデータのみを表示します。</InfoBox>

            <SubTitle>チームタブ — 進捗ビュー</SubTitle>
            <p className="text-sm text-slate-600 mb-2">「チーム」タブでは担当者別の進捗をひと目で確認できます。</p>
            <Table
              headers={["表示項目", "説明"]}
              rows={[
                ["今月の新規収集", "今月チーム全体で追加した企業数"],
                ["アプローチ済み", "フォーム送信以降のステータスの合計"],
                ["面談・商談化", "面談化・商談中・代理店化のステータス合計"],
                ["期限超過", "フォローアップ期限が過ぎている企業数"],
                ["担当者別テーブル", "各メンバーの担当企業数・今週の活動数・期限超過件数・アプローチ進捗バー"],
              ]}
            />
          </section>

          {/* ========== 営業活動の記録 ========== */}
          <section>
            <SectionTitle id="activities" icon={<FileText size={20} />} title="営業活動の記録" />

            <SubTitle>活動ログの種別</SubTitle>
            <div className="flex flex-wrap gap-2 mb-4">
              {["電話", "メール", "フォーム送信", "面談", "その他"].map(t => (
                <Badge key={t} color="bg-slate-100 text-slate-700">{t}</Badge>
              ))}
            </div>
            <p className="text-sm text-slate-600">企業の詳細編集モーダル → 「活動ログ」タブから記録します。日時・種別・内容を入力して保存すると一覧に追加されます。</p>

            <SubTitle>メモテンプレート</SubTitle>
            <div className="space-y-2">
              <Step number={1}>サイドバーの <strong>「メモテンプレート」</strong> を開く</Step>
              <Step number={2}><strong>「テンプレートを追加」</strong> で雛形テキストを作成・保存</Step>
              <Step number={3}>企業詳細モーダルのメモ欄から「テンプレートを挿入」で呼び出す</Step>
            </div>

            <SubTitle>メールテンプレート</SubTitle>
            <p className="text-sm text-slate-600 mb-3">「メモテンプレート」ページの「メールテンプレート」タブでメール本文の雛形を管理します。</p>
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm">
              <p className="font-semibold text-slate-700 mb-1">使える変数</p>
              <div className="flex gap-3 flex-wrap">
                {["{{company_name}}", "{{website_url}}", "{{contact_url}}"].map(v => (
                  <code key={v} className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700">{v}</code>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">企業詳細モーダルから呼び出すと変数が自動展開され、mailto:リンクも生成されます。</p>
            </div>

            <SubTitle>SMTPメール直接送信</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              企業の詳細編集モーダルから、LeadHive内で直接メールを送信できます。送信したメールは<strong>送信履歴</strong>として記録されます。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>企業詳細編集モーダルを開く（鉛筆アイコン）</Step>
              <Step number={2}>「<strong>メール送信</strong>」タブを選択</Step>
              <Step number={3}>宛先メールアドレス・件名・本文を入力（テンプレートから呼び出し可）</Step>
              <Step number={4}>「<strong>送信</strong>」をクリック → 完了メッセージが表示される</Step>
              <Step number={5}>「<strong>送信履歴</strong>」タブで送信日時・件名・宛先を確認</Step>
            </div>
            <InfoBox color="amber">
              メール送信にはSMTP設定が必要です。管理者が設定画面の「<strong>メール通知設定（SMTP）</strong>」でサーバー情報を設定してください。
            </InfoBox>
          </section>

          {/* ========== 営業パイプライン ========== */}
          <section>
            <SectionTitle id="pipeline" icon={<GanttChartSquare size={20} />} title="営業パイプライン" />
            <p className="text-slate-600 mb-4">
              収集した企業を「未確認」から「代理店化・成約」まで9段階のカンバンボードで視覚的に管理します。ドラッグ&ドロップで進捗をリアルタイム更新できます。
            </p>

            <SubTitle>パイプライン画面の開き方</SubTitle>
            <div className="space-y-2 mb-3">
              <Step number={1}>サイドバーの <strong>「パイプライン」</strong>（GanttChartSquare アイコン）をクリック</Step>
              <Step number={2}>プロジェクトフィルターで表示対象を切り替える（全プロジェクト or 特定プロジェクト）</Step>
            </div>

            <SubTitle>9つのステータスカラム</SubTitle>
            <Table
              headers={["ステータス", "意味"]}
              rows={[
                ["未確認", "収集直後。まだ担当者が確認していない企業"],
                ["アプローチ前", "確認済み。これからアプローチ予定"],
                ["アプローチ中", "メール・電話などでアプローチ実施中"],
                ["資料送付済", "提案資料・カタログを送付した"],
                ["フォロー中", "返信待ち・フォロー継続中"],
                ["面談・商談化", "商談が発生した（重要マイルストーン）"],
                ["代理店化", "成約・代理店契約締結（完了）"],
                ["失注", "商談が不成立（完了）"],
                ["除外", "営業対象から外す（完了）"],
              ]}
            />

            <SubTitle>ステータスの変更方法</SubTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">方法1: ドラッグ&ドロップ</p>
                <p className="text-xs text-blue-700">カードをつかんで別のカラムにドロップすると即座にステータスが更新されます。</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-800 mb-1">方法2: ドロップダウン</p>
                <p className="text-xs text-slate-700">カード右上の「…」または現在のステータスをクリックするとドロップダウンで選択できます。</p>
              </div>
            </div>

            <SubTitle>カードに表示される情報</SubTitle>
            <Table
              headers={["バッジ・情報", "説明"]}
              rows={[
                ["スコアランク (A/B/C/D)", "企業の優先度ランク。Aが最高"],
                ["フォローアップ日", "赤表示 = 期限超過 / 黄表示 = 本日"],
                ["EC / Shopify バッジ", "ECサイト・Shopify運営中を検出"],
                ["企業名クリック", "企業詳細ページに遷移"],
              ]}
            />
            <InfoBox color="blue">
              「代理店化」「失注」「除外」に移動した企業はフォローアップ通知の対象外になります。
            </InfoBox>
          </section>

          {/* ========== 営業AI・メール一括送信 ========== */}
          <section>
            <SectionTitle id="salesai" icon={<SendHorizonal size={20} />} title="営業AI・メール一括送信" />
            <p className="text-slate-600 mb-4">
              サイドバーの <strong>「営業AI」</strong> ページでは、AI による営業メール生成・SMTP 送信・配信管理・送信統計・自動生成スケジュールをまとめて管理できます。
            </p>
            <InfoBox color="amber">
              メール生成には <strong>Anthropic APIキー (Claude-3-5-Sonnet)</strong> が必要です。COOLWORKS システム管理者が設定します。
            </InfoBox>

            <SubTitle>ターゲット選択・生成タブ</SubTitle>
            <p className="text-sm text-slate-600 mb-3">スコアランク・ステータス・プロジェクトで絞り込んだ企業を選択し、一括でAIメールを生成します。</p>
            <div className="space-y-2 mb-3">
              <Step number={1}>テンプレートを選択（Shopify移行提案 / EC支援 / 代理店パートナー）</Step>
              <Step number={2}>左パネルのフィルターで対象企業を絞り込む</Step>
              <Step number={3}>チェックボックスで送信したい企業を選択</Step>
              <Step number={4}>「<strong>選択した企業に一括生成</strong>」をクリック → ドラフトが作成される</Step>
              <Step number={5}>「<strong>レビュー・送信</strong>」タブで内容確認・送信</Step>
            </div>
            <Table
              headers={["テンプレート", "対象"]}
              rows={[
                ["Shopify移行提案", "Shopify以外のECサイトを運営している企業"],
                ["EC支援・売上改善", "ECサイト運営中で売上改善ニーズがある企業"],
                ["代理店パートナー", "代理店・パートナー関係を構築したい企業"],
              ]}
            />

            <SubTitle>レビュー・送信タブ</SubTitle>
            <p className="text-sm text-slate-600 mb-3">生成したドラフトを確認・編集し、送信方法を選んで送信します。</p>
            <Table
              headers={["送信方法", "説明"]}
              rows={[
                ["メール送信", "設定済みSMTPサーバー経由で直接送信。配信停止リンク自動付与"],
                ["フォーム送信", "企業の問い合わせフォームURLを開く（手動貼り付け）"],
                ["手動送信済み", "外部ツールで送信済みとしてログだけ記録"],
              ]}
            />
            <InfoBox color="blue">
              送信前に宛先メールアドレス・SMTP設定状態・配信停止リスト登録状況を確認できます。
            </InfoBox>

            <SubTitle>配信停止リストタブ</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              一度でも「配信停止」になったメールアドレス・ドメインには再送信できません。
              リストは以下の方法で追加されます。
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge color="bg-slate-100 text-slate-700">メール内ワンクリック配信停止</Badge>
              <Badge color="bg-slate-100 text-slate-700">管理者による手動追加</Badge>
              <Badge color="bg-slate-100 text-slate-700">企業詳細からの追加</Badge>
            </div>
            <InfoBox color="amber">
              特定電子メール法では受信者の明確な同意なしに商業メールを送信することは禁止されています。配信停止リストを適切に管理してください。
            </InfoBox>

            <SubTitle>送信統計タブ</SubTitle>
            <p className="text-sm text-slate-600 mb-3">送信実績の統計を確認できます。</p>
            <Table
              headers={["指標", "内容"]}
              rows={[
                ["総ドラフト数", "生成したメールの合計件数"],
                ["送信済み", "実際に送信完了した件数"],
                ["失敗", "送信エラーになった件数"],
                ["配信停止", "配信停止リストに登録された件数"],
                ["14日間の送信推移", "直近2週間の日別送信件数グラフ"],
                ["監査ログ", "企業名・送信方法・結果・日時の詳細履歴"],
              ]}
            />

            <SubTitle>自動生成スケジュールタブ</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              毎日指定した時刻に、条件に合う企業のメールを自動生成してドラフト保存します。
              <strong>送信は行われません</strong>。担当者が「レビュー・送信」タブで確認してから手動送信します（半自動モード）。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>「<strong>自動生成を有効化</strong>」トグルをONにする</Step>
              <Step number={2}>実行時刻・対象ステータス・最低スコアランク・最大生成件数を設定</Step>
              <Step number={3}>テンプレートと対象プロジェクトを選択して「<strong>設定を保存</strong>」</Step>
              <Step number={4}>毎日指定時刻にドラフトが自動生成 → 通知ベルでお知らせ</Step>
              <Step number={5}>「<strong>今すぐ実行</strong>」ボタンで動作確認できます</Step>
            </div>
            <Table
              headers={["設定項目", "説明"]}
              rows={[
                ["実行時刻", "0〜23時から選択（毎日この時刻に自動実行）"],
                ["対象ステータス", "どのステータスの企業を対象にするか（複数選択可）"],
                ["最低スコアランク", "すべて / C以上 / B以上 / Aのみ"],
                ["最大生成件数", "1回の実行で生成するドラフトの上限（1〜50件）"],
                ["テンプレート", "使用する営業文テンプレートの種類"],
                ["対象プロジェクト", "全プロジェクト or 特定のプロジェクトのみ"],
              ]}
            />
            <InfoBox color="blue">
              自動生成スケジュールの設定は <strong>管理者ロール以上</strong>（admin または COOLWORKS管理者）のみ操作できます。
            </InfoBox>
          </section>

          {/* ========== チーム管理 ========== */}
          <section>
            <SectionTitle id="team" icon={<Users size={20} />} title="チーム管理" />
            <p className="text-slate-600 mb-4">
              組織のメンバーを招待し、同じリスト・プロジェクトをチームで共有できます。メンバーはロール（権限）によって利用できる機能が異なります。
            </p>

            <SubTitle>メンバーの招待（管理者のみ）</SubTitle>
            <div className="space-y-2 mb-3">
              <Step number={1}>サイドバーの <strong>「ユーザー管理」</strong> を開く</Step>
              <Step number={2}><strong>「メンバーを招待」</strong> ボタンをクリック</Step>
              <Step number={3}>招待したいメールアドレスとロールを選択して送信</Step>
              <Step number={4}>相手の受信ボックスに招待メールが届き、リンクから登録してログイン</Step>
            </div>
            <InfoBox color="blue">
              招待メールの送信にはSMTP設定が必要です。設定画面の「メール通知設定（SMTP）」から設定してください。
            </InfoBox>

            <SubTitle>ロールの違い</SubTitle>
            <Table
              headers={["ロール", "できること"]}
              rows={[
                ["admin（管理者）", "全機能利用可能 + メンバー管理 + 設定変更 + 管理者専用ページ（プラン管理・Stripe設定・API設定）"],
                ["member（メンバー）", "企業収集・管理・AI機能・マスターDB参照などの通常機能。設定変更・メンバー管理は不可"],
              ]}
            />

            <SubTitle>メンバーの削除</SubTitle>
            <p className="text-sm text-slate-600">「ユーザー管理」一覧から対象メンバーの削除ボタンをクリックします。削除すると即座にログインできなくなります。</p>
            <InfoBox color="amber">
              メンバー数の上限はプランによって異なります。設定画面の「プラン・使用量」セクションで残り枠を確認できます。
            </InfoBox>

            <SubTitle>チーム進捗ダッシュボード</SubTitle>
            <p className="text-sm text-slate-600 mb-2">
              ダッシュボードの「チーム」タブで、チームメンバー全員の活動状況をひとつの画面でまとめて確認できます。
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                "担当者別の担当企業数",
                "今週のアクティビティ件数",
                "期限超過フォローアップ件数",
                "アプローチ進捗バー（担当中の何件が送信済み以降か）",
                "今月チーム全体の収集数",
                "面談化・商談化の合計件数",
              ].map(item => (
                <div key={item} className="flex items-start gap-1.5 text-sm text-slate-700">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* ========== Slack通知・自動収集 ========== */}
          <section>
            <SectionTitle id="notifications" icon={<Bell size={20} />} title="通知・自動収集" />

            <SubTitle>通知ベル（アプリ内通知）</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              画面のサイドバー下部（デスクトップ）またはモバイルヘッダーにあるベルアイコンから、フォローアップ期限の企業をすぐに確認できます。
            </p>
            <Table
              headers={["表示内容", "説明"]}
              rows={[
                ["赤いバッジ (数字)", "今日が期限 + 期限超過の合計件数"],
                ["今日のフォローアップ", "本日がフォローアップ期限の企業一覧"],
                ["期限超過", "フォローアップ期限が過ぎた企業一覧（赤ハイライト）"],
                ["パイプラインで確認", "パイプライン画面に遷移するリンク"],
              ]}
            />
            <InfoBox color="blue">
              通知ベルは5分ごとに自動更新されます。管理者は組織全体、一般メンバーは自分が担当者に設定された企業のみ表示されます。
            </InfoBox>

            <SubTitle>Slack 通知</SubTitle>
            <p className="text-sm text-slate-600 mb-2">収集が完了し、新規収集件数が1件以上の場合に自動送信されます。</p>
            <div className="bg-slate-800 rounded p-3 text-xs text-green-300 font-mono">
              ✅ 収集完了: [プロジェクト名] / [キーワード]<br />
              新規 12件　除外 3件　重複 5件
            </div>
            <InfoBox color="amber">
              Webhook URL は <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="underline">Slack API</a> でAppを作成 → Incoming Webhooks を有効化して取得します。
            </InfoBox>

            <SubTitle>自動収集スケジュール</SubTitle>
            <p className="text-sm text-slate-600">設定画面で「自動収集を有効にする」をONにして実行時刻を設定すると、毎日その時刻にアクティブなキーワードを自動収集します。</p>

            <SubTitle>フォローアップ通知</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              企業ごとにフォローアップ期限を設定でき、期限当日・超過の企業を毎朝9時に自動通知します。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>候補企業の編集モーダルを開き <strong>「フォローアップ日」</strong> を設定</Step>
              <Step number={2}>設定画面「フォローアップ通知」で <strong>通知をON</strong> にし、通知チャンネル（メール or Slack）を選択して保存</Step>
              <Step number={3}>期限当日・超過の企業が毎朝9時にメール or Slackで通知される</Step>
            </div>
            <Table
              headers={["フィルター", "対象"]}
              rows={[
                ["期限超過", "フォローアップ日が過去の企業（要即対応）"],
                ["今日", "本日がフォローアップ日の企業"],
                ["今週", "今後7日以内にフォローアップ期限が来る企業"],
              ]}
            />
            <InfoBox color="blue">
              候補企業一覧の「フォローアップ」フィルターで「期限超過 / 今日 / 今週」に絞り込んで確認できます。
            </InfoBox>
          </section>

          {/* ========== AI機能 ========== */}
          <section>
            <SectionTitle id="ai" icon={<Brain size={20} />} title="AI機能（企業分析・メール生成）" />
            <InfoBox color="amber">
              この機能は <strong>OpenAI APIキー</strong>（GPT-4o-mini）が必要です。設定画面の「OpenAI API設定」で入力・保存してください。
            </InfoBox>

            <SubTitle>AI企業分析</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              企業のWebサイトを自動スクレイピングし、AIが<strong>事業内容・顧客層・強み・サービス・価格帯</strong>を分析・要約します。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>候補企業一覧から企業名をクリックして<strong>企業詳細ページ</strong>を開く</Step>
              <Step number={2}>「<strong>AIサマリー</strong>」タブを選択</Step>
              <Step number={3}>「<strong>AI分析を実行</strong>」ボタンをクリック（初回のみ数秒かかります）</Step>
              <Step number={4}>事業内容・顧客層・強み・サービス・価格帯の分析結果が表示される</Step>
            </div>
            <InfoBox color="blue">
              分析結果はDBに保存されるため、2回目以降は即時表示されます。再分析したい場合は「再分析」ボタンをクリックしてください。
            </InfoBox>
            <Table
              headers={["分析項目", "内容"]}
              rows={[
                ["事業内容", "企業が何をしているかの要約"],
                ["顧客層", "ターゲット顧客・業界・規模感"],
                ["強み", "競合に対する差別化ポイント"],
                ["サービス", "具体的なサービス・商品の一覧"],
                ["価格帯", "料金体系・価格感の情報"],
              ]}
            />

            <SubTitle>AIアウトリーチメール生成</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              AI分析結果をもとに、<strong>件名・本文を自動生成</strong>します。パーソナライズされた営業メールを数秒で作成できます。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>企業詳細ページの「AIサマリー」タブを開く（先にAI分析を実行しておく）</Step>
              <Step number={2}>「<strong>アウトリーチメール生成</strong>」セクションでトーンを選択</Step>
              <Step number={3}>必要に応じて「追加指示」欄に自由記述でカスタマイズ指示を入力</Step>
              <Step number={4}>「<strong>メールを生成</strong>」をクリック → 件名・本文が自動生成される</Step>
              <Step number={5}>本文を直接編集して調整 → <strong>「コピー」</strong> ボタンでクリップボードに貼り付け</Step>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={14} className="text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700">フォーマル</p>
                </div>
                <p className="text-xs text-blue-600">ビジネスライクで丁寧な文体。初回コンタクトや格式あるターゲット向け。</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700">カジュアル</p>
                </div>
                <p className="text-xs text-emerald-600">親しみやすく話しかけるような文体。スタートアップや中小企業向け。</p>
              </div>
            </div>
            <InfoBox color="blue">
              <strong>プランの月次AI分析回数上限</strong>に達すると生成できなくなります。使用量は設定画面のプログレスバーで確認できます。
            </InfoBox>

            <SubTitle>AIトークン使用量ログ（管理者向け）</SubTitle>
            <p className="text-sm text-slate-600 mb-2">
              AI機能を実行するたびに、使用したトークン数・モデル・コストが自動的に記録されます。
              管理者は<strong>管理ダッシュボードのAIコスト管理セクション</strong>で、組織別・月別のトークン消費量とUSDコストを確認できます。
            </p>
            <Table
              headers={["確認できる情報", "説明"]}
              rows={[
                ["入力トークン数", "プロンプトに使用したトークン数"],
                ["出力トークン数", "AIが生成したテキストのトークン数"],
                ["API呼び出し回数", "AI機能を実行した合計回数"],
                ["コスト概算 (USD)", "GPT-4o-mini 基準の概算費用（入力$0.15/1M・出力$0.60/1M）"],
              ]}
            />
          </section>

          {/* ========== キーワード分析 ========== */}
          <section>
            <SectionTitle id="keywords_analytics" icon={<BarChart2 size={20} />} title="キーワード分析" />
            <p className="text-slate-600 mb-4">
              どのキーワードが収集効率が高いか・低いかを可視化します。無駄なキーワードの削除や、効果的なキーワードの強化に活用できます。
            </p>

            <SubTitle>分析タブの開き方</SubTitle>
            <div className="space-y-2">
              <Step number={1}>サイドバーの <strong>「検索条件管理」</strong> を開く</Step>
              <Step number={2}>画面上部の <strong>「分析」</strong> タブをクリック</Step>
            </div>

            <SubTitle>分析指標の見方</SubTitle>
            <Table
              headers={["指標", "説明", "目安"]}
              rows={[
                ["総獲得企業数", "そのキーワードで収集した企業の合計", "多いほど収集効率が高い"],
                ["成功率", "収集試行のうち実際に企業が取得できた割合", "50%以上が目安"],
                ["重複率", "収集した中ですでに登録済みだった企業の割合", "高いと新規開拓効率が低下"],
                ["拒否率", "収集した中でまとめサイト等として除外された割合", "低いほど精度が高い"],
              ]}
            />

            <SubTitle>効率バッジ</SubTitle>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge color="bg-emerald-100 text-emerald-800">高効率</Badge>
              <Badge color="bg-amber-100 text-amber-800">中効率</Badge>
              <Badge color="bg-red-100 text-red-800">低効率</Badge>
            </div>
            <p className="text-sm text-slate-600">成功率と獲得数をもとに自動でバッジが付与されます。<strong>「低効率」</strong>のキーワードはキーワード見直しの目安にしてください。</p>

            <SubTitle>棒グラフの見方</SubTitle>
            <p className="text-sm text-slate-600">分析タブ上部の棒グラフで、キーワードごとの獲得企業数を一目で比較できます。収集数が著しく低いキーワードは検索語句を変更するか、地域・除外キーワードを調整してみてください。</p>

            <SubTitle>収集効率ランキングカード</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              収集実績が一定数以上あるキーワードについて、成功率の高い順・低い順でランキングを自動表示します。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-800">成功率 上位キーワード（緑）</p>
                </div>
                <p className="text-xs text-emerald-700">収集5件以上のキーワードで成功率が高いTOP3。これらのキーワードパターンを他にも展開するのがおすすめです。</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-red-600" />
                  <p className="text-xs font-semibold text-red-800">要改善キーワード（赤）</p>
                </div>
                <p className="text-xs text-red-700">2回以上実行して成功率20%未満のキーワード。キーワードの見直しや削除を検討してください。</p>
              </div>
            </div>
          </section>

          {/* ========== プラン管理・上限 ========== */}
          <section>
            <SectionTitle id="plans" icon={<Crown size={20} />} title="プラン管理・上限" />
            <p className="text-slate-600 mb-4">
              LeadHiveは組織ごとにプランを割り当て、利用できる機能・件数を管理します。
            </p>

            <SubTitle>プラン一覧</SubTitle>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse min-w-[420px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-700">プラン</th>
                    <th className="text-center px-3 py-2 border border-slate-200 font-semibold text-slate-700">月額</th>
                    <th className="text-center px-3 py-2 border border-slate-200 font-semibold text-slate-700">メンバー</th>
                    <th className="text-center px-3 py-2 border border-slate-200 font-semibold text-slate-700">企業数</th>
                    <th className="text-center px-3 py-2 border border-slate-200 font-semibold text-slate-700">AI分析/月</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "フリー", price: "¥0", members: "1名", companies: "200件", ai: "3回" },
                    { name: "スターター", price: "¥4,980", members: "3名", companies: "1,000件", ai: "20回" },
                    { name: "プロ", price: "¥14,800", members: "10名", companies: "5,000件", ai: "100回" },
                    { name: "エンタープライズ", price: "要相談", members: "無制限", companies: "無制限", ai: "無制限" },
                  ].map((p, i) => (
                    <tr key={p.name} className={`border-t border-slate-100 ${i === 3 ? "bg-blue-50" : "even:bg-slate-50"}`}>
                      <td className="px-3 py-2 border border-slate-200 font-semibold text-slate-700">{p.name}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-slate-600">{p.price}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-slate-600">{p.members}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-slate-600">{p.companies}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-slate-600">{p.ai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SubTitle>使用量の確認</SubTitle>
            <p className="text-sm text-slate-600 mb-2">設定画面の「プラン・使用量」セクションで現在の使用状況をプログレスバーで確認できます。</p>
            <div className="grid grid-cols-2 gap-2">
              {["メンバー数", "企業数（登録合計）", "AI分析回数（今月）", "プロジェクト数"].map(item => (
                <div key={item} className="flex items-start gap-1.5 text-sm text-slate-700">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </div>
              ))}
            </div>

            <SubTitle>上限に達したとき</SubTitle>
            <p className="text-sm text-slate-600 mb-2">プランの上限を超える操作を行うと、画面中央に<strong>アップグレードモーダル</strong>が表示されます。</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <Crown size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">モーダルの内容</p>
                <ul className="space-y-1 text-xs">
                  <li>• 何の上限に達したかのエラーメッセージ</li>
                  <li>• フリー→スターター→プロのプラン比較表</li>
                  <li>• <strong>「今すぐアップグレード」</strong>ボタン：クレジットカードで即時セルフアップグレード（Stripe決済）</li>
                  <li>• 管理者：「プラン管理へ」ボタン（/admin/plansに遷移）も表示</li>
                  <li>• Stripe未設定 / 最上位プランの場合：「管理者にご相談ください」を表示</li>
                </ul>
              </div>
            </div>

            <SubTitle>マスターDB 利用制限</SubTitle>
            <p className="text-sm text-slate-600 mb-3">マスターDBへのアクセスはプランによって制限されています。</p>
            <Table
              headers={["プラン", "マスターDB"]}
              rows={[
                ["フリー", "検索・インポート不可（ロック表示）"],
                ["スターター", "月100件までインポート可能（残り件数バッジを画面上部に表示）"],
                ["プロ / エンタープライズ", "無制限"],
              ]}
            />
            <InfoBox color="blue">
              スターターの月次インポート件数は毎月1日にリセットされます。残り件数はマスターDB画面上部のバッジで確認できます。
            </InfoBox>

            <SubTitle>プランの変更（管理者のみ）</SubTitle>
            <div className="space-y-2">
              <Step number={1}>サイドバー下部の <strong>「プラン管理」</strong>（管理者のみ表示）を開く</Step>
              <Step number={2}>変更したいプランの「割り当て」ボタンをクリック</Step>
              <Step number={3}>組織のプランが即時変更される</Step>
            </div>
            <InfoBox color="blue">
              ダッシュボード右上にも現在のプラン名がバッジで表示されます。
            </InfoBox>
          </section>

          {/* ========== 管理者設定 ========== */}
          <section>
            <SectionTitle id="admin_settings" icon={<ShieldBan size={20} />} title="管理者設定" />
            <InfoBox color="amber">
              このセクションの機能は <strong>管理者（admin）ロール</strong> のみサイドバーに表示されます。
            </InfoBox>

            <SubTitle>Stripe 決済設定（/admin/stripe）</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              Stripe を使った自己アップグレード機能を有効化します。設定すると、ユーザーがプラン上限に達した際にクレジットカードで即時アップグレードできるようになります。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>サイドバーの <strong>「Stripe設定」</strong> を開く</Step>
              <Step number={2}>Stripe ダッシュボードから <strong>シークレットキー・公開鍵・Webhookシークレット</strong> を取得して入力</Step>
              <Step number={3}><strong>テスト or 本番モード</strong> を選択して保存</Step>
              <Step number={4}>「接続テスト」ボタンで疎通確認</Step>
              <Step number={5}>プラン管理画面（/admin/plans）で各プランに <strong>Stripe Price ID</strong> を設定</Step>
            </div>
            <InfoBox color="blue">
              Price ID を設定したプランにはアップグレードモーダルに「今すぐアップグレード」ボタンが表示されます。
              未設定のプランは「管理者にご相談ください」が表示されます。
            </InfoBox>

            <SubTitle>システムAPI設定（/admin/api-keys）</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              gBizINFO など、全組織で共有するシステムレベルの API キーを管理します。
            </p>
            <div className="space-y-2 mb-3">
              <Step number={1}>サイドバーの <strong>「システムAPI設定」</strong> を開く</Step>
              <Step number={2}><a href="https://info.gbiz.go.jp/api/index.html" target="_blank" rel="noreferrer" className="underline text-blue-600">gBizINFO のページ</a>からAPIトークンを取得（無料・即時発行）</Step>
              <Step number={3}>「gBizINFO APIトークン」欄に入力して <strong>「保存」</strong></Step>
            </div>
            <InfoBox color="blue">
              システムAPI設定のキーは全組織共有です。1回設定すれば全ユーザーが法人DB収集機能を利用できます。
            </InfoBox>

            <SubTitle>プラン管理（/admin/plans）</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              プランの作成・編集・削除と、各組織へのプラン割り当てを行います。
            </p>
            <Table
              headers={["設定項目", "説明"]}
              rows={[
                ["プラン名・説明・月額", "プランの基本情報"],
                ["メンバー数上限", "組織に招待できる最大メンバー数"],
                ["プロジェクト数上限", "作成できる最大プロジェクト数"],
                ["企業数上限", "登録できる最大企業数（全プロジェクト合計）"],
                ["月次AI分析回数", "1ヶ月のAI分析・メール生成の合計上限"],
                ["マスターDBインポート上限", "月間のマスターDBインポート件数（0=アクセス不可）"],
                ["Stripe Price ID", "Stripe決済との連携用ID。設定するとセルフアップグレードが有効になる"],
              ]}
            />

            <SubTitle>テナント管理（/admin/tenants）— 利用状況モニタリング</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              各テナント（組織）の詳細な利用状況を一覧で確認し、解約リスクの早期発見ができます。
            </p>
            <Table
              headers={["カラム", "説明"]}
              rows={[
                ["最終利用日", "その組織のメンバーが最後にログインした日時（14日以上前はオレンジ表示）"],
                ["今月収集", "当月に新規収集した企業数"],
                ["状態", "30日以上未ログインの場合「🔴 30日未利用」バッジ（解約リスク）を表示"],
              ]}
            />
            <InfoBox color="amber">
              ページ上部に解約リスク件数の合計バッジが表示されます。定期的に確認して早期フォローアップに活用してください。
            </InfoBox>

            <SubTitle>AIコスト管理（管理ダッシュボード内）</SubTitle>
            <p className="text-sm text-slate-600 mb-3">
              管理ダッシュボード（/admin）の「AIコスト管理」セクションで、全組織のAI使用コストを月次・組織別に可視化できます。
            </p>
            <Table
              headers={["表示内容", "説明"]}
              rows={[
                ["累計コスト (USD)", "全期間・全組織のAIコスト総額"],
                ["API呼び出し回数", "全期間のAI分析・メール生成の合計回数"],
                ["今月コスト", "当月のAIコスト"],
                ["組織別累計コスト棒グラフ", "コストの高い組織を上位10件で可視化"],
                ["月次コスト推移グラフ", "直近3ヶ月の月別コスト変化"],
                ["月別・組織別詳細テーブル", "入力/出力トークン数・呼び出し回数・コストの詳細一覧"],
              ]}
            />
          </section>

          {/* ========== 便利な機能 ========== */}
          <section>
            <SectionTitle id="tips" icon={<Zap size={20} />} title="便利な機能" />

            <SubTitle>重複検出・マージ</SubTitle>
            <div className="space-y-2">
              <Step number={1}>「候補企業一覧」右上の <strong>「重複チェック」</strong> をクリック</Step>
              <Step number={2}>重複グループが表示される（ドメイン正規化による検出）</Step>
              <Step number={3}>各グループで残したい「メイン企業」をラジオボタンで選択</Step>
              <Step number={4}><strong>「マージ実行」</strong> → 他の企業の情報がメインに統合されて削除される</Step>
            </div>

            <SubTitle>拒否リスト</SubTitle>
            <p className="text-sm text-slate-600 mb-2">まとめサイト・競合・無関係なサイトなど収集から除外したいドメインを管理します。拒否リストに登録されたドメインは以降の収集で自動スキップされます。</p>
            <InfoBox color="blue">まとめサイトや比較サイトは収集時に自動判定されて拒否リストに登録されます。手動でも追加可能です。</InfoBox>

            <SubTitle>収集履歴</SubTitle>
            <p className="text-sm text-slate-600">サイドバーの「収集履歴」では、いつ・どのキーワードで・何件収集/除外/重複したかの記録を確認できます。</p>

            <SubTitle>タグ管理</SubTitle>
            <p className="text-sm text-slate-600">企業ごとに自由なタグを付与でき、一覧画面でタグフィルタリングができます。詳細編集モーダルの「タグ」セクションから追加・削除できます。</p>
          </section>

          {/* ========== FAQ ========== */}
          <section>
            <SectionTitle id="faq" icon={<HelpCircle size={20} />} title="よくある質問" />
            <div className="space-y-4">
              {[
                {
                  q: "収集しても企業が0件のまま",
                  a: "設定画面でGoogle API KeyとSearch Engine ID (cx) が正しく保存されているか確認してください。「接続テスト」ボタンで疎通確認できます。またAPI使用量が上限（100回/日）に達していないかもダッシュボードで確認してください。",
                },
                {
                  q: "同じ企業が何度も収集される",
                  a: "同一プロジェクト内では同一ドメインの重複収集は自動スキップされます。もし重複している場合は「重複チェック」機能でマージしてください。",
                },
                {
                  q: "スコアが低い企業を非表示にしたい",
                  a: "「候補企業一覧」のフィルターバーで「スコアランク」をA・Bのみに設定すると、高スコア企業だけ表示できます。",
                },
                {
                  q: "収集した企業を別のプロジェクトでも使いたい",
                  a: "2つの方法があります：① 候補企業一覧でチェックして「プロジェクト移動」を実行する。② マスターDB画面で検索して「インポート」する。",
                },
                {
                  q: "Googleマップ収集で「APIキーが設定されていません」と表示される",
                  a: "設定画面の「Google Places API Key」フィールドに入力・保存してください。Google Custom Search APIとは別のキーです。",
                },
                {
                  q: "自動収集が実行されない",
                  a: "設定画面で「自動収集を有効にする」がONか、「検索条件管理」でアクティブなキーワードが1件以上あるか、スケジューラ状態が「稼働中」かを確認してください。",
                },
                {
                  q: "Slack通知が届かない",
                  a: "設定画面でWebhook URLが正しく保存されているか「テスト送信」で確認してください。また収集の成功件数が0件の場合は通知されません。",
                },
                {
                  q: "企業情報が不完全（会社名や電話番号がない）",
                  a: "Webサイトの構造によっては自動抽出できない場合があります。詳細編集モーダルから手動で補完してください。情報を入力・保存するとスコアが自動再計算されます。",
                },
                {
                  q: "パイプラインで企業がドラッグできない",
                  a: "モバイルブラウザではドラッグ&ドロップが使いにくい場合があります。カード右上のドロップダウンからステータス変更をご利用ください。",
                },
                {
                  q: "営業AIの「メール生成」ボタンが押せない",
                  a: "Anthropic APIキー（Claude）が設定されていない場合、生成機能が無効になります。画面上部の警告バナーをご確認ください。APIキーはCOOLWORKSシステム管理者が設定します。",
                },
                {
                  q: "自動生成スケジュールを設定しても実行されない",
                  a: "「自動生成を有効化」トグルがONになっているか確認してください。また設定保存後、次の指定時刻まで実行されません。「今すぐ実行」ボタンで即時テストができます。",
                },
                {
                  q: "通知ベルに件数が表示されない",
                  a: "フォローアップ日が設定されている企業がない場合は件数0になります。企業詳細編集モーダルの「フォローアップ日」欄から日付を設定してください。",
                },
                {
                  q: "配信停止リストから削除できますか？",
                  a: "配信停止リスト画面から個別に削除できます。ただし、受信者本人から明確な再受信の意思確認を得た場合のみ削除してください（特定電子メール法）。",
                },
              ].map((item, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-start gap-2 bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <Search size={15} className="text-slate-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-semibold text-slate-800">{item.q}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-slate-700">{item.a}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-slate-100 rounded-lg p-4 text-center">
              <AlertTriangle size={18} className="text-amber-500 mx-auto mb-2" />
              <p className="text-xs text-slate-600">その他ご不明な点はシステム担当者までお問い合わせください。</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
