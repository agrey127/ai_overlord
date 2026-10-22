import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(file, dependencies = {}, fetcher = undefined) {
  const compiled = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", "require", "fetch", compiled)(loaded, loaded.exports, (name) => {
    if (name === "server-only") return {};
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, fetcher);
  return loaded.exports;
}

const activity = load("lib/garmin/activity.ts");
const sample = {
  activityId: 1234, activityType: { typeKey: "running", typeId: 1, parentTypeId: 17 },
  startTimeLocal: "2026-10-21 23:45:00", startTimeGMT: "2026-10-22 03:45:00",
  duration: 1800, distance: 4828.032, averageSpeed: 2.68224,
  averageHR: 145.4, averageRunningCadenceInStepsPerMinute: 172.2, calories: 310,
  description: "untrusted text", access_token: "must never escape",
};

test("Garmin units, local calendar date and safe field projection", () => {
  const run = activity.normalizeRun(sample);
  assert.equal(run.activity_date, "2026-10-21");
  assert.equal(run.duration_minutes, 30);
  assert.ok(Math.abs(run.distance_miles - 3) < 0.000001);
  assert.ok(Math.abs(run.pace_min_per_mile - 10) < 0.000001);
  assert.equal(run.cadence, 172);
  assert.equal(run.average_heart_rate, 145);
  assert.equal(run.source_fingerprint, "garmin_personal:1234");
  assert.ok(!JSON.stringify(run).includes("must never escape"));
  assert.ok(!JSON.stringify(run).includes("untrusted text"));
});

test("invalid metrics stay null and incomplete or non-running activities cannot import", () => {
  const run = activity.normalizeRun({ ...sample, calories: null, averageHR: "145", distance: -1, averageSpeed: 0 });
  assert.equal(run.calories_burned, null);
  assert.equal(run.average_heart_rate, null);
  assert.equal(run.distance_miles, null);
  assert.equal(run.pace_min_per_mile, null);
  for (const changes of [{ activityId: 1.2 }, { activityId: Number.MAX_SAFE_INTEGER + 1 },
    { startTimeLocal: "2026-02-30 12:00:00" }, { duration: 0 }, { duration: NaN },
    { activityType: { typeKey: "cycling", parentTypeId: 17 } }]) {
    assert.equal(activity.normalizeRun({ ...sample, ...changes }), null);
  }
  assert.ok(activity.normalizeRun({ ...sample, activityType: { typeKey: "trail_running", parentTypeId: 1 } }));
});

test("stable Garmin IDs and screenshot matches prevent double-counting", () => {
  const run = activity.normalizeRun(sample);
  assert.equal(activity.duplicateReason(run, [run]), "imported");
  assert.equal(activity.duplicateReason(run, [{ ...run, source: "garmin_screenshot", source_fingerprint: "hash", duration_minutes: 30.3, distance_miles: 3.01 }]), "possible_match");
  assert.equal(activity.duplicateReason(run, [{ ...run, source: "manual", source_fingerprint: null, duration_minutes: 60 }]), null);
  assert.equal(activity.duplicateReason(run, [{ ...run, source_fingerprint: "garmin_personal:999" }]), null);
});

test("official token exchange, token caching and complete pagination", async () => {
  const calls = [];
  const client = load("lib/garmin/client.ts", {}, async (url, options) => {
    calls.push({ url, options });
    if (url.includes("personal-api-key/token")) {
      assert.equal(options.headers.Accept, "text/plain");
      return new Response("mock-bearer", { headers: { "Content-Type": "text/plain" } });
    }
    return Response.json(new URL(url).searchParams.get("start") === "0" ? Array(100).fill(sample) : [sample]);
  });
  assert.equal((await client.fetchRuns("mock-key", "2026-10-01", "2026-10-22")).length, 101);
  await client.fetchRuns("mock-key", "2026-10-01", "2026-10-22");
  assert.equal(calls.filter((c) => c.options.method === "POST").length, 1);
  assert.equal(calls[0].options.headers.Authorization, "ApiKey mock-key");
  assert.equal(calls[1].options.headers.Authorization, "Bearer mock-bearer");
  assert.equal(calls[1].options.redirect, "error");
  assert.equal(new URL(calls[1].url).searchParams.get("activityType"), "running");
});

