"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BackfillMode = "dry_run" | "commit";
type BackfillTable = "game_team_stats" | "player_game_stats";

interface BackfillCursor {
  teamCursor: string | null;
  playerCursor: string | null;
}

interface BackfillBatchResult {
  mode: BackfillMode;
  batchSize: number;
  cursor: BackfillCursor;
  hasMore: boolean;
  scanned: {
    teamRows: number;
    playerRows: number;
    totalRows: number;
  };
  changed: {
    teamRows: number;
    playerRows: number;
    totalRows: number;
  };
  updated: {
    teamRows: number;
    playerRows: number;
    totalRows: number;
  };
  skippedMissingGame: number;
  samples: Array<{
    table: BackfillTable;
    rowId: string;
    gameId: string;
    sportId: string;
  }>;
  message: string;
}

interface BackfillRunSummary {
  mode: BackfillMode;
  batches: number;
  stoppedByUser: boolean;
  completed: boolean;
  scanned: {
    teamRows: number;
    playerRows: number;
    totalRows: number;
  };
  changed: {
    teamRows: number;
    playerRows: number;
    totalRows: number;
  };
  updated: {
    teamRows: number;
    playerRows: number;
    totalRows: number;
  };
  skippedMissingGame: number;
  startedAt: string;
  finishedAt: string | null;
}

const CHECKPOINT_STORAGE_KEY = "stats_backfill_checkpoint_v1";
const DEFAULT_CURSOR: BackfillCursor = {
  teamCursor: null,
  playerCursor: null,
};

