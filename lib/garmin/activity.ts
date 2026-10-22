export type ImportedRun = {
  activity_type: "run";
  activity_date: string;
  duration_minutes: number;
  calories_burned: number | null;
  distance_miles: number | null;
  average_heart_rate: number | null;
  cadence: number | null;
  pace_min_per_mile: number | null;
  notes: string;
  source: "garmin_personal";
  source_fingerprint: string;
};

function number(value: unknown, max: number, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return null;
  return integer ? Math.round(value) : value;
}

export function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Garmin Personal API SummarizedActivityDTO: meters, seconds, kcal, steps/minute.
// Only the local date is saved: parsing an offset-free Garmin timestamp as UTC
// would move some workouts onto the wrong calendar day.
export function normalizeRun(value: unknown): ImportedRun | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const type = row.activityType as { typeKey?: string; parentTypeId?: number } | null;
  if (!type || !(type.typeKey === "running" || type.parentTypeId === 1)) return null;
  if (!Number.isSafeInteger(row.activityId) || Number(row.activityId) <= 0) return null;
  const day = typeof row.startTimeLocal === "string" ? row.startTimeLocal.slice(0, 10) : null;
  const seconds = number(row.duration, 86_400);
  if (!validDay(day) || !seconds) return null;
  const meters = number(row.distance, 1_609_344);
  const miles = meters === null ? null : meters / 1609.344;
  const speed = number(row.averageSpeed, 100);
  const pace = speed && speed > 0 ? 1609.344 / speed / 60 : null;
  return {
    activity_type: "run", activity_date: day, duration_minutes: seconds / 60,
    calories_burned: number(row.calories, 10000), distance_miles: miles,
    average_heart_rate: number(row.averageHR, 300, true),
    cadence: number(row.averageRunningCadenceInStepsPerMinute, 300, true),
    pace_min_per_mile: pace !== null && pace <= 120 ? pace : null,
    notes: `Imported from Garmin Connect. Activity ${row.activityId}.`,
    source: "garmin_personal", source_fingerprint: `garmin_personal:${row.activityId}`,
  };
}

export type ExistingRun = Pick<ImportedRun, "activity_date" | "duration_minutes" | "distance_miles"> & {
  source: string | null; source_fingerprint: string | null;
};

export function duplicateReason(run: ImportedRun, existing: ExistingRun[]): "imported" | "possible_match" | null {
  if (existing.some((row) => row.source_fingerprint === run.source_fingerprint)) return "imported";
  // Leave manual/screenshot history intact. A possible match needs human review,
  // rather than silently replacing a user's record or double-counting a run.
  return existing.some((row) => row.source !== "garmin_personal"
    && row.activity_date === run.activity_date
    && Math.abs(Number(row.duration_minutes) - run.duration_minutes) <= 1
    && row.distance_miles !== null && run.distance_miles !== null
    && Math.abs(Number(row.distance_miles) - run.distance_miles) <= 0.05)
    ? "possible_match" : null;
}
