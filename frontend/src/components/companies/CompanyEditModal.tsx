import { useState, useEffect, useCallback } from "react";
import { X, Save, ExternalLink, History, Mail, RotateCw, Tag, Plus, Send, Copy, CheckCheck, ClipboardList, CalendarClock } from "lucide-react";
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

function replaceTemplateVars(text: string, company: Company): string {
  return text
    .replace(/\{会社名\}/g, company.company_name || "")
    .replace(/\{担当者名\}/g, "ご担当者")
    .replace(/\{メールアドレス\}/g, company.email || "")
    .replace(/\{電話番号\}/g, company.phone || "")
    .replace(/\{都道府県\}/g, company.prefecture || "")
    .replace(/\{市区町村\}/g, company.city || "")
    .replace(/\{WebサイトURL\}/g, company.website_url || "");
}

function buildMailtoLink(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const paramStr = params.toString();
  return `mailto:${encodeURIComponent(to)}${paramStr ? "?" + paramStr : ""}`;
}

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
  const [rescraping, setRescraping] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<string>("");

  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const [selectedFormTemplate, setSelectedFormTemplate] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string>("");
  const [formSendDone, setFormSendDone] = useState(false);
  const [formSending, setFormSending] = useState(false);

  useEffect(() => {
    api.companies.getHistory(company.id).then((data) => setStatusHistory(data.history));
    api.templates.list().then((data) => setTemplates(data.templates));
    api.companies.getTags(company.id).then((data) => setTags(data.tags.map((t) => t.tag_name)));
  }, [company.id]);

  const handleSave = () => {
    setSaving(true);
    api.companies.update(company.id, editData).then(() => {
      setSaving(false);
      onSaved();
    }).catch(() => setSaving(false));
  };

  const handleRescrape = () => {
    setRescraping(true);
    api.companies.rescrape(company.id).then((data: any) => {
      if (data.error) {
        alert(data.error);
      } else {
        setEditData({ ...data.company });
      }
      setRescraping(false);
    }).catch(() => {
      alert("再スクレイピングに失敗しました");
      setRescraping(false);
    });
  };

  const applyTemplate = (content: string) => {
    const current = editData.notes || "";
    setEditData({ ...editData, notes: current ? `${current}\n${content}` : content });
  };

  const handleAddTag = useCallback(async () => {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    await api.companies.addTag(company.id, trimmed);
    setTags((prev) => [...prev, trimmed]);
    setNewTag("");
  }, [newTag, tags, company.id]);

  const handleDeleteTag = useCallback(async (tagName: string) => {
    await api.companies.deleteTag(company.id, tagName);
    setTags((prev) => prev.filter((t) => t !== tagName));
  }, [company.id]);

  const memoTemplates = templates.filter((t) => !t.is_email_template);
  const emailTemplates = templates.filter((t) => t.is_email_template);
  const allTemplates = templates;

  const handleSendEmail = (template: MemoTemplate) => {
    const subject = replaceTemplateVars(template.title, company as Company);
    const body = replaceTemplateVars(template.content, company as Company);
    const to = company.email || "";
    const href = buildMailtoLink(to, subject, body);
    window.open(href, "_blank");
  };

  const copyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(""), 1500);
    });
  };

  const handleFormSendComplete = async () => {
    setFormSending(true);
    const tmpl = allTemplates.find((t) => String(t.id) === selectedFormTemplate);
    const description = tmpl
      ? `フォームから問い合わせ送信（テンプレート: ${tmpl.title}）`
      : "フォームから問い合わせ送信";
    try {
      await api.companies.createActivity(company.id, {
        action_type: "フォーム送信",
        description,
      });
      await api.companies.update(company.id, { status: "フォーム送信済" });
      setEditData((prev) => ({ ...prev, status: "フォーム送信済" }));
      setFormSendDone(true);
      setTimeout(() => setFormSendDone(false), 3000);
    } finally {
      setFormSending(false);
    }
  };

  const selectedFormTmpl = allTemplates.find((t) => String(t.id) === selectedFormTemplate);
  const formBody = selectedFormTmpl
    ? replaceTemplateVars(selectedFormTmpl.content, editData as Company)
    : "";

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

          <div className="flex items-end gap-4 flex-wrap">
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
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <CalendarClock size={12} />
                フォローアップ日
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={editData.follow_up_date || ""}
                  onChange={(e) => setEditData({ ...editData, follow_up_date: e.target.value || null })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {editData.follow_up_date && (
                  <button
                    onClick={() => setEditData({ ...editData, follow_up_date: null })}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="クリア"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
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
            <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
              <Tag size={12} />
              タグ
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">
                  {t}
                  <button onClick={() => handleDeleteTag(t)} className="hover:text-purple-900">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="タグを入力..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
                追加
              </button>
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
              {memoTemplates.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) applyTemplate(e.target.value);
                    e.target.value = "";
                  }}
                  className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">テンプレート挿入...</option>
                  {memoTemplates.map((t) => (
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

          {emailTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                <Mail size={12} />
                メール送信
              </label>
              <div className="bg-slate-50 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedEmailTemplate}
                    onChange={(e) => setSelectedEmailTemplate(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">メールテンプレートを選択...</option>
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={String(t.id)}>{t.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const tmpl = emailTemplates.find((t) => String(t.id) === selectedEmailTemplate);
                      if (tmpl) handleSendEmail(tmpl);
                    }}
                    disabled={!selectedEmailTemplate}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <Mail size={14} />
                    メール送信
                  </button>
                </div>
                {selectedEmailTemplate && (() => {
                  const tmpl = emailTemplates.find((t) => String(t.id) === selectedEmailTemplate);
                  if (!tmpl) return null;
                  const subject = replaceTemplateVars(tmpl.title, company as Company);
                  const body = replaceTemplateVars(tmpl.content, company as Company);
                  return (
                    <div className="text-xs text-slate-500 bg-white rounded border border-slate-200 p-2 space-y-1">
                      <p><span className="font-medium text-slate-600">宛先:</span> {company.email || "(未設定)"}</p>
                      <p><span className="font-medium text-slate-600">件名:</span> {subject}</p>
                      <p className="whitespace-pre-wrap"><span className="font-medium text-slate-600">本文:</span> {body}</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ===== フォーム送信サポート ===== */}
          <div className="border border-indigo-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2.5 border-b border-indigo-200">
              <Send size={14} className="text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700">フォーム送信サポート</span>
              <span className="text-xs text-indigo-500 ml-1">— 問い合わせフォームへの入力を補助します</span>
            </div>
            <div className="p-4 space-y-4">

              {/* ステップ1: フォームを開く */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">① 問い合わせページを開く</p>
                {editData.contact_url ? (
                  <a
                    href={editData.contact_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 transition-colors"
                  >
                    <ExternalLink size={14} />
                    問い合わせページを開く
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                    問い合わせURLが未設定です。上の「問い合わせURL」フィールドに入力してください。
                  </p>
                )}
              </div>

              {/* ステップ2: コピーボックス */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">② フォームに入力する内容をコピー</p>
                <div className="space-y-2">
                  <CopyRow
                    label="会社名"
                    value={editData.company_name || ""}
                    fieldKey="company_name"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                  <CopyRow
                    label="メールアドレス"
                    value={editData.email || ""}
                    fieldKey="email"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                  <CopyRow
                    label="電話番号"
                    value={editData.phone || ""}
                    fieldKey="phone"
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                  />
                </div>
              </div>

              {/* ステップ3: 本文テンプレート */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">③ 送信本文を選択してコピー（任意）</p>
                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedFormTemplate}
                    onChange={(e) => setSelectedFormTemplate(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">テンプレートを選択...</option>
                    {allTemplates.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.is_email_template ? "[メール]" : "[メモ]"} {t.title}
                      </option>
                    ))}
                  </select>
                  {selectedFormTemplate && formBody && (
                    <button
                      onClick={() => copyToClipboard(formBody, "form_body")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                        copiedField === "form_body"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {copiedField === "form_body" ? <CheckCheck size={14} /> : <Copy size={14} />}
                      {copiedField === "form_body" ? "コピー済み" : "本文をコピー"}
                    </button>
                  )}
                </div>
                {selectedFormTemplate && formBody && (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {formBody}
                  </div>
                )}
              </div>

              {/* ステップ4: 送信完了を記録 */}
              <div className="border-t border-indigo-100 pt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">④ 送信したら完了を記録（ステータスが「フォーム送信済」に更新されます）</p>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {formSendDone && (
                    <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                      <CheckCheck size={12} />
                      記録しました
                    </span>
                  )}
                  <button
                    onClick={handleFormSendComplete}
                    disabled={formSending || editData.status === "フォーム送信済"}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
                      editData.status === "フォーム送信済"
                        ? "bg-slate-100 text-slate-400 cursor-default"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    }`}
                  >
                    <ClipboardList size={14} />
                    {formSending ? "記録中..." : editData.status === "フォーム送信済" ? "送信済み" : "送信完了を記録"}
                  </button>
                </div>
              </div>
            </div>
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

        <div className="flex items-center justify-between p-5 border-t border-slate-200">
          <button
            onClick={handleRescrape}
            disabled={rescraping}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            <RotateCw size={14} className={rescraping ? "animate-spin" : ""} />
            {rescraping ? "スクレイピング中..." : "再スクレイピング"}
          </button>
          <div className="flex items-center gap-3">
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
    </div>
  );
}

function CopyRow({
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copiedField: string;
  onCopy: (text: string, key: string) => void;
}) {
  const isCopied = copiedField === fieldKey;
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-1.5">
      <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
      <span className="flex-1 text-sm text-slate-700 truncate">{value || <span className="text-slate-300">未設定</span>}</span>
      <button
        onClick={() => onCopy(value, fieldKey)}
        disabled={!value}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors flex-shrink-0 ${
          isCopied
            ? "bg-emerald-100 text-emerald-700"
            : value
            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
            : "bg-slate-50 text-slate-300 cursor-default"
        }`}
      >
        {isCopied ? <CheckCheck size={12} /> : <Copy size={12} />}
        {isCopied ? "コピー済み" : "コピー"}
      </button>
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
