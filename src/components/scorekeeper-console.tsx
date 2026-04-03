"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeUtc, formatTimeUtc, nowTimeUtcLabel } from "@/lib/date-time";
import { formatClock } from "@/lib/game-metadata";
import { normalizeStatsForUi, toMetricLabelFromKey } from "@/lib/metrics";
import type {
  GameRosterPlayerOption,
  GameStatus,
  LiveGameDetails,
  PlayerGameStatLine,
} from "@/lib/portal-types";
import { getSportProfileById, toMetricLabelMap } from "@/lib/sport-config";
import { createSupabaseBrowserClient } from "@/lib/supabase";

interface ScorekeeperConsoleProps {
  initialGame: LiveGameDetails;
  rosterPlayers: GameRosterPlayerOption[];
  initialPlayerStats: PlayerGameStatLine[];
  initialTeamStats: Record<string, Record<string, number>>;
  variant?: "full" | "slim";
}

interface PlayerGameStatState {
  teamId: string;
  starter: boolean;
  minutesPlayed: number | null;
  stats: Record<string, number>;
}

function toInitialPlayerStats(rows: PlayerGameStatLine[]): Record<string, PlayerGameStatState> {
  const output: Record<string, PlayerGameStatState> = {};
  for (const row of rows) {
    output[row.playerId] = {
      teamId: row.teamId,
      starter: row.starter,
      minutesPlayed: row.minutesPlayed,
      stats: row.stats.reduce<Record<string, number>>((accumulator, metric) => {
        accumulator[metric.key] = metric.value;
        return accumulator;
      }, {}),
    };
  }
  return output;
}

