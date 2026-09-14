import path from 'node:path';

export const MODES = Object.freeze(['menu', 'singleplayer', 'multiplayer', 'unknown']);
export const LABELS = Object.freeze({ menu: 'In menu', singleplayer: 'Singleplayer', multiplayer: 'Multiplayer', unknown: 'Playing' });

// Preserves Windows backslashes and understands quoted game directories.
export function argumentsOf(command) {
  const out = []; let word = '', quoted = false, started = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === '"') { quoted = !quoted; started = true; }
    else if (/\s/.test(c) && !quoted) { if (started) out.push(word); word = ''; started = false; }
    else { word += c; started = true; }
  }
  if (started) out.push(word);
  return out;
}
export function gameDirectory(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i].toLowerCase() === '--gamedir') return args[i + 1] || null;
    if (/^--gameDir=/i.test(args[i])) return args[i].slice(10);
  }
  return args.find(a => a.startsWith('-Duser.dir='))?.slice(11) || null;
}
export function classifyProcess(p) {
  const name = p.name.toLowerCase().replace(/\.exe$/, '');
  if (name === 'minecraft.windows' || (name === 'minecraft' && /minecraftuwp|minecraft for windows/i.test(p.path || ''))) return 'bedrock';
  if (!/^javaw?$/.test(name)) return null;
  const cmd = p.cmd || '';
  if (/net\.minecraft\.server\.|--launchTarget[=\s]+\S*server/i.test(cmd)) return null;
  return /net\.minecraft\.client\.|net\.(fabricmc|quiltmc)\.[^\s]*KnotClient|cpw\.mods\.(modlauncher\.Launcher|bootstraplauncher\.BootstrapLauncher)|net\.minecraft\.launchwrapper\.Launch|org\.(multimc|prismlauncher)\.EntryPoint/i.test(cmd) ? 'java' : null;
}
export function publicTitle(mode, count = 1) {
  if (count > 1) return 'Minecraft — Multiple games';
  return `Minecraft — ${LABELS[mode] || LABELS.unknown}`;
}
export class Activity {
  constructor({ ttlMs = 7000, closeMs = 4000 } = {}) { this.ttlMs = ttlMs; this.closeMs = closeMs; this.games = new Map(); this.reports = new Map(); this.lastGame = null; }
  scan(processes, now = Date.now()) {
    this.games = new Map(processes.flatMap(p => {
      const edition = classifyProcess(p);
      return edition ? [[p.pid, { pid: p.pid, edition, identity: p.start || '', directory: gameDirectory(p.argv || argumentsOf(p.cmd || '')) }]] : [];
    }));
    if (this.games.size) this.lastGame = now;
    for (const [pid, report] of this.reports) {
      if (!this.games.has(pid) || report.identity !== this.games.get(pid).identity) this.reports.delete(pid);
    }
  }
  report({ pid, mode }, now = Date.now(), source = 'sensor') {
    if (!Number.isInteger(pid) || !this.games.has(pid) || !MODES.includes(mode)) return false;
    this.reports.set(pid, { mode, at: now, source, identity: this.games.get(pid).identity }); return true;
  }
  snapshot(now = Date.now()) {
    if (!this.games.size) return { active: this.lastGame !== null && now - this.lastGame < this.closeMs, mode: 'unknown', count: 0, source: 'process', games: [] };
    const games = [...this.games.values()].map(g => {
      const r = this.reports.get(g.pid);
      return { ...g, mode: r && now - r.at < this.ttlMs ? r.mode : 'unknown', source: r && now - r.at < this.ttlMs ? r.source : 'process' };
    });
    return { active: true, mode: games.length === 1 ? games[0].mode : 'unknown', count: games.length, source: games.length === 1 ? games[0].source : 'multiple', games };
  }
}
export function normalizedDirectory(directory, platform = process.platform) {
  const api = platform === 'win32' ? path.win32 : path.posix;
  if (!directory || !api.isAbsolute(directory)) return null;
  const value = api.normalize(directory);
  return platform === 'win32' ? value.toLowerCase() : value;
}
