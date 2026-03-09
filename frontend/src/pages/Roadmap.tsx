import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Lock, Sparkles, ChevronRight, Users, Star, Rocket, Zap } from "lucide-react";
import axios from "axios";

interface PublicStats {
  registered_users: number;
  founder_slots_remaining: number;
  founder_slots_total: number;
}

const FEATURES_FREE = [
  "営業先の自動収集（Google検索・マップ・gBizINFO など6ソース）",
  "スマートスコアリング（A〜Dランク、100点満点）",
  "企業一覧・詳細閲覧・検索・フィルタリング",
  "キーワード管理・収集効率レポート",
  "プロジェクト分類（複数プロジェクト）",
  "9段階カンバンパイプライン（ドラッグ&ドロップ）",
  "営業活動ログ・ステータス管理",
  "フォローアップ通知（メール・Slack・アプリ内）",
  "AI企業分析・AIメール生成（月3回）",
  "問い合わせフォーム送信・手動送信記録",
  "ダッシュボード（収集・スコア概要）",
  "マスターDB（全プロジェクト横断管理）",
];

const FEATURES_STARTER = [
  "SMTPメール直接送信（配信停止リンク自動付与）",
  "AI企業分析・AIメール生成 無制限",
  "チームメンバー招待・管理（3名〜）",
  "チーム進捗ダッシュボード（担当者別活動分析）",
  "CSVエクスポート 無制限",
  "半自動メール生成スケジュール（毎日自動ドラフト）",
  "送信統計・監査ログ",
];

const FEATURES_UPCOMING = [
  "企業マスターデータベース（詳細非公開）",
  "その他、今後追加予定の機能（準備中）",
];

export default function Roadmap() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    axios.get("/api/public/stats")
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  const registered = stats?.registered_users ?? 0;
  const founderRemaining = stats?.founder_slots_remaining ?? 50;
  const isFounderSlotsLeft = founderRemaining > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-4">
          <Link to="/" className="text-slate-400 hover:text-white text-sm flex items-center gap-1">
            ← LeadHive トップへ
          </Link>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 text-emerald-300 text-sm font-medium mb-6">
            <Rocket size={14} />
            全機能 リリース済み
          </div>
          <h1 className="text-4xl font-bold mb-4">機能ロードマップ</h1>
          <p className="text-slate-400 text-lg">
            LeadHiveの全機能がリリースされました。現在はアーリーアクセス期間中につきFounderプランで無料ご利用いただけます。
          </p>
        </div>

        {stats && (
          <div className="bg-slate-800 rounded-2xl p-6 mb-10 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-400" />
                <span className="font-semibold">現在の登録者数</span>
              </div>
              <span className="text-2xl font-bold text-blue-400">{registered.toLocaleString()}名</span>
            </div>

            {isFounderSlotsLeft ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={16} className="text-amber-400" />
                  <span className="text-amber-300 font-semibold text-sm">Founderプラン残り {founderRemaining} 枠</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-amber-400 h-2 rounded-full transition-all"
                    style={{ width: `${((50 - founderRemaining) / 50) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">{50 - founderRemaining}/50 枠が埋まっています</p>
              </div>
            ) : (
              <div className="bg-slate-700 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-sm">Founderプラン（先着50名）は満員になりました</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Star size={20} className="text-amber-400" />
            <h2 className="text-lg font-bold text-amber-300">Founder特典（先着50名）</h2>
          </div>
          <div className="space-y-3">
            {[
              { year: "1年目", benefit: "全機能 完全無料", highlight: true },
              { year: "2年目", benefit: "80%オフ（永続）", highlight: false },
              { year: "3年目以降", benefit: "50%オフ（永続）", highlight: false },
            ].map(({ year, benefit, highlight }) => (
              <div key={year} className={`flex items-center justify-between rounded-xl px-4 py-3 ${highlight ? "bg-amber-500/20 border border-amber-500/40" : "bg-slate-800"}`}>
                <span className="text-sm text-slate-300">{year}</span>
                <span className={`font-bold text-sm ${highlight ? "text-amber-300" : "text-white"}`}>{benefit}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">※ Founderプランは有料プランリリース時に自動適用されます</p>
        </div>

        <div className="space-y-6">
          <FeatureSection
            icon={<CheckCircle size={20} className="text-emerald-400" />}
            title="フリープランで利用可能"
            badge="無料"
            badgeColor="bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
            borderColor="border-emerald-500/20"
            features={FEATURES_FREE}
            locked={false}
          />

          <FeatureSection
            icon={<Zap size={20} className="text-blue-400" />}
            title="スターター以上で利用可能"
            badge="スターター〜"
            badgeColor="bg-blue-500/20 text-blue-300 border-blue-500/30"
            borderColor="border-blue-500/20"
            features={FEATURES_STARTER}
            locked={true}
          />

          <FeatureSection
            icon={<Sparkles size={20} className="text-slate-400" />}
            title="開発中（詳細未定）"
            badge="近日公開"
            badgeColor="bg-slate-500/20 text-slate-400 border-slate-500/30"
            borderColor="border-slate-700"
            features={FEATURES_UPCOMING}
            locked={true}
            dimmed={true}
          />
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold mb-3">アーリーアクセスに登録する</h2>
          <p className="text-slate-400 text-sm mb-6">
            今すぐ登録して企業収集を始めましょう。{isFounderSlotsLeft && `先着50名のFounderプランにはあと${founderRemaining}枠あります。`}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/register"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              無料で始める
              <ChevronRight size={16} />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white px-6 py-3 rounded-xl transition-colors"
            >
              ログイン
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-8">
          機能の追加・変更が行われる場合があります。
        </p>
      </div>
    </div>
  );
}

function FeatureSection({
  icon, title, badge, badgeColor, borderColor, features, locked, dimmed = false,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeColor: string;
  borderColor: string;
  features: string[];
  locked: boolean;
  dimmed?: boolean;
}) {
  return (
    <div className={`bg-slate-800/50 border ${borderColor} rounded-2xl p-6 ${dimmed ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-bold text-base">{title}</h3>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full border ${badgeColor}`}>{badge}</span>
      </div>
      <ul className="space-y-2">
        {features.map((f) => (
          <li key={f} className={`flex items-center gap-2 text-sm ${locked ? "text-slate-500" : "text-slate-300"}`}>
            {locked ? (
              <Lock size={13} className="text-slate-600 flex-shrink-0" />
            ) : (
              <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
            )}
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
