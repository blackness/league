import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamDetails } from "@/lib/portal-data";

interface TeamPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

function formatDate(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleString();
}

function getBrandStyle(primary: string | null, secondary: string | null) {
  const colorA = primary ?? "#0f172a";
  const colorB = secondary ?? "#1e293b";
  return {
    backgroundImage: `linear-gradient(120deg, ${colorA}, ${colorB})`,
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params;
  const team = await getTeamDetails(teamId);

  if (!team) {
    notFound();
  }

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl p-6 text-white shadow-sm" style={getBrandStyle(team.primaryColor, team.secondaryColor)}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{team.sportName}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{team.teamName}</h1>
        <p className="mt-2 text-sm text-white/90">
          {team.leagueName}
          {team.city ? ` - ${team.city}` : ""}
        </p>
        <p className="mt-1 text-sm text-white/80">{team.statusMessage}</p>
        {team.websiteUrl && (
          <a
            href={team.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-md bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/30"
          >
            Team Website
          </a>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Upcoming Games</h2>
          <ul className="mt-4 space-y-3">
            {team.upcomingGames.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                No upcoming games scheduled.
              </li>
            )}
            {team.upcomingGames.map((game) => (
              <li key={game.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">
                  {game.isHome ? "vs" : "@"} {game.opponentTeam}
                </p>
                <p className="text-sm text-slate-600">{formatDate(game.scheduledAt)}</p>
                <p className="text-sm text-slate-600">
                  {game.venueName ? `Venue: ${game.venueName}` : "Venue TBD"}
                </p>
                {game.streamUrl && (
                  <a
                    href={game.streamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    Watch Stream ({game.streamProvider ?? "link"})
                  </a>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Recent Games</h2>
          <ul className="mt-4 space-y-3">
            {team.recentGames.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                No recent games available.
              </li>
            )}
            {team.recentGames.map((game) => (
              <li key={game.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">
                  {game.isHome ? "vs" : "@"} {game.opponentTeam}
                </p>
                <p className="text-sm text-slate-600">
                  {game.teamScore} - {game.opponentScore}
                  {game.periodLabel ? ` - ${game.periodLabel}` : ""}
                </p>
                <p className="text-sm text-slate-600">{formatDate(game.scheduledAt)}</p>
                <div className="mt-2 flex gap-3">
                  <Link
                    href={`/games/${game.id}/live`}
                    className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    Open Live Page
                  </Link>
                  <Link
                    href={`/games/${game.id}/stats`}
                    className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    Game Stats
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Stream Embeds</h2>
        <p className="mt-1 text-sm text-slate-600">
          YouTube links auto-embed. Hudl and other providers are linked when direct embed URLs are not available.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {team.recentGames
            .filter((game) => game.streamUrl)
            .map((game) => (
              <article key={`${game.id}-stream`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">
                  {game.isHome ? "vs" : "@"} {game.opponentTeam}
                </p>
                <p className="mb-3 text-sm text-slate-600">{formatDate(game.scheduledAt)}</p>
                {game.embedUrl ? (
                  <iframe
                    src={game.embedUrl}
                    title={`Stream ${game.id}`}
                    className="aspect-video w-full rounded-md border border-slate-200"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <a
                    href={game.streamUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    Open Stream
                  </a>
                )}
              </article>
            ))}
          {team.recentGames.filter((game) => game.streamUrl).length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
              No stream links found yet for this team.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
