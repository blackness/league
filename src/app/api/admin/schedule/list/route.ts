import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-request";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

interface ListPayload {
  seasonId?: string;
}

interface GameListRow {
  id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  status: "scheduled" | "live" | "final" | "postponed" | "canceled";
  venue_name: string | null;
}

export async function POST(request: Request) {
  const access = requireAdminRole(request, "viewer");
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
          "Schedule listing requires SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project environment variables.",
      },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as ListPayload;
  const seasonId = payload.seasonId?.trim() ?? "";
  if (!seasonId) {
    return NextResponse.json({ error: "seasonId is required." }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Could not create Supabase client." }, { status: 500 });
  }

  const gamesResult = await client
    .from("games")
    .select("id, home_team_id, away_team_id, scheduled_at, status, venue_name")
    .eq("season_id", seasonId)
    .order("scheduled_at", { ascending: true });

  if (gamesResult.error) {
    return NextResponse.json({ error: gamesResult.error.message }, { status: 400 });
  }

  const games = (gamesResult.data ?? []) as GameListRow[];
  const teamIds = Array.from(
    new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id]).filter(Boolean)),
  );

  const teamNameById = new Map<string, string>();
  if (teamIds.length > 0) {
    const teamsResult = await client.from("teams").select("id, name").in("id", teamIds);
    if (teamsResult.error) {
      return NextResponse.json({ error: teamsResult.error.message }, { status: 400 });
    }

    for (const team of (teamsResult.data ?? []) as Array<{ id: string; name: string }>) {
      teamNameById.set(team.id, team.name);
    }
  }

  return NextResponse.json({
    seasonId,
    games: games.map((game) => ({
      gameId: game.id,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeTeamName: teamNameById.get(game.home_team_id) ?? "Home Team",
      awayTeamName: teamNameById.get(game.away_team_id) ?? "Away Team",
      scheduledAt: game.scheduled_at,
      status: game.status,
      venueName: game.venue_name,
    })),
  });
}

