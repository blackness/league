import type {
  AdminDashboardData,
  GameRosterPlayerOption,
  GameStatsDetails,
  GameSummary,
  LeagueDetails,
  LiveGameDetails,
  PortalOverview,
  ScheduleBuilderData,
  TeamComparisonDetails,
  TeamDetails,
} from "@/lib/portal-types";
import { getEmbedUrl } from "@/lib/streams";

const now = new Date();
const later = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

const liveGames: GameSummary[] = [
  {
    id: "demo-game-1",
    leagueName: "Metro Hockey League",
    homeTeam: "Harbor Wolves",
    awayTeam: "Northside Blades",
    homeScore: 3,
    awayScore: 2,
    status: "live",
    periodLabel: "3rd 07:41",
    scheduledAt: now.toISOString(),
  },
  {
    id: "demo-game-2",
    leagueName: "City Hoops Premier",
    homeTeam: "Midtown Comets",
    awayTeam: "River Falcons",
    homeScore: 84,
    awayScore: 79,
    status: "live",
    periodLabel: "Q4 02:12",
    scheduledAt: now.toISOString(),
  },
];

const upcomingGames: GameSummary[] = [
  {
    id: "demo-game-3",
    leagueName: "East Volleyball Association",
    homeTeam: "Shoreline Storm",
    awayTeam: "Capital Spikes",
    homeScore: 0,
    awayScore: 0,
    status: "scheduled",
    periodLabel: "Starts 7:30 PM",
    scheduledAt: later,
  },
  {
    id: "demo-game-4",
    leagueName: "Open Ultimate Circuit",
    homeTeam: "Skyline Pulse",
    awayTeam: "Beacon Drift",
    homeScore: 0,
    awayScore: 0,
    status: "scheduled",
    periodLabel: "Tomorrow",
    scheduledAt: tomorrow,
  },
];

export const demoOverview: PortalOverview = {
  mode: "demo",
  statusMessage:
    "Demo mode: connect Supabase env variables to display your live league data.",
  leagues: [
    {
      id: "demo-hockey-league",
      name: "Metro Hockey League",
      sportName: "Hockey",
      activeSeasonName: "2026 Spring",
    },
    {
      id: "demo-basketball-league",
      name: "City Hoops Premier",
      sportName: "Basketball",
      activeSeasonName: "2026 Season",
    },
    {
      id: "demo-volleyball-league",
      name: "East Volleyball Association",
      sportName: "Volleyball",
      activeSeasonName: "2026 Indoor",
    },
  ],
  liveGames,
  upcomingGames,
};

export const demoLeague: LeagueDetails = {
  mode: "demo",
  statusMessage:
    "Demo standings are shown because this league is not connected to Supabase yet.",
  leagueId: "demo-hockey-league",
  leagueName: "Metro Hockey League",
  sportName: "Hockey",
  standings: [
    {
      teamId: "team-1",
      teamName: "Harbor Wolves",
      wins: 12,
      losses: 3,
      ties: 1,
      pointsFor: 57,
      pointsAgainst: 34,
      pointDiff: 23,
    },
    {
      teamId: "team-2",
      teamName: "Northside Blades",
      wins: 10,
      losses: 5,
      ties: 1,
      pointsFor: 49,
      pointsAgainst: 38,
      pointDiff: 11,
    },
    {
      teamId: "team-3",
      teamName: "Old Town Ice",
      wins: 8,
      losses: 8,
      ties: 0,
      pointsFor: 43,
      pointsAgainst: 45,
      pointDiff: -2,
    },
  ],
  recentGames: liveGames,
};

export const demoLiveGame: LiveGameDetails = {
  mode: "demo",
  statusMessage:
    "Demo live feed is active. Supabase realtime events will appear here after setup.",
  gameId: "demo-game-1",
  sportId: "hockey",
  competitionType: "league",
  leagueName: "Metro Hockey League",
  homeTeamId: "team-1",
  awayTeamId: "team-2",
  homeTeam: "Harbor Wolves",
  awayTeam: "Northside Blades",
  homeScore: 3,
  awayScore: 2,
  status: "live",
  periodLabel: "3rd 07:41",
  clockSecondsRemaining: 461,
  clockRunning: true,
  trackedTeamMetrics: ["shots", "faceoff_win_pct", "power_play_goals"],
  trackedPlayerMetrics: ["goals", "assists", "shots"],
  trackedPlayerSides: ["home", "away"],
  scorepadFields: ["Referee", "Attendance", "Incidents"],
  scorepadValues: {
    Referee: "C. Miller",
    Attendance: "438",
    Incidents: "None",
  },
  quickActions: [
    {
      id: "goal_home",
      label: "Home Goal",
      eventType: "goal",
      pointsHome: 1,
      pointsAway: 0,
    },
    {
      id: "goal_away",
      label: "Away Goal",
      eventType: "goal",
      pointsHome: 0,
      pointsAway: 1,
    },
  ],
  scheduledAt: now.toISOString(),
  events: [
    {
      id: "event-1",
      eventType: "goal",
      pointsHome: 1,
      pointsAway: 0,
      actorName: "M. Torres",
      source: "manual",
      createdAt: now.toISOString(),
    },
    {
      id: "event-2",
      eventType: "goal",
      pointsHome: 0,
      pointsAway: 1,
      actorName: "J. Wong",
      source: "manual",
      createdAt: now.toISOString(),
    },
    {
      id: "event-3",
      eventType: "goal",
      pointsHome: 1,
      pointsAway: 0,
      actorName: "A. Brooks",
      source: "manual",
      createdAt: now.toISOString(),
    },
  ],
};

