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
        <Link
          href={`/games/${gameId}/stats`}
          className="mt-3 block text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Open Detailed Boxscore
        </Link>
      </section>

      <LiveGamePanel initialGame={game} statsSnapshot={statsSnapshot} />
    </main>
  );
}
