export default function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-3 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-1">
        <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-zinc-400 leading-tight">{label}</div>
        <div className={`${color} p-1.5 sm:p-2 rounded-lg flex-shrink-0`}>{icon}</div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
