import {spawn} from 'node:child_process';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));const dir=path.resolve(process.env.MCPRESENCE_DATA||path.join(os.homedir(),'.minecraft-private-presence'));
const child=spawn(process.execPath,[path.join(root,'src/main.js')],{stdio:'inherit',windowsHide:true});
const started=Date.now();let opened=false;
const poll=setInterval(async()=>{
 if(opened)return;
 try{const stat=await fs.stat(path.join(dir,'panel.url'));if(stat.mtimeMs<started)return;
 const url=await fs.readFile(path.join(dir,'panel.url'),'utf8');if(!/^http:\/\/127\.0\.0\.1:\d+\/#\w+$/.test(url))return;
 opened=true;clearInterval(poll);
 const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';spawn(command,[url],{stdio:'ignore',windowsHide:true}).on('error',()=>console.log('Abre la dirección de panel.url en tu navegador.'));
 }catch{}
},500);
child.on('exit',code=>{clearInterval(poll);process.exitCode=code||0;});process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
