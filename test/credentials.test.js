import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Credentials } from '../src/credentials.js';
import { SteamBridge } from '../src/steam.js';
import { sensorErrorText } from '../src/sensor.js';
test('saved session is encrypted, survives reopening and cannot reappear after sign-out',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'presence-credentials-'));
  const safe={isEncryptionAvailable:()=>true,encryptString:t=>Buffer.from([...t].reverse().join('')),decryptString:b=>[...b.toString()].reverse().join('')};
  try {
    const file=path.join(dir,'session.bin'), store=new Credentials(file,safe);
    assert.equal(await store.load(),null);
    await store.save('test-session');
    assert.ok(!(await fs.readFile(file,'utf8')).includes('test-session'));
    assert.equal(await new Credentials(file,safe).load(),'test-session');
    await Promise.all([store.save('new-session'),store.clear()]);
    assert.equal(await store.load(),null);
    await assert.rejects(new Credentials(file,{isEncryptionAvailable:()=>false}).save('plaintext'));
    assert.equal(await store.load(),null);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('quit retains saved credentials; sign-out deletes them; old restore is ignored',async()=>{
  let cleared=0, resolve;
  const bridge=new SteamBridge({clear:async()=>cleared++,load:()=>new Promise(r=>resolve=r)});
  let connects=0;bridge.connect=async()=>connects++;
  const restoring=bridge.restore();bridge.disconnect();resolve('old-session');await restoring;
  assert.equal(connects,0);assert.equal(cleared,0);
  await bridge.logout();assert.equal(cleared,1);
});
test('sensor diagnostics identify Windows access failures without exposing raw output',()=>{
  assert.match(sensorErrorText({stderr:'java.io.IOException: Acceso denegado at openProcess private-data'}),/Windows denied/);
  assert.ok(!sensorErrorText({stderr:'private-data'}).includes('private-data'));
});
