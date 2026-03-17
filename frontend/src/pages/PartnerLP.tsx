import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowRight, Building2, Users, Handshake, LinkIcon,
  Gift, ChevronRight, HelpCircle, Sparkles, Map,
  CircleDollarSign, TrendingUp, Repeat, ExternalLink,
} from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: <Users size={20} />,
    title: "パートナー登録",
    body: "申請フォームから必要情報を入力して登録。審査完了後、専用のパートナーダッシュボードにアクセスできます。",
    color: "from-blue-600 to-blue-700",
    accent: "text-blue-400",
    border: "border-blue-800/40",
  },
  {
    num: "02",
    icon: <LinkIcon size={20} />,
    title: "紹介リンクを共有",
    body: "専用の紹介リンクやクーポンコードを取得し、SNS・ブログ・メールなどで見込み顧客へ共有します。",
    color: "from-violet-600 to-violet-700",
    accent: "text-violet-400",
    border: "border-violet-800/40",
  },
  {
    num: "03",
    icon: <CircleDollarSign size={20} />,
    title: "報酬を受け取る",
    body: "紹介した顧客が契約・利用を継続するたびに報酬が発生。月次でまとめてお支払いします。",
    color: "from-emerald-600 to-emerald-700",
    accent: "text-emerald-400",
    border: "border-emerald-800/40",
  },
];

const REWARDS = [
  {
    icon: <Gift size={18} />,
    title: "初回契約報酬",
    desc: "紹介ユーザーが有料プランに契約した時点で、固定の初回報酬をお支払いします。",
    accent: "text-amber-400",
    bg: "bg-amber-950/40",
    border: "border-amber-700/30",
  },
  {
    icon: <TrendingUp size={18} />,
    title: "アップセル報酬",
    desc: "紹介ユーザーが上位プランへアップグレードした場合、追加の報酬が発生します。",
    accent: "text-emerald-400",
    bg: "bg-emerald-950/40",
    border: "border-emerald-700/30",
  },
  {
    icon: <Repeat size={18} />,
    title: "継続報酬（リカーリング）",
    desc: "紹介ユーザーが利用を続ける限り、毎月の売上に対して一定割合の報酬を継続してお支払いします。",
    accent: "text-blue-400",
    bg: "bg-blue-950/40",
    border: "border-blue-700/30",
  },
];

const FAQS = [
  {
    q: "パートナー登録に費用はかかりますか？",
    a: "いいえ、パートナープログラムへの参加は完全無料です。登録や維持に費用は一切発生しません。",
  },
  {
    q: "法人でなくても参加できますか？",
    a: "はい、個人事業主・フリーランスの方もご参加いただけます。法人・個人問わず歓迎しています。",
  },
  {
    q: "報酬の支払いサイクルはどうなっていますか？",
    a: "報酬は月次で集計し、翌月末までにお支払いします。最低支払額に達した時点でお振込みとなります。",
  },
  {
    q: "紹介リンクの有効期限はありますか？",
    a: "紹介リンクにはCookieベースのトラッキング期間があります。詳細はパートナーダッシュボードでご確認いただけます。",
  },
  {
    q: "既存のLeadHiveユーザーもパートナーになれますか？",
    a: "はい、LeadHiveをご利用中のお客様もパートナーとしてご登録いただけます。自分以外の方への紹介が対象となります。",
  },
];

