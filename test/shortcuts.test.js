import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { addLauncherShortcut, installLauncherShortcut, parseVDF, cleanupLauncherShortcuts } from '../src/shortcuts.js';
import { createShortcutSetup, launcherTarget } from '../desktop/shortcut-setup.js';

const empty = Buffer.from('\0shortcuts\0\x08\x08');
test('session helper migration matches launcher arguments and preserves cleanup ownership', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-session-migration-'));
  try {
    const file = path.join(dir, 'shortcuts.vdf'), ownershipFile = path.join(dir, 'managed.json');
    const explorer = 'C:\\Windows\\explorer.exe', args = 'shell:AppsFolder\\Minecraft';
    const original = addLauncherShortcut(empty, explorer, 'C:\\Windows', { launchOptions: 'C:\\OtherFolder' }).buffer;
    await fs.writeFile(file, original);
    await installLauncherShortcut(file, explorer, 'C:\\Windows', async()=>false, { launchOptions: args, ownershipFile });
    await installLauncherShortcut(file, 'C:\\App\\SteamSession.exe', 'C:\\App', async()=>false, { launchOptions:'"C:\\Data\\launcher.json"', previousTargets:[{executable:explorer,launchOptions:args}], ownershipFile });
    const entries = parseVDF(await fs.readFile(file)).fields[0].value.fields;
    assert.equal(entries.length, 2);
    assert.equal(entries[0].value.fields.find(f=>f.key==='LaunchOptions').value, 'C:\\OtherFolder');
    await cleanupLauncherShortcuts(ownershipFile, async()=>false);
    assert.deepEqual(await fs.readFile(file), original);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('Store launcher uses registered Windows activation and repairs the existing entry', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-store-'));
  try {
    await fs.writeFile(path.join(dir, 'AppxManifest.xml'), '<Package><Identity Name="Microsoft.4297127D64EC6"/><Applications><Application Id="Minecraft" Executable="GameLaunchHelper.exe"/></Applications></Package>');
    const launcher = path.join(dir, 'gamelaunchhelper.exe');
    const target = await launcherTarget(launcher, 'C:\\Windows');
    assert.equal(target.options.launchOptions, 'shell:AppsFolder\\Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft');
    const before = addLauncherShortcut(empty, launcher, dir).buffer;
    const after = addLauncherShortcut(before, target.executable, target.directory, target.options);
    assert.equal(after.repaired, true);
    const entries = parseVDF(after.buffer).fields[0].value.fields;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].value.fields.find(f=>f.key==='appid').value, parseVDF(before).fields[0].value.fields[0].value.fields.find(f=>f.key==='appid').value);
    assert.equal(addLauncherShortcut(after.buffer, target.executable, target.directory, target.options).added, false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('uninstall removes managed shortcuts, preserves unrelated entries and refuses open Steam', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-uninstall-'));
  try {
    const file = path.join(dir, 'shortcuts.vdf'), ownershipFile = path.join(dir, 'managed.json');
    const original = addLauncherShortcut(empty, 'C:\\Other.exe', 'C:\\').buffer;
    await fs.writeFile(file, original);
    await installLauncherShortcut(file, 'C:\\Launcher.exe', 'C:\\', async()=>false, { ownershipFile });
    await assert.rejects(cleanupLauncherShortcuts(ownershipFile, async()=>true));
    await cleanupLauncherShortcuts(ownershipFile, async()=>false);
    assert.deepEqual(await fs.readFile(file), original);
    assert.deepEqual(JSON.parse(await fs.readFile(ownershipFile, 'utf8')), []);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('alpha.4 repair migrates ownership from its backup and removes the legacy backup on uninstall', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-migrate-'));
  try {
    const file = path.join(dir, 'shortcuts.vdf'), ownershipFile = path.join(dir, 'managed.json');
    await fs.writeFile(file, empty);
    const old = await installLauncherShortcut(file, 'C:\\Minecraft\\gamelaunchhelper.exe', 'C:\\Minecraft', async()=>false);
    await installLauncherShortcut(file, 'C:\\Windows\\explorer.exe', 'C:\\Windows', async()=>false, { ownershipFile, previousExecutable:'C:\\Minecraft\\gamelaunchhelper.exe', launchOptions:'shell:AppsFolder\\Minecraft' });
    await cleanupLauncherShortcuts(ownershipFile, async()=>false);
    assert.deepEqual(await fs.readFile(file), empty);
    await assert.rejects(fs.stat(old.backup), { code:'ENOENT' });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('declining first-run setup persists across app restarts without opening a picker', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-opt-in-')); let prompts = 0;
  const options = { dataDirectory: dir, getWindow: () => undefined, dialog: {
    showMessageBox: async () => { prompts++; return { response: 1 }; },
    showOpenDialog: async () => { throw new Error('No picker should open without consent'); }
  } };
  try {
    const setup = createShortcutSetup(options);
    await Promise.all([setup.firstRun(), setup.firstRun()]);
    await createShortcutSetup(options).firstRun();
    assert.equal(prompts, 1);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'shortcut-setup.json'), 'utf8')), { offered: true });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('adds a launcher, preserves existing entries byte for byte, and avoids duplicate targets', () => {
  const first = addLauncherShortcut(empty, 'C:\\Games\\Other.exe', 'C:\\Games');
  const next = addLauncherShortcut(first.buffer, 'D:\\XboxGames\\Minecraft Launcher\\Content\\gamelaunchhelper.exe', 'D:\\XboxGames\\Minecraft Launcher\\Content');
  const oldEntry = parseVDF(first.buffer).fields[0].value.fields[0];
  const entries = parseVDF(next.buffer).fields[0].value.fields;
  assert.equal(entries.length, 2);
  assert.deepEqual(next.buffer.subarray(entries[0].start, entries[0].end), first.buffer.subarray(oldEntry.start, oldEntry.end));
  const duplicate = addLauncherShortcut(next.buffer, 'd:/XboxGames/Minecraft Launcher/Content/GameLaunchHelper.exe', 'D:/XboxGames/Minecraft Launcher/Content');
  assert.equal(duplicate.added, false);
  assert.deepEqual(duplicate.buffer, next.buffer);
});
test('rejects invalid or unknown formats without producing replacements', () => {
  for (const data of [Buffer.from('garbage'), empty.subarray(0, -1), Buffer.from('\0shortcuts\0\x05bad\0\x08\x08')]) {
    assert.throws(() => addLauncherShortcut(data, 'C:\\Launcher.exe', 'C:\\'));
  }
});
test('refuses a running Steam client and backs up an existing file on success', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-shortcuts-'));
  const file = path.join(dir, 'shortcuts.vdf');
  try {
    await fs.writeFile(file, empty);
    await assert.rejects(installLauncherShortcut(file, 'C:\\Launcher.exe', 'C:\\', async () => true));
    assert.deepEqual(await fs.readFile(file), empty);
    const result = await installLauncherShortcut(file, 'C:\\Launcher.exe', 'C:\\', async () => false);
    assert.equal(result.added, true);
    assert.deepEqual(await fs.readFile(result.backup), empty);
    assert.equal(parseVDF(await fs.readFile(file)).fields[0].value.fields.length, 1);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('leaves shortcuts untouched if Steam starts during setup', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-shortcuts-'));
  const file = path.join(dir, 'shortcuts.vdf'); let checks = 0;
  try {
    await fs.writeFile(file, empty);
    await assert.rejects(installLauncherShortcut(file, 'C:\\Launcher.exe', 'C:\\', async () => ++checks === 2));
    assert.deepEqual(await fs.readFile(file), empty);
    assert.deepEqual(await fs.readdir(dir), ['shortcuts.vdf']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
