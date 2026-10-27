import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(file, dependencies = {}, fetcher) {
  const source = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", "require", "fetch", source)(loaded, loaded.exports, (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, fetcher);
  return loaded.exports;
}
const activity = load("lib/garmin/activity.ts");
const health = load("lib/garmin/health.ts", { "./activity": activity, "./api": {} });

test("health maps only actual steps, overall sleep score and resting heart rate", () => {
  const days = ["2026-10-22", "2026-10-23"];
  const rows = health.normalizeHealth(days, [
    { calendarDate: days[0], totalSteps: 0, restingHeartRate: 55, minHeartRate: 40, displayName: "private" },
    { calendarDate: days[1], totalSteps: null, restingHeartRate: null, minHeartRate: 42, lastSevenDaysAvgRestingHeartRate: 58 },
  ], [
    { calendarDate: days[0], sleepTimeSeconds: 27000, sleepScores: { overall: { value: 0, qualifierKey: "POOR" } } },
    { calendarDate: null },
  ]);
  assert.deepEqual(rows[0], { day: days[0], steps: 0, resting_heart_rate: 55, sleep_score: 0 });
  assert.deepEqual(rows[1], { day: days[1], steps: null, resting_heart_rate: null, sleep_score: null });
  assert.ok(!JSON.stringify(rows).includes("private"));
});

test("invalid metrics and sleep placeholders never become fake readings", () => {
  const days = ["2026-10-23"];
  const row = health.normalizeHealth(days, [{ calendarDate: days[0], totalSteps: "500", restingHeartRate: 0 }],
    [{ calendarDate: days[0], sleepScores: { overall: { value: 80, qualifierKey: "INVALID" } } }])[0];
  assert.equal(row.steps, null); assert.equal(row.resting_heart_rate, null); assert.equal(row.sleep_score, null);
  assert.throws(() => health.normalizeHealth(days, [{ calendarDate: "2026-10-22" }], []), /date does not match/);
  assert.throws(() => health.normalizeHealth(days, [], []), /Incomplete/);
  assert.throws(() => health.normalizeHealth(days, [{ calendarDate: days[0] }], [{ calendarDate: null, sleepScores: { overall: { value: 70 } } }]), /no valid date/);
});

test("health refresh is hourly and uses the app's local calendar through DST", () => {
  assert.equal(health.healthDue(undefined, "2026-10-23T12:00:00Z"), true);
  assert.equal(health.healthDue("2026-10-23T11:30:00Z", "2026-10-23T12:00:00Z"), false);
  assert.equal(health.healthDue("2026-10-23T11:00:00Z", "2026-10-23T12:00:00Z"), true);
  assert.equal(health.healthDue("2027-10-23T11:00:00Z", "2026-10-23T12:00:00Z"), true);
  const days = health.healthDays("2026-11-01T03:30:00Z", "America/Indiana/Indianapolis");
  assert.equal(days.length, 8); assert.equal(days.at(-1), "2026-10-31"); assert.equal(days[0], "2026-10-24");
});

test("health sync protects manual/finalized/other sources and retains missing metrics", async () => {
  const now = "2026-10-23T15:00:00.000Z";
  const days = health.healthDays(now, "America/Indiana/Indianapolis");
  const raw = { summaries: days.map((calendarDate) => ({ calendarDate, totalSteps: 0 })), sleeps: [] };
  const healthModule = load("lib/garmin/health.ts", { "./activity": activity, "./api": { fetchDailyHealth: async () => raw } });
  const existing = days.slice(0, 4).map((day, i) => ({ day, source: ["manual_entry", "garmin_personal", "home_assistant", "garminconnect"][i],
    is_final: i === 1, updated_at: "previous-version", steps: 9000, sleep_score: 80, resting_heart_rate: 55 }));
  const updates = []; const inserted = []; const filters = [];
  const database = { from(table) {
    assert.equal(table, "fitness_daily");
    let mutation = false;
    const query = {
      update(payload) { updates.push(payload); mutation = true; return query; },
      insert: async (payload) => { inserted.push(payload); return { error: null }; },
      select() { return mutation ? Promise.resolve({ data: [{ day: "saved" }] }) : query; },
      eq(name, value) { filters.push([name, value]); return query; }, is(name, value) { filters.push([name, value]); return query; },
      gte() { return query; }, lte() { return Promise.resolve({ data: existing }); },
    }; return query;
  } };
  const result = await healthModule.synchronizeHealth(database, "owner", "key", now, "America/Indiana/Indianapolis");
  assert.equal(result.protected, 3); assert.equal(result.written, 5);
  assert.equal(updates.length, 1); assert.equal(updates[0].steps, 0);
  assert.ok(!("sleep_score" in updates[0])); assert.ok(!("resting_heart_rate" in updates[0]));
  assert.equal(existing[3].sleep_score, 80);
  assert.ok(filters.some(([name, value]) => name === "user_id" && value === "owner"));
  assert.ok(filters.some(([name, value]) => name === "updated_at" && value === "previous-version"));
  assert.ok(inserted.every((row) => row.user_id === "owner" && row.source === "garmin_personal"));
});

