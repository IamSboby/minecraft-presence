import { app, BrowserWindow, Menu, Tray, nativeImage, safeStorage, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { startHub } from '../src/main.js';
import { Credentials } from '../src/credentials.js';

app.setName('Minecraft Presence');
// A distinct, predictable directory is also removed by the Windows uninstaller.
const dataDirectory = path.join(app.getPath('appData'), 'Minecraft Presence');
fs.mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', dataDirectory);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window, tray, hub, quitting = false;
  const show = () => { if (window) { window.show(); if (window.isMinimized()) window.restore(); window.focus(); } };
  app.on('second-instance', show);
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { quitting = true; hub?.shutdown(); });
  // Let entry-module evaluation finish before Electron emits ready.
  app.whenReady().then(async () => {
  try {
    hub = await startHub({
      dataDirectory: app.getPath('userData'),
      resourceRoot: app.isPackaged ? process.resourcesPath : undefined,
      credentials: new Credentials(path.join(app.getPath('userData'), 'steam-session.bin'), safeStorage),
      setStartAtLogin: enabled => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled, name: 'Minecraft Presence', path: process.execPath, args: ['--background'] }); },
      onQuit: () => { if (!quitting) app.quit(); }
    });
    window = new BrowserWindow({ width: 1120, height: 850, minWidth: 760, minHeight: 600, show: false, backgroundColor: '#0c1510', autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: !app.isPackaged } });
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const origin = new URL(hub.url).origin;
    window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.on('close', event => { if (!quitting) { event.preventDefault(); window.hide(); } });
    // Original small block icon. No Minecraft trademarks or game assets bundled.
    const pixels = Buffer.alloc(24 * 24 * 4);
    for (let y = 3; y < 21; y++) for (let x = 3; x < 21; x++) {
      const i = (y * 24 + x) * 4; const green = y < 9;
      pixels[i] = green ? 88 : 66; pixels[i+1] = green ? 194 : 96; pixels[i+2] = green ? 126 : 72; pixels[i+3] = 255;
    }
    tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 24, height: 24, scaleFactor: 1 }));
    tray.setToolTip('Minecraft Presence');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Minecraft Presence', click: show }, { type: 'separator' }, { label: 'Quit', click: () => app.quit() }]));
    tray.on('double-click', show);
    await window.loadURL(hub.url);
    if (!process.argv.includes('--background') || hub.steam.state === 'disconnected') show();
  } catch {
    dialog.showErrorBox('Minecraft Presence', 'Could not start. Close the previous Minecraft Presence app or local panel, then try again.');
    app.quit();
  }
  }).catch(() => {
    dialog.showErrorBox('Minecraft Presence', 'The app could not initialize. Please restart Minecraft Presence.');
    app.quit();
  });
}
