"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ScheduleBuilderData } from "@/lib/portal-types";
import type { SportProfile } from "@/lib/sport-config";

interface GameSetupWizardProps {
  scheduleData: ScheduleBuilderData;
  sportProfiles: SportProfile[];
}

interface CreateGameResponse {
  gameId: string;
  scorekeeperUrl: string;
  scoresheetUrl: string;
  publicLiveUrl: string;
  publicStatsUrl: string;
}

type SetupPresetId = "quick_live" | "league_full" | "single_side";

function toLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toUniqueLines(input: string[]): string[] {
  return Array.from(new Set(input.map((line) => line.trim()).filter(Boolean)));
}

export function GameSetupWizard({ scheduleData, sportProfiles }: GameSetupWizardProps) {
  const [competitionType, setCompetitionType] = useState<"ad_hoc" | "league" | "tournament">(
    "ad_hoc",
  );
  const [competitionName, setCompetitionName] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState(scheduleData.leagues[0]?.leagueId ?? "");
  const [sportId, setSportId] = useState(sportProfiles[0]?.id ?? "hockey");
  const [homeTeamName, setHomeTeamName] = useState("Home Team");
  const [awayTeamName, setAwayTeamName] = useState("Away Team");
  const [selectedHomeTeamOptionId, setSelectedHomeTeamOptionId] = useState("");
  const [selectedAwayTeamOptionId, setSelectedAwayTeamOptionId] = useState("");
  const [homePlayersText, setHomePlayersText] = useState("");
  const [awayPlayersText, setAwayPlayersText] = useState("");
  const [selectedTeamMetricKeys, setSelectedTeamMetricKeys] = useState<string[]>([]);
  const [selectedPlayerMetricKeys, setSelectedPlayerMetricKeys] = useState<string[]>([]);
  const [customTeamMetricsText, setCustomTeamMetricsText] = useState("");
  const [customPlayerMetricsText, setCustomPlayerMetricsText] = useState("");
  const [scorepadFieldsText, setScorepadFieldsText] = useState("");
  const [trackHomePlayerStats, setTrackHomePlayerStats] = useState(true);
  const [trackAwayPlayerStats, setTrackAwayPlayerStats] = useState(true);
  const [startNow, setStartNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [openAfterCreateTarget, setOpenAfterCreateTarget] = useState<
    "scoresheet" | "scorekeeper" | "public_live" | "stay_here"
  >("scoresheet");

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateGameResponse | null>(null);

  const selectedLeague = useMemo(
    () => scheduleData.leagues.find((league) => league.leagueId === selectedLeagueId) ?? null,
    [scheduleData.leagues, selectedLeagueId],
  );

  const selectedSport = useMemo(
    () => sportProfiles.find((profile) => profile.id === sportId) ?? sportProfiles[0],
    [sportId, sportProfiles],
  );

  const teamOptions = useMemo(() => {
    const sourceLeagues =
      competitionType === "league" && selectedLeague ? [selectedLeague] : scheduleData.leagues;

    return sourceLeagues.flatMap((league) =>
      league.teams.map((team) => ({
        id: team.id,
        name: team.name,
        leagueName: league.leagueName,
        leagueId: league.leagueId,
      })),
    );
  }, [competitionType, scheduleData.leagues, selectedLeague]);

  useEffect(() => {
    if (!selectedSport) {
      return;
    }

    setSelectedTeamMetricKeys(selectedSport.defaultTeamMetrics);
    setSelectedPlayerMetricKeys(selectedSport.defaultPlayerMetrics);
    setCustomTeamMetricsText("");
    setCustomPlayerMetricsText("");
  }, [selectedSport]);

  function applySportDefaultsFor(targetSportId: string) {
    const profile = sportProfiles.find((sport) => sport.id === targetSportId) ?? sportProfiles[0];
    if (!profile) {
      return;
    }

    setSelectedTeamMetricKeys(profile.defaultTeamMetrics);
    setSelectedPlayerMetricKeys(profile.defaultPlayerMetrics);
    setCustomTeamMetricsText("");
    setCustomPlayerMetricsText("");
    setScorepadFieldsText(profile.defaultScorepadFields.join("\n"));
  }

  function loadSportDefaults() {
    if (!selectedSport?.id) {
      return;
    }
    applySportDefaultsFor(selectedSport.id);
  }

  function applySetupPreset(presetId: SetupPresetId) {
    setError(null);
    setCreated(null);

    if (presetId === "quick_live") {
      setCompetitionType("ad_hoc");
      setCompetitionName("");
      setTrackHomePlayerStats(true);
      setTrackAwayPlayerStats(true);
      setStartNow(true);
      setOpenAfterCreateTarget("scoresheet");
      applySportDefaultsFor(sportId);
      return;
    }

    if (presetId === "league_full") {
      const firstLeague = scheduleData.leagues[0] ?? null;
      const targetLeague =
        scheduleData.leagues.find((league) => league.leagueId === selectedLeagueId) ?? firstLeague;
      setCompetitionType("league");
      if (targetLeague) {
        setSelectedLeagueId(targetLeague.leagueId);
        setSportId(targetLeague.sportId);
        applySportDefaultsFor(targetLeague.sportId);
      } else {
        applySportDefaultsFor(sportId);
      }
      setTrackHomePlayerStats(true);
      setTrackAwayPlayerStats(true);
      setStartNow(false);
      setOpenAfterCreateTarget("scorekeeper");
      return;
    }

    setCompetitionType("ad_hoc");
    setCompetitionName("");
    setTrackHomePlayerStats(true);
    setTrackAwayPlayerStats(false);
    setStartNow(true);
    setOpenAfterCreateTarget("scoresheet");
    applySportDefaultsFor(sportId);
  }

  function swapSides() {
    setHomeTeamName(awayTeamName);
    setAwayTeamName(homeTeamName);
    setSelectedHomeTeamOptionId(selectedAwayTeamOptionId);
    setSelectedAwayTeamOptionId(selectedHomeTeamOptionId);
    setHomePlayersText(awayPlayersText);
    setAwayPlayersText(homePlayersText);
  }

  function toggleTeamMetric(metricKey: string) {
    setSelectedTeamMetricKeys((previous) =>
      previous.includes(metricKey)
        ? previous.filter((key) => key !== metricKey)
        : [...previous, metricKey],
    );
  }

  function togglePlayerMetric(metricKey: string) {
    setSelectedPlayerMetricKeys((previous) =>
      previous.includes(metricKey)
        ? previous.filter((key) => key !== metricKey)
        : [...previous, metricKey],
    );
  }

  function pickHomeTeam(optionId: string) {
    setSelectedHomeTeamOptionId(optionId);
    if (!optionId) {
      return;
    }
    const found = teamOptions.find((option) => option.id === optionId);
    if (found) {
      setHomeTeamName(found.name);
    }
  }

  function pickAwayTeam(optionId: string) {
    setSelectedAwayTeamOptionId(optionId);
    if (!optionId) {
      return;
    }
    const found = teamOptions.find((option) => option.id === optionId);
    if (found) {
      setAwayTeamName(found.name);
    }
  }

  async function onCreateGame() {
    setIsCreating(true);
    setError(null);
    setCreated(null);

    if (!trackHomePlayerStats && !trackAwayPlayerStats) {
      setError("Track player stats for at least one team.");
      setIsCreating(false);
      return;
    }
    if (
      selectedHomeTeamOptionId &&
      selectedAwayTeamOptionId &&
      selectedHomeTeamOptionId === selectedAwayTeamOptionId
    ) {
      setError("Home and away must be different teams.");
      setIsCreating(false);
      return;
    }

    const selectedHomeTeamOption = teamOptions.find((option) => option.id === selectedHomeTeamOptionId);
    const selectedAwayTeamOption = teamOptions.find((option) => option.id === selectedAwayTeamOptionId);
    if (
      selectedHomeTeamOption &&
      selectedAwayTeamOption &&
      selectedHomeTeamOption.leagueId !== selectedAwayTeamOption.leagueId
    ) {
      setError("Selected teams must belong to the same league.");
      setIsCreating(false);
      return;
    }

    const leaguePayload =
      competitionType === "league" && selectedLeague
        ? {
            leagueId: selectedLeague.leagueId,
            seasonId: selectedLeague.seasonId,
            sportId: selectedLeague.sportId,
          }
        : {};

    const trackedTeamMetrics = toUniqueLines([
      ...selectedTeamMetricKeys,
      ...toLines(customTeamMetricsText),
    ]);
    const trackedPlayerMetrics = toUniqueLines([
      ...selectedPlayerMetricKeys,
      ...toLines(customPlayerMetricsText),
    ]);

    try {
      const response = await fetch("/api/admin/games/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitionType,
          competitionName: competitionName.trim() || undefined,
          sportId,
          homeTeamId: selectedHomeTeamOptionId || undefined,
          awayTeamId: selectedAwayTeamOptionId || undefined,
          homeTeamName,
          awayTeamName,
          homePlayers: toLines(homePlayersText),
          awayPlayers: toLines(awayPlayersText),
          trackedTeamMetrics,
          trackedPlayerMetrics,
          trackHomePlayerStats,
          trackAwayPlayerStats,
          scorepadFields: toLines(scorepadFieldsText),
          startNow,
          scheduledAt: startNow ? undefined : scheduledAt,
          ...leaguePayload,
        }),
      });

      const body = (await response.json()) as CreateGameResponse | { error: string };
      if (!response.ok) {
        setError((body as { error?: string }).error ?? "Game creation failed.");
        return;
      }

      const createdGame = body as CreateGameResponse;
      setCreated(createdGame);

      if (openAfterCreateTarget !== "stay_here") {
        const destinationUrl =
          openAfterCreateTarget === "scoresheet"
            ? createdGame.scoresheetUrl
            : openAfterCreateTarget === "scorekeeper"
              ? createdGame.scorekeeperUrl
              : createdGame.publicLiveUrl;
        window.location.assign(destinationUrl);
      }
    } catch {
      setError("Request failed while creating game.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Create Game</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create ad-hoc, league, or tournament games with sport-specific scoring and stat templates.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applySetupPreset("quick_live")}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Quick Live Scrimmage
          </button>
          <button
            type="button"
            onClick={() => applySetupPreset("league_full")}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            League Game Preset
          </button>
          <button
            type="button"
            onClick={() => applySetupPreset("single_side")}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Single-Side Tracking
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">Game Type</span>
            <select
              value={competitionType}
              onChange={(event) =>
                setCompetitionType(event.target.value as "ad_hoc" | "league" | "tournament")
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="ad_hoc">Ad-hoc game</option>
              <option value="league">League game</option>
              <option value="tournament">Tournament game</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">Sport</span>
            <select
              value={sportId}
              onChange={(event) => setSportId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {sportProfiles.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </label>

          {(competitionType === "league" || competitionType === "tournament") && (
            <label className="flex flex-col gap-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-800">
                {competitionType === "league" ? "League Name (for new league)" : "Tournament Name"}
              </span>
              <input
                type="text"
                value={competitionName}
                onChange={(event) => setCompetitionName(event.target.value)}
                placeholder={competitionType === "league" ? "Metro Summer League" : "Spring Invitational 2026"}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          )}

          {competitionType === "league" && (
            <label className="flex flex-col gap-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-800">Existing League + Season (optional)</span>
              <select
                value={selectedLeagueId}
                onChange={(event) => setSelectedLeagueId(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Create new league from name above</option>
                {scheduleData.leagues.map((league) => (
                  <option key={league.leagueId} value={league.leagueId}>
                    {league.leagueName} - {league.seasonName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">Home Team</span>
            <select
              value={selectedHomeTeamOptionId}
              onChange={(event) => pickHomeTeam(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Type new team name</option>
              {teamOptions.map((option) => (
                <option key={`home-${option.id}`} value={option.id}>
                  {option.name} ({option.leagueName})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={homeTeamName}
              onChange={(event) => {
                setHomeTeamName(event.target.value);
                setSelectedHomeTeamOptionId("");
              }}
              placeholder="Home team name"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">Away Team</span>
            <select
              value={selectedAwayTeamOptionId}
              onChange={(event) => pickAwayTeam(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Type new team name</option>
              {teamOptions.map((option) => (
                <option key={`away-${option.id}`} value={option.id}>
                  {option.name} ({option.leagueName})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={awayTeamName}
              onChange={(event) => {
                setAwayTeamName(event.target.value);
                setSelectedAwayTeamOptionId("");
              }}
              placeholder="Away team name"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={swapSides}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Swap Home / Away
            </button>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Roster + Tracking Setup</h3>
          <button
            type="button"
            onClick={loadSportDefaults}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Load Sport Defaults
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">Home Players (optional, one per line)</span>
            <textarea
              value={homePlayersText}
              onChange={(event) => setHomePlayersText(event.target.value)}
              className="min-h-36 rounded-md border border-slate-300 p-3 font-mono text-xs"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-800">Away Players (optional, one per line)</span>
            <textarea
              value={awayPlayersText}
              onChange={(event) => setAwayPlayersText(event.target.value)}
              className="min-h-36 rounded-md border border-slate-300 p-3 font-mono text-xs"
            />
          </label>

          <article className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Team Metrics To Track</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(selectedSport?.teamMetricCatalog ?? []).map((metric) => (
                <label key={metric.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedTeamMetricKeys.includes(metric.key)}
                    onChange={() => toggleTeamMetric(metric.key)}
                  />
                  <span>{metric.label}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-800">Custom Team Metrics (optional, one key per line)</span>
              <textarea
                value={customTeamMetricsText}
                onChange={(event) => setCustomTeamMetricsText(event.target.value)}
                className="mt-1 min-h-20 rounded-md border border-slate-300 p-3 font-mono text-xs"
                placeholder="zone_entries"
              />
            </label>
          </article>

          <article className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Player Metrics To Track</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(selectedSport?.playerMetricCatalog ?? []).map((metric) => (
                <label key={metric.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedPlayerMetricKeys.includes(metric.key)}
                    onChange={() => togglePlayerMetric(metric.key)}
                  />
                  <span>{metric.label}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-slate-800">Custom Player Metrics (optional, one key per line)</span>
              <textarea
                value={customPlayerMetricsText}
                onChange={(event) => setCustomPlayerMetricsText(event.target.value)}
                className="mt-1 min-h-20 rounded-md border border-slate-300 p-3 font-mono text-xs"
                placeholder="screen_assists"
              />
            </label>
          </article>

          <article className="rounded-lg border border-slate-200 p-4 lg:col-span-2">
            <h4 className="text-sm font-semibold text-slate-900">Player Stats Scope</h4>
            <p className="mt-1 text-xs text-slate-500">
              Choose which side gets player-level stat tracking. The other side can stay team-level only.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={trackHomePlayerStats}
                  onChange={(event) => setTrackHomePlayerStats(event.target.checked)}
                />
                <span className="font-medium text-slate-800">Track Home Player Stats</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={trackAwayPlayerStats}
                  onChange={(event) => setTrackAwayPlayerStats(event.target.checked)}
                />
                <span className="font-medium text-slate-800">Track Away Player Stats</span>
              </label>
            </div>
          </article>

          <label className="flex flex-col gap-2 text-sm lg:col-span-2">
            <span className="font-medium text-slate-800">Scorepad Fields (one field per line)</span>
            <textarea
              value={scorepadFieldsText}
              onChange={(event) => setScorepadFieldsText(event.target.value)}
              className="min-h-24 rounded-md border border-slate-300 p-3 font-mono text-xs"
              placeholder="Referee"
            />
          </label>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Start Settings</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={startNow}
              onChange={(event) => setStartNow(event.target.checked)}
            />
            <span className="font-medium text-slate-800">Start game now (status = live)</span>
          </label>

          {!startNow && (
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-800">Scheduled At</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm md:col-span-3">
            <span className="font-medium text-slate-800">After Create</span>
            <select
              value={openAfterCreateTarget}
              onChange={(event) =>
                setOpenAfterCreateTarget(
                  event.target.value as "scoresheet" | "scorekeeper" | "public_live" | "stay_here",
                )
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="scoresheet">Open Slim Scoresheet</option>
              <option value="scorekeeper">Open Full Scorekeeper</option>
              <option value="public_live">Open Public Live</option>
              <option value="stay_here">Stay On Setup Page</option>
            </select>
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={isCreating}
            onClick={onCreateGame}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {isCreating
              ? "Creating..."
              : openAfterCreateTarget === "scoresheet"
                ? "Create Game + Open Slim Scoresheet"
                : openAfterCreateTarget === "scorekeeper"
                  ? "Create Game + Open Scorekeeper"
                  : openAfterCreateTarget === "public_live"
                    ? "Create Game + Open Public Live"
                    : "Create Game"}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {created && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <p className="font-semibold">Game created successfully.</p>
            <div className="mt-2 flex flex-wrap gap-3 font-semibold">
              <Link href={created.scorekeeperUrl} className="underline">
                Open Scorekeeper
              </Link>
              <Link href={created.scoresheetUrl} className="underline">
                Open Slim Scoresheet
              </Link>
              <Link href={created.publicLiveUrl} className="underline">
                Open Public Live
              </Link>
              <Link href={created.publicStatsUrl} className="underline">
                Open Public Stats
              </Link>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
