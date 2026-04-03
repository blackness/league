import {
  demoAdminDashboardData,
  demoGameRosterPlayers,
  demoGameStats,
  demoLeague,
  demoLiveGame,
  demoOverview,
  demoScheduleBuilderData,
  demoTeamComparison,
  demoTeam,
} from "@/lib/demo-data";
import type { Database } from "@/lib/database.types";
import type {
  AdminDashboardData,
  GameRosterPlayerOption,
  GameStatsDetails,
  GameStatus,
  GameSummary,
  LeagueDetails,
  LiveGameDetails,
  PublicTeamOption,
  PortalOverview,
  ScheduleBuilderData,
  StatMetric,
  TeamComparisonDetails,
  TeamDetails,
} from "@/lib/portal-types";
import { parseGameMetadata } from "@/lib/game-metadata";
import { toMetricLabelFromKey, toStatMetrics } from "@/lib/metrics";
import { getEmbedUrl } from "@/lib/streams";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";

interface TeamNameMap {
  [teamId: string]: string;
}

interface LeagueNameMap {
  [leagueId: string]: string;
}

interface SportNameMap {
  [sportId: string]: string;
}

type BasicGameRow = Pick<
  Database["public"]["Tables"]["games"]["Row"],
  | "id"
  | "league_id"
  | "home_team_id"
  | "away_team_id"
  | "home_score"
  | "away_score"
  | "status"
  | "period_label"
  | "scheduled_at"
>;

type TeamGameRow = Pick<
  Database["public"]["Tables"]["games"]["Row"],
  | "id"
  | "league_id"
  | "home_team_id"
  | "away_team_id"
  | "home_score"
  | "away_score"
  | "status"
  | "period_label"
  | "scheduled_at"
  | "stream_provider"
  | "stream_url"
  | "venue_name"
>;

type ScorekeeperGameRow = Pick<
  Database["public"]["Tables"]["games"]["Row"],
  | "id"
  | "league_id"
  | "sport_id"
  | "metadata"
  | "home_team_id"
  | "away_team_id"
  | "home_score"
  | "away_score"
  | "status"
  | "period_label"
  | "scheduled_at"
>;

function getStatusMessage(mode: "connected" | "demo", statusMessage: string): string {
  return mode === "connected"
    ? statusMessage
    : "Demo mode: connect Supabase env variables to display your live league data.";
}

function toGameSummary(
  row: BasicGameRow,
  teamNames: TeamNameMap,
  leagueNames: LeagueNameMap,
): GameSummary {
  return {
    id: row.id,
    leagueName: leagueNames[row.league_id] ?? "League",
    homeTeam: teamNames[row.home_team_id] ?? "Home Team",
    awayTeam: teamNames[row.away_team_id] ?? "Away Team",
    homeScore: row.home_score ?? 0,
    awayScore: row.away_score ?? 0,
    status: row.status as GameStatus,
    periodLabel: row.period_label,
    scheduledAt: row.scheduled_at,
  };
}

async function buildTeamMap(teamIds: string[]): Promise<TeamNameMap> {
  const client = createSupabaseServerClient();

  if (!client || teamIds.length === 0) {
    return {};
  }

  const { data } = await client.from("teams").select("id, name").in("id", teamIds);
  const rows = (data ?? []) as Array<{ id: string; name: string }>;

  const map: TeamNameMap = {};
  for (const team of rows) {
    map[team.id] = team.name;
  }

  return map;
}

async function buildLeagueMap(leagueIds: string[]): Promise<LeagueNameMap> {
  const client = createSupabaseServerClient();

  if (!client || leagueIds.length === 0) {
    return {};
  }

  const { data } = await client.from("leagues").select("id, name").in("id", leagueIds);
  const rows = (data ?? []) as Array<{ id: string; name: string }>;

  const map: LeagueNameMap = {};
  for (const league of rows) {
    map[league.id] = league.name;
  }

  return map;
}

