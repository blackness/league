export interface ScoreActionPreset {
  id: string;
  label: string;
  eventType: string;
  pointsHome: number;
  pointsAway: number;
}

export interface StatMetricDefinition {
  key: string;
  label: string;
}

export interface SportProfile {
  id: string;
  name: string;
  clockMode: "countdown" | "countup" | "none";
  periodLengthSeconds: number;
  defaultPeriodLabel: string;
  quickActions: ScoreActionPreset[];
  teamMetricCatalog: StatMetricDefinition[];
  playerMetricCatalog: StatMetricDefinition[];
  defaultTeamMetrics: string[];
  defaultPlayerMetrics: string[];
  defaultScorepadFields: string[];
}

const SPORT_PROFILES: SportProfile[] = [
  {
    id: "hockey",
    name: "Hockey",
    clockMode: "countdown",
    periodLengthSeconds: 20 * 60,
    defaultPeriodLabel: "1st",
    quickActions: [
      { id: "goal_home", label: "Home Goal", eventType: "goal", pointsHome: 1, pointsAway: 0 },
      { id: "goal_away", label: "Away Goal", eventType: "goal", pointsHome: 0, pointsAway: 1 },
      { id: "penalty", label: "Penalty", eventType: "penalty", pointsHome: 0, pointsAway: 0 },
      { id: "timeout", label: "Timeout", eventType: "timeout", pointsHome: 0, pointsAway: 0 },
    ],
    teamMetricCatalog: [
      { key: "goals", label: "Goals" },
      { key: "shots", label: "Shots" },
      { key: "shots_against", label: "Shots Against" },
      { key: "power_play_goals", label: "Power Play Goals" },
      { key: "power_play_attempts", label: "Power Play Attempts" },
      { key: "penalty_minutes", label: "Penalty Minutes" },
      { key: "faceoff_wins", label: "Faceoff Wins" },
      { key: "faceoff_losses", label: "Faceoff Losses" },
      { key: "takeaways", label: "Takeaways" },
      { key: "giveaways", label: "Giveaways" },
      { key: "saves", label: "Saves" },
      { key: "goals_against", label: "Goals Against" },
    ],
    playerMetricCatalog: [
      { key: "goals", label: "Goals" },
      { key: "assists", label: "Assists" },
      { key: "points", label: "Points" },
      { key: "shots", label: "Shots" },
      { key: "hits", label: "Hits" },
      { key: "blocked_shots", label: "Blocked Shots" },
      { key: "penalty_minutes", label: "Penalty Minutes" },
      { key: "faceoff_wins", label: "Faceoff Wins" },
      { key: "faceoff_losses", label: "Faceoff Losses" },
      { key: "plus_minus", label: "Plus Minus" },
      { key: "saves", label: "Saves" },
      { key: "goals_against", label: "Goals Against" },
    ],
    defaultTeamMetrics: [
      "goals",
      "shots",
      "power_play_goals",
      "power_play_attempts",
      "penalty_minutes",
      "faceoff_wins",
      "takeaways",
      "giveaways",
    ],
    defaultPlayerMetrics: ["goals", "assists", "points", "shots", "hits", "penalty_minutes", "plus_minus"],
    defaultScorepadFields: [
      "Referee",
      "Linesperson",
      "Attendance",
      "Ice Condition",
      "Incidents",
    ],
  },
  {
    id: "basketball",
    name: "Basketball",
    clockMode: "countdown",
    periodLengthSeconds: 12 * 60,
    defaultPeriodLabel: "Q1",
    quickActions: [
      { id: "home_1", label: "Home +1", eventType: "free_throw", pointsHome: 1, pointsAway: 0 },
      { id: "home_2", label: "Home +2", eventType: "field_goal", pointsHome: 2, pointsAway: 0 },
      { id: "home_3", label: "Home +3", eventType: "three_pointer", pointsHome: 3, pointsAway: 0 },
      { id: "away_1", label: "Away +1", eventType: "free_throw", pointsHome: 0, pointsAway: 1 },
      { id: "away_2", label: "Away +2", eventType: "field_goal", pointsHome: 0, pointsAway: 2 },
      { id: "away_3", label: "Away +3", eventType: "three_pointer", pointsHome: 0, pointsAway: 3 },
    ],
    teamMetricCatalog: [
      { key: "points", label: "Points" },
      { key: "field_goals_made", label: "FG Made" },
      { key: "field_goals_attempted", label: "FG Attempted" },
      { key: "three_pt_made", label: "3PT Made" },
      { key: "three_pt_attempted", label: "3PT Attempted" },
      { key: "free_throws_made", label: "FT Made" },
      { key: "free_throws_attempted", label: "FT Attempted" },
      { key: "offensive_rebounds", label: "Offensive Rebounds" },
      { key: "defensive_rebounds", label: "Defensive Rebounds" },
      { key: "assists", label: "Assists" },
      { key: "steals", label: "Steals" },
      { key: "blocks", label: "Blocks" },
      { key: "turnovers", label: "Turnovers" },
      { key: "fouls", label: "Fouls" },
    ],
    playerMetricCatalog: [
      { key: "points", label: "Points" },
      { key: "rebounds", label: "Rebounds" },
      { key: "assists", label: "Assists" },
      { key: "steals", label: "Steals" },
      { key: "blocks", label: "Blocks" },
      { key: "turnovers", label: "Turnovers" },
      { key: "fouls", label: "Fouls" },
      { key: "field_goals_made", label: "FG Made" },
      { key: "field_goals_attempted", label: "FG Attempted" },
      { key: "three_pt_made", label: "3PT Made" },
      { key: "three_pt_attempted", label: "3PT Attempted" },
      { key: "free_throws_made", label: "FT Made" },
      { key: "free_throws_attempted", label: "FT Attempted" },
      { key: "minutes_played", label: "Minutes Played" },
    ],
    defaultTeamMetrics: [
      "points",
      "field_goals_made",
      "field_goals_attempted",
      "three_pt_made",
      "three_pt_attempted",
      "offensive_rebounds",
      "defensive_rebounds",
      "assists",
      "turnovers",
    ],
    defaultPlayerMetrics: [
      "points",
      "rebounds",
      "assists",
      "steals",
      "blocks",
      "turnovers",
      "field_goals_made",
      "field_goals_attempted",
      "three_pt_made",
      "three_pt_attempted",
      "free_throws_made",
      "free_throws_attempted",
    ],
    defaultScorepadFields: ["Officials", "Fouls", "Timeouts Used", "Notes"],
  },
  {
    id: "volleyball",
    name: "Volleyball",
    clockMode: "none",
    periodLengthSeconds: 0,
    defaultPeriodLabel: "Set 1",
    quickActions: [
      { id: "home_point", label: "Home Point", eventType: "rally_point", pointsHome: 1, pointsAway: 0 },
      { id: "away_point", label: "Away Point", eventType: "rally_point", pointsHome: 0, pointsAway: 1 },
      { id: "ace", label: "Ace", eventType: "ace", pointsHome: 1, pointsAway: 0 },
      { id: "block", label: "Block", eventType: "block", pointsHome: 1, pointsAway: 0 },
    ],
    teamMetricCatalog: [
      { key: "points", label: "Points" },
      { key: "kills", label: "Kills" },
      { key: "attack_errors", label: "Attack Errors" },
      { key: "aces", label: "Aces" },
      { key: "service_errors", label: "Service Errors" },
      { key: "digs", label: "Digs" },
      { key: "blocks", label: "Blocks" },
      { key: "assists", label: "Assists" },
      { key: "reception_errors", label: "Reception Errors" },
      { key: "sideout_wins", label: "Sideout Wins" },
    ],
    playerMetricCatalog: [
      { key: "kills", label: "Kills" },
      { key: "attack_attempts", label: "Attack Attempts" },
      { key: "attack_errors", label: "Attack Errors" },
      { key: "assists", label: "Assists" },
      { key: "aces", label: "Aces" },
      { key: "service_errors", label: "Service Errors" },
      { key: "digs", label: "Digs" },
      { key: "blocks_solo", label: "Solo Blocks" },
      { key: "blocks_assist", label: "Block Assists" },
      { key: "reception_errors", label: "Reception Errors" },
    ],
    defaultTeamMetrics: [
      "points",
      "kills",
      "attack_errors",
      "aces",
      "service_errors",
      "digs",
      "blocks",
      "assists",
    ],
    defaultPlayerMetrics: [
      "kills",
      "assists",
      "digs",
      "aces",
      "service_errors",
      "blocks_solo",
      "blocks_assist",
    ],
    defaultScorepadFields: ["Referee", "Line Judges", "Set Notes"],
  },
  {
    id: "ultimate_frisbee",
    name: "Ultimate Frisbee",
    clockMode: "countdown",
    periodLengthSeconds: 45 * 60,
    defaultPeriodLabel: "1st Half",
    quickActions: [
      { id: "home_point", label: "Home Point", eventType: "point", pointsHome: 1, pointsAway: 0 },
      { id: "away_point", label: "Away Point", eventType: "point", pointsHome: 0, pointsAway: 1 },
      { id: "turnover", label: "Turnover", eventType: "turnover", pointsHome: 0, pointsAway: 0 },
      { id: "timeout", label: "Timeout", eventType: "timeout", pointsHome: 0, pointsAway: 0 },
    ],
    teamMetricCatalog: [
      { key: "points", label: "Points" },
      { key: "holds", label: "Holds" },
      { key: "breaks", label: "Breaks" },
      { key: "completions", label: "Completions" },
      { key: "turnovers", label: "Turnovers" },
      { key: "defensive_blocks", label: "Defensive Blocks" },
      { key: "timeouts_used", label: "Timeouts Used" },
      { key: "pulls", label: "Pulls" },
    ],
    playerMetricCatalog: [
      { key: "goals", label: "Goals" },
      { key: "assists", label: "Assists" },
      { key: "blocks", label: "Blocks" },
      { key: "turnovers", label: "Turnovers" },
      { key: "completions", label: "Completions" },
      { key: "throwaways", label: "Throwaways" },
      { key: "drops", label: "Drops" },
      { key: "pulls", label: "Pulls" },
      { key: "callahans", label: "Callahans" },
    ],
    defaultTeamMetrics: [
      "points",
      "holds",
      "breaks",
      "completions",
      "turnovers",
      "defensive_blocks",
      "timeouts_used",
    ],
    defaultPlayerMetrics: ["goals", "assists", "blocks", "turnovers", "completions", "throwaways", "drops"],
    defaultScorepadFields: ["Observer", "Weather", "Spirit Notes"],
  },
  {
    id: "tennis",
    name: "Tennis",
    clockMode: "none",
    periodLengthSeconds: 0,
    defaultPeriodLabel: "Set 1",
    quickActions: [
      { id: "home_point", label: "Home Point", eventType: "point", pointsHome: 1, pointsAway: 0 },
      { id: "away_point", label: "Away Point", eventType: "point", pointsHome: 0, pointsAway: 1 },
      { id: "ace", label: "Ace", eventType: "ace", pointsHome: 1, pointsAway: 0 },
      { id: "double_fault", label: "Double Fault", eventType: "double_fault", pointsHome: 0, pointsAway: 1 },
    ],
    teamMetricCatalog: [
      { key: "sets_won", label: "Sets Won" },
      { key: "games_won", label: "Games Won" },
      { key: "aces", label: "Aces" },
      { key: "double_faults", label: "Double Faults" },
      { key: "first_serves_in", label: "First Serves In" },
      { key: "first_serve_points_won", label: "First Serve Points Won" },
      { key: "second_serve_points_won", label: "Second Serve Points Won" },
      { key: "winners", label: "Winners" },
      { key: "unforced_errors", label: "Unforced Errors" },
      { key: "break_points_won", label: "Break Points Won" },
      { key: "break_points_faced", label: "Break Points Faced" },
    ],
    playerMetricCatalog: [
      { key: "aces", label: "Aces" },
      { key: "double_faults", label: "Double Faults" },
      { key: "first_serves_in", label: "First Serves In" },
      { key: "first_serve_points_won", label: "First Serve Points Won" },
      { key: "second_serve_points_won", label: "Second Serve Points Won" },
      { key: "winners", label: "Winners" },
      { key: "unforced_errors", label: "Unforced Errors" },
      { key: "break_points_won", label: "Break Points Won" },
      { key: "break_points_faced", label: "Break Points Faced" },
      { key: "net_points_won", label: "Net Points Won" },
    ],
    defaultTeamMetrics: [
      "sets_won",
      "games_won",
      "aces",
      "double_faults",
      "first_serves_in",
      "winners",
      "unforced_errors",
      "break_points_won",
    ],
    defaultPlayerMetrics: [
      "aces",
      "double_faults",
      "first_serves_in",
      "first_serve_points_won",
      "second_serve_points_won",
      "winners",
      "unforced_errors",
      "break_points_won",
    ],
    defaultScorepadFields: ["Umpire", "Court", "Weather", "Match Notes"],
  },
];

const DEFAULT_PROFILE = SPORT_PROFILES[0];

export function getSportProfiles(): SportProfile[] {
  return SPORT_PROFILES;
}

export function getSportProfileById(sportId: string): SportProfile {
  return SPORT_PROFILES.find((profile) => profile.id === sportId) ?? DEFAULT_PROFILE;
}

export function toMetricLabelMap(definitions: StatMetricDefinition[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const definition of definitions) {
    map[definition.key] = definition.label;
  }
  return map;
}
