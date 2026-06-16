const DURATION_RE = /^(\d+)([dh])$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseDateBound(value: string, bound: "start" | "end"): Date | undefined {
  const date = parseDate(value);
  if (!date) return undefined;
  if (!DATE_ONLY_RE.test(value)) return date;
  const normalized = new Date(date);
  normalized.setUTCHours(
    bound === "start" ? 0 : 23,
    bound === "start" ? 0 : 59,
    bound === "start" ? 0 : 59,
    bound === "start" ? 0 : 999,
  );
  return normalized;
}

export function parseDuration(value: string, now = new Date()): Date | undefined {
  const match = DURATION_RE.exec(value);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2];
  const ms = amount * (unit === "d" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000);
  return new Date(now.getTime() - ms);
}

export function isWithin(timestamp: string | undefined, since?: Date, until?: Date): boolean {
  if (!timestamp) return true;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return true;
  if (since && date < since) return false;
  if (until && date > until) return false;
  return true;
}

export function formatIsoMinute(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").slice(0, 13);
}
