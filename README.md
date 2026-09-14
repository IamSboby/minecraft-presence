# Minecraft Presence for Windows

A local Windows app that detects Minecraft Java and Bedrock and publishes a generic non-Steam game title to Steam. World names, server names and IP addresses are never sent.

**Preview release.** Steam login, basic activity, Windows installation and reopening the app have been verified. Real Java sensor states, saved-login recovery and startup after a Windows reboot still need end-to-end confirmation. Bedrock detailed states are currently manual.

## AI disclosure

The frontend was created with AI using OpenAI Codex, under the project owner's direction. This includes the interface layout, styling and frontend code in `ui/index.html`, `ui/style.css` and `ui/app.js`.

This README was also written (90% bc codex is stupid) with AI using OpenAI Codex, under the project owner's direction.

See [FILES.md](FILES.md) for the source map and [VALIDATION.md](VALIDATION.md) for completed tests and remaining checks.

## Install and use

1. Close the previous development panel with **Quit Minecraft Presence**.
2. Run **Minecraft-Presence-Setup-0.2.0-alpha.3.exe**. It installs for your Windows user without an administrator account.
3. Open **Minecraft Presence** from the desktop or Start menu.
4. Choose **Connect to Steam** and scan the QR code using Steam Guard on your phone.
5. Launch Minecraft normally from your launcher. Java sensors load automatically.

The app includes Node/Electron and a minimal Java Attach runtime. No separate Node.js or Java setup is needed for supported Java games (Java 17+). Windows 10/11 x64 is the only packaged target.

Closing the window keeps detection running in the system tray. Double-click the tray icon to reopen it; choose **Quit** to stop detection and clear activity. **Start in the background when I sign in to Windows** is enabled by default and can be disabled in Preferences.

The desktop app encrypts its own Steam refresh token using Windows DPAPI. It does not read or reuse the desktop Steam client's credentials. Normal restarts restore the saved session; Steam can still revoke or expire authorization. **Sign out & forget session** deletes the local saved login. Uninstall through Windows Settings to remove the app, startup entry and its data. Upgrades preserve data.

This preview installer is not code signed. Do not treat it as a stable public release yet.

## Activity and instances

- Java menu: `Minecraft — In menu`
- Java local world: `Minecraft — Singleplayer`
- Java server: `Minecraft — Multiplayer`
- Unrecognized or unavailable sensor: `Minecraft — Playing`
- Multiple game processes: `Minecraft — Multiple games`
- No game: Steam activity clears after approximately 4–6 seconds; an open launcher does not keep it active.

Known launcher profiles are checked every 10 seconds. New game processes are checked every 2 seconds. External instance directories are discovered from the running game's arguments, independently of the launcher, and remembered locally. Add a full folder path in Advanced settings for profiles stored elsewhere. The app does not scan every file on your disk.

Bedrock open/close detection is implemented. **Automatic Bedrock menu/singleplayer/multiplayer detection is not implemented**; the dropdown is a manual fallback. A universal Java compatibility claim is also not made: official obfuscated versions and unsupported mappings can remain at Playing.

Steam receives a dynamic non-Steam game name, not official Steamworks rich presence, a Minecraft license, official playtime or achievements. Another Steam game session can block publishing; this app does not force that session out.

## Java troubleshooting

The sensor uses the standard Java Attach API. It reads only whether a world exists and whether an integrated server exists. It does not transform classes or read world/server identifiers. It sends only `{pid, mode}` to the authenticated local service.

If Windows denies access, open Minecraft Presence normally under the same Windows user as Minecraft. Do not run the game as administrator. Restricted development environments may prevent Attach even when process discovery works. Do not disable Windows security to resolve this.

A failed attach retries after a minute. A loaded sensor reports every 2 seconds; stale reports expire after 7 seconds. Unknown mappings remain Playing. Java 8, JVMs without Attach, or games with dynamic agents disabled require a different adapter.

## Data and privacy

Desktop data is in `%APPDATA%\Minecraft Presence`: preferences, discovered instance paths, encrypted session, browser storage and a local sensor access key. Never publish that folder. The development server uses `~/.minecraft-private-presence` or `MCPRESENCE_DATA` and does not persist Steam credentials.

Only fixed generic activity strings are sent to Steam. Command lines are inspected locally to identify the game but are not saved. The API binds to IPv4 loopback and checks Host, Origin and a per-run bearer token. Telemetry rejects extra fields. There is no project analytics service.

DPAPI protects saved data for the current Windows user; other software running as that same user is not isolated from it. See [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

## Build from source (Windows)

Install Node.js 22+ and a JDK 17 distribution; set JAVA_HOME to that JDK.

```powershell
npm ci --ignore-scripts
node node_modules/electron/install.js
npm test
npm run build:windows
```

The installer is written to `release/`. Run `npm run start:desktop` to develop, or `npm run start:headless` for a development browser panel. The reduced Java runtime is created by jlink and includes its notices and license files. See RUNTIME-SOURCE.md for the JDK used for this preview.

`node scripts/integration.js` exercises a synthetic Java process, Attach and HTTP telemetry; it does not prove actual Minecraft compatibility. Close the regular Presence app before this test to avoid it reporting the fixture as a game.

`npm run pack:source` creates a source archive using an explicit public-file list. Local profiles, credentials, Steam backups and build caches are excluded.

## Release status

See VALIDATION.md. GitHub publication is pending live verification with the tester. CI targets Windows only and builds without publishing.

Independent project, not affiliated with Mojang, Microsoft or Valve.
