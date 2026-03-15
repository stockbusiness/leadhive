import { Link } from "react-router-dom";
import { Building2, MapPin, ChevronLeft, Mail, User, Briefcase } from "lucide-react";

export default function Company() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-base">
              LeadHive <span className="text-slate-400 font-normal text-sm">by Lumiq Brain</span>
            </span>
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

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Company Information</p>
          <h1 className="text-2xl font-extrabold text-slate-900">会社概要</h1>
        </div>

        {/* 開発ストーリー */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Development Story</p>
            <h2 className="text-base font-bold text-white mt-0.5">開発ストーリー</h2>
          </div>
          <div className="px-6 py-6 space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>
              私たちLEADMARKは、BtoB営業を専門とする会社です。
            </p>
            <p>
              毎日の業務の中で、最も時間を奪われていたのが「営業リストの作成」でした。検索して、コピーして、Excelに貼って——それだけで半日が消える。そんな非効率を、私たちは何年も繰り返していました。
            </p>
            <p className="text-blue-700 font-semibold border-l-4 border-blue-400 pl-4 py-1 bg-blue-50 rounded-r-lg">
              「自分たちが本当に使いたいツールを、自分たちで作ろう。」
            </p>
            <p>
              そう決めて、データ統合・AI開発を手がけるLumiq Brain合同会社と協力し、LeadHiveを開発しました。営業現場のリアルな課題を知る私たちと、テクノロジーで解決するLumiq Brain。その掛け合わせから生まれたのが、このサービスです。
            </p>
            <p>
              LeadHiveは、私たちLEADMARK自身が毎日使うツールです。だからこそ、現場で本当に使えるものになっています。
            </p>
          </div>
        </section>

        {/* 会社概要テーブル（2列） */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 販売会社 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 px-5 py-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Seller</p>
                <h2 className="text-sm font-bold text-white mt-0.5">販売会社</h2>
              </div>
              <div className="divide-y divide-slate-100">
                <CompanyRow icon={<Building2 size={14} className="text-blue-500" />} label="会社名" value="株式会社LEADMARK" />
                <CompanyRow icon={<User size={14} className="text-blue-500" />} label="代表取締役" value="眞先 健太郎" />
                <CompanyRow
                  icon={<MapPin size={14} className="text-blue-500" />}
                  label="所在地"
                  value={
                    <span className="leading-relaxed">
                      大阪府大阪市中央区南本町2丁目3番12号<br />
                      EDGE本町 THE HUB 大阪本町3F
                    </span>
                  }
                />
                <CompanyRow icon={<Briefcase size={14} className="text-blue-500" />} label="事業内容" value="SaaSプロダクトの販売・運営・営業支援" />
                <CompanyRow
                  icon={<Mail size={14} className="text-blue-500" />}
                  label="お問い合わせ"
                  value={
                    <a href="mailto:support@leadhive.work" className="text-blue-600 hover:underline break-all">
                      support@leadhive.work
                    </a>
                  }
                />
              </div>
            </div>

            {/* 開発会社 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-blue-700 px-5 py-3">
                <p className="text-xs text-blue-300 uppercase tracking-widest font-medium">Developer</p>
                <h2 className="text-sm font-bold text-white mt-0.5">開発会社</h2>
              </div>
              <div className="divide-y divide-slate-100">
                <CompanyRow icon={<Building2 size={14} className="text-blue-500" />} label="会社名" value="Lumiq Brain合同会社" />
                <CompanyRow
                  icon={<MapPin size={14} className="text-blue-500" />}
                  label="所在地"
                  value="兵庫県姫路市"
                />
                <CompanyRow icon={<Briefcase size={14} className="text-blue-500" />} label="事業内容" value="SaaSプロダクトの企画・開発・データ分析基盤の構築" />
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 text-sm text-slate-400 justify-center pb-4">
          <Link to="/contact" className="hover:text-slate-700 transition-colors">お問い合わせ</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-slate-700 transition-colors">利用規約</Link>
          <span>·</span>
          <Link to="/privacy-policy" className="hover:text-slate-700 transition-colors">プライバシーポリシー</Link>
          <span>·</span>
          <Link to="/legal/tokutei" className="hover:text-slate-700 transition-colors">特定商取引法の表記</Link>
          <span>·</span>
          <Link to="/" className="hover:text-slate-700 transition-colors">トップページ</Link>
        </div>
      </main>
    </div>
  );
}

function CompanyRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-800 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}
