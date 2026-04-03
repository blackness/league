"use client";

import { useEffect, useMemo, useState } from "react";
import { formatClock } from "@/lib/game-metadata";
import type { GameStatsDetails, LiveGameDetails } from "@/lib/portal-types";
import { formatDateTimeUtc } from "@/lib/date-time";
import { createSupabaseBrowserClient } from "@/lib/supabase";

interface LiveGamePanelProps {
  initialGame: LiveGameDetails;
  statsSnapshot: GameStatsDetails | null;
}

export function LiveGamePanel({ initialGame, statsSnapshot }: LiveGamePanelProps) {
  const [game, setGame] = useState(initialGame);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const client = createSupabaseBrowserClient();

    if (!client || initialGame.mode === "demo") {
      return;
    }

    const channel = client
      .channel(`live-game:${initialGame.gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${initialGame.gameId}`,
        },
        (payload) => {
          const row = payload.new as {
            home_score: number;
            away_score: number;
            period_label: string | null;
            status: LiveGameDetails["status"];
            metadata: {
              clock_seconds_remaining?: number | null;
              clock_running?: boolean;
              scorepad_values?: Record<string, string>;
            };
          };

          setGame((previous) => ({
            ...previous,
            homeScore: row.home_score,
            awayScore: row.away_score,
            periodLabel: row.period_label,
            status: row.status,
            clockSecondsRemaining:
              typeof row.metadata?.clock_seconds_remaining === "number" ||
              row.metadata?.clock_seconds_remaining === null
                ? row.metadata.clock_seconds_remaining
                : previous.clockSecondsRemaining,
            clockRunning:
              typeof row.metadata?.clock_running === "boolean"
                ? row.metadata.clock_running
                : previous.clockRunning,
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_events",
          filter: `game_id=eq.${initialGame.gameId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            event_type: string;
            points_home: number;
            points_away: number;
            actor_name: string | null;
            source: string;
            created_at: string;
          };

          setGame((previous) => ({
            ...previous,
            events: [
              {
                id: row.id,
                eventType: row.event_type,
                pointsHome: row.points_home,
                pointsAway: row.points_away,
                actorName: row.actor_name,
                source: row.source,
                createdAt: row.created_at,
              },
              ...previous.events,
            ].slice(0, 30),
          }));
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [initialGame.gameId, initialGame.mode]);

  const scoreLine = useMemo(
    () => `${game.homeTeam} ${game.homeScore} - ${game.awayScore} ${game.awayTeam}`,
    [game.awayScore, game.awayTeam, game.homeScore, game.homeTeam],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{game.leagueName}</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{scoreLine}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase text-slate-500">Status</p>
            <p className="font-semibold uppercase text-slate-900">{game.status}</p>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase text-slate-500">Period</p>
            <p className="font-semibold text-slate-900">{game.periodLabel ?? "--"}</p>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs uppercase text-slate-500">Clock</p>
            <p className="font-semibold text-slate-900">
              {formatClock(game.clockSecondsRemaining)} {game.clockRunning ? "(Running)" : "(Stopped)"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">Scheduled: {formatDateTimeUtc(game.scheduledAt)}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Live Event Feed</h3>
          <button
            type="button"
            onClick={() => setShowStats((value) => !value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {showStats ? "Hide Stats" : "Show Team / Player Stats"}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Public updates stream in real time from `game_events` and scoreboard state.
        </p>
        <ul className="mt-4 space-y-3">
          {game.events.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
              No events yet.
            </li>
          )}
          {game.events.map((event) => (
            <li key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">
                {event.eventType} (+{event.pointsHome}/+{event.pointsAway})
              </p>
              <p className="text-slate-600">
                {event.actorName ?? "Unknown operator"} - {event.source} -{" "}
                {formatDateTimeUtc(event.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {showStats && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Team + Player Stats</h3>
          {!statsSnapshot && (
            <p className="mt-2 text-sm text-slate-600">No stat snapshot available for this game yet.</p>
          )}
          {statsSnapshot && (
            <>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{statsSnapshot.homeTeam.teamName}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {statsSnapshot.homeTeam.metrics.map((metric) => (
                      <li key={metric.key}>
                        {metric.label}: <span className="font-semibold text-slate-900">{metric.value}</span>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{statsSnapshot.awayTeam.teamName}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {statsSnapshot.awayTeam.metrics.map((metric) => (
                      <li key={metric.key}>
                        {metric.label}: <span className="font-semibold text-slate-900">{metric.value}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                {statsSnapshot.playerStats.slice(0, 12).map((player) => (
                  <p key={player.playerId} className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                    <span className="font-semibold text-slate-900">{player.playerName}</span> ({player.teamName}) -{" "}
                    {player.stats.map((metric) => `${metric.label}: ${metric.value}`).join(", ")}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
