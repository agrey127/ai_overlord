/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Menu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ASSISTANT_PATH = "/baseline/assistant";
const AUTH_PROTOCOL = "baseline-desktop:";
const OPEN_SHORTCUT = "Control+Alt+B";
const CONFIG_NAME = "desktop-settings.json";
const VOICE_CHATS = [
  { domain: "chief_of_staff", label: "Chief of Staff" },
  { domain: "general", label: "General" },
  { domain: "strength", label: "Strength" },
  { domain: "running", label: "Running" },
  { domain: "nutrition", label: "Nutrition" },
];
const DEFAULT_SETTINGS = { serverUrl: "", wakeEnabled: true, launchAtLogin: true, voiceTarget: "chief_of_staff" };
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let window;
let tray;
let bridge;
let bridgeBuffer = "";
let voiceState = "idle";
let focusTimer;
let pasteTimer;
let settings = { ...DEFAULT_SETTINGS };
let allowedAuthOrigin = null;
let quitting = false;

function configPath() { return path.join(app.getPath("userData"), CONFIG_NAME); }

function loadSettings() {
  try { settings = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(configPath(), "utf8")) }; }
  catch { settings = { ...DEFAULT_SETTINGS }; }
  if (!VOICE_CHATS.some((chat) => chat.domain === settings.voiceTarget)) settings.voiceTarget = DEFAULT_SETTINGS.voiceTarget;
}

function saveSettings() {
  const target = configPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

function normalizeServerUrl(value) {
  const url = new URL(String(value).trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Enter the root HTTP or HTTPS address of your Baseline server.");
  }
  if (url.protocol === "http:") {
    const host = url.hostname.toLowerCase();
    const privateHost = host === "localhost" || host === "127.0.0.1" || host.endsWith(".ts.net")
      || host === "aioverlord.joshwrobinson.com" // This host resolves to the Tailscale Caddy address.
      || /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)
      || !host.includes(".");
    if (!privateHost) throw new Error("Use HTTPS for an address outside your private network.");
  }
  return url.origin;
}

function currentOrigin() {
  try { return new URL(settings.serverUrl).origin; } catch { return null; }
}

function send(channel, payload) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
}

function resetVoice(error) {
  clearInterval(focusTimer);
  clearTimeout(pasteTimer);
  voiceState = "idle";
  if (error) send("baseline:voice-error", error);
  updateTray();
}

function bridgeCommand(command) {
  if (!bridge || bridge.killed || !bridge.stdin.writable) return false;
  bridge.stdin.write(`${command}\n`);
  return true;
}

function focusComposer() {
  if (voiceState === "focusing") send("baseline:focus-composer", settings.voiceTarget);
}

function beginVoiceTurn() {
  if (voiceState !== "idle" || !settings.serverUrl) return;
  voiceState = "focusing";
  showAssistant();
  focusTimer = setInterval(focusComposer, 500);
  focusTimer.unref?.();
  setTimeout(() => {
    if (voiceState === "focusing") resetVoice("Baseline could not focus a signed-in chat. Sign in or choose a chat first.");
  }, 20000).unref?.();
  updateTray();
}

function handleBridgeLine(line) {
  let event;
  try { event = JSON.parse(line); } catch { return; }
  if (event.type === "ready") return;
  if (event.type === "error") {
    resetVoice(`Wake listener: ${event.message || "microphone unavailable"}`);
    return;
  }
  if (!settings.wakeEnabled) return;
  if (event.type === "wake" && voiceState === "idle") beginVoiceTurn();
  if (event.type === "send" && voiceState === "dictating") {
    voiceState = "waiting-for-paste";
    send("baseline:dictation-stop");
    if (!bridgeCommand("TOGGLE")) return resetVoice("Could not stop Wispr dictation.");
    pasteTimer = setTimeout(() => resetVoice("Wispr did not insert text. You can send the draft manually."), 15000);
    updateTray();
  }
  if (event.type === "cancel" && voiceState === "dictating") {
    bridgeCommand("CANCEL");
    resetVoice();
  }
}

function startWakeBridge() {
  if (process.platform !== "win32" || bridge || !settings.wakeEnabled || !settings.serverUrl) return;
  bridgeBuffer = "";
  const root = app.isPackaged ? __dirname.replace(/app\.asar$/, "app.asar.unpacked") : __dirname;
  const script = path.join(root, "wake-bridge.ps1");
  const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
    windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  });
  bridge = child;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    bridgeBuffer += chunk;
    let end;
    while ((end = bridgeBuffer.indexOf("\n")) !== -1) {
      const line = bridgeBuffer.slice(0, end).trim();
      bridgeBuffer = bridgeBuffer.slice(end + 1);
      handleBridgeLine(line);
    }
  });
  child.stderr.on("data", (chunk) => { console.error("Wake bridge:", String(chunk).trim()); });
  child.on("error", () => {
    if (bridge !== child) return;
    bridge = null;
    resetVoice("The Windows wake listener could not start.");
  });
  child.on("exit", () => {
    if (bridge !== child) return;
    bridge = null;
    if (!quitting) resetVoice("The Windows wake listener stopped.");
  });
}