async function buildSportMap(sportIds: string[]): Promise<SportNameMap> {
  const client = createSupabaseServerClient();

  if (!client || sportIds.length === 0) {
    return {};
  }

  const { data } = await client.from("sports").select("id, name").in("id", sportIds);
  const rows = (data ?? []) as Array<{ id: string; name: string }>;

  const map: SportNameMap = {};
  for (const sport of rows) {
    map[sport.id] = sport.name;
  }

  return map;
}

export async function getPortalOverview(): Promise<PortalOverview> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return demoOverview;
  }

  const [leagueResult, liveResult, upcomingResult] = await Promise.all([
    client.from("leagues").select("id, name, sport_id").order("name", { ascending: true }).limit(8),
    client
      .from("games")
      .select("id, league_id, home_team_id, away_team_id, home_score, away_score, status, period_label, scheduled_at")
      .eq("status", "live")
      .order("scheduled_at", { ascending: false })
      .limit(6),
    client
      .from("games")
      .select("id, league_id, home_team_id, away_team_id, home_score, away_score, status, period_label, scheduled_at")
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(6),
  ]);

  if (leagueResult.error || liveResult.error || upcomingResult.error) {
    return {
      ...demoOverview,
      statusMessage:
        "Connected mode failed because one or more tables are missing. Run supabase/schema.sql in your project SQL Editor.",
    };
  }

  const leagues = (leagueResult.data ?? []) as Array<{ id: string; name: string; sport_id: string }>;
  const activeSeasonByLeague: Record<string, string> = {};

  if (leagues.length > 0) {
    const seasonsResult = await client
      .from("seasons")
      .select("league_id, name")
      .eq("is_active", true)
      .in(
        "league_id",
        leagues.map((league) => league.id),
      );

    const seasons = (seasonsResult.data ?? []) as Array<{ league_id: string; name: string }>;
    for (const season of seasons) {
      activeSeasonByLeague[season.league_id] = season.name;
    }
  }

  const sportMap = await buildSportMap(leagues.map((league) => league.sport_id));
  const leagueSummaries = leagues.map((league) => ({
    id: league.id,
    name: league.name,
    sportName: sportMap[league.sport_id] ?? league.sport_id,
    activeSeasonName: activeSeasonByLeague[league.id] ?? null,
  }));

  const liveGames = (liveResult.data ?? []) as BasicGameRow[];
  const upcomingGames = (upcomingResult.data ?? []) as BasicGameRow[];
  const allGames = [...liveGames, ...upcomingGames];
  const teamIds = Array.from(
    new Set(allGames.flatMap((game) => [game.home_team_id, game.away_team_id])),
  );
  const leagueIds = Array.from(new Set(allGames.map((game) => game.league_id)));
  const [teamMap, leagueMap] = await Promise.all([buildTeamMap(teamIds), buildLeagueMap(leagueIds)]);

  return {
    mode: "connected",
    statusMessage: getStatusMessage(
      "connected",
      "Connected to Supabase. Public data below is pulled from your database.",
    ),
    leagues: leagueSummaries,
    liveGames: liveGames.map((game) => toGameSummary(game, teamMap, leagueMap)),
    upcomingGames: upcomingGames.map((game) => toGameSummary(game, teamMap, leagueMap)),
  };
}

export async function getLeagueDetails(leagueId: string): Promise<LeagueDetails | null> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return { ...demoLeague, leagueId };
  }

  const leagueResult = await client
    .from("leagues")
    .select("id, name, sport_id")
    .eq("id", leagueId)
    .maybeSingle();

  const leagueRow = leagueResult.data as { id: string; name: string; sport_id: string } | null;

  if (leagueResult.error || !leagueRow) {
    return null;
  }

  const sportMap = await buildSportMap([leagueRow.sport_id]);

  const standingsResult = await client
    .from("standings")
    .select("team_id, team_name, wins, losses, ties, points_for, points_against, point_diff")
    .eq("league_id", leagueId)
    .order("wins", { ascending: false })
    .order("point_diff", { ascending: false });

  const recentGamesResult = await client
    .from("games")
    .select("id, league_id, home_team_id, away_team_id, home_score, away_score, status, period_label, scheduled_at")
    .eq("league_id", leagueId)
    .order("scheduled_at", { ascending: false })
    .limit(10);

  const games = (recentGamesResult.data ?? []) as BasicGameRow[];
  const teamMap = await buildTeamMap(
    Array.from(new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id]))),
  );

  return {
    mode: "connected",
    statusMessage: getStatusMessage(
      "connected",
      "Connected to Supabase. These standings are calculated from final games in the standings view.",
    ),
    leagueId: leagueRow.id,
    leagueName: leagueRow.name,
    sportName: sportMap[leagueRow.sport_id] ?? leagueRow.sport_id,
    standings: ((standingsResult.data ?? []) as Array<{
      team_id: string;
      team_name: string;
      wins: number;
      losses: number;
      ties: number;
      points_for: number;
      points_against: number;
      point_diff: number;
    }>).map((row) => ({
      teamId: row.team_id,
      teamName: row.team_name,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      pointsFor: row.points_for,
      pointsAgainst: row.points_against,
      pointDiff: row.point_diff,
    })),
    recentGames: games.map((game) => toGameSummary(game, teamMap, { [leagueId]: leagueRow.name })),
  };
}

