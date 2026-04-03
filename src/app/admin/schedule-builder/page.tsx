import { ScheduleBuilderConsole } from "@/components/schedule-builder-console";
import { getScheduleBuilderData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function ScheduleBuilderPage() {
  const data = await getScheduleBuilderData();

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Tools</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Schedule Builder</h1>
        <p className="mt-2 text-sm text-slate-600">
          Round-robin generator with blackout-date and capacity constraints.
        </p>
        <p className="mt-1 text-sm text-slate-600">{data.statusMessage}</p>
      </section>

      <ScheduleBuilderConsole initialData={data} />
    </main>
  );
}
