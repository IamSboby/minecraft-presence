# Validation record

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
