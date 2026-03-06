export default function FlagBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}
