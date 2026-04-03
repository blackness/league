import Link from "next/link";
import { notFound } from "next/navigation";
import { GameStatsConsole } from "@/components/game-stats-console";
import { getGameRosterPlayers, getGameStatsDetails } from "@/lib/portal-data";

interface GameStatsAdminPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default async function GameStatsAdminPage({ params }: GameStatsAdminPageProps) {
  const { gameId } = await params;
  const [gameStats, rosterPlayers] = await Promise.all([
    getGameStatsDetails(gameId),
    getGameRosterPlayers(gameId),
  ]);

  if (!gameStats) {
    notFound();
  }

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Tools</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Game Stats Console</h1>
        <p className="mt-2 text-sm text-slate-600">{gameStats.statusMessage}</p>
        <div className="mt-3 flex gap-3 text-sm font-semibold">
          <Link href="/admin/games/new" className="text-slate-700 hover:text-slate-900">
            New Game
          </Link>
          <Link href="/admin/scorekeeper" className="text-slate-700 hover:text-slate-900">
            Scorekeeper Hub
          </Link>
          <Link href={`/admin/games/${gameId}/scoresheet`} className="text-slate-700 hover:text-slate-900">
            Slim Scoresheet
          </Link>
          <Link href={`/games/${gameId}/stats`} className="text-cyan-700 hover:text-cyan-900">
            Open Public Stats Page
          </Link>
          <Link href={`/games/${gameId}/live`} className="text-slate-700 hover:text-slate-900">
            Open Live Scoreboard
          </Link>
          <Link href={`/admin/games/${gameId}/scorekeeper`} className="text-slate-700 hover:text-slate-900">
            Scorekeeper
          </Link>
        </div>
      </section>

      <GameStatsConsole gameStats={gameStats} rosterPlayers={rosterPlayers} />
    </main>
  );
}
