interface MetricCardProps {
  label: string;
  value: string;
  helperText: string;
}

export function MetricCard({ label, value, helperText }: MetricCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{helperText}</p>
    </article>
  );
}
