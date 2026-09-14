# Source map and initial commit groups

The initial history is split by responsibility. Use a file's history to find the commit introducing it; commit bodies describe the files in each group.

| Commit group | Files | Purpose |
| --- | --- | --- |
| Project foundation | package.json, package-lock.json, .gitignore, .gitattributes, LICENSE | Dependencies, commands, public-source exclusions, line endings and project license. |
| Activity model | src/core.js, test/core.test.js | Recognize game processes, parse instance directories, expire stale activity and produce generic Steam titles. |
| Windows discovery | native/ProcessScanner.cs, src/system.js, scripts/build-windows.js, test/registry.test.js | Read Windows process metadata and remember new launcher profiles and external instances. |
| Java sensor | src/sensor.js, sensor/src/presence/Agent.java, sensor/src/presence/Attach.java, sensor/MANIFEST.MF, sensor/test/**, scripts/build-sensor.js | Load a read-only agent, report generic modes and test mapped client state. |
| Steam and saved login | src/steam.js, src/credentials.js, test/steam.test.js, test/credentials.test.js | Steam Guard authorization, activity updates, reconnect, encrypted token storage and sign-out deletion. |
| English interface | ui/index.html, ui/style.css, ui/app.js | Activity, connection, discovered instances and preferences. |
| Local service | src/main.js, scripts/start.js, Start.cmd, scripts/integration.js | Authenticated loopback API, polling, configuration and synthetic end-to-end tests. |
| Windows application | desktop/main.js, desktop/installer.nsh, electron-builder.yml, scripts/build-runtime.js | Desktop window, tray, startup entry, per-user installer, uninstall cleanup and bundled Attach runtime. |
| Windows CI | .github/workflows/test.yml | Test and build on Windows without automatic publishing. |
| Documentation and source distribution | README.md, VALIDATION.md, RUNTIME-SOURCE.md, FILES.md, scripts/package.js | Setup instructions, actual validation status, runtime provenance, source map and allowlisted source archives. |

Generated installers, Java runtimes, dependencies and private app data are excluded from Git. Installers belong in a future GitHub Release, after live validation. Runtime credentials and instance paths must never be committed.

Automatic Windows startup and encrypted saved-session restoration are implemented. A successful installer/window test does not verify login restoration after a full Windows reboot. See VALIDATION.md for remaining checks, including the automatic Bedrock detail sensor, which is not implemented.
