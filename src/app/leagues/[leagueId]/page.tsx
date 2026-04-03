import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueDetails } from "@/lib/portal-data";

interface LeaguePageProps {
  params: Promise<{
    leagueId: string;
  }>;
}

function formatDiff(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function formatDate(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleString();
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { leagueId } = await params;
  const league = await getLeagueDetails(leagueId);

  if (!league) {
    notFound();
  }

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{league.sportName}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{league.leagueName}</h1>
        <p className="mt-2 text-sm text-slate-600">{league.statusMessage}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Standings</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">W</th>
                <th className="px-2 py-2">L</th>
                <th className="px-2 py-2">T</th>
                <th className="px-2 py-2">PF</th>
                <th className="px-2 py-2">PA</th>
                <th className="px-2 py-2">Diff</th>
              </tr>
            </thead>
            <tbody>
              {league.standings.length === 0 && (
                <tr>
                  <td className="px-2 py-3 text-slate-600" colSpan={7}>
                    No standings rows yet. Finalize at least one game to populate this table.
                  </td>
                </tr>
              )}
              {league.standings.map((row) => (
                <tr key={row.teamId} className="border-b border-slate-100">
                  <td className="px-2 py-3 font-medium text-slate-900">
                    <Link href={`/teams/${row.teamId}`} className="hover:text-cyan-700">
                      {row.teamName}
                    </Link>
                  </td>
                  <td className="px-2 py-3">{row.wins}</td>
                  <td className="px-2 py-3">{row.losses}</td>
                  <td className="px-2 py-3">{row.ties}</td>
                  <td className="px-2 py-3">{row.pointsFor}</td>
                  <td className="px-2 py-3">{row.pointsAgainst}</td>
                  <td className="px-2 py-3">{formatDiff(row.pointDiff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Recent Games</h2>
        <ul className="mt-4 space-y-3">
          {league.recentGames.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
              No games found for this league yet.
            </li>
          )}
          {league.recentGames.map((game) => (
            <li key={game.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-900">
                {game.homeTeam} {game.homeScore} - {game.awayScore} {game.awayTeam}
              </p>
              <p className="text-sm text-slate-600">
                {game.status.toUpperCase()}
                {game.periodLabel ? ` - ${game.periodLabel}` : ""} - {formatDate(game.scheduledAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
