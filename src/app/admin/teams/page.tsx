import { TeamManagerConsole } from "@/components/team-manager-console";
import { getScheduleBuilderData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const scheduleData = await getScheduleBuilderData();

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Tools</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Teams Manager</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create teams, bulk import teams from CSV, and feed team selections into game setup.
        </p>
        <p className="mt-1 text-sm text-slate-600">{scheduleData.statusMessage}</p>
      </section>

      <TeamManagerConsole scheduleData={scheduleData} />
    </main>
  );
}

