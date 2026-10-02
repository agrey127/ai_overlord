import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function desktopHarness() {
  const sent = [];
  const handlers = new Map();
  const app = {
    commandLine: { appendSwitch() {} },
    setAsDefaultProtocolClient() {},
    requestSingleInstanceLock: () => true,
    on() {},
    whenReady: () => ({ then() {} }),
  };
  const electron = { app, ipcMain: { on: (name, handler) => handlers.set(name, handler), handle() {} } };
  const targetWindow = {
    isDestroyed: () => false,
    isMinimized: () => false,
    show() {}, focus() {},
    webContents: {
      getURL: () => "http://baseline.test/baseline/assistant",
      send: (channel) => sent.push(channel),
    },
  };
  const context = vm.createContext({
    require: (name) => name === "electron" ? electron : { spawn() {} },
    process: { defaultApp: false, argv: [], platform: "win32" },
    __dirname: "desktop",
    URL,
    setTimeout: () => ({ unref() {} }),
    setInterval: () => ({ unref() {} }),
    clearTimeout() {}, clearInterval() {},
    targetWindow,
  });
  vm.runInContext(readFileSync(new URL("../desktop/main.cjs", import.meta.url), "utf8"), context);
  vm.runInContext("window = targetWindow; settings.serverUrl = 'http://baseline.test';", context);
  return { context, sent, handlers };
}

test("waking during speech stops audio and keeps the new turn active", () => {
  const { context, sent, handlers } = desktopHarness();
  vm.runInContext("voiceState = 'speaking'; handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.92}')", context);
  assert.equal(vm.runInContext("voiceState", context), "focusing");
  assert.deepEqual(sent, ["baseline:stop-speaking"]);
  handlers.get("baseline:reply-finished")();
  assert.equal(vm.runInContext("voiceState", context), "focusing");
});

test("stop command ends speech without starting dictation", () => {
  const { context, sent } = desktopHarness();
  vm.runInContext("voiceState = 'speaking'; handleBridgeLine('{\"type\":\"stop\",\"confidence\":0.8}')", context);
  assert.equal(vm.runInContext("voiceState", context), "idle");
  assert.deepEqual(sent, ["baseline:stop-speaking"]);
});

test("a second wake phrase stops dictation for sending", () => {
  const { context, sent } = desktopHarness();
  vm.runInContext("bridge = { killed: false, stdin: { writable: true, write() {} } }; voiceState = 'dictating'; handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.86}')", context);
  assert.equal(vm.runInContext("voiceState", context), "waiting-for-paste");
  assert.deepEqual(sent, ["baseline:dictation-stop"]);
});

test("balanced sensitivity rejects a weak start but accepts a clear one", () => {
  const { context } = desktopHarness();
  vm.runInContext("handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.79}')", context);
  assert.equal(vm.runInContext("voiceState", context), "idle");
  vm.runInContext("handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.84}')", context);
  assert.equal(vm.runInContext("voiceState", context), "focusing");
});

test("wake sensitivity can be tightened or relaxed", () => {
  const { context } = desktopHarness();
  vm.runInContext("settings.wakeSensitivity = 'strict'; handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.86}')", context);
  assert.equal(vm.runInContext("voiceState", context), "idle");
  vm.runInContext("settings.wakeSensitivity = 'relaxed'; handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.75}')", context);
  assert.equal(vm.runInContext("voiceState", context), "focusing");
});

test("speaking needs a clearer wake phrase and duplicate wakes cannot end dictation", () => {
  const { context, sent } = desktopHarness();
  vm.runInContext("voiceState = 'speaking'; handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.85}')", context);
  assert.equal(vm.runInContext("voiceState", context), "speaking");
  vm.runInContext("handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.91}')", context);
  assert.equal(vm.runInContext("voiceState", context), "focusing");
  vm.runInContext("voiceState = 'dictating'; handleBridgeLine('{\"type\":\"wake\",\"confidence\":0.95}')", context);
  assert.equal(vm.runInContext("voiceState", context), "dictating");
  assert.deepEqual(sent, ["baseline:stop-speaking"]);
});
