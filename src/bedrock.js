import path from 'node:path';

// Identity comes from Windows package metadata or a known client executable/layout.
// GameLaunchHelper, the launcher and dedicated servers never count as a game.
export function bedrockIdentity(process) {
  const name = (process.name || '').toLowerCase().replace(/\.exe$/, '');
  if (!['minecraft.windows', 'minecraft', 'minecraftpreview', 'minecraft.windowsbeta'].includes(name)) return null;
  const file = (process.path || '').replaceAll('/', '\\');
  if (/\\(?:minecraft launcher|minecraftlauncher)(?:\\|$)/i.test(file)) return null;
  const family = process.packageFamily || '';
  const previewPackage = /^Microsoft\.MinecraftWindowsBeta_8wekyb3d8bbwe$/i.test(family);
  const retailPackage = /^Microsoft\.MinecraftUWP_8wekyb3d8bbwe$/i.test(family);
  const previewPath = /\\(?:Microsoft\.MinecraftWindowsBeta_[^\\]+|Minecraft (?:for Windows )?Preview)(?:\\|$)/i.test(file);
  const retailPath = /\\(?:Microsoft\.MinecraftUWP_[^\\]+|Minecraft for Windows|Minecraft Bedrock)(?:\\|$)/i.test(file);
  if (!previewPackage && !retailPackage && !previewPath && !retailPath && name !== 'minecraft.windows') return null;
  const channel = previewPackage || previewPath || name === 'minecraft.windowsbeta' ? 'preview' : 'retail';
  const layout = /\\WindowsApps\\/i.test(file) ? 'packaged' : /\\(?:XboxGames|Content|Contents)\\/i.test(file) ? 'gdk' : 'custom';
  return { channel, layout, version: typeof process.version === 'string' ? process.version : null };
}

export function bedrockDataRoots(channel, env = process.env) {
  const roaming = env.APPDATA;
  const local = env.LOCALAPPDATA;
  const family = channel === 'preview' ? 'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe' : 'Microsoft.MinecraftUWP_8wekyb3d8bbwe';
  return [
    roaming && path.win32.join(roaming, channel === 'preview' ? 'Minecraft Bedrock Preview' : 'Minecraft Bedrock'),
    local && path.win32.join(local, 'Packages', family, 'LocalState', 'games', 'com.mojang')
  ].filter(Boolean);
}

export function bedrockSensorStatus(game) {
  const channel = game.bedrock?.channel === 'preview' ? 'Preview' : 'Retail';
  const version = game.bedrock?.version ? ` ${game.bedrock.version}` : '';
  return `${channel}${version} detected. Automatic open/close is active. Detailed states need manual selection; no compatible native state sensor is loaded.`;
}
