import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile);
export class Sensors {
  constructor(jar,config,bundledJava){this.jar=jar;this.config=config;this.bundledJava=bundledJava;this.attempts=new Map();this.status=new Map();}
  async update(games,processes,settings){
    for(const pid of this.attempts.keys()) if(!games.has(pid)){this.attempts.delete(pid);this.status.delete(pid);}
    if(!settings.autoSensor)return;
    for(const game of games.values()){
      if(game.edition!=='java')continue;
      const p=processes.find(p=>p.pid===game.pid);if(!p)continue;
      const key=`${game.pid}:${game.identity}`;const attempt=this.attempts.get(game.pid);
      if(attempt?.key===key&&(attempt.ok||Date.now()-attempt.at<60000))continue;
      this.attempts.set(game.pid,{key,at:Date.now(),ok:false});
      let java=settings.javaCommand;
      if(!java && this.bundledJava) { try { await fs.access(this.bundledJava); java=this.bundledJava; } catch {} }
      java ||= p.path?.replace(/javaw\.exe$/i,'java.exe');
      if(!java||!path.isAbsolute(java)){this.status.set(game.pid,'Set the full path to Java from a JDK 17 or newer.');continue;}
      try{
        await fs.access(this.jar);
        await exec(java,['--add-modules','jdk.attach','-cp',this.jar,'presence.Attach',String(game.pid),this.jar,this.config],{windowsHide:true,timeout:10000,maxBuffer:65536});
        this.attempts.set(game.pid,{key,at:Date.now(),ok:true});this.status.set(game.pid,'Sensor loaded. Waiting for activity…');
      }catch(error){this.status.set(game.pid,sensorErrorText(error));}
    }
  }
}
export function sensorErrorText(error) {
  const text=String(error?.stderr || '');
  if (/access.*denied|acceso denegado|openProcess/i.test(text) || ['EACCES','EPERM'].includes(error?.code)) return 'Windows denied access to Minecraft. Open the installed app normally, using the same Windows user as the game. Avoid running Minecraft as administrator.';
  if (/jdk.attach.*not found|UnsupportedClassVersion|does not support.*attach/i.test(text)) return 'This Java runtime does not support the sensor. Use the bundled runtime or a JDK 17 or newer.';
  if (error?.killed) return 'Minecraft did not respond to the sensor. It will retry in one minute.';
  return 'Could not load the sensor. Check your Java override and whether this instance allows Java agents.';
}