test("Garmin response bodies and network errors never leak secrets", async () => {
  for (const status of [401, 403, 429, 500]) {
    const client = load("lib/garmin/client.ts", {}, async () => new Response("secret response", { status }));
    await assert.rejects(client.fetchRuns("secret-key", "2026-10-01", "2026-10-22"), (error) => {
      assert.ok(!error.message.includes("secret")); return true;
    });
  }
  const client = load("lib/garmin/client.ts", {}, async () => { throw new Error("secret-key"); });
  await assert.rejects(client.fetchRuns("secret-key", "2026-10-01", "2026-10-22"), /unavailable/);
});

test("too many activities or an invalid payload fails instead of silently truncating", async () => {
  for (const page of [Array(100).fill(sample), { unexpected: true }]) {
    const client = load("lib/garmin/client.ts", {}, async (url) =>
      url.includes("personal-api-key/token") ? new Response("mock") : Response.json(page));
    await assert.rejects(client.fetchRuns("mock-key", "2026-10-01", "2026-10-22"));
  }
});

test("token exchange rejects unexpected JSON and empty plain-text responses", async () => {
  for (const body of [JSON.stringify({ access_token: "unexpected-json" }), "", "contains whitespace"]){
    const client = load("lib/garmin/client.ts", {}, async () => new Response(body));
    await assert.rejects(client.fetchRuns("mock-key", "2026-10-01", "2026-10-22"), /unexpected response/);
  }
});

test("wrong Baseline account cannot call Garmin or read personal activities", async () => {
  const previous = { key: process.env.GARMIN_PERSONAL_API_KEY, owner: process.env.GARMIN_PERSONAL_USER_ID };
  process.env.GARMIN_PERSONAL_API_KEY = "mock-key";
  process.env.GARMIN_PERSONAL_USER_ID = "owner@example.test";
  const importer = load("lib/garmin/import.ts", {
    "@/lib/supabase/server": { createServerSupabase: async () => ({}), requireUser: async () => ({ email: "other@example.test" }) },
    "./client": { fetchRuns: () => { throw new Error("must not call Garmin"); } },
    "./activity": activity,
  });
  try { await assert.rejects(importer.loadGarminRuns("2026-10-01", "2026-10-22"), /not configured for this account/); }
  finally {
    for (const [name, value] of [["GARMIN_PERSONAL_API_KEY", previous.key], ["GARMIN_PERSONAL_USER_ID", previous.owner]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("import rechecks duplicates and reports partial saves safely for retry", async () => {
  const run = activity.normalizeRun(sample);
  const inserted = [];
  const actions = load("app/baseline/more/garmin/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/garmin/import": { loadGarminRuns: async () => ({
      userId: "owner@example.test", runs: [
        { ...run, duplicate: "possible_match" },
        { ...run, source_fingerprint: "garmin_personal:2", duplicate: null },
        { ...run, source_fingerprint: "garmin_personal:3", duplicate: null },
        { ...run, source_fingerprint: "garmin_personal:4", duplicate: null },
      ], supabase: { from: () => ({ insert: async (row) => {
        inserted.push(row);
        return { error: inserted.length === 2 ? { code: "23505" } : inserted.length === 3 ? { code: "42501" } : null };
      } }) },
    }) },
  });
  const result = await actions.importGarminRuns("2026-10-01", "2026-10-22", [run.source_fingerprint, "garmin_personal:2", "garmin_personal:3", "garmin_personal:4"]);
  assert.equal(result.imported, 1);
  assert.equal(result.duplicates, 2);
  assert.match(result.error, /could not save/);
  assert.ok(inserted.every((row) => row.user_id === "owner@example.test" && !("duplicate" in row)));
});
