import fs from 'node:fs/promises';
import path from 'node:path';

// Electron safeStorage uses the signed-in Windows user's DPAPI protection.
// Serialize mutations so a pending save cannot recreate a signed-out session.
export class Credentials {
  constructor(file, safeStorage) { this.file = file; this.safeStorage = safeStorage; this.pending = Promise.resolve(); }
  enqueue(action) { const next = this.pending.then(action, action); this.pending = next.catch(() => {}); return next; }
  load() { return this.enqueue(async () => {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Windows encryption unavailable');
    try { return this.safeStorage.decryptString(await fs.readFile(this.file)); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Saved session unavailable'); }
  }); }
  save(token) { return this.enqueue(async () => {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Windows encryption unavailable');
    const encrypted = this.safeStorage.encryptString(token);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temporary = this.file + '.tmp';
    await fs.writeFile(temporary, encrypted, { mode: 0o600 });
    await fs.rename(temporary, this.file);
  }); }
  clear() { return this.enqueue(async () => { await fs.rm(this.file, { force: true }); await fs.rm(this.file + '.tmp', { force: true }); }); }
}
