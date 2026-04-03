import Link from "next/link";
import { GameSetupWizard } from "@/components/game-setup-wizard";
import { getScheduleBuilderData } from "@/lib/portal-data";
import { getSportProfiles } from "@/lib/sport-config";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  const scheduleData = await getScheduleBuilderData();
  const sportProfiles = getSportProfiles();

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Tools</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Ad-hoc / League / Tournament Game Setup
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Create game context, pick sport, define teams and stats, then start scorekeeping.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Need to add teams first?{" "}
          <Link href="/admin/teams" className="font-semibold text-cyan-700 hover:text-cyan-900">
            Open Teams Manager
          </Link>
          .
        </p>
      </section>

      <GameSetupWizard scheduleData={scheduleData} sportProfiles={sportProfiles} />
    </main>
  );
}
