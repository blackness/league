import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { PublicLiveGameCards } from "@/components/public-live-game-cards";
import { formatDateTimeUtc } from "@/lib/date-time";
import { getPortalOverview } from "@/lib/portal-data";

export default async function Home() {
  const overview = await getPortalOverview();
  const gameCount = overview.liveGames.length + overview.upcomingGames.length;

  return (
    <main className="w-full space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
          Sport-Agnostic Foundation
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Live Sports Portal
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700">
          Follow live games across leagues with real-time scoring, public team pages, and
          game-by-game boxscores.
        </p>
        <p className="mt-2 text-sm text-slate-600">{overview.statusMessage}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Leagues"
          value={String(overview.leagues.length)}
          helperText="Sport-specific organizations and seasons"
        />
        <MetricCard
          label="Games Today"
          value={String(gameCount)}
          helperText="Live and upcoming games in this feed"
        />
        <MetricCard
          label="Data Mode"
          value={overview.mode === "connected" ? "Live DB" : "Demo"}
          helperText="Switches automatically when Supabase env variables exist"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Leagues</h2>
          <p className="mt-1 text-sm text-slate-600">
            Start with one league, then scale into multiple sports and seasons.
          </p>
          <ul className="mt-4 space-y-3">
            {overview.leagues.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                No leagues found yet.
              </li>
            )}
            {overview.leagues.map((league) => (
              <li key={league.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{league.name}</p>
                    <p className="text-sm text-slate-600">
                      {league.sportName}
                      {league.activeSeasonName ? ` - ${league.activeSeasonName}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/leagues/${league.id}`}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Live Games</h2>
          <p className="mt-1 text-sm text-slate-600">
            Scores on these cards update in real time as scorekeepers record events.
          </p>
          <PublicLiveGameCards initialLiveGames={overview.liveGames} />
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Upcoming Games</h2>
        <p className="mt-1 text-sm text-slate-600">Next games currently on the calendar.</p>
        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming</h3>
          <ul className="mt-2 space-y-2">
            {overview.upcomingGames.length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                No upcoming games currently.
              </li>
            )}
            {overview.upcomingGames.map((game) => (
              <li key={game.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">
                  {game.homeTeam} vs {game.awayTeam}
                </p>
                <p className="text-sm text-slate-600">
                  {game.leagueName} - {formatDateTimeUtc(game.scheduledAt)}
                </p>
              </li>
            ))}
          </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Public Features</h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <li className="rounded-md bg-slate-50 p-3">Realtime live game cards with current score and period</li>
          <li className="rounded-md bg-slate-50 p-3">Live boxscore pages with event timeline and score state</li>
          <li className="rounded-md bg-slate-50 p-3">Public team pages with YouTube/Hudl stream integration</li>
          <li className="rounded-md bg-slate-50 p-3">Cross-team comparison pages for fans and media</li>
        </ul>
      </section>
    </main>
  );
}
