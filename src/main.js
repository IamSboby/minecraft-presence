import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Activity, publicTitle, MODES } from './core.js';
import { Registry, processes, defaultRoots, atomicJSON } from './system.js';
import { SteamBridge } from './steam.js';
import { Sensors } from './sensor.js';

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function startHub(options = {}) {
const dir = path.resolve(options.dataDirectory || process.env.MCPRESENCE_DATA || path.join(os.homedir(), '.minecraft-private-presence'));
await fs.mkdir(dir, { recursive: true });
const configFile = path.join(dir, 'config.json');
let config = { roots: defaultRoots(), port: 38471, autoSensor: true, javaCommand: '', startAtLogin: true };
try { config = { ...config, ...JSON.parse(await fs.readFile(configFile, 'utf8')) }; } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (!Array.isArray(config.roots) || !config.roots.every(r => typeof r === 'string' && path.isAbsolute(r)) || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw new Error('Invalid configuration');
const token = crypto.randomBytes(32).toString('hex');
const activity = new Activity(); const registry = new Registry(path.join(dir, 'instances.json')); await registry.load();
const steam = new SteamBridge(options.credentials);
const sensors = new Sensors(path.join(options.resourceRoot || appRoot, 'sensor', 'dist', 'presence-sensor.jar'), path.join(dir, 'sensor.properties'), path.join(options.resourceRoot || appRoot, 'runtime', 'bin', 'java.exe'));
let scanError = null, lastScan = 0, lastDiscover = 0, closing = false, manual = new Map();
const origin = `http://127.0.0.1:${config.port}`;

async function tick() {
  try {
    const list = await processes(options.resourceRoot); const now = Date.now(); activity.scan(list, now); lastScan = now; scanError = null;
    for (const game of activity.games.values()) if (game.directory) await registry.add(game.directory, '', 'process');
    if (now - lastDiscover > 10000) { await registry.discover(config.roots); lastDiscover = now; }
    for (const [pid, mode] of manual) { if (!activity.games.has(pid)) manual.delete(pid); else activity.report({ pid, mode }, now, 'manual'); }
    steam.update(activity.snapshot());
    await sensors.update(activity.games, list, config);
  } catch { scanError = 'Could not update game detection. Activity will clear if this continues.'; if (Date.now() - lastScan > 15000) steam.update({ active: false }); }
  if (!closing) setTimeout(tick, 2000);
}
async function body(req) {
  let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 16384) throw new Error('too-large'); }
  return JSON.parse(value || '{}');
}
function send(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
const server = http.createServer(async (req, res) => {
  // Host + origin + session token prevent another website from controlling the loopback service.
  if (req.headers.host !== `127.0.0.1:${config.port}`) return send(res, 403, { error: 'host' });
  if (req.headers.origin && req.headers.origin !== origin) return send(res, 403, { error: 'origin' });
  const url = new URL(req.url, origin);
  const staticFiles = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
  if (req.method === 'GET' && staticFiles[url.pathname]) {
    const [file, type] = staticFiles[url.pathname];
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' });
    return res.end(await fs.readFile(path.join(appRoot, 'ui', file)));
  }
  const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
  if (!/^[0-9a-f]{64}$/.test(supplied) || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) return send(res, 401, { error: 'authorization' });
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, { activity: activity.snapshot(), title: activity.snapshot().active ? publicTitle(activity.snapshot().mode, activity.snapshot().count) : null, steam: steam.state, steamError:steam.error, qr: steam.qr, config, desktop: !!options.credentials, instances: registry.items, sensors: Object.fromEntries(sensors.status), scanError });
    if (req.method !== 'POST') return send(res, 404, {});
    const data = await body(req);
    if (url.pathname === '/api/telemetry') {
      if (Object.keys(data).some(k => !['pid', 'mode'].includes(k))) return send(res, 400, { error: 'Only pid and mode are accepted; never names or addresses.' });
      return send(res, activity.report(data) ? 200 : 422, {});
    }
    if (url.pathname === '/api/config') {
      if (!Array.isArray(data.roots) || data.roots.length > 100 || !data.roots.every(r => typeof r === 'string' && r.length < 4096 && path.isAbsolute(r))) return send(res, 400, { error: 'Use full folder paths.' });
      if(typeof data.autoSensor !== 'boolean' || typeof data.javaCommand !== 'string' || (data.javaCommand && !path.isAbsolute(data.javaCommand))) return send(res, 400, {error:'Enter the full path to java.exe.'});
      const next = { ...config, roots: [...new Set(data.roots)], autoSensor:data.autoSensor, javaCommand:data.javaCommand, startAtLogin: typeof data.startAtLogin === 'boolean' ? data.startAtLogin : config.startAtLogin }; await options.setStartAtLogin?.(next.startAtLogin); await atomicJSON(configFile, next); config = next; lastDiscover = 0; return send(res, 200, {});
    }
    if (url.pathname === '/api/manual') {
      if (!activity.games.has(data.pid) || (data.mode !== 'auto' && !MODES.includes(data.mode))) return send(res, 422, {});
      if (data.mode === 'auto') { manual.delete(data.pid); activity.reports.delete(data.pid); } else manual.set(data.pid, data.mode);
      return send(res, 200, {});
    }
    if (url.pathname === '/api/login') { if (!['waiting', 'connecting', 'connected', 'blocked'].includes(steam.state)) await steam.login(); return send(res, 200, {}); }
    if (url.pathname === '/api/logout') { await steam.logout(); return send(res, 200, {}); }
    if (url.pathname === '/api/stop') { send(res, 200, {}); return shutdown(); }
    return send(res, 404, {});
  } catch { return send(res, 400, { error: 'Could not complete this action.' }); }
});
async function shutdown() { if (closing) return; closing = true; steam.disconnect(); server.close(); options.onQuit?.(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'The port is busy. Minecraft Presence may already be open.' : 'Could not start the local panel.'); process.exitCode = 1; closing = true; });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', resolve); });
  await fs.writeFile(path.join(dir, 'sensor.properties'), `url=${origin}\ntoken=${token}\n`, { mode: 0o600 });
  await fs.writeFile(path.join(dir, 'panel.url'), `${origin}/#${token}`, { mode: 0o600 });
  console.log(`Panel available at ${origin}. Open the link in panel.url in your data folder.`);
  await options.setStartAtLogin?.(config.startAtLogin);
  const ready = steam.restore().catch(() => {});
  tick();
  return { url: `${origin}/#${token}`, shutdown, steam, ready };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await startHub();
