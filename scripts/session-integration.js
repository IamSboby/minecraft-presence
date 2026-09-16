import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { processes } from '../src/system.js';
import { classifyProcess } from '../src/core.js';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
if (process.platform !== 'win32') throw new Error('Windows integration test only.');
if ((await processes()).some(classifyProcess)) throw new Error('Close Minecraft before running this integration test.');
const java = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'steam-session-test-'));
let helper;
try {
  execFileSync(path.join(process.env.JAVA_HOME, 'bin', 'javac.exe'), ['-d', '.build/fixture', 'sensor/test/net/minecraft/client/Minecraft.java', 'sensor/test/net/minecraft/client/main/Main.java', 'sensor/test/presence/fixture/DelayedLauncher.java'], { windowsHide: true });
  const mode = path.join(dir, 'mode.txt');
  await fs.writeFile(mode, 'menu');
  const config = path.join(dir, 'launcher.json');
  await fs.writeFile(config, JSON.stringify({ executable: java, directory: root, arguments: `-cp "${path.join(root, '.build/fixture')}" presence.fixture.DelayedLauncher "${dir}" "${mode}"` }));
  helper = spawn(path.join(root, 'native/dist/SteamSession.exe'), [config], { windowsHide: true, stdio: 'ignore' });
  let exited = false; const ended = once(helper, 'exit').then(([code]) => { exited = true; return code; });
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let detected = false;
  for (let i = 0; i < 100; i++) { if ((await processes()).some(p => classifyProcess(p) && p.cmd.includes(mode))) { detected = true; break; } if (exited) break; await pause(500); }
  assert.ok(detected, 'helper started a real Java game fixture');
  await pause(5000);
  assert.equal(exited, false, 'helper stays alive while the game runs');
  await fs.writeFile(mode, 'exit');
  for (let i = 0; i < 30 && !exited; i++) await pause(500);
  assert.ok(exited, 'helper exits after the game closes');
  assert.equal(await ended, 0);
  console.log('PASS Steam session helper survives a 35-second launcher delay, detects the real Java fixture and exits after game closes.');
} finally {
  await fs.writeFile(path.join(dir, 'mode.txt'), 'exit');
  if (helper?.exitCode === null) helper.kill();
  await new Promise(resolve => setTimeout(resolve, 1500));
  await fs.rm(dir, { recursive: true, force: true });
}
