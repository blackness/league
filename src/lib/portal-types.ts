export type GameStatus = "scheduled" | "live" | "final" | "postponed" | "canceled";

export type DataMode = "connected" | "demo";

export interface LeagueSummary {
  id: string;
  name: string;
  sportName: string;
  activeSeasonName: string | null;
}

export interface GameSummary {
  id: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  periodLabel: string | null;
  scheduledAt: string;
}

export interface PortalOverview {
  mode: DataMode;
  statusMessage: string;
  leagues: LeagueSummary[];
  liveGames: GameSummary[];
  upcomingGames: GameSummary[];
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export interface LeagueDetails {
  mode: DataMode;
  statusMessage: string;
  leagueId: string;
  leagueName: string;
  sportName: string;
  standings: StandingRow[];
  recentGames: GameSummary[];
}

export interface GameEventItem {
  id: string;
  eventType: string;
  pointsHome: number;
  pointsAway: number;
  actorName: string | null;
  source: string;
  createdAt: string;
}

export interface LiveGameDetails {
  mode: DataMode;
  statusMessage: string;
  gameId: string;
  sportId: string;
  competitionType: "league" | "tournament" | "ad_hoc";
  leagueName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  periodLabel: string | null;
  clockSecondsRemaining: number | null;
  clockRunning: boolean;
  trackedTeamMetrics: string[];
  trackedPlayerMetrics: string[];
  trackedPlayerSides: Array<"home" | "away">;
  scorepadFields: string[];
  scorepadValues: Record<string, string>;
  quickActions: Array<{
    id: string;
    label: string;
    eventType: string;
    pointsHome: number;
    pointsAway: number;
  }>;
  scheduledAt: string;
  events: GameEventItem[];
}

export interface TeamGame {
  id: string;
  scheduledAt: string;
  status: GameStatus;
  isHome: boolean;
  opponentTeam: string;
  teamScore: number;
  opponentScore: number;
  periodLabel: string | null;
  venueName: string | null;
  streamProvider: string | null;
  streamUrl: string | null;
  embedUrl: string | null;
}

export interface TeamDetails {
  mode: DataMode;
  statusMessage: string;
  teamId: string;
  teamName: string;
  city: string | null;
  websiteUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  leagueName: string;
  sportName: string;
  upcomingGames: TeamGame[];
  recentGames: TeamGame[];
}

export interface ScheduleLeagueOption {
  leagueId: string;
  leagueName: string;
  sportId: string;
  seasonId: string;
  seasonName: string;
  teams: Array<{
    id: string;
    name: string;
  }>;
}

export interface ScheduleBuilderData {
  mode: DataMode;
  statusMessage: string;
  leagues: ScheduleLeagueOption[];
}

export interface StatMetric {
  key: string;
  label: string;
  value: number;
}

export interface PlayerGameStatLine {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  position: string | null;
  jerseyNumber: string | null;
  starter: boolean;
  minutesPlayed: number | null;
  stats: StatMetric[];
}

export interface TeamGameComparison {
  teamId: string;
  teamName: string;
  score: number;
  metrics: StatMetric[];
}

export interface GameStatsDetails {
  mode: DataMode;
  statusMessage: string;
  gameId: string;
  leagueName: string;
  homeTeam: TeamGameComparison;
  awayTeam: TeamGameComparison;
  scheduledAt: string;
  periodLabel: string | null;
  status: GameStatus;
  playerStats: PlayerGameStatLine[];
}

export interface TeamAggregateProfile {
  teamId: string;
  teamName: string;
  leagueName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  metrics: StatMetric[];
}

export interface HeadToHeadSummary {
  gamesPlayed: number;
  teamAWins: number;
  teamBWins: number;
  ties: number;
  totalPointsA: number;
  totalPointsB: number;
}

export interface TeamComparisonDetails {
  mode: DataMode;
  statusMessage: string;
  teamA: TeamAggregateProfile;
  teamB: TeamAggregateProfile;
  headToHead: HeadToHeadSummary;
  comparisonMetrics: Array<{
    key: string;
    label: string;
    teamAValue: number;
    teamBValue: number;
  }>;
}

export interface PublicTeamOption {
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueName: string;
}

export interface ScorekeeperGameOption {
  gameId: string;
  sportId: string;
  competitionType: "league" | "tournament" | "ad_hoc";
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  periodLabel: string | null;
  scheduledAt: string;
}

export interface AdminDashboardData {
  mode: DataMode;
  statusMessage: string;
  liveGamesCount: number;
  scheduledGamesCount: number;
  totalLeagues: number;
  totalTeams: number;
  games: ScorekeeperGameOption[];
}

export interface GameRosterPlayerOption {
  playerId: string;
  teamId: string;
  teamName: string;
  playerName: string;
  position: string | null;
  jerseyNumber: string | null;
}
