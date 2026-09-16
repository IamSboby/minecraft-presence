import path from 'node:path';
import { bedrockIdentity } from './bedrock.js';

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
  return args.find(a => a.startsWith('-Duser.dir='))?.slice(11)
    || args.find(a => a.startsWith('-Dminecraft.applet.TargetDirectory='))?.split('=').slice(1).join('=') || null;
}
export function classifyProcess(p) {
  const name = p.name.toLowerCase().replace(/\.exe$/, '');
  if (bedrockIdentity(p)) return 'bedrock';
  if (!/^javaw?$/.test(name)) return null;
  const args = p.argv || argumentsOf(p.cmd || '');
  const target = args.flatMap((a, i) => /^--launchTarget$/i.test(a) ? [args[i + 1] || ''] : /^--launchTarget=/i.test(a) ? [a.split('=').slice(1).join('=')] : []);
  // Match entire class tokens, never names embedded in classpaths or launcher paths.
  if (target.some(t => /server|data/i.test(t)) || args.some(a => /^net\.minecraft\.server\./.test(a) || /(?:ServerTweaker|ServerMain)$/.test(a))) return null;
  const client = /^(?:net\.minecraft\.client\.(?:main\.Main|Minecraft)|net\.(?:fabricmc|quiltmc)\.loader\.(?:impl\.)?launch\.knot\.KnotClient|net\.minecraft\.launchwrapper\.Launch|org\.(?:multimc|prismlauncher)\.(?:EntryPoint|onesix\.OneSixLauncher)|org\.tlauncher\.Launch\d[\w.]*)$/;
  if (args.some(a => client.test(a))) return 'java';
  const bootstrap = /^(?:cpw\.mods\.(?:modlauncher\.Launcher|bootstraplauncher\.BootstrapLauncher)|net\.(?:minecraftforge|neoforged)\.bootstrap\.(?:ForgeBootstrap|Bootstrap))$/;
  return args.some(a => bootstrap.test(a)) && target.some(t => /client/i.test(t)) ? 'java' : null;
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
      return edition ? [[p.pid, { pid: p.pid, edition, identity: p.start || '', directory: edition === 'java' ? gameDirectory(p.argv || argumentsOf(p.cmd || '')) : null, ...(edition === 'bedrock' ? { bedrock: bedrockIdentity(p) } : {}) }]] : [];
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
