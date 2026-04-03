"use client";

import { useMemo, useState } from "react";
import type { ScheduleBuilderData } from "@/lib/portal-types";

interface TeamManagerConsoleProps {
  scheduleData: ScheduleBuilderData;
}

interface TeamCreateResponse {
  ok: boolean;
  operation: "created" | "updated";
  teamId: string;
  message: string;
}

interface TeamImportResult {
  mode: "dry_run" | "commit";
  requiredHeaders: string[];
  foundHeaders: string[];
  summary: {
    rowCount: number;
    validRows: number;
    totalErrors: number;
    totalWarnings: number;
  };
  rows: Array<{
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
  }>;
  writeSummary?: {
    insertedCount: number;
    updatedCount: number;
    message: string;
  };
}

const TEAM_IMPORT_EXAMPLE = `league_slug,name,slug,city,website_url,primary_color,secondary_color
metro-hockey-league,Harbor Wolves,harbor-wolves,Harbor City,https://harborwolves.example,#0f172a,#06b6d4
metro-hockey-league,Northside Blades,northside-blades,Northside,https://northsideblades.example,#1f2937,#38bdf8
city-hoops-premier,Midtown Comets,midtown-comets,Midtown,https://midtowncomets.example,#111827,#f97316`;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function TeamManagerConsole({ scheduleData }: TeamManagerConsoleProps) {
  const [selectedLeagueId, setSelectedLeagueId] = useState(scheduleData.leagues[0]?.leagueId ?? "");
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [city, setCity] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [teamCreateMessage, setTeamCreateMessage] = useState<string | null>(null);
  const [teamCreateError, setTeamCreateError] = useState<string | null>(null);

  const [teamsCsvText, setTeamsCsvText] = useState(TEAM_IMPORT_EXAMPLE);
  const [isRunningDryRun, setIsRunningDryRun] = useState(false);
  const [isCommittingImport, setIsCommittingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<TeamImportResult | null>(null);

  const selectedLeague = useMemo(
    () => scheduleData.leagues.find((league) => league.leagueId === selectedLeagueId) ?? null,
    [scheduleData.leagues, selectedLeagueId],
  );

  const derivedSlug = useMemo(() => slugify(teamName), [teamName]);

  async function onCreateTeam() {
    setTeamCreateError(null);
    setTeamCreateMessage(null);

    if (!selectedLeagueId) {
      setTeamCreateError("Select a league before creating a team.");
      return;
    }
    if (!teamName.trim()) {
      setTeamCreateError("Team name is required.");
      return;
    }

    setIsCreatingTeam(true);
    try {
      const response = await fetch("/api/admin/teams/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          name: teamName.trim(),
          slug: teamSlug.trim() || undefined,
          city: city.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          primaryColor: primaryColor.trim() || undefined,
          secondaryColor: secondaryColor.trim() || undefined,
        }),
      });

      const body = (await response.json()) as TeamCreateResponse | { error?: string };
      if (!response.ok) {
        setTeamCreateError((body as { error?: string }).error ?? "Team create failed.");
        return;
      }

      setTeamCreateMessage((body as TeamCreateResponse).message);
      setTeamName("");
      setTeamSlug("");
      setCity("");
      setWebsiteUrl("");
      setPrimaryColor("");
      setSecondaryColor("");
    } catch {
      setTeamCreateError("Request failed while creating team.");
    } finally {
      setIsCreatingTeam(false);
    }
  }

  async function runImport(mode: "dry_run" | "commit") {
    setImportError(null);
    setImportResult(null);

    if (!teamsCsvText.trim()) {
      setImportError("Paste Teams CSV content first.");
      return;
    }

    if (mode === "dry_run") {
      setIsRunningDryRun(true);
    } else {
      setIsCommittingImport(true);
    }

    try {
      const response = await fetch("/api/admin/import/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          csvText: teamsCsvText,
        }),
      });

      const body = (await response.json()) as TeamImportResult | { error?: string };
      if (!response.ok) {
        setImportError((body as { error?: string }).error ?? "Team import failed.");
        if ((body as TeamImportResult).summary) {
          setImportResult(body as TeamImportResult);
        }
        return;
      }

      setImportResult(body as TeamImportResult);
    } catch {
      setImportError("Request failed while importing teams.");
    } finally {
      setIsRunningDryRun(false);
      setIsCommittingImport(false);
    }
  }

  function onLoadCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setTeamsCsvText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Create Team</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add one team at a time, or update an existing team by reusing the same slug.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-800">League</span>
            <select
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {scheduleData.leagues.length === 0 && <option value="">No leagues available</option>}
              {scheduleData.leagues.map((league) => (
                <option key={league.leagueId} value={league.leagueId}>
                  {league.leagueName} - {league.seasonName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Team Name</span>
            <input
              type="text"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Harbor Wolves"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Team Slug (optional)</span>
            <input
              type="text"
              value={teamSlug}
              onChange={(event) => setTeamSlug(event.target.value)}
              placeholder={derivedSlug || "harbor-wolves"}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">City (optional)</span>
            <input
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Harbor City"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Website URL (optional)</span>
            <input
              type="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com/team"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Primary Color (optional)</span>
            <input
              type="text"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              placeholder="#0f172a"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Secondary Color (optional)</span>
            <input
              type="text"
              value={secondaryColor}
              onChange={(event) => setSecondaryColor(event.target.value)}
              placeholder="#06b6d4"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCreateTeam}
            disabled={isCreatingTeam}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {isCreatingTeam ? "Saving..." : "Create / Update Team"}
          </button>
          {selectedLeague && (
            <p className="text-sm text-slate-600">
              Current league team count:{" "}
              <span className="font-semibold text-slate-900">{selectedLeague.teams.length}</span>
            </p>
          )}
        </div>

        {teamCreateError && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {teamCreateError}
          </p>
        )}
        {teamCreateMessage && (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {teamCreateMessage}
          </p>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Teams CSV Import</h2>
        <p className="mt-1 text-sm text-slate-600">
          Run a dry run first, then commit to insert or update teams in bulk.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Required headers:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            league_slug,name,slug,city,website_url,primary_color,secondary_color
          </code>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onLoadCsvFile(file);
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setTeamsCsvText(TEAM_IMPORT_EXAMPLE)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Load Example
          </button>
          <button
            type="button"
            onClick={() => runImport("dry_run")}
            disabled={isRunningDryRun || isCommittingImport}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {isRunningDryRun ? "Validating..." : "Run Dry Run"}
          </button>
          <button
            type="button"
            onClick={() => runImport("commit")}
            disabled={isRunningDryRun || isCommittingImport}
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
          >
            {isCommittingImport ? "Importing..." : "Commit Import"}
          </button>
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-800">Teams CSV Content</span>
          <textarea
            value={teamsCsvText}
            onChange={(event) => setTeamsCsvText(event.target.value)}
            className="mt-2 min-h-56 w-full rounded-md border border-slate-300 p-3 font-mono text-xs"
          />
        </label>

        {importError && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {importError}
          </p>
        )}

        {importResult && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <p className="text-xs uppercase text-slate-500">Rows</p>
                <p className="text-xl font-bold text-slate-900">{importResult.summary.rowCount}</p>
              </div>
              <div className="rounded-md bg-emerald-50 p-3 text-sm">
                <p className="text-xs uppercase text-emerald-700">Valid</p>
                <p className="text-xl font-bold text-emerald-900">{importResult.summary.validRows}</p>
              </div>
              <div className="rounded-md bg-rose-50 p-3 text-sm">
                <p className="text-xs uppercase text-rose-700">Errors</p>
                <p className="text-xl font-bold text-rose-900">{importResult.summary.totalErrors}</p>
              </div>
              <div className="rounded-md bg-amber-50 p-3 text-sm">
                <p className="text-xs uppercase text-amber-700">Warnings</p>
                <p className="text-xl font-bold text-amber-900">{importResult.summary.totalWarnings}</p>
              </div>
            </div>

            {importResult.writeSummary && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                {importResult.writeSummary.message}
              </p>
            )}

            <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">League</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.rows.map((row) => {
                    const issueCount = row.errors.length + row.warnings.length;
                    const statusColor =
                      row.errors.length > 0
                        ? "text-rose-700"
                        : row.warnings.length > 0
                          ? "text-amber-700"
                          : "text-emerald-700";
                    return (
                      <tr key={row.rowNumber} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{row.leagueSlug}</p>
                          <p className="text-xs text-slate-600">{row.resolved.leagueName ?? "Unresolved"}</p>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{row.name || "Missing name"}</p>
                          <p className="text-xs text-slate-600">slug: {row.slug || "n/a"}</p>
                        </td>
                        <td className="px-3 py-2">
                          <p className={`font-medium ${statusColor}`}>
                            {issueCount === 0 ? "Ready" : `${issueCount} issue(s)`}
                          </p>
                          {row.errors.map((issue) => (
                            <p key={`e-${row.rowNumber}-${issue}`} className="text-xs text-rose-700">
                              Error: {issue}
                            </p>
                          ))}
                          {row.warnings.map((issue) => (
                            <p key={`w-${row.rowNumber}-${issue}`} className="text-xs text-amber-700">
                              Warning: {issue}
                            </p>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

