import type { SupabaseClient } from "@supabase/supabase-js";

export type RunningGoalType = "race" | "speed" | "consistency" | "general_fitness" | "return_to_running";
export type RunningSessionKind = "easy" | "long" | "workout" | "recovery" | "race" | "rest";
export type RunningEffort = "easy" | "moderate" | "hard" | "rest";

export type RunningCoachProfileInput = {
  goal_type: RunningGoalType;
  goal_description: string;
  target_date: string | null;
  target_distance_miles: number | null;
  target_time_minutes: number | null;
  available_days: number[];
  long_run_day: number | null;
  max_runs_per_week: number | null;
  weekly_mileage_target: number | null;
  training_limits: string | null;
};

export type RunningSessionInput = {
  date: string;
  kind: RunningSessionKind;
  distance_miles: number;
  effort: RunningEffort;
  description: string;
};

export type RunningWeekInput = {
  week_start: string;
  focus: string;
  rationale: string;
  sessions: RunningSessionInput[];
};

function dateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is invalid.`);
  }
  return date;
}

function optionalNumber(value: number | null, label: string, maximum: number) {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new Error(`${label} must be greater than zero and at most ${maximum}.`);
  }
  return value;
}

function appToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(day: string, amount: number) {
  const date = dateOnly(day, "Date");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekStart(day: string) {
  const date = dateOnly(day, "Date");
  return addDays(day, -((date.getUTCDay() + 6) % 7));
}

function assertResult(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export function validateRunningProfile(input: RunningCoachProfileInput): RunningCoachProfileInput {
  if (!["race", "speed", "consistency", "general_fitness", "return_to_running"].includes(input.goal_type)) {
    throw new Error("Choose a supported running goal type.");
  }
  const goal = input.goal_description.trim();
  if (!goal || goal.length > 500) throw new Error("Describe the running goal in 1 to 500 characters.");
  if (input.target_date !== null) dateOnly(input.target_date, "Target date");
  optionalNumber(input.target_distance_miles, "Target distance", 200);
  optionalNumber(input.target_time_minutes, "Target time", 10000);
  optionalNumber(input.weekly_mileage_target, "Weekly mileage target", 300);
  if (!Array.isArray(input.available_days) || input.available_days.length > 7
    || input.available_days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
    || new Set(input.available_days).size !== input.available_days.length) {
    throw new Error("Available days must be distinct weekdays numbered Monday=1 through Sunday=7.");
  }
  if (input.long_run_day !== null && (!Number.isInteger(input.long_run_day) || input.long_run_day < 1 || input.long_run_day > 7)) {
    throw new Error("Long-run day must be a weekday numbered Monday=1 through Sunday=7.");
  }
  if (input.long_run_day !== null && input.available_days.length && !input.available_days.includes(input.long_run_day)) {
    throw new Error("The long-run day must be among available running days.");
  }
  if (input.max_runs_per_week !== null && (!Number.isInteger(input.max_runs_per_week)
    || input.max_runs_per_week < 1 || input.max_runs_per_week > 7)) {
    throw new Error("Maximum runs per week must be between 1 and 7.");
  }
  if (input.max_runs_per_week !== null && input.available_days.length
    && input.max_runs_per_week > input.available_days.length) {
    throw new Error("Maximum runs per week cannot exceed available days.");
  }
  const limits = input.training_limits?.trim() || null;
  if (limits && limits.length > 1000) throw new Error("Training limits must be at most 1000 characters.");
  return { ...input, goal_description: goal, training_limits: limits,
    available_days: [...input.available_days].sort((a, b) => a - b) };
}

export function validateRunningWeek(input: RunningWeekInput) {
  const start = dateOnly(input.week_start, "Week start");
  if (start.getUTCDay() !== 1) throw new Error("The week must start on Monday.");
  const today = appToday();
  if (input.week_start < addDays(weekStart(today), -7) || input.week_start > addDays(weekStart(today), 84)) {
    throw new Error("Plan the current, previous, or next 12 weeks.");
  }
  const focus = input.focus.trim();
  const rationale = input.rationale.trim();
  if (!focus || focus.length > 200 || !rationale || rationale.length > 2000) {
    throw new Error("A plan needs a short focus and a rationale.");
  }
  if (!Array.isArray(input.sessions) || input.sessions.length < 1 || input.sessions.length > 7) {
    throw new Error("A weekly plan needs 1 to 7 sessions.");
  }
  const seen = new Set<string>();
  let plannedMiles = 0;
  const sessions = input.sessions.map((session) => {
    dateOnly(session.date, "Session date");
    if (session.date < input.week_start || session.date > addDays(input.week_start, 6) || seen.has(session.date)) {
      throw new Error("Each session needs a distinct date within the selected week.");
    }
    seen.add(session.date);
    if (!["easy", "long", "workout", "recovery", "race", "rest"].includes(session.kind)
      || !["easy", "moderate", "hard", "rest"].includes(session.effort)) {
      throw new Error("Choose a supported session type and effort.");
    }
    if (!Number.isFinite(session.distance_miles) || session.distance_miles < 0 || session.distance_miles > 100
      || (session.kind === "rest" && (session.distance_miles !== 0 || session.effort !== "rest"))
      || (session.kind !== "rest" && (session.distance_miles <= 0 || session.effort === "rest"))) {
      throw new Error("Running sessions need a positive distance; rest days need zero distance.");
    }
    const description = session.description.trim();
    if (!description || description.length > 500) throw new Error("Describe every planned session in 1 to 500 characters.");
    plannedMiles += session.distance_miles;
    return { ...session, description };
  });
  if (plannedMiles > 300) throw new Error("A weekly plan cannot exceed 300 miles.");
  return { week_start: input.week_start, focus, rationale,
    sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
    planned_miles: Number(plannedMiles.toFixed(2)) };
}

export async function getRunningCoachContext(supabase: SupabaseClient, userId: string) {
  const today = appToday();
  const currentWeek = weekStart(today);
  const [profile, runs, recovery, races, plans, readiness, consistency, longRun, balance] = await Promise.all([
    supabase.from("running_coach_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("activities")
      .select("id,activity_date,distance_miles,duration_minutes,pace_min_per_mile,average_heart_rate,cadence,calories_burned,notes,source")
      .eq("user_id", userId).eq("activity_type", "run")
      .gte("activity_date", addDays(today, -83)).lte("activity_date", today)
      .order("activity_date", { ascending: false }).order("id", { ascending: false }).limit(200),
    supabase.from("fitness_daily")
      .select("day,sleep_score,resting_heart_rate,steps,updated_at,is_final")
      .eq("user_id", userId).gte("day", addDays(today, -13)).lte("day", today)
      .order("day", { ascending: false }),
    supabase.from("running_races")
      .select("race_name,race_date,distance_miles,goal_time_minutes,status,notes")
      .eq("user_id", userId).gte("race_date", addDays(today, -90))
      .order("race_date", { ascending: true }).limit(20),
    supabase.from("running_training_weeks").select("*").eq("user_id", userId)
      .gte("week_start", addDays(currentWeek, -7)).lte("week_start", addDays(currentWeek, 14))
      .order("week_start", { ascending: true }),
    supabase.from("v_readiness_status").select("as_of_day,data_age_hours,readiness_color,reasons")
      .eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("v_run_consistency").select("last_run_date,days_since_last_run,max_gap_last_30d")
      .eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("v_long_run_progression").select("last_long_day,last_long_min,max_long_day_30d,max_long_min_30d,jumped_too_fast")
      .eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("v_load_recovery_balance").select("run_minutes_7d,run_minutes_30d,sleep_avg_7d,sleep_avg_30d,rhr_avg_7d,rhr_avg_30d,overreach_risk")
      .eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  for (const [label, result] of [
    ["running profile", profile], ["run history", runs], ["recovery history", recovery],
    ["race goals", races], ["weekly plans", plans], ["readiness", readiness],
    ["consistency", consistency], ["long-run progression", longRun], ["load balance", balance],
  ] as const) assertResult(result.error, label);

  const weekTotals = new Map<string, { week_start: string; miles: number; runs: number }>();
  for (let offset = 7; offset >= 0; offset -= 1) {
    const start = addDays(currentWeek, -offset * 7);
    weekTotals.set(start, { week_start: start, miles: 0, runs: 0 });
  }
  for (const run of runs.data ?? []) {
    const start = weekStart(run.activity_date);
    const week = weekTotals.get(start);
    if (week) {
      week.miles += Number(run.distance_miles ?? 0);
      week.runs += 1;
    }
  }
  const recentFourWeekMiles = [...weekTotals.values()].slice(3, 7).map((item) => item.miles);
  return {
    as_of: today,
    profile: profile.data,
    runs: runs.data ?? [],
    runs_truncated: (runs.data ?? []).length === 200,
    recovery_days: recovery.data ?? [],
    race_records: races.data ?? [],
    plans: plans.data ?? [],
    weekly_history: [...weekTotals.values()].map((week) => ({ ...week, miles: Number(week.miles.toFixed(2)) })),
    recent_four_complete_week_average_miles: Number((recentFourWeekMiles.reduce((a, b) => a + b, 0) / 4).toFixed(2)),
    readiness: readiness.data,
    consistency: consistency.data,
    long_run: longRun.data,
    load_recovery: balance.data,
    data_note: "Runs and recovery reflect saved records only. Missing days are not proof of rest or recovery. Race status may be stale.",
  };
}

export async function prepareRunningCoachProfile(
  supabase: SupabaseClient, userId: string, conversationId: string, input: RunningCoachProfileInput,
) {
  const payload = validateRunningProfile(input);
  const { data, error } = await supabase.from("running_coach_drafts")
    .insert({ user_id: userId, conversation_id: conversationId, kind: "profile", payload })
    .select("id").single();
  assertResult(error, "prepare running profile");
  return { confirmation_required: true, draft_id: data!.id, kind: "profile", profile: payload };
}

export async function prepareRunningWeek(
  supabase: SupabaseClient, userId: string, conversationId: string, input: RunningWeekInput,
) {
  const payload = validateRunningWeek(input);
  const context = await getRunningCoachContext(supabase, userId);
  if (!context.profile) throw new Error("Save a running goal profile before planning a week.");
  const plannedRunDays = payload.sessions.filter((session) => session.kind !== "rest").length;
  const profile = context.profile as { available_days?: number[]; max_runs_per_week?: number | null };
  if (profile.max_runs_per_week && plannedRunDays > profile.max_runs_per_week) {
    throw new Error("The plan exceeds your saved maximum run days. Update your goal profile first.");
  }
  if (Array.isArray(profile.available_days) && profile.available_days.length
    && payload.sessions.some((session) => session.kind !== "rest"
      && !profile.available_days!.includes(((dateOnly(session.date, "Session date").getUTCDay() + 6) % 7) + 1))) {
    throw new Error("The plan places a run outside your saved available days. Update your goal profile first.");
  }
  const baseline = context.recent_four_complete_week_average_miles;
  const { data, error } = await supabase.from("running_coach_drafts")
    .insert({ user_id: userId, conversation_id: conversationId, kind: "week_plan", payload })
    .select("id").single();
  assertResult(error, "prepare running week");
  return {
    confirmation_required: true, draft_id: data!.id, kind: "week_plan", week_plan: payload,
    recent_four_complete_week_average_miles: baseline,
    volume_change_percent: baseline > 0 ? Number(((payload.planned_miles / baseline - 1) * 100).toFixed(1)) : null,
    caution: baseline === 0
      ? "No recent logged mileage baseline is available. Confirm the starting load before saving."
      : payload.planned_miles > baseline * 1.2
        ? "Planned mileage is more than 20% above the four complete week average. Review this with the runner before confirmation."
        : null,
  };
}

export async function confirmRunningCoachDraft(
  supabase: SupabaseClient, userId: string, conversationId: string, draftId: string,
) {
  const { data, error } = await supabase.rpc("confirm_running_coach_draft", {
    p_user_id: userId, p_conversation_id: conversationId, p_draft_id: draftId,
  });
  assertResult(error, "confirm running coach change");
  return data;
}
