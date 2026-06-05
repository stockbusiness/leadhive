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
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-500 dark:text-zinc-400">{label}</div>
        <div className={`${color} p-2 rounded-lg`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
