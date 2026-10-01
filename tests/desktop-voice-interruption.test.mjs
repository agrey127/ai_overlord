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
  vm.runInContext("voiceState = 'speaking'; handleBridgeLine('{\"type\":\"wake\"}')", context);
  assert.equal(vm.runInContext("voiceState", context), "focusing");
  assert.deepEqual(sent, ["baseline:stop-speaking"]);
  handlers.get("baseline:reply-finished")();
  assert.equal(vm.runInContext("voiceState", context), "focusing");
});

test("stop command ends speech without starting dictation", () => {
  const { context, sent } = desktopHarness();
  vm.runInContext("voiceState = 'speaking'; handleBridgeLine('{\"type\":\"stop\"}')", context);
  assert.equal(vm.runInContext("voiceState", context), "idle");
  assert.deepEqual(sent, ["baseline:stop-speaking"]);
});
