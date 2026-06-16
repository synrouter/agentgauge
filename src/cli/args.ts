import type { Severity } from "../detectors/index.js";

export function list(value: unknown): string[] | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

export function severity(value: unknown): Severity | undefined {
  return value === "low" || value === "med" || value === "high" ? value : undefined;
}

export function numberArg(value: unknown): number | undefined {
  const num =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(num) ? num : undefined;
}

export function stringOrTrue(value: unknown): true | string | undefined {
  if (value === true || value === undefined) return true;
  if (typeof value === "string" && value.length === 0) return true;
  return typeof value === "string" ? value : undefined;
}
