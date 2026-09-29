import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib", "assistant", "running-coach.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function("module", "exports", "require", compiled)(loaded, loaded.exports, () => {
  throw new Error("Unexpected runtime dependency in validation module");
});
const { validateRunningProfile, validateRunningWeek } = loaded.exports;

test("running goal rejects unavailable long-run days and duplicate weekdays", () => {
  const base = {
    goal_type: "race", goal_description: "Half marathon", target_date: null,
    target_distance_miles: 13.1, target_time_minutes: null,
    available_days: [2, 4, 6], long_run_day: 6, max_runs_per_week: 3,
    weekly_mileage_target: null, training_limits: null,
  };
  assert.equal(validateRunningProfile(base).goal_description, "Half marathon");
  assert.throws(() => validateRunningProfile({ ...base, long_run_day: 7 }), /available running days/);
  assert.throws(() => validateRunningProfile({ ...base, available_days: [2, 2, 6] }), /distinct weekdays/);
});

test("weekly plan rejects dates outside the week and impossible rest mileage", () => {
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Indiana/Indianapolis", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(local.map((part) => [part.type, part.value]));
  const today = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const monday = today.toISOString().slice(0, 10);
  const nextMonday = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const base = {
    week_start: monday, focus: "Easy rebuild", rationale: "Recent runs support a light week.",
    sessions: [{ date: monday, kind: "easy", distance_miles: 3, effort: "easy", description: "Relaxed run" }],
  };
  assert.equal(validateRunningWeek(base).planned_miles, 3);
  assert.throws(() => validateRunningWeek({ ...base, sessions: [{ ...base.sessions[0], date: nextMonday }] }), /within the selected week/);
  assert.throws(() => validateRunningWeek({ ...base, sessions: [{ ...base.sessions[0], kind: "rest" }] }), /zero distance/);
});
