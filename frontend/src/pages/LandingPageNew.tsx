import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowRight, Star, CheckCircle2, Lock, Clock, Zap, Building2,
  Search, Brain, BarChart3, FileSpreadsheet, Bell, Send, Users,
  Sparkles, ChevronRight, Globe, Map,
} from "lucide-react";

interface PublicStats {
  registered_users: number;
  founder_slots_remaining: number;
  founder_slots_total: number;
}

const AVAILABLE_NOW = [
  { icon: <Search size={16} />, label: "営業先の自動収集（Google・マップ・gBizINFO）", color: "text-blue-400" },
  { icon: <BarChart3 size={16} />, label: "スマートスコアリング（A〜Dランク）", color: "text-emerald-400" },
  { icon: <Globe size={16} />, label: "企業一覧・詳細閲覧・ステータス管理", color: "text-cyan-400" },
  { icon: <Zap size={16} />, label: "9段階カンバンパイプライン", color: "text-violet-400" },
  { icon: <Bell size={16} />, label: "フォローアップ通知（アプリ内・メール・Slack）", color: "text-orange-400" },
  { icon: <Brain size={16} />, label: "AI企業分析・AIメール生成（月2回）", color: "text-rose-400" },
  { icon: <BarChart3 size={16} />, label: "キーワード分析・収集効率レポート", color: "text-teal-400" },
];

const COMING_SOON = [
  { icon: <Users size={16} />, label: "チームメンバー招待・管理（3名〜）", tier: "スターター〜" },
  { icon: <Brain size={16} />, label: "AI分析・メール生成 無制限", tier: "スターター〜" },
  { icon: <Send size={16} />, label: "SMTPメール直接送信", tier: "スターター〜" },
  { icon: <FileSpreadsheet size={16} />, label: "CSVエクスポート 無制限", tier: "スターター〜" },
  { icon: <Sparkles size={16} />, label: "半自動メール生成スケジュール", tier: "スターター〜" },
  { icon: <Users size={16} />, label: "チームダッシュボード（担当者別成果）", tier: "スターター〜" },
  { icon: <Bell size={16} />, label: "Slack通知・フォローアップ自動通知", tier: "スターター〜" },
];

const FOUNDER_BENEFITS = [
  { period: "1年目", benefit: "全機能 完全無料", highlight: true },
  { period: "2年目", benefit: "月額料金 80% OFF 永続", highlight: false },
  { period: "3年目以降", benefit: "月額料金 50% OFF 永続", highlight: false },
];

function SlotCounter({ stats }: { stats: PublicStats | null }) {
  const remaining = stats ? stats.founder_slots_remaining : null;
  const registered = stats ? stats.registered_users : null;
  const pct = stats ? Math.round((stats.registered_users / stats.founder_slots_total) * 100) : 0;

  return (
    <div className="bg-amber-950/60 border border-amber-600/40 rounded-2xl p-5 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-3">
        <Star size={14} className="text-amber-400 fill-amber-400" />
        <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">Founderプラン</span>
      </div>
      {remaining !== null ? (
        <>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-4xl font-extrabold text-amber-300">{remaining}</span>
            <span className="text-amber-400/70 text-sm mb-1">/ {stats?.founder_slots_total}枠 残り</span>
          </div>
          <div className="w-full bg-amber-900/50 rounded-full h-2 mb-3">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="text-amber-400/80 text-xs">
            現在 <span className="text-amber-300 font-semibold">{registered}名</span> が登録済み
          </p>
        </>
      ) : (
        <div className="text-amber-400/60 text-sm">読み込み中...</div>
      )}
    </div>
  );
}

