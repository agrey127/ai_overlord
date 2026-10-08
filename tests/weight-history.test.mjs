import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", compiled)(module, module.exports);
  return module.exports;
}

const { rangeStart, weightRanges } = load("../lib/weight-chart.ts");
const { fetchWeightHistory } = load("../lib/data/weight.ts");

test("calendar ranges clamp month ends and handle leap years", () => {
  assert.equal(rangeStart("2026-03-31", 1), "2026-02-28");
  assert.equal(rangeStart("2024-03-31", 1), "2024-02-29");
  assert.equal(rangeStart("2024-02-29", 12), "2023-02-28");
  assert.equal(rangeStart("2026-10-06", 6), "2026-04-06");
  assert.equal(rangeStart("2026-10-06", 3), "2026-07-06");
  assert.equal(rangeStart("2026-10-06", 0), null);
  assert.equal(weightRanges.length, 5);
});

test("all-time fetch pages past API limits, scopes user, and keeps numeric values", async () => {
  const calls = [];
  const client = { from(table) {
    const query = {
      select() { return query; },
      eq(field, user) { assert.equal(field, "user_id"); assert.equal(user, "test-user"); return query; },
      order() { return query; },
      range(start, end) { calls.push({ table, start, end }); query.start = start; return query; },
      returns() {
        const data = table === "body_weight_logs"
          ? Array.from({ length: query.start === 0 ? 500 : 1 }, (_, i) => ({ measured_at: new Date(Date.UTC(2020, 0, 1 + query.start + i)).toISOString(), weight_lbs: "200.5", source: "apple_health" }))
          : [{ day: "2020-01-01", weight_7d_avg: "200.5" }, { day: "2020-01-02", weight_7d_avg: null }];
        return Promise.resolve({ data, error: null });
      },
    };
    return query;
  } };
  const result = await fetchWeightHistory(client, "test-user");
  assert.equal(result.logs.length, 501);
  assert.ok(result.logs[0].measured_at > result.logs[500].measured_at);
  assert.equal(result.logs[0].weight_lbs, 200.5);
  assert.deepEqual(result.averages, [{ day: "2020-01-01", weight_7d_avg: 200.5 }]);
  assert.ok(calls.some((call) => call.table === "body_weight_logs" && call.start === 500));
});

test("query failures surface instead of showing empty history", async () => {
  const client = { from() {
    const query = { select() { return query; }, eq() { return query; }, order() { return query; }, range() { return query; }, returns() { return Promise.resolve({ data: null, error: { message: "denied" } }); } };
    return query;
  } };
  await assert.rejects(fetchWeightHistory(client, "test-user"), /denied/);
});
