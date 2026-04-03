import { getSportProfileById, type ScoreActionPreset } from "@/lib/sport-config";
import { sanitizeTrackedMetricKeys } from "@/lib/metrics";

export type GameCompetitionType = "league" | "tournament" | "ad_hoc";

export interface GameMetadata {
  competitionType: GameCompetitionType;
  trackedTeamMetrics: string[];
  trackedPlayerMetrics: string[];
  trackedPlayerSides: Array<"home" | "away">;
  scorepadFields: string[];
  scorepadValues: Record<string, string>;
  quickActions: ScoreActionPreset[];
  clockSecondsRemaining: number | null;
  clockRunning: boolean;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeScorepadValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim()) {
      continue;
    }
    if (typeof item === "string") {
      output[key.trim()] = item;
    } else if (item !== null && item !== undefined) {
      output[key.trim()] = String(item);
    }
  }
  return output;
}

function sanitizeQuickActions(value: unknown, fallback: ScoreActionPreset[]): ScoreActionPreset[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const row = item as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        typeof row.label !== "string" ||
        typeof row.eventType !== "string" ||
        typeof row.pointsHome !== "number" ||
        typeof row.pointsAway !== "number"
      ) {
        return null;
      }
      return {
        id: row.id,
        label: row.label,
        eventType: row.eventType,
        pointsHome: row.pointsHome,
        pointsAway: row.pointsAway,
      };
    })
    .filter((row): row is ScoreActionPreset => row !== null);

  return parsed.length > 0 ? parsed : fallback;
}

function sanitizePlayerSides(value: unknown): Array<"home" | "away"> {
  if (!Array.isArray(value)) {
    return [];
  }

  const output: Array<"home" | "away"> = [];
  for (const item of value) {
    if (item === "home" || item === "away") {
      output.push(item);
    }
  }
  return Array.from(new Set(output));
}

export function parseGameMetadata(rawMetadata: unknown, sportId: string): GameMetadata {
  const profile = getSportProfileById(sportId);
  const metadata =
    rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, unknown>)
      : {};

  const competitionTypeValue = metadata.competition_type;
  const competitionType: GameCompetitionType =
    competitionTypeValue === "tournament" || competitionTypeValue === "ad_hoc"
      ? competitionTypeValue
      : "league";

  const trackedTeamMetrics = sanitizeTrackedMetricKeys(
    sanitizeStringArray(metadata.tracked_team_metrics),
    sportId,
    "team",
    profile.defaultTeamMetrics,
  );
  const trackedPlayerMetrics = sanitizeTrackedMetricKeys(
    sanitizeStringArray(metadata.tracked_player_metrics),
    sportId,
    "player",
    profile.defaultPlayerMetrics,
  );
  const trackedPlayerSides = sanitizePlayerSides(metadata.tracked_player_sides);
  const scorepadFields = sanitizeStringArray(metadata.scorepad_fields);

  const clockSecondsRemainingRaw = metadata.clock_seconds_remaining;
  const clockSecondsRemaining =
    typeof clockSecondsRemainingRaw === "number" && Number.isFinite(clockSecondsRemainingRaw)
      ? clockSecondsRemainingRaw
      : profile.clockMode === "countdown"
        ? profile.periodLengthSeconds
        : null;

  const clockRunning = metadata.clock_running === true;

  return {
    competitionType,
    trackedTeamMetrics,
    trackedPlayerMetrics,
    trackedPlayerSides: trackedPlayerSides.length > 0 ? trackedPlayerSides : ["home", "away"],
    scorepadFields: scorepadFields.length > 0 ? scorepadFields : profile.defaultScorepadFields,
    scorepadValues: sanitizeScorepadValues(metadata.scorepad_values),
    quickActions: sanitizeQuickActions(metadata.quick_actions, profile.quickActions),
    clockSecondsRemaining,
    clockRunning,
  };
}

export function buildDefaultGameMetadata(
  sportId: string,
  competitionType: GameCompetitionType,
  trackedTeamMetrics?: string[],
  trackedPlayerMetrics?: string[],
  trackedPlayerSides?: Array<"home" | "away">,
  scorepadFields?: string[],
): Record<string, unknown> {
  const profile = getSportProfileById(sportId);
  const normalizedTeamMetrics = sanitizeTrackedMetricKeys(
    trackedTeamMetrics,
    sportId,
    "team",
    profile.defaultTeamMetrics,
  );
  const normalizedPlayerMetrics = sanitizeTrackedMetricKeys(
    trackedPlayerMetrics,
    sportId,
    "player",
    profile.defaultPlayerMetrics,
  );

  return {
    competition_type: competitionType,
    tracked_team_metrics: normalizedTeamMetrics,
    tracked_player_metrics: normalizedPlayerMetrics,
    tracked_player_sides:
      trackedPlayerSides && trackedPlayerSides.length > 0
        ? Array.from(new Set(trackedPlayerSides))
        : ["home", "away"],
    scorepad_fields:
      scorepadFields && scorepadFields.length > 0 ? scorepadFields : profile.defaultScorepadFields,
    scorepad_values: {},
    quick_actions: profile.quickActions,
    clock_seconds_remaining:
      profile.clockMode === "countdown" ? profile.periodLengthSeconds : null,
    clock_running: false,
  };
}

export function formatClock(clockSecondsRemaining: number | null): string {
  if (clockSecondsRemaining === null) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(clockSecondsRemaining));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
