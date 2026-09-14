import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {Registry} from '../src/system.js';
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
