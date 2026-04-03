import { getSportProfileById, toMetricLabelMap } from "@/lib/sport-config";
import type { StatMetric } from "@/lib/portal-types";

export type MetricScope = "team" | "player";

const METRIC_ID_SEPARATOR = "::";

export function toMetricLabelFromKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeMetricKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function toMetricId(sportId: string, scope: MetricScope, metricKey: string): string {
  return `${sportId}${METRIC_ID_SEPARATOR}${scope}${METRIC_ID_SEPARATOR}${normalizeMetricKey(metricKey)}`;
}

interface ParsedMetricId {
  sportId: string;
  scope: MetricScope;
  metricKey: string;
}

export function parseMetricId(rawValue: string): ParsedMetricId | null {
  const parts = rawValue.split(METRIC_ID_SEPARATOR);
  if (parts.length < 3) {
    return null;
  }

  const sportId = parts[0]?.trim();
  const scopeRaw = parts[1]?.trim();
  const metricKeyRaw = parts.slice(2).join(METRIC_ID_SEPARATOR);

  if (!sportId || (scopeRaw !== "team" && scopeRaw !== "player")) {
    return null;
  }

  const metricKey = normalizeMetricKey(metricKeyRaw);
  if (!metricKey) {
    return null;
  }

  return {
    sportId,
    scope: scopeRaw,
    metricKey,
  };
}

export function sanitizeTrackedMetricKeys(
  values: string[] | undefined,
  sportId: string,
  scope: MetricScope,
  fallbackKeys: string[],
): string[] {
  const requested = values ?? [];
  const fallback = fallbackKeys.map(normalizeMetricKey).filter(Boolean);
  const source = requested.length > 0 ? requested : fallback;

  const catalog =
    scope === "team"
      ? getSportProfileById(sportId).teamMetricCatalog
      : getSportProfileById(sportId).playerMetricCatalog;
  const catalogKeys = new Set(catalog.map((metric) => normalizeMetricKey(metric.key)));

  const output: string[] = [];
  for (const input of source) {
    const parsedId = parseMetricId(input);
    const rawKey = parsedId ? parsedId.metricKey : input;
    const normalizedKey = normalizeMetricKey(rawKey);
    if (!normalizedKey) {
      continue;
    }

    // Accept known standard metrics and intentionally allow custom metrics.
    if (!catalogKeys.has(normalizedKey) && normalizedKey.length < 2) {
      continue;
    }
    output.push(normalizedKey);
  }

  const deduped = Array.from(new Set(output));
  return deduped.length > 0 ? deduped : fallback;
}

export function normalizeStatsForStorage(
  rawStats: unknown,
  sportId: string,
  scope: MetricScope,
  trackedMetricKeys?: string[],
): Record<string, number> {
  if (!rawStats || typeof rawStats !== "object" || Array.isArray(rawStats)) {
    return {};
  }

  const allowedKeys = trackedMetricKeys
    ? new Set(trackedMetricKeys.map(normalizeMetricKey).filter(Boolean))
    : null;

  const output: Record<string, number> = {};
  for (const [rawKey, value] of Object.entries(rawStats as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }

    const parsedId = parseMetricId(rawKey);
    const normalizedKey = normalizeMetricKey(parsedId ? parsedId.metricKey : rawKey);
    if (!normalizedKey) {
      continue;
    }
    if (allowedKeys && !allowedKeys.has(normalizedKey)) {
      continue;
    }

    output[toMetricId(sportId, scope, normalizedKey)] = value;
  }

  return output;
}

export function normalizeStatsForUi(
  rawStats: unknown,
  scope: MetricScope,
  expectedSportId?: string,
): Record<string, number> {
  if (!rawStats || typeof rawStats !== "object" || Array.isArray(rawStats)) {
    return {};
  }

  const output: Record<string, number> = {};
  for (const [rawKey, value] of Object.entries(rawStats as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }

    const parsedId = parseMetricId(rawKey);
    if (parsedId) {
      if (parsedId.scope !== scope) {
        continue;
      }
      if (expectedSportId && parsedId.sportId !== expectedSportId) {
        continue;
      }
      output[parsedId.metricKey] = value;
      continue;
    }

    const normalizedKey = normalizeMetricKey(rawKey);
    if (!normalizedKey) {
      continue;
    }
    output[normalizedKey] = value;
  }

  return output;
}

export function toStatMetrics(
  rawStats: unknown,
  scope: MetricScope,
  sportId?: string,
): StatMetric[] {
  const statsByKey = normalizeStatsForUi(rawStats, scope, sportId);

  let labelMap: Record<string, string> = {};
  if (sportId) {
    const profile = getSportProfileById(sportId);
    labelMap = toMetricLabelMap(
      scope === "team" ? profile.teamMetricCatalog : profile.playerMetricCatalog,
    );
  }

  const metrics = Object.entries(statsByKey).map(([key, value]) => ({
    key,
    label: labelMap[key] ?? toMetricLabelFromKey(key),
    value,
  }));

  metrics.sort((a, b) => a.label.localeCompare(b.label));
  return metrics;
}

