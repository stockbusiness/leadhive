import { useEffect, useState } from "react";
import { FileText, Mail, Plus, Trash2, Lock, ShoppingCart, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { api } from "../api";
import type { MemoTemplate, EcTemplatePreset } from "../types";
import { useAuth } from "../contexts/AuthContext";

export default function Templates() {
  const { user } = useAuth();
  const isSystemAdmin = !!user?.is_system_admin;
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"memo" | "email">("memo");
  const [showEcPresets, setShowEcPresets] = useState(false);
  const [ecPresets, setEcPresets] = useState<EcTemplatePreset[]>([]);
  const [selectedEcPreset, setSelectedEcPreset] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importedPresets, setImportedPresets] = useState<Set<string>>(new Set());

  const fetchTemplates = () => {
    api.templates.list().then((data) => {
      setTemplates(data.templates);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (showEcPresets && ecPresets.length === 0) {
      api.templates.ecPresets().then((data) => {
        const all: EcTemplatePreset[] = data.presets;
        setEcPresets(all);
        if (all.length > 0) setSelectedEcPreset(all[0].id);
      });
    }
  }, [showEcPresets]);

  const isEmailTab = activeTab === "email";

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return;
    setAdding(true);
    api.templates.create({
      title: title.trim(),
      content: content.trim(),
      is_email_template: isEmailTab,
    }).then(() => {
      setTitle("");
      setContent("");
      setAdding(false);
      fetchTemplates();
    }).catch(() => setAdding(false));
  };

  const handleDelete = (id: number) => {
    if (confirm("このテンプレートを削除しますか？")) {
      api.templates.delete(id).then(() => fetchTemplates());
    }
  };

  const handleImportEcPreset = (preset: EcTemplatePreset) => {
    if (!isSystemAdmin) return;
    api.templates.create({
      title: preset.title,
      content: preset.content,
      is_email_template: preset.is_email,
    }).then(() => {
      setImportedPresets((prev) => new Set([...prev, preset.id]));
      fetchTemplates();
    });
  };

  const handleCopy = (preset: EcTemplatePreset) => {
    navigator.clipboard.writeText(`件名: ${preset.title}\n\n${preset.content}`).then(() => {
      setCopiedId(preset.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredTemplates = templates.filter(
    (t) => !!t.is_email_template === isEmailTab
  );

  const filteredEcPresets = ecPresets.filter((p) => p.is_email === isEmailTab);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <FileText size={24} />
        テンプレート管理
      </h2>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("memo")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "memo"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText size={16} />
          メモテンプレート
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "email"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Mail size={16} />
          メールテンプレート
        </button>
      </div>

      {/* ECプリセットパネル */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowEcPresets((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-700 text-sm">
            <ShoppingCart size={16} className="text-purple-500" />
            ECサイトオーナー向け　アプローチ文面プリセット
            <span className="text-xs font-normal text-slate-400 hidden sm:inline">— プラットフォーム別に最適化された文面</span>
          </span>
          {showEcPresets ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {showEcPresets && (
          <div className="border-t border-slate-200 p-4 space-y-4">
            {ecPresets.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">読み込み中...</p>
            ) : (
              <>
                {/* プリセットタブ */}
                <div className="flex flex-wrap gap-2">
                  {filteredEcPresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedEcPreset(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedEcPreset === p.id
                          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-300 hover:border-purple-400 hover:text-purple-600"
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                      {importedPresets.has(p.id) && <Check size={12} className="text-green-300" />}
                    </button>
                  ))}
                  {filteredEcPresets.length === 0 && (
                    <p className="text-xs text-slate-400 py-1">
                      このタブ用のプリセットはありません。{isEmailTab ? "メモ" : "メール"}タブをご確認ください。
                    </p>
                  )}
                </div>
                {/* 選択プリセットの内容 */}
                {selectedEcPreset && (() => {
                  const preset = filteredEcPresets.find((p) => p.id === selectedEcPreset)
                    ?? ecPresets.find((p) => p.id === selectedEcPreset);
                  if (!preset) return null;
                  return (
                    <div className="bg-purple-50 rounded-lg border border-purple-100 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-purple-100/60 border-b border-purple-100">
                        <div>
                          <p className="text-sm font-semibold text-purple-800">{preset.icon} {preset.label}</p>
                          <p className="text-xs text-purple-500 mt-0.5">対象: {preset.platform}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(preset)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-600 border border-slate-300 hover:border-purple-400 hover:text-purple-600 transition-all"
                          >
                            {copiedId === preset.id ? <><Check size={13} className="text-green-500" /> コピー済み</> : <><Copy size={13} /> コピー</>}
                          </button>
                          {isSystemAdmin ? (
                            <button
                              onClick={() => handleImportEcPreset(preset)}
                              disabled={importedPresets.has(preset.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                importedPresets.has(preset.id)
                                  ? "bg-green-100 text-green-700 border border-green-300 cursor-default"
                                  : "bg-purple-600 text-white hover:bg-purple-700"
                              }`}
                            >
                              {importedPresets.has(preset.id) ? <><Check size={13} /> 登録済み</> : <><Plus size={13} /> テンプレートに追加</>}
                            </button>
                          ) : (
                            <button
                              onClick={() => window.dispatchEvent(new CustomEvent("plan-limit-exceeded", { detail: { message: "テンプレートの追加は有料プランで利用できます。" } }))}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200"
                            >
                              <Lock size={13} /> 有料プランで追加
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <p className="text-xs font-medium text-slate-500">件名:</p>
                        <p className="text-sm text-slate-700 bg-white rounded-md border border-purple-200 px-3 py-2">{preset.title}</p>
                        <p className="text-xs font-medium text-slate-500 mt-3">本文:</p>
                        <pre className="text-sm text-slate-700 bg-white rounded-md border border-purple-200 px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed">{preset.content}</pre>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700">
            {isEmailTab ? "新規メールテンプレート追加" : "新規メモテンプレート追加"}
          </h3>
          {!isSystemAdmin && (
            <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
              <Lock size={11} />
              有料プランで解放
            </span>
          )}
        </div>
        {isSystemAdmin ? (
          <>
            {isEmailTab && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3 text-xs text-blue-700">
                <p className="font-medium mb-1">利用可能な変数:</p>
                <p>{"{会社名}"} {"{担当者名}"} {"{メールアドレス}"} {"{電話番号}"} {"{都道府県}"} {"{市区町村}"} {"{WebサイトURL}"}</p>
                <p className="mt-1 text-blue-500">※ タイトルはメールの件名として使用されます</p>
              </div>
            )}
            <div className="space-y-3">
              <input
                type="text"
                placeholder={isEmailTab ? "件名テンプレート（例：{会社名} 様へのご提案）" : "テンプレート名（例：初回アプローチ）"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder={isEmailTab ? "メール本文（例：{会社名} {担当者名}様\n\nお世話になっております。）" : "テンプレート内容（例：○月○日 初回メール送信。担当者名:____）"}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={isEmailTab ? 6 : 3}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !title.trim() || !content.trim()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
                {adding ? "追加中..." : "追加"}
              </button>
            </div>
          </>
        ) : (
          <div
            onClick={() => window.dispatchEvent(new CustomEvent("plan-limit-exceeded", { detail: { message: "テンプレートの追加・編集は有料プランで利用できます。" } }))}
            className="flex items-center gap-3 bg-slate-50 border border-slate-200 border-dashed rounded-lg px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <Lock size={16} className="text-slate-400" />
            <span className="text-sm text-slate-500">有料プランにアップグレードするとテンプレートを作成・編集できます</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-1">
                  {isEmailTab ? "メールテンプレートがありません" : "メモテンプレートがありません"}
                </p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {isEmailTab
                    ? "上のフォームからメール件名・本文を登録しておくと、一括送信時に呼び出せます"
                    : "よく使うメモのひな形を登録しておくと、企業ページから素早く入力できます"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          filteredTemplates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-800">{t.title}</h4>
                    {isEmailTab && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">件名</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{t.content}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("ja-JP") : ""}
                  </p>
                </div>
                {isSystemAdmin ? (
                  <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 p-1 ml-3" title="削除">
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("plan-limit-exceeded", { detail: { message: "テンプレートの削除は有料プランで利用できます。" } }))}
                    className="text-slate-300 p-1 ml-3 cursor-not-allowed"
                    title="削除（ロック中）"
                  >
                    <Lock size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
