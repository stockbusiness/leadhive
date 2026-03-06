import { useState, useEffect } from "react";
import { X, Save, ExternalLink, History } from "lucide-react";
import { CATEGORIES, STATUSES } from "../../constants";
import { api } from "../../api";
import type { Company, StatusHistoryEntry, MemoTemplate } from "../../types";

const FLAG_LABELS = [
  ["shopify_flag", "Shopify対応"],
  ["ec_flag", "EC特化"],
  ["amazon_flag", "Amazon対応"],
  ["rakuten_flag", "楽天対応"],
  ["consulting_flag", "コンサル"],
  ["operation_flag", "運営代行"],
  ["production_flag", "制作対応"],
] as const;

export default function CompanyEditModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editData, setEditData] = useState<Partial<Company>>({ ...company });
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.companies.getHistory(company.id).then((data) => setStatusHistory(data.history));
    api.templates.list().then((data) => setTemplates(data.templates));
  }, [company.id]);

  const handleSave = () => {
    setSaving(true);
    api.companies.update(company.id, editData).then(() => {
      setSaving(false);
      onSaved();
    }).catch(() => setSaving(false));
  };

  const applyTemplate = (content: string) => {
    const current = editData.notes || "";
    setEditData({ ...editData, notes: current ? `${current}\n${content}` : content });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">企業詳細編集</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput label="会社名" value={editData.company_name || ""} onChange={(v) => setEditData({ ...editData, company_name: v })} />
            <FieldInput label="WebサイトURL" value={editData.website_url || ""} onChange={(v) => setEditData({ ...editData, website_url: v })} />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">問い合わせURL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editData.contact_url || ""}
                  onChange={(e) => setEditData({ ...editData, contact_url: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {editData.contact_url && (
                  <a
                    href={editData.contact_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded-md text-xs hover:bg-blue-600 whitespace-nowrap"
                  >
                    <ExternalLink size={12} />
                    開く
                  </a>
                )}
              </div>
            </div>
            <FieldInput label="メールアドレス" value={editData.email || ""} onChange={(v) => setEditData({ ...editData, email: v })} type="email" />
            <FieldInput label="都道府県" value={editData.prefecture || ""} onChange={(v) => setEditData({ ...editData, prefecture: v })} />
            <FieldInput label="市区町村" value={editData.city || ""} onChange={(v) => setEditData({ ...editData, city: v })} />
            <FieldInput label="電話番号" value={editData.phone || ""} onChange={(v) => setEditData({ ...editData, phone: v })} />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">カテゴリ</label>
              <select
                value={editData.category_main || ""}
                onChange={(e) => setEditData({ ...editData, category_main: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">未分類</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ステータス</label>
            <select
              value={editData.status || ""}
              onChange={(e) => setEditData({ ...editData, status: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">フラグ</label>
            <div className="flex flex-wrap gap-3">
              {FLAG_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editData[key]}
                    onChange={(e) => setEditData({ ...editData, [key]: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">スコア手動調整</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-30}
                max={30}
                value={editData.score_adjustment || 0}
                onChange={(e) => setEditData({ ...editData, score_adjustment: parseInt(e.target.value) })}
                className="flex-1"
              />
              <span className={`text-sm font-medium w-12 text-center ${
                (editData.score_adjustment || 0) > 0 ? "text-emerald-600" :
                (editData.score_adjustment || 0) < 0 ? "text-red-600" : "text-slate-600"
              }`}>
                {(editData.score_adjustment || 0) > 0 ? "+" : ""}{editData.score_adjustment || 0}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">自動スコアに加減算されます（-30 ~ +30）</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600">メモ</label>
              {templates.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) applyTemplate(e.target.value);
                    e.target.value = "";
                  }}
                  className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">テンプレート挿入...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.content}>{t.title}</option>
                  ))}
                </select>
              )}
            </div>
            <textarea
              value={editData.notes || ""}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={3}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {statusHistory.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                <History size={12} />
                ステータス変更履歴
              </h4>
              <div className="bg-slate-50 rounded-md p-3 max-h-32 overflow-y-auto space-y-1.5">
                {statusHistory.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="text-slate-400 whitespace-nowrap">
                      {h.changed_at ? new Date(h.changed_at).toLocaleString("ja-JP") : ""}
                    </span>
                    <span className="bg-slate-200 px-1.5 py-0.5 rounded">{h.old_status}</span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{h.new_status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
