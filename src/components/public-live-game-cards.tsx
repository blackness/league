"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTimeUtc } from "@/lib/date-time";
import type { GameStatus, GameSummary } from "@/lib/portal-types";
import { createSupabaseBrowserClient } from "@/lib/supabase";

interface PublicLiveGameCardsProps {
  initialLiveGames: GameSummary[];
}

interface LiveUpdateRow {
  id: string;
  home_score: number;
  away_score: number;
  status: GameStatus;
  period_label: string | null;
  scheduled_at: string;
}

export function PublicLiveGameCards({ initialLiveGames }: PublicLiveGameCardsProps) {
  const [liveGames, setLiveGames] = useState(initialLiveGames);

  useEffect(() => {
    setLiveGames(initialLiveGames);
  }, [initialLiveGames]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client || initialLiveGames.length === 0) {
      return;
    }

    const trackedGameIds = new Set(initialLiveGames.map((game) => game.id));
    const channel = client
      .channel("public-live-cards")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
        },
        (payload) => {
          const row = payload.new as LiveUpdateRow;
          if (!trackedGameIds.has(row.id)) {
            return;
          }

          setLiveGames((previous) =>
            previous.map((game) =>
              game.id === row.id
                ? {
                    ...game,
                    homeScore: row.home_score,
                    awayScore: row.away_score,
                    status: row.status,
                    periodLabel: row.period_label,
                    scheduledAt: row.scheduled_at,
                  }
                : game,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [initialLiveGames]);

  return (
    <ul className="mt-3 grid gap-3 xl:grid-cols-2">
      {liveGames.length === 0 && (
        <li className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 xl:col-span-2">
          No live games currently.
        </li>
      )}
      {liveGames.map((game) => (
        <li key={game.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              {game.status === "live" ? "Live" : game.status}
            </p>
            <p className="text-xs text-slate-500">{game.periodLabel ?? "In Progress"}</p>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {game.homeTeam} {game.homeScore} - {game.awayScore} {game.awayTeam}
          </p>
          <p className="mt-1 text-sm text-slate-600">{game.leagueName}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTimeUtc(game.scheduledAt)}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href={`/games/${game.id}/live`} className="text-cyan-700 hover:text-cyan-900">
              Open Live Boxscore
            </Link>
            <Link href={`/games/${game.id}/stats`} className="text-slate-700 hover:text-slate-900">
              Detailed Stats
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
