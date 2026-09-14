import test from 'node:test';import assert from 'node:assert/strict';
import { Activity, argumentsOf, gameDirectory, classifyProcess, publicTitle } from '../src/core.js';
const java=(pid=10)=>({pid,name:'javaw.exe',cmd:'javaw net.minecraft.client.main.Main --gameDir "D:\\Other games\\Fresh instance"',start:'A'});
test('external quoted directories and named loaders',()=>{
 assert.equal(gameDirectory(argumentsOf(java().cmd)),'D:\\Other games\\Fresh instance');
 for(const loader of ['net.fabricmc.loader.impl.launch.knot.KnotClient','net.quiltmc.loader.impl.launch.knot.KnotClient','cpw.mods.bootstraplauncher.BootstrapLauncher','org.multimc.EntryPoint']) assert.equal(classifyProcess({...java(),cmd:loader}),'java');
 assert.equal(classifyProcess({...java(),cmd:'java -jar unrelated.jar --gameDir D:\\foo'}),null);
 assert.equal(classifyProcess({...java(),cmd:'cpw.mods.modlauncher.Launcher --launchTarget forgeserver'}),null);
});
test('launcher never counts as playing; clear after game closes with launcher still running',()=>{
 const a=new Activity();const launcher={pid:20,name:'Minecraft.exe',path:'C:\\XboxGames\\Minecraft Launcher\\Minecraft.exe'};
 a.scan([launcher],0);assert.equal(a.snapshot(0).active,false);
 a.scan([java(),launcher],100);a.report({pid:10,mode:'singleplayer'},100);assert.equal(a.snapshot(101).mode,'singleplayer');
 a.scan([launcher],200);assert.equal(a.snapshot(4200).active,false);
});
test('heartbeat expiry, closed process, PID reuse, and multiple instances',()=>{
 const a=new Activity();a.scan([java()],0);a.report({pid:10,mode:'multiplayer'},1);assert.equal(a.snapshot(8000).mode,'unknown');
 a.scan([{...java(),start:'B'}],8001);assert.equal(a.snapshot(8001).mode,'unknown');
 a.scan([java(),java(11)],9000);assert.equal(a.snapshot(9000).count,2);
 a.scan([java(11)],10000);assert.equal(a.snapshot(10000).active,true);
 assert.equal(a.report({pid:999,mode:'menu'}),false);assert.equal(a.report({pid:11,mode:'my secret server'}),false);
});
test('only fixed generic strings can reach Steam',()=>{
 assert.equal(publicTitle('singleplayer'),'Minecraft — Singleplayer');assert.equal(publicTitle('secret.example:25565'),'Minecraft — Playing');assert.equal(publicTitle('menu',2),'Minecraft — Multiple games');
});
