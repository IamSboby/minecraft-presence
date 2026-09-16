# Validation record

## Alpha.5 launcher repair and uninstall cleanup

Store launcher shortcuts use registered Windows AppsFolder activation instead of directly running GameLaunchHelper.exe. Setup repairs alpha.4 targets while preserving their app IDs. Managed shortcut ownership is recorded; uninstall removes app-created entries or restores pre-existing entries and requires Steam to be closed. Alpha.4 UUID backups are adopted only when their contents match a pre-add snapshot. Session data, setup records and internal backups are removed by the Windows uninstaller. Automated repair, migration and uninstall tests pass; a normal-user install/launch/uninstall cycle remains pending.


## Optional Steam launcher shortcut (development, not yet released)

Added an English first-run opt-in and a Preferences action. Five automated tests cover first-run opt-out persistence, binary entry preservation, duplicate targets, invalid files, backups and Steam restarting during setup. All 19 tests pass. Native first-run dialogs and launch from the resulting Steam entry still require a normal-user end-to-end test. The published alpha.3 installer does not contain this feature.

Version: 0.2.0-alpha.3. Date: 2026-09-13. Windows only. Not published.

## Confirmed

- The user confirmed Steam login and basic Playing activity work after the Online persona fix.
- 11 Node tests pass: game detection, launcher exclusion, closing, stale reports/PID reuse, privacy allowlist, registry updates, Steam behavior, credential queue ordering and diagnostic sanitization.
- Synthetic JVM integration passes: native process discovery, external directory registration, actual Attach and HTTP telemetry through menu -> singleplayer -> multiplayer -> menu -> close.
- Unauthorized API access, external Origin and extra telemetry fields are rejected.
- English frontend checked in the browser. Existing development server remains an older in-memory backend until restart.
- Fabulously Optimized 1.21.11 process and external game directory are detected on the real machine.
- Direct Attach to that game fails with Windows access denied from the restricted development process. This is not evidence of a mapping failure.
- Real Electron DPAPI smoke test reports encryption unavailable in the restricted environment. No plaintext fallback was used.
- npm dependency audit during installation reported zero known vulnerabilities.

## Pending live verification

- [ ] Install and run the Windows EXE under the normal Windows user.
- [ ] Confirm Java sensor attaches to Fabulously Optimized 1.21.11 and displays all three real states.
- [ ] Confirm the same generic states from a friend's Steam view.
- [ ] Close Minecraft while leaving the launcher open; verify Steam activity clears.
- [ ] Close/reopen the app; confirm saved login restores without QR.
- [ ] Sign out; restart; confirm QR is required again.
- [ ] Restart Windows; confirm background startup and saved login.
- [ ] Disable startup and verify it remains disabled.
- [ ] Uninstall and verify app data and startup entry are removed.
- [ ] Test a new external instance and a supported Bedrock installation.
- [ ] Implement automatic detailed Bedrock sensor before claiming the original full feature set.
- [ ] Review final public archive and approve GitHub publication.

The credential unit test uses a fake encryptor to check file/queue semantics. It does not replace the pending real Windows DPAPI and account restart tests. Synthetic Java tests do not replace Minecraft tests.

The local JDK build used source/target 17 because javac --release encounters resource access restrictions here; CI uses --release 17. No operating-system security controls were disabled.


## Windows startup correction (2026-09-14)

Reproduced the installed app remaining as a background process before creating its server or window. Removed the top-level wait for Electron readiness and moved startup into the readiness callback. Window display no longer waits for saved Steam login. All 11 Node tests pass; installed-app launch verification is recorded after reinstalling.

Installed alpha.3 successfully after reboot. Verified the installed version from its app archive. The native application window displays the English frontend and four discovered profiles. Local status reports desktop=true, scanError=null and autoSensor=true. Stopped the app through its authenticated local API, launched the installed executable again and verified its native window reopened. Steam sign-in and real Minecraft sensor transitions remain pending; no game was running during this check.

## Alpha.6 Steam session helper

20 Node tests pass. Compiled native helper self-tests cover launcher timeout, game exit with launcher still open, multiple games and scan failures. A real Java fixture launch verified the helper stays alive during play and exits after game closure. The user confirmed launcher activation and detection in alpha.5. Actual Steam local hours and full uninstall of alpha.6 remain to be checked in the normal user session.

## Alpha.7 launcher wait correction

Removed the 30-second exit based on launcher process visibility. Compiled native lifetime tests now cover the observed 34-second launcher disappearance and game starting at 79 seconds, bounded waiting with scan failures, last-game exit, and multiple games. The real-Java integration test now delays game launch for 35 seconds; it requires Minecraft to be closed and has not been run locally for this revision because the user's game is active. Actual Steam time accumulation remains pending.

2026-09-16: Delayed real-Java integration PASS. The helper survived the 35-second launcher delay, detected the real fixture, stayed alive while it ran and exited after game closure. Packaged alpha.7 helper verified against the compiled binary; installer SHA-256 generated. Actual Steam local hours remain pending user testing.

## Alpha.8 presence-only rollback

The alpha.7 playtime implementation is backed up separately. The Steam shortcut API, onboarding and Preferences control have been removed from the active app. The installer excludes SteamSession.exe. Migration cleans up recorded shortcuts and helper configuration while preserving the encrypted Steam session. Live migration and Steam friend-view verification remain pending.

The presence-only build is versioned 0.2.0-beta.1 at the user's request. Packaged contents were verified without SteamSession.exe; native migration and friend-view status remain live checks.
# Launcher compatibility development checks (2026-09-16)

The main branch passes 23 Node tests after launcher compatibility changes. Added checks cover modern Forge/NeoForge client targets, dedicated-server/data-target rejection, classpath false positives, legacy wrappers, portable instance containers and newly added instances, plus bounded Java argument-file expansion. These are synthetic format/registry tests. No live Prism, MultiMC, TLauncher, HMCL, ATLauncher, CurseForge, Modrinth or GDLauncher session was performed for this change. The published beta.1 installer predates these changes.
