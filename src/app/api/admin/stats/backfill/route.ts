import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminRole, toAdminActor } from "@/lib/admin-request";
import { normalizeStatsForStorage } from "@/lib/metrics";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

type BackfillMode = "dry_run" | "commit";
type StatsTableName = "game_team_stats" | "player_game_stats";

interface BackfillPayload {
  mode?: BackfillMode;
  batchSize?: number;
  cursor?: {
    teamCursor?: string | null;
    playerCursor?: string | null;
  };
}

interface StatsRow {
  id: string;
  game_id: string;
  stats: unknown;
}

interface GameRow {
  id: string;
  sport_id: string;
}

interface JsonRecord {
  [key: string]: unknown;
}

interface BatchFetchResult {
  rows: StatsRow[];
  nextCursor: string | null;
  hasMore: boolean;
  error: string | null;
}

interface ScanSummary {
  teamRows: number;
  playerRows: number;
  totalRows: number;
}

interface CursorState {
  teamCursor: string | null;
  playerCursor: string | null;
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function shallowPreservedStats(rawStats: unknown): JsonRecord {
  if (!isPlainRecord(rawStats)) {
    return {};
  }

  const output: JsonRecord = {};
  for (const [key, value] of Object.entries(rawStats)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      output[key] = value;
    }
  }
  return output;
}

function buildNextStats(rawStats: unknown, sportId: string, scope: "team" | "player"): JsonRecord {
  const preserved = shallowPreservedStats(rawStats);
  const normalizedNumeric = normalizeStatsForStorage(rawStats, sportId, scope);
  return {
    ...preserved,
    ...normalizedNumeric,
  };
}

function toScanSummary(teamRows: StatsRow[], playerRows: StatsRow[]): ScanSummary {
  return {
    teamRows: teamRows.length,
    playerRows: playerRows.length,
    totalRows: teamRows.length + playerRows.length,
  };
}

async function fetchStatsBatch(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  tableName: StatsTableName,
  cursor: string | null,
  batchSize: number,
): Promise<BatchFetchResult> {
  const baseQuery = client
    .from(tableName)
    .select("id, game_id, stats")
    .order("id", { ascending: true })
    .limit(batchSize);

  const result = cursor
    ? await (
        baseQuery as unknown as {
          gt: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        }
      ).gt("id", cursor)
    : await baseQuery;

  if (result.error) {
    return {
      rows: [],
      nextCursor: cursor,
      hasMore: false,
      error: result.error.message,
    };
  }

  const rows = (result.data ?? []) as StatsRow[];
  return {
    rows,
    nextCursor: rows.length > 0 ? rows[rows.length - 1].id : cursor,
    hasMore: rows.length === batchSize,
    error: null,
  };
}

async function fetchGamesByIds(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  gameIds: string[],
): Promise<{ gameById: Map<string, GameRow>; error: string | null }> {
  const gameById = new Map<string, GameRow>();
  const chunkSize = 250;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);
    const result = await client.from("games").select("id, sport_id").in("id", chunk);

    if (result.error) {
      return { gameById: new Map(), error: result.error.message };
    }

    for (const row of (result.data ?? []) as GameRow[]) {
      gameById.set(row.id, row);
    }
  }

  return { gameById, error: null };
}

