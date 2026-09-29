import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadTypeScript(path, dependencies = {}) {
  const compiled = ts.transpileModule(readFileSync(join(root, path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", "require", compiled)(loaded, loaded.exports, (name) => dependencies[name] ?? {});
  return loaded.exports;
}

const { getSharedCoachingGoals } = loadTypeScript("lib/assistant/coaching-goals.ts");
const { validateStrengthProfile } = loadTypeScript("lib/assistant/strength-coach.ts", {
  "@/lib/assistant/repository": {}, "@/lib/assistant/coaching-goals": {},
});
const { validateNutritionProfile } = loadTypeScript("lib/assistant/nutrition-coach.ts", {
  "@/lib/assistant/coaching-goals": {},
});
const { getNutritionCoachContext } = loadTypeScript("lib/assistant/nutrition-coach.ts", {
  "@/lib/assistant/coaching-goals": { getSharedCoachingGoals: async () => ({
    local_date: "2026-09-29", nutrition: { current_phase: "deficit" }, running: null, strength: null,
  }) },
});

test("shared goals contain structured targets without private notes or chat text", async () => {
  const columns = new Map();
  const rows = {
    running_coach_profiles: { goal_type: "race", target_date: "2026-11-21", target_distance_miles: 13.1,
      target_time_minutes: 125, max_runs_per_week: 5, long_run_day: 6, updated_at: "2026-09-29",
      training_limits: "private running detail", goal_description: "private free text" },
    strength_coach_profiles: { primary_goal: "build_strength", min_sessions_per_week: 4,
      max_sessions_per_week: 5, updated_at: "2026-09-29", equipment: "private equipment detail" },
    nutrition_coach_profiles: { deficit_start_date: "2026-09-14", maintenance_start_date: "2026-11-09",
      maintenance_end_date: "2026-12-31", approx_target_loss_lbs: 10,
      review_style: "review_logs", updated_at: "2026-09-29", private_note: "private nutrition detail" },
  };
  const supabase = { from(table) { return {
    select(fields) { columns.set(table, fields.split(",")); return this; },
    eq() { return this; },
    async maybeSingle() {
      return { data: Object.fromEntries(columns.get(table).map((column) => [column, rows[table][column]])), error: null };
    },
  }; } };
  const goals = await getSharedCoachingGoals(supabase, "user-1");
  assert.equal(goals.running.target_date, "2026-11-21");
  assert.equal(goals.strength.max_sessions_per_week, 5);
  assert.equal(goals.nutrition.maintenance_start_date, "2026-11-09");
  assert.equal(goals.nutrition.review_style, "review_logs");
  assert.ok(!JSON.stringify(goals).includes("private"));
  assert.ok(!columns.get("running_coach_profiles").includes("training_limits"));
  assert.ok(!columns.get("strength_coach_profiles").includes("equipment"));
  assert.ok(!columns.get("nutrition_coach_profiles").includes("private_note"));
});

test("nutrition phase profile accepts the stated eight-week plan", () => {
  const input = { deficit_start_date: "2026-09-14", maintenance_start_date: "2026-11-09",
    maintenance_end_date: "2026-12-31", approx_target_loss_lbs: 10, review_style: "review_logs" };
  assert.deepEqual(validateNutritionProfile(input), input);
  assert.throws(() => validateNutritionProfile({ ...input, maintenance_start_date: "2026-09-01" }), /ordered/);
  assert.throws(() => validateNutritionProfile({ ...input, deficit_start_date: "2026-09-31" }), /valid calendar/);
});

test("nutrition review preserves logged days and flags gaps", async () => {
  const supabase = { from(table) { return {
    select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; },
    order() { return this; },
    async limit() { return { error: null, data: table === "meal_logs"
      ? [{ meal_date: "2026-09-29", calories: 500, protein_g: 30, carbs_g: 60, fat_g: 15 },
        { meal_date: "2026-09-29", calories: 600, protein_g: 40, carbs_g: 70, fat_g: 20 }]
      : [{ measured_at: "2026-09-18T12:00:00Z", weight_lbs: 201.1 }] }; },
  }; } };
  const context = await getNutritionCoachContext(supabase, "user-1");
  assert.equal(context.period.calendar_days, 28);
  assert.equal(context.days_with_meal_logs, 1);
  assert.equal(context.logged_days[0].calories, 1100);
  assert.equal(context.recent_weight_logs.length, 1);
  assert.match(context.data_note, /data gap/);
});

test("strength profile validates a flexible four to five session target", () => {
  const input = { primary_goal: "build_strength", goal_description: "Build strength cautiously during race training",
    min_sessions_per_week: 4, max_sessions_per_week: 5, available_days: [],
    preferred_session_minutes: null, equipment: null, training_limits: null };
  assert.deepEqual(validateStrengthProfile(input), input);
  assert.throws(() => validateStrengthProfile({ ...input, min_sessions_per_week: 6 }), /range/);
  assert.throws(() => validateStrengthProfile({ ...input, available_days: [1, 1] }), /distinct/);
});
