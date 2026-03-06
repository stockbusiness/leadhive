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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={`${color} text-white p-2 rounded-lg`}>{icon}</div>
      </div>
    </div>
  );
}
