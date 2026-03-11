import { Link } from "react-router-dom";
import { Building2, Calendar, User, MapPin, ChevronLeft, Mail, Globe, Zap, Target, TrendingUp } from "lucide-react";

const BUSINESSES = [
  {
    title: "AI開発事業",
    description: "最先端のAI技術を活用したソリューション開発。OpenAIなどのLLMを活用した業務自動化・効率化システムの企画・設計・開発・運用を行います。",
  },
  {
    title: "SaaS開発・運営事業",
    description: "BtoB企業向け営業支援SaaS「LeadHive」の企画・開発・運営。営業先の自動収集からスコアリング・進捗管理・チーム共有を一元化したクラウドサービスを提供します。",
  },
  {
    title: "Webシステム開発事業",
    description: "受注管理システム「ESCMS」をはじめとする業務用Webシステムの設計・開発・保守。クライアントのビジネス課題を解決するシステムを提供します。",
  },
  {
    title: "インターネット広告事業",
    description: "デジタルマーケティング戦略の立案および効果的なオンライン広告ソリューションの提供。Web広告の運用代行から効果測定・改善提案まで一貫して対応します。",
  },
];

export default function Company() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-base">LeadHive</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={15} />
            トップに戻る
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Company Information</p>
          <h1 className="text-3xl font-extrabold text-slate-900">会社概要</h1>
        </div>

        {/* ブランドストーリー */}
        <section className="mb-8">
          <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl overflow-hidden px-8 py-10 text-white shadow-lg mb-6">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-8 text-8xl font-black tracking-tighter select-none">LH</div>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-3">Brand Concept</p>
            <p className="text-sm text-blue-100 leading-relaxed mb-6 max-w-xl">
              LeadHive は、ビジネスの成長に必要なリードを継続的に生み出す<br className="hidden sm:block" />
              <strong className="text-white">リードジェネレーションエンジン</strong>です。
            </p>
            <div className="border-t border-white/20 pt-5">
              <p className="text-2xl font-extrabold tracking-tight leading-snug">Lead Generation Engine</p>
              <p className="text-blue-200 text-sm mt-1 font-medium">Turn Attention into Leads</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4">Brand Story</p>
            <h2 className="text-xl font-extrabold text-slate-900 mb-5 leading-snug">
              営業の「仕組み」がない企業に、<br />
              リードを生み出す力を。
            </h2>
            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
              <p>
                多くの企業が抱える共通の課題があります。それは「<strong className="text-slate-800">安定したリード獲得</strong>」です。
                広告、SNS、コンテンツマーケティング——様々な手法が存在しますが、
                継続的にリードを生み出す仕組みを持つ企業は多くありません。
              </p>
              <p>
                LeadHive は、この課題を解決するために生まれました。
                リード獲得の仕組みを構築し、企業が継続的に見込み顧客を集め、
                営業活動に集中できる環境をつくる——それが私たちのミッションです。
              </p>
              <p>
                AI技術と自動化を組み合わせ、これまで手作業で行われてきた
                「営業先リストの作成・スコアリング・進捗管理」をクラウド上で一元化。
                中小規模のBtoB営業チームが、大企業と同じスピードで動ける世界を目指しています。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <Zap size={18} className="text-blue-500" />, title: "自動収集", desc: "gBizINFO・Googleマップから営業先を自動取得" },
              { icon: <Target size={18} className="text-indigo-500" />, title: "AIスコアリング", desc: "企業をA〜Dランクに自動評価・優先順位付け" },
              { icon: <TrendingUp size={18} className="text-green-500" />, title: "進捗管理", desc: "カンバンとチームダッシュボードで成果を可視化" },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center mx-auto mb-2">
                  {item.icon}
                </div>
                <p className="text-xs font-bold text-slate-800 mb-1">{item.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 基本情報 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 text-base">基本情報</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <InfoRow
              icon={<Building2 size={16} className="text-blue-500" />}
              label="会社名"
              value="COOLWORKS株式会社"
            />
            <InfoRow
              icon={<Calendar size={16} className="text-blue-500" />}
              label="設立"
              value="2022年4月20日"
            />
            <InfoRow
              icon={<User size={16} className="text-blue-500" />}
              label="代表取締役"
              value="田中 智一郎"
            />
            <InfoRow
              icon={<MapPin size={16} className="text-blue-500" />}
              label="所在地"
              value={
                <span>
                  〒651-0084<br />
                  兵庫県神戸市中央区磯辺通１丁目１番１８号<br />
                  カサベラ国際プラザビル７０７号室
                </span>
              }
            />
            <InfoRow
              icon={<Globe size={16} className="text-blue-500" />}
              label="サービスサイト"
              value={
                <a href="https://leadhive.work" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  https://leadhive.work
                </a>
              }
            />
            <InfoRow
              icon={<Mail size={16} className="text-blue-500" />}
              label="お問い合わせ"
              value={
                <a href="mailto:info@leadhive.work" className="text-blue-600 hover:underline">
                  info@leadhive.work
                </a>
              }
            />
          </div>
        </section>

        {/* 事業内容 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 text-base">事業内容</h2>
          </div>
          <div className="p-6 space-y-5">
            {BUSINESSES.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="w-1 flex-shrink-0 bg-blue-500 rounded-full" />
                <div>
                  <h3 className="font-bold text-slate-800 mb-1">{b.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-4 text-sm text-slate-400 justify-center">
          <Link to="/contact" className="hover:text-slate-700 transition-colors">お問い合わせ</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-slate-700 transition-colors">利用規約</Link>
          <span>·</span>
          <Link to="/privacy-policy" className="hover:text-slate-700 transition-colors">プライバシーポリシー</Link>
          <span>·</span>
          <Link to="/" className="hover:text-slate-700 transition-colors">トップページ</Link>
        </div>
      </main>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-800 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}
