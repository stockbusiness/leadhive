import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useProject } from "../contexts/ProjectContext";
import type { Project } from "../types";
import {
  Plus, Pencil, Trash2, X, Save, FolderKanban,
} from "lucide-react";

interface EditForm {
  name: string;
  description: string;
  industry: string;
  categories: string[];
  category_keywords: Record<string, string[]>;
  flag_definitions: Record<string, string[]>;
  scoring_rules: Record<string, number>;
}

const EMPTY_FORM: EditForm = {
  name: "",
  description: "",
  industry: "",
  categories: [],
  category_keywords: {},
  flag_definitions: {},
  scoring_rules: {},
};

export default function Projects() {
  const { refreshProjects } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EditForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "categories" | "flags" | "scoring">("basic");

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.projects.list();
      setProjects(data.projects);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setShowCreate(true);
    setEditingId(null);
    setActiveTab("basic");
  };

  const openEdit = (p: Project) => {
    setForm({
      name: p.name,
      description: p.description,
      industry: p.industry,
      categories: p.categories || [],
      category_keywords: p.category_keywords || {},
      flag_definitions: p.flag_definitions || {},
      scoring_rules: p.scoring_rules || {},
    });
    setEditingId(p.id);
    setShowCreate(true);
    setActiveTab("basic");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.projects.update(editingId, form);
      } else {
        await api.projects.create(form);
      }
      setShowCreate(false);
      setEditingId(null);
      await loadProjects();
      await refreshProjects();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await api.projects.delete(id);
      if (res.error) {
        alert(res.error);
        return;
      }
      await loadProjects();
      await refreshProjects();
    } catch {
    }
    setDeleteConfirm(null);
  };

  const addCategory = () => {
    const name = prompt("カテゴリ名を入力");
    if (!name?.trim()) return;
    setForm((f) => ({
      ...f,
      categories: [...f.categories, name.trim()],
      category_keywords: { ...f.category_keywords, [name.trim()]: [] },
    }));
  };

  const removeCategory = (cat: string) => {
    setForm((f) => {
      const newKw = { ...f.category_keywords };
      delete newKw[cat];
      return {
        ...f,
        categories: f.categories.filter((c) => c !== cat),
        category_keywords: newKw,
      };
    });
  };

  const addKeywordToCategory = (cat: string) => {
    const kw = prompt(`「${cat}」にキーワードを追加`);
    if (!kw?.trim()) return;
    setForm((f) => ({
      ...f,
      category_keywords: {
        ...f.category_keywords,
        [cat]: [...(f.category_keywords[cat] || []), kw.trim()],
      },
    }));
  };

  const removeKeywordFromCategory = (cat: string, kw: string) => {
    setForm((f) => ({
      ...f,
      category_keywords: {
        ...f.category_keywords,
        [cat]: (f.category_keywords[cat] || []).filter((k) => k !== kw),
      },
    }));
  };

  const addFlag = () => {
    const name = prompt("フラグ名を入力（例: shopify_flag）");
    if (!name?.trim()) return;
    setForm((f) => ({
      ...f,
      flag_definitions: { ...f.flag_definitions, [name.trim()]: [] },
    }));
  };

  const removeFlag = (flag: string) => {
    setForm((f) => {
      const newFlags = { ...f.flag_definitions };
      delete newFlags[flag];
      return { ...f, flag_definitions: newFlags };
    });
  };

  const addKeywordToFlag = (flag: string) => {
    const kw = prompt(`「${flag}」にキーワードを追加`);
    if (!kw?.trim()) return;
    setForm((f) => ({
      ...f,
      flag_definitions: {
        ...f.flag_definitions,
        [flag]: [...(f.flag_definitions[flag] || []), kw.trim()],
      },
    }));
  };

  const removeKeywordFromFlag = (flag: string, kw: string) => {
    setForm((f) => ({
      ...f,
      flag_definitions: {
        ...f.flag_definitions,
        [flag]: (f.flag_definitions[flag] || []).filter((k) => k !== kw),
      },
    }));
  };

  const addScoringRule = () => {
    const name = prompt("スコア項目名を入力");
    if (!name?.trim()) return;
    const pointsStr = prompt("ポイント数を入力（マイナスも可）", "10");
    const points = Number(pointsStr);
    if (isNaN(points)) return;
    setForm((f) => ({
      ...f,
      scoring_rules: { ...f.scoring_rules, [name.trim()]: points },
    }));
  };

  const removeScoringRule = (key: string) => {
    setForm((f) => {
      const newRules = { ...f.scoring_rules };
      delete newRules[key];
      return { ...f, scoring_rules: newRules };
    });
  };

  const updateScoringPoints = (key: string, value: number) => {
    setForm((f) => ({
      ...f,
      scoring_rules: { ...f.scoring_rules, [key]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderKanban className="text-blue-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">プロジェクト管理</h1>
            <p className="text-sm text-slate-500">プロジェクトごとに収集対象やスコアリング基準を設定</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          <Plus size={16} />新規プロジェクト
        </button>
      </div>

      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-800">{p.name}</h3>
                {p.industry && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{p.industry}</span>
                )}
                <span className="text-xs text-slate-400">{p.company_count ?? 0}社</span>
              </div>
              {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {(p.categories || []).slice(0, 6).map((cat) => (
                  <span key={cat} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{cat}</span>
                ))}
                {(p.categories || []).length > 6 && (
                  <span className="text-[11px] text-slate-400">+{(p.categories || []).length - 6}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button onClick={() => openEdit(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                <Pencil size={16} />
              </button>
              {deleteConfirm === p.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDelete(p.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded">削除</button>
                  <button onClick={() => setDeleteConfirm(null)} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">取消</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? "プロジェクト編集" : "新規プロジェクト作成"}
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b">
              {(
                [
                  { key: "basic", label: "基本情報" },
                  { key: "categories", label: "カテゴリ" },
                  { key: "flags", label: "フラグ定義" },
                  { key: "scoring", label: "スコアリング" },
                ] as { key: typeof activeTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "basic" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">プロジェクト名 *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="例: EC代理店候補"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">説明</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      rows={3}
                      placeholder="プロジェクトの説明"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">対象業種</label>
                    <input
                      value={form.industry}
                      onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="例: EC/通販, Web制作"
                    />
                  </div>
                </div>
              )}

              {activeTab === "categories" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">カテゴリとキーワードの定義</p>
                    <button onClick={addCategory} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                      <Plus size={14} />カテゴリ追加
                    </button>
                  </div>
                  {form.categories.map((cat) => (
                    <div key={cat} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm text-slate-800">{cat}</h4>
                        <div className="flex gap-1">
                          <button onClick={() => addKeywordToCategory(cat)} className="text-xs text-blue-600 hover:text-blue-700">+キーワード</button>
                          <button onClick={() => removeCategory(cat)} className="text-xs text-red-500 hover:text-red-600 ml-2">削除</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(form.category_keywords[cat] || []).map((kw) => (
                          <span key={kw} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded">
                            {kw}
                            <button onClick={() => removeKeywordFromCategory(cat, kw)} className="text-slate-400 hover:text-red-500">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        {(form.category_keywords[cat] || []).length === 0 && (
                          <span className="text-xs text-slate-400">キーワード未設定</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {form.categories.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">カテゴリがありません。新規作成時はデフォルトが適用されます。</p>
                  )}
                </div>
              )}

              {activeTab === "flags" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">フラグとキーワードの定義</p>
                    <button onClick={addFlag} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                      <Plus size={14} />フラグ追加
                    </button>
                  </div>
                  {Object.entries(form.flag_definitions).map(([flag, keywords]) => (
                    <div key={flag} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm text-slate-800">{flag}</h4>
                        <div className="flex gap-1">
                          <button onClick={() => addKeywordToFlag(flag)} className="text-xs text-blue-600 hover:text-blue-700">+キーワード</button>
                          <button onClick={() => removeFlag(flag)} className="text-xs text-red-500 hover:text-red-600 ml-2">削除</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {keywords.map((kw) => (
                          <span key={kw} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded">
                            {kw}
                            <button onClick={() => removeKeywordFromFlag(flag, kw)} className="text-slate-400 hover:text-red-500">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "scoring" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">スコアリング基準（各項目のポイント）</p>
                    <button onClick={addScoringRule} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                      <Plus size={14} />項目追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(form.scoring_rules).map(([key, points]) => (
                      <div key={key} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                        <span className="flex-1 text-sm text-slate-700">{key}</span>
                        <input
                          type="number"
                          value={points}
                          onChange={(e) => updateScoringPoints(key, Number(e.target.value))}
                          className="w-20 border rounded px-2 py-1 text-sm text-center"
                        />
                        <span className="text-xs text-slate-400">pt</span>
                        <button onClick={() => removeScoringRule(key)} className="text-slate-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                <Save size={16} />{saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