export async function POST(request: Request) {
  const access = requireAdminRole(request, "owner");
  if (!access.ok) {
    return access.response as NextResponse;
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Backfill write routes require SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project environment variables.",
      },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as BackfillPayload;
  const mode: BackfillMode = payload.mode === "commit" ? "commit" : "dry_run";
  const batchSize = Math.min(2000, Math.max(1, Math.floor(payload.batchSize ?? 500)));
  const cursor: CursorState = {
    teamCursor: payload.cursor?.teamCursor ?? null,
    playerCursor: payload.cursor?.playerCursor ?? null,
  };

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Could not create Supabase client." }, { status: 500 });
  }

  const [teamBatch, playerBatch] = await Promise.all([
    fetchStatsBatch(client, "game_team_stats", cursor.teamCursor, batchSize),
    fetchStatsBatch(client, "player_game_stats", cursor.playerCursor, batchSize),
  ]);

  if (teamBatch.error || playerBatch.error) {
    return NextResponse.json(
      { error: teamBatch.error ?? playerBatch.error ?? "Failed to load stats rows." },
      { status: 400 },
    );
  }

  const teamRows = teamBatch.rows;
  const playerRows = playerBatch.rows;
  const gameIds = Array.from(new Set([...teamRows, ...playerRows].map((row) => row.game_id)));
  const gamesResult = await fetchGamesByIds(client, gameIds);

  if (gamesResult.error) {
    return NextResponse.json({ error: gamesResult.error }, { status: 400 });
  }
  const gameById = gamesResult.gameById;

  const changedSamples: Array<{
    table: StatsTableName;
    rowId: string;
    gameId: string;
    sportId: string;
  }> = [];
  let skippedMissingGame = 0;
  let teamChanged = 0;
  let playerChanged = 0;
  let teamUpdated = 0;
  let playerUpdated = 0;

  for (const row of teamRows) {
    const game = gameById.get(row.game_id);
    if (!game) {
      skippedMissingGame += 1;
      continue;
    }

    const originalStats = isPlainRecord(row.stats) ? row.stats : {};
    const nextStats = buildNextStats(originalStats, game.sport_id, "team");
    const hasChanged = stableStringify(originalStats) !== stableStringify(nextStats);
    if (!hasChanged) {
      continue;
    }

    teamChanged += 1;
    if (changedSamples.length < 20) {
      changedSamples.push({
        table: "game_team_stats",
        rowId: row.id,
        gameId: row.game_id,
        sportId: game.sport_id,
      });
    }

    if (mode === "commit") {
      const updateResult = await (
        client.from("game_team_stats") as unknown as {
          update: (value: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .update({ stats: nextStats })
        .eq("id", row.id);

      if (updateResult.error) {
        return NextResponse.json(
          { error: `Failed updating game_team_stats row ${row.id}: ${updateResult.error.message}` },
          { status: 400 },
        );
      }
      teamUpdated += 1;
    }
  }

  for (const row of playerRows) {
    const game = gameById.get(row.game_id);
    if (!game) {
      skippedMissingGame += 1;
      continue;
    }

    const originalStats = isPlainRecord(row.stats) ? row.stats : {};
    const nextStats = buildNextStats(originalStats, game.sport_id, "player");
    const hasChanged = stableStringify(originalStats) !== stableStringify(nextStats);
    if (!hasChanged) {
      continue;
    }

    playerChanged += 1;
    if (changedSamples.length < 20) {
      changedSamples.push({
        table: "player_game_stats",
        rowId: row.id,
        gameId: row.game_id,
        sportId: game.sport_id,
      });
    }

    if (mode === "commit") {
      const updateResult = await (
        client.from("player_game_stats") as unknown as {
          update: (value: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .update({ stats: nextStats })
        .eq("id", row.id);

      if (updateResult.error) {
        return NextResponse.json(
          { error: `Failed updating player_game_stats row ${row.id}: ${updateResult.error.message}` },
          { status: 400 },
        );
      }
      playerUpdated += 1;
    }
  }

  const hasMore = teamBatch.hasMore || playerBatch.hasMore;
  const nextCursor: CursorState = {
    teamCursor: teamBatch.nextCursor,
    playerCursor: playerBatch.nextCursor,
  };

  await writeAdminAuditLog({
    action: mode === "commit" ? "stats.backfill.commit_batch" : "stats.backfill.dry_batch",
    actor: toAdminActor(access.role),
    role: access.role,
    targetTable: "game_team_stats/player_game_stats",
    targetId: null,
    summary: `Processed stats backfill batch (${mode}).`,
    details: {
      batchSize,
      scanned: {
        teamRows: teamRows.length,
        playerRows: playerRows.length,
      },
      changed: {
        teamRows: teamChanged,
        playerRows: playerChanged,
      },
      updated: {
        teamRows: teamUpdated,
        playerRows: playerUpdated,
      },
      skippedMissingGame,
      hasMore,
      nextCursor,
    },
  });

  return NextResponse.json({
    mode,
    batchSize,
    cursor: nextCursor,
    hasMore,
    scanned: toScanSummary(teamRows, playerRows),
    changed: {
      teamRows: teamChanged,
      playerRows: playerChanged,
      totalRows: teamChanged + playerChanged,
    },
    updated: {
      teamRows: teamUpdated,
      playerRows: playerUpdated,
      totalRows: teamUpdated + playerUpdated,
    },
    skippedMissingGame,
    samples: changedSamples,
    message:
      mode === "commit"
        ? `Batch complete: updated ${teamUpdated + playerUpdated} row(s).`
        : `Batch dry run complete: ${teamChanged + playerChanged} row(s) would be updated.`,
  });
}
