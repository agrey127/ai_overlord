import "server-only";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { fetchRuns } from "./client";
import { duplicateReason, normalizeRun, validDay, type ExistingRun } from "./activity";

export function garminConfigured() {
  return Boolean(process.env.GARMIN_PERSONAL_API_KEY?.trim() && process.env.GARMIN_PERSONAL_USER_ID?.trim());
}

export async function loadGarminRuns(start: string, end: string) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const userId = user.email ?? user.id;
  if (!garminConfigured()) throw new Error("Garmin is not connected yet. Add the Personal API key to the protected server configuration.");
  if (userId !== process.env.GARMIN_PERSONAL_USER_ID?.trim()) throw new Error("Garmin Personal access is not configured for this account.");
  if (!validDay(start) || !validDay(end) || start > end
      || Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`) > 366 * 86_400_000) {
    throw new Error("Choose a valid date range of up to one year.");
  }
  const raw = await fetchRuns(process.env.GARMIN_PERSONAL_API_KEY!.trim(), start, end);
  const normalized = raw.map(normalizeRun);
  const seen = new Set<string>();
  const runs = normalized.filter((row) => {
    if (!row || row.activity_date < start || row.activity_date > end || seen.has(row.source_fingerprint)) return false;
    seen.add(row.source_fingerprint); return true;
  }).filter((row) => row !== null);
  // Paginate existing records as well: Supabase's row cap must not hide matches.
  const existing: ExistingRun[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("activities")
      .select("id,activity_date,duration_minutes,distance_miles,source,source_fingerprint")
      .eq("user_id", userId).eq("activity_type", "run")
      .gte("activity_date", start).lte("activity_date", end).order("id").range(offset, offset + 499);
    if (error) throw new Error("Unable to check existing Baseline runs. No import was started.");
    existing.push(...(data ?? []));
    if (!data || data.length < 500) break;
    if (offset >= 10000) throw new Error("Too many existing runs. Choose a shorter date range.");
  }
  return { supabase, userId, skipped: normalized.filter((row) => !row).length,
    runs: runs.map((run) => ({ ...run, duplicate: duplicateReason(run, existing) })) };
}
