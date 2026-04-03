import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveGamePanel } from "@/components/live-game-panel";
import { getGameStatsDetails, getLiveGameDetails } from "@/lib/portal-data";

interface LiveGamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default async function LiveGamePage({ params }: LiveGamePageProps) {
  const { gameId } = await params;
  const [game, statsSnapshot] = await Promise.all([
    getLiveGameDetails(gameId),
    getGameStatsDetails(gameId),
  ]);

  if (!game) {
    notFound();
  }

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Public Live Game</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {game.homeTeam} vs {game.awayTeam}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{game.statusMessage}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href={`/games/${gameId}/stats`} className="text-cyan-700 hover:text-cyan-900">
            Open Detailed Boxscore
          </Link>
          <Link href={`/teams/${game.homeTeamId}`} className="text-slate-700 hover:text-slate-900">
            {game.homeTeam} Team Page
          </Link>
          <Link href={`/teams/${game.awayTeamId}`} className="text-slate-700 hover:text-slate-900">
            {game.awayTeam} Team Page
          </Link>
          <Link
            href={`/compare?teamA=${game.homeTeamId}&teamB=${game.awayTeamId}`}
            className="text-slate-700 hover:text-slate-900"
          >
            Compare These Teams
          </Link>
        </div>
      </section>

      <LiveGamePanel initialGame={game} statsSnapshot={statsSnapshot} />
    </main>
  );
}