export const demoTeam: TeamDetails = {
  mode: "demo",
  statusMessage:
    "Demo team page is shown because this team is not connected to Supabase yet.",
  teamId: "team-1",
  teamName: "Harbor Wolves",
  city: "Harbor City",
  websiteUrl: "https://example.com/harbor-wolves",
  primaryColor: "#0f172a",
  secondaryColor: "#06b6d4",
  leagueName: "Metro Hockey League",
  sportName: "Hockey",
  upcomingGames: [
    {
      id: "demo-game-3",
      scheduledAt: later,
      status: "scheduled",
      isHome: true,
      opponentTeam: "Northside Blades",
      teamScore: 0,
      opponentScore: 0,
      periodLabel: "Starts 7:30 PM",
      venueName: "Harbor Arena",
      streamProvider: "youtube",
      streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    },
  ],
  recentGames: [
    {
      id: "demo-game-1",
      scheduledAt: now.toISOString(),
      status: "live",
      isHome: true,
      opponentTeam: "Northside Blades",
      teamScore: 3,
      opponentScore: 2,
      periodLabel: "3rd 07:41",
      venueName: "Harbor Arena",
      streamProvider: "youtube",
      streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    },
  ],
};

export const demoScheduleBuilderData: ScheduleBuilderData = {
  mode: "demo",
  statusMessage:
    "Demo mode: connect Supabase to publish generated schedules directly into league games.",
  leagues: [
    {
      leagueId: "demo-hockey-league",
      leagueName: "Metro Hockey League",
      sportId: "hockey",
      seasonId: "demo-season-2026-spring",
      seasonName: "2026 Spring",
      teams: [
        {
          id: "team-1",
          name: "Harbor Wolves",
        },
        {
          id: "team-2",
          name: "Northside Blades",
        },
        {
          id: "team-3",
          name: "Old Town Ice",
        },
        {
          id: "team-4",
          name: "River City Rush",
        },
      ],
    },
  ],
};

export const demoGameStats: GameStatsDetails = {
  mode: "demo",
  statusMessage: "Demo game stats are shown. Connect Supabase for live player/team statistics.",
  gameId: "demo-game-1",
  leagueName: "Metro Hockey League",
  homeTeam: {
    teamId: "team-1",
    teamName: "Harbor Wolves",
    score: 3,
    metrics: [
      { key: "shots", label: "Shots", value: 31 },
      { key: "faceoff_win_pct", label: "Faceoff Win %", value: 54.2 },
      { key: "power_play_goals", label: "Power Play Goals", value: 1 },
    ],
  },
  awayTeam: {
    teamId: "team-2",
    teamName: "Northside Blades",
    score: 2,
    metrics: [
      { key: "shots", label: "Shots", value: 27 },
      { key: "faceoff_win_pct", label: "Faceoff Win %", value: 45.8 },
      { key: "power_play_goals", label: "Power Play Goals", value: 0 },
    ],
  },
  scheduledAt: now.toISOString(),
  periodLabel: "3rd 07:41",
  status: "live",
  playerStats: [
    {
      playerId: "player-1",
      playerName: "Maya Torres",
      teamId: "team-1",
      teamName: "Harbor Wolves",
      position: "FWD",
      jerseyNumber: "9",
      starter: true,
      minutesPlayed: 18.5,
      stats: [
        { key: "goals", label: "Goals", value: 1 },
        { key: "assists", label: "Assists", value: 1 },
        { key: "shots", label: "Shots", value: 5 },
      ],
    },
    {
      playerId: "player-2",
      playerName: "Jordan Wong",
      teamId: "team-2",
      teamName: "Northside Blades",
      position: "D",
      jerseyNumber: "7",
      starter: true,
      minutesPlayed: 19,
      stats: [
        { key: "goals", label: "Goals", value: 1 },
        { key: "assists", label: "Assists", value: 0 },
        { key: "shots", label: "Shots", value: 3 },
      ],
    },
  ],
};

