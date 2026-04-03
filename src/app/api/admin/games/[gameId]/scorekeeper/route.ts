import { NextResponse } from "next/server";
import { parseGameMetadata } from "@/lib/game-metadata";
import type { GameStatus } from "@/lib/portal-types";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

type ScorekeeperAction = "save_state" | "record_event" | "save_scorepad";

interface JsonRecord {
  [key: string]: unknown;
}

const VALID_GAME_STATUSES: GameStatus[] = [
  "scheduled",
  "live",
  "final",
  "postponed",
  "canceled",
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function sanitizeStatus(value: unknown, fallback: GameStatus): GameStatus {
  if (typeof value !== "string") {
    return fallback;
  }
  return (VALID_GAME_STATUSES.find((status) => status === value) ?? fallback) as GameStatus;
}

function sanitizePeriodLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 80);
}

function sanitizeClockSeconds(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(86_400, Math.floor(value)));
}

function sanitizeClockRunning(value: unknown): boolean {
  return value === true;
}

function sanitizeEventType(value: unknown): string {
  if (typeof value !== "string") {
    return "event";
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized ? normalized.slice(0, 64) : "event";
}

function sanitizeEventDelta(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-100, Math.min(100, Math.floor(value)));
}

function sanitizeActorName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 120);
}

function sanitizeEventPayload(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const notesRaw = value.notes;
  if (typeof notesRaw !== "string") {
    return {};
  }
  const notes = notesRaw.trim();
  if (!notes) {
    return {};
  }
  return {
    notes: notes.slice(0, 2000),
  };
}

function sanitizeScorepadValues(
  value: unknown,
  allowedFields: string[],
): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const allowed = new Set(allowedFields.map((field) => field.trim()).filter(Boolean));
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!allowed.has(key)) {
      continue;
    }
    if (typeof raw !== "string") {
      continue;
    }
    output[key] = raw.slice(0, 1000);
  }
  return output;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      gameId: string;
    }>;
  },
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase environment not configured." }, { status: 400 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Scorekeeper write routes require SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project environment variables.",
      },
      { status: 500 },
    );
  }

  const { gameId } = await context.params;
  const payload = await request.json().catch(() => null);
  const payloadRecord = isRecord(payload) ? payload : null;
  const action = payloadRecord?.action as ScorekeeperAction | undefined;

  if (action !== "save_state" && action !== "record_event" && action !== "save_scorepad") {
    return NextResponse.json({ error: "Unsupported or invalid action payload." }, { status: 400 });
  }
  if (!payloadRecord) {
    return NextResponse.json({ error: "Unsupported or invalid action payload." }, { status: 400 });
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return NextResponse.json({ error: "Could not create Supabase client." }, { status: 500 });
  }

  const gameResult = await client
    .from("games")
    .select("id, sport_id, status, metadata")
    .eq("id", gameId)
    .maybeSingle();

  const gameRow = gameResult.data as
    | { id: string; sport_id: string; status: GameStatus; metadata: unknown }
    | null;
  if (gameResult.error || !gameRow) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  const parsedMetadata = parseGameMetadata(gameRow.metadata, gameRow.sport_id);
  const currentMetadata =
    gameRow.metadata && typeof gameRow.metadata === "object" && !Array.isArray(gameRow.metadata)
      ? (gameRow.metadata as Record<string, unknown>)
      : {};

  if (action === "save_state") {
    const nextHomeScore = sanitizeScore(payloadRecord.homeScore);
    const nextAwayScore = sanitizeScore(payloadRecord.awayScore);
    const nextStatus = sanitizeStatus(payloadRecord.status, gameRow.status);
    const nextPeriodLabel = sanitizePeriodLabel(payloadRecord.periodLabel);
    const nextClockSecondsRemaining = sanitizeClockSeconds(payloadRecord.clockSecondsRemaining);
    const nextClockRunning = sanitizeClockRunning(payloadRecord.clockRunning);

    const updatedMetadata = {
      ...currentMetadata,
      clock_seconds_remaining: nextClockSecondsRemaining,
      clock_running: nextClockRunning,
    };

    const result = await (
      client.from("games") as unknown as {
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update({
        home_score: nextHomeScore,
        away_score: nextAwayScore,
        status: nextStatus,
        period_label: nextPeriodLabel,
        metadata: updatedMetadata,
      })
      .eq("id", gameId);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action });
  }

  if (action === "record_event") {
    const pointsHome = sanitizeEventDelta(payloadRecord.pointsHome);
    const pointsAway = sanitizeEventDelta(payloadRecord.pointsAway);
    const nextHomeScore = sanitizeScore(payloadRecord.homeScore);
    const nextAwayScore = sanitizeScore(payloadRecord.awayScore);
    const nextStatus = sanitizeStatus(payloadRecord.status, gameRow.status);
    const nextPeriodLabel = sanitizePeriodLabel(payloadRecord.periodLabel);
    const nextClockSecondsRemaining = sanitizeClockSeconds(payloadRecord.clockSecondsRemaining);
    const nextClockRunning = sanitizeClockRunning(payloadRecord.clockRunning);
    const eventType = sanitizeEventType(payloadRecord.eventType);
    const actorName = sanitizeActorName(payloadRecord.actorName);
    const eventPayload = sanitizeEventPayload(payloadRecord.payload);

    const latestEventResult = await client
      .from("game_events")
      .select("event_index")
      .eq("game_id", gameId)
      .order("event_index", { ascending: false })
      .limit(1);

    if (latestEventResult.error) {
      return NextResponse.json({ error: latestEventResult.error.message }, { status: 400 });
    }

    const nextIndex =
      ((latestEventResult.data?.[0] as { event_index?: number } | undefined)?.event_index ?? 0) + 1;

    const insertEvent = await (
      client.from("game_events") as unknown as {
        insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).insert({
      game_id: gameId,
      event_index: nextIndex,
      event_type: eventType,
      points_home: pointsHome,
      points_away: pointsAway,
      actor_name: actorName,
      source: "manual",
      payload: eventPayload,
    });

    if (insertEvent.error) {
      return NextResponse.json({ error: insertEvent.error.message }, { status: 400 });
    }

    const updatedMetadata = {
      ...currentMetadata,
      clock_seconds_remaining: nextClockSecondsRemaining,
      clock_running: nextClockRunning,
    };

    const updateGame = await (
      client.from("games") as unknown as {
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update({
        home_score: nextHomeScore,
        away_score: nextAwayScore,
        status: nextStatus,
        period_label: nextPeriodLabel,
        metadata: updatedMetadata,
      })
      .eq("id", gameId);

    if (updateGame.error) {
      return NextResponse.json({ error: updateGame.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      action,
      trackedTeamMetrics: parsedMetadata.trackedTeamMetrics,
      trackedPlayerMetrics: parsedMetadata.trackedPlayerMetrics,
    });
  }

  if (action === "save_scorepad") {
    const safeValues = sanitizeScorepadValues(payloadRecord.values, parsedMetadata.scorepadFields);
    const updatedMetadata = {
      ...currentMetadata,
      scorepad_values: safeValues,
    };

    const result = await (
      client.from("games") as unknown as {
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update({
        metadata: updatedMetadata,
      })
      .eq("id", gameId);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