export async function getTeamDetails(teamId: string): Promise<TeamDetails | null> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return { ...demoTeam, teamId };
  }

  const teamResult = await client
    .from("teams")
    .select("id, league_id, name, city, website_url, primary_color, secondary_color")
    .eq("id", teamId)
    .maybeSingle();

  const teamRow = teamResult.data as {
    id: string;
    league_id: string;
    name: string;
    city: string | null;
    website_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  } | null;

  if (teamResult.error || !teamRow) {
    return null;
  }

  const leagueResult = await client
    .from("leagues")
    .select("id, name, sport_id")
    .eq("id", teamRow.league_id)
    .maybeSingle();

  const leagueRow = leagueResult.data as { id: string; name: string; sport_id: string } | null;
  if (leagueResult.error || !leagueRow) {
    return null;
  }

  const sportMap = await buildSportMap([leagueRow.sport_id]);

  const gamesResult = await client
    .from("games")
    .select(
      "id, league_id, home_team_id, away_team_id, home_score, away_score, status, period_label, scheduled_at, stream_provider, stream_url, venue_name",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("scheduled_at", { ascending: false })
    .limit(25);

  const games = (gamesResult.data ?? []) as TeamGameRow[];
  const allTeamIds = Array.from(
    new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id])),
  );
  const teamNameMap = await buildTeamMap(allTeamIds);

  const mappedGames = games.map((game) => {
    const isHome = game.home_team_id === teamId;
    const opponentId = isHome ? game.away_team_id : game.home_team_id;
    return {
      id: game.id,
      scheduledAt: game.scheduled_at,
      status: game.status,
      isHome,
      opponentTeam: teamNameMap[opponentId] ?? "Opponent",
      teamScore: isHome ? game.home_score : game.away_score,
      opponentScore: isHome ? game.away_score : game.home_score,
      periodLabel: game.period_label,
      venueName: game.venue_name,
      streamProvider: game.stream_provider,
      streamUrl: game.stream_url,
      embedUrl: getEmbedUrl(game.stream_url),
    };
  });

  const now = new Date();
  const upcomingGames = mappedGames
    .filter((game) => game.status === "scheduled" && new Date(game.scheduledAt) >= now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 8);

  const recentGames = mappedGames
    .filter((game) => !(game.status === "scheduled" && new Date(game.scheduledAt) >= now))
    .slice(0, 8);

  return {
    mode: "connected",
    statusMessage: getStatusMessage(
      "connected",
      "Connected to Supabase. Team page and stream links are loaded from game records.",
    ),
    teamId: teamRow.id,
    teamName: teamRow.name,
    city: teamRow.city,
    websiteUrl: teamRow.website_url,
    primaryColor: teamRow.primary_color,
    secondaryColor: teamRow.secondary_color,
    leagueName: leagueRow.name,
    sportName: sportMap[leagueRow.sport_id] ?? leagueRow.sport_id,
    upcomingGames,
    recentGames,
  };
}

