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
  new Function("module", "exports", "require", compiled)(loaded, loaded.exports,
    (name) => dependencies[name] ?? {});
  return loaded.exports;
}

const { validateDelegationInput, executeDelegation } = loadTypeScript("lib/assistant/delegations.ts");
const { delegatedToolNames, readOnlySpecialistClient, sanitizeDelegatedToolResult } = loadTypeScript("lib/assistant/specialist-runner.ts", {
  "node:crypto": { createHash: () => ({ update() { return this; }, digest() { return "unused"; } }) },
  "openai": {}, "@/lib/assistant/domain-config": {}, "@/lib/assistant/tools": {},
});

test("delegation accepts only bounded specialist assignments", () => {
  assert.deepEqual(validateDelegationInput("running", "  Review this week  "),
    { domain: "running", objective: "Review this week" });
  assert.throws(() => validateDelegationInput("finance", "Review spending"), /Running, Strength, or Nutrition/);
  assert.throws(() => validateDelegationInput("strength", " "), /1 to 500/);
  assert.throws(() => validateDelegationInput("nutrition", "x".repeat(501)), /1 to 500/);
});

test("delegated specialists receive no record-changing tool", () => {
  const readNames = new Set([
    "get_shared_coaching_goals", "get_running_coach_context", "get_strength_coach_context",
    "get_nutrition_coach_context", "query_personal_totals", "get_next_workout",
    "list_workout_rotation", "get_rotation_workout", "list_workout_plans", "get_workout_plan",
    "get_strength_progress",
  ]);
  for (const domain of ["running", "strength", "nutrition"]) {
    assert.ok(delegatedToolNames(domain).length > 0);
    assert.ok(delegatedToolNames(domain).every((name) => readNames.has(name)));
  }
  const client = { from: () => ({ select() { return this; }, insert() {}, update() {}, upsert() {}, delete() {} }), rpc() {} };
  const safe = readOnlySpecialistClient(client);
  assert.doesNotThrow(() => safe.from("records").select("id"));
  for (const operation of ["insert", "update", "upsert", "delete"]) {
    assert.throws(() => safe.from("records")[operation]({}), /cannot write records/);
  }
  assert.throws(() => safe.rpc("mutate"), /cannot write records/);
});

test("delegated tool output omits private free text and weight entries", () => {
  assert.deepEqual(sanitizeDelegatedToolResult({
    profile: { target_date: "2026-11-21", training_limits: "private symptom" },
    runs: [{ distance_miles: 3, notes: "private note" }],
    recent_weight_logs: [{ weight_lbs: 180 }],
    plans: [{ focus: "Build consistency", sessions: [{ description: "private description" }] }],
  }), {
    profile: { target_date: "2026-11-21" },
    runs: [{ distance_miles: 3 }],
    plans: [{ focus: "Build consistency", sessions: [{}] }],
  });
});

test("a completed assignment is not run a second time", async () => {
  const task = { id: "task-1", chief_conversation_id: "chief-1", specialist_domain: "running",
    objective: "Review this week", status: "completed", result: "Review complete", started_at: null };
  const supabase = { from: () => ({
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: task, error: null }; },
  }) };
  let runs = 0;
  const result = await executeDelegation(supabase, "user-1", "chief-1", task.id, async () => { runs++; return "New result"; });
  assert.equal(result.result, "Review complete");
  assert.equal(runs, 0);
});

test("an assignment records failure, retries, and completes once", async () => {
  let task = { id: "task-2", user_id: "user-1", chief_conversation_id: "chief-1",
    specialist_domain: "nutrition", objective: "Review logged meals", status: "pending",
    result: null, error: null, started_at: null, completed_at: null };
  const supabase = { from: () => {
    const query = { filters: [], patch: null,
      select() { return this; },
      update(patch) { this.patch = patch; return this; },
      eq(field, value) { this.filters.push([field, value]); return this; },
      matches() { return this.filters.every(([field, value]) => task[field] === value); },
      async maybeSingle() {
        if (!this.matches()) return { data: null, error: null };
        if (this.patch) task = { ...task, ...this.patch };
        return { data: { ...task }, error: null };
      },
      async single() {
        const result = await this.maybeSingle();
        return result.data ? result : { data: null, error: { message: "No row" } };
      },
    };
    return query;
  } };
  const failed = await executeDelegation(supabase, "user-1", "chief-1", task.id,
    async () => { throw new Error("temporary model failure"); });
  assert.equal(failed.status, "failed");
  assert.match(failed.error, /Retry/);
  let runs = 0;
  const completed = await executeDelegation(supabase, "user-1", "chief-1", task.id,
    async (domain, objective) => { runs++; assert.equal(domain, "nutrition"); assert.equal(objective, "Review logged meals"); return "  Review complete  "; });
  assert.equal(completed.status, "completed");
  assert.equal(completed.result, "Review complete");
  await executeDelegation(supabase, "user-1", "chief-1", task.id, async () => { runs++; return "Duplicate"; });
  assert.equal(runs, 1);
});
