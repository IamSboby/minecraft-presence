import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHub } from '../src/main.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directory=path.join(root,'.build','bedrock-local-test');
await fs.mkdir(directory,{recursive:true});
await fs.writeFile(path.join(directory,'config.json'),JSON.stringify({port:38473,roots:[],autoSensor:false,startAtLogin:false,javaCommand:''}));
const hub=await startHub({dataDirectory:directory});
const token=new URL(hub.url).hash.slice(1);
let last='';
console.log('Bedrock local test ready. No Steam login is restored. The authenticated panel link is stored in .build/bedrock-local-test/panel.url.');
const timer=setInterval(async()=>{
 try {
  const response=await fetch('http://127.0.0.1:38473/api/status',{headers:{Authorization:'Bearer '+token}});
  const status=await response.json();
  const summary=JSON.stringify({active:status.activity.active,title:status.title,steam:status.steam,error:status.scanError,games:status.activity.games.map(g=>({pid:g.pid,edition:g.edition,bedrock:g.bedrock,mode:g.mode,source:g.source}))});
  if(summary!==last){last=summary;console.log(summary);}
 } catch {}
},2000);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>clearInterval(timer));