export function ScorekeeperConsole({
  initialGame,
  rosterPlayers,
  initialPlayerStats,
  initialTeamStats,
  variant = "full",
}: ScorekeeperConsoleProps) {
  const isSlim = variant === "slim";
  const [homeScore, setHomeScore] = useState(initialGame.homeScore);
  const [awayScore, setAwayScore] = useState(initialGame.awayScore);
  const [status, setStatus] = useState<GameStatus>(initialGame.status);
  const [periodLabel, setPeriodLabel] = useState(initialGame.periodLabel ?? "");
  const [clockSecondsRemaining, setClockSecondsRemaining] = useState<number | null>(
    initialGame.clockSecondsRemaining,
  );
  const [clockRunning, setClockRunning] = useState(initialGame.clockRunning);

  const [actorName, setActorName] = useState("");
  const [eventType, setEventType] = useState("score");
  const [pointsHome, setPointsHome] = useState(1);
  const [pointsAway, setPointsAway] = useState(0);
  const [eventNotes, setEventNotes] = useState("");

  const [events, setEvents] = useState(initialGame.events);
  const [scorepadValues, setScorepadValues] = useState<Record<string, string>>(
    initialGame.scorepadValues,
  );
  const [teamStatsById, setTeamStatsById] = useState<Record<string, Record<string, number>>>(
    initialTeamStats,
  );
  const [playerStatsById, setPlayerStatsById] = useState<Record<string, PlayerGameStatState>>(
    () => toInitialPlayerStats(initialPlayerStats),
  );
  const [selectedTeamStatTargetId, setSelectedTeamStatTargetId] = useState(initialGame.homeTeamId);
  const [selectedPlayerTeamFilterId, setSelectedPlayerTeamFilterId] = useState(initialGame.homeTeamId);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [slimInputScope, setSlimInputScope] = useState<"team" | "player">("team");
  const [slimMetricStep, setSlimMetricStep] = useState(1);

  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const sportProfile = useMemo(() => getSportProfileById(initialGame.sportId), [initialGame.sportId]);

  const trackedTeamMetrics = useMemo(() => {
    const fallback = sportProfile.defaultTeamMetrics;
    const metrics =
      initialGame.trackedTeamMetrics.length > 0 ? initialGame.trackedTeamMetrics : fallback;
    return Array.from(new Set(metrics));
  }, [initialGame.trackedTeamMetrics, sportProfile.defaultTeamMetrics]);

  const trackedPlayerMetrics = useMemo(() => {
    const fallback = sportProfile.defaultPlayerMetrics;
    const metrics =
      initialGame.trackedPlayerMetrics.length > 0 ? initialGame.trackedPlayerMetrics : fallback;
    return Array.from(new Set(metrics));
  }, [initialGame.trackedPlayerMetrics, sportProfile.defaultPlayerMetrics]);

  const teamMetricLabels = useMemo(() => {
    const map = toMetricLabelMap(sportProfile.teamMetricCatalog);
    for (const metricKey of trackedTeamMetrics) {
      if (!map[metricKey]) {
        map[metricKey] = toMetricLabelFromKey(metricKey);
      }
    }
    return map;
  }, [sportProfile.teamMetricCatalog, trackedTeamMetrics]);

  const playerMetricLabels = useMemo(() => {
    const map = toMetricLabelMap(sportProfile.playerMetricCatalog);
    for (const metricKey of trackedPlayerMetrics) {
      if (!map[metricKey]) {
        map[metricKey] = toMetricLabelFromKey(metricKey);
      }
    }
    return map;
  }, [sportProfile.playerMetricCatalog, trackedPlayerMetrics]);

  const teamNameById = useMemo(
    () => ({
      [initialGame.homeTeamId]: initialGame.homeTeam,
      [initialGame.awayTeamId]: initialGame.awayTeam,
    }),
    [initialGame.awayTeam, initialGame.awayTeamId, initialGame.homeTeam, initialGame.homeTeamId],
  );

  const playerTrackedTeamIds = useMemo(() => {
    const output = new Set<string>();
    if (initialGame.trackedPlayerSides.includes("home")) {
      output.add(initialGame.homeTeamId);
    }
    if (initialGame.trackedPlayerSides.includes("away")) {
      output.add(initialGame.awayTeamId);
    }
    return output;
  }, [initialGame.awayTeamId, initialGame.homeTeamId, initialGame.trackedPlayerSides]);

  const rosterPlayersForStats = useMemo(
    () => rosterPlayers.filter((player) => playerTrackedTeamIds.has(player.teamId)),
    [rosterPlayers, playerTrackedTeamIds],
  );

  const filteredRosterPlayersForStats = useMemo(
    () =>
      rosterPlayersForStats.filter((player) => {
        if (!isSlim) {
          return true;
        }
        return player.teamId === selectedPlayerTeamFilterId;
      }),
    [isSlim, rosterPlayersForStats, selectedPlayerTeamFilterId],
  );

  const playerSelectionPool = isSlim ? filteredRosterPlayersForStats : rosterPlayersForStats;

  const selectedPlayer = useMemo(
    () => playerSelectionPool.find((player) => player.playerId === selectedPlayerId) ?? null,
    [playerSelectionPool, selectedPlayerId],
  );

  const selectedPlayerStats = selectedPlayer
    ? playerStatsById[selectedPlayer.playerId]?.stats ?? {}
    : {};

  const selectedTeamStats = teamStatsById[selectedTeamStatTargetId] ?? {};

  const rosterByTeam = useMemo(() => {
    const grouped = new Map<string, GameRosterPlayerOption[]>();
    for (const player of rosterPlayersForStats) {
      const existing = grouped.get(player.teamName) ?? [];
      existing.push(player);
      grouped.set(player.teamName, existing);
    }
    return grouped;
  }, [rosterPlayersForStats]);

  useEffect(() => {
    const trackedTeamList = Array.from(playerTrackedTeamIds);
    if (trackedTeamList.length === 0) {
      setSelectedPlayerTeamFilterId("");
      return;
    }
    if (!trackedTeamList.includes(selectedPlayerTeamFilterId)) {
      setSelectedPlayerTeamFilterId(trackedTeamList[0]);
    }
  }, [playerTrackedTeamIds, selectedPlayerTeamFilterId]);

  useEffect(() => {
    if (selectedPlayerId) {
      const found = playerSelectionPool.some((player) => player.playerId === selectedPlayerId);
      if (found) {
        return;
      }
    }

    if (playerSelectionPool.length > 0) {
      setSelectedPlayerId(playerSelectionPool[0].playerId);
    } else {
      setSelectedPlayerId("");
    }
  }, [playerSelectionPool, selectedPlayerId]);

  useEffect(() => {
    if (!supabase || initialGame.mode === "demo") {
      return;
    }

    const channel = supabase
      .channel(`scorekeeper:${initialGame.gameId}`)
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
            status: GameStatus;
            period_label: string | null;
            metadata: {
              clock_seconds_remaining?: number | null;
              clock_running?: boolean;
              scorepad_values?: Record<string, string>;
            };
          };

          setHomeScore(row.home_score);
          setAwayScore(row.away_score);
          setStatus(row.status);
          setPeriodLabel(row.period_label ?? "");
          if (
            typeof row.metadata?.clock_seconds_remaining === "number" ||
            row.metadata?.clock_seconds_remaining === null
          ) {
            setClockSecondsRemaining(row.metadata.clock_seconds_remaining ?? null);
          }
          if (typeof row.metadata?.clock_running === "boolean") {
            setClockRunning(row.metadata.clock_running);
          }
          if (row.metadata?.scorepad_values && typeof row.metadata.scorepad_values === "object") {
            setScorepadValues(row.metadata.scorepad_values);
          }
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
          setEvents((previous) =>
            [
              {
                id: row.id,
                eventType: row.event_type,
                pointsHome: row.points_home,
                pointsAway: row.points_away,
                actorName: row.actor_name,
                source: row.source,
                createdAt: row.created_at,
              },
              ...previous,
            ].slice(0, 50),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_team_stats",
          filter: `game_id=eq.${initialGame.gameId}`,
        },
        (payload) => {
          const row = payload.new as {
            team_id: string;
            stats: unknown;
          };
          setTeamStatsById((previous) => ({
            ...previous,
            [row.team_id]: normalizeStatsForUi(row.stats, "team", initialGame.sportId),
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_team_stats",
          filter: `game_id=eq.${initialGame.gameId}`,
        },
        (payload) => {
          const row = payload.new as {
            team_id: string;
            stats: unknown;
          };
          setTeamStatsById((previous) => ({
            ...previous,
            [row.team_id]: normalizeStatsForUi(row.stats, "team", initialGame.sportId),
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "player_game_stats",
          filter: `game_id=eq.${initialGame.gameId}`,
        },
        (payload) => {
          const row = payload.new as {
            player_id: string;
            team_id: string;
            starter: boolean;
            minutes_played: number | null;
            stats: unknown;
          };

          setPlayerStatsById((previous) => ({
            ...previous,
            [row.player_id]: {
              teamId: row.team_id,
              starter: row.starter,
              minutesPlayed: row.minutes_played,
              stats: normalizeStatsForUi(row.stats, "player", initialGame.sportId),
            },
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "player_game_stats",
          filter: `game_id=eq.${initialGame.gameId}`,
        },
        (payload) => {
          const row = payload.new as {
            player_id: string;
            team_id: string;
            starter: boolean;
            minutes_played: number | null;
            stats: unknown;
          };

          setPlayerStatsById((previous) => ({
            ...previous,
            [row.player_id]: {
              teamId: row.team_id,
              starter: row.starter,
              minutesPlayed: row.minutes_played,
              stats: normalizeStatsForUi(row.stats, "player", initialGame.sportId),
            },
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [initialGame.gameId, initialGame.mode, initialGame.sportId, supabase]);

  useEffect(() => {
    if (!clockRunning || clockSecondsRemaining === null) {
      return;
    }

    if (clockSecondsRemaining <= 0) {
      setClockRunning(false);
      return;
    }

    const handle = window.setInterval(() => {
      setClockSecondsRemaining((previous) => {
        if (previous === null) {
          return previous;
        }
        return Math.max(0, previous - 1);
      });
    }, 1000);

    return () => {
      window.clearInterval(handle);
    };
  }, [clockRunning, clockSecondsRemaining]);

  async function postScorekeeperAction(payload: Record<string, unknown>) {
    const response = await fetch(`/api/admin/games/${initialGame.gameId}/scorekeeper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "Scorekeeper action failed.");
    }
  }

  async function postStatsAction(payload: Record<string, unknown>) {
    const response = await fetch(`/api/admin/games/${initialGame.gameId}/stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "Stat action failed.");
    }
  }

  async function saveGameState() {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await postScorekeeperAction({
        action: "save_state",
        homeScore,
        awayScore,
        status,
        periodLabel: periodLabel || null,
        clockSecondsRemaining,
        clockRunning,
      });
      setSuccessMessage("Game state saved.");
      setActivityLog((previous) => [
        `${nowTimeUtcLabel()}: state saved (${homeScore}-${awayScore}, ${status})`,
        ...previous,
      ]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function recordEvent(
    customPointsHome: number,
    customPointsAway: number,
    customEventType?: string,
    customLabel?: string,
  ) {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextHome = Math.max(0, homeScore + customPointsHome);
    const nextAway = Math.max(0, awayScore + customPointsAway);
    const resolvedType = customEventType ?? eventType;

    try {
      await postScorekeeperAction({
        action: "record_event",
        homeScore: nextHome,
        awayScore: nextAway,
        status,
        periodLabel: periodLabel || null,
        clockSecondsRemaining,
        clockRunning,
        eventType: resolvedType,
        pointsHome: customPointsHome,
        pointsAway: customPointsAway,
        actorName: actorName || null,
        payload: eventNotes ? { notes: eventNotes } : {},
      });

      setHomeScore(nextHome);
      setAwayScore(nextAway);
      setSuccessMessage("Event recorded.");
      setEventNotes("");
      setActivityLog((previous) => [
        `${nowTimeUtcLabel()}: ${customLabel ?? resolvedType} (+${customPointsHome}/+${customPointsAway})`,
        ...previous,
      ]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function applyTeamMetric(metricKey: string, delta: number) {
    const currentStats = teamStatsById[selectedTeamStatTargetId] ?? {};
    const currentValue = currentStats[metricKey] ?? 0;
    const nextValue = Math.max(0, currentValue + delta);

    if (nextValue === currentValue) {
      return;
    }

    const nextStats = {
      ...currentStats,
      [metricKey]: nextValue,
    };

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await postStatsAction({
        action: "upsert_team_stats",
        teamId: selectedTeamStatTargetId,
        stats: nextStats,
      });

      setTeamStatsById((previous) => ({
        ...previous,
        [selectedTeamStatTargetId]: nextStats,
      }));

      const teamName = teamNameById[selectedTeamStatTargetId] ?? "Team";
      const label = teamMetricLabels[metricKey] ?? toMetricLabelFromKey(metricKey);
      setSuccessMessage(`${teamName}: ${label} updated.`);
      setActivityLog((previous) => [
        `${nowTimeUtcLabel()}: ${teamName} ${label} ${delta > 0 ? "+1" : "-1"}`,
        ...previous,
      ]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function applyPlayerMetric(metricKey: string, delta: number) {
    if (!selectedPlayer) {
      setErrorMessage("Select a player before recording player stats.");
      return;
    }

    const existing = playerStatsById[selectedPlayer.playerId];
    const currentStats = existing?.stats ?? {};
    const currentValue = currentStats[metricKey] ?? 0;
    const nextValue = Math.max(0, currentValue + delta);

    if (nextValue === currentValue) {
      return;
    }

    const nextStats = {
      ...currentStats,
      [metricKey]: nextValue,
    };

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await postStatsAction({
        action: "upsert_player_stat",
        teamId: selectedPlayer.teamId,
        playerId: selectedPlayer.playerId,
        starter: existing?.starter ?? true,
        minutesPlayed: existing?.minutesPlayed ?? null,
        stats: nextStats,
      });

      setPlayerStatsById((previous) => ({
        ...previous,
        [selectedPlayer.playerId]: {
          teamId: selectedPlayer.teamId,
          starter: existing?.starter ?? true,
          minutesPlayed: existing?.minutesPlayed ?? null,
          stats: nextStats,
        },
      }));

      const label = playerMetricLabels[metricKey] ?? toMetricLabelFromKey(metricKey);
      setSuccessMessage(`${selectedPlayer.playerName}: ${label} updated.`);
      setActivityLog((previous) => [
        `${nowTimeUtcLabel()}: ${selectedPlayer.playerName} ${label} ${delta > 0 ? "+1" : "-1"}`,
        ...previous,
      ]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function applySlimMetric(metricKey: string, direction: -1 | 1) {
    const delta = direction * slimMetricStep;
    if (slimInputScope === "team") {
      await applyTeamMetric(metricKey, delta);
      return;
    }
    await applyPlayerMetric(metricKey, delta);
  }

  async function saveScorepad() {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await postScorekeeperAction({
        action: "save_scorepad",
        values: scorepadValues,
      });
      setSuccessMessage("Scorepad saved.");
      setActivityLog((previous) => [
        `${nowTimeUtcLabel()}: scorepad fields updated`,
        ...previous,
      ]);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      {!isSlim && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Professional Scorekeeper Console</h2>
          <p className="mt-1 text-sm text-slate-600">
            {initialGame.homeTeam} vs {initialGame.awayTeam} -{" "}
            {formatDateTimeUtc(initialGame.scheduledAt)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Sport: {initialGame.sportId} | Type: {initialGame.competitionType}
          </p>
        </article>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          {isSlim ? "Live Scoresheet" : "Live Scoreboard"}
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{initialGame.homeTeam}</p>
            <p className="mt-1 text-5xl font-bold text-slate-900">{homeScore}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setHomeScore((value) => Math.max(0, value - 1))}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => setHomeScore((value) => value + 1)}
                className="rounded-md bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
              >
                +1
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{initialGame.awayTeam}</p>
            <p className="mt-1 text-5xl font-bold text-slate-900">{awayScore}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAwayScore((value) => Math.max(0, value - 1))}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => setAwayScore((value) => value + 1)}
                className="rounded-md bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
              >
                +1
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as GameStatus)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="scheduled">scheduled</option>
              <option value="live">live</option>
              <option value="final">final</option>
              <option value="postponed">postponed</option>
              <option value="canceled">canceled</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Period</span>
            <input
              type="text"
              value={periodLabel}
              onChange={(event) => setPeriodLabel(event.target.value)}
              placeholder="Q4 or 3rd"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Clock</span>
            <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-lg font-bold text-slate-900">
              {formatClock(clockSecondsRemaining)}
            </div>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setClockRunning((value) => !value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {clockRunning ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              onClick={() =>
                setClockSecondsRemaining((value) => (value === null ? null : Math.max(0, value - 10)))
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              -10s
            </button>
            <button
              type="button"
              onClick={() => setClockSecondsRemaining((value) => (value === null ? null : value + 10))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              +10s
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={saveGameState}
          className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Save Scoreboard State
        </button>
      </article>

      {isSlim && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Quick Stat Entry</h3>
          <p className="mt-1 text-sm text-slate-600">
            Select target, then tap stat buttons. This view is optimized for live operators.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSlimInputScope("team")}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                slimInputScope === "team"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              Team Stats
            </button>
            <button
              type="button"
              onClick={() => setSlimInputScope("player")}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                slimInputScope === "player"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              Player Stats
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-800">
                {slimInputScope === "team" ? "Tracking Team" : "Player Team"}
              </span>
              <select
                value={slimInputScope === "team" ? selectedTeamStatTargetId : selectedPlayerTeamFilterId}
                onChange={(event) => {
                  if (slimInputScope === "team") {
                    setSelectedTeamStatTargetId(event.target.value);
                    return;
                  }
                  setSelectedPlayerTeamFilterId(event.target.value);
                }}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                {(slimInputScope === "team"
                  ? [initialGame.homeTeamId, initialGame.awayTeamId]
                  : Array.from(playerTrackedTeamIds)
                ).map((teamId) => (
                  <option key={teamId} value={teamId}>
                    {teamNameById[teamId] ?? "Team"}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-800">Step</span>
              <select
                value={slimMetricStep}
                onChange={(event) => setSlimMetricStep(Number(event.target.value) || 1)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>

            {slimInputScope === "player" && (
              <label className="flex flex-col gap-1 text-sm md:col-span-1">
                <span className="font-medium text-slate-800">Player</span>
                <select
                  value={selectedPlayerId}
                  onChange={(event) => setSelectedPlayerId(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {filteredRosterPlayersForStats.map((player) => (
                    <option key={player.playerId} value={player.playerId}>
                      {player.playerName}
                      {player.jerseyNumber ? ` #${player.jerseyNumber}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {slimInputScope === "player" && filteredRosterPlayersForStats.length === 0 && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No tracked players available for this team.
            </p>
          )}

          {slimInputScope === "player" && selectedPlayer && (
            <p className="mt-3 text-sm text-slate-600">
              Active player: {selectedPlayer.playerName}
              {selectedPlayer.jerseyNumber ? ` #${selectedPlayer.jerseyNumber}` : ""} (
              {selectedPlayer.teamName})
            </p>
          )}

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {(slimInputScope === "team" ? trackedTeamMetrics : trackedPlayerMetrics).map((metricKey) => {
              const currentValue =
                slimInputScope === "team"
                  ? selectedTeamStats[metricKey] ?? 0
                  : selectedPlayerStats[metricKey] ?? 0;
              const label =
                slimInputScope === "team"
                  ? teamMetricLabels[metricKey] ?? toMetricLabelFromKey(metricKey)
                  : playerMetricLabels[metricKey] ?? toMetricLabelFromKey(metricKey);

              return (
                <article key={metricKey} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-2xl font-bold text-slate-900">{currentValue}</p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={isSaving || (slimInputScope === "player" && !selectedPlayer)}
                      onClick={() => {
                        void applySlimMetric(metricKey, 1);
                      }}
                      className="rounded-md bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
                    >
                      +{slimMetricStep}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || (slimInputScope === "player" && !selectedPlayer)}
                      onClick={() => {
                        void applySlimMetric(metricKey, -1);
                      }}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      -{slimMetricStep}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      )}

      {!isSlim && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Team Stat Pad</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="font-medium text-slate-700">Tracking Team:</label>
            <select
              value={selectedTeamStatTargetId}
              onChange={(event) => setSelectedTeamStatTargetId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value={initialGame.homeTeamId}>{initialGame.homeTeam}</option>
              <option value={initialGame.awayTeamId}>{initialGame.awayTeam}</option>
            </select>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {trackedTeamMetrics.map((metricKey) => {
              const currentValue = selectedTeamStats[metricKey] ?? 0;
              const label = teamMetricLabels[metricKey] ?? toMetricLabelFromKey(metricKey);
              return (
                <article key={metricKey} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-xl font-bold text-slate-900">{currentValue}</p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => applyTeamMetric(metricKey, 1)}
                      className="rounded-md bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => applyTeamMetric(metricKey, -1)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      -1
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          {isSlim ? "Scoring Actions" : "Quick Actions"}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {initialGame.quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={isSaving}
              onClick={() =>
                recordEvent(action.pointsHome, action.pointsAway, action.eventType, action.label)
              }
              className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
            >
              {action.label}
            </button>
          ))}
        </div>

        {!isSlim && (
          <>
            <h4 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Custom Event
            </h4>
            <div className="mt-2 grid gap-3 md:grid-cols-5">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-800">Operator</span>
                <input
                  type="text"
                  value={actorName}
                  onChange={(event) => setActorName(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-800">Event Type</span>
                <input
                  type="text"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-800">Home Delta</span>
                <input
                  type="number"
                  value={pointsHome}
                  onChange={(event) => setPointsHome(Number(event.target.value))}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-800">Away Delta</span>
                <input
                  type="number"
                  value={pointsAway}
                  onChange={(event) => setPointsAway(Number(event.target.value))}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => recordEvent(pointsHome, pointsAway)}
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  Record Event
                </button>
              </div>
            </div>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-800">Event Notes</span>
              <textarea
                value={eventNotes}
                onChange={(event) => setEventNotes(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-md border border-slate-300 p-3 text-sm"
              />
            </label>
          </>
        )}
      </article>

      {!isSlim && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Player Stat Pad</h3>
        <p className="mt-1 text-sm text-slate-600">
          Player stat tracking sides: {initialGame.trackedPlayerSides.join(", ") || "none"}
        </p>

        {rosterPlayersForStats.length === 0 && (
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No players for selected tracking sides. Pick home/away player stat scope in game setup.
          </p>
        )}

        {rosterPlayersForStats.length > 0 && (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Roster</p>
              <div className="mt-3 space-y-3">
                {Array.from(rosterByTeam.entries()).map(([teamName, players]) => (
                  <div key={teamName}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{teamName}</p>
                    <div className="mt-1 space-y-1">
                      {players.map((player) => (
                        <button
                          key={player.playerId}
                          type="button"
                          onClick={() => setSelectedPlayerId(player.playerId)}
                          className={`w-full rounded-md px-2 py-1 text-left text-sm ${
                            selectedPlayerId === player.playerId
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {player.playerName}
                          {player.jerseyNumber ? ` #${player.jerseyNumber}` : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 lg:col-span-2">
              {!selectedPlayer && (
                <p className="text-sm text-slate-600">Select a player to start tracking individual stats.</p>
              )}
              {selectedPlayer && (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedPlayer.playerName} - {selectedPlayer.teamName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Position: {selectedPlayer.position ?? "N/A"}
                    {selectedPlayer.jerseyNumber ? ` | Jersey #${selectedPlayer.jerseyNumber}` : ""}
                  </p>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {trackedPlayerMetrics.map((metricKey) => {
                      const currentValue = selectedPlayerStats[metricKey] ?? 0;
                      const label = playerMetricLabels[metricKey] ?? toMetricLabelFromKey(metricKey);
                      return (
                        <article key={metricKey} className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{label}</p>
                            <p className="text-xl font-bold text-slate-900">{currentValue}</p>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => applyPlayerMetric(metricKey, 1)}
                              className="rounded-md bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => applyPlayerMetric(metricKey, -1)}
                              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                            >
                              -1
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        </article>
      )}

      {!isSlim && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Scorepad Fields</h3>
          <p className="mt-1 text-sm text-slate-600">
            Game sheet details configured by director for this game.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {initialGame.scorepadFields.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-800">{field}</span>
                <input
                  type="text"
                  value={scorepadValues[field] ?? ""}
                  onChange={(event) =>
                    setScorepadValues((previous) => ({
                      ...previous,
                      [field]: event.target.value,
                    }))
                  }
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={saveScorepad}
            className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Save Scorepad
          </button>
        </article>
      )}

      {(successMessage || errorMessage) && (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {successMessage && <p className="text-sm font-semibold text-emerald-700">{successMessage}</p>}
          {errorMessage && <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>}
        </article>
      )}

      {!isSlim && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Live Event Timeline</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {events.length === 0 && (
              <li className="rounded-md bg-slate-50 p-3 text-slate-600">No events recorded yet.</li>
            )}
            {events.map((event) => (
              <li key={event.id} className="rounded-md bg-slate-50 p-3">
                <p className="font-medium text-slate-900">
                  {event.eventType} (+{event.pointsHome}/+{event.pointsAway})
                </p>
                <p className="text-slate-600">
                  {event.actorName ?? "Unknown"} - {formatTimeUtc(event.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </article>
      )}

      {!isSlim && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Session Activity</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {activityLog.length === 0 && (
              <li className="rounded-md bg-slate-50 p-3 text-slate-600">No local activity yet.</li>
            )}
            {activityLog.map((line) => (
              <li key={line} className="rounded-md bg-slate-50 p-3">
                {line}
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
