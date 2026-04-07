import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface Action {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: Action;
  secondaryAction?: Action;
}

export default function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4 text-slate-300">{icon}</div>
      <p className="text-base font-semibold text-slate-600 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
          {action && (
            action.to ? (
              <Link
                to={action.to}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                {action.label}
                <ChevronRight size={14} />
              </Link>
            ) : (
              <button
                onClick={action.onClick}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                {action.label}
                <ChevronRight size={14} />
              </button>
            )
          )}
          {secondaryAction && (
            secondaryAction.to ? (
              <Link
                to={secondaryAction.to}
                className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:border-blue-300 hover:text-blue-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                onClick={secondaryAction.onClick}
                className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:border-blue-300 hover:text-blue-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