export async function getScheduleBuilderData(): Promise<ScheduleBuilderData> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return demoScheduleBuilderData;
  }

  const leaguesResult = await client
    .from("leagues")
    .select("id, name, sport_id")
    .order("name", { ascending: true });

  if (leaguesResult.error) {
    return {
      ...demoScheduleBuilderData,
      statusMessage:
        "Connected mode failed while reading leagues. Demo schedule options are shown instead.",
    };
  }

  const leagues = (leaguesResult.data ?? []) as Array<{ id: string; name: string; sport_id: string }>;
  if (leagues.length === 0) {
    return {
      mode: "connected",
      statusMessage: "No leagues found yet. Add leagues in Supabase, then generate schedules.",
      leagues: [],
    };
  }

  const leagueIds = leagues.map((league) => league.id);
  const [seasonsResult, teamsResult] = await Promise.all([
    client
      .from("seasons")
      .select("id, league_id, name, is_active, starts_on")
      .in("league_id", leagueIds)
      .order("starts_on", { ascending: false }),
    client.from("teams").select("id, league_id, name").in("league_id", leagueIds).order("name", {
      ascending: true,
    }),
  ]);

  const seasons = (seasonsResult.data ?? []) as Array<{
    id: string;
    league_id: string;
    name: string;
    is_active: boolean;
    starts_on: string | null;
  }>;
  const teams = (teamsResult.data ?? []) as Array<{ id: string; league_id: string; name: string }>;

  const activeSeasonByLeague = new Map<string, { id: string; name: string }>();
  const fallbackSeasonByLeague = new Map<string, { id: string; name: string }>();

  for (const season of seasons) {
    if (season.is_active && !activeSeasonByLeague.has(season.league_id)) {
      activeSeasonByLeague.set(season.league_id, { id: season.id, name: season.name });
    }
    if (!fallbackSeasonByLeague.has(season.league_id)) {
      fallbackSeasonByLeague.set(season.league_id, { id: season.id, name: season.name });
    }
  }

  const teamsByLeague = new Map<string, Array<{ id: string; name: string }>>();
  for (const team of teams) {
    const existing = teamsByLeague.get(team.league_id) ?? [];
    existing.push({
      id: team.id,
      name: team.name,
    });
    teamsByLeague.set(team.league_id, existing);
  }

  const options = leagues
    .map((league) => {
      const season = activeSeasonByLeague.get(league.id) ?? fallbackSeasonByLeague.get(league.id);
      if (!season) {
        return null;
      }

      return {
        leagueId: league.id,
        leagueName: league.name,
        sportId: league.sport_id,
        seasonId: season.id,
        seasonName: season.name,
        teams: teamsByLeague.get(league.id) ?? [],
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  return {
    mode: "connected",
    statusMessage:
      options.length > 0
        ? "Connected to Supabase. Publish to save generated games into your selected season."
        : "No leagues with seasons found yet. Create at least one season before publishing.",
    leagues: options,
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return demoAdminDashboardData;
  }

  const [gamesResult, leaguesResult, teamsResult] = await Promise.all([
    client
      .from("games")
      .select(
        "id, league_id, sport_id, metadata, home_team_id, away_team_id, home_score, away_score, status, period_label, scheduled_at",
      )
      .order("scheduled_at", { ascending: false })
      .limit(40),
    client.from("leagues").select("id", { count: "exact", head: true }),
    client.from("teams").select("id", { count: "exact", head: true }),
  ]);

  if (gamesResult.error) {
    return {
      ...demoAdminDashboardData,
      statusMessage: "Connected mode failed while loading games. Showing demo admin data.",
    };
  }

  const games = (gamesResult.data ?? []) as ScorekeeperGameRow[];
  const teamIds = Array.from(new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id])));
  const leagueIds = Array.from(new Set(games.map((game) => game.league_id)));
  const [teamMap, leagueMap] = await Promise.all([buildTeamMap(teamIds), buildLeagueMap(leagueIds)]);

  const options = games.map((game) => {
    const metadata = parseGameMetadata(game.metadata, game.sport_id);
    return {
      gameId: game.id,
      sportId: game.sport_id,
      competitionType: metadata.competitionType,
      leagueName: leagueMap[game.league_id] ?? "League",
      homeTeam: teamMap[game.home_team_id] ?? "Home Team",
      awayTeam: teamMap[game.away_team_id] ?? "Away Team",
      homeScore: game.home_score,
      awayScore: game.away_score,
      status: game.status,
      periodLabel: game.period_label,
      scheduledAt: game.scheduled_at,
    };
  });

  return {
    mode: "connected",
    statusMessage: "Connected to Supabase. Manage ad-hoc, league, and tournament games from admin.",
    liveGamesCount: options.filter((game) => game.status === "live").length,
    scheduledGamesCount: options.filter((game) => game.status === "scheduled").length,
    totalLeagues: leaguesResult.count ?? 0,
    totalTeams: teamsResult.count ?? 0,
    games: options,
  };
}