export default function PartnerLP() {
  const [applyUrl, setApplyUrl] = useState<string>("");
  const [enabled, setEnabled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    axios.get("/api/public/partner")
      .then((r) => {
        setApplyUrl(r.data.apply_url || "");
        setEnabled(r.data.enabled);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-white">
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={18} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">LeadHive</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/roadmap"
              className="hidden sm:flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Map size={14} />
              ロードマップ
            </Link>
            <Link
              to="/login"
              className="text-sm text-slate-400 hover:text-white font-medium transition-colors"
            >
              ログイン
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Sparkles size={13} />
              アーリー登録
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.12),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.06),transparent)] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-700/40 text-emerald-300 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 uppercase tracking-widest">
            <Handshake size={12} />
            パートナープログラム
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            LeadHiveを紹介して、
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              報酬を得る。
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            LeadHiveパートナープログラムでは、紹介いただいた企業が有料プランを契約するたびに報酬をお支払いします。
            初回報酬に加え、継続利用による毎月のリカーリング報酬も受け取れます。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {enabled && applyUrl ? (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-emerald-900/40"
              >
                <Handshake size={16} />
                パートナー申請する
                <ExternalLink size={14} />
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-slate-800 text-slate-400 font-bold px-8 py-3.5 rounded-xl text-base cursor-not-allowed">
                <Handshake size={16} />
                パートナー申請（準備中）
              </div>
            )}
            <Link
              to="/"
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-white px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors text-sm"
            >
              LeadHiveの詳細を見る
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-emerald-400 font-semibold text-xs mb-2 uppercase tracking-widest">報酬体系</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              3つの報酬で<br />安定した収益を
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">
              紹介した顧客のライフサイクル全体を通じて、複数の報酬を受け取ることができます。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {REWARDS.map((r) => (
              <div key={r.title} className={`${r.bg} border ${r.border} rounded-2xl p-6`}>
                <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${r.accent} mb-4`}>
                  {r.icon}
                </div>
                <h3 className={`font-bold text-lg mb-3 ${r.accent}`}>{r.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-violet-400 font-semibold text-xs mb-2 uppercase tracking-widest">仕組み</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              3ステップで<br />すぐに始められる
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.num} className={`bg-slate-900 border ${s.border} rounded-2xl p-6 hover:border-slate-600 transition-colors`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-4`}>
                  {s.icon}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-600">STEP {s.num}</span>
                </div>
                <h3 className={`font-bold text-lg mb-3 ${s.accent}`}>{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-cyan-400 font-semibold text-xs mb-2 uppercase tracking-widest">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              よくある質問
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <HelpCircle size={16} className="text-cyan-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-white flex-1">{faq.q}</span>
                  <ChevronRight
                    size={14}
                    className={`text-slate-500 transition-transform ${openFaq === i ? "rotate-90" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 pl-11">
                    <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 border-t border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(16,185,129,0.08),transparent)] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-700/40 text-emerald-300 px-4 py-1.5 rounded-full text-xs font-bold mb-6 uppercase tracking-widest">
            <Handshake size={12} />
            パートナープログラム
          </div>

          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
            一緒にLeadHiveを<br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              広めませんか？
            </span>
          </h2>

          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            BtoB営業を効率化するLeadHiveを、あなたのネットワークに紹介してください。
            パートナーとして持続的な報酬を得られます。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {enabled && applyUrl ? (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-colors shadow-2xl shadow-emerald-900/40"
              >
                <Handshake size={18} />
                パートナー申請する
                <ArrowRight size={18} />
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-slate-800 text-slate-400 font-bold px-10 py-4 rounded-2xl text-lg cursor-not-allowed">
                <Handshake size={18} />
                パートナー申請（準備中）
              </div>
            )}
          </div>

          <p className="text-slate-600 text-xs mt-6">
            法人・個人事業主・フリーランス歓迎 · 登録無料 · 審査制
          </p>
        </div>
      </section>

      <footer className="bg-slate-950 border-t border-slate-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-base">LeadHive</span>
            <span className="text-slate-600 text-sm">営業先リスト自動化ツール</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 justify-center">
            <Link to="/roadmap" className="hover:text-white transition-colors flex items-center gap-1">
              <Map size={13} />
              ロードマップ
            </Link>
            <Link to="/faq" className="hover:text-white transition-colors">よくある質問</Link>
            <Link to="/company" className="hover:text-white transition-colors">会社概要</Link>
            <Link to="/privacy-policy" className="hover:text-white transition-colors">プライバシー</Link>
            <Link to="/terms" className="hover:text-white transition-colors">利用規約</Link>
            <Link to="/contact" className="hover:text-white transition-colors">お問い合わせ</Link>
          </div>
          <div className="text-xs text-slate-700 text-center md:text-right">
            <p>販売: 株式会社LEADMARK（大阪）</p>
            <p>開発: Lumiq Brain合同会社（姫路）</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
