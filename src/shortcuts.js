import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { atomicJSON } from './system.js';

// Parse boundaries without reserializing existing entries or discarding unknown fields.
export function parseVDF(buffer) {
  let offset = 0;
  function string() {
    const end = buffer.indexOf(0, offset);
    if (end < 0) throw new Error('Invalid Steam shortcuts file.');
    const value = buffer.toString('utf8', offset, end); offset = end + 1; return value;
  }
  function object(depth = 0) {
    if (depth > 16) throw new Error('Invalid Steam shortcuts file.');
    const fields = [];
    while (offset < buffer.length) {
      const start = offset, type = buffer[offset++];
      if (type === 8) return { fields, end: start };
      const key = string(); let value;
      if (type === 0) value = object(depth + 1);
      else if (type === 1) value = string();
      else if ([2, 3, 4, 6].includes(type)) { value = buffer.readUInt32LE(offset); offset += 4; }
      else if (type === 7) { value = buffer.subarray(offset, offset + 8); offset += 8; }
      else throw new Error('Unsupported Steam shortcuts format. No changes were made.');
      if (offset > buffer.length) throw new Error('Invalid Steam shortcuts file.');
      fields.push({ start, end: offset, type, key, value });
    }
    throw new Error('Incomplete Steam shortcuts file.');
  }
  const root = object();
  if (offset !== buffer.length) throw new Error('Unexpected Steam shortcuts data.');
  return root;
}
const field = (object, key) => object.fields.find(f => f.key.toLowerCase() === key.toLowerCase());
const text = (key, value) => Buffer.from(`\x01${key}\0${value}\0`, 'utf8');
const integer = (key, value) => { const n = Buffer.alloc(4); n.writeUInt32LE(value >>> 0); return Buffer.concat([Buffer.from(`\x02${key}\0`), n]); };
const normalize = value => String(value || '').replace(/^"|"$/g, '').replaceAll('/', '\\').toLowerCase();
const stableFields = object => object.fields.filter(f => !['lastplaytime', 'sortas'].includes(f.key.toLowerCase())).map(f => [f.type, f.key, f.type === 0 ? stableFields(f.value) : f.value]);
function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(value)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function addLauncherShortcut(original, executable, directory, options = {}) {
  if (/[\0"\r\n]/.test(executable + directory)) throw new Error('Invalid launcher path.');
  const root = parseVDF(original), shortcuts = field(root, 'shortcuts');
  if (shortcuts?.type !== 0) throw new Error('Invalid Steam shortcuts file.');
  const entries = shortcuts.value.fields;
  const launchOptions = options.launchOptions || '';
  if (/[\0\r\n]/.test(launchOptions)) throw new Error('Invalid launcher arguments.');
  if (entries.some(entry => entry.type === 0 && normalize(field(entry.value, 'Exe')?.value) === normalize(executable) && (field(entry.value, 'LaunchOptions')?.value || '') === launchOptions)) return { buffer: original, added: false };
  const previousTargets = options.previousTargets || (options.previousExecutable ? [{ executable: options.previousExecutable, launchOptions: options.previousLaunchOptions }] : []);
  const previous = entries.find(entry => entry.type === 0 && previousTargets.some(target => normalize(field(entry.value, 'Exe')?.value) === normalize(target.executable) && (target.launchOptions === undefined || (field(entry.value, 'LaunchOptions')?.value || '') === target.launchOptions)));
  if (previous) {
    const replacements = { Exe: `"${executable}"`, StartDir: `"${directory}"`, LaunchOptions: launchOptions };
    const edits = Object.entries(replacements).map(([key, value]) => {
      const old = field(previous.value, key);
      if (!old || old.type !== 1) throw new Error('Cannot repair this shortcut format. No changes were made.');
      return { ...old, bytes: text(old.key, value) };
    }).sort((a, b) => b.start - a.start);
    let buffer = original;
    for (const edit of edits) buffer = Buffer.concat([buffer.subarray(0, edit.start), edit.bytes, buffer.subarray(edit.end)]);
    return { buffer, added: true, repaired: true };
  }
  if (entries.some(entry => !/^\d+$/.test(entry.key) || entry.type !== 0)) throw new Error('Unsupported Steam shortcuts entries.');
  const index = entries.length ? Math.max(...entries.map(e => Number(e.key))) + 1 : 0;
  const exe = `"${executable}"`, name = 'Minecraft Launcher';
  let id = (crc32(exe + name) | 0x80000000) >>> 0;
  const ids = new Set(entries.map(e => field(e.value, 'appid')?.value));
  while (ids.has(id)) id = ((id + 1) | 0x80000000) >>> 0;
  const entry = Buffer.concat([Buffer.from(`\0${index}\0`), integer('appid', id), text('AppName', name), text('Exe', exe),
    text('StartDir', `"${directory}"`), text('icon', options.icon || executable), text('ShortcutPath', ''), text('LaunchOptions', launchOptions),
    integer('IsHidden', 0), integer('AllowDesktopConfig', 1), integer('AllowOverlay', 1), integer('OpenVR', 0),
    integer('Devkit', 0), text('DevkitGameID', ''), integer('DevkitOverrideAppID', 0), integer('LastPlayTime', 0),
    text('FlatpakAppID', ''), Buffer.from('\0tags\0\x08\x08')]);
  const at = shortcuts.value.end;
  return { buffer: Buffer.concat([original.subarray(0, at), entry, original.subarray(at)]), added: true };
}
export async function installLauncherShortcut(file, executable, directory, isSteamRunning, options = {}) {
  if (await isSteamRunning()) throw new Error('Exit Steam completely, then try again.');
  const empty = Buffer.from('\0shortcuts\0\x08\x08');
  let original;
  try { original = await fs.readFile(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const result = addLauncherShortcut(original || empty, executable, directory, options);
  if (!result.added) return { added: false };
  const suffix = crypto.randomUUID(), temporary = `${file}.${suffix}.tmp`;
  let backup;
  try {
    await fs.writeFile(temporary, result.buffer, { flag: 'wx' });
    if (await isSteamRunning()) throw new Error('Steam opened during setup. Exit it and try again.');
    let current;
    try { current = await fs.readFile(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (!!current !== !!original || (current && !current.equals(original))) throw new Error('Steam shortcuts changed during setup. Please try again.');
    if (original) { backup = options.ownershipFile ? path.join(path.dirname(options.ownershipFile), `shortcuts-${suffix}.bak`) : `${file}.${suffix}.bak`; await fs.writeFile(backup, original, { flag: 'wx' }); }
    if (options.ownershipFile) {
      const newEntries = field(parseVDF(result.buffer), 'shortcuts').value.fields;
      const entry = newEntries.find(e => normalize(field(e.value, 'Exe')?.value) === normalize(executable) && field(e.value, 'LaunchOptions')?.value === (options.launchOptions || ''));
      const id = field(entry.value, 'appid').value;
      const oldEntry = original && field(parseVDF(original), 'shortcuts').value.fields.find(e => field(e.value, 'appid')?.value === id);
      let restore = oldEntry ? original.subarray(oldEntry.start, oldEntry.end).toString('base64') : null;
      const legacyBackups = [];
      // Alpha.4 wrote UUID backups beside Steam's file. Only adopt an entry if a
      // matching pre-add snapshot proves it was absent before our operation.
      if (oldEntry && field(oldEntry.value, 'AppName')?.value === 'Minecraft Launcher') {
        for (const name of (await fs.readdir(path.dirname(file))).filter(n => /^shortcuts\.vdf\.[0-9a-f-]{36}\.bak$/i.test(n))) {
          const candidate = path.join(path.dirname(file), name);
          try {
            const before = await fs.readFile(candidate);
            const reconstructed = addLauncherShortcut(before, field(oldEntry.value, 'Exe').value.replace(/^"|"$/g, ''), field(oldEntry.value, 'StartDir').value.replace(/^"|"$/g, ''), { launchOptions: field(oldEntry.value, 'LaunchOptions')?.value || '' });
            if (JSON.stringify(stableFields(parseVDF(reconstructed.buffer))) === JSON.stringify(stableFields(parseVDF(original)))) { restore = null; legacyBackups.push(candidate); }
          } catch { /* Never adopt unrelated backups. */ }
        }
      }
      let records = [];
      try { records = JSON.parse(await fs.readFile(options.ownershipFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const existing = records.find(r => r.file === file && r.id === id);
      if (existing) { existing.executable = executable; existing.launchOptions = options.launchOptions || ''; }
      else records.push({ file, id, executable, launchOptions: options.launchOptions || '', restore, legacyBackups });
      await atomicJSON(options.ownershipFile, records);
    }
    await fs.rename(temporary, file);
    return { added: true, repaired: !!result.repaired, backup };
  } finally { await fs.rm(temporary, { force: true }); }
}

export async function cleanupLauncherShortcuts(ownershipFile, isSteamRunning) {
  let records;
  try { records = JSON.parse(await fs.readFile(ownershipFile, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  if (!records.length) return;
  if (await isSteamRunning()) throw new Error('Exit Steam completely before uninstalling Minecraft Presence.');
  for (const record of records) {
    let original;
    try { original = await fs.readFile(record.file); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    const entries = field(parseVDF(original), 'shortcuts').value.fields;
    const entry = entries.find(e => field(e.value, 'appid')?.value === record.id);
    const alreadyRestored = entry && record.restore && original.subarray(entry.start, entry.end).equals(Buffer.from(record.restore, 'base64'));
    if (entry && !alreadyRestored) {
      if (normalize(field(entry.value, 'Exe')?.value) !== normalize(record.executable) || (field(entry.value, 'LaunchOptions')?.value || '') !== record.launchOptions) throw new Error('A managed Steam shortcut was changed. Remove it in Steam, exit Steam, then retry uninstalling.');
      const replacement = record.restore ? Buffer.from(record.restore, 'base64') : Buffer.alloc(0);
      const updated = Buffer.concat([original.subarray(0, entry.start), replacement, original.subarray(entry.end)]);
      const temporary = `${record.file}.${crypto.randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, updated, { flag: 'wx' });
        if (await isSteamRunning() || !(await fs.readFile(record.file)).equals(original)) throw new Error('Steam changed during cleanup. Exit it and retry.');
        await fs.rename(temporary, record.file);
      } finally { await fs.rm(temporary, { force: true }); }
    }
    for (const backup of record.legacyBackups || []) await fs.rm(backup, { force: true });
  }
  await atomicJSON(ownershipFile, []);
}
