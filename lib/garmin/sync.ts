import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRuns } from "./api";
import { duplicateReason, normalizeRun, type ExistingRun } from "./activity";

const day = 86_400_000;

function timestamp(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19) ? parsed : NaN;
}

export function startedAfterCutoff(raw: unknown, cutoff: number, now: number) {
  if (!raw || typeof raw !== "object") return false;
  const value = (raw as Record<string, unknown>).startTimeGMT;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{3})?$/.test(value)) return false;
  const start = timestamp(`${value.replace(" ", "T")}Z`);
  return Number.isFinite(start) && start > cutoff && start <= now;
}

export function syncWindow(cutoffValue: string, nowValue: string, lastSuccess?: string, lastFull?: string) {
  const cutoff = timestamp(cutoffValue);
  const now = timestamp(nowValue);
  if (!Number.isFinite(cutoff) || !Number.isFinite(now) || cutoff > now) throw new Error("Invalid automatic sync cutoff.");
  const success = timestamp(lastSuccess);
  const full = timestamp(lastFull);
  // A missing, future, or old cursor causes a full catch-up, never a later cutoff.
  const fullScan = !Number.isFinite(success) || success > now || success < cutoff
    || !Number.isFinite(full) || full > now || full < cutoff || now - full >= day;
  const from = fullScan ? cutoff : Math.max(cutoff, success - 7 * day);
  // Garmin filters on local dates; pad UTC dates for travel across time zones.
  return { cutoff, now, fullScan, start: new Date(from - day).toISOString().slice(0, 10), end: new Date(now + day).toISOString().slice(0, 10) };
}

export async function synchronizeRuns(supabase: SupabaseClient, owner: string, key: string,
  cutoff: string, now: string, lastSuccess?: string, lastFull?: string) {
  if (!owner || !key) throw new Error("Automatic Garmin sync is not configured.");
  const window = syncWindow(cutoff, now, lastSuccess, lastFull);
  const summary = { checkedAt: now, fullScan: window.fullScan, scanned: 0, excluded: 0, invalid: 0, duplicates: 0, imported: 0 };
  const seen = new Set<string>();
  // Small independent windows avoid the API client's safety cap during long catch-ups.
  let start = window.start;
  while (start <= window.end) {
    const end = new Date(Math.min(Date.parse(`${start}T00:00:00Z`) + 27 * day, Date.parse(`${window.end}T00:00:00Z`))).toISOString().slice(0, 10);
    const raw = await fetchRuns(key, start, end);
    summary.scanned += raw.length;
    const eligible = raw.filter((row) => {
      if (startedAfterCutoff(row, window.cutoff, window.now)) return true;
      summary.excluded++; return false;
    });
    const runs = eligible.flatMap((row) => {
      const run = normalizeRun(row);
      if (!run) { summary.invalid++; return []; }
      if (seen.has(run.source_fingerprint)) return [];
      seen.add(run.source_fingerprint); return [run];
    });
    if (runs.length) {
      const existing: ExistingRun[] = [];
      // Include actual activity dates even if Garmin returns a travel boundary case.
      const dates = runs.map((row) => row.activity_date).sort();
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("activities")
          .select("id,activity_date,duration_minutes,distance_miles,source,source_fingerprint")
          .eq("user_id", owner).eq("activity_type", "run")
          .gte("activity_date", dates[0]).lte("activity_date", dates[dates.length - 1])
          .order("id").range(offset, offset + 499);
        if (error) throw new Error("Automatic sync could not check existing runs.");
        existing.push(...(data ?? []));
        if (!data || data.length < 500) break;
        if (offset >= 10000) throw new Error("Automatic sync found too many existing runs.");
      }
      for (const run of runs) {
        if (duplicateReason(run, existing)) { summary.duplicates++; continue; }
        // INSERT only. Never update, upsert, delete, or relabel existing history.
        const { error } = await supabase.from("activities").insert({ ...run, user_id: owner });
        if (error?.code === "23505") { summary.duplicates++; continue; }
        if (error) throw new Error("Automatic sync could not save a new run; it will retry.");
        summary.imported++;
        existing.push(run);
      }
    }
    start = new Date(Date.parse(`${end}T00:00:00Z`) + day).toISOString().slice(0, 10);
  }
  return summary;
}
