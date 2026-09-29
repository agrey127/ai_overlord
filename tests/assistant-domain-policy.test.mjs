import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadTypeScript(path, dependencies = {}) {
  const source = readFileSync(join(root, path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", "require", compiled)(
    loaded, loaded.exports,
    (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected test dependency: ${name}`);
      return dependencies[name];
    },
  );
  return loaded.exports;
}

const policy = loadTypeScript(join("lib", "assistant", "domain-policy.ts"));
const { assertDomainToolCall, domainToolNames } = policy;
const tools = loadTypeScript(join("lib", "assistant", "tools.ts"), {
  "@/lib/assistant/domain-policy": policy,
  "@/lib/assistant/personal-totals": {},
  "@/lib/assistant/repository": {},
  "@/lib/assistant/staff-brief": {},
  "@/lib/assistant/running-coach": {},
  "@/lib/assistant/coaching-goals": {},
  "@/lib/assistant/strength-coach": {},
  "@/lib/assistant/nutrition-coach": {},
});
const promptModules = Object.fromEntries(
  ["core", "general", "nutrition", "running", "strength", "chief-of-staff"].map((name) => [
    `@/lib/assistant/prompts/${name}`,
    loadTypeScript(join("lib", "assistant", "prompts", `${name}.ts`)),
  ]),
);
const { getAssistantDomainConfig } = loadTypeScript(join("lib", "assistant", "domain-config.ts"), {
  "@/lib/assistant/tools": tools,
  "@/lib/assistant/domain-policy": policy,
  ...promptModules,
});

test("the model receives only the selected chat's tools and scoped schemas", () => {
  const running = getAssistantDomainConfig("running");
  const nutrition = getAssistantDomainConfig("nutrition");
  const strength = getAssistantDomainConfig("strength");
  const general = getAssistantDomainConfig("general");
  const chief = getAssistantDomainConfig("chief_of_staff");
  assert.deepEqual(running.tools.map((tool) => tool.name).sort(), [...domainToolNames.running].sort());
  assert.deepEqual(nutrition.tools.map((tool) => tool.name).sort(), [...domainToolNames.nutrition].sort());
  assert.deepEqual(strength.tools.map((tool) => tool.name).sort(), [...domainToolNames.strength].sort());
  assert.deepEqual(general.tools.map((tool) => tool.name).sort(), [...domainToolNames.general].sort());
  assert.deepEqual(chief.tools.map((tool) => tool.name).sort(), ["get_chief_of_staff_brief", "get_shared_coaching_goals"].sort());
  assert.deepEqual(running.tools.find((tool) => tool.name === "query_personal_totals").parameters.properties.dataset.enum, ["runs"]);
  assert.deepEqual(nutrition.tools.find((tool) => tool.name === "query_personal_totals").parameters.properties.dataset.enum, ["meal_logs"]);
  assert.deepEqual(running.tools.find((tool) => tool.name === "prepare_activity_import").parameters.properties.activity_type.enum, ["run"]);
  assert.equal(getAssistantDomainConfig("finance"), null);
});

test("specialist tool catalogs are distinct", () => {
  assert.deepEqual(domainToolNames.running, [
    "get_shared_coaching_goals",
    "query_personal_totals", "prepare_activity_import", "confirm_activity_import",
    "get_running_coach_context", "prepare_running_coach_profile",
    "prepare_running_week", "confirm_running_coach_change",
  ]);
  assert.deepEqual(domainToolNames.nutrition, [
    "get_shared_coaching_goals", "get_nutrition_coach_context", "prepare_nutrition_coach_profile", "confirm_nutrition_coach_profile",
    "query_personal_totals", "list_saved_meals", "log_saved_meal",
    "prepare_estimated_meal", "confirm_estimated_meal",
  ]);
  assert.ok(domainToolNames.strength.includes("log_set"));
  assert.ok(domainToolNames.strength.includes("get_strength_coach_context"));
  assert.ok(domainToolNames.strength.includes("prepare_strength_coach_profile"));
  assert.ok(!domainToolNames.strength.includes("log_saved_meal"));
  assert.ok(!domainToolNames.general.includes("complete_workout"));
  assert.ok(!domainToolNames.chief_of_staff.includes("log_set"));
});

test("cross-domain writes are rejected before dispatch", () => {
  assert.throws(() => assertDomainToolCall("running", "log_set", {}), /not available/);
  assert.throws(() => assertDomainToolCall("nutrition", "complete_workout", {}), /not available/);
  assert.throws(() => assertDomainToolCall("strength", "log_saved_meal", {}), /not available/);
  assert.throws(() => assertDomainToolCall("general", "prepare_estimated_meal", {}), /not available/);
  assert.throws(() => assertDomainToolCall("chief_of_staff", "log_set", {}), /not available/);
  assert.throws(() => assertDomainToolCall("chief_of_staff", "query_personal_totals", { dataset: "runs" }), /not available/);
  assert.throws(() => assertDomainToolCall("chief_of_staff", "get_running_coach_context", {}), /not available/);
  assert.throws(() => assertDomainToolCall("nutrition", "prepare_running_week", {}), /not available/);
  assert.throws(() => assertDomainToolCall("running", "prepare_strength_coach_profile", {}), /not available/);
  assert.throws(() => assertDomainToolCall("nutrition", "confirm_strength_coach_profile", {}), /not available/);
  assert.throws(() => assertDomainToolCall("running", "confirm_nutrition_coach_profile", {}), /not available/);
});

test("totals are restricted to the chat's dataset", () => {
  assert.doesNotThrow(() => assertDomainToolCall("running", "query_personal_totals", { dataset: "runs" }));
  assert.throws(() => assertDomainToolCall("running", "query_personal_totals", { dataset: "meal_logs" }), /running totals only/);
  assert.doesNotThrow(() => assertDomainToolCall("nutrition", "query_personal_totals", { dataset: "meal_logs" }));
  assert.throws(() => assertDomainToolCall("nutrition", "query_personal_totals", { dataset: "activities" }), /meal-log totals only/);
});

test("running import accepts runs only", () => {
  assert.doesNotThrow(() => assertDomainToolCall("running", "prepare_activity_import", { activity_type: "run" }));
  assert.throws(() => assertDomainToolCall("running", "prepare_activity_import", { activity_type: "bike" }), /import runs only/);
  assert.throws(() => assertDomainToolCall("nutrition", "prepare_activity_import", { activity_type: "run" }), /not available/);
});

test("a pending draft cannot be confirmed from another thread", async () => {
  const supabase = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      async maybeSingle() {
        return { data: { conversation_id: "original-thread", payload: { activity_type: "run" } }, error: null };
      },
    }),
  };
  await assert.rejects(
    tools.runAssistantTool(supabase, "user-1", "confirm_activity_import", '{"draft_id":"draft-1"}', {
      conversationId: "other-thread", domain: "running",
    }),
    /different conversation/,
  );
  await assert.rejects(
    tools.runAssistantTool(supabase, "user-1", "confirm_estimated_meal", '{"draft_id":"draft-1"}', {
      conversationId: "other-thread", domain: "nutrition",
    }),
    /different conversation/,
  );
  await assert.rejects(
    tools.runAssistantTool(supabase, "user-1", "confirm_running_coach_change", '{"draft_id":"draft-1"}', {
      conversationId: "other-thread", domain: "running",
    }),
    /different conversation/,
  );
  await assert.rejects(
    tools.runAssistantTool(supabase, "user-1", "confirm_strength_coach_profile", '{"draft_id":"draft-1"}', {
      conversationId: "other-thread", domain: "strength",
    }),
    /different conversation/,
  );
  await assert.rejects(
    tools.runAssistantTool(supabase, "user-1", "confirm_nutrition_coach_profile", '{"draft_id":"draft-1"}', {
      conversationId: "other-thread", domain: "nutrition",
    }),
    /different conversation/,
  );
});
