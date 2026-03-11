import { useEffect, useState } from "react";
import { Mail, Save, RotateCcw, Loader2, Eye, EyeOff, ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "../api";

type TemplateVar = { var: string; desc: string };
type TemplateData = {
  label: string;
  description: string;
  fields: { subject: string; html: string; text: string };
  defaults: { subject: string; html: string; text: string };
  vars: TemplateVar[];
};

function VarBadge({ v }: { v: TemplateVar }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono mr-1 mb-1">
      <span className="text-blue-600">{v.var}</span>
      <span className="text-slate-400">— {v.desc}</span>
    </span>
  );
}

function TemplateEditor({
  id,
  tpl,
  onSaved,
}: {
  id: string;
  tpl: TemplateData;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(tpl.fields.subject);
  const [html, setHtml] = useState(tpl.fields.html);
  const [text, setText] = useState(tpl.fields.text);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewHtml, setPreviewHtml] = useState(false);
  const [showText, setShowText] = useState(false);

  const isDirty =
    subject !== tpl.fields.subject ||
    html !== tpl.fields.html ||
    text !== tpl.fields.text;

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.adminEmailTemplates.save(id, { subject, html, text });
      showSuccess("保存しました");
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("デフォルトのテンプレートに戻しますか？")) return;
    setResetting(true);
    setError("");
    try {
      await api.adminEmailTemplates.reset(id);
      setSubject(tpl.defaults.subject);
      setHtml(tpl.defaults.html);
      setText(tpl.defaults.text);
      showSuccess("デフォルトに戻しました");
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "リセットに失敗しました");
    } finally {
      setResetting(false);
    }
  };

  const renderPreview = () => {
    const sampleVars: Record<string, string> = {
      "{{verify_url}}": "https://leadhive.work/verify-email?token=sample",
      "{{user_email}}": "example@company.co.jp",
      "{{site_name}}": "LeadHive",
    };
    let rendered = html;
    for (const [k, v] of Object.entries(sampleVars)) {
      rendered = rendered.split(k).join(v);
    }
    return rendered;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Mail size={16} className="text-blue-600" />
            {tpl.label}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{tpl.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {resetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            デフォルトに戻す
          </button>
          <button
            onClick={save}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            保存
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
            <AlertTriangle size={14} />{error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5">
            <CheckCircle size={14} />{success}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">使用可能な変数</p>
          <div className="flex flex-wrap">
            {tpl.vars.map(v => <VarBadge key={v.var} v={v} />)}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">件名</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-slate-700">本文（HTML）</label>
            <button
              onClick={() => setPreviewHtml(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              {previewHtml ? <><EyeOff size={12} />編集に戻す</> : <><Eye size={12} />プレビュー</>}
            </button>
          </div>
          {previewHtml ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs text-slate-500">
                プレビュー（サンプル変数で描画）
              </div>
              <div
                className="p-4 min-h-40"
                dangerouslySetInnerHTML={{ __html: renderPreview() }}
              />
            </div>
          ) : (
            <textarea
              value={html}
              onChange={e => setHtml(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
              spellCheck={false}
            />
          )}
        </div>

        <div>
          <button
            onClick={() => setShowText(v => !v)}
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            {showText ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            プレーンテキスト版（HTMLが表示できない場合の代替）
          </button>
          {showText && (
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              className="mt-2 w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
              spellCheck={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<Record<string, TemplateData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.adminEmailTemplates.list();
      setTemplates(data);
    } catch {
      setError("テンプレートの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Mail size={24} className="text-blue-600" />
          メールテンプレート
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          システムから送信されるメールの件名・本文を編集できます。
          <code className="ml-1 px-1 bg-slate-100 rounded text-xs">{"{{変数名}}"}</code>
          形式でデータを差し込めます。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : templates ? (
        <div className="space-y-6">
          {Object.entries(templates).map(([id, tpl]) => (
            <TemplateEditor key={id} id={id} tpl={tpl} onSaved={load} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
