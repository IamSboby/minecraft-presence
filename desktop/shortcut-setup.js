import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { installLauncherShortcut } from '../src/shortcuts.js';
import { atomicJSON } from '../src/system.js';

const execute = promisify(execFile);
async function exists(file) { try { return (await fs.stat(file)).isFile(); } catch { return false; } }
export async function launcherTarget(launcher, windowsDirectory = process.env.WINDIR || 'C:\\Windows') {
  const directory = path.dirname(launcher);
  let manifest = '';
  try { manifest = await fs.readFile(path.join(directory, 'AppxManifest.xml'), 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (/<Identity\b[^>]*\bName="Microsoft\.4297127D64EC6"/i.test(manifest) && /<Application\b[^>]*\bId="Minecraft"/i.test(manifest)) {
    return { executable: path.join(windowsDirectory, 'explorer.exe'), directory: windowsDirectory,
      options: { launchOptions: 'shell:AppsFolder\\Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft', previousExecutable: launcher, icon: launcher } };
  }
  if (path.basename(launcher).toLowerCase() === 'gamelaunchhelper.exe') throw new Error('Could not identify the Minecraft Store installation. Select the launcher from its original installation folder.');
  return { executable: launcher, directory, options: {} };
}
export async function steamRunning() {
  const { stdout } = await execute('tasklist.exe', ['/FI', 'IMAGENAME eq steam.exe', '/FO', 'CSV', '/NH'], { windowsHide: true });
  return /^"steam\.exe"/im.test(stdout);
}
export async function steamSessionRunning() {
  const { stdout } = await execute('tasklist.exe', ['/FI', 'IMAGENAME eq SteamSession.exe', '/FO', 'CSV', '/NH'], { windowsHide: true });
  return /^"SteamSession\.exe"/im.test(stdout);
}
export function createShortcutSetup({ dialog, getWindow, dataDirectory, sessionExecutable }) {
  let busy = false, firstRunPromise;
  const message = options => getWindow() ? dialog.showMessageBox(getWindow(), options) : dialog.showMessageBox(options);
  const pick = options => getWindow() ? dialog.showOpenDialog(getWindow(), options) : dialog.showOpenDialog(options);
  async function add() {
    if (busy) return { message: 'Shortcut setup is already open.' };
    busy = true;
    try {
      if (process.platform !== 'win32') throw new Error('Steam shortcut setup is available on Windows only.');
      let steamPath;
      try {
        const { stdout } = await execute('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true });
        steamPath = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i)?.[1].trim();
      } catch { /* The file picker also supports non-standard Steam installs. */ }
      if (!steamPath || !await exists(path.join(steamPath, 'steam.exe'))) {
        const choice = await pick({ title: 'Select Steam.exe', properties: ['openFile'], filters: [{ name: 'Steam executable', extensions: ['exe'] }] });
        if (choice.canceled) return { message: 'Shortcut setup canceled. You can try again in Preferences.' };
        if (path.basename(choice.filePaths[0]).toLowerCase() !== 'steam.exe') throw new Error('Select Steam.exe from your Steam installation.');
        steamPath = path.dirname(choice.filePaths[0]);
      }
      const userdata = path.join(steamPath, 'userdata');
      const accounts = (await fs.readdir(userdata, { withFileTypes: true })).filter(e => e.isDirectory() && /^[1-9]\d*$/.test(e.name));
      if (!accounts.length) throw new Error('Sign in to the Steam desktop app once, then retry setup.');
      let account = accounts[0].name;
      if (accounts.length > 1) {
        const choice = await pick({ title: 'Select your Steam account folder inside userdata', defaultPath: userdata, properties: ['openDirectory'] });
        if (choice.canceled) return { message: 'Shortcut setup canceled.' };
        const selected = path.resolve(choice.filePaths[0]);
        if (path.dirname(selected).toLowerCase() !== path.resolve(userdata).toLowerCase() || !accounts.some(a => a.name === path.basename(selected))) throw new Error('Choose one of the Steam account folders inside userdata.');
        account = path.basename(selected);
      }
      const candidates = [];
      for (const drive of 'CDEFGHIJKLMNOPQRSTUVWXYZ') candidates.push(`${drive}:\\XboxGames\\Minecraft Launcher\\Content\\gamelaunchhelper.exe`);
      for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean)) candidates.push(path.join(base, 'Minecraft Launcher', 'MinecraftLauncher.exe'));
      let launcher;
      for (const candidate of candidates) if (await exists(candidate)) { launcher = candidate; break; }
      const selection = await pick({ title: 'Select Minecraft Launcher (GameLaunchHelper.exe or MinecraftLauncher.exe)', defaultPath: launcher, properties: ['openFile'], filters: [{ name: 'Launcher executable', extensions: ['exe'] }] });
      if (selection.canceled) return { message: 'Shortcut setup canceled.' };
      launcher = selection.filePaths[0];
      if (!['gamelaunchhelper.exe', 'minecraftlauncher.exe', 'minecraft.exe'].includes(path.basename(launcher).toLowerCase())) throw new Error('Select the Minecraft Launcher executable.');
      const target = await launcherTarget(launcher);
      if (!sessionExecutable || !await exists(sessionExecutable)) throw new Error('The Steam session helper is missing. Reinstall Minecraft Presence.');
      if (await steamRunning()) {
        const result = await message({ type: 'info', title: 'Close Steam to add the shortcut', message: 'Choose Steam → Exit in the Steam desktop app, then click Continue.', detail: 'Your library needs to be closed while its shortcut file is updated. Steam will not be closed automatically.', buttons: ['Continue', 'Cancel'], defaultId: 0, cancelId: 1 });
        if (result.response === 1) return { message: 'Shortcut setup canceled.' };
      }
      const config = path.join(userdata, account, 'config');
      await fs.mkdir(config, { recursive: true });
      if (await steamRunning()) throw new Error('Exit Steam completely, then try again.');
      const sessionConfig = path.join(dataDirectory, 'steam-launcher.json');
      await atomicJSON(sessionConfig, { executable: target.executable, directory: target.directory, arguments: target.options.launchOptions || '' });
      const result = await installLauncherShortcut(path.join(config, 'shortcuts.vdf'), sessionExecutable, path.dirname(sessionExecutable), steamRunning, {
        launchOptions: `"${sessionConfig}"`, icon: launcher,
        previousTargets: [{ executable: target.executable, launchOptions: target.options.launchOptions || '' }, { executable: launcher, launchOptions: '' }],
        ownershipFile: path.join(dataDirectory, 'managed-shortcuts.json')
      });
      return { message: result.repaired ? 'Minecraft Launcher shortcut was repaired. Reopen Steam to try it.' : result.added ? 'Minecraft Launcher was added. Reopen Steam to see it in your library.' : 'This launcher is already in your Steam library.' };
    } catch (error) {
      return { error: error.code ? 'Could not access Steam or Minecraft Launcher. Check the selected installation and try again.' : error.message };
    } finally { busy = false; }
  }
  async function offerFirstRun() {
    const file = path.join(dataDirectory, 'shortcut-setup.json');
    try { if (JSON.parse(await fs.readFile(file, 'utf8')).offered) return; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const choice = await message({ type: 'question', title: 'Welcome to Minecraft Presence', message: 'Add Minecraft Launcher to Steam?', detail: 'Optional: add a library shortcut that opens Minecraft Launcher. You can also do this later in Preferences. This does not enable or guarantee Steam playtime tracking.', buttons: ['Add to Steam', 'Not now'], defaultId: 1, cancelId: 1 });
    await atomicJSON(file, { offered: true });
    if (choice.response === 0) {
      const result = await add();
      await message({ type: result.error ? 'error' : 'info', title: 'Steam shortcut', message: result.error || result.message });
    }
  }
  function firstRun() {
    if (!firstRunPromise) firstRunPromise = offerFirstRun().finally(() => { firstRunPromise = undefined; });
    return firstRunPromise;
  }
  return { add, firstRun };
}
