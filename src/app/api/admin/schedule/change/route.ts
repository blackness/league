import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminRole, toAdminActor } from "@/lib/admin-request";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

type GameStatus = "scheduled" | "live" | "final" | "postponed" | "canceled";

interface ChangePayload {
  gameId?: string;
  scheduledAt?: string;
  status?: GameStatus;
  venueName?: string | null;
  reason?: string;
}

interface GameRow {
  id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  status: GameStatus;
  venue_name: string | null;
  metadata: unknown;
}

function normalizeVenueName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 160);
}

function normalizeReason(value: unknown): string {
  if (typeof value !== "string") {
    return "Schedule updated by admin";
  }
  const normalized = value.trim();
  if (!normalized) {
    return "Schedule updated by admin";
  }
  return normalized.slice(0, 500);
}

function normalizeStatus(value: unknown, fallback: GameStatus): GameStatus {
  if (
    value === "scheduled" ||
    value === "live" ||
    value === "final" ||
    value === "postponed" ||
    value === "canceled"
  ) {
    return value;
  }
  return fallback;
}

function parseScheduledAt(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function toIsoRangeAnchor(isoValue: string, deltaMinutes: number): string {
  const base = new Date(isoValue);
  base.setMinutes(base.getMinutes() + deltaMinutes);
  return base.toISOString();
}

export async function POST(request: Request) {
  const access = requireAdminRole(request, "admin");
  if (!access.ok) {
    return access.response as NextResponse;
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase environment is not configured." }, { status: 400 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Schedule change routes require SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project environment variables.",
      },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as ChangePayload;
  const gameId = payload.gameId?.trim() ?? "";
  const reason = normalizeReason(payload.reason);
  if (!gameId) {
    return NextResponse.json({ error: "gameId is required." }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Could not create Supabase client." }, { status: 500 });
  }

  const currentResult = await client
    .from("games")
    .select("id, season_id, home_team_id, away_team_id, scheduled_at, status, venue_name, metadata")
    .eq("id", gameId)
    .maybeSingle();

  const currentGame = currentResult.data as GameRow | null;
  if (currentResult.error || !currentGame) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  const nextScheduledAt = parseScheduledAt(payload.scheduledAt) ?? currentGame.scheduled_at;
  const nextStatus = normalizeStatus(payload.status, currentGame.status);
  const nextVenueName =
    typeof payload.venueName === "string" ? normalizeVenueName(payload.venueName) : currentGame.venue_name;

  // Team conflict check for nearby windows after schedule change.
  const conflictWindowStart = toIsoRangeAnchor(nextScheduledAt, -180);
  const conflictWindowEnd = toIsoRangeAnchor(nextScheduledAt, 180);
  const nearbyGamesResult = await client
    .from("games")
    .select("id, home_team_id, away_team_id, scheduled_at, status")
    .eq("season_id", currentGame.season_id)
    .neq("id", gameId)
    .gte("scheduled_at", conflictWindowStart)
    .lte("scheduled_at", conflictWindowEnd)
    .in("status", ["scheduled", "live"]);

  if (nearbyGamesResult.error) {
    return NextResponse.json({ error: nearbyGamesResult.error.message }, { status: 400 });
  }

  const teamIds = new Set([currentGame.home_team_id, currentGame.away_team_id]);
  const conflicts = ((nearbyGamesResult.data ?? []) as Array<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    scheduled_at: string;
    status: GameStatus;
  }>).filter(
    (game) => teamIds.has(game.home_team_id) || teamIds.has(game.away_team_id),
  );

  const metadata =
    currentGame.metadata && typeof currentGame.metadata === "object" && !Array.isArray(currentGame.metadata)
      ? (currentGame.metadata as Record<string, unknown>)
      : {};
  const nextMetadata = {
    ...metadata,
    schedule_last_change: {
      changed_at: new Date().toISOString(),
      changed_by: toAdminActor(access.role),
      reason,
      previous: {
        scheduled_at: currentGame.scheduled_at,
        status: currentGame.status,
        venue_name: currentGame.venue_name,
      },
      next: {
        scheduled_at: nextScheduledAt,
        status: nextStatus,
        venue_name: nextVenueName,
      },
      conflict_count: conflicts.length,
    },
  };

  const updateResult = await (
    client.from("games") as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      scheduled_at: nextScheduledAt,
      status: nextStatus,
      venue_name: nextVenueName,
      metadata: nextMetadata,
    })
    .eq("id", gameId);

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 400 });
  }

  // Best-effort insert for dedicated history table when available.
  await (
    client.from("schedule_change_history") as unknown as {
      insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }
  )
    .insert({
      game_id: gameId,
      changed_by: toAdminActor(access.role),
      reason,
      previous_values: {
        scheduled_at: currentGame.scheduled_at,
        status: currentGame.status,
        venue_name: currentGame.venue_name,
      },
      next_values: {
        scheduled_at: nextScheduledAt,
        status: nextStatus,
        venue_name: nextVenueName,
      },
      conflict_count: conflicts.length,
    })
    .catch(() => undefined);

  await writeAdminAuditLog({
    action: "schedule.change",
    actor: toAdminActor(access.role),
    role: access.role,
    targetTable: "games",
    targetId: gameId,
    summary: `Updated schedule for game ${gameId}.`,
    details: {
      reason,
      previous: {
        scheduledAt: currentGame.scheduled_at,
        status: currentGame.status,
        venueName: currentGame.venue_name,
      },
      next: {
        scheduledAt: nextScheduledAt,
        status: nextStatus,
        venueName: nextVenueName,
      },
      conflictCount: conflicts.length,
    },
  });

  return NextResponse.json({
    ok: true,
    gameId,
    reason,
    conflictCount: conflicts.length,
    conflicts,
    game: {
      scheduledAt: nextScheduledAt,
      status: nextStatus,
      venueName: nextVenueName,
    },
  });
}
