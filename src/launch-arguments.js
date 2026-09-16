import fs from 'node:fs/promises';
import path from 'node:path';
import { argumentsOf } from './core.js';

// Java argument files have their own quoting rules, independent of Windows argv.
export function argumentFileTokens(text) {
  const tokens = []; let word = '', quote = '', started = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!quote && c === '#') {
      if (started) tokens.push(word); word = ''; started = false;
      while (i < text.length && text[i] !== '\n') i++;
    }
    else if (quote && c === '\\') {
      const next = text[++i];
      if (next === '\r' || next === '\n') {
        if (next === '\r' && text[i + 1] === '\n') i++;
        while (/^[ \t]$/.test(text[i + 1] || '')) i++;
      } else if (next !== undefined) word += ({ n: '\n', r: '\r', t: '\t', f: '\f' })[next] ?? next;
    } else if (c === quote) quote = '';
    else if (!quote && (c === '"' || c === "'")) { quote = c; started = true; }
    else if (!quote && /\s/.test(c)) { if (started) tokens.push(word); word = ''; started = false; }
    else { word += c; started = true; }
  }
  if (started) tokens.push(word);
  return tokens;
}

export async function expandLaunchArguments(processes) {
  return Promise.all(processes.map(async p => {
    if (!/^javaw?(?:\.exe)?$/i.test(p.name)) return p;
    const args = p.argv || argumentsOf(p.cmd || '');
    const expanded = []; let enabled = true, files = 0;
    const userDir = args.find(a => a.startsWith('-Duser.dir='))?.slice(11);
    for (const arg of args) {
      if (arg === '--disable-@files') enabled = false;
      if (!enabled || !arg.startsWith('@') || arg.startsWith('@@') || ++files > 8) { expanded.push(arg); continue; }
      const name = arg.slice(1);
      // Never guess a game's working directory or recursively follow @files.
      const file = path.isAbsolute(name) ? name : userDir && path.isAbsolute(userDir) ? path.resolve(userDir, name) : null;
      if (!file || file.startsWith('\\\\')) { expanded.push(arg); continue; }
      let handle;
      try {
        handle = await fs.open(file, 'r');
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > 1024 * 1024) { expanded.push(arg); continue; }
        const buffer = Buffer.alloc(stat.size + 1);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        expanded.push(...argumentFileTokens(buffer.subarray(0, bytesRead).toString('utf8')));
      } catch { expanded.push(arg); }
      finally { await handle?.close(); }
    }
    return { ...p, argv: expanded };
  }));
}
