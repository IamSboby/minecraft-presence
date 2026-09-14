import test from 'node:test';import assert from 'node:assert/strict';import {SteamBridge,authErrorText} from '../src/steam.js';
test('authentication errors explain failures without leaking raw messages',()=>{
 assert.match(authErrorText({code:'EACCES'}),/blocked/);
 assert.match(authErrorText({cause:{code:'ENOTFOUND'}}),/reach/);
 assert.match(authErrorText({eresult:84}),/84/);
 assert.ok(!authErrorText({message:'secret-token-in-url'}).includes('secret-token'));
});
test('login and reconnect announce Online before publishing the current game',()=>{
 const calls=[];const b=new SteamBridge();const client={setPersona:value=>calls.push(['persona',value]),gamesPlayed:(...args)=>calls.push(['game',...args]),playingState:{blocked:false}};
 b.client=client;b.update({active:true,mode:'singleplayer',count:1});assert.equal(calls.length,0);
 b.onLoggedOn(client,1);assert.deepEqual(calls,[['persona',1],['game',['Minecraft — Singleplayer'],false]]);
 b.state='disconnected';b.onLoggedOn(client,1);assert.equal(calls.length,4);
 b.onLoggedOn({},1);assert.equal(calls.length,4);
});
test('Steam payloads, duplicate suppression, close and busy account',()=>{
 const calls=[];const b=new SteamBridge();b.client={playingState:{blocked:false},gamesPlayed:(...args)=>calls.push(args),logOff:()=>{}};b.state='connected';
 b.update({active:true,mode:'menu',count:1});b.update({active:true,mode:'menu',count:1});assert.equal(calls.length,1);assert.deepEqual(calls[0],[['Minecraft — In menu'],false]);
 b.update({active:false});assert.deepEqual(calls[1],[[],false]);b.client.playingState.blocked=true;b.update({active:true,mode:'singleplayer',count:1});assert.equal(calls.length,2);
 b.disconnect();assert.equal(b.state,'disconnected');
});
