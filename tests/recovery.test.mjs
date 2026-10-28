import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const output = ts.transpileModule(readFileSync(new URL("../lib/recovery.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function("exports", output)(loaded.exports);
const { dayOffset, recoveryStory } = loaded.exports;
test("recovery comparisons require three previous nights within seven days", () => {
  const row = { day: "2026-11-01", sleep_seconds: 28800 };
  const history = [{day:"2026-10-31",sleep_seconds:25200},{day:"2026-10-30",sleep_seconds:25200}];
  assert.match(recoveryStory(row, history).title, /taking shape/);
  history.push({day:"2026-10-29",sleep_seconds:25200});
  assert.match(recoveryStory(row, history).text, /60 minutes longer/);
  history.push({day:"2026-11-02",sleep_seconds:1},{day:"2026-10-01",sleep_seconds:1});
  assert.match(recoveryStory(row, history).text, /previous 3 recorded nights/);
});
test("missing sleep never becomes zero or a diagnosis", () => {
  assert.match(recoveryStory(undefined, []).title, /quiet day/);
  assert.match(recoveryStory({day:"2026-11-01",sleep_seconds:null}, [{day:"2026-10-31",sleep_seconds:25200}]).title, /taking shape/);
  assert.equal(dayOffset("2026-11-01", -1), "2026-10-31");
});
test("overnight HRV comparison is distinguished from Garmin weekly status", () => {
  const row = {day:"2026-11-01",hrv_overnight_ms:35,hrv_baseline_low_ms:40,hrv_baseline_high_ms:60,hrv_status:"BALANCED"};
  assert.match(recoveryStory(row, []).text, /outside.*weekly average/);
});
