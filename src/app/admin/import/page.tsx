import Link from "next/link";
import { RosterImportConsole } from "@/components/roster-import-console";
import { StatsBackfillConsole } from "@/components/stats-backfill-console";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Tools</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">CSV Import Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Validate roster/player CSV files before importing so scorekeeping rosters stay clean.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Team creation/import now lives in{" "}
          <Link href="/admin/teams" className="font-semibold text-cyan-700 hover:text-cyan-900">
            Teams Manager
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Template Headers</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Teams CSV</h3>
            <p className="mt-2 text-sm text-slate-700">
              Use{" "}
              <Link href="/admin/teams" className="font-semibold text-cyan-700 hover:text-cyan-900">
                Teams Manager
              </Link>{" "}
              for team create/import with dry run + commit.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Players CSV</h3>
            <p className="mt-2 text-sm text-slate-700">
              <code className="rounded bg-white px-1 py-0.5 text-xs">
                team_slug,season_name,first_name,last_name,jersey_number,position
              </code>
            </p>
          </article>
        </div>
      </section>

      <RosterImportConsole />

      <StatsBackfillConsole />
    </main>
  );
}
