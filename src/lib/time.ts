const DURATION_RE = /^(\d+)([dh])$/;

export function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
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
