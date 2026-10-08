import type { SupabaseClient } from "@supabase/supabase-js";

export type WeightLog = { measured_at: string; weight_lbs: number; source: string };
export type WeightAverage = { day: string; weight_7d_avg: number };

export async function fetchWeightHistory(supabase: SupabaseClient, userId: string) {
  // Page both sources so all-time history isn't truncated by the API row limit.
  async function readAll(table: string, columns: string, order: string, tieBreaker?: string) {
    const rows: Record<string, unknown>[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      let query = supabase.from(table).select(columns).eq("user_id", userId)
        .order(order, { ascending: true });
      if (tieBreaker) query = query.order(tieBreaker, { ascending: true });
      const { data, error } = await query.range(offset, offset + pageSize - 1).returns<Record<string, unknown>[]>();
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) return rows;
    }
  }
  const [rawLogs, rawAverages] = await Promise.all([
    readAll("body_weight_logs", "measured_at,weight_lbs,source", "measured_at", "source"),
    readAll("v_weight_rolling_7d", "day,weight_7d_avg", "day"),
  ]);
  const logs: WeightLog[] = rawLogs.flatMap((row) => {
    const weight = row.weight_lbs == null ? NaN : Number(row.weight_lbs);
    return typeof row.measured_at === "string" && Number.isFinite(Date.parse(row.measured_at)) && Number.isFinite(weight)
      ? [{ measured_at: row.measured_at, weight_lbs: weight, source: String(row.source ?? "Unknown") }] : [];
  });
  const averages: WeightAverage[] = rawAverages.flatMap((row) => {
    const weight = row.weight_7d_avg == null ? NaN : Number(row.weight_7d_avg);
    return typeof row.day === "string" && Number.isFinite(Date.parse(row.day)) && Number.isFinite(weight)
      ? [{ day: row.day, weight_7d_avg: weight }] : [];
  });
  return { logs: logs.reverse(), averages };
}
