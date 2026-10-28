export type RecoveryDay = {
  day: string; sleep_seconds: number | null; hrv_overnight_ms: number | null;
  body_battery_at_wake: number | null; stress_average: number | null;
  sleep_start_at: string | null; sleep_end_at: string | null; sleep_awake_seconds: number | null;
  hrv_baseline_low_ms: number | null; hrv_baseline_high_ms: number | null; hrv_status: string | null;
  body_battery_charged: number | null; body_battery_drained: number | null;
  source: string | null; updated_at: string | null;
};
export const recoveryColumns = "day,sleep_seconds,hrv_overnight_ms,body_battery_at_wake,stress_average,sleep_start_at,sleep_end_at,sleep_awake_seconds,hrv_baseline_low_ms,hrv_baseline_high_ms,hrv_status,body_battery_charged,body_battery_drained,source,updated_at";
export function dayOffset(day: string, offset: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}
export function recoveryStory(row: RecoveryDay | undefined, rows: RecoveryDay[]) {
  if (!row) return { title: "A quiet day in the data", text: "No saved readings for this day yet. Try another date; missing readings are never treated as zero." };
  const previous = rows.filter(r => r.day < row.day && r.day >= dayOffset(row.day, -7) && r.sleep_seconds != null);
  const average = previous.length >= 3 ? previous.reduce((sum, r) => sum + r.sleep_seconds!, 0) / previous.length : null;
  const difference = row.sleep_seconds != null && average != null ? Math.round((row.sleep_seconds - average) / 60) : null;
  let title = "Your recovery, taking shape";
  let text = "As more nights arrive, compare your own patterns across sleep, HRV, energy and stress.";
  if (difference != null) {
    title = difference >= 30 ? "A little more sleep than usual" : difference <= -30 ? "A shorter night than usual" : "Sleep held close to your recent rhythm";
    text = `Sleep was ${Math.abs(difference)} minutes ${difference >= 0 ? "longer" : "shorter"} than your previous ${previous.length} recorded nights in the past week.`;
  }
  if (row.hrv_overnight_ms != null && row.hrv_baseline_low_ms != null && row.hrv_baseline_high_ms != null) {
    const within = row.hrv_overnight_ms >= row.hrv_baseline_low_ms && row.hrv_overnight_ms <= row.hrv_baseline_high_ms;
    text += ` Overnight HRV is ${within ? "within" : "outside"} the saved Garmin baseline range. Garmin’s HRV status uses its weekly average, shown below.`;
  }
  return { title, text };
}
