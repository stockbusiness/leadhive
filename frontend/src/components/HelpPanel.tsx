import { useState } from "react";
import { X, HelpCircle, BookOpen, ExternalLink, MessageCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface HelpItem {
  label: string;
  description?: string;
  to?: string;
  href?: string;
}

interface HelpPanelProps {
  title?: string;
  manualLinks?: HelpItem[];
  tips?: string[];
}

export default function HelpPanel({ title = "このページのヘルプ", manualLinks = [], tips = [] }: HelpPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="ヘルプ"
        className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-300 bg-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
      >
        <HelpCircle size={14} />
        ヘルプ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setOpen(false)} />
          <div className="w-80 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-blue-500" />
                <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {manualLinks.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-3">
                    <BookOpen size={13} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">マニュアル</span>
                  </div>
                  <ul className="space-y-1.5">
                    {manualLinks.map((item) => (
                      <li key={item.label}>
                        {item.href ? (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-blue-50 transition-colors group"
                          >
                            <ChevronRight size={14} className="text-blue-400 mt-0.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{item.label}</p>
                              {item.description && (
                                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>
                              )}
                            </div>
                            <ExternalLink size={11} className="text-slate-300 flex-shrink-0 mt-1" />
                          </a>
                        ) : item.to ? (
                          <Link
                            to={item.to}
                            className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-blue-50 transition-colors group"
                            onClick={() => setOpen(false)}
                          >
                            <ChevronRight size={14} className="text-blue-400 mt-0.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{item.label}</p>
                              {item.description && (
                                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>
                              )}
                            </div>
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {tips.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">💡 ヒント</span>
                  </div>
                  <ul className="space-y-2">
                    {tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 space-y-2">
              <Link
                to="/manual"
                target="_blank"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
                onClick={() => setOpen(false)}
              >
                <BookOpen size={14} />
                マニュアル全体を読む
              </Link>
              <Link
                to="/faq"
                target="_blank"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
                onClick={() => setOpen(false)}
              >
                <MessageCircle size={14} />
                よくある質問（FAQ）
              </Link>
              <Link
                to="/support"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
                onClick={() => setOpen(false)}
              >
                <MessageCircle size={14} />
                サポートに問い合わせる
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
