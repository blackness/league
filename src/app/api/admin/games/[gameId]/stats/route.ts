import { NextResponse } from "next/server";
import { parseGameMetadata } from "@/lib/game-metadata";
import { normalizeStatsForStorage } from "@/lib/metrics";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

interface GameRow {
  id: string;
  sport_id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  metadata: unknown;
}

interface JsonRecord {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeNumericStats(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      continue;
    }

    if (Math.abs(rawValue) > 1_000_000) {
      continue;
    }

    output[key] = rawValue;
  }
  return output;
}

function toTrackedPlayerTeamIds(game: GameRow, trackedSides: Array<"home" | "away">): Set<string> {
  const output = new Set<string>();
  if (trackedSides.includes("home")) {
    output.add(game.home_team_id);
  }
  if (trackedSides.includes("away")) {
    output.add(game.away_team_id);
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
  const { gameId } = await context.params;

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        error: "Supabase is not configured.",
      },
      { status: 400 },
    );
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Stats write routes require SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project environment variables.",
      },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  const payloadRecord = isRecord(payload) ? payload : null;
  const action = payloadRecord ? payloadRecord.action : null;
  if (
    action !== "upsert_team_stats" &&
    action !== "upsert_player_stat" &&
    action !== "delete_player_stat"
  ) {
    return NextResponse.json({ error: "Unsupported or invalid action payload." }, { status: 400 });
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return NextResponse.json(
      {
        error: "Could not create Supabase client.",
      },
      { status: 500 },
    );
  }

  const gameResult = await client
    .from("games")
    .select("id, sport_id, season_id, home_team_id, away_team_id, metadata")
    .eq("id", gameId)
    .maybeSingle();

  const gameRow = gameResult.data as GameRow | null;
  if (gameResult.error || !gameRow) {
    return NextResponse.json(
      {
        error: "Game not found.",
      },
      { status: 404 },
    );
  }

  const parsedMetadata = parseGameMetadata(gameRow.metadata, gameRow.sport_id);
  const allowedTeamIds = new Set([gameRow.home_team_id, gameRow.away_team_id]);

  if (action === "upsert_team_stats") {
    const teamId = toNonEmptyString(payloadRecord?.teamId);
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required." }, { status: 400 });
    }
    if (!allowedTeamIds.has(teamId)) {
      return NextResponse.json(
        { error: "teamId must be one of the game teams." },
        { status: 400 },
      );
    }

    const safeStats = sanitizeNumericStats(payloadRecord?.stats);
    const stats = normalizeStatsForStorage(
      safeStats,
      gameRow.sport_id,
      "team",
      parsedMetadata.trackedTeamMetrics,
    );
    const result = await (
      client.from("game_team_stats") as unknown as {
        upsert: (
          value: Record<string, unknown>,
          options: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).upsert(
      {
        game_id: gameId,
        team_id: teamId,
        stats,
      },
      {
        onConflict: "game_id,team_id",
      },
    );

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      action,
    });
  }

  if (action === "upsert_player_stat") {
    const teamId = toNonEmptyString(payloadRecord?.teamId);
    const playerId = toNonEmptyString(payloadRecord?.playerId);
    if (!teamId || !playerId) {
      return NextResponse.json({ error: "teamId and playerId are required." }, { status: 400 });
    }
    if (!allowedTeamIds.has(teamId)) {
      return NextResponse.json(
        { error: "teamId must be one of the game teams." },
        { status: 400 },
      );
    }

    const trackedPlayerTeamIds = toTrackedPlayerTeamIds(gameRow, parsedMetadata.trackedPlayerSides);
    if (!trackedPlayerTeamIds.has(teamId)) {
      return NextResponse.json(
        {
          error:
            "Player stats are not enabled for this team side in game setup. Update tracked player sides first.",
        },
        { status: 400 },
      );
    }

    const rosterResult = await client
      .from("team_rosters")
      .select("player_id")
      .eq("season_id", gameRow.season_id)
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .eq("is_active", true)
      .maybeSingle();

    if (rosterResult.error) {
      return NextResponse.json({ error: rosterResult.error.message }, { status: 400 });
    }
    if (!rosterResult.data) {
      return NextResponse.json(
        {
          error: "Player is not on an active roster for this game's season/team.",
        },
        { status: 400 },
      );
    }

    const safeStats = sanitizeNumericStats(payloadRecord?.stats);
    const stats = normalizeStatsForStorage(
      safeStats,
      gameRow.sport_id,
      "player",
      parsedMetadata.trackedPlayerMetrics,
    );

    const rawMinutes =
      typeof payloadRecord?.minutesPlayed === "number" && Number.isFinite(payloadRecord.minutesPlayed)
        ? payloadRecord.minutesPlayed
        : null;
    const minutesPlayed =
      rawMinutes === null ? null : Math.max(0, Math.min(300, Number(rawMinutes.toFixed(2))));
    const starter = payloadRecord?.starter === true;

    const result = await (
      client.from("player_game_stats") as unknown as {
        upsert: (
          value: Record<string, unknown>,
          options: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).upsert(
      {
        game_id: gameId,
        team_id: teamId,
        player_id: playerId,
        starter,
        minutes_played: minutesPlayed,
        stats,
      },
      {
        onConflict: "game_id,player_id",
      },
    );

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      action,
    });
  }

  if (action === "delete_player_stat") {
    const playerId = toNonEmptyString(payloadRecord?.playerId);
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required." }, { status: 400 });
    }

    const existingRow = await client
      .from("player_game_stats")
      .select("player_id")
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (existingRow.error) {
      return NextResponse.json({ error: existingRow.error.message }, { status: 400 });
    }
    if (!existingRow.data) {
      return NextResponse.json({ error: "Player stat row not found for game." }, { status: 404 });
    }

    const result = await (
      client.from("player_game_stats") as unknown as {
        delete: () => {
          eq: (column: string, value: string) => {
            eq: (columnTwo: string, valueTwo: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      }
    )
      .delete()
      .eq("game_id", gameId)
      .eq("player_id", playerId);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      action,
    });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
