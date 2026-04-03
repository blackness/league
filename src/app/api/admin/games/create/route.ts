import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminRole, toAdminActor } from "@/lib/admin-request";
import { buildDefaultGameMetadata, type GameCompetitionType } from "@/lib/game-metadata";
import { getSportProfileById } from "@/lib/sport-config";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

interface CreateGamePayload {
  competitionType?: GameCompetitionType;
  competitionName?: string;
  sportId?: string;
  leagueId?: string;
  seasonId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homePlayers?: string[];
  awayPlayers?: string[];
  trackedTeamMetrics?: string[];
  trackedPlayerMetrics?: string[];
  trackHomePlayerStats?: boolean;
  trackAwayPlayerStats?: boolean;
  scorepadFields?: string[];
  scheduledAt?: string;
  startNow?: boolean;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function splitPlayerName(value: string): { firstName: string; lastName: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { firstName: "Unknown", lastName: "Player" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Player" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function playerNameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
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
          "Admin write routes require SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project environment variables.",
      },
      { status: 500 },
    );
  }

  const payload = (await request.json()) as CreateGamePayload;
  const competitionType: GameCompetitionType = payload.competitionType ?? "ad_hoc";
  const sportId = (payload.sportId ?? "hockey").trim();
  const homeTeamIdInput = payload.homeTeamId?.trim() || null;
  const awayTeamIdInput = payload.awayTeamId?.trim() || null;
  const homeTeamNameInput = (payload.homeTeamName ?? "").trim();
  const awayTeamNameInput = (payload.awayTeamName ?? "").trim();

  if (homeTeamIdInput && awayTeamIdInput && homeTeamIdInput === awayTeamIdInput) {
    return NextResponse.json({ error: "Home and away must be different teams." }, { status: 400 });
  }
  if (!homeTeamIdInput && !homeTeamNameInput) {
    return NextResponse.json(
      { error: "Select or enter a home team before creating the game." },
      { status: 400 },
    );
  }
  if (!awayTeamIdInput && !awayTeamNameInput) {
    return NextResponse.json(
      { error: "Select or enter an away team before creating the game." },
      { status: 400 },
    );
  }
  if (
    !homeTeamIdInput &&
    !awayTeamIdInput &&
    homeTeamNameInput &&
    awayTeamNameInput &&
    homeTeamNameInput.toLowerCase() === awayTeamNameInput.toLowerCase()
  ) {
    return NextResponse.json({ error: "Home and away team names must be different." }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Could not create Supabase client." }, { status: 500 });
  }

  const sportProfile = getSportProfileById(sportId);
  let leagueId = payload.leagueId?.trim() || null;
  let seasonId = payload.seasonId?.trim() || null;
  const selectedTeamIds = Array.from(
    new Set([homeTeamIdInput, awayTeamIdInput].filter((value): value is string => Boolean(value))),
  );
  const selectedTeamsById = new Map<string, { id: string; name: string; league_id: string }>();

  if (selectedTeamIds.length > 0) {
    const selectedTeamsResult = await client
      .from("teams")
      .select("id, name, league_id")
      .in("id", selectedTeamIds);

    const selectedTeams = (selectedTeamsResult.data ?? []) as Array<{
      id: string;
      name: string;
      league_id: string;
    }>;

    if (selectedTeamsResult.error || selectedTeams.length !== selectedTeamIds.length) {
      return NextResponse.json(
        { error: "One or more selected teams could not be found." },
        { status: 400 },
      );
    }

    for (const team of selectedTeams) {
      selectedTeamsById.set(team.id, team);
    }

    const selectedLeagueIds = Array.from(new Set(selectedTeams.map((team) => team.league_id)));
    if (selectedLeagueIds.length > 1) {
      return NextResponse.json(
        { error: "Selected home/away teams must belong to the same league." },
        { status: 400 },
      );
    }

    const selectedLeagueId = selectedLeagueIds[0] ?? null;
    if (leagueId && selectedLeagueId && leagueId !== selectedLeagueId) {
      return NextResponse.json(
        { error: "Selected teams do not match the chosen league." },
        { status: 400 },
      );
    }
    if (!leagueId && selectedLeagueId) {
      leagueId = selectedLeagueId;
    }
  }

  if (!leagueId || !seasonId) {
    if (!leagueId) {
      let desiredLeagueName = `${sportProfile.name} League`;
      let desiredLeagueSlug = `league-${sportId}`;

      if (competitionType === "ad_hoc") {
        desiredLeagueName = `Ad Hoc ${sportProfile.name}`;
        desiredLeagueSlug = `ad-hoc-${sportId}`;
      } else if (competitionType === "league") {
        const base = payload.competitionName?.trim() || `${sportProfile.name} League`;
        desiredLeagueName = base;
        desiredLeagueSlug = `league-${slugify(base) || sportId}`;
      } else if (competitionType === "tournament") {
        const base = payload.competitionName?.trim() || `${sportProfile.name} Tournament`;
        desiredLeagueName = base;
        desiredLeagueSlug = `tournament-${slugify(base) || sportId}`;
      }

      const existingLeague = await client
        .from("leagues")
        .select("id")
        .eq("slug", desiredLeagueSlug)
        .maybeSingle();

      if (existingLeague.data) {
        leagueId = (existingLeague.data as { id: string }).id;
      } else {
        let organizationId: string | null = null;
        const organizationResult = await client
          .from("organizations")
          .select("id")
          .eq("slug", "portal-admin")
          .maybeSingle();

        if (organizationResult.data) {
          organizationId = (organizationResult.data as { id: string }).id;
        } else {
          const createdOrg = await (
            client.from("organizations") as unknown as {
              insert: (
                value: Record<string, unknown>,
              ) => {
                select: (columns: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> };
              };
            }
          )
            .insert({
              name: "Portal Admin Organization",
              slug: "portal-admin",
            })
            .select("id")
            .single();

          if (createdOrg.error || !createdOrg.data) {
            return NextResponse.json(
              { error: createdOrg.error?.message ?? "Could not create admin organization." },
              { status: 400 },
            );
          }
          organizationId = createdOrg.data.id;
        }

        const createdLeague = await (
          client.from("leagues") as unknown as {
            insert: (
              value: Record<string, unknown>,
            ) => {
              select: (columns: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> };
            };
          }
        )
          .insert({
            organization_id: organizationId,
            sport_id: sportId,
            name: desiredLeagueName,
            slug: desiredLeagueSlug,
            is_public: true,
            settings: {
              competition_type: competitionType,
            },
          })
          .select("id")
          .single();

        if (createdLeague.error || !createdLeague.data) {
          return NextResponse.json(
            { error: createdLeague.error?.message ?? "Could not create league context for game." },
            { status: 400 },
          );
        }
        leagueId = createdLeague.data.id;
      }
    }

    const seasonName =
      competitionType === "tournament"
        ? payload.competitionName?.trim() || `${sportProfile.name} Tournament`
        : competitionType === "league"
          ? `${new Date().getFullYear()} ${payload.competitionName?.trim() || "Season"}`
          : `${new Date().getFullYear()} Active`;

    const existingSeason = await client
      .from("seasons")
      .select("id")
      .eq("league_id", leagueId)
      .eq("name", seasonName)
      .maybeSingle();

    if (existingSeason.data) {
      seasonId = (existingSeason.data as { id: string }).id;
    } else {
      const createdSeason = await (
        client.from("seasons") as unknown as {
          insert: (
            value: Record<string, unknown>,
          ) => {
            select: (columns: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> };
          };
        }
      )
        .insert({
          league_id: leagueId,
          name: seasonName,
          is_active: true,
          starts_on: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (createdSeason.error || !createdSeason.data) {
        return NextResponse.json(
          { error: createdSeason.error?.message ?? "Could not create season context for game." },
          { status: 400 },
        );
      }
      seasonId = createdSeason.data.id;
    }
  }

  if (!leagueId || !seasonId) {
    return NextResponse.json(
      { error: "League and season context could not be resolved." },
      { status: 400 },
    );
  }

  const resolveTeam = async ({
    selectedTeamId,
    teamName,
  }: {
    selectedTeamId: string | null;
    teamName: string;
  }) => {
    if (selectedTeamId) {
      const selected = selectedTeamsById.get(selectedTeamId);
      if (!selected) {
        throw new Error("Selected team could not be resolved.");
      }
      return selected.id;
    }

    const normalizedTeamName = teamName.trim();
    if (!normalizedTeamName) {
      throw new Error("Team name is required when no team is selected.");
    }

    const teamSlug = slugify(normalizedTeamName);
    const existing = await client
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId)
      .eq("slug", teamSlug)
      .maybeSingle();

    if (existing.data) {
      return (existing.data as { id: string; name: string }).id;
    }

    const created = await (
      client.from("teams") as unknown as {
        insert: (
          value: Record<string, unknown>,
        ) => {
          select: (columns: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> };
        };
      }
    )
      .insert({
        league_id: leagueId,
        name: normalizedTeamName,
        slug: teamSlug || `team-${Date.now()}`,
      })
      .select("id")
      .single();

    if (created.error || !created.data) {
      throw new Error(created.error?.message ?? `Could not create team ${normalizedTeamName}.`);
    }
    return created.data.id;
  };

  let homeTeamId: string;
  let awayTeamId: string;
  const homeFallbackName = selectedTeamsById.get(homeTeamIdInput ?? "")?.name ?? "";
  const awayFallbackName = selectedTeamsById.get(awayTeamIdInput ?? "")?.name ?? "";
  try {
    homeTeamId = await resolveTeam({
      selectedTeamId: homeTeamIdInput,
      teamName: homeTeamNameInput || homeFallbackName,
    });
    awayTeamId = await resolveTeam({
      selectedTeamId: awayTeamIdInput,
      teamName: awayTeamNameInput || awayFallbackName,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  if (homeTeamId === awayTeamId) {
    return NextResponse.json({ error: "Home and away must be different teams." }, { status: 400 });
  }

  const metadata = buildDefaultGameMetadata(
    sportId,
    competitionType,
    payload.trackedTeamMetrics,
    payload.trackedPlayerMetrics,
    [
      ...(payload.trackHomePlayerStats === false ? [] : ["home" as const]),
      ...(payload.trackAwayPlayerStats === false ? [] : ["away" as const]),
    ],
    payload.scorepadFields,
  );

  const scheduledAt = payload.startNow
    ? new Date().toISOString()
    : payload.scheduledAt && !Number.isNaN(new Date(payload.scheduledAt).getTime())
      ? new Date(payload.scheduledAt).toISOString()
      : new Date().toISOString();

  const status = payload.startNow ? "live" : "scheduled";

  const createdGame = await (
    client.from("games") as unknown as {
      insert: (
        value: Record<string, unknown>,
      ) => {
        select: (columns: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .insert({
      league_id: leagueId,
      season_id: seasonId,
      sport_id: sportId,
      scheduled_at: scheduledAt,
      status,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      period_label: sportProfile.defaultPeriodLabel,
      metadata,
      is_public: true,
      home_score: 0,
      away_score: 0,
    })
    .select("id")
    .single();

  if (createdGame.error || !createdGame.data) {
    return NextResponse.json(
      { error: createdGame.error?.message ?? "Could not create game." },
      { status: 400 },
    );
  }

  const upsertRosterPlayers = async (teamId: string, rawPlayers: string[] | undefined) => {
    const players = (rawPlayers ?? []).map((value) => value.trim()).filter(Boolean);
    if (players.length === 0) {
      return;
    }

    const existingRosterResult = await client
      .from("team_rosters")
      .select("player_id")
      .eq("season_id", seasonId)
      .eq("team_id", teamId);

    const existingRosterRows = (existingRosterResult.data ?? []) as Array<{ player_id: string }>;
    const existingPlayerIds = existingRosterRows.map((row) => row.player_id);
    const existingPlayerIdByName = new Map<string, string>();

    if (existingPlayerIds.length > 0) {
      const existingPlayersResult = await client
        .from("players")
        .select("id, first_name, last_name")
        .in("id", existingPlayerIds);

      const existingPlayers = (existingPlayersResult.data ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string;
      }>;

      for (const player of existingPlayers) {
        existingPlayerIdByName.set(
          playerNameKey(player.first_name, player.last_name),
          player.id,
        );
      }
    }

    for (const fullName of players) {
      const { firstName, lastName } = splitPlayerName(fullName);
      const nameKey = playerNameKey(firstName, lastName);

      let playerId = existingPlayerIdByName.get(nameKey) ?? null;
      if (!playerId) {
        const playerInsert = await (
          client.from("players") as unknown as {
            insert: (
              value: Record<string, unknown>,
            ) => {
              select: (columns: string) => {
                single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
              };
            };
          }
        )
          .insert({
            first_name: firstName,
            last_name: lastName,
          })
          .select("id")
          .single();

        if (playerInsert.error || !playerInsert.data) {
          continue;
        }
        playerId = playerInsert.data.id;
        existingPlayerIdByName.set(nameKey, playerId);
      }

      await (
        client.from("team_rosters") as unknown as {
          upsert: (
            value: Record<string, unknown>,
            options: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).upsert(
        {
          season_id: seasonId,
          team_id: teamId,
          player_id: playerId,
          is_active: true,
        },
        {
          onConflict: "season_id,team_id,player_id",
        },
      );
    }
  };

  await upsertRosterPlayers(homeTeamId, payload.homePlayers);
  await upsertRosterPlayers(awayTeamId, payload.awayPlayers);

  await writeAdminAuditLog({
    action: "games.create",
    actor: toAdminActor(access.role),
    role: access.role,
    targetTable: "games",
    targetId: createdGame.data.id,
    summary: `Created ${competitionType} game ${createdGame.data.id}.`,
    details: {
      leagueId,
      seasonId,
      sportId,
      homeTeamId,
      awayTeamId,
      status,
    },
  });

  return NextResponse.json({
    gameId: createdGame.data.id,
    leagueId,
    seasonId,
    sportId,
    competitionType,
    scorekeeperUrl: `/admin/games/${createdGame.data.id}/scorekeeper`,
    scoresheetUrl: `/admin/games/${createdGame.data.id}/scoresheet`,
    publicLiveUrl: `/games/${createdGame.data.id}/live`,
    publicStatsUrl: `/games/${createdGame.data.id}/stats`,
  });
}
