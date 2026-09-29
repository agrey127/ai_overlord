# Baseline for Windows

The Windows companion opens the existing Baseline web app in its own window and keeps a local wake listener in the system tray. The three chat domains and their server-side routing stay in the web app. The companion does not store an OpenAI key.

## Build

Use Node.js 22.12 or newer.

```powershell
npm ci --prefix desktop
npm run dist --prefix desktop
```

The installer is written to `desktop/dist`. Run it on the Windows computer that has Wispr Flow installed.

## First run

1. Enter the root address used to reach Baseline over Tailscale. On this installation it is `http://aioverlord.joshwrobinson.com`, which resolves to the private Caddy Tailscale address.
2. Sign in with the existing email flow. Open the link in your usual browser and allow Windows to open Baseline when prompted. The `baseline-desktop://auth/callback` link returns the one-time code to the desktop app, which holds the PKCE verifier. **Sign in with copied link (fallback)** remains in the tray menu for a link already sent by an older app version.
3. In Wispr Flow, confirm its hands-free toggle shortcut is **Ctrl+Win+Space**. Keep Wispr Flow running and allow Windows microphone access.
4. Open the desired Baseline chat. Say **Hello Baseline**. After Baseline says “Ready,” dictate normally. Say **send it** to stop Wispr dictation, submit the text, and hear the reply. Say **cancel Baseline** while dictating to cancel.

The tray menu can disable the wake listener, which stops its microphone process, change the server address, or turn off Windows startup. **Ctrl+Alt+B** opens Baseline without using the wake word.

## How it works

`wake-bridge.ps1` uses the local Windows speech recognizer for the three short commands. It sends only command events to Electron. Wispr Flow handles full dictation and inserts text into the focused chat composer. The existing authenticated assistant route handles the message. The new authenticated `/api/assistant/speech` route reads the saved assistant message and uses the server's existing `OPENAI_API_KEY` for speech output. Audio is returned to the desktop window for playback and is not saved by the companion.

The configured Baseline URL and tray preferences are stored in Electron's per-user settings directory. Session cookies stay in Electron's browser profile. No API key is packaged or written to desktop settings.

Verified on 2026-09-29: the production Next.js build, TypeScript check, assistant tests, Windows installer build, packaged app launch, and local wake listener startup succeeded. The installed app opened its setup screen with no wake listener before configuration. A live spoken turn requires the web changes to be deployed and a signed-in session in the companion.

## Current limits

- The local speech recognizer and Wispr Flow must both be able to use the microphone. Check Windows microphone permissions if the listener reports an error.
- Command recognition confidence and Wispr's text insertion delay depend on the local audio setup. The application waits up to 15 seconds after **send it** for Wispr to insert text.
- The installer is unsigned, so Windows may display a publisher warning until a signing certificate is configured.
- Changes to the web app, including the speech route and desktop event hooks, must be deployed to the Baseline server before a packaged companion can use voice turns.
