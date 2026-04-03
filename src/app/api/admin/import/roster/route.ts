import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminRole, toAdminActor } from "@/lib/admin-request";
import { parseCsv } from "@/lib/csv";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";

const REQUIRED_HEADERS = [
  "team_slug",
  "season_name",
  "first_name",
  "last_name",
  "jersey_number",
  "position",
] as const;

interface TeamLookup {
  id: string;
  slug: string;
  name: string;
  league_id: string;
}

interface SeasonLookup {
  id: string;
  name: string;
  league_id: string;
  is_active: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const access = requireAdminRole(request, "viewer");
  if (!access.ok) {
    return access.response as NextResponse;
  }

  const payload = (await request.json()) as { csvText?: string };
  const csvText = payload.csvText ?? "";

  if (!csvText.trim()) {
    return NextResponse.json(
      {
        error: "CSV text is empty. Paste a roster CSV before running dry run.",
      },
      { status: 400 },
    );
  }

  const parsed = parseCsv(csvText);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !parsed.headers.includes(header));

  if (missingHeaders.length > 0) {
    return NextResponse.json(
      {
        error: `Missing required header(s): ${missingHeaders.join(", ")}`,
        requiredHeaders: REQUIRED_HEADERS,
        foundHeaders: parsed.headers,
      },
      { status: 400 },
    );
  }

  const client = createSupabaseServerClient();
  const canResolveAgainstDatabase = Boolean(isSupabaseConfigured && client);

  const teamsBySlug = new Map<string, TeamLookup[]>();
  const seasonsByLeagueAndName = new Map<string, SeasonLookup>();

  if (canResolveAgainstDatabase && client) {
    const [teamsResult, seasonsResult] = await Promise.all([
      client.from("teams").select("id, slug, name, league_id"),
      client.from("seasons").select("id, name, league_id, is_active"),
    ]);

    for (const team of (teamsResult.data ?? []) as TeamLookup[]) {
      const key = normalize(team.slug);
      const existing = teamsBySlug.get(key) ?? [];
      existing.push(team);
      teamsBySlug.set(key, existing);
    }

    for (const season of (seasonsResult.data ?? []) as SeasonLookup[]) {
      seasonsByLeagueAndName.set(`${season.league_id}|${normalize(season.name)}`, season);
    }
  }

  const duplicateRows = new Set<string>();
  const seenRowKeys = new Set<string>();

  const rowResults = parsed.rows.map((row, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const teamSlug = row.team_slug ?? "";
    const seasonName = row.season_name ?? "";
    const firstName = row.first_name ?? "";
    const lastName = row.last_name ?? "";
    const jerseyNumber = row.jersey_number ?? "";
    const position = row.position ?? "";

    if (!teamSlug) {
      errors.push("team_slug is required");
    }
    if (!seasonName) {
      errors.push("season_name is required");
    }
    if (!firstName) {
      errors.push("first_name is required");
    }
    if (!lastName) {
      errors.push("last_name is required");
    }

    const dedupeKey = [
      normalize(teamSlug),
      normalize(seasonName),
      normalize(firstName),
      normalize(lastName),
      normalize(jerseyNumber),
    ].join("|");

    if (seenRowKeys.has(dedupeKey)) {
      duplicateRows.add(dedupeKey);
      errors.push("Duplicate player row in this CSV");
    } else {
      seenRowKeys.add(dedupeKey);
    }

    let resolvedTeam: TeamLookup | null = null;
    let resolvedSeason: SeasonLookup | null = null;

    if (canResolveAgainstDatabase) {
      const matches = teamsBySlug.get(normalize(teamSlug)) ?? [];
      if (matches.length === 0) {
        errors.push(`No team found for slug "${teamSlug}"`);
      } else if (matches.length > 1) {
        errors.push(
          `Team slug "${teamSlug}" exists in multiple leagues. Add a league column before import.`,
        );
      } else {
        resolvedTeam = matches[0];
        resolvedSeason =
          seasonsByLeagueAndName.get(`${resolvedTeam.league_id}|${normalize(seasonName)}`) ?? null;

        if (!resolvedSeason) {
          errors.push(
            `Season "${seasonName}" not found in ${resolvedTeam.name}'s league for this team_slug.`,
          );
        } else if (!resolvedSeason.is_active) {
          warnings.push(`Season "${seasonName}" is currently inactive.`);
        }
      }
    } else {
      warnings.push("Database lookup skipped. Configure Supabase env vars for team/season checks.");
    }

    if (jerseyNumber && !/^[a-zA-Z0-9-]+$/.test(jerseyNumber)) {
      warnings.push("jersey_number includes special characters.");
    }

    if (!position) {
      warnings.push("position is empty.");
    }

    return {
      rowNumber,
      teamSlug,
      seasonName,
      firstName,
      lastName,
      jerseyNumber,
      position,
      errors,
      warnings,
      resolved: {
        teamId: resolvedTeam?.id ?? null,
        teamName: resolvedTeam?.name ?? null,
        seasonId: resolvedSeason?.id ?? null,
        seasonName: resolvedSeason?.name ?? null,
      },
    };
  });

  const totalErrors = rowResults.reduce((sum, row) => sum + row.errors.length, 0);
  const totalWarnings = rowResults.reduce((sum, row) => sum + row.warnings.length, 0);
  const validRows = rowResults.filter((row) => row.errors.length === 0).length;

  await writeAdminAuditLog({
    action: "import.roster.dry_run",
    actor: toAdminActor(access.role),
    role: access.role,
    targetTable: "team_rosters",
    targetId: null,
    summary: "Executed roster dry-run validation.",
    details: {
      rowCount: rowResults.length,
      validRows,
      totalErrors,
      totalWarnings,
    },
  });

  return NextResponse.json({
    mode: canResolveAgainstDatabase ? "connected" : "demo",
    requiredHeaders: REQUIRED_HEADERS,
    foundHeaders: parsed.headers,
    summary: {
      rowCount: rowResults.length,
      validRows,
      totalErrors,
      totalWarnings,
      duplicatePlayerRows: duplicateRows.size,
    },
    rows: rowResults.slice(0, 1000),
  });
}
