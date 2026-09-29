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

test("shared goals contain structured targets without private notes or chat text", async () => {
  const columns = new Map();
  const rows = {
    running_coach_profiles: { goal_type: "race", target_date: "2026-11-21", target_distance_miles: 13.1,
      target_time_minutes: 125, max_runs_per_week: 5, long_run_day: 6, updated_at: "2026-09-29",
      training_limits: "private running detail", goal_description: "private free text" },
    strength_coach_profiles: { primary_goal: "build_strength", min_sessions_per_week: 4,
      max_sessions_per_week: 5, updated_at: "2026-09-29", equipment: "private equipment detail" },
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
  assert.ok(!JSON.stringify(goals).includes("private"));
  assert.ok(!columns.get("running_coach_profiles").includes("training_limits"));
  assert.ok(!columns.get("strength_coach_profiles").includes("equipment"));
});

test("strength profile validates a flexible four to five session target", () => {
  const input = { primary_goal: "build_strength", goal_description: "Build strength cautiously during race training",
    min_sessions_per_week: 4, max_sessions_per_week: 5, available_days: [],
    preferred_session_minutes: null, equipment: null, training_limits: null };
  assert.deepEqual(validateStrengthProfile(input), input);
  assert.throws(() => validateStrengthProfile({ ...input, min_sessions_per_week: 6 }), /range/);
  assert.throws(() => validateStrengthProfile({ ...input, available_days: [1, 1] }), /distinct/);
});
