"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDateTimeUtc, todayUtcDate } from "@/lib/date-time";
import type { GameStatus, ScheduleBuilderData } from "@/lib/portal-types";
import {
  generateRoundRobinSchedule,
  type GeneratedSchedule,
  type ScheduleConstraints,
} from "@/lib/schedule-builder";

interface ScheduleBuilderConsoleProps {
  initialData: ScheduleBuilderData;
}

interface PublishResponse {
  insertedCount: number;
  skippedCount: number;
  missingTeams: string[];
  message: string;
  mode: "admin" | "restricted";
}

interface SeasonGameItem {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: string;
  status: GameStatus;
  venueName: string | null;
}

interface SeasonGamesResponse {
  seasonId: string;
  games: SeasonGameItem[];
}

interface ScheduleChangeResponse {
  ok: boolean;
  gameId: string;
  reason: string;
  conflictCount: number;
  conflicts: Array<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    scheduled_at: string;
    status: GameStatus;
  }>;
  game: {
    scheduledAt: string;
    status: GameStatus;
    venueName: string | null;
  };
}

function downloadCsv(schedule: GeneratedSchedule) {
  const header = "round,game_number,home_team,away_team,scheduled_at";
  const rows = schedule.games.map(
    (game) =>
      `${game.round},${game.gameNumber},"${game.homeTeam.replaceAll('"', '""')}","${game.awayTeam.replaceAll('"', '""')}",${game.scheduledAt}`,
  );
  const content = [header, ...rows].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "round_robin_schedule.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toDateInputValue(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(isoValue: string): string {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return "19:00";
  }
  const hour = String(parsed.getUTCHours()).padStart(2, "0");
  const minute = String(parsed.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function toIsoFromDateTimeInputs(dateInput: string, timeInput: string): string | null {
  if (!dateInput || !timeInput) {
    return null;
  }
  const parsed = new Date(`${dateInput}T${timeInput}:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function ScheduleBuilderConsole({ initialData }: ScheduleBuilderConsoleProps) {
  const [selectedLeagueId, setSelectedLeagueId] = useState(initialData.leagues[0]?.leagueId ?? "");
  const [teamsText, setTeamsText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [roundIntervalDays, setRoundIntervalDays] = useState(2);
  const [maxGamesPerDay, setMaxGamesPerDay] = useState(3);
  const [gameSpacingMinutes, setGameSpacingMinutes] = useState(120);
  const [includeReverseFixtures, setIncludeReverseFixtures] = useState(false);
  const [blackoutInput, setBlackoutInput] = useState("");
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);
  const [seasonGames, setSeasonGames] = useState<SeasonGameItem[]>([]);
  const [isLoadingSeasonGames, setIsLoadingSeasonGames] = useState(false);
  const [seasonGamesError, setSeasonGamesError] = useState<string | null>(null);
  const [selectedChangeGameId, setSelectedChangeGameId] = useState("");
  const [changeDate, setChangeDate] = useState("");
  const [changeTime, setChangeTime] = useState("19:00");
  const [changeStatus, setChangeStatus] = useState<GameStatus>("scheduled");
  const [changeVenueName, setChangeVenueName] = useState("");
  const [changeReason, setChangeReason] = useState("Director requested change");
  const [isApplyingChange, setIsApplyingChange] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeResult, setChangeResult] = useState<ScheduleChangeResponse | null>(null);

  const selectedLeague = useMemo(
    () => initialData.leagues.find((league) => league.leagueId === selectedLeagueId) ?? null,
    [initialData.leagues, selectedLeagueId],
  );

  useEffect(() => {
    if (!selectedLeague) {
      setTeamsText("");
      return;
    }
    setTeamsText(selectedLeague.teams.map((team) => team.name).join("\n"));
  }, [selectedLeague]);

  useEffect(() => {
    if (startDate) {
      return;
    }
    setStartDate(todayUtcDate());
  }, [startDate]);

  const teams = useMemo(
    () =>
      teamsText
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    [teamsText],
  );

  const selectedSeasonGame = useMemo(
    () => seasonGames.find((game) => game.gameId === selectedChangeGameId) ?? null,
    [seasonGames, selectedChangeGameId],
  );

  useEffect(() => {
    if (!selectedLeague) {
      setSeasonGames([]);
      setSelectedChangeGameId("");
      return;
    }
    setSeasonGames([]);
    setSelectedChangeGameId("");
  }, [selectedLeague]);

  useEffect(() => {
    if (!selectedSeasonGame) {
      return;
    }
    setChangeDate(toDateInputValue(selectedSeasonGame.scheduledAt));
    setChangeTime(toTimeInputValue(selectedSeasonGame.scheduledAt));
    setChangeStatus(selectedSeasonGame.status);
    setChangeVenueName(selectedSeasonGame.venueName ?? "");
  }, [selectedSeasonGame]);

  function onGenerate() {
    const constraints: ScheduleConstraints = {
      startDate: startDate || todayUtcDate(),
      startTime,
      roundIntervalDays: Math.max(1, roundIntervalDays),
      maxGamesPerDay: Math.max(1, maxGamesPerDay),
      gameSpacingMinutes: Math.max(30, gameSpacingMinutes),
      blackoutDates: blackoutInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      includeReverseFixtures,
    };

    const generated = generateRoundRobinSchedule(teams, constraints);
    setSchedule(generated);
    setPublishResult(null);
    setPublishError(null);
  }

  async function onPublish() {
    if (!selectedLeague || !schedule || schedule.games.length === 0) {
      setPublishError("Generate a schedule before publishing.");
      return;
    }

    setIsPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      const response = await fetch("/api/admin/schedule/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leagueId: selectedLeague.leagueId,
          seasonId: selectedLeague.seasonId,
          sportId: selectedLeague.sportId,
          games: schedule.games.map((game) => ({
            round: game.round,
            homeTeamName: game.homeTeam,
            awayTeamName: game.awayTeam,
            scheduledAt: game.scheduledAt,
          })),
        }),
      });

      const body = (await response.json()) as PublishResponse | { error: string };
      if (!response.ok) {
        setPublishError((body as { error?: string }).error ?? "Publish failed.");
        return;
      }

      setPublishResult(body as PublishResponse);
    } catch {
      setPublishError("Publish request failed. Check your connection and try again.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function loadSeasonGames() {
    if (!selectedLeague) {
      setSeasonGamesError("Select a league/season first.");
      return;
    }

    setIsLoadingSeasonGames(true);
    setSeasonGamesError(null);
    setChangeResult(null);
    setChangeError(null);

    try {
      const response = await fetch("/api/admin/schedule/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seasonId: selectedLeague.seasonId,
        }),
      });
      const body = (await response.json()) as SeasonGamesResponse | { error?: string };
      if (!response.ok) {
        setSeasonGamesError((body as { error?: string }).error ?? "Failed to load season games.");
        return;
      }

      const rows = (body as SeasonGamesResponse).games;
      setSeasonGames(rows);
      setSelectedChangeGameId(rows[0]?.gameId ?? "");
    } catch {
      setSeasonGamesError("Failed to load season games.");
    } finally {
      setIsLoadingSeasonGames(false);
    }
  }

  async function applyScheduleChange() {
    if (!selectedSeasonGame) {
      setChangeError("Select a game to update.");
      return;
    }

    const nextScheduledAt = toIsoFromDateTimeInputs(changeDate, changeTime);
    if (!nextScheduledAt) {
      setChangeError("Provide valid UTC date and time.");
      return;
    }

    setIsApplyingChange(true);
    setChangeError(null);
    setChangeResult(null);

    try {
      const response = await fetch("/api/admin/schedule/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: selectedSeasonGame.gameId,
          scheduledAt: nextScheduledAt,
          status: changeStatus,
          venueName: changeVenueName,
          reason: changeReason,
        }),
      });
      const body = (await response.json()) as ScheduleChangeResponse | { error?: string };
      if (!response.ok) {
        setChangeError((body as { error?: string }).error ?? "Failed to apply schedule change.");
        return;
      }

      const result = body as ScheduleChangeResponse;
      setChangeResult(result);
      setSeasonGames((previous) =>
        previous.map((game) =>
          game.gameId === result.gameId
            ? {
                ...game,
                scheduledAt: result.game.scheduledAt,
                status: result.game.status,
                venueName: result.game.venueName,
              }
            : game,
        ),
      );
    } catch {
      setChangeError("Failed to apply schedule change.");
    } finally {
      setIsApplyingChange(false);
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Round-Robin Scheduler</h2>
        <p className="mt-1 text-sm text-slate-600">
          Generate and publish schedules to Supabase so games remain visible after leaving this page.
        </p>
        <p className="mt-1 text-sm text-slate-600">{initialData.statusMessage}</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-800">League + Season</span>
              <select
                value={selectedLeagueId}
                onChange={(event) => setSelectedLeagueId(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                {initialData.leagues.length === 0 && <option value="">No available leagues</option>}
                {initialData.leagues.map((league) => (
                  <option key={league.leagueId} value={league.leagueId}>
                    {league.leagueName} - {league.seasonName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-800">Teams (one per line)</span>
              <textarea
                value={teamsText}
                onChange={(event) => setTeamsText(event.target.value)}
                className="min-h-48 rounded-md border border-slate-300 p-3 font-mono text-xs"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                if (selectedLeague) {
                  setTeamsText(selectedLeague.teams.map((team) => team.name).join("\n"));
                }
              }}
              disabled={!selectedLeague}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Load Teams From League
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-800">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-800">Start Time</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-800">Round Interval (days)</span>
              <input
                type="number"
                min={1}
                value={roundIntervalDays}
                onChange={(event) => setRoundIntervalDays(Number(event.target.value))}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-800">Max Games Per Day</span>
              <input
                type="number"
                min={1}
                value={maxGamesPerDay}
                onChange={(event) => setMaxGamesPerDay(Number(event.target.value))}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Game Spacing (minutes)</span>
              <input
                type="number"
                min={30}
                value={gameSpacingMinutes}
                onChange={(event) => setGameSpacingMinutes(Number(event.target.value))}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Blackout Dates (comma-separated)</span>
              <input
                type="text"
                placeholder="2026-04-12, 2026-04-13"
                value={blackoutInput}
                onChange={(event) => setBlackoutInput(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={includeReverseFixtures}
                onChange={(event) => setIncludeReverseFixtures(event.target.checked)}
              />
              <span className="font-medium text-slate-800">
                Include reverse fixtures (home/away swap second half)
              </span>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onGenerate}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Generate Schedule
          </button>
          <button
            type="button"
            onClick={() => schedule && downloadCsv(schedule)}
            disabled={!schedule || schedule.games.length === 0}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={!schedule || schedule.games.length === 0 || !selectedLeague || isPublishing}
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPublishing ? "Publishing..." : "Publish To Games"}
          </button>
        </div>

        {publishError && (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {publishError}
          </p>
        )}

        {publishResult && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <p className="font-semibold">
              Published {publishResult.insertedCount} game(s), skipped {publishResult.skippedCount} existing game(s).
            </p>
            <p className="mt-1">{publishResult.message}</p>
            {publishResult.missingTeams.length > 0 && (
              <p className="mt-1">
                Missing team names: {publishResult.missingTeams.join(", ")}
              </p>
            )}
            {selectedLeague && (
              <p className="mt-2">
                View results on{" "}
                <Link href={`/leagues/${selectedLeague.leagueId}`} className="font-semibold underline">
                  league page
                </Link>{" "}
                or the dashboard.
              </p>
            )}
          </div>
        )}
      </article>

      {schedule && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Generated Output</h3>
          <p className="mt-1 text-sm text-slate-600">
            {schedule.teamCount} teams - {schedule.roundCount} rounds - {schedule.gameCount} games
            {schedule.byesPerRound > 0 ? ` - ${schedule.byesPerRound} bye per round` : ""}
          </p>

          <div className="mt-4 max-h-96 overflow-auto rounded-md border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Round</th>
                  <th className="px-3 py-2">Home</th>
                  <th className="px-3 py-2">Away</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {schedule.games.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-600">
                      Add at least two teams to generate a schedule.
                    </td>
                  </tr>
                )}
                {schedule.games.map((game) => (
                  <tr key={game.gameNumber} className="border-t border-slate-100">
                    <td className="px-3 py-2">{game.round}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{game.homeTeam}</td>
                    <td className="px-3 py-2">{game.awayTeam}</td>
                    <td className="px-3 py-2">{formatDateTimeUtc(game.scheduledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Ad-hoc Schedule Changes</h3>
        <p className="mt-1 text-sm text-slate-600">
          Update existing game date/time/status/venue without rebuilding the full schedule.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!selectedLeague || isLoadingSeasonGames}
            onClick={loadSeasonGames}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {isLoadingSeasonGames ? "Loading..." : "Load Season Games"}
          </button>
          {selectedLeague && (
            <p className="self-center text-xs text-slate-500">
              Season: {selectedLeague.seasonName} ({selectedLeague.leagueName})
            </p>
          )}
        </div>

        {seasonGamesError && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {seasonGamesError}
          </p>
        )}

        {seasonGames.length > 0 && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-800">Game</span>
                <select
                  value={selectedChangeGameId}
                  onChange={(event) => setSelectedChangeGameId(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                >
                  {seasonGames.map((game) => (
                    <option key={game.gameId} value={game.gameId}>
                      {game.homeTeamName} vs {game.awayTeamName} - {formatDateTimeUtc(game.scheduledAt)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedSeasonGame && (
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-800">New Date (UTC)</span>
                  <input
                    type="date"
                    value={changeDate}
                    onChange={(event) => setChangeDate(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-800">New Time (UTC)</span>
                  <input
                    type="time"
                    value={changeTime}
                    onChange={(event) => setChangeTime(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-800">Status</span>
                  <select
                    value={changeStatus}
                    onChange={(event) => setChangeStatus(event.target.value as GameStatus)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="live">live</option>
                    <option value="final">final</option>
                    <option value="postponed">postponed</option>
                    <option value="canceled">canceled</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm md:col-span-2">
                  <span className="font-medium text-slate-800">Venue</span>
                  <input
                    type="text"
                    value={changeVenueName}
                    onChange={(event) => setChangeVenueName(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm md:col-span-2 lg:col-span-3">
                  <span className="font-medium text-slate-800">Reason</span>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(event) => setChangeReason(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedSeasonGame || isApplyingChange}
              onClick={applyScheduleChange}
              className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {isApplyingChange ? "Applying Change..." : "Apply Schedule Change"}
            </button>
          </>
        )}

        {changeError && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {changeError}
          </p>
        )}

        {changeResult && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <p className="font-semibold">
              Schedule updated. Conflict count: {changeResult.conflictCount}
            </p>
            {changeResult.conflicts.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-emerald-900">
                {changeResult.conflicts.slice(0, 8).map((conflict) => (
                  <li key={conflict.id}>
                    Conflict game {conflict.id}: {formatDateTimeUtc(conflict.scheduled_at)} ({conflict.status})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