export default function LandingPageNew() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    axios.get("/api/public/stats")
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  const founderFull = stats ? stats.founder_slots_remaining === 0 : false;

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={18} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">LeadHive</span>
            <span className="ml-2 text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Early Access</span>
          </div>
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

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(59,130,246,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(245,158,11,0.06),transparent)] pointer-events-none" />

        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-700/40 text-blue-300 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 uppercase tracking-widest">
                <Sparkles size={12} />
                Phase 0 アーリーアクセス受付中
              </div>

              <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                営業リストを、
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  全自動でつくる。
                </span>
              </h1>

              <p className="text-lg text-slate-400 max-w-xl mb-8 leading-relaxed">
                LeadHiveはBtoB営業先の収集・スコアリング・進捗管理を一元化したSaaSです。
                今なら<span className="text-amber-400 font-semibold">先着50社限定のFounderプラン</span>で、
                将来の有料機能を段階的な優待価格で使い続けられます。
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-blue-900/40"
                >
                  <Sparkles size={16} />
                  アーリーアクセスに参加する
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/roadmap"
                  className="flex items-center justify-center gap-2 text-slate-400 hover:text-white px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors text-sm"
                >
                  <Map size={15} />
                  ロードマップを見る
                  <ChevronRight size={14} />
                </Link>
              </div>

              <p className="text-xs text-slate-600 mt-4">
                クレジットカード不要 · 会社名・電話番号で登録 · 審査あり
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <SlotCounter stats={stats} />

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 max-w-sm w-full">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Founderメンバー特典</p>
                {FOUNDER_BENEFITS.map((b, i) => (
                  <div key={b.period} className={`flex items-center justify-between py-2.5 ${i < FOUNDER_BENEFITS.length - 1 ? "border-b border-slate-800" : ""}`}>
                    <span className="text-sm text-slate-400">{b.period}</span>
                    <span className={`text-sm font-bold ${b.highlight ? "text-amber-400" : "text-slate-200"}`}>{b.benefit}</span>
                  </div>
                ))}
                {founderFull && (
                  <div className="mt-3 text-center text-xs text-rose-400 font-semibold bg-rose-950/50 rounded-lg px-3 py-2">
                    Founder枠は終了しました（通常登録は引き続き可能）
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 0 - Available vs Coming */}
      <section className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-400 font-semibold text-xs mb-2 uppercase tracking-widest">Phase 0 アーリーアクセス</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              今すぐ使える機能と<br />もうすぐ来る機能
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">
              Phase 0期間中（アーリーアクセス）は以下の機能が利用可能です。有料プランのリリースに合わせて順次開放されます。
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Available Now */}
            <div className="bg-slate-900 border border-emerald-800/40 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-emerald-900 flex items-center justify-center">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                </div>
                <span className="font-bold text-emerald-400 text-sm">今すぐ利用可能</span>
              </div>
              <ul className="space-y-3">
                {AVAILABLE_NOW.map(f => (
                  <li key={f.label} className="flex items-center gap-3">
                    <span className={`flex-shrink-0 ${f.color}`}>{f.icon}</span>
                    <span className="text-slate-200 text-sm">{f.label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-slate-800">
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  今すぐ始める
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Clock size={15} className="text-slate-400" />
                </div>
                <span className="font-bold text-slate-400 text-sm">有料プランで順次解放</span>
              </div>
              <ul className="space-y-3">
                {COMING_SOON.map(f => (
                  <li key={f.label} className="flex items-center gap-3">
                    <span className="flex-shrink-0 text-slate-600">
                      <Lock size={14} />
                    </span>
                    <span className="text-slate-500 text-sm flex-1">{f.label}</span>
                    <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full whitespace-nowrap">{f.tier}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-slate-800">
                <Link
                  to="/roadmap"
                  className="flex items-center justify-center gap-2 w-full border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
                >
                  <Map size={14} />
                  ロードマップ全体を見る
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why early access */}
      <section className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-amber-400 font-semibold text-xs mb-2 uppercase tracking-widest">アーリーアクセスに参加する理由</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              今登録することで<br />得られる3つの価値
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                title: "Founderプランで永続優待",
                body: "先着50社はFounderメンバーとして永続的な料金優待を受けられます。1年目無料、2年目以降も80%〜50%オフが永続します。",
                color: "from-amber-600 to-amber-700",
                accent: "text-amber-400",
              },
              {
                num: "02",
                title: "製品開発への参加権",
                body: "アーリーユーザーの声を直接製品に反映します。欲しい機能・改善点をフィードバックし、理想の営業ツールを一緒に作り上げましょう。",
                color: "from-blue-600 to-blue-700",
                accent: "text-blue-400",
              },
              {
                num: "03",
                title: "競合他社より先に導入",
                body: "AI企業分析・自動収集・チームダッシュボードなど、有料リリース前から段階的に機能を先行体験。競合より早く営業を自動化できます。",
                color: "from-violet-600 to-violet-700",
                accent: "text-violet-400",
              },
            ].map(r => (
              <div key={r.num} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-600 transition-colors">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center text-white font-extrabold text-sm mb-4`}>
                  {r.num}
                </div>
                <h3 className={`font-bold text-lg mb-3 ${r.accent}`}>{r.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What is LeadHive */}
      <section className="py-20 px-6 border-t border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-blue-400 font-semibold text-xs mb-3 uppercase tracking-widest">LeadHiveとは</p>
              <h2 className="text-3xl font-extrabold text-white mb-5 leading-tight">
                BtoB営業リスト作成の<br />全工程を自動化するSaaS
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Google検索・Googleマップ・法人DB（gBizINFO）など6つのソースから営業先を自動収集。
                スコアリングで優先度を可視化し、進捗管理・AI分析・メール送信まで一元化します。
              </p>
              <ul className="space-y-2.5">
                {[
                  "6種類のソースから自動収集（Google・マップ・gBizINFO等）",
                  "100点満点のスマートスコアリングで優先度を即判定",
                  "GPT-4o-miniによる企業分析 ＋ Claudeによる営業メール自動生成",
                  "9段階カンバンパイプライン・チームダッシュボード・フォローアップ通知",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle2 size={15} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mini dashboard mock */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-600 ml-1">LeadHive — ダッシュボード</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: "収集済み", val: "3,214", color: "text-blue-400", bg: "bg-blue-950/50" },
                  { label: "Aランク", val: "187", color: "text-emerald-400", bg: "bg-emerald-950/50" },
                  { label: "アプローチ", val: "94", color: "text-violet-400", bg: "bg-violet-950/50" },
                  { label: "成約", val: "31", color: "text-amber-400", bg: "bg-amber-950/50" },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                    <p className="text-[10px] text-slate-500 mb-0.5">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 mb-2">ステータス別</p>
                <div className="flex gap-1.5 overflow-x-auto">
                  {[
                    { s: "未確認", n: 52, c: "bg-slate-700" },
                    { s: "対象候補", n: 38, c: "bg-blue-900/60" },
                    { s: "フォーム送信済", n: 20, c: "bg-indigo-900/60" },
                    { s: "返信あり", n: 14, c: "bg-violet-900/60" },
                    { s: "代理店化", n: 31, c: "bg-emerald-900/60" },
                  ].map(col => (
                    <div key={col.s} className={`${col.c} rounded-lg px-2 py-1.5 flex-shrink-0 min-w-[52px]`}>
                      <p className="text-[9px] text-slate-400 truncate">{col.s}</p>
                      <p className="text-sm font-bold text-white">{col.n}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(59,130,246,0.1),transparent)] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-amber-950/60 border border-amber-700/40 text-amber-300 px-4 py-1.5 rounded-full text-xs font-bold mb-6 uppercase tracking-widest">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            先着50社限定 Founderプラン
          </div>

          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
            アーリーアクセスに<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              今すぐ参加する
            </span>
          </h2>

          <p className="text-slate-400 text-lg mb-4 max-w-xl mx-auto">
            登録には会社名・担当者名・電話番号が必要です。
            法人の場合は法人番号を入力すると会社情報を自動取得できます。
          </p>

          {stats && (
            <p className="text-amber-400 font-semibold mb-8">
              {stats.founder_slots_remaining > 0
                ? `残り ${stats.founder_slots_remaining} 枠 — Founderメンバー枠受付中`
                : "Founder枠は終了しました（通常登録は引き続き可能）"}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-colors shadow-2xl shadow-blue-900/40"
            >
              <Sparkles size={18} />
              アーリーアクセスに登録
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-white px-8 py-4 rounded-2xl border border-slate-700 hover:border-slate-500 transition-colors"
            >
              既にお持ちの方はログイン
            </Link>
          </div>

          <p className="text-slate-600 text-xs mt-6">
            法人・個人事業主・フリーランス歓迎 · 審査制 · アーリーアクセス期間中は無料
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-base">LeadHive</span>
            <span className="text-slate-600 text-sm">営業先リスト自動化ツール</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 justify-center">
            <Link to="/roadmap" className="hover:text-white transition-colors flex items-center gap-1">
              <Map size={13} />
              ロードマップ
            </Link>
            <Link to="/faq" className="hover:text-white transition-colors">よくある質問</Link>
            <Link to="/status" className="hover:text-white transition-colors">システム状況</Link>
            <Link to="/company" className="hover:text-white transition-colors">会社概要</Link>
            <Link to="/contact" className="hover:text-white transition-colors">お問い合わせ</Link>
            <Link to="/privacy-policy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
            <Link to="/terms" className="hover:text-white transition-colors">利用規約</Link>
            <Link to="/legal/tokutei" className="hover:text-white transition-colors">特定商取引法</Link>
            <Link to="/login" className="hover:text-white transition-colors">ログイン</Link>
            <Link to="/register" className="hover:text-white transition-colors">新規登録</Link>
          </div>
          <p className="text-slate-700 text-xs">© 2026 LeadHive / COOLWORKS株式会社</p>
        </div>
      </footer>
    </div>
  );
}
