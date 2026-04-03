import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { requireAdminRole, toAdminActor } from "@/lib/admin-request";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";

interface CreateTeamPayload {
  leagueId?: string;
  name?: string;
  slug?: string;
  city?: string;
  websiteUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeColor(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    throw new Error(`Invalid color "${normalized}". Use hex like #0ea5e9.`);
  }
  return normalized.toLowerCase();
}

function normalizeUrl(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Website URL must use http or https.");
    }
    return parsed.toString();
  } catch {
    throw new Error(`Invalid website URL "${normalized}".`);
  }
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

  const payload = (await request.json()) as CreateTeamPayload;
  const leagueId = normalizeText(payload.leagueId);
  const name = normalizeText(payload.name);
  const slug = slugify(payload.slug ?? payload.name ?? "");

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Team name is required." }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "Could not derive a valid team slug." }, { status: 400 });
  }

  let primaryColor: string | null;
  let secondaryColor: string | null;
  let websiteUrl: string | null;
  try {
    primaryColor = normalizeColor(payload.primaryColor);
    secondaryColor = normalizeColor(payload.secondaryColor);
    websiteUrl = normalizeUrl(payload.websiteUrl);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Could not create Supabase client." }, { status: 500 });
  }

  const leagueResult = await client.from("leagues").select("id, name").eq("id", leagueId).maybeSingle();
  if (leagueResult.error || !leagueResult.data) {
    return NextResponse.json({ error: "Selected league was not found." }, { status: 400 });
  }

  const existingResult = await client
    .from("teams")
    .select("id, name, slug")
    .eq("league_id", leagueId)
    .eq("slug", slug)
    .maybeSingle();

  if (existingResult.error) {
    return NextResponse.json({ error: existingResult.error.message }, { status: 400 });
  }

  if (existingResult.data) {
    const updated = await (
      client.from("teams") as unknown as {
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update({
        name,
        city: normalizeText(payload.city),
        website_url: websiteUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      })
      .eq("id", (existingResult.data as { id: string }).id);

    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }

    await writeAdminAuditLog({
      action: "teams.update",
      actor: toAdminActor(access.role),
      role: access.role,
      targetTable: "teams",
      targetId: (existingResult.data as { id: string }).id,
      summary: `Updated team ${name}.`,
      details: {
        leagueId,
        slug,
      },
    });

    return NextResponse.json({
      ok: true,
      operation: "updated",
      teamId: (existingResult.data as { id: string }).id,
      message: `Updated existing team "${name}" in ${(leagueResult.data as { name: string }).name}.`,
    });
  }

  const inserted = await (
    client.from("teams") as unknown as {
      insert: (value: Record<string, unknown>) => {
        select: (columns: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .insert({
      league_id: leagueId,
      name,
      slug,
      city: normalizeText(payload.city),
      website_url: websiteUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    return NextResponse.json(
      { error: inserted.error?.message ?? "Could not create team." },
      { status: 400 },
    );
  }

  await writeAdminAuditLog({
    action: "teams.create",
    actor: toAdminActor(access.role),
    role: access.role,
    targetTable: "teams",
    targetId: inserted.data.id,
    summary: `Created team ${name}.`,
    details: {
      leagueId,
      slug,
    },
  });

  return NextResponse.json({
    ok: true,
    operation: "created",
    teamId: inserted.data.id,
    message: `Created team "${name}" in ${(leagueResult.data as { name: string }).name}.`,
  });
}
