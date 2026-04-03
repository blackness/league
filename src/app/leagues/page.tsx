import Link from "next/link";
import { getPortalOverview } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function LeaguesIndexPage() {
  const overview = await getPortalOverview();

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Public Directory</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Leagues</h1>
        <p className="mt-2 text-sm text-slate-600">
          Browse all active leagues and jump into standings and recent games.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ul className="space-y-3">
          {overview.leagues.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No leagues are available yet.
            </li>
          )}
          {overview.leagues.map((league) => (
            <li key={league.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{league.name}</p>
                  <p className="text-sm text-slate-600">
                    {league.sportName}
                    {league.activeSeasonName ? ` - ${league.activeSeasonName}` : ""}
                  </p>
                </div>
                <Link
                  href={`/leagues/${league.id}`}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Open League
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