export async function getPublicTeamOptions(): Promise<PublicTeamOption[]> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return [
      {
        teamId: "team-1",
        teamName: "Harbor Wolves",
        leagueId: "demo-hockey-league",
        leagueName: "Metro Hockey League",
      },
      {
        teamId: "team-2",
        teamName: "Northside Blades",
        leagueId: "demo-hockey-league",
        leagueName: "Metro Hockey League",
      },
    ];
  }

  const [teamsResult, leaguesResult] = await Promise.all([
    client.from("teams").select("id, name, league_id").order("name", { ascending: true }),
    client.from("leagues").select("id, name"),
  ]);

  const leagues = (leaguesResult.data ?? []) as Array<{ id: string; name: string }>;
  const leagueNameById = new Map(leagues.map((league) => [league.id, league.name]));

  return ((teamsResult.data ?? []) as Array<{ id: string; name: string; league_id: string }>).map(
    (team) => ({
      teamId: team.id,
      teamName: team.name,
      leagueId: team.league_id,
      leagueName: leagueNameById.get(team.league_id) ?? "League",
    }),
  );
}

export async function getGameStatsDetails(gameId: string): Promise<GameStatsDetails | null> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return { ...demoGameStats, gameId };
  }

  const gameResult = await client
    .from("games")
    .select(
      "id, league_id, sport_id, home_team_id, away_team_id, home_score, away_score, status, period_label, scheduled_at",
    )
    .eq("id", gameId)
    .maybeSingle();

  const game = gameResult.data as (BasicGameRow & { sport_id: string }) | null;
  if (gameResult.error || !game) {
    return null;
  }

  const [teamMap, leagueMap, teamStatsResult, playerGameStatsResult] = await Promise.all([
    buildTeamMap([game.home_team_id, game.away_team_id]),
    buildLeagueMap([game.league_id]),
    client.from("game_team_stats").select("team_id, stats").eq("game_id", gameId),
    client
      .from("player_game_stats")
      .select("player_id, team_id, starter, minutes_played, stats")
      .eq("game_id", gameId),
  ]);

  const teamStatsRows = (teamStatsResult.data ?? []) as Array<{ team_id: string; stats: unknown }>;
  const teamStatsByTeam = new Map<string, StatMetric[]>();
  for (const row of teamStatsRows) {
    teamStatsByTeam.set(row.team_id, toStatMetrics(row.stats, "team", game.sport_id));
  }

  const playerStatsRows = (playerGameStatsResult.data ?? []) as Array<{
    player_id: string;
    team_id: string;
    starter: boolean;
    minutes_played: number | null;
    stats: unknown;
  }>;

  const playerIds = Array.from(new Set(playerStatsRows.map((row) => row.player_id)));
  const playersResult = await client
    .from("players")
    .select("id, first_name, last_name, position, jersey_number")
    .in("id", playerIds);

  const playersById = new Map(
    ((playersResult.data ?? []) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      position: string | null;
      jersey_number: string | null;
    }>).map((player) => [player.id, player]),
  );

  const playerStats = playerStatsRows.map((row) => {
    const player = playersById.get(row.player_id);
    return {
      playerId: row.player_id,
      playerName: player ? `${player.first_name} ${player.last_name}` : "Unknown Player",
      teamId: row.team_id,
      teamName: teamMap[row.team_id] ?? "Team",
      position: player?.position ?? null,
      jerseyNumber: player?.jersey_number ?? null,
      starter: row.starter,
      minutesPlayed: row.minutes_played,
      stats: toStatMetrics(row.stats, "player", game.sport_id),
    };
  });

  playerStats.sort((a, b) => a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName));

  return {
    mode: "connected",
    statusMessage: "Connected to Supabase. Game stats and team comparisons are live.",
    gameId,
    leagueName: leagueMap[game.league_id] ?? "League",
    homeTeam: {
      teamId: game.home_team_id,
      teamName: teamMap[game.home_team_id] ?? "Home Team",
      score: game.home_score,
      metrics: teamStatsByTeam.get(game.home_team_id) ?? [],
    },
    awayTeam: {
      teamId: game.away_team_id,
      teamName: teamMap[game.away_team_id] ?? "Away Team",
      score: game.away_score,
      metrics: teamStatsByTeam.get(game.away_team_id) ?? [],
    },
    scheduledAt: game.scheduled_at,
    periodLabel: game.period_label,
    status: game.status,
    playerStats,
  };
}

