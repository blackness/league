import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

const REQUIRED_HEADERS = [
  "league_slug",
  "name",
  "slug",
  "city",
  "website_url",
  "primary_color",
  "secondary_color",
] as const;

type ImportMode = "dry_run" | "commit";

interface TeamImportPayload {
  mode?: ImportMode;
  csvText?: string;
}

interface LeagueLookup {
  id: string;
  slug: string;
  name: string;
}

interface TeamLookup {
  id: string;
  league_id: string;
  slug: string;
  name: string;
}

interface RowValidation {
  rowNumber: number;
  leagueSlug: string;
  name: string;
  slug: string;
  city: string;
  websiteUrl: string;
  primaryColor: string;
  secondaryColor: string;
  errors: string[];
  warnings: string[];
  resolved: {
    leagueId: string | null;
    leagueName: string | null;
    existingTeamId: string | null;
    existingTeamName: string | null;
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateWebsite(value: string): { normalized: string | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { normalized: null, error: null };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { normalized: null, error: "website_url must use http:// or https://." };
    }
    return { normalized: parsed.toString(), error: null };
  } catch {
    return { normalized: null, error: "website_url is not a valid URL." };
  }
}

function validateColor(value: string): { normalized: string | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { normalized: null, error: null };
  }

  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return { normalized: null, error: `Invalid hex color "${trimmed}".` };
  }

  return { normalized: trimmed.toLowerCase(), error: null };
}

function summarize(rows: RowValidation[]) {
  const totalErrors = rows.reduce((sum, row) => sum + row.errors.length, 0);
  const totalWarnings = rows.reduce((sum, row) => sum + row.warnings.length, 0);
  const validRows = rows.filter((row) => row.errors.length === 0).length;
  return {
    rowCount: rows.length,
    validRows,
    totalErrors,
    totalWarnings,
  };
}

