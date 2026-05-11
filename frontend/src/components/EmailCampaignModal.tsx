import { useState, useEffect, useRef } from "react";
import { X, Mail, Send, Info, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, Zap, Server, FileText } from "lucide-react";
import { STATUSES } from "../constants";
import { api } from "../api";

interface Company {
  id: number;
  company_name?: string;
  email?: string;
}

interface Props {
  companyIds: number[];
  companies: Company[];
  onClose: () => void;
  onDone?: (campaignId: number) => void;
}

interface ProgressEvent {
  type: "progress" | "done" | "error" | "info";
  current?: number;
  total?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  campaign_id?: number;
  company?: string;
  message?: string;
}

const VARIABLE_HINTS = [
  { var: "{{会社名}}", desc: "会社名" },
  { var: "{{URL}}", desc: "WebサイトURL" },
  { var: "{{担当者名}}", desc: "担当者名" },
  { var: "{{都道府県}}", desc: "都道府県" },
  { var: "{{市区町村}}", desc: "市区町村" },
  { var: "{{電話番号}}", desc: "電話番号" },
];

const EMAIL_TEMPLATES = [
  {
    label: "EC向け：サービス提案",
    subject: "{{会社名}} 様｜EC事業者向けサービスのご案内",
    body: `{{会社名}} ご担当者様

はじめてご連絡申し上げます。
株式会社〇〇の△△と申します。

{{会社名}} 様のECサイトを拝見し、ご連絡させていただきました。

弊社では、ECサイトオーナー様向けに〔サービス内容を記載〕をご提供しております。
売上向上・業務効率化に多くのEC事業者様にご活用いただいております。

もしよろしければ、詳細資料のご送付や、オンラインでのご説明の機会をいただけますでしょうか。

ご多忙のところ恐れ入りますが、何卒ご検討いただけますと幸いです。

━━━━━━━━━━━━━━━
株式会社〇〇
担当：△△
TEL：03-xxxx-xxxx
━━━━━━━━━━━━━━━

※ 配信停止をご希望の場合は、本メールにその旨ご返信ください。`,
  },
  {
    label: "初回アポイント依頼",
    subject: "【ご挨拶】{{会社名}} 様へ、お打ち合わせのお願い",
    body: `{{会社名}} ご担当者様

突然のご連絡失礼いたします。
〇〇株式会社の△△と申します。

この度、{{会社名}} 様のご事業に関心を持ち、ご連絡させていただきました。

弊社は〔会社・サービスの簡単な説明〕を行っております。
{{会社名}} 様のビジネスにお役立ていただける点があると考え、
一度お話しする機会をいただければ幸いです。

15〜30分程度のオンラインミーティングをご希望でしたら、
ご都合の良い日時をお知らせください。

どうぞよろしくお願いいたします。

━━━━━━━━━━━━━━━
〇〇株式会社
担当：△△
Email：contact@example.com
━━━━━━━━━━━━━━━`,
  },
  {
    label: "資料送付のご案内",
    subject: "{{会社名}} 様｜〔サービス名〕資料のご送付",
    body: `{{会社名}} ご担当者様

はじめてご連絡申し上げます。
〇〇株式会社の△△でございます。

{{会社名}} 様のECご事業を拝見し、弊社サービスをご活用いただける可能性があると感じ、
資料をお届けしたくご連絡いたしました。

■ 弊社サービスの特徴
・〔特徴1〕
・〔特徴2〕
・〔特徴3〕

詳細については添付資料をご覧いただくか、
お気軽にご返信またはお電話にてお問い合わせください。

ご検討のほど、どうぞよろしくお願い申し上げます。

━━━━━━━━━━━━━━━
〇〇株式会社
担当：△△
TEL：03-xxxx-xxxx
━━━━━━━━━━━━━━━

※ 今後のご案内が不要な場合はご返信にてお知らせください。`,
  },
];

type Tab = "compose" | "preview" | "settings";