export const demoTeamComparison: TeamComparisonDetails = {
  mode: "demo",
  statusMessage: "Demo comparison mode is active. Connect Supabase to compare real team stats.",
  teamA: {
    teamId: "team-1",
    teamName: "Harbor Wolves",
    leagueName: "Metro Hockey League",
    gamesPlayed: 16,
    wins: 12,
    losses: 3,
    ties: 1,
    pointsFor: 57,
    pointsAgainst: 34,
    metrics: [
      { key: "shots", label: "Shots", value: 30.4 },
      { key: "faceoff_win_pct", label: "Faceoff Win %", value: 53.1 },
      { key: "power_play_goals", label: "Power Play Goals", value: 1.2 },
    ],
  },
  teamB: {
    teamId: "team-2",
    teamName: "Northside Blades",
    leagueName: "Metro Hockey League",
    gamesPlayed: 16,
    wins: 10,
    losses: 5,
    ties: 1,
    pointsFor: 49,
    pointsAgainst: 38,
    metrics: [
      { key: "shots", label: "Shots", value: 27.8 },
      { key: "faceoff_win_pct", label: "Faceoff Win %", value: 47.6 },
      { key: "power_play_goals", label: "Power Play Goals", value: 0.9 },
    ],
  },
  headToHead: {
    gamesPlayed: 4,
    teamAWins: 3,
    teamBWins: 1,
    ties: 0,
    totalPointsA: 12,
    totalPointsB: 8,
  },
  comparisonMetrics: [
    { key: "points_for", label: "Points For", teamAValue: 57, teamBValue: 49 },
    { key: "points_against", label: "Points Against", teamAValue: 34, teamBValue: 38 },
    { key: "shots", label: "Avg Shots", teamAValue: 30.4, teamBValue: 27.8 },
    { key: "faceoff_win_pct", label: "Faceoff Win %", teamAValue: 53.1, teamBValue: 47.6 },
  ],
};

export const demoGameRosterPlayers: GameRosterPlayerOption[] = [
  {
    playerId: "player-1",
    teamId: "team-1",
    teamName: "Harbor Wolves",
    playerName: "Maya Torres",
    position: "FWD",
    jerseyNumber: "9",
  },
  {
    playerId: "player-2",
    teamId: "team-1",
    teamName: "Harbor Wolves",
    playerName: "Ari Brooks",
    position: "C",
    jerseyNumber: "11",
  },
  {
    playerId: "player-3",
    teamId: "team-2",
    teamName: "Northside Blades",
    playerName: "Jordan Wong",
    position: "D",
    jerseyNumber: "7",
  },
  {
    playerId: "player-4",
    teamId: "team-2",
    teamName: "Northside Blades",
    playerName: "Noah Kline",
    position: "FWD",
    jerseyNumber: "18",
  },
];

export const demoAdminDashboardData: AdminDashboardData = {
  mode: "demo",
  statusMessage: "Demo admin mode is active. Connect Supabase to manage live data.",
  liveGamesCount: 2,
  scheduledGamesCount: 2,
  totalLeagues: 3,
  totalTeams: 8,
  games: [
    {
      gameId: "demo-game-1",
      sportId: "hockey",
      competitionType: "league",
      leagueName: "Metro Hockey League",
      homeTeam: "Harbor Wolves",
      awayTeam: "Northside Blades",
      homeScore: 3,
      awayScore: 2,
      status: "live",
      periodLabel: "3rd 07:41",
      scheduledAt: now.toISOString(),
    },
    {
      gameId: "demo-game-2",
      sportId: "basketball",
      competitionType: "league",
      leagueName: "City Hoops Premier",
      homeTeam: "Midtown Comets",
      awayTeam: "River Falcons",
      homeScore: 84,
      awayScore: 79,
      status: "live",
      periodLabel: "Q4 02:12",
      scheduledAt: now.toISOString(),
    },
    {
      gameId: "demo-game-3",
      sportId: "volleyball",
      competitionType: "tournament",
      leagueName: "East Volleyball Association",
      homeTeam: "Shoreline Storm",
      awayTeam: "Capital Spikes",
      homeScore: 0,
      awayScore: 0,
      status: "scheduled",
      periodLabel: "Set 1",
      scheduledAt: later,
    },
  ],
};