export async function POST(request: Request) {
  const payload = (await request.json()) as TeamImportPayload;
  const mode: ImportMode = payload.mode === "commit" ? "commit" : "dry_run";
  const csvText = payload.csvText ?? "";

  if (!csvText.trim()) {
    return NextResponse.json(
      { error: "CSV text is empty. Paste a Teams CSV before importing." },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase environment is not configured." },
      { status: 400 },
    );
  }
  if (mode === "commit" && !isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Team import write routes require SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and your Vercel project environment variables.",
      },
      { status: 500 },
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

  const readClient = createSupabaseAdminClient() ?? createSupabaseServerClient();
  if (!readClient) {
    return NextResponse.json({ error: "Could not create Supabase client." }, { status: 500 });
  }

  const inputLeagueSlugs = Array.from(
    new Set(
      parsed.rows
        .map((row) => normalize(row.league_slug ?? ""))
        .filter((value) => value.length > 0),
    ),
  );

  const leaguesBySlug = new Map<string, LeagueLookup>();
  if (inputLeagueSlugs.length > 0) {
    const leaguesResult = await readClient
      .from("leagues")
      .select("id, slug, name")
      .in("slug", inputLeagueSlugs);

    if (leaguesResult.error) {
      return NextResponse.json({ error: leaguesResult.error.message }, { status: 400 });
    }

    for (const league of (leaguesResult.data ?? []) as LeagueLookup[]) {
      leaguesBySlug.set(normalize(league.slug), league);
    }
  }

  const leagueIds = Array.from(new Set(Array.from(leaguesBySlug.values()).map((league) => league.id)));
  const existingTeamsByLeagueSlug = new Map<string, TeamLookup>();
  if (leagueIds.length > 0) {
    const teamsResult = await readClient
      .from("teams")
      .select("id, league_id, slug, name")
      .in("league_id", leagueIds);

    if (teamsResult.error) {
      return NextResponse.json({ error: teamsResult.error.message }, { status: 400 });
    }

    for (const team of (teamsResult.data ?? []) as TeamLookup[]) {
      existingTeamsByLeagueSlug.set(`${team.league_id}|${normalize(team.slug)}`, team);
    }
  }

  const seenKeys = new Set<string>();
  const rows: RowValidation[] = parsed.rows.map((row, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const leagueSlugRaw = row.league_slug ?? "";
    const nameRaw = row.name ?? "";
    const slugRaw = row.slug ?? "";
    const cityRaw = row.city ?? "";
    const websiteUrlRaw = row.website_url ?? "";
    const primaryColorRaw = row.primary_color ?? "";
    const secondaryColorRaw = row.secondary_color ?? "";

    const leagueSlug = normalize(leagueSlugRaw);
    const name = nameRaw.trim();
    const slug = slugify(slugRaw || nameRaw);

    if (!leagueSlug) {
      errors.push("league_slug is required.");
    }
    if (!name) {
      errors.push("name is required.");
    }
    if (!slug) {
      errors.push("slug is empty after normalization.");
    }

    const websiteValidation = validateWebsite(websiteUrlRaw);
    if (websiteValidation.error) {
      errors.push(websiteValidation.error);
    }

    const primaryColorValidation = validateColor(primaryColorRaw);
    if (primaryColorValidation.error) {
      errors.push(primaryColorValidation.error);
    }
    const secondaryColorValidation = validateColor(secondaryColorRaw);
    if (secondaryColorValidation.error) {
      errors.push(secondaryColorValidation.error);
    }

    let leagueId: string | null = null;
    let leagueName: string | null = null;
    if (leagueSlug) {
      const league = leaguesBySlug.get(leagueSlug);
      if (!league) {
        errors.push(`League slug "${leagueSlugRaw}" was not found.`);
      } else {
        leagueId = league.id;
        leagueName = league.name;
      }
    }

    let existingTeamId: string | null = null;
    let existingTeamName: string | null = null;
    if (leagueId && slug) {
      const existing = existingTeamsByLeagueSlug.get(`${leagueId}|${normalize(slug)}`) ?? null;
      if (existing) {
        existingTeamId = existing.id;
        existingTeamName = existing.name;
        warnings.push(`Will update existing team "${existing.name}" with same slug.`);
      }
    }

    const dedupeKey = `${leagueSlug}|${slug}`;
    if (seenKeys.has(dedupeKey)) {
      errors.push("Duplicate league_slug + slug combination in this CSV.");
    } else {
      seenKeys.add(dedupeKey);
    }

    return {
      rowNumber,
      leagueSlug: leagueSlugRaw,
      name: nameRaw,
      slug,
      city: cityRaw,
      websiteUrl: websiteUrlRaw,
      primaryColor: primaryColorRaw,
      secondaryColor: secondaryColorRaw,
      errors,
      warnings,
      resolved: {
        leagueId,
        leagueName,
        existingTeamId,
        existingTeamName,
      },
    };
  });

  const summary = summarize(rows);
  if (mode === "dry_run") {
    return NextResponse.json({
      mode,
      requiredHeaders: REQUIRED_HEADERS,
      foundHeaders: parsed.headers,
      summary,
      rows: rows.slice(0, 1000),
    });
  }

  if (summary.totalErrors > 0) {
    return NextResponse.json(
      {
        error: "Fix CSV errors before committing import.",
        mode,
        requiredHeaders: REQUIRED_HEADERS,
        foundHeaders: parsed.headers,
        summary,
        rows: rows.slice(0, 1000),
      },
      { status: 400 },
    );
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Could not create admin Supabase client." }, { status: 500 });
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const leagueId = row.resolved.leagueId;
    if (!leagueId) {
      continue;
    }

    const websiteValidation = validateWebsite(row.websiteUrl);
    const primaryColorValidation = validateColor(row.primaryColor);
    const secondaryColorValidation = validateColor(row.secondaryColor);

    const writeValues = {
      league_id: leagueId,
      name: row.name.trim(),
      slug: row.slug,
      city: normalizeNullableText(row.city),
      website_url: websiteValidation.normalized,
      primary_color: primaryColorValidation.normalized,
      secondary_color: secondaryColorValidation.normalized,
    };

    const existing = existingTeamsByLeagueSlug.get(`${leagueId}|${normalize(row.slug)}`) ?? null;
    if (existing) {
      const updateResult = await (
        adminClient.from("teams") as unknown as {
          update: (value: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .update({
          name: writeValues.name,
          city: writeValues.city,
          website_url: writeValues.website_url,
          primary_color: writeValues.primary_color,
          secondary_color: writeValues.secondary_color,
        })
        .eq("id", existing.id);

      if (updateResult.error) {
        return NextResponse.json(
          { error: `Row ${row.rowNumber}: ${updateResult.error.message}` },
          { status: 400 },
        );
      }
      updatedCount += 1;
      continue;
    }

    const insertResult = await (
      adminClient.from("teams") as unknown as {
        insert: (value: Record<string, unknown>) => {
          select: (columns: string) => {
            single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
          };
        };
      }
    )
      .insert(writeValues)
      .select("id")
      .single();

    if (insertResult.error || !insertResult.data) {
      return NextResponse.json(
        { error: `Row ${row.rowNumber}: ${insertResult.error?.message ?? "Could not insert team."}` },
        { status: 400 },
      );
    }

    existingTeamsByLeagueSlug.set(`${leagueId}|${normalize(row.slug)}`, {
      id: insertResult.data.id,
      league_id: leagueId,
      slug: row.slug,
      name: writeValues.name,
    });
    insertedCount += 1;
  }

  return NextResponse.json({
    mode,
    requiredHeaders: REQUIRED_HEADERS,
    foundHeaders: parsed.headers,
    summary,
    rows: rows.slice(0, 1000),
    writeSummary: {
      insertedCount,
      updatedCount,
      message: `Imported teams successfully: ${insertedCount} created, ${updatedCount} updated.`,
    },
  });
}

