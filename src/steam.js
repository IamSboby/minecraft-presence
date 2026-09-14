import { publicTitle } from './core.js';
export function authErrorText(error) {
  const code = String(error?.code || error?.cause?.code || '');
  const message = String(error?.message || '');
  if (/EACCES|EPERM/.test(code)) return 'Windows blocked network access for this app.';
  if (/CERT|TLS|SSL/.test(code)) return 'Could not verify the secure connection to Steam.';
  if (/ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONN|ENET|EHOST/.test(code) || /timeout|timed out|network|socket|CM server/i.test(message)) return 'Could not reach Steam. Check your connection and try again.';
  if (Number.isInteger(error?.eresult)) return `Steam rejected authorization (code ${error.eresult}). Please try again.`;
  return 'Steam authorization failed. Generate a new QR code.';
}

export class SteamBridge {
  constructor(credentials) { this.credentials = credentials; this.state = 'disconnected'; this.desired = null; this.last = undefined; this.qr = null; this.generation = 0; this.error = null; }
  async restore() {
    if (!this.credentials) return;
    const generation = this.generation;
    try { const token = await this.credentials.load(); if (token && generation === this.generation) await this.connect(token, generation); }
    catch { this.error = 'Your saved session could not be opened. Please sign in again.'; }
  }
  async connect(token, generation = this.generation) {
    const { default: SteamUser } = await import('steam-user');
    if (generation !== this.generation) return;
    this.state = 'connecting';
    const client = new SteamUser({ dataDirectory: null, autoRelogin: true }); this.client = client;
    client.on('loggedOn', () => {
      if (this.client !== client) return;
      this.onLoggedOn(client, SteamUser.EPersonaState.Online);
      this.credentials?.save(token).catch(() => { if (this.client === client) this.error = 'Connected, but Windows could not save your session. You will need to sign in after restarting.'; });
    });
    client.on('refreshToken', next => { if (this.client === client) { token = next; this.credentials?.save(next).catch(() => { this.error = 'Your session could not be saved.'; }); } });
    client.on('playingState', blocked => { if(this.client!==client)return; this.state = blocked ? 'blocked' : 'connected'; this.last=undefined; if (!blocked) this.flush(); });
    client.on('disconnected', () => { if(this.client!==client)return; this.state = 'disconnected'; this.last = undefined; });
    client.on('error', error => { if(this.client!==client)return; this.state = 'connection-error'; this.last = undefined; this.error=authErrorText(error); });
    client.logOn({ refreshToken: token });
  }
  async login() {
    this.disconnect(); const generation = this.generation;
    const [{ LoginSession, EAuthTokenPlatformType }, { default: QRCode }] = await Promise.all([import('steam-session'), import('qrcode')]);
    if(generation !== this.generation) return;
    const auth = new LoginSession(EAuthTokenPlatformType.SteamClient); this.auth = auth; this.state = 'waiting';
    auth.on('error', error => { if (generation === this.generation) { this.state = 'auth-error'; this.qr = null; this.error=authErrorText(error); } });
    auth.on('timeout', () => { if (generation === this.generation) { this.state = 'expired'; this.qr = null; } });
    auth.on('authenticated', () => {
      if (generation !== this.generation) return;
      this.qr = null;
      this.connect(auth.refreshToken, generation).catch(() => { if (generation === this.generation) { this.state = 'connection-error'; this.error = 'Could not connect to Steam. Please try again.'; } });
    });
    try {
      const result = await auth.startWithQR();
      const qr=await QRCode.toDataURL(result.qrChallengeUrl, { margin: 2, width: 256 });
      if (generation === this.generation && this.state==='waiting') this.qr=qr;
    } catch(error) { if(generation === this.generation) {this.state = 'auth-error';this.qr=null;this.error=authErrorText(error);} }
  }
  onLoggedOn(client, onlineState) {
    if(this.client !== client) return;
    // SteamUser starts offline. Announce the session before publishing activity.
    client.setPersona(onlineState);
    this.state = 'connected'; this.error=null; this.last = undefined; this.flush();
  }
  update(snapshot) { this.desired = snapshot.active ? publicTitle(snapshot.mode, snapshot.count) : null; this.flush(); }
  flush() {
    if (!this.client || this.state !== 'connected' || this.client.playingState?.blocked || this.desired === this.last) return;
    this.last = this.desired;
    this.client.gamesPlayed(this.desired ? [this.desired] : [], false);
  }
  disconnect() {
    this.generation++; this.auth?.cancelLoginAttempt(); this.auth = null;
    if (this.client) { try { this.client.gamesPlayed([], false); this.client.logOff(); } catch {} }
    this.client = null; this.qr = null; this.state = 'disconnected'; this.last = undefined; this.error=null;
  }
  async logout() { this.disconnect(); await this.credentials?.clear(); }
}
