const token = location.hash.slice(1) || sessionStorage.getItem('presence-token');
if (token) { sessionStorage.setItem('presence-token', token); history.replaceState(null, '', '/'); }
const $ = id => document.getElementById(id); let rootsLoaded = false, gameKey = '', stopped = false;
async function api(route, data) {
  const r = await fetch('/api/' + route, { method: data === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  if (!r.ok) { const error = await r.json().catch(() => ({})); throw new Error(r.status === 401 ? 'Reopen Minecraft Presence to reconnect to this panel.' : error.error || 'Could not complete this action.'); }
  return r.json();
}
const labels = { disconnected:'Not connected', connecting:'Connecting…', connected:'Connected', waiting:'Waiting for Steam Guard', blocked:'Another Steam session is playing', expired:'QR code expired', 'auth-error':'Authorization failed', 'connection-error':'Connection failed' };
async function refresh() {
  if (stopped) return;
  try {
    const s = await api('status'); $('title').textContent = s.title || 'Minecraft is closed';
    $('detail').textContent = s.activity.active ? s.activity.count + ' game(s) · ' + (s.activity.source === 'sensor' ? 'Live sensor activity' : s.activity.source === 'manual' ? 'Manually selected activity' : 'Game detected; waiting for activity details') : 'An open launcher does not count as playing.';
    $('error').textContent = s.scanError || ''; $('steam').textContent = labels[s.steam] || s.steam;
    $('sessionHelp').textContent = s.desktop ? 'Scan with Steam Guard once. Windows encrypts your session so you stay connected after restarting. Signing out removes the saved session.' : 'Scan with Steam Guard. This development panel keeps your session only until it closes. The Windows app can remember it securely.';
    $('startupOption').hidden = !s.desktop;
    $('shortcutOption').hidden = !s.desktop;
    $('steamHelp').textContent = s.steamError || (s.steam === 'blocked' ? 'Another game or helper is using Steam. Close it to resume activity here.' : 'Steam receives only the generic activity shown on the left.');
    $('qr').hidden = !s.qr; if (s.qr) $('qr').src = s.qr;
    $('login').disabled = ['waiting','connecting','connected','blocked'].includes(s.steam);
    if (!rootsLoaded) { $('roots').value = s.config.roots.join('\n'); $('autoSensor').checked=s.config.autoSensor; $('javaCommand').value=s.config.javaCommand; $('startAtLogin').checked=s.config.startAtLogin !== false; rootsLoaded = true; }
    const sensorRows = s.activity.games.filter(g=>g.edition==='java').map(g=> {
      const li=document.createElement('li'); const text = g.source==='sensor' && g.mode !== 'unknown' ? 'Connected — receiving live activity.' : g.source==='sensor' ? 'Connected, but this Minecraft version is not recognized.' : s.sensors[g.pid] || (s.config.autoSensor ? 'Waiting to load the sensor…' : 'Automatic sensor is off.');
      li.textContent='Java · PID ' + g.pid + ': ' + text; return li;
    });
    if (!sensorRows.length) { const li=document.createElement('li');li.textContent='Open a Java instance to check the sensor.';sensorRows.push(li); }
    $('sensorStatus').replaceChildren(...sensorRows);
    const instances=s.instances.map(i => { const li = document.createElement('li'); li.textContent = i.name; const small = document.createElement('small'); small.textContent = i.directory; li.append(small); return li; });
    if(!instances.length){const li=document.createElement('li');li.textContent='Launch Minecraft to discover your first instance.';instances.push(li);}
    $('instances').replaceChildren(...instances);
    const key = s.activity.games.map(g => g.pid + ':' + g.identity).join(',');
    if (key !== gameKey) {
      gameKey = key; $('games').replaceChildren(...s.activity.games.map(g => {
        const row = document.createElement('div'); row.className='game'; const label=document.createElement('label'); label.textContent=(g.edition === 'java' ? 'Java' : 'Bedrock') + ' · PID ' + g.pid;
        const select=document.createElement('select'); for (const [v,t] of Object.entries({auto:'Automatic',menu:'In menu — manual',singleplayer:'Singleplayer — manual',multiplayer:'Multiplayer — manual'})) { const option=document.createElement('option');option.value=v;option.textContent=t;select.append(option); }
        select.onchange=()=>action(()=>api('manual',{pid:g.pid,mode:select.value}));label.append(select);row.append(label);return row;
      }));
    }
  } catch(e) { $('error').textContent=e.message; }
}
async function action(fn){try{await fn();if(!stopped)await refresh();}catch(e){$('error').textContent=e.message;}}
$('login').onclick=()=>action(()=>api('login',{}));$('logout').onclick=()=>action(()=>api('logout',{}));
$('addShortcut').onclick=()=>action(async()=>{
  $('addShortcut').disabled=true;
  $('shortcutResult').textContent='Follow the setup window to add Minecraft Launcher.';
  try { const result=await api('steam-shortcut',{}); $('shortcutResult').textContent=result.message; }
  catch(e) { $('shortcutResult').textContent=e.message; }
  finally { $('addShortcut').disabled=false; }
});
$('settings').onsubmit=e=>{e.preventDefault();action(async()=>{await api('config',{roots:$('roots').value.split('\n').map(x=>x.trim()).filter(Boolean),autoSensor:$('autoSensor').checked,javaCommand:$('javaCommand').value.trim(),startAtLogin:$('startAtLogin').checked});$('saved').textContent='Saved';});};
$('stop').onclick=()=>action(async()=>{await api('stop',{});stopped=true;$('title').textContent='Minecraft Presence is closed';clearInterval(timer);});
refresh();const timer=setInterval(refresh,2000);
