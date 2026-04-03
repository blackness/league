"use client";

import { useMemo, useState } from "react";

interface DryRunResult {
  mode: "connected" | "demo";
  requiredHeaders: string[];
  foundHeaders: string[];
  summary: {
    rowCount: number;
    validRows: number;
    totalErrors: number;
    totalWarnings: number;
    duplicatePlayerRows: number;
  };
  rows: Array<{
    rowNumber: number;
    teamSlug: string;
    seasonName: string;
    firstName: string;
    lastName: string;
    jerseyNumber: string;
    position: string;
    errors: string[];
    warnings: string[];
    resolved: {
      teamId: string | null;
      teamName: string | null;
      seasonId: string | null;
      seasonName: string | null;
    };
  }>;
}

const EXAMPLE_CSV = `team_slug,season_name,first_name,last_name,jersey_number,position
harbor-wolves,2026 Spring,Maya,Torres,9,FWD
harbor-wolves,2026 Spring,Ari,Brooks,11,C
northside-blades,2026 Spring,Jordan,Wong,7,D`;

export function RosterImportConsole() {
  const [csvText, setCsvText] = useState(EXAMPLE_CSV);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const statusLabel = useMemo(() => {
    if (!result) {
      return "No dry run yet";
    }
    return result.mode === "connected" ? "Connected validation" : "Demo validation";
  }, [result]);

  async function onRunDryRun() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/import/roster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvText,
        }),
      });

      const json = (await response.json()) as DryRunResult | { error: string };
      if (!response.ok) {
        setError((json as { error?: string }).error ?? "Dry run failed.");
        return;
      }

      setResult(json as DryRunResult);
    } catch {
      setError("Request failed. Check your dev server and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function onLoadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Roster CSV Dry Run</h2>
        <p className="mt-1 text-sm text-slate-600">
          Validate rows, detect duplicates, and resolve `team_slug` + `season_name` before import.
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
                  onLoadFile(file);
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setCsvText(EXAMPLE_CSV)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Load Example
          </button>
          <button
            type="button"
            onClick={onRunDryRun}
            disabled={isLoading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {isLoading ? "Running..." : "Run Dry Run"}
          </button>
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-800">CSV Content</span>
          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            className="mt-2 min-h-56 w-full rounded-md border border-slate-300 p-3 font-mono text-xs"
          />
        </label>
      </article>

      {(error || result) && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Dry Run Results</h3>
          <p className="mt-1 text-sm text-slate-600">{statusLabel}</p>

          {error && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          {result && (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                <div className="rounded-md bg-slate-50 p-3 text-sm">
                  <p className="text-xs uppercase text-slate-500">Rows</p>
                  <p className="text-xl font-bold text-slate-900">{result.summary.rowCount}</p>
                </div>
                <div className="rounded-md bg-emerald-50 p-3 text-sm">
                  <p className="text-xs uppercase text-emerald-700">Valid</p>
                  <p className="text-xl font-bold text-emerald-900">{result.summary.validRows}</p>
                </div>
                <div className="rounded-md bg-rose-50 p-3 text-sm">
                  <p className="text-xs uppercase text-rose-700">Errors</p>
                  <p className="text-xl font-bold text-rose-900">{result.summary.totalErrors}</p>
                </div>
                <div className="rounded-md bg-amber-50 p-3 text-sm">
                  <p className="text-xs uppercase text-amber-700">Warnings</p>
                  <p className="text-xl font-bold text-amber-900">{result.summary.totalWarnings}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3 text-sm">
                  <p className="text-xs uppercase text-slate-500">Duplicates</p>
                  <p className="text-xl font-bold text-slate-900">
                    {result.summary.duplicatePlayerRows}
                  </p>
                </div>
              </div>

              <div className="mt-4 max-h-96 overflow-auto rounded-md border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2">Team / Season</th>
                      <th className="px-3 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => {
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
                            <p className="font-medium text-slate-900">
                              {row.firstName} {row.lastName}
                            </p>
                            <p className="text-xs text-slate-600">
                              #{row.jerseyNumber || "N/A"} - {row.position || "No position"}
                            </p>
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-slate-900">{row.teamSlug}</p>
                            <p className="text-xs text-slate-600">{row.seasonName}</p>
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
                              <p
                                key={`w-${row.rowNumber}-${issue}`}
                                className="text-xs text-amber-700"
                              >
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
            </>
          )}
        </article>
      )}
    </section>
  );
}