function InfoBox() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <Info size={14} className="text-blue-500 shrink-0" />
          送信方式と注意事項について
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-200 pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Zap size={14} className="text-orange-500" />
                SendGrid（推奨）
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pl-1">
                <li>✔ 開封・クリックトラッキング対応</li>
                <li>✔ パイプライン連携（ステータス自動更新）</li>
                <li>✔ 大量送信・配信品質が高い</li>
                <li>✔ バウンス・スパム報告を自動記録</li>
                <li className="text-slate-400">設定 → SendGrid APIキー が必要</li>
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Server size={14} className="text-slate-500" />
                SMTP
              </div>
              <ul className="text-xs text-slate-600 space-y-1 pl-1">
                <li>✔ 自社メールサーバーから送信可能</li>
                <li>✗ 開封・クリック追跡なし</li>
                <li>✗ パイプライン自動更新なし</li>
                <li>△ 大量送信は送信元ドメイン次第</li>
                <li className="text-slate-400">設定 → SMTP設定 が必要</li>
              </ul>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 space-y-1">
            <p className="font-medium text-amber-800 text-xs">送信前に確認してください</p>
            <ul className="text-xs text-amber-700 space-y-1 pl-1">
              <li>・ 送信方式は「SendGrid → SMTP → システム設定」の順に自動選択されます</li>
              <li>・ 1回の送信上限は <strong>500社</strong> です。超える場合は分けて送信してください</li>
              <li>・ 送信間隔は0.2秒/社（スパム対策）。500社で最大約1分40秒かかります</li>
              <li>・ メールアドレス未登録の企業は自動スキップされます</li>
              <li>・ <strong>送信中はこのモーダルを閉じないでください</strong>（進捗が途切れます）</li>
              <li>・ SendGridのWebhookを使う場合、イベントURL <code className="bg-amber-100 px-1 rounded font-mono">https://leadhive.work/api/email-campaigns/sendgrid-webhook</code> を SendGrid 管理画面に登録してください</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailCampaignModal({ companyIds, companies, onClose, onDone }: Props) {
  const [tab, setTab] = useState<Tab>("compose");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [autoStatusOnOpen, setAutoStatusOnOpen] = useState("");
  const [autoStatusOnClick, setAutoStatusOnClick] = useState("");
  const [backendPresets, setBackendPresets] = useState<{ id: string; label: string; title: string; content: string }[]>([]);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [done, setDone] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const progressRef = useRef<HTMLDivElement>(null);

  const withEmail = companies.filter((c) => c.email);
  const noEmail = companies.filter((c) => !c.email);

  const lastProgress = progress[progress.length - 1];
  const currentNum = lastProgress?.current ?? 0;
  const totalNum = lastProgress?.total ?? withEmail.length;
  const sentNum = lastProgress?.sent ?? 0;
  const failedNum = lastProgress?.failed ?? 0;

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [progress]);

  useEffect(() => {
    api.templates.ecPresets().then((data) => {
      setBackendPresets(
        data.presets
          .filter((p: { is_email?: boolean }) => p.is_email)
          .map((p: { id: string; label: string; platform?: string; title: string; content: string }) => ({
            id: p.id,
            label: p.platform ? `[${p.platform}] ${p.label}` : p.label,
            title: p.title,
            content: p.content,
          }))
      );
    }).catch(() => {});
  }, []);

  const insertVariable = (v: string) => {
    setHtmlBody((prev) => prev + v);
  };

  const previewHtml = htmlBody
    .replace(/{{会社名}}/g, "サンプル株式会社")
    .replace(/{{URL}}/g, "https://example.com")
    .replace(/{{担当者名}}/g, "田中 太郎")
    .replace(/{{都道府県}}/g, "東京都")
    .replace(/{{市区町村}}/g, "渋谷区")
    .replace(/{{電話番号}}/g, "03-xxxx-xxxx");

  const handleSend = async () => {
    if (!subject.trim()) { setError("件名を入力してください"); return; }
    if (!htmlBody.trim()) { setError("本文を入力してください"); return; }
    if (withEmail.length === 0) { setError("選択した企業にメールアドレスが登録されていません"); return; }

    setError("");
    setSending(true);
    setProgress([]);
    setDone(false);
    setTab("compose");

    try {
      const response = await fetch("/api/email-campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name || undefined,
          company_ids: companyIds,
          subject,
          html_body: htmlBody,
          auto_status_on_open: autoStatusOnOpen || undefined,
          auto_status_on_click: autoStatusOnClick || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("ストリームの読み取りに失敗しました");

      let buffer = "";
      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const ev: ProgressEvent = JSON.parse(line.slice(6));
              setProgress((prev) => [...prev, ev]);
              if (ev.type === "done") {
                setDone(true);
                if (ev.campaign_id) {
                  setCampaignId(ev.campaign_id);
                  onDone?.(ev.campaign_id);
                }
              }
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "送信中にエラーが発生しました";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-900">一括メール送信</h2>
            <span className="text-sm text-slate-500">
              ({companyIds.length}社選択 / メールあり: {withEmail.length}社)
            </span>
          </div>
          <button onClick={onClose} disabled={sending} className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        {noEmail.length > 0 && !sending && (
          <div className="mx-5 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{noEmail.length}社はメールアドレス未登録のためスキップされます</span>
          </div>
        )}

        {!sending && !done && (
          <div className="flex border-b border-slate-200 px-5 pt-3 gap-4">
            {(["compose", "preview", "settings"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "compose" ? "本文作成" : t === "preview" ? "プレビュー" : "パイプライン設定"}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sending || done ? (
            <div className="space-y-3">
              {!done && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>送信進捗</span>
                    <span>{currentNum} / {totalNum}社</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: totalNum > 0 ? `${(currentNum / totalNum) * 100}%` : "0%" }}
                    />
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">✓ 送信済: {sentNum}</span>
                    {failedNum > 0 && <span className="text-red-500">✗ 失敗: {failedNum}</span>}
                  </div>
                </div>
              )}

              {done && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
                  <CheckCircle2 size={18} />
                  <span className="font-medium">
                    送信完了 — 成功: {sentNum}社 / 失敗: {failedNum}社
                  </span>
                </div>
              )}

              <div
                ref={progressRef}
                className="bg-slate-50 rounded-lg border border-slate-200 p-3 h-52 overflow-y-auto text-xs font-mono space-y-1"
              >
                {progress.map((ev, i) => (
                  <div key={i} className={ev.type === "error" ? "text-red-600" : ev.type === "done" ? "text-green-600 font-semibold" : ev.type === "info" ? "text-amber-600" : "text-slate-600"}>
                    {ev.type === "progress" && `[${ev.current}/${ev.total}] ${ev.company} — ${ev.sent}送信成功${ev.failed ? `, ${ev.failed}失敗` : ""}`}
                    {ev.type === "done" && `✓ 送信完了 (成功:${ev.sent}, 失敗:${ev.failed}, スキップ:${ev.skipped})`}
                    {ev.type === "error" && `✗ エラー: ${ev.message}`}
                    {ev.type === "info" && `ℹ ${ev.message}`}
                  </div>
                ))}
                {!done && sending && (
                  <div className="flex items-center gap-1 text-blue-500">
                    <Loader2 size={11} className="animate-spin" /> 送信中...
                  </div>
                )}
              </div>
            </div>
          ) : tab === "compose" ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2">
                  <FileText size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700">テンプレートから始める</span>
                </div>
                <div className="flex gap-2 px-4 pb-3 flex-wrap">
                  {EMAIL_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      onClick={() => { setSubject(tpl.subject); setHtmlBody(tpl.body); }}
                      className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
                    >
                      {tpl.label}
                    </button>
                  ))}
                  {backendPresets.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => { setSubject(tpl.title); setHtmlBody(tpl.content); }}
                      className="text-xs bg-white border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors font-medium"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <InfoBox />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  キャンペーン名（任意）
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 2026年4月 アプローチ"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  件名 <span className="text-red-500">*</span>
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="例: {{会社名}} 様へのご提案"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    本文（HTML可） <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLE_HINTS.map((h) => (
                      <button
                        key={h.var}
                        onClick={() => insertVariable(h.var)}
                        title={h.desc}
                        className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors"
                      >
                        {h.var}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={10}
                  placeholder={`{{会社名}} 様\n\nお世話になっております。\n...\n\nよろしくお願いいたします。`}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                <p className="text-xs text-slate-400 mt-1">
                  プレーンテキストで入力すると、改行が自動的に反映されます。HTMLも使用できます。
                </p>
              </div>
            </div>
          ) : tab === "preview" ? (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">件名プレビュー</p>
                <p className="text-sm font-medium text-slate-800">
                  {subject.replace(/{{会社名}}/g, "サンプル株式会社")}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">本文プレビュー（サンプルデータ使用）</p>
                {htmlBody.includes("<") ? (
                  <div
                    className="prose prose-sm max-w-none text-slate-800"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">{previewHtml}</pre>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
                <p className="font-medium mb-1">パイプライン自動ステータス更新</p>
                <p className="text-xs text-blue-600">
                  SendGrid Webhookが有効な場合、開封・クリック時に企業のステータスを自動更新します。
                  SendGrid Webhook設定でイベントURL <code className="bg-blue-100 px-1 rounded">https://leadhive.work/api/email-campaigns/sendgrid-webhook</code> を登録してください。
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  開封時に自動更新するステータス（任意）
                </label>
                <select
                  value={autoStatusOnOpen}
                  onChange={(e) => setAutoStatusOnOpen(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">自動更新しない</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  クリック時に自動更新するステータス（任意）
                </label>
                <select
                  value={autoStatusOnClick}
                  onChange={(e) => setAutoStatusOnClick(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">自動更新しない</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200">
          {done ? (
            <button
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              閉じる
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={sending}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                onClick={handleSend}
                disabled={sending || withEmail.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <><Loader2 size={15} className="animate-spin" /> 送信中...</>
                ) : (
                  <><Send size={15} /> {withEmail.length}社に送信</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
