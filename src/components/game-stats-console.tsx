"use client";

import { useMemo, useState } from "react";
import type { GameRosterPlayerOption, GameStatsDetails, PlayerGameStatLine } from "@/lib/portal-types";

interface GameStatsConsoleProps {
  gameStats: GameStatsDetails;
  rosterPlayers: GameRosterPlayerOption[];
}

interface ParsedMetrics {
  metrics: Record<string, number>;
  errors: string[];
}

function metricsToText(metrics: Array<{ key: string; value: number }>): string {
  return metrics.map((metric) => `${metric.key}=${metric.value}`).join("\n");
}

function parseMetricsText(input: string): ParsedMetrics {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metrics: Record<string, number> = {};
  const errors: string[] = [];

  for (const line of lines) {
    const [rawKey, rawValue] = line.split("=");
    const key = rawKey?.trim() ?? "";
    const valueString = rawValue?.trim() ?? "";

    if (!key || !valueString) {
      errors.push(`Invalid line: "${line}" (use key=value)`);
      continue;
    }

    const value = Number(valueString);
    if (Number.isNaN(value)) {
      errors.push(`Metric "${key}" has non-numeric value "${valueString}"`);
      continue;
    }

    metrics[key] = value;
  }

  return { metrics, errors };
}

export function GameStatsConsole({ gameStats, rosterPlayers }: GameStatsConsoleProps) {
  const [homeMetricsText, setHomeMetricsText] = useState(metricsToText(gameStats.homeTeam.metrics));
  const [awayMetricsText, setAwayMetricsText] = useState(metricsToText(gameStats.awayTeam.metrics));

  const [playerStats, setPlayerStats] = useState<PlayerGameStatLine[]>(gameStats.playerStats);
  const [selectedPlayerId, setSelectedPlayerId] = useState(rosterPlayers[0]?.playerId ?? "");
  const [playerMinutes, setPlayerMinutes] = useState("0");
  const [playerStarter, setPlayerStarter] = useState(true);
  const [playerMetricsText, setPlayerMetricsText] = useState("goals=0\nassists=0");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPlayer = useMemo(
    () => rosterPlayers.find((player) => player.playerId === selectedPlayerId) ?? null,
    [rosterPlayers, selectedPlayerId],
  );

  const playerStatMap = useMemo(() => {
    const map = new Map<string, PlayerGameStatLine>();
    for (const row of playerStats) {
      map.set(row.playerId, row);
    }
    return map;
  }, [playerStats]);

  function hydrateFromExistingPlayer(playerId: string) {
    const existing = playerStatMap.get(playerId);
    if (!existing) {
      setPlayerStarter(true);
      setPlayerMinutes("0");
      setPlayerMetricsText("goals=0\nassists=0");
      return;
    }
    setPlayerStarter(existing.starter);
    setPlayerMinutes(String(existing.minutesPlayed ?? 0));
    setPlayerMetricsText(metricsToText(existing.stats.map((metric) => ({ key: metric.key, value: metric.value }))));
  }

  async function saveTeamStats(teamId: string, metricsText: string) {
    setError(null);
    setMessage(null);

    const parsed = parseMetricsText(metricsText);
    if (parsed.errors.length > 0) {
      setError(parsed.errors.join(" | "));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/games/${gameStats.gameId}/stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "upsert_team_stats",
          teamId,
          stats: parsed.metrics,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Failed to save team stats.");
        return;
      }

      setMessage("Team stats saved.");
    } catch {
      setError("Request failed while saving team stats.");
    } finally {
      setIsSaving(false);
    }
  }

  async function savePlayerStat() {
    if (!selectedPlayer) {
      setError("Select a player first.");
      return;
    }

    setError(null);
    setMessage(null);

    const parsed = parseMetricsText(playerMetricsText);
    if (parsed.errors.length > 0) {
      setError(parsed.errors.join(" | "));
      return;
    }

    const minutes = Number(playerMinutes);
    const minutesValue = Number.isNaN(minutes) ? null : minutes;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/games/${gameStats.gameId}/stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "upsert_player_stat",
          teamId: selectedPlayer.teamId,
          playerId: selectedPlayer.playerId,
          starter: playerStarter,
          minutesPlayed: minutesValue,
          stats: parsed.metrics,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Failed to save player stat.");
        return;
      }

      const statsRows = Object.entries(parsed.metrics).map(([key, value]) => ({
        key,
        label: key
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        value,
      }));

      setPlayerStats((previous) => {
        const without = previous.filter((row) => row.playerId !== selectedPlayer.playerId);
        return [
          ...without,
          {
            playerId: selectedPlayer.playerId,
            playerName: selectedPlayer.playerName,
            teamId: selectedPlayer.teamId,
            teamName: selectedPlayer.teamName,
            position: selectedPlayer.position,
            jerseyNumber: selectedPlayer.jerseyNumber,
            starter: playerStarter,
            minutesPlayed: minutesValue,
            stats: statsRows,
          },
        ].sort((a, b) => a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName));
      });

      setMessage("Player stat row saved.");
    } catch {
      setError("Request failed while saving player stat.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePlayerStat(playerId: string) {
    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/games/${gameStats.gameId}/stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete_player_stat",
          playerId,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Failed to delete player stat.");
        return;
      }

      setPlayerStats((previous) => previous.filter((row) => row.playerId !== playerId));
      setMessage("Player stat row deleted.");
    } catch {
      setError("Request failed while deleting player stat.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Team Stats Editor</h2>
        <p className="mt-1 text-sm text-slate-600">Use one metric per line: `metric_key=value`</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">{gameStats.homeTeam.teamName}</span>
            <textarea
              value={homeMetricsText}
              onChange={(event) => setHomeMetricsText(event.target.value)}
              className="min-h-36 rounded-md border border-slate-300 p-3 font-mono text-xs"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={() => saveTeamStats(gameStats.homeTeam.teamId, homeMetricsText)}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Save {gameStats.homeTeam.teamName} Stats
            </button>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">{gameStats.awayTeam.teamName}</span>
            <textarea
              value={awayMetricsText}
              onChange={(event) => setAwayMetricsText(event.target.value)}
              className="min-h-36 rounded-md border border-slate-300 p-3 font-mono text-xs"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={() => saveTeamStats(gameStats.awayTeam.teamId, awayMetricsText)}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Save {gameStats.awayTeam.teamName} Stats
            </button>
          </label>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Player Stats Editor</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-800">Player</span>
            <select
              value={selectedPlayerId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedPlayerId(value);
                hydrateFromExistingPlayer(value);
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {rosterPlayers.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.playerName} - {player.teamName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Minutes</span>
            <input
              type="number"
              step="0.1"
              value={playerMinutes}
              onChange={(event) => setPlayerMinutes(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              checked={playerStarter}
              onChange={(event) => setPlayerStarter(event.target.checked)}
            />
            <span className="font-medium text-slate-800">Starter</span>
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">Player Metrics (`key=value` per line)</span>
          <textarea
            value={playerMetricsText}
            onChange={(event) => setPlayerMetricsText(event.target.value)}
            className="min-h-32 rounded-md border border-slate-300 p-3 font-mono text-xs"
          />
        </label>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={isSaving || !selectedPlayer}
            onClick={savePlayerStat}
            className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
          >
            Save Player Stat
          </button>
          <button
            type="button"
            disabled={isSaving || !selectedPlayer}
            onClick={() => selectedPlayer && deletePlayerStat(selectedPlayer.playerId)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Delete Player Stat
          </button>
        </div>
      </article>

      {(message || error) && (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {message && <p className="text-sm font-semibold text-emerald-700">{message}</p>}
          {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
        </article>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Current Player Rows</h3>
        <ul className="mt-3 space-y-2">
          {playerStats.length === 0 && (
            <li className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No player stats entered yet.
            </li>
          )}
          {playerStats.map((row) => (
            <li key={row.playerId} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {row.playerName} - {row.teamName}
              </p>
              <p className="text-slate-600">
                {row.position ?? "N/A"} #{row.jerseyNumber ?? "N/A"} - {row.minutesPlayed ?? 0} min
              </p>
              <p className="mt-1 text-slate-700">
                {row.stats.map((stat) => `${stat.label}: ${stat.value}`).join(" | ")}
              </p>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
