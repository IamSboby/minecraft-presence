import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawn,execFileSync} from 'node:child_process';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));process.chdir(root);
const bin=name=>path.join(process.env.JAVA_HOME,'bin',name+(process.platform==='win32'?'.exe':''));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'presence-e2e-'));let hub,game;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<45;i++){try{const v=await fn();if(v)return v;}catch{}await sleep(1000);}throw new Error('Timeout: '+label);}
try{
 execFileSync(bin('javac'),['-d','.build/fixture','sensor/test/net/minecraft/client/Minecraft.java','sensor/test/net/minecraft/client/main/Main.java'],{stdio:'inherit',windowsHide:true});
 await fs.writeFile(path.join(dir,'config.json'),JSON.stringify({roots:[],port:38472,autoSensor:false,javaCommand:bin('java')}));
 const control=path.join(dir,'mode.txt');await fs.writeFile(control,'menu');
 hub=spawn(process.execPath,['src/main.js'],{cwd:root,env:{...process.env,MCPRESENCE_DATA:dir},windowsHide:true,stdio:'ignore'});
 const panel=await until(async()=>await fs.readFile(path.join(dir,'panel.url'),'utf8'),'panel');const token=panel.split('#')[1];
 const api=async(route,data)=>fetch('http://127.0.0.1:38472/api/'+route,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 assert.equal((await fetch('http://127.0.0.1:38472/api/status')).status,401);
 assert.equal((await fetch('http://127.0.0.1:38472/api/status',{headers:{Origin:'https://example.com',Authorization:'Bearer '+token}})).status,403);
 game=spawn(bin('java'),['-cp',path.join(root,'.build/fixture'),'net.minecraft.client.main.Main','--gameDir',path.join(dir,'external instance'),control],{windowsHide:true,stdio:['ignore','inherit','inherit']});
 await until(async()=>{const s=await(await api('status')).json();return s.activity.games.some(g=>g.pid===game.pid);},'process discovery');
 execFileSync(bin('java'),['--add-modules','jdk.attach','-cp',path.join(root,'sensor/dist/presence-sensor.jar'),'presence.Attach',String(game.pid),path.join(root,'sensor/dist/presence-sensor.jar'),path.join(dir,'sensor.properties')],{stdio:'inherit',windowsHide:true});
 for(const mode of ['menu','singleplayer','multiplayer','menu']){
  await fs.writeFile(control,mode);await until(async()=>{const s=await(await api('status')).json();return s.activity.games.some(g=>g.pid===game.pid&&g.mode===mode&&g.source==='sensor');},mode);console.log('PASS real process + attached sensor: '+mode);
 }
 assert.equal((await api('telemetry',{pid:game.pid,mode:'multiplayer',server:'private.example'})).status,400);
 await fs.writeFile(control,'exit');await until(async()=>{const s=await(await api('status')).json();return !s.activity.games.some(g=>g.pid===game.pid)&&(s.activity.games.length>0||!s.activity.active);},'close');
 const saved=await fs.readFile(path.join(dir,'instances.json'),'utf8');assert.ok(saved.includes('external instance'));assert.ok(!saved.includes('private.example'));
 console.log('PASS close, discovery, API authorization, privacy');await api('stop',{});
}finally{game?.kill();hub?.kill();await sleep(1000);await fs.rm(dir,{recursive:true,force:true});}
