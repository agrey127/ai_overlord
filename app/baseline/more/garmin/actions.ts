"use server";

import { revalidatePath } from "next/cache";
import { loadGarminRuns } from "@/lib/garmin/import";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unable to import Garmin runs.";
}

export async function previewGarminRuns(start: string, end: string) {
  try {
    const { runs, skipped } = await loadGarminRuns(start, end);
    return { runs, skipped, error: null };
  } catch (error) { return { runs: [], skipped: 0, error: message(error) }; }
}

export async function importGarminRuns(start: string, end: string, selected: string[]) {
  let imported = 0;
  let duplicates = 0;
  try {
    if (!Array.isArray(selected) || selected.length < 1 || selected.length > 500
      || selected.some((id) => typeof id !== "string" || !/^garmin_personal:\d+$/.test(id))) {
      throw new Error("Preview and select the runs to import first.");
    }
    // Re-fetch from Garmin: never accept client-supplied activity metrics or owner IDs.
    const { runs, supabase, userId } = await loadGarminRuns(start, end);
    const ids = new Set(selected);
    if ([...ids].some((id) => !runs.some((run) => run.source_fingerprint === id))) {
      throw new Error("A selected run is no longer available. Refresh the preview before importing.");
    }
    for (const run of runs.filter((row) => ids.has(row.source_fingerprint))) {
      if (run.duplicate) { duplicates++; continue; }
      const { duplicate, ...activity } = run;
      if (duplicate) continue;
      const { error } = await supabase.from("activities").insert({ ...activity, user_id: userId });
      if (error?.code === "23505") { duplicates++; continue; }
      if (error) throw new Error("Baseline could not save a run. Refresh the preview before retrying.");
      imported++;
    }
    return { imported, duplicates, error: null };
  } catch (error) { return { imported, duplicates, error: message(error) }; }
  finally { revalidatePath("/baseline", "layout"); }
}
