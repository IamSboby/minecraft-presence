import test from 'node:test';
import assert from 'node:assert/strict';
import { bedrockIdentity, bedrockDataRoots, bedrockSensorStatus } from '../src/bedrock.js';
import { Activity, classifyProcess, publicTitle } from '../src/core.js';

const game = { pid: 20, name: 'Minecraft.Windows.exe', start: 'A' };
test('Bedrock retail, Preview, package identity, GDK and custom layouts', () => {
  for(const p of [
    {...game,path:'C:\\Program Files\\WindowsApps\\Microsoft.MinecraftUWP_1.21_x64__8wekyb3d8bbwe\\Minecraft.Windows.exe'},
    {...game,name:'Minecraft.exe',packageFamily:'Microsoft.MinecraftUWP_8wekyb3d8bbwe'},
    {...game,name:'Minecraft.exe',path:'D:\\XboxGames\\Minecraft for Windows\\Content\\Minecraft.exe'},
    {...game,path:'D:\\Custom install\\Minecraft.Windows.exe'}
  ]) assert.equal(classifyProcess(p),'bedrock');
  const preview={...game,name:'MinecraftPreview.exe',packageFamily:'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe',version:'1.21.120.21'};
  assert.equal(bedrockIdentity(preview).channel,'preview');assert.equal(bedrockIdentity(preview).version,'1.21.120.21');
  assert.equal(bedrockIdentity({...game,name:'Minecraft.exe',path:'D:\\Minecraft Preview\\Content\\Minecraft.exe'}).channel,'preview');
  assert.equal(bedrockIdentity({...game,path:'D:\\XboxGames\\Minecraft for Windows\\Content\\Minecraft.Windows.exe'}).layout,'gdk');
  assert.ok(bedrockSensorStatus({bedrock:bedrockIdentity(preview)}).includes('manual selection'));
});
test('Bedrock launcher, server, unrelated executable and incorrect package exclusions', () => {
  for(const p of [
    {...game,name:'Minecraft.exe',path:'C:\\XboxGames\\Minecraft Launcher\\Minecraft.exe',packageFamily:'Microsoft.MinecraftUWP_8wekyb3d8bbwe'},
    {...game,name:'GameLaunchHelper.exe',packageFamily:'Microsoft.MinecraftUWP_8wekyb3d8bbwe'},
    {...game,name:'bedrock_server.exe'}, {...game,name:'Minecraft.exe',path:'D:\\Other\\Minecraft.exe'},
    {...game,name:'MinecraftPreview.exe',packageFamily:'Other.MinecraftWindowsBeta_8wekyb3d8bbwe'},
    {...game,name:'Minecraft.exe',path:'D:\\Minecraft for Windows unrelated\\Minecraft.exe'}
  ]) assert.equal(classifyProcess(p),null);
});
test('Bedrock lifecycle, PID reuse, multiple clients and private generic manual states', () => {
  const activity=new Activity();activity.scan([game],0);
  assert.equal(activity.snapshot(0).mode,'unknown'); assert.equal(publicTitle(activity.snapshot(0).mode),'Minecraft — Playing');
  for(const mode of ['menu','singleplayer','multiplayer']) { assert.equal(activity.report({pid:20,mode},1,'manual'),true);assert.equal(activity.snapshot(2).mode,mode); }
  assert.equal(activity.report({pid:20,mode:'private world name'}),false);
  activity.scan([{...game,start:'B'}],3);assert.equal(activity.snapshot(3).mode,'unknown');
  activity.scan([game,{...game,pid:21,packageFamily:'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe'}],4);assert.equal(activity.snapshot(4).count,2);
  activity.scan([{pid:30,name:'Minecraft.exe',path:'C:\\Minecraft Launcher\\Minecraft.exe'}],5);assert.equal(activity.snapshot(4005).active,false);
});
test('Bedrock data locations cover retail and Preview without inspecting world names', () => {
  const env={APPDATA:'C:\\Roaming',LOCALAPPDATA:'C:\\Local'};
  assert.deepEqual(bedrockDataRoots('retail',env),['C:\\Roaming\\Minecraft Bedrock','C:\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang']);
  assert.ok(bedrockDataRoots('preview',env)[0].endsWith('Minecraft Bedrock Preview'));
  assert.deepEqual(bedrockDataRoots('retail',{}),[]);
});
