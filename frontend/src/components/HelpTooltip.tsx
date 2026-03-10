import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  text: string;
  size?: number;
  className?: string;
}

export default function HelpTooltip({ text, size = 14, className = "" }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }
    if (visible) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [visible]);

  return (
    <div ref={ref} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        className="text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="ヘルプ"
      >
        <HelpCircle size={size} />
      </button>
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}
