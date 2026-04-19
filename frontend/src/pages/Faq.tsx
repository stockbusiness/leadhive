import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, ChevronDown, ChevronUp, Loader2, Search, ArrowLeft } from "lucide-react";
import { api } from "../api";
import PageMeta from "../components/PageMeta";

type FaqItem = {
  id: number;
  question: string;
  answer: string;
  category: string;
  category_label: string;
  display_order: number;
};

const CATEGORIES = [
  { value: "", label: "すべて" },
  { value: "general", label: "一般" },
  { value: "technical", label: "技術的な問題" },
  { value: "billing", label: "料金・プラン" },
  { value: "account", label: "アカウント" },
  { value: "other", label: "その他" },
];

export default function Faq() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    api.faq.list().then(setItems).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    const matchCat = !categoryFilter || item.category === categoryFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const grouped = CATEGORIES.slice(1).reduce<Record<string, FaqItem[]>>((acc, cat) => {
    const group = filtered.filter((i) => i.category === cat.value);
    if (group.length > 0) acc[cat.value] = group;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <PageMeta
        title="よくある質問（FAQ）"
        description="LeadHiveに関するよくある質問と回答。料金プラン・機能・アカウント・技術的な問題など、ご不明点をわかりやすく解説します。"
        path="/faq"
        schemaType="FAQPage"
        breadcrumbs={[{ name: "よくある質問", url: "/faq" }]}
        faqItems={items.map((i) => ({ question: i.question, answer: i.answer }))}
      />
      <header className="bg-slate-900 text-white py-16 px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-5">
          <HelpCircle size={28} />
        </div>
        <h1 className="text-3xl font-bold mb-2">よくある質問</h1>
        <p className="text-slate-400 text-base">LeadHiveに関する疑問・ご不明点を解決します</p>

        <div className="relative mt-8 max-w-lg mx-auto">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="キーワードで検索..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 text-white placeholder-slate-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategoryFilter(c.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                categoryFilter === c.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-base font-medium">該当するFAQが見つかりませんでした</p>
            <p className="text-sm mt-1">別のキーワードでお試しください</p>
          </div>
        ) : categoryFilter ? (
          <div className="space-y-2">
            {filtered.map((item) => (
              <FaqCard key={item.id} item={item} openId={openId} setOpenId={setOpenId} />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, group]) => {
              const catLabel = CATEGORIES.find((c) => c.value === cat)?.label || cat;
              return (
                <div key={cat}>
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{catLabel}</h2>
                  <div className="space-y-2">
                    {group.map((item) => (
                      <FaqCard key={item.id} item={item} openId={openId} setOpenId={setOpenId} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 mb-2">解決しませんでしたか？</h3>
          <p className="text-sm text-slate-500 mb-5">サポートチームが直接サポートいたします。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              to="/support"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              サポートチケットを作成
            </Link>
            <Link
              to="/contact"
              className="bg-white border border-slate-300 hover:border-blue-300 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              お問い合わせ
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={14} />
            トップに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

function FaqCard({ item, openId, setOpenId }: { item: FaqItem; openId: number | null; setOpenId: (id: number | null) => void }) {
  const isOpen = openId === item.id;
  return (
    <div className={`bg-white rounded-xl border transition-colors ${isOpen ? "border-blue-200 shadow-sm" : "border-slate-200"}`}>
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setOpenId(isOpen ? null : item.id)}
      >
        <span className="flex-1 text-sm font-semibold text-slate-800">{item.question}</span>
        {isOpen ? (
          <ChevronUp size={16} className="text-blue-500 flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 whitespace-pre-wrap">
          {item.answer}
        </div>
      )}
    </div>
  );
}
