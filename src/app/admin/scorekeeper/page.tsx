import Link from "next/link";
import { getAdminDashboardData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

function formatDate(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleString();
}

export default async function ScorekeeperHubPage() {
  const data = await getAdminDashboardData();

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Hub</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Scorekeeper Operations</h1>
        <p className="mt-2 text-sm text-slate-600">{data.statusMessage}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/admin/games/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Create New Game
          </Link>
          <Link
            href="/admin"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Open Admin Dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Live Games</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{data.liveGamesCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Scheduled Games</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{data.scheduledGamesCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Leagues</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{data.totalLeagues}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Teams</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{data.totalTeams}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Game Queue</h2>
        <ul className="mt-4 space-y-3">
          {data.games.length === 0 && (
            <li className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No games found yet.
            </li>
          )}
          {data.games.map((game) => (
            <li key={game.gameId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {game.homeTeam} {game.homeScore} - {game.awayScore} {game.awayTeam}
                  </p>
                  <p className="text-sm text-slate-600">
                    {game.sportId} | {game.competitionType} | {game.leagueName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {game.status.toUpperCase()}
                    {game.periodLabel ? ` - ${game.periodLabel}` : ""} - {formatDate(game.scheduledAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm font-semibold">
                  <Link href={`/admin/games/${game.gameId}/scorekeeper`} className="text-cyan-700 hover:text-cyan-900">
                    Scorekeeper
                  </Link>
                  <Link href={`/admin/games/${game.gameId}/scoresheet`} className="text-cyan-700 hover:text-cyan-900">
                    Slim Scoresheet
                  </Link>
                  <Link href={`/admin/games/${game.gameId}/stats`} className="text-cyan-700 hover:text-cyan-900">
                    Stats Console
                  </Link>
                  <Link href={`/games/${game.gameId}/live`} className="text-slate-700 hover:text-slate-900">
                    Public Live
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
