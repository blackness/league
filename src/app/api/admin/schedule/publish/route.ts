import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminRole, toAdminActor } from "@/lib/admin-request";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

interface PublishGameInput {
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: string;
}

interface PublishPayload {
  leagueId?: string;
  seasonId?: string;
  sportId?: string;
  games?: PublishGameInput[];
}

function normalizeTeamName(value: string): string {
  return value.trim().toLowerCase();
}

function buildGameKey(homeTeamId: string, awayTeamId: string, scheduledAt: string): string {
  return `${homeTeamId}|${awayTeamId}|${scheduledAt}`;
}

export async function POST(request: Request) {
  const access = requireAdminRole(request, "admin");
  if (!access.ok) {
    return access.response as NextResponse;
  }

  const payload = (await request.json()) as PublishPayload;
  const leagueId = payload.leagueId ?? "";
  const seasonId = payload.seasonId ?? "";
  const sportId = payload.sportId ?? "";
  const games = payload.games ?? [];

  if (!leagueId || !seasonId || !sportId) {
    return NextResponse.json(
      {
        error: "leagueId, seasonId, and sportId are required.",
      },
      { status: 400 },
    );
  }

  if (games.length === 0) {
    return NextResponse.json(
      {
        error: "No games were provided. Generate a schedule first.",
      },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        error: "Supabase environment variables are missing.",
      },
      { status: 400 },
    );
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Schedule publishing requires SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project settings.",
      },
      { status: 500 },
    );
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return NextResponse.json(
      {
        error: "Supabase client could not be created.",
      },
      { status: 500 },
    );
  }

  const teamsResult = await client
    .from("teams")
    .select("id, name")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  if (teamsResult.error) {
    return NextResponse.json(
      {
        error: `Could not load teams for this league: ${teamsResult.error.message}`,
      },
      { status: 400 },
    );
  }

  const teamRows = (teamsResult.data ?? []) as Array<{ id: string; name: string }>;
  const teamIdByName = new Map<string, string>();
  const duplicateNames = new Set<string>();

  for (const team of teamRows) {
    const key = normalizeTeamName(team.name);
    if (teamIdByName.has(key)) {
      duplicateNames.add(team.name);
      continue;
    }
    teamIdByName.set(key, team.id);
  }

  if (duplicateNames.size > 0) {
    return NextResponse.json(
      {
        error: `Duplicate team names found in league: ${Array.from(duplicateNames).join(", ")}. Rename teams to publish by name.`,
      },
      { status: 400 },
    );
  }

  const missingTeams = new Set<string>();
  const resolvedGames: Array<{
    round: number;
    homeTeamId: string;
    awayTeamId: string;
    scheduledAt: string;
  }> = [];

  for (const game of games) {
    const homeTeamId = teamIdByName.get(normalizeTeamName(game.homeTeamName));
    const awayTeamId = teamIdByName.get(normalizeTeamName(game.awayTeamName));

    if (!homeTeamId) {
      missingTeams.add(game.homeTeamName);
    }
    if (!awayTeamId) {
      missingTeams.add(game.awayTeamName);
    }

    if (homeTeamId && awayTeamId) {
      resolvedGames.push({
        round: game.round,
        homeTeamId,
        awayTeamId,
        scheduledAt: game.scheduledAt,
      });
    }
  }

  if (missingTeams.size > 0) {
    return NextResponse.json(
      {
        error: `Some team names were not found in the selected league: ${Array.from(missingTeams).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const existingResult = await client
    .from("games")
    .select("home_team_id, away_team_id, scheduled_at")
    .eq("season_id", seasonId);

  if (existingResult.error) {
    return NextResponse.json(
      {
        error: `Could not load existing season games: ${existingResult.error.message}`,
      },
      { status: 400 },
    );
  }

  const existingRows = (existingResult.data ?? []) as Array<{
    home_team_id: string;
    away_team_id: string;
    scheduled_at: string;
  }>;
  const existingKeys = new Set(
    existingRows.map((row) => buildGameKey(row.home_team_id, row.away_team_id, row.scheduled_at)),
  );

  const rowsToInsert = resolvedGames
    .filter(
      (game) => !existingKeys.has(buildGameKey(game.homeTeamId, game.awayTeamId, game.scheduledAt)),
    )
    .map((game) => ({
      league_id: leagueId,
      season_id: seasonId,
      sport_id: sportId,
      scheduled_at: game.scheduledAt,
      status: "scheduled",
      home_team_id: game.homeTeamId,
      away_team_id: game.awayTeamId,
      home_score: 0,
      away_score: 0,
      is_public: true,
      metadata: {
        source: "schedule_builder",
        round: game.round,
      },
    }));

  if (rowsToInsert.length > 0) {
    const insertResult = await (
      client.from("games") as unknown as {
        insert: (values: Array<Record<string, unknown>>) => Promise<{ error: { message: string } | null }>;
      }
    ).insert(rowsToInsert as Array<Record<string, unknown>>);

    if (insertResult.error) {
      return NextResponse.json(
        {
          error: `Could not insert games: ${insertResult.error.message}.`,
        },
        { status: 400 },
      );
    }
  }

  await writeAdminAuditLog({
    action: "schedule.publish",
    actor: toAdminActor(access.role),
    role: access.role,
    targetTable: "games",
    targetId: null,
    summary: `Published schedule into season ${seasonId}.`,
    details: {
      leagueId,
      seasonId,
      sportId,
      insertedCount: rowsToInsert.length,
      skippedCount: resolvedGames.length - rowsToInsert.length,
      sourceGamesCount: games.length,
    },
  });

  return NextResponse.json({
    insertedCount: rowsToInsert.length,
    skippedCount: resolvedGames.length - rowsToInsert.length,
    missingTeams: [],
    mode: "admin",
    message: "Schedule published to Supabase.",
  });
}
