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

// Store only explicit daily recovery fields, never raw payloads or identity data.
export function normalizeRecovery(days: string[], summaries: unknown[], sleeps: unknown[], hrv: unknown[] = []) {
  const result = new Map<string, Record<string, number | string>>();
  const put = (day: unknown, fields: Record<string, number | string | null>) => {
    if (!validDay(day) || !days.includes(day)) return;
    result.set(day, { ...result.get(day), ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)) } as Record<string, number | string>);
  };
  const timestamp = (v: unknown) => {
    // Garmin can serialize UTC epoch milliseconds or an ISO timestamp. Never infer a local offset.
    const time = typeof v === "number" ? v : typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? Date.parse(v) : NaN;
    return Number.isFinite(time) && time > 946684800000 && time < 4102444800000 ? new Date(time).toISOString() : null;
  };
  for (const value of summaries) {
    const r = object(value);
    put(r.calendarDate, {
      stress_average: integer(r.averageStressLevel, 0, 100),
      body_battery_at_wake: integer(r.bodyBatteryAtWakeTime, 0, 100),
      body_battery_high: integer(r.bodyBatteryHighestValue, 0, 100),
      body_battery_low: integer(r.bodyBatteryLowestValue, 0, 100),
      body_battery_charged: integer(r.bodyBatteryChargedValue, 0, 200),
      body_battery_drained: integer(r.bodyBatteryDrainedValue, 0, 200),
    });
  }
  const seen = new Set<string>();
  for (const value of sleeps) {
    const r = object(value);
    if (validDay(r.calendarDate) && days.includes(r.calendarDate)) {
      if (seen.has(r.calendarDate)) throw new Error("Duplicate sleep recovery dates.");
      seen.add(r.calendarDate);
    }
    const start = timestamp(r.sleepStartTimestampGMT), end = timestamp(r.sleepEndTimestampGMT);
    const validWindow = start && end && end > start && Date.parse(end) - Date.parse(start) <= 86400000;
    put(r.calendarDate, {
      sleep_seconds: integer(r.sleepTimeSeconds, 1, 86400),
      sleep_start_at: validWindow ? start : null, sleep_end_at: validWindow ? end : null,
      sleep_awake_seconds: integer(r.awakeSleepSeconds, 0, 86400),
      sleep_awake_count: integer(r.awakeCount, 0, 1000),
    });
  }
  const seenHrv = new Set<string>();
  for (const value of hrv) {
    const r = object(value), baseline = object(r.baseline);
    if (validDay(r.calendarDate) && days.includes(r.calendarDate)) {
      if (seenHrv.has(r.calendarDate)) throw new Error("Duplicate HRV dates.");
      seenHrv.add(r.calendarDate);
    }
    const status = typeof r.status === "string" && ["POOR", "LOW", "UNBALANCED", "BALANCED"].includes(r.status) ? r.status : null;
    if (r.status === "INVALID") continue;
    put(r.calendarDate, {
      hrv_overnight_ms: integer(r.lastNightAvg, 1, 1000), hrv_weekly_ms: integer(r.weeklyAvg, 1, 1000),
      hrv_baseline_low_ms: integer(baseline.balancedLow, 1, 1000), hrv_baseline_high_ms: integer(baseline.balancedUpper, 1, 1000), hrv_status: status,
    });
  }
  return result;
}

export async function synchronizeHealth(supabase: SupabaseClient, owner: string, key: string, now: string, timeZone: string) {
  if (!owner || !key) throw new Error("Garmin health sync is not configured.");
  const days = healthDays(now, timeZone);
  const raw = await fetchDailyHealth(key, days);
  const recovery = normalizeRecovery(days, raw.summaries, raw.sleeps, raw.hrv);
  const readings = normalizeHealth(days, raw.summaries, raw.sleeps).map(row => ({ ...row, ...recovery.get(row.day) }));
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
