# Minecraft Presence for Windows

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Instagram](https://img.shields.io/badge/Instagram-%40sboby4all-E4405F?logo=instagram&logoColor=white)](https://www.instagram.com/sboby4all/)

A local Windows app that detects Minecraft Java and Bedrock and publishes a generic non-Steam game title to Steam. World names, server names and IP addresses are never sent.

**Release 1.0.0.** Steam login, basic activity, Windows installation and reopening the app have been verified. Real Java sensor states, saved-login recovery and startup after a Windows reboot still need end-to-end confirmation. Bedrock detailed states are currently manual.

## AI disclosure

The frontend was created with AI using OpenAI Codex, under the project owner's direction. This includes the interface layout, styling and frontend code in `ui/index.html`, `ui/style.css` and `ui/app.js`.

This README was also written (90% bc codex is stupid) with AI using OpenAI Codex, under the project owner's direction.

See [FILES.md](FILES.md) for the source map and [VALIDATION.md](VALIDATION.md) for completed tests and remaining checks.

## Presence only (1.0.0)

This version publishes dynamic Minecraft activity only. The experimental Steam playtime helper and optional library shortcut have been retired. Launch Minecraft normally. Existing managed playtime shortcuts are cleaned up during migration after Steam and the helper are closed. Saved sign-in and Minecraft installations are preserved.

## Install and use


1. Run **Minecraft-Presence-Setup-1.0.0.exe**. It installs for your Windows user without an administrator account.
2. Open **Minecraft Presence** from the desktop or Start menu.
3. Choose **Connect to Steam** and scan the QR code using Steam Guard on your phone.
4. Launch Minecraft normally from your launcher. Java sensors load automatically.

The app includes Node/Electron and a minimal Java Attach runtime. No separate Node.js or Java setup is needed for supported Java games (Java 17+). Windows 10/11 x64 is the only packaged target.

Closing the window keeps detection running in the system tray. Double-click the tray icon to reopen it; choose **Quit** to stop detection and clear activity. **Start in the background when I sign in to Windows** is enabled by default and can be disabled in Preferences.

The desktop app encrypts its own Steam refresh token using Windows DPAPI. It does not read or reuse the desktop Steam client's credentials. Normal restarts restore the saved session; Steam can still revoke or expire authorization. **Sign out & forget session** deletes the local saved login. Uninstall through Windows Settings to remove the app, startup entry and its data. Upgrades preserve data.

The Windows installer is not code signed. See VALIDATION.md for checks completed and remaining validation limits.

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

### Bedrock compatibility

Release 1.0.0 recognizes Windows Bedrock retail and Preview clients using the client executable, known installation layouts and Windows package-family metadata. Both WindowsApps installations and Xbox/GDK/custom `Minecraft.Windows.exe` installations are covered. Launcher/helper and dedicated-server processes are excluded. The local panel shows the detected channel and executable version when Windows exposes it, and remembers existing retail/Preview data folders without reading world names.

This improves game detection, not automatic Bedrock menu/world/server states. No native state sensor is implemented; unsupported automatic detail stays at Playing, with manual generic state selection available. Package layout alone cannot prove a build is UWP or GDK. Live retail detection was confirmed in the local panel. Retail clearing on close was also confirmed locally. Preview detection and manual state transitions still need live confirmation.

Run `npm run test:bedrock:local` for the isolated development panel on port 38473. Its authenticated link is stored in `.build/bedrock-local-test/panel.url`. It does not restore your installed app's Steam session. Quit the installed Presence app before connecting Steam here. Test detection, select each manual state, then close Bedrock while leaving the launcher open and verify activity clears. These changes are included in 1.0.0.

### Launcher compatibility

Detection follows the running Java game, independently of the launcher's name. Supported launch patterns include the official launcher, Prism Launcher (PrismMC), MultiMC/PolyMC, and standard Minecraft clients started by ATLauncher, CurseForge, Modrinth App, GDLauncher, HMCL and TLauncher. Fabric, Quilt, legacy LaunchWrapper/OptiFine, Forge and NeoForge client entry points are recognized. Forge/NeoForge server and data-generation targets are excluded. Merely opening a launcher does not publish game activity.

This list describes supported argument formats, not live testing of every launcher/version. TLauncher's standard clients and version-specific `org.tlauncher.Launch…` wrappers are detected; other custom wrappers are not guaranteed. Forge and NeoForge are mod loaders, not separate launchers. Proprietary clients, renamed Java executables and unreadable process arguments may remain undetected.

Java `@argfile` launches are supported for readable local absolute files, or relative files with an explicit absolute `-Duser.dir`. Reads are limited to eight files of 1 MiB each, without nested expansion; unknown working directories are not guessed. Argument contents are inspected locally and are not persisted.

Installed Prism, MultiMC, PolyMC and ATLauncher folders under `%APPDATA%` are checked automatically. For portable launchers or custom CurseForge/Modrinth/GDLauncher locations, add the launcher folder or its instance container in Advanced settings. Instance markers (`instance.cfg`, `mmc-pack.json`, `instance.json`, `minecraftinstance.json`, `manifest.json`) identify immediate child instances, with `.minecraft` or `minecraft` subfolders preferred. New instances are checked every ten seconds; supported running games with `--gameDir`, `-Duser.dir`, or the legacy applet directory are also remembered automatically wherever they are installed.

Game detection and detailed state detection are separate. Java 8 clients can be detected, but the bundled state sensor requires Java 17+ and supported mappings/Attach permissions; otherwise activity stays at `Minecraft — Playing`. Bedrock detailed states remain manual. These launcher compatibility changes are included in 1.0.0.

Launch-format references: [MultiMC's game wrapper](https://github.com/MultiMC/Launcher/blob/develop/libraries/launcher/org/multimc/onesix/OneSixLauncher.java), [ATLauncher's launch configuration](https://wiki.atlauncher.com/pack-admin/xml/pack/), and [Forge's client launch configuration](https://github.com/MinecraftForge/MinecraftForge/blob/26.2/build.gradle).

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

See VALIDATION.md for coverage and remaining checks. Release 1.0.0 is published on GitHub Releases. CI targets Windows only and builds without publishing.

Independent project, not affiliated with Mojang, Microsoft or Valve.
