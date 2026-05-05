type StatCardProps = {
  label: string;
  value: number | string;
  helper?: string;
};

export default function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
      {helper ? <p className="mt-2 text-sm text-zinc-500">{helper}</p> : null}
    </div>
  );
}
