function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return fallback;
}

function toPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const truncated = Math.trunc(value);
  if (truncated < 1) {
    return fallback;
  }
  return truncated;
}

export function isRedditSourceId(sourceId: string): boolean {
  return sourceId.trim().toLowerCase().startsWith("reddit");
}

export function resolveCollectorDisableRedditDefault(): boolean {
  return toBoolean(process.env.COLLECTOR_DISABLE_REDDIT_DEFAULT, true);
}

export function resolveNonRedditCapMultiplier(): number {
  const parsed = toFiniteNumber(process.env.COLLECTOR_NON_REDDIT_CAP_MULTIPLIER, 3);
  return Math.max(1, Math.min(parsed, 10));
}

export function resolveCollectorSourceCap(sourceId: string, baseCap: number): number {
  const safeBaseCap = toPositiveInteger(baseCap, 1);
  if (isRedditSourceId(sourceId)) {
    return safeBaseCap;
  }
  return toPositiveInteger(Math.round(safeBaseCap * resolveNonRedditCapMultiplier()), safeBaseCap);
}

export function resolveNonRedditIntervalScale(): number {
  const parsed = toFiniteNumber(process.env.COLLECTOR_NON_REDDIT_INTERVAL_SCALE, 0.34);
  return Math.max(0.1, Math.min(parsed, 1));
}

export function resolveCollectorSourceIntervalMinutes(sourceId: string, baseIntervalMinutes: number): number {
  const safeInterval = toPositiveInteger(baseIntervalMinutes, 1);
  if (isRedditSourceId(sourceId)) {
    return safeInterval;
  }
  return toPositiveInteger(Math.round(safeInterval * resolveNonRedditIntervalScale()), safeInterval);
}