function stopWakeBridge() {
  if (!bridge) return;
  const child = bridge;
  bridge = null;
  if (!child.killed && child.stdin.writable) child.stdin.write("QUIT\n");
  child.stdin.end();
}

function assistantUrl() { return `${settings.serverUrl}${ASSISTANT_PATH}`; }

function showAssistant() {
  if (!window || window.isDestroyed()) createWindow();
  if (!settings.serverUrl) return showSetup();
  const target = assistantUrl();
  const current = window.webContents.getURL();
  if (!current.startsWith(target)) void window.loadURL(target);
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  if (current.startsWith(target)) setTimeout(focusComposer, 250);
}

function showSetup() {
  if (!window || window.isDestroyed()) createWindow();
  window.show();
  window.focus();
  void window.loadFile(path.join(__dirname, "setup.html"));
}

function authCallbackUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== AUTH_PROTOCOL || url.hostname !== "auth" || url.pathname !== "/callback"
      || url.username || url.password || url.port) return null;
    return url;
  } catch { return null; }
}

function handleAuthCallback(value) {
  const callback = authCallbackUrl(value);
  if (!callback) return false;
  if (!settings.serverUrl) { showSetup(); return true; }
  if (!window || window.isDestroyed()) createWindow();
  const code = callback.searchParams.get("code");
  const target = new URL(code && code.length <= 2048 ? assistantUrl() : `${settings.serverUrl}/login`);
  if (code && code.length <= 2048) target.searchParams.set("code", code);
  else target.searchParams.set("error", "link");
  void window.loadURL(target.href);
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  return true;
}

function commandLineAuthCallback(argv) {
  return argv.map(authCallbackUrl).find(Boolean)?.href ?? null;
}

function useCopiedSignInLink() {
  if (!settings.serverUrl) return showSetup();
  const copied = clipboard.readText().trim();
  let url;
  try { url = new URL(copied); } catch { return dialog.showErrorBox("Sign-in link", "Copy the full link from your Baseline sign-in email first."); }
  const origin = currentOrigin();
  const sameApp = url.origin === origin && url.pathname.startsWith(ASSISTANT_PATH);
  let redirectOrigin = null;
  try { redirectOrigin = new URL(url.searchParams.get("redirect_to") || "").origin; } catch { /* no redirect */ }
  const supabaseVerify = url.protocol === "https:" && url.hostname.endsWith(".supabase.co")
    && url.pathname.startsWith("/auth/v1/verify")
    && (redirectOrigin === origin || authCallbackUrl(url.searchParams.get("redirect_to")));
  if (!sameApp && !supabaseVerify) {
    return dialog.showErrorBox("Sign-in link", "That link does not point back to this Baseline server.");
  }
  allowedAuthOrigin = supabaseVerify ? url.origin : null;
  if (!window || window.isDestroyed()) createWindow();
  window.show();
  void window.loadURL(url.href);
}

function updateTray() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: "Open Baseline", click: showAssistant },
    { label: "Sign in with copied link (fallback)", click: useCopiedSignInLink },
    { type: "separator" },
    { label: "Voice chat", submenu: VOICE_CHATS.map((chat) => ({
      label: chat.label, type: "radio", checked: settings.voiceTarget === chat.domain, enabled: voiceState === "idle",
      click: () => setVoiceTarget(chat.domain),
    })) },
    { label: "Wake word: Hello Baseline", type: "checkbox", checked: settings.wakeEnabled, click: (item) => {
      settings.wakeEnabled = item.checked;
      saveSettings();
      if (item.checked) startWakeBridge();
      else {
        if (voiceState === "dictating" || voiceState === "waiting-for-paste") bridgeCommand("CANCEL");
        resetVoice();
        stopWakeBridge();
      }
      updateTray();
    } },
    { label: "Start with Windows", type: "checkbox", checked: settings.launchAtLogin, click: (item) => {
      settings.launchAtLogin = item.checked; app.setLoginItemSettings({ openAtLogin: item.checked }); saveSettings(); updateTray();
    } },
    { label: `Voice status: ${voiceState}`, enabled: false },
    { label: `Open shortcut: ${OPEN_SHORTCUT}`, enabled: false },
    { type: "separator" },
    { label: "Change server address", click: showSetup },
    { label: "Quit Baseline", click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  const chatLabel = VOICE_CHATS.find((chat) => chat.domain === settings.voiceTarget)?.label ?? "Chief of Staff";
  tray.setToolTip(settings.wakeEnabled ? `Baseline · ${chatLabel} · ${voiceState}` : "Baseline · wake word off");
}