export async function getGameRosterPlayers(gameId: string): Promise<GameRosterPlayerOption[]> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return demoGameRosterPlayers;
  }

  const gameResult = await client
    .from("games")
    .select("season_id, home_team_id, away_team_id")
    .eq("id", gameId)
    .maybeSingle();

  const game = gameResult.data as
    | {
        season_id: string;
        home_team_id: string;
        away_team_id: string;
      }
    | null;

  if (gameResult.error || !game) {
    return [];
  }

  const [teamMap, rosterResult] = await Promise.all([
    buildTeamMap([game.home_team_id, game.away_team_id]),
    client
      .from("team_rosters")
      .select("team_id, player_id, is_active")
      .eq("season_id", game.season_id)
      .in("team_id", [game.home_team_id, game.away_team_id])
      .eq("is_active", true),
  ]);

  const rosterRows = (rosterResult.data ?? []) as Array<{
    team_id: string;
    player_id: string;
    is_active: boolean;
  }>;

  const playerIds = Array.from(new Set(rosterRows.map((row) => row.player_id)));
  if (playerIds.length === 0) {
    return [];
  }

  const playersResult = await client
    .from("players")
    .select("id, first_name, last_name, position, jersey_number")
    .in("id", playerIds);

  const playersById = new Map(
    ((playersResult.data ?? []) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      position: string | null;
      jersey_number: string | null;
    }>).map((player) => [player.id, player]),
  );

  const output = rosterRows
    .map((row) => {
      const player = playersById.get(row.player_id);
      if (!player) {
        return null;
      }
      return {
        playerId: row.player_id,
        teamId: row.team_id,
        teamName: teamMap[row.team_id] ?? "Team",
        playerName: `${player.first_name} ${player.last_name}`,
        position: player.position,
        jerseyNumber: player.jersey_number,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  output.sort((a, b) => a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName));
  return output;
}

export async function getTeamComparisonDetails(
  teamAId: string,
  teamBId: string,
): Promise<TeamComparisonDetails | null> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return {
      ...demoTeamComparison,
      teamA: { ...demoTeamComparison.teamA, teamId: teamAId || demoTeamComparison.teamA.teamId },
      teamB: { ...demoTeamComparison.teamB, teamId: teamBId || demoTeamComparison.teamB.teamId },
    };
  }

  const teamsResult = await client
    .from("teams")
    .select("id, name, league_id")
    .in("id", [teamAId, teamBId]);

  const teams = (teamsResult.data ?? []) as Array<{ id: string; name: string; league_id: string }>;
  if (teams.length < 2) {
    return null;
  }

  const teamA = teams.find((team) => team.id === teamAId);
  const teamB = teams.find((team) => team.id === teamBId);
  if (!teamA || !teamB) {
    return null;
  }

  const leagueMap = await buildLeagueMap([teamA.league_id, teamB.league_id]);

  const [gamesAResult, gamesBResult, headToHeadResult, teamStatsResult] = await Promise.all([
    client
      .from("games")
      .select("id, home_team_id, away_team_id, home_score, away_score, status")
      .eq("status", "final")
      .or(`home_team_id.eq.${teamAId},away_team_id.eq.${teamAId}`),
    client
      .from("games")
      .select("id, home_team_id, away_team_id, home_score, away_score, status")
      .eq("status", "final")
      .or(`home_team_id.eq.${teamBId},away_team_id.eq.${teamBId}`),
    client
      .from("games")
      .select("id, home_team_id, away_team_id, home_score, away_score, status")
      .eq("status", "final")
      .or(
        `and(home_team_id.eq.${teamAId},away_team_id.eq.${teamBId}),and(home_team_id.eq.${teamBId},away_team_id.eq.${teamAId})`,
      ),
    client.from("game_team_stats").select("game_id, team_id, stats").in("team_id", [teamAId, teamBId]),
  ]);

  const teamStatsRows = (teamStatsResult.data ?? []) as Array<{
    game_id: string;
    team_id: string;
    stats: unknown;
  }>;

  const teamStatsByTeam = new Map<string, Array<{ gameId: string; metrics: StatMetric[] }>>();
  for (const row of teamStatsRows) {
    const existing = teamStatsByTeam.get(row.team_id) ?? [];
    existing.push({
      gameId: row.game_id,
      metrics: toStatMetrics(row.stats, "team"),
    });
    teamStatsByTeam.set(row.team_id, existing);
  }

  const profileFromGames = (
    targetTeam: { id: string; name: string; league_id: string },
    games: Array<{ id: string; home_team_id: string; away_team_id: string; home_score: number; away_score: number }>,
  ) => {
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    for (const game of games) {
      const isHome = game.home_team_id === targetTeam.id;
      const scored = isHome ? game.home_score : game.away_score;
      const conceded = isHome ? game.away_score : game.home_score;
      pointsFor += scored;
      pointsAgainst += conceded;
      if (scored > conceded) {
        wins += 1;
      } else if (scored < conceded) {
        losses += 1;
      } else {
        ties += 1;
      }
    }

    const metricAccumulator = new Map<string, { sum: number; count: number; label: string }>();
    for (const statRow of teamStatsByTeam.get(targetTeam.id) ?? []) {
      for (const metric of statRow.metrics) {
        const existing = metricAccumulator.get(metric.key) ?? {
          sum: 0,
          count: 0,
          label: metric.label,
        };
        existing.sum += metric.value;
        existing.count += 1;
        metricAccumulator.set(metric.key, existing);
      }
    }

    const metrics: StatMetric[] = Array.from(metricAccumulator.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        value: Number((value.sum / Math.max(1, value.count)).toFixed(2)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      teamId: targetTeam.id,
      teamName: targetTeam.name,
      leagueName: leagueMap[targetTeam.league_id] ?? "League",
      gamesPlayed: games.length,
      wins,
      losses,
      ties,
      pointsFor,
      pointsAgainst,
      metrics,
    };
  };

  const teamAGames = (gamesAResult.data ?? []) as Array<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    status: string;
  }>;
  const teamBGames = (gamesBResult.data ?? []) as Array<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    status: string;
  }>;
  const headGames = (headToHeadResult.data ?? []) as Array<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    status: string;
  }>;

  const teamAProfile = profileFromGames(teamA, teamAGames);
  const teamBProfile = profileFromGames(teamB, teamBGames);

  let headA = 0;
  let headB = 0;
  let headTies = 0;
  let totalPointsA = 0;
  let totalPointsB = 0;

  for (const game of headGames) {
    const teamAScore = game.home_team_id === teamA.id ? game.home_score : game.away_score;
    const teamBScore = game.home_team_id === teamB.id ? game.home_score : game.away_score;
    totalPointsA += teamAScore;
    totalPointsB += teamBScore;
    if (teamAScore > teamBScore) {
      headA += 1;
    } else if (teamAScore < teamBScore) {
      headB += 1;
    } else {
      headTies += 1;
    }
  }

  const metricKeys = new Set<string>([
    "avg_points_for",
    "avg_points_against",
    ...teamAProfile.metrics.map((metric) => metric.key),
    ...teamBProfile.metrics.map((metric) => metric.key),
  ]);

  const metricValueFor = (
    profile: typeof teamAProfile,
    key: string,
  ): { label: string; value: number } => {
    if (key === "avg_points_for") {
      return {
        label: "Avg Points For",
        value: Number((profile.pointsFor / Math.max(1, profile.gamesPlayed)).toFixed(2)),
      };
    }
    if (key === "avg_points_against") {
      return {
        label: "Avg Points Against",
        value: Number((profile.pointsAgainst / Math.max(1, profile.gamesPlayed)).toFixed(2)),
      };
    }
    const found = profile.metrics.find((metric) => metric.key === key);
    return {
      label: found?.label ?? toMetricLabelFromKey(key),
      value: found?.value ?? 0,
    };
  };

  const comparisonMetrics = Array.from(metricKeys)
    .map((key) => {
      const a = metricValueFor(teamAProfile, key);
      const b = metricValueFor(teamBProfile, key);
      return {
        key,
        label: a.label,
        teamAValue: a.value,
        teamBValue: b.value,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    mode: "connected",
    statusMessage: "Connected to Supabase. Team comparison reflects your live and final game stats.",
    teamA: teamAProfile,
    teamB: teamBProfile,
    headToHead: {
      gamesPlayed: headGames.length,
      teamAWins: headA,
      teamBWins: headB,
      ties: headTies,
      totalPointsA,
      totalPointsB,
    },
    comparisonMetrics,
  };
}

export async function getLiveGameDetails(gameId: string): Promise<LiveGameDetails | null> {
  const client = createSupabaseServerClient();

  if (!isSupabaseConfigured || !client) {
    return { ...demoLiveGame, gameId };
  }

  const gameResult = await client
    .from("games")
    .select(
      "id, league_id, sport_id, metadata, home_team_id, away_team_id, home_score, away_score, status, period_label, scheduled_at",
    )
    .eq("id", gameId)
    .maybeSingle();

  const gameRow = gameResult.data as
    | (BasicGameRow & {
        sport_id: string;
        metadata: unknown;
      })
    | null;

  if (gameResult.error || !gameRow) {
    return null;
  }

  const teamsMap = await buildTeamMap([gameRow.home_team_id, gameRow.away_team_id]);
  const leagueMap = await buildLeagueMap([gameRow.league_id]);
  const metadata = parseGameMetadata(gameRow.metadata, gameRow.sport_id);

  const eventsResult = await client
    .from("game_events")
    .select("id, event_type, points_home, points_away, actor_name, source, created_at")
    .eq("game_id", gameId)
    .order("event_index", { ascending: false })
    .limit(30);

  return {
    mode: "connected",
    statusMessage: getStatusMessage(
      "connected",
      "Connected to Supabase. This view will update in real time when new events are inserted.",
    ),
    gameId,
    sportId: gameRow.sport_id,
    competitionType: metadata.competitionType,
    leagueName: leagueMap[gameRow.league_id] ?? "League",
    homeTeamId: gameRow.home_team_id,
    awayTeamId: gameRow.away_team_id,
    homeTeam: teamsMap[gameRow.home_team_id] ?? "Home Team",
    awayTeam: teamsMap[gameRow.away_team_id] ?? "Away Team",
    homeScore: gameRow.home_score,
    awayScore: gameRow.away_score,
    status: gameRow.status,
    periodLabel: gameRow.period_label,
    clockSecondsRemaining: metadata.clockSecondsRemaining,
    clockRunning: metadata.clockRunning,
    trackedTeamMetrics: metadata.trackedTeamMetrics,
    trackedPlayerMetrics: metadata.trackedPlayerMetrics,
    trackedPlayerSides: metadata.trackedPlayerSides,
    scorepadFields: metadata.scorepadFields,
    scorepadValues: metadata.scorepadValues,
    quickActions: metadata.quickActions,
    scheduledAt: gameRow.scheduled_at,
    events: ((eventsResult.data ?? []) as Array<{
      id: string;
      event_type: string;
      points_home: number;
      points_away: number;
      actor_name: string | null;
      source: string;
      created_at: string;
    }>).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      pointsHome: event.points_home,
      pointsAway: event.points_away,
      actorName: event.actor_name,
      source: event.source,
      createdAt: event.created_at,
    })),
  };
}