test("health sync skips empty days and insert races, and fails on database errors", async () => {
  const now = "2026-10-23T15:00:00.000Z";
  const days = health.healthDays(now, "UTC");
  const healthModule = load("lib/garmin/health.ts", { "./activity": activity, "./api": { fetchDailyHealth: async () => ({
    summaries: days.map((calendarDate, i) => ({ calendarDate, totalSteps: i ? null : 100 })), sleeps: [],
  }) } });
  for (const code of ["23505", "42501"]) {
    const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, lte: async () => ({ data: [] }), insert: async () => ({ error: { code } }) };
    const result = healthModule.synchronizeHealth({ from: () => q }, "owner", "key", now, "UTC");
    if (code === "23505") { const summary = await result; assert.equal(summary.conflicts, 1); assert.equal(summary.empty, 7); }
    else await assert.rejects(result, /Could not insert/);
  }
});

test("daily health API uses official endpoints and shares a single plain-text token", async () => {
  const requests = [];
  const client = load("lib/garmin/api.ts", {}, async (url, options) => {
    requests.push({ url, options });
    if (url.includes("personal-api-key/token")) return new Response("mock-token");
    if (url.includes("/hrv/daily/")) return Response.json({ hrvSummaries: [] });
    if (url.includes("dailySleepSummariesByDate")) return Response.json([]);
    return Response.json({ calendarDate: new URL(url).searchParams.get("calendarDate") });
  });
  const response = await client.fetchDailyHealth("mock-key", ["2026-10-22", "2026-10-23"]);
  assert.equal(response.summaries.length, 2);
  assert.equal(requests.filter((x) => x.options.method === "POST").length, 1);
  assert.equal(requests.filter((x) => x.options.headers.Authorization === "Bearer mock-token").length, 4);
});


test("recovery summaries project only valid daily metrics and explicit UTC windows", () => {
  const days = ["2026-10-26"];
  const result = health.normalizeRecovery(days,
    [{calendarDate:days[0],averageStressLevel:-1,bodyBatteryAtWakeTime:80,bodyBatteryLowestValue:0,privateKey:"hidden"}],
    [{calendarDate:days[0],sleepTimeSeconds:27000,sleepStartTimestampGMT:1792962000000,sleepEndTimestampGMT:1792989000000,awakeCount:2}],
    [{calendarDate:days[0],lastNightAvg:45,weeklyAvg:46,status:"BALANCED",baseline:{balancedLow:40,balancedUpper:60}}]).get(days[0]);
  assert.equal(result.sleep_seconds,27000); assert.equal(result.hrv_overnight_ms,45);
  assert.equal(result.hrv_baseline_low_ms,40); assert.equal(result.body_battery_low,0);
  assert.ok(result.sleep_start_at.endsWith("Z")); assert.equal(result.sleep_awake_count,2);
  assert.ok(!("stress_average" in result)); assert.ok(!("privateKey" in result));
  const missing = health.normalizeRecovery(days,[],[{calendarDate:days[0],sleepTimeSeconds:0,sleepStartTimestampGMT:"2026-10-26T01:00:00",sleepEndTimestampGMT:"2026-10-26T09:00:00"}],
    [{calendarDate:days[0],status:"INVALID",lastNightAvg:50}]).get(days[0]);
  assert.deepEqual(missing,{});
  assert.throws(()=>health.normalizeRecovery(days,[],[],[{calendarDate:days[0]},{calendarDate:days[0]}]), /Duplicate HRV/);
});
