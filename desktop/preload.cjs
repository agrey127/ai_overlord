/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

function listen(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("baselineDesktop", {
  isDesktop: true,
  onFocusComposer: (callback) => listen("baseline:focus-composer", callback),
  onVoiceTargetChanged: (callback) => listen("baseline:voice-target-changed", callback),
  onStopSpeaking: (callback) => listen("baseline:stop-speaking", callback),
  onDictationStop: (callback) => listen("baseline:dictation-stop", callback),
  onVoiceError: (callback) => listen("baseline:voice-error", callback),
  composerReady: () => ipcRenderer.send("baseline:composer-ready"),
  focusFailed: (message) => ipcRenderer.send("baseline:focus-failed", message),
  assistantReady: () => ipcRenderer.send("baseline:assistant-ready"),
  dictationPasted: () => ipcRenderer.send("baseline:dictation-pasted"),
  replyStarted: () => ipcRenderer.send("baseline:reply-started"),
  replyFinished: () => ipcRenderer.send("baseline:reply-finished"),
  turnFailed: () => ipcRenderer.send("baseline:turn-failed"),
  setServerUrl: (url) => ipcRenderer.invoke("baseline:set-server-url", url),
  getServerUrl: () => ipcRenderer.invoke("baseline:get-server-url"),
  getVoiceTarget: () => ipcRenderer.invoke("baseline:get-voice-target"),
  setVoiceTarget: (domain) => ipcRenderer.invoke("baseline:set-voice-target", domain),
});
