import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizedDirectory } from './core.js';
const exec = promisify(execFile);

export async function processes(resourceRoot) {
  if (process.platform === 'win32') {
    const helper=path.join(resourceRoot || path.dirname(path.dirname(fileURLToPath(import.meta.url))),'native','dist','ProcessScanner.exe');
    try {
      await fs.access(helper);
      const {stdout}=await exec(helper,[],{windowsHide:true,timeout:10000,maxBuffer:4*1024*1024});
      const result=JSON.parse(stdout);if(result.inaccessible)throw new Error('Process metadata unavailable');return result.processes;
    } catch(e) {if(e.code!=='ENOENT')throw e;}
    // Filter in the OS: never return command lines of unrelated programs.
    const script = "$ErrorActionPreference='Stop'; $sid=(Get-Process -Id $PID).SessionId; @(Get-CimInstance Win32_Process -Filter \"Name='java.exe' OR Name='javaw.exe' OR Name='Minecraft.Windows.exe' OR Name='Minecraft.exe'\" | Where-Object {$_.SessionId -eq $sid} | Select-Object @{n='pid';e={[int]$_.ProcessId}},@{n='name';e={$_.Name}},@{n='path';e={$_.ExecutablePath}},@{n='cmd';e={$_.CommandLine}},@{n='start';e={[string]$_.CreationDate}}) | ConvertTo-Json -Compress";
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 12000, maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim() ? [].concat(JSON.parse(stdout)) : [];
  }
  const { stdout } = await exec('ps', ['-ww', '-U', String(process.getuid()), '-o', 'pid=,comm='], { timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
  const candidates = stdout.split('\n').flatMap(line => {
    const m = line.trim().match(/^(\d+)\s+(.+)$/);
    return m && /^javaw?$/.test(path.basename(m[2])) ? [{pid:Number(m[1]),name:path.basename(m[2]),path:m[2]}] : [];
  });
  const result=[];
  for(const p of candidates) try {
    if(process.platform==='linux') {
      const argv=(await fs.readFile(`/proc/${p.pid}/cmdline`,'utf8')).split('\0').filter(Boolean);
      const stat=await fs.readFile(`/proc/${p.pid}/stat`,'utf8');
      result.push({...p,path:await fs.readlink(`/proc/${p.pid}/exe`),argv,cmd:argv.join(' '),start:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]});
    } else {
      const details=await exec('ps',['-ww','-p',String(p.pid),'-o','lstart=,args='],{timeout:3000,maxBuffer:1048576});
      const match=details.stdout.trim().match(/^(.{24})\s+(.+)$/);
      if(match)result.push({...p,start:match[1],cmd:match[2]});
    }
  }catch(e){if(e.code!=='ENOENT'&&e.code!=='ESRCH'&&e.code!=='EACCES')throw e;}
  return result;
}
export function defaultRoots() {
  const home = os.homedir();
  if (process.platform === 'win32') return [path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), '.minecraft')];
  if (process.platform === 'darwin') return [path.join(home, 'Library', 'Application Support', 'minecraft')];
  return [path.join(home, '.minecraft')];
}
export async function atomicJSON(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.rename(temporary, file);
}
export class Registry {
  constructor(file) { this.file = file; this.items = []; }
  async load() {
    try { const v = JSON.parse(await fs.readFile(this.file, 'utf8')); if (Array.isArray(v)) this.items = v; }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('Could not read the instance list. Keep the file for recovery.'); }
  }
  async add(directory, name, source) {
    const key = normalizedDirectory(directory);
    if (!key || this.items.some(i => normalizedDirectory(i.directory) === key && (source === 'process' || i.name === name))) return;
    const item = { directory, name: name || path.basename(directory), source, discovered: new Date().toISOString() };
    await atomicJSON(this.file, [...this.items, item]); this.items.push(item);
  }
  async discover(roots) {
    for (const root of roots) {
      for (const filename of ['launcher_profiles.json', 'launcher_profiles_microsoft_store.json']) {
        let data;
        try { data = JSON.parse(await fs.readFile(path.join(root, filename), 'utf8')); }
        catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) continue; throw e; }
        for (const [id, profile] of Object.entries(data.profiles || {})) {
          if (profile && typeof profile === 'object') await this.add(profile.gameDir || root, profile.name || profile.type || id, 'launcher');
        }
      }
      // A configured root may itself be an instance, independent of its launcher.
      try { await fs.access(path.join(root, 'logs')); await this.add(root, path.basename(root), 'process'); } catch {}
    }
  }
}
