import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {Registry} from '../src/system.js';
import { expandLaunchArguments, argumentFileTokens } from '../src/launch-arguments.js';
import { Activity } from '../src/core.js';

test('portable instance containers discover new profiles and choose the actual game folder',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'presence-launchers-'));
 try {
  const registry=new Registry(path.join(root,'registry.json'));
  const instance=path.join(root,'instances','Optimized');
  await fs.mkdir(path.join(instance,'.minecraft'),{recursive:true});
  await fs.writeFile(path.join(instance,'instance.cfg'),'name=Optimized\n');
  await registry.discover([root]); await registry.discover([root]);
  assert.equal(registry.items.length,1); assert.equal(registry.items[0].directory,path.join(instance,'.minecraft'));
  const added=path.join(root,'instances','Added later'); await fs.mkdir(added); await fs.writeFile(path.join(added,'instance.json'),'{}');
  await registry.discover([root]); assert.equal(registry.items.length,2);
 } finally { await fs.rm(root,{recursive:true,force:true}); }
});

test('Java argfiles identify clients and directories; missing, oversized and nested files are bounded',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'presence-args-'));
 try {
  const file=path.join(root,'launch.txt');const directory=path.join(root,'External instance');
  await fs.writeFile(file,`# game arguments\ncpw.mods.bootstraplauncher.BootstrapLauncher\n--launchTarget neoforgeclient\n--gameDir "${directory.replaceAll('\\','\\\\')}"\n`);
  const process={pid:12,name:'javaw.exe',cmd:'',argv:['javaw.exe',`@${file}`],start:'A'};
  const list=await expandLaunchArguments([process]); const activity=new Activity();activity.scan(list);
  assert.equal(activity.games.get(12).directory,directory);
  const relative=await expandLaunchArguments([{...process,argv:[`-Duser.dir=${root}`,'@launch.txt']}]);assert.ok(relative[0].argv.includes('--gameDir'));
  const disabled=await expandLaunchArguments([{...process,argv:['--disable-@files',`@${file}`]}]);assert.ok(disabled[0].argv.includes(`@${file}`));
  await fs.writeFile(file,`@${path.join(root,'nested.txt')}`); await fs.writeFile(path.join(root,'nested.txt'),'net.minecraft.client.main.Main');
  const nested=await expandLaunchArguments([process]);activity.scan(nested);assert.equal(activity.games.size,0);
  await fs.writeFile(file,'x'.repeat(1024*1024+1));assert.deepEqual((await expandLaunchArguments([process]))[0].argv,process.argv);
  assert.equal((await expandLaunchArguments([{...process,argv:['@missing.txt']}]))[0].argv[0],'@missing.txt');
  assert.deepEqual(argumentFileTokens("'two words' # comment\n--version 1.21"),['two words','--version','1.21']);
 } finally { await fs.rm(root,{recursive:true,force:true}); }
});
test('new profiles and external directories persist without credentials or duplicates',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'presence-test-'));
 try{
 const registry=new Registry(path.join(root,'instances.json'));await registry.load();
 const profiles=path.join(root,'launcher_profiles.json');const external=path.join(root,'elsewhere');
 await fs.writeFile(profiles,JSON.stringify({profiles:{a:{name:'New',gameDir:external,accessToken:'must-not-persist'}}}));
 await registry.discover([root]);await registry.discover([root]);assert.equal(registry.items.length,1);
 await fs.writeFile(profiles,JSON.stringify({profiles:{a:{name:'New',gameDir:external},b:{name:'Added later',gameDir:path.join(root,'other')}}}));
 await registry.discover([root]);assert.equal(registry.items.length,2);
 const data=await fs.readFile(registry.file,'utf8');assert.ok(!data.includes('must-not-persist'));const reload=new Registry(registry.file);await reload.load();assert.equal(reload.items.length,2);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
