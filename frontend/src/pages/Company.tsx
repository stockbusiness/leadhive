import { Link } from "react-router-dom";
import { Building2, Calendar, User, MapPin, ChevronLeft, Mail, Globe } from "lucide-react";

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
