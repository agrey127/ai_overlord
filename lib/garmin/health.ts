import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDailyHealth } from "./api";
import { validDay } from "./activity";

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
}
function integer(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export function healthDue(last: string | undefined, now: string) {
  const previous = last ? Date.parse(last) : NaN;
  const current = Date.parse(now);
  return !Number.isFinite(previous) || previous > current || current - previous >= 3_600_000;
}

export function healthDays(now: string, timeZone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  if (!validDay(today)) throw new Error("Invalid health calendar date.");
  return Array.from({ length: 8 }, (_, index) => new Date(Date.parse(`${today}T12:00:00Z`) - (7 - index) * 86_400_000).toISOString().slice(0, 10));
}

export type HealthReading = {
  day: string; steps: number | null; sleep_score: number | null; resting_heart_rate: number | null;
};

export function normalizeHealth(days: string[], summaries: unknown[], sleeps: unknown[]): HealthReading[] {
  if (summaries.length !== days.length) throw new Error("Incomplete Garmin daily summaries.");
  const scores = new Map<string, number>();
  for (const entry of sleeps) {
    const row = object(entry);
    const overall = object(object(row.sleepScores).overall);
    const score = overall.qualifierKey === "INVALID" ? null : integer(overall.value, 0, 100);
    // Garmin returns an empty, null-date placeholder before today's sleep exists.
    if (score === null) continue;
    if (!validDay(row.calendarDate)) throw new Error("A Garmin sleep score has no valid date.");
    if (!days.includes(row.calendarDate)) continue;
    if (scores.has(row.calendarDate)) throw new Error("Duplicate Garmin sleep dates.");
    scores.set(row.calendarDate, score);
  }
  return days.map((day, index) => {
    const row = object(summaries[index]);
    if (row.calendarDate !== day) throw new Error("Garmin daily summary date does not match.");
    return {
      day,
      steps: integer(row.totalSteps, 0, 1_000_000),
      sleep_score: scores.get(day) ?? null,
      // Never substitute minHeartRate, averages, or the V2 restingValue fallback.
      resting_heart_rate: integer(row.restingHeartRate, 1, 300),
    };
  });
}

export async function synchronizeHealth(supabase: SupabaseClient, owner: string, key: string, now: string, timeZone: string) {
  if (!owner || !key) throw new Error("Garmin health sync is not configured.");
  const days = healthDays(now, timeZone);
  const raw = await fetchDailyHealth(key, days);
  const readings = normalizeHealth(days, raw.summaries, raw.sleeps);
  const { data, error } = await supabase.from("fitness_daily")
    .select("day,steps,sleep_score,resting_heart_rate,source,is_final,updated_at")
    .eq("user_id", owner).gte("day", days[0]).lte("day", days[days.length - 1]);
  if (error) throw new Error("Could not check existing daily health records.");
  const existing = new Map((data ?? []).map((row) => [row.day as string, row]));
  const summary = { checkedAt: now, daysChecked: days.length, written: 0, protected: 0, empty: 0, conflicts: 0 };
  for (const reading of readings) {
    const row = existing.get(reading.day);
    if (row && (row.is_final === true || !["garminconnect", "garmin_personal"].includes(row.source))) {
      summary.protected++; continue;
    }
    const metrics = Object.fromEntries(Object.entries(reading).filter(([name, value]) => name !== "day" && value !== null));
    if (!Object.keys(metrics).length) { summary.empty++; continue; }
    const payload = { ...metrics, source: "garmin_personal", captured_at: now, updated_at: now };
    if (!row) {
      const result = await supabase.from("fitness_daily").insert({ ...payload, user_id: owner, day: reading.day, is_final: false });
      if (result.error?.code === "23505") { summary.conflicts++; continue; }
      if (result.error) throw new Error("Could not insert daily Garmin health metrics.");
    } else {
      // Ownership, source, finalization and version guards protect concurrent manual edits.
      let query = supabase.from("fitness_daily").update(payload)
        .eq("user_id", owner).eq("day", reading.day).eq("source", row.source);
      query = row.is_final === null ? query.is("is_final", null) : query.eq("is_final", row.is_final);
      query = row.updated_at === null ? query.is("updated_at", null) : query.eq("updated_at", row.updated_at);
      const result = await query.select("day");
      if (result.error) throw new Error("Could not update daily Garmin health metrics.");
      if (!result.data?.length) { summary.conflicts++; continue; }
    }
    summary.written++;
  }
  return summary;
}