function toRunSummarySkeleton(mode: BackfillMode): BackfillRunSummary {
  return {
    mode,
    batches: 0,
    stoppedByUser: false,
    completed: false,
    scanned: { teamRows: 0, playerRows: 0, totalRows: 0 },
    changed: { teamRows: 0, playerRows: 0, totalRows: 0 },
    updated: { teamRows: 0, playerRows: 0, totalRows: 0 },
    skippedMissingGame: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

function addBatchToSummary(summary: BackfillRunSummary, batch: BackfillBatchResult): BackfillRunSummary {
  return {
    ...summary,
    batches: summary.batches + 1,
    scanned: {
      teamRows: summary.scanned.teamRows + batch.scanned.teamRows,
      playerRows: summary.scanned.playerRows + batch.scanned.playerRows,
      totalRows: summary.scanned.totalRows + batch.scanned.totalRows,
    },
    changed: {
      teamRows: summary.changed.teamRows + batch.changed.teamRows,
      playerRows: summary.changed.playerRows + batch.changed.playerRows,
      totalRows: summary.changed.totalRows + batch.changed.totalRows,
    },
    updated: {
      teamRows: summary.updated.teamRows + batch.updated.teamRows,
      playerRows: summary.updated.playerRows + batch.updated.playerRows,
      totalRows: summary.updated.totalRows + batch.updated.totalRows,
    },
    skippedMissingGame: summary.skippedMissingGame + batch.skippedMissingGame,
  };
}

export function StatsBackfillConsole() {
  const [batchSizeInput, setBatchSizeInput] = useState("500");
  const [cursor, setCursor] = useState<BackfillCursor>(DEFAULT_CURSOR);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [isRunningFull, setIsRunningFull] = useState(false);
  const [lastBatch, setLastBatch] = useState<BackfillBatchResult | null>(null);
  const [runSummary, setRunSummary] = useState<BackfillRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopRequestedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<BackfillCursor>;
      setCursor({
        teamCursor: typeof parsed.teamCursor === "string" ? parsed.teamCursor : null,
        playerCursor: typeof parsed.playerCursor === "string" ? parsed.playerCursor : null,
      });
    } catch {
      // Ignore malformed checkpoint
    }
  }, []);

  function saveCheckpoint(nextCursor: BackfillCursor) {
    setCursor(nextCursor);
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(nextCursor));
  }

  function resetCheckpoint() {
    saveCheckpoint(DEFAULT_CURSOR);
    setLastBatch(null);
    setRunSummary(null);
    setError(null);
  }

  const parsedBatchSize = useMemo(
    () => Math.min(2000, Math.max(1, Math.floor(Number(batchSizeInput) || 500))),
    [batchSizeInput],
  );

  async function runSingleBatch(mode: BackfillMode, sourceCursor: BackfillCursor): Promise<BackfillBatchResult> {
    const response = await fetch("/api/admin/stats/backfill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode,
        batchSize: parsedBatchSize,
        cursor: sourceCursor,
      }),
    });

    const body = (await response.json()) as BackfillBatchResult | { error?: string };
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? "Backfill request failed.");
    }
    return body as BackfillBatchResult;
  }

  async function handleRunBatch(mode: BackfillMode) {
    setIsRunningBatch(true);
    setError(null);
    try {
      const batch = await runSingleBatch(mode, cursor);
      setLastBatch(batch);
      saveCheckpoint(batch.cursor);

      const summary = addBatchToSummary(toRunSummarySkeleton(mode), batch);
      setRunSummary({
        ...summary,
        completed: !batch.hasMore,
        finishedAt: new Date().toISOString(),
      });
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setIsRunningBatch(false);
    }
  }

  async function handleRunFull(mode: BackfillMode) {
    setIsRunningFull(true);
    stopRequestedRef.current = false;
    setError(null);
    setRunSummary(toRunSummarySkeleton(mode));
    setLastBatch(null);

    let activeCursor = cursor;
    let aggregate = toRunSummarySkeleton(mode);
    let endedNaturally = false;
    const hardBatchLimit = 10000;

    try {
      for (let batchIndex = 0; batchIndex < hardBatchLimit; batchIndex += 1) {
        if (stopRequestedRef.current) {
          break;
        }

        const batch = await runSingleBatch(mode, activeCursor);
        setLastBatch(batch);
        activeCursor = batch.cursor;
        saveCheckpoint(activeCursor);

        aggregate = addBatchToSummary(aggregate, batch);
        setRunSummary({
          ...aggregate,
          completed: !batch.hasMore,
          finishedAt: null,
        });

        if (!batch.hasMore) {
          endedNaturally = true;
          break;
        }
      }

      const completed = !stopRequestedRef.current && endedNaturally;
      setRunSummary((previous) => {
        const summary = previous ?? aggregate;
        return {
          ...summary,
          completed,
          stoppedByUser: stopRequestedRef.current,
          finishedAt: new Date().toISOString(),
        };
      });
    } catch (requestError) {
      setError((requestError as Error).message);
      setRunSummary((previous) => {
        const summary = previous ?? aggregate;
        return {
          ...summary,
          completed: false,
          stoppedByUser: stopRequestedRef.current,
          finishedAt: new Date().toISOString(),
        };
      });
    } finally {
      setIsRunningFull(false);
      stopRequestedRef.current = false;
    }
  }

  const isBusy = isRunningBatch || isRunningFull;

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Stats Canonical Backfill</h2>
        <p className="mt-1 text-sm text-slate-600">
          Converts legacy stat keys to canonical metric IDs in `game_team_stats` and `player_game_stats`.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Supports resumable checkpoints, full-run automation, and stop control.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Batch Size</span>
            <input
              type="number"
              min={1}
              max={2000}
              value={batchSizeInput}
              onChange={(event) => setBatchSizeInput(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700 md:col-span-2">
            <p className="font-semibold text-slate-900">Checkpoint</p>
            <p>Team cursor: {cursor.teamCursor ?? "start"}</p>
            <p>Player cursor: {cursor.playerCursor ?? "start"}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleRunBatch("dry_run")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Run One Dry Batch
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleRunBatch("commit")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Run One Commit Batch
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleRunFull("dry_run")}
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
          >
            Run Full Dry Run
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleRunFull("commit")}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Run Full Commit
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={resetCheckpoint}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Reset Checkpoint
          </button>
          {isRunningFull && (
            <button
              type="button"
              onClick={() => {
                stopRequestedRef.current = true;
              }}
              className="rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700"
            >
              Stop Runner
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </article>

      {runSummary && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Run Summary</h3>
          <p className="mt-1 text-sm text-slate-600">
            Mode: {runSummary.mode} | Batches: {runSummary.batches} |{" "}
            {runSummary.stoppedByUser
              ? "Stopped by user"
              : runSummary.completed
                ? "Completed"
                : "In progress"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="text-xs uppercase text-slate-500">Scanned</p>
              <p className="text-xl font-bold text-slate-900">{runSummary.scanned.totalRows}</p>
              <p className="text-xs text-slate-600">
                Team {runSummary.scanned.teamRows} / Player {runSummary.scanned.playerRows}
              </p>
            </div>
            <div className="rounded-md bg-amber-50 p-3 text-sm">
              <p className="text-xs uppercase text-amber-700">Changed</p>
              <p className="text-xl font-bold text-amber-900">{runSummary.changed.totalRows}</p>
              <p className="text-xs text-amber-800">
                Team {runSummary.changed.teamRows} / Player {runSummary.changed.playerRows}
              </p>
            </div>
            <div className="rounded-md bg-emerald-50 p-3 text-sm">
              <p className="text-xs uppercase text-emerald-700">Updated</p>
              <p className="text-xl font-bold text-emerald-900">{runSummary.updated.totalRows}</p>
              <p className="text-xs text-emerald-800">
                Team {runSummary.updated.teamRows} / Player {runSummary.updated.playerRows}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Skipped rows with missing games: {runSummary.skippedMissingGame}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Started: {new Date(runSummary.startedAt).toLocaleString()}
            {runSummary.finishedAt ? ` | Finished: ${new Date(runSummary.finishedAt).toLocaleString()}` : ""}
          </p>
        </article>
      )}

      {lastBatch && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Last Batch</h3>
          <p className="mt-1 text-sm text-slate-600">{lastBatch.message}</p>
          <p className="mt-1 text-xs text-slate-500">
            Has more: {lastBatch.hasMore ? "yes" : "no"} | Next team cursor:{" "}
            {lastBatch.cursor.teamCursor ?? "end"} | Next player cursor:{" "}
            {lastBatch.cursor.playerCursor ?? "end"}
          </p>

          {lastBatch.samples.length > 0 && (
            <div className="mt-4 max-h-80 overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Table</th>
                    <th className="px-3 py-2">Row ID</th>
                    <th className="px-3 py-2">Game ID</th>
                    <th className="px-3 py-2">Sport</th>
                  </tr>
                </thead>
                <tbody>
                  {lastBatch.samples.map((sample) => (
                    <tr key={`${sample.table}-${sample.rowId}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{sample.table}</td>
                      <td className="px-3 py-2 font-mono text-xs">{sample.rowId}</td>
                      <td className="px-3 py-2 font-mono text-xs">{sample.gameId}</td>
                      <td className="px-3 py-2">{sample.sportId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