function setVoiceTarget(domain) {
  if (!VOICE_CHATS.some((chat) => chat.domain === domain)) return { ok: false, error: "Choose a Baseline chat." };
  if (voiceState !== "idle") return { ok: false, error: "Finish the current voice turn before switching chats." };
  settings.voiceTarget = domain;
  saveSettings();
  send("baseline:voice-target-changed", domain);
  updateTray();
  return { ok: true };
}

function createWindow() {
  window = new BrowserWindow({
    width: 1240, height: 850, minWidth: 760, minHeight: 540,
    show: false, title: "Baseline", icon: path.join(__dirname, "assets", "baseline.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
    },
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, destination) => {
    if (authCallbackUrl(destination)) { event.preventDefault(); handleAuthCallback(destination); return; }
    const next = new URL(destination);
    if (next.protocol === "file:" && !settings.serverUrl) return;
    if (next.origin === currentOrigin()) { allowedAuthOrigin = null; return; }
    if (next.origin === allowedAuthOrigin && next.pathname.startsWith("/auth/v1/verify")) return;
    event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, destination) => {
    if (authCallbackUrl(destination)) { event.preventDefault(); handleAuthCallback(destination); }
  });
  window.on("close", (event) => { if (!quitting) { event.preventDefault(); window.hide(); } });
  window.on("closed", () => { window = null; });
  return window;
}

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("baseline-desktop", process.execPath, [path.resolve(process.argv[1])]);
} else app.setAsDefaultProtocolClient("baseline-desktop");

if (!app.requestSingleInstanceLock()) app.quit();
else app.on("second-instance", (_event, argv) => {
  const callback = commandLineAuthCallback(argv);
  if (!callback || !handleAuthCallback(callback)) showAssistant();
});

app.whenReady().then(() => {
  loadSettings();
  app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
  createWindow();
  const icon = nativeImage.createFromPath(path.join(__dirname, "assets", "baseline.png"));
  tray = new Tray(icon);
  tray.on("double-click", showAssistant);
  updateTray();
  globalShortcut.register(OPEN_SHORTCUT, showAssistant);
  startWakeBridge();
  const callback = commandLineAuthCallback(process.argv);
  if (!callback || !handleAuthCallback(callback)) {
    if (settings.serverUrl) showAssistant(); else showSetup();
  }
});

ipcMain.handle("baseline:get-server-url", () => settings.serverUrl);
ipcMain.handle("baseline:get-voice-target", () => settings.voiceTarget);
ipcMain.handle("baseline:set-voice-target", (event, domain) => {
  if (!window || event.sender !== window.webContents || event.sender.getURL().startsWith("file:")) {
    return { ok: false, error: "Open a signed-in Baseline chat to change the voice target." };
  }
  return setVoiceTarget(domain);
});
ipcMain.handle("baseline:set-server-url", (_event, value) => {
  try {
    if (!window || _event.sender !== window.webContents || !_event.sender.getURL().startsWith("file:")) {
      throw new Error("Open the Baseline setup screen to change the server address.");
    }
    settings.serverUrl = normalizeServerUrl(value);
    saveSettings(); startWakeBridge(); updateTray(); showAssistant();
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.on("baseline:assistant-ready", focusComposer);
ipcMain.on("baseline:composer-ready", (event) => {
  if (!window || event.sender !== window.webContents) return;
  if (voiceState !== "focusing") return;
  clearInterval(focusTimer);
  voiceState = "dictating";
  if (!bridgeCommand("ACK_AND_TOGGLE")) resetVoice("Could not start Wispr dictation.");
  updateTray();
});
ipcMain.on("baseline:focus-failed", (event, message) => {
  if (window && event.sender === window.webContents && voiceState === "focusing") {
    resetVoice(typeof message === "string" ? message.slice(0, 240) : "Could not open the selected voice chat.");
  }
});
ipcMain.on("baseline:dictation-pasted", () => {
  if (voiceState === "waiting-for-paste") { clearTimeout(pasteTimer); voiceState = "thinking"; updateTray(); }
});
ipcMain.on("baseline:reply-started", () => {
  if (voiceState === "thinking") { voiceState = "speaking"; updateTray(); }
});
ipcMain.on("baseline:reply-finished", () => resetVoice());
ipcMain.on("baseline:turn-failed", () => resetVoice());
app.on("before-quit", () => { quitting = true; stopWakeBridge(); });
app.on("will-quit", () => globalShortcut.unregisterAll());
