import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameStatsDetails } from "@/lib/portal-data";

interface GameStatsPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

function formatDate(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleString();
}

export default async function GameStatsPage({ params }: GameStatsPageProps) {
  const { gameId } = await params;
  const gameStats = await getGameStatsDetails(gameId);

  if (!gameStats) {
    notFound();
  }

  const playerStatsByTeam = {
    home: gameStats.playerStats.filter((row) => row.teamId === gameStats.homeTeam.teamId),
    away: gameStats.playerStats.filter((row) => row.teamId === gameStats.awayTeam.teamId),
  };

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Game Stats</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{gameStats.leagueName}</h1>
        <p className="mt-2 text-sm text-slate-600">{gameStats.statusMessage}</p>
        <p className="mt-1 text-sm text-slate-600">
          {formatDate(gameStats.scheduledAt)} - {gameStats.status.toUpperCase()}
          {gameStats.periodLabel ? ` (${gameStats.periodLabel})` : ""}
        </p>
        <div className="mt-3 flex gap-4 text-sm font-semibold">
          <Link href={`/games/${gameId}/live`} className="text-cyan-700 hover:text-cyan-900">
            Live Scoreboard
          </Link>
          <Link href={`/compare?teamA=${gameStats.homeTeam.teamId}&teamB=${gameStats.awayTeam.teamId}`} className="text-slate-700 hover:text-slate-900">
            Compare Teams
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">{gameStats.homeTeam.teamName}</h2>
          <p className="mt-1 text-4xl font-bold text-slate-900">{gameStats.homeTeam.score}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {gameStats.homeTeam.metrics.length === 0 && (
              <li className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">
                No team stats available yet.
              </li>
            )}
            {gameStats.homeTeam.metrics.map((metric) => (
              <li key={metric.key} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span className="text-slate-600">{metric.label}</span>
                <span className="font-semibold text-slate-900">{metric.value}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">{gameStats.awayTeam.teamName}</h2>
          <p className="mt-1 text-4xl font-bold text-slate-900">{gameStats.awayTeam.score}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {gameStats.awayTeam.metrics.length === 0 && (
              <li className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">
                No team stats available yet.
              </li>
            )}
            {gameStats.awayTeam.metrics.map((metric) => (
              <li key={metric.key} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span className="text-slate-600">{metric.label}</span>
                <span className="font-semibold text-slate-900">{metric.value}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">{gameStats.homeTeam.teamName} Player Stats</h3>
          <div className="mt-4 space-y-3">
            {playerStatsByTeam.home.length === 0 && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No player rows recorded.
              </p>
            )}
            {playerStatsByTeam.home.map((player) => (
              <article key={player.playerId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  {player.playerName}
                  {player.jerseyNumber ? ` #${player.jerseyNumber}` : ""}
                </p>
                <p className="text-sm text-slate-600">
                  {player.position ?? "N/A"} - {player.minutesPlayed ?? 0} min
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {player.stats.map((metric) => (
                    <span
                      key={`${player.playerId}-${metric.key}`}
                      className="rounded bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {metric.label}: {metric.value}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">{gameStats.awayTeam.teamName} Player Stats</h3>
          <div className="mt-4 space-y-3">
            {playerStatsByTeam.away.length === 0 && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No player rows recorded.
              </p>
            )}
            {playerStatsByTeam.away.map((player) => (
              <article key={player.playerId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  {player.playerName}
                  {player.jerseyNumber ? ` #${player.jerseyNumber}` : ""}
                </p>
                <p className="text-sm text-slate-600">
                  {player.position ?? "N/A"} - {player.minutesPlayed ?? 0} min
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {player.stats.map((metric) => (
                    <span
                      key={`${player.playerId}-${metric.key}`}
                      className="rounded bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {metric.label}: {metric.value}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
