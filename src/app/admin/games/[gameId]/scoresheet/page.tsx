import Link from "next/link";
import { notFound } from "next/navigation";
import { ScorekeeperConsole } from "@/components/scorekeeper-console";
import { getGameRosterPlayers, getGameStatsDetails, getLiveGameDetails } from "@/lib/portal-data";

interface SlimScoresheetPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default async function SlimScoresheetPage({ params }: SlimScoresheetPageProps) {
  const { gameId } = await params;
  const [game, rosterPlayers, gameStats] = await Promise.all([
    getLiveGameDetails(gameId),
    getGameRosterPlayers(gameId),
    getGameStatsDetails(gameId),
  ]);

  if (!game) {
    notFound();
  }

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Operator View</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Slim Live Scoresheet</h1>
        <p className="mt-2 text-sm text-slate-600">
          Focus mode for game input only: scoreboard, team stats, and selected player stat tracking.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href={`/admin/games/${gameId}/scorekeeper`} className="text-slate-700 hover:text-slate-900">
            Full Scorekeeper
          </Link>
          <Link href={`/games/${gameId}/live`} className="text-cyan-700 hover:text-cyan-900">
            Public Live
          </Link>
          <Link href={`/games/${gameId}/stats`} className="text-slate-700 hover:text-slate-900">
            Public Stats
          </Link>
        </div>
      </section>

      <ScorekeeperConsole
        initialGame={game}
        rosterPlayers={rosterPlayers}
        initialPlayerStats={gameStats?.playerStats ?? []}
        initialTeamStats={{
          [gameStats?.homeTeam.teamId ?? game.homeTeamId]:
            gameStats?.homeTeam.metrics.reduce<Record<string, number>>((accumulator, metric) => {
              accumulator[metric.key] = metric.value;
              return accumulator;
            }, {}) ?? {},
          [gameStats?.awayTeam.teamId ?? game.awayTeamId]:
            gameStats?.awayTeam.metrics.reduce<Record<string, number>>((accumulator, metric) => {
              accumulator[metric.key] = metric.value;
              return accumulator;
            }, {}) ?? {},
        }}
        variant="slim"
      />
    </main>
  );
}

