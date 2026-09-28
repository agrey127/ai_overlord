import type { SupabaseClient } from "@supabase/supabase-js";

type Dataset = "runs" | "activities" | "meal_logs";
type Metric = "distance_miles" | "duration_minutes" | "calories_burned" | "calories" | "protein_g" | "carbs_g" | "fat_g";
type Period = "today" | "yesterday" | "this_week" | "last_7_days" | "custom";

const datasets: Record<Dataset, { table: string; date: string; metrics: readonly Metric[] }> = {
  runs: { table: "activities", date: "activity_date", metrics: ["distance_miles", "duration_minutes", "calories_burned"] },
  activities: { table: "activities", date: "activity_date", metrics: ["distance_miles", "duration_minutes", "calories_burned"] },
  meal_logs: { table: "meal_logs", date: "meal_date", metrics: ["calories", "protein_g", "carbs_g", "fat_g"] },
};

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must be in YYYY-MM-DD format.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("The requested calendar date is invalid.");
  }
  return date;
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolvePeriod(input: { period: Period; start_date: string | null; end_date: string | null }) {
  if (input.period === "custom") {
    if (!input.start_date || !input.end_date) throw new Error("Custom periods need both start and end dates.");
    return { startDate: input.start_date, endDate: input.end_date };
  }
  if (!["today", "yesterday", "this_week", "last_7_days"].includes(input.period)) {
    throw new Error("Choose a supported date period.");
  }
  const timeZone = process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const today = parseDate(`${parts.year}-${parts.month}-${parts.day}`);
  if (input.period === "today") return { startDate: dateString(today), endDate: dateString(today) };
  if (input.period === "yesterday") {
    const yesterday = new Date(today.getTime() - 86_400_000);
    return { startDate: dateString(yesterday), endDate: dateString(yesterday) };
  }
  const daysBack = input.period === "last_7_days" ? 6 : (today.getUTCDay() + 6) % 7;
  return { startDate: dateString(new Date(today.getTime() - daysBack * 86_400_000)), endDate: dateString(today) };
}

export async function queryPersonalTotals(
  supabase: SupabaseClient,
  userId: string,
  input: { dataset: Dataset; metric: Metric; period: Period; start_date: string | null; end_date: string | null },
) {
  const source = datasets[input.dataset];
  if (!source || !source.metrics.includes(input.metric)) {
    throw new Error("That metric is not available for the selected data source.");
  }
  const { startDate, endDate } = resolvePeriod(input);
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const calendarDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (calendarDays < 1 || calendarDays > 366) {
    throw new Error("Choose a date range of 1 to 366 calendar days.");
  }

  let total = 0;
  let rowCount = 0;
  const recordedDates = new Set<string>();
  const pageSize = 1000;
  const maxRows = 10000;
  for (let offset = 0; offset <= maxRows; offset += pageSize) {
    let query = supabase.from(source.table)
      .select(`${source.date}, ${input.metric}`)
      .eq("user_id", userId)
      .gte(source.date, startDate)
      .lte(source.date, endDate)
      .order(source.date, { ascending: true })
      .order("id", { ascending: true });
    if (input.dataset === "runs") query = query.eq("activity_type", "run");
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Unable to read ${input.dataset}: ${error.message}`);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    if (offset === maxRows && rows.length) {
      throw new Error("This period contains too many records to calculate a complete total. Ask for a shorter period.");
    }
    for (const row of rows) {
      const value = row[input.metric];
      if (value != null) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) throw new Error("A saved value could not be calculated.");
        total += numeric;
      }
      if (typeof row[source.date] === "string") recordedDates.add(row[source.date] as string);
    }
    rowCount += rows.length;
    if (rows.length < pageSize) break;
  }

  return {
    dataset: input.dataset,
    metric: input.metric,
    period: input.period,
    start_date: startDate,
    end_date: endDate,
    total: Number(total.toFixed(3)),
    logged_average_per_calendar_day: Number((total / calendarDays).toFixed(3)),
    calendar_days: calendarDays,
    days_with_records: recordedDates.size,
    record_count: rowCount,
    note: "Totals reflect saved records only. Days without records are included in the calendar-day average as zero logged amount.",
  };
}
