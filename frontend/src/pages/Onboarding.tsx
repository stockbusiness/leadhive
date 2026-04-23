import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api";
import {
  CheckCircle, ChevronRight, ChevronLeft, X, Building2, FolderKanban,
  Search, Sparkles, Globe, BarChart2, Users, Zap, Loader2, Plus,
} from "lucide-react";

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [orgName, setOrgName] = useState(user?.org_name || "");
  const [orgNameSaving, setOrgNameSaving] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectCreated, setProjectCreated] = useState(false);

  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsSaving, setKeywordsSaving] = useState(false);
  const [keywordsSaved, setKeywordsSaved] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.onboarding_completed) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user?.org_name) setOrgName(user.org_name);
  }, [user?.org_name]);

  const progress = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);

  const handleOrgNameNext = async () => {
    if (!orgName.trim()) { setError("組織名を入力してください"); return; }
    setError("");
    setOrgNameSaving(true);
    try {
      await api.onboarding.updateOrgName(orgName.trim());
      updateUser({ org_name: orgName.trim() });
      setStep(3);
    } catch (e: any) {
      setError(e.response?.data?.detail || "更新に失敗しました");
    }
    setOrgNameSaving(false);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) { setError("プロジェクト名を入力してください"); return; }
    setError("");
    setProjectSaving(true);
    try {
      await api.projects.create({ name: projectName.trim() });
      setProjectCreated(true);
      setTimeout(() => setStep(4), 600);
    } catch (e: any) {
      setError(e.response?.data?.detail || "作成に失敗しました");
    }
    setProjectSaving(false);
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) setKeywords((prev) => [...prev, kw]);
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw));

  const handleSaveKeywords = async () => {
    if (keywords.length === 0) { setStep(5); return; }
    setError("");
    setKeywordsSaving(true);
    try {
      for (const kw of keywords) {
        await api.keywords.create({ keyword: kw, is_active: true });
      }
      setKeywordsSaved(true);
      setTimeout(() => setStep(5), 600);
    } catch (e: any) {
      setError(e.response?.data?.detail || "保存に失敗しました");
    }
    setKeywordsSaving(false);
  };

  const handleComplete = async (dest: string) => {
    setCompleting(true);
    try {
      await api.onboarding.complete();
      updateUser({ onboarding_completed: true });
      navigate(dest, { replace: true });
    } catch {
      updateUser({ onboarding_completed: true });
      navigate(dest, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <span className="text-white text-2xl font-bold tracking-tight">LeadHive</span>
          <p className="text-slate-400 text-sm mt-1">初期設定ウィザード</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`transition-all duration-300 rounded-full ${
              i + 1 < step ? "w-6 h-6 bg-blue-500 flex items-center justify-center" :
              i + 1 === step ? "w-6 h-6 bg-blue-500 ring-4 ring-blue-500/30" :
              "w-3 h-3 bg-slate-700"
            }`}>
              {i + 1 < step && <CheckCircle size={14} className="text-white" />}
            </div>
          ))}
        </div>

        <div className="w-full bg-slate-700/50 rounded-full h-1 mb-6">
          <div
            className="h-1 bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border-b border-red-100 px-5 py-3">
              <X size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {step === 1 && <StepWelcome onNext={() => setStep(2)} />}
          {step === 2 && (
            <StepOrgName
              orgName={orgName}
              setOrgName={setOrgName}
              saving={orgNameSaving}
              onNext={handleOrgNameNext}
            />
          )}
          {step === 3 && (
            <StepProject
              projectName={projectName}
              setProjectName={setProjectName}
              saving={projectSaving}
              done={projectCreated}
              onNext={handleCreateProject}
              onSkip={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <StepKeywords
              keywordInput={keywordInput}
              setKeywordInput={setKeywordInput}
              keywords={keywords}
              onAdd={addKeyword}
              onRemove={removeKeyword}
              saving={keywordsSaving}
              done={keywordsSaved}
              onNext={handleSaveKeywords}
              onSkip={() => setStep(5)}
            />
          )}
          {step === 5 && (
            <StepDone
              completing={completing}
              keywords={keywords}
              projectName={projectName}
              onDashboard={() => handleComplete("/")}
              onScraper={() => handleComplete("/scraper")}
              registrationNumber={user?.registration_number ?? null}
              isFounder={!!user?.is_founder}
            />
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-4">
          {step < 5 && (
            <button onClick={() => handleComplete("/")} className="hover:text-slate-300 transition-colors">
              スキップしてダッシュボードへ →
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles size={28} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">LeadHiveへようこそ！</h2>
        <p className="text-slate-500 text-sm mt-2">数分で初期設定を完了し、営業先収集をスタートしましょう</p>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-8">
        {[
          { icon: <Globe size={18} className="text-blue-600" />, title: "自動収集", desc: "Google検索・法人DBから企業を自動収集" },
          { icon: <BarChart2 size={18} className="text-emerald-600" />, title: "スコアリング", desc: "AIが企業の営業優先度を自動評価" },
          { icon: <Users size={18} className="text-purple-600" />, title: "チーム管理", desc: "進捗・アサインをチームで共有" },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              {f.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">{f.title}</p>
              <p className="text-xs text-slate-500">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        はじめる <ChevronRight size={18} />
      </button>
    </div>
  );
}

function StepOrgName({
  orgName, setOrgName, saving, onNext,
}: { orgName: string; setOrgName: (v: string) => void; saving: boolean; onNext: () => void }) {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Building2 size={20} className="text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">ステップ 2 / 6</p>
          <h2 className="text-xl font-bold text-slate-800">組織名を確認</h2>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        レポートや共有画面に表示される組織名を確認・変更できます。
      </p>
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">組織名・会社名</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          autoFocus
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="株式会社〇〇"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onNext}
          disabled={saving || !orgName.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={18} />}
          次へ
        </button>
      </div>
    </div>
  );
}

function StepProject({
  projectName, setProjectName, saving, done, onNext, onSkip,
}: {
  projectName: string; setProjectName: (v: string) => void;
  saving: boolean; done: boolean; onNext: () => void; onSkip: () => void;
}) {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <FolderKanban size={20} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">ステップ 3 / 6</p>
          <h2 className="text-xl font-bold text-slate-800">最初のプロジェクトを作成</h2>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        収集した企業リストはプロジェクトで管理します。複数の営業案件や顧客セグメントごとに分けられます。
      </p>
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">プロジェクト名</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          autoFocus
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 新規顧客開拓 / 関東エリア IT企業"
          onKeyDown={(e) => e.key === "Enter" && onNext()}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {["新規顧客開拓", "関東 Web制作会社", "IT企業アプローチ", "Shopify案件"].map((ex) => (
            <button
              key={ex}
              onClick={() => setProjectName(ex)}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-full transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      {done && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl p-3 mb-4 text-sm">
          <CheckCircle size={16} /> プロジェクトを作成しました
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onSkip} className="px-4 py-3 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          スキップ
        </button>
        <button
          onClick={onNext}
          disabled={saving || !projectName.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={18} />}
          作成して次へ
        </button>
      </div>
    </div>
  );
}

function StepKeywords({
  keywordInput, setKeywordInput, keywords, onAdd, onRemove, saving, done, onNext, onSkip,
}: {
  keywordInput: string; setKeywordInput: (v: string) => void;
  keywords: string[]; onAdd: () => void; onRemove: (kw: string) => void;
  saving: boolean; done: boolean; onNext: () => void; onSkip: () => void;
}) {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Search size={20} className="text-purple-600" />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium">ステップ 4 / 6</p>
          <h2 className="text-xl font-bold text-slate-800">検索キーワードを追加</h2>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        どんな企業を収集しますか？キーワードを登録しておくと、Google API検索で自動収集できます。
      </p>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          autoFocus
          className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: Web制作 会社 東京　（業種 + 会社種別 + 地域）"
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <button
          onClick={onAdd}
          disabled={!keywordInput.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
        {keywords.map((kw) => (
          <span key={kw} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm">
            {kw}
            <button onClick={() => onRemove(kw)} className="hover:text-blue-600 ml-1">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="bg-slate-50 rounded-xl p-3 mb-3">
        <p className="text-xs text-slate-400 mb-2 font-medium">入力例をクリックして使えます：</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            "Web制作 会社 東京", "システム開発 会社 大阪",
            "コンサルティング 中小企業", "Webマーケティング 会社",
            "人材紹介 会社 名古屋", "Shopify 制作会社",
            "EC コンサル", "不動産会社 福岡",
          ].map((ex) => (
            <button
              key={ex}
              onClick={() => setKeywordInput(ex)}
              className="text-xs px-3 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 rounded-lg transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      {done && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl p-3 mb-4 text-sm">
          <CheckCircle size={16} /> キーワードを保存しました
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onSkip} className="px-4 py-3 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          スキップ
        </button>
        <button
          onClick={onNext}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={18} />}
          {keywords.length > 0 ? `${keywords.length}件保存して次へ` : "次へ"}
        </button>
      </div>
    </div>
  );
}

function StepDone({
  completing, keywords, projectName, onDashboard, onScraper, registrationNumber, isFounder,
}: {
  completing: boolean; keywords: string[]; projectName: string;
  onDashboard: () => void; onScraper: () => void;
  registrationNumber: number | null; isFounder: boolean;
}) {
  const items = [
    { label: "組織名", done: true },
    { label: `プロジェクト${projectName ? `「${projectName}」` : ""}`, done: !!projectName },
    { label: `検索キーワード ${keywords.length > 0 ? `(${keywords.length}件)` : ""}`, done: keywords.length > 0 },
  ];

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce">
          <CheckCircle size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">セットアップ完了！</h2>
        <p className="text-slate-500 text-sm mt-2">LeadHiveを使い始める準備ができました</p>
      </div>

      {registrationNumber && (
        <div className={`rounded-2xl p-4 mb-6 text-center ${isFounder ? "bg-amber-50 border border-amber-200" : "bg-blue-50 border border-blue-200"}`}>
          <p className={`text-sm font-medium ${isFounder ? "text-amber-700" : "text-blue-700"}`}>
            あなたは <span className="text-2xl font-bold">{registrationNumber}</span> 番目のアーリーユーザーです
          </p>
          {isFounder && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-lg">🎉</span>
              <span className="text-sm font-bold text-amber-700">先着50名のFounderメンバーです！</span>
              <span className="text-lg">🎉</span>
            </div>
          )}
          {isFounder && (
            <p className="text-xs text-amber-600 mt-1">1年目完全無料、2年目80%オフ、3年目以降50%オフが永続適用されます</p>
          )}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2">
        <p className="text-xs font-medium text-slate-500 mb-2">セットアップ内容</p>
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            {item.done
              ? <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
              : <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />}
            <span className={item.done ? "text-slate-700" : "text-slate-400"}>{item.label}</span>
            {!item.done && <span className="text-xs text-slate-400 ml-auto">未設定</span>}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={onScraper}
          disabled={completing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {completing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={18} />}
          収集画面をつかってみる
        </button>
        <button
          onClick={onDashboard}
          disabled={completing}
          className="w-full border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <BarChart2 size={18} />
          ダッシュボードへ
        </button>
      </div>
    </div>
  );
}
