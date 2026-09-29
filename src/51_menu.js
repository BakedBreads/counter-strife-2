/* ===================== menus ===================== */
const Menu = {
  el: null, pane: 'play', invSel: 'ak47', setTab: 'game',
  init() { this.el = $('#menu'); },
  open(p) {
    this.pane = p || this.pane;
    show(this.el, true);
    this.el.innerHTML = `<div class="side"><div class="logo"><span class="l1">Counter-Strife</span><span class="l2"><span class="two">2</span></span></div>
      <nav class="nav">${[['play', 'Play'], ['online', 'Online'], ['inventory', 'Inventory'], ['settings', 'Settings'], ['help', 'How to play']].map(([k, n]) => `<button data-p="${k}" class="${this.pane === k ? 'on' : ''}">${n}</button>`).join('')}</nav>
      <div class="foot">Free to play · no store, no accounts.<br>All skins unlocked.<br><span style="color:var(--dim)">de_dustline · v1.0</span></div></div><div class="main" id="mpane"></div>`;
    for (const b of this.el.querySelectorAll('.nav button')) b.addEventListener('click', () => { SFX.ui('ui_click'); this.open(b.dataset.p); });
    this.renderPane();
  },
  close() { show(this.el, false); this.el.innerHTML = ''; },
  renderPane() {
    const m = $('#mpane'); if (!m) return;
    if (this.pane === 'play') this.renderPlay(m);
    else if (this.pane === 'online') this.renderOnline(m);
    else if (this.pane === 'inventory') this.renderInventory(m);
    else if (this.pane === 'settings') this.renderSettings(m, false);
    else this.renderHelp(m);
  },
  seg(name, opts, cur, cls) { return `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''} ${cls && cls[v] || ''}">${l}</button>`).join('')}</div>`; },
  bindSeg(root, name, cb) { const s = root.querySelector(`[data-seg="${name}"]`); if (!s) return; for (const b of s.querySelectorAll('button')) b.addEventListener('click', () => { for (const x of s.querySelectorAll('button')) x.classList.toggle('on', x === b); SFX.ui('ui_click'); cb(b.dataset.v); }); },
  renderPlay(m) {
    const S = Settings.v;
    const md = MODES[S.mode] || MODES.competitive;
    m.innerHTML = `<div class="pane"><h2>Play offline</h2><div class="sub">Practice against bots on de_dustline. Pick a mode and a difficulty, then hit GO.</div>
      <div class="grid modes">${Object.values(MODES).map(x => `<button class="mode ${S.mode === x.id ? 'on' : ''}" data-m="${x.id}"><em>${x.ffa ? 'FFA' : x.teamSize + 'v' + x.teamSize}</em><b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div>
      <div class="opt"><label>Bot difficulty</label>${this.seg('diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['expert', 'Expert']], S.difficulty)}</div>
      <div class="opt" id="teamOpt" ${md.ffa ? 'style="display:none"' : ''}><label>Your team</label>${this.seg('team', [['auto', 'Auto'], ['T', 'Terrorists'], ['CT', 'Counter-Terrorists']], S.team, { CT: 'ct' })}</div>
      <div class="opt" id="ffOpt" ${md.ffa || !md.ff ? 'style="display:none"' : ''}><label>Friendly fire</label>${this.seg('ff', [['true', 'On'], ['false', 'Off']], S.ff)}</div>
      <div class="gobar"><button class="btn go" id="goBtn">GO</button><div class="note">Map: <b>de_dustline</b> · ${md.name}<br>Tip: hold <kbd>${keyName(S.binds.walk)}</kbd> to walk silently. Crouch with <kbd>${keyName(S.binds.crouch)}</kbd> or <kbd>${keyName(S.binds.crouch2)}</kbd>.</div></div></div>`;
    for (const b of m.querySelectorAll('.mode')) b.addEventListener('click', () => { S.mode = b.dataset.m; Settings.save(); SFX.ui('ui_click'); this.renderPlay(m); });
    this.bindSeg(m, 'diff', v => { S.difficulty = v; Settings.save(); });
    this.bindSeg(m, 'team', v => { S.team = v; Settings.save(); });
    this.bindSeg(m, 'ff', v => { S.ff = v === 'true'; Settings.save(); });
    $('#goBtn').addEventListener('click', () => { SFX.ui('ui_click'); App.startMatch({ mode: S.mode, diff: S.difficulty, team: S.team, ff: S.ff }); });
  },
  renderOnline(m) {
    const S = Settings.v, N = Net;
    let body = '';
    if (N.role === 'off' && !N.connecting) {
      body = `<div class="cols2"><div class="card"><h3 style="font-family:var(--fc);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Host a match</h3><p style="color:var(--dim);font-size:13.5px;line-height:1.5;margin-bottom:14px">Create a room and share its code. Bots fill the empty slots, and the match runs on your computer.</p><button class="btn" id="hostBtn">Create room</button></div>
        <div class="card"><h3 style="font-family:var(--fc);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Join a match</h3><p style="color:var(--dim);font-size:13.5px;line-height:1.5;margin-bottom:14px">Enter the 5-letter code your friend sees on their screen.</p><div class="row"><input class="tfield" id="joinCode" maxlength="5" placeholder="CODE" style="text-transform:uppercase;min-width:140px;letter-spacing:.2em"><button class="btn" id="joinBtn">Join</button></div></div></div>`;
    } else if (N.connecting) {
      body = `<div class="card"><div class="status">${esc(N.statusText || 'Connecting…')}</div><button class="btn small danger" id="leaveBtn" style="margin-top:12px">Cancel</button></div>`;
    } else {
      const isHost = N.role === 'host', L = N.lobby || { players: [], cfg: {} }, cfg = L.cfg || {};
      body = `<div class="card"><div class="row" style="justify-content:space-between"><div><div style="font-size:12px;letter-spacing:.14em;color:var(--dim);text-transform:uppercase">Room code</div><div class="code">${esc(N.code || '')}</div></div>
        <button class="btn small danger" id="leaveBtn">${isHost ? 'Close room' : 'Leave'}</button></div>
        <div class="slist">${L.players.map(p => `<div class="pl ${p.team === 'T' ? 't' : p.team === 'CT' ? 'ct' : ''}"><i></i><span>${esc(p.name)}${p.host ? ' (host)' : ''}</span><small>${p.team === 'T' ? 'Terrorists' : p.team === 'CT' ? 'Counter-Terrorists' : 'Auto'}</small></div>`).join('')}</div>
        <div class="opt"><label>Your team</label>${this.seg('nteam', [['auto', 'Auto'], ['T', 'Terrorists'], ['CT', 'Counter-Terrorists']], N.myTeam || 'auto', { CT: 'ct' })}</div>
        ${isHost ? `<div class="opt"><label>Mode</label>${this.seg('nmode', Object.values(MODES).map(x => [x.id, x.name]), cfg.mode || 'competitive')}</div>
        <div class="opt"><label>Bot difficulty</label>${this.seg('ndiff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['expert', 'Expert']], cfg.diff || 'hard')}</div>
        <div class="gobar"><button class="btn go" id="nstart">Start match</button><div class="note">${L.players.length} player(s) in the room. Bots fill the rest.</div></div>` : `<div class="status">Waiting for the host to start… Mode: <b>${esc((MODES[cfg.mode] || MODES.competitive).name)}</b></div>`}
      </div>`;
    }
    m.innerHTML = `<div class="pane"><h2>Online</h2><div class="sub">Play with friends over the internet, free and peer-to-peer. Everyone opens this same page.</div>
      <div class="opt" style="margin-top:0;margin-bottom:14px"><label>Your name</label><input class="tfield" id="nameIn" maxlength="16" value="${esc(S.name)}"></div>
      ${body}<div class="status ${N.statusCls || ''}" id="netStatus">${esc(N.status || '')}</div>
      <p style="color:var(--dim2);font-size:12.5px;margin-top:18px;line-height:1.6;max-width:640px">Connections go directly between players using the free PeerJS signaling network. Very strict networks (some school or mobile carrier NATs) can block direct connections; if joining times out, try a different network.</p></div>`;
    const nameIn = $('#nameIn'); nameIn.addEventListener('input', () => { S.name = nameIn.value.replace(/[<>]/g, '').slice(0, 16) || 'Player'; Settings.save(); });
    const hb = $('#hostBtn'); if (hb) hb.addEventListener('click', () => { SFX.ui('ui_click'); Net.host(); });
    const jb = $('#joinBtn'); if (jb) jb.addEventListener('click', () => { const c = $('#joinCode').value.trim().toUpperCase(); if (c.length < 4) { Net.setStatus('Enter the room code', 'err'); return; } SFX.ui('ui_click'); Net.join(c); });
    const lb = $('#leaveBtn'); if (lb) lb.addEventListener('click', () => { Net.leave(); this.renderPane(); });
    this.bindSeg(m, 'nteam', v => Net.setTeam(v));
    this.bindSeg(m, 'nmode', v => Net.setCfg({ mode: v }));
    this.bindSeg(m, 'ndiff', v => Net.setCfg({ diff: v }));
    const ns = $('#nstart'); if (ns) ns.addEventListener('click', () => { SFX.ui('ui_click'); Net.startMatch(); });
  },
  renderInventory(m) {
    const groups = [['Knife', ['knife']], ['Pistols', ['glock', 'usp', 'p250', 'fiveseven', 'tec9', 'deagle']], ['SMGs', ['mac10', 'mp9', 'mp7', 'ump45', 'p90']], ['Rifles', ['galil', 'famas', 'ak47', 'm4a4', 'm4a1s', 'sg553', 'aug']], ['Snipers', ['ssg08', 'awp']], ['Heavy', ['nova', 'xm1014', 'negev']]];
    const sel = this.invSel;
    const cur = Loadout.skinFor(sel);
    let list = '';
    for (const [g, ids] of groups) { list += `<h5>${g}</h5>`; for (const id of ids) list += `<button data-w="${id}" class="${id === sel ? 'on' : ''}"><img src="${Models.skinIcon(App.renderer, id, Loadout.skinFor(id))}" alt=""><span>${esc(id === 'knife' ? KNIVES.find(k => k.id === Loadout.v.knife).name : W[id].name)}</span></button>`; }
    let knifeRow = '';
    if (sel === 'knife') knifeRow = `<div class="opt" style="margin:0 0 14px"><label>Knife type</label>${this.seg('ktype', KNIVES.map(k => [k.id, k.name]), Loadout.v.knife)}</div>`;
    const skins = SKINS.map(s => `<button class="skin ${s.id === cur ? 'on' : ''}" data-s="${s.id}"><img src="${Models.skinIcon(App.renderer, sel, s.id)}" alt=""><b>${esc(s.name)}</b><span class="r${s.r}">${RARITY[s.r]}</span></button>`).join('');
    m.innerHTML = `<div class="pane" style="max-width:1100px"><h2>Inventory <span class="free">ALL FREE</span></h2><div class="sub">Every finish and knife is unlocked. Equip whatever you like; it shows up in your hands, on your model, and when you drop it.</div>
      <div class="inv"><div class="wlist card" style="padding:10px">${list}</div><div>${knifeRow}<div class="skins">${skins}</div></div></div></div>`;
    for (const b of m.querySelectorAll('.wlist button')) b.addEventListener('click', () => { this.invSel = b.dataset.w; SFX.ui('ui_click'); this.renderInventory(m); });
    for (const b of m.querySelectorAll('.skin')) b.addEventListener('click', () => {
      if (sel === 'knife') Loadout.v.knifeSkin = b.dataset.s; else Loadout.v.skins[sel] = b.dataset.s;
      Loadout.save(); SFX.ui('buy', .4); this.renderInventory(m); App.refreshMenuModel();
    });
    this.bindSeg(m, 'ktype', v => { Loadout.v.knife = v; Loadout.save(); this.renderInventory(m); App.refreshMenuModel(); });
  },
  renderHelp(m) {
    const b = Settings.v.binds, k = a => `<kbd>${keyName(b[a])}</kbd>`;
    m.innerHTML = `<div class="pane" style="max-width:1100px"><h2>How to play</h2><div class="sub">Everything from CS2 you would expect, rebuilt for the browser.</div><div class="help">
      <div class="card"><h4>Controls</h4><ul><li>${k('forward')}${k('left')}${k('back')}${k('right')} move, ${k('jump')} jump</li><li>${k('crouch')} or ${k('crouch2')} crouch, ${k('walk')} walk silently</li><li>Mouse 1 fire, Mouse 2 scope / burst / silencer / stab</li><li>${k('reload')} reload, ${k('use')} use / defuse / pick up, ${k('drop')} drop</li><li>${k('slot1')}–${k('slot5')} weapons, ${k('lastWeapon')} last weapon, wheel cycles</li><li>${k('buy')} buy menu, ${k('scores')} scoreboard, ${k('inspect')} inspect</li><li>${k('chat')} chat, ${k('teamChat')} team chat, ${k('teamMenu')} change team</li></ul></div>
      <div class="card"><h4>Bomb defusal</h4><p>Terrorists plant the C4 at site A or B (hold Mouse 1 with the bomb inside a site, 3.2 s). Counter-Terrorists defuse it: hold ${k('use')} for 10 s, or 5 s with a kit. The bomb explodes 40 s after it is planted. Eliminate the enemy team or run out the clock to win as CT.</p></div>
      <div class="card"><h4>Economy</h4><p>Round win $3250 (bomb or defuse $3500). Losing pays $1400, rising by $500 per consecutive loss up to $3400. Kill rewards: $300 rifles and pistols, $600 SMGs, $900 shotguns, $100 AWP, $1500 knife. Terrorists get $800 for a planted bomb even when they lose. Money caps at $16,000.</p></div>
      <div class="card"><h4>Shooting</h4><p>Every automatic weapon has a fixed spray pattern: pull down and against the sideways drift. You are only accurate when standing still, so tap the opposite strafe key to stop instantly (counter-strafe) before you shoot. Crouching tightens spread. Headshots deal 4× damage; a helmet saves you from a one-tap by some weapons. Bullets go through wood, doors and containers.</p></div>
      <div class="card"><h4>Utility</h4><p>Smokes block vision for 18 s and put out fires. Flashbangs blind anyone looking at them, so turn away. Molotovs and incendiaries deny an area for 7 s. HE grenades deal up to 98 damage (armor halves it). Decoys imitate gunfire. Mouse 1 throws far, Mouse 2 lobs short, both do a medium throw.</p></div>
      <div class="card"><h4>Sound</h4><p>Running and jumping make noise that everyone can hear, bots included. Walk (${k('walk')}) or crouch to move silently. Gunfire is heard across the map; sounds behind walls are muffled.</p></div>
      <div class="card"><h4>Browser note</h4><p>Ctrl+W closes a browser tab and cannot be blocked in a normal window. Use <b>Fullscreen</b> in the pause menu (the game locks the keyboard there), or crouch with ${k('crouch2')}.</p></div>
    </div></div>`;
  },
  /* ---------- settings (used by the main menu and the pause menu) ---------- */
  renderSettings(m, inGame) {
    const S = Settings.v, tab = this.setTab;
    const tabs = [['game', 'Game'], ['xhair', 'Crosshair'], ['mouse', 'Mouse'], ['video', 'Video'], ['audio', 'Audio'], ['keys', 'Controls']];
    const range = (key, label, min, max, step, fmt) => `<div class="set"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${S[key]}"><output>${fmt ? fmt(S[key]) : S[key]}</output></div>`;
    const tog = (key, label) => `<div class="set"><span>${label}</span>${this.seg('t_' + key, [['true', 'On'], ['false', 'Off']], S[key])}<output></output></div>`;
    let body = '';
    if (tab === 'game') body = `<div class="set"><span>Name</span><input class="tfield" id="setName" maxlength="16" value="${esc(S.name)}"><output></output></div>` + range('fov', 'Field of view (vertical)', 60, 90, 1, v => v + '°') + range('vmFov', 'Viewmodel field of view', 54, 75, 1, v => v + '°') + tog('bob', 'Weapon bob') + tog('autoFull', 'Fullscreen during matches') + tog('showFps', 'Show FPS') + tog('announcer', 'Announcer voice') + tog('blood', 'Blood effects');
    else if (tab === 'xhair') body = `<div class="row" style="align-items:flex-start;gap:24px"><div style="flex:1">` + `<div class="set"><span>Style</span>${this.seg('xst', [['classic', 'Classic'], ['dot', 'Dot'], ['circle', 'Circle']], S.xhStyle)}<output></output></div>` + range('xhSize', 'Length', 0, 12, .5) + range('xhGap', 'Gap', -2, 8, .5) + range('xhThick', 'Thickness', .5, 4, .5) + range('xhAlpha', 'Opacity', .2, 1, .05) + `<div class="set"><span>Color</span><div class="row">${['#4cff5a', '#00ffff', '#ffff00', '#ff3b3b', '#ffffff', '#ff4fd8'].map(c => `<button class="keybtn" data-col="${c}" style="min-width:34px;height:28px;background:${c};border-color:${S.xhColor === c ? '#fff' : 'transparent'}"></button>`).join('')}<input type="color" id="xhCol" value="${S.xhColor}"></div><output></output></div>` + tog('xhOutline', 'Outline') + tog('xhDot', 'Center dot') + tog('xhDynamic', 'Dynamic (shows spread)') + `</div><canvas class="xhprev" id="xhPrev" width="240" height="240"></canvas></div>`;
    else if (tab === 'mouse') body = range('sens', 'Sensitivity', .1, 8, .05) + range('zoomRatio', 'Zoom sensitivity ratio', .3, 2, .05) + tog('invertY', 'Invert Y axis') + tog('rawInput', 'Raw input (unadjusted movement)');
    else if (tab === 'video') body = range('renderScale', 'Render scale', .5, 1.5, .05, v => Math.round(v * 100) + '%') + `<div class="set"><span>Shadows</span>${this.seg('shadows', [['off', 'Off'], ['medium', 'Medium'], ['high', 'High']], S.shadows)}<output></output></div><div class="set"><span>Texture detail (reload)</span>${this.seg('texQ', [['medium', 'Medium'], ['high', 'High']], S.texQ)}<output></output></div>` + tog('aa', 'Anti-aliasing (reload)') + `<p style="color:var(--dim);font-size:12.5px;margin-top:10px">Lower render scale or shadows if the frame rate drops.</p>`;
    else if (tab === 'audio') body = range('volume', 'Master volume', 0, 1, .01, v => Math.round(v * 100) + '%') + range('sfx', 'Game effects', 0, 1.5, .01, v => Math.round(v * 100) + '%') + range('ui', 'Interface', 0, 1, .01, v => Math.round(v * 100) + '%');
    else body = Object.keys(BIND_LABELS).map(a => `<div class="set"><span>${BIND_LABELS[a]}</span><span></span><button class="keybtn" data-bind="${a}">${keyName(S.binds[a])}</button></div>`).join('') + `<div style="margin-top:14px"><button class="btn small" id="resetKeys">Reset to defaults</button></div>`;
    m.innerHTML = `<div class="pane"><h2>Settings</h2><div class="sub">Changes save automatically.</div><div class="tabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="card">${body}</div>${inGame ? '<div style="margin-top:14px"><button class="btn" id="setBack">Back</button></div>' : ''}</div>`;
    for (const b of m.querySelectorAll('.tabs button')) b.addEventListener('click', () => { this.setTab = b.dataset.t; SFX.ui('ui_click'); this.renderSettings(m, inGame); });
    for (const r of m.querySelectorAll('input[type=range]')) r.addEventListener('input', () => {
      S[r.dataset.k] = parseFloat(r.value); const o = r.parentElement.querySelector('output');
      const f = { fov: v => v + '°', vmFov: v => v + '°', renderScale: v => Math.round(v * 100) + '%', volume: v => Math.round(v * 100) + '%', sfx: v => Math.round(v * 100) + '%', ui: v => Math.round(v * 100) + '%' }[r.dataset.k];
      o.textContent = f ? f(S[r.dataset.k]) : S[r.dataset.k]; Settings.save(); App.applySettings(); this.drawXhPrev();
    });
    for (const k of ['bob', 'autoFull', 'showFps', 'announcer', 'blood', 'xhOutline', 'xhDot', 'xhDynamic', 'invertY', 'rawInput', 'aa']) this.bindSeg(m, 't_' + k, v => { S[k] = v === 'true'; Settings.save(); App.applySettings(); this.drawXhPrev(); });
    this.bindSeg(m, 'xst', v => { S.xhStyle = v; Settings.save(); this.drawXhPrev(); });
    this.bindSeg(m, 'shadows', v => { S.shadows = v; Settings.save(); App.applySettings(); });
    this.bindSeg(m, 'texQ', v => { S.texQ = v; Settings.save(); App.toast('Texture detail applies after reloading the page'); });
    const nm = $('#setName'); if (nm) nm.addEventListener('input', () => { S.name = nm.value.replace(/[<>]/g, '').slice(0, 16) || 'Player'; Settings.save(); if (Game.local && Net.role === 'off') Game.local.name = S.name; });
    for (const b of m.querySelectorAll('[data-col]')) b.addEventListener('click', () => { S.xhColor = b.dataset.col; Settings.save(); this.renderSettings(m, inGame); });
    const xc = $('#xhCol'); if (xc) xc.addEventListener('input', () => { S.xhColor = xc.value; Settings.save(); this.drawXhPrev(); });
    for (const b of m.querySelectorAll('[data-bind]')) b.addEventListener('click', () => {
      b.classList.add('wait'); b.textContent = 'Press a key…';
      Input.rebindCb = code => { if (code !== 'Escape') S.binds[b.dataset.bind] = code; Settings.save(); this.renderSettings(m, inGame); };
    });
    const rk = $('#resetKeys'); if (rk) rk.addEventListener('click', () => { S.binds = Object.assign({}, DEFAULT_BINDS); Settings.save(); this.renderSettings(m, inGame); });
    const sb = $('#setBack'); if (sb) sb.addEventListener('click', () => App.openPause());
    this.drawXhPrev();
  },
  drawXhPrev() {
    const cv = $('#xhPrev'); if (!cv) return;
    const g = cv.getContext('2d'), s = Settings.v; g.clearRect(0, 0, 240, 240);
    g.save(); g.translate(120, 120); g.scale(1.5, 1.5);
    const L = s.xhSize * 2, T = Math.max(1, s.xhThick * 2), gap = s.xhGap * 2;
    g.globalAlpha = s.xhAlpha;
    const bar = (x, y, w, h) => { if (s.xhOutline) { g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, h + 2); } g.fillStyle = s.xhColor; g.fillRect(x, y, w, h); };
    if (s.xhStyle === 'dot') bar(-T / 2 - 1, -T / 2 - 1, T + 2, T + 2);
    else if (s.xhStyle === 'circle') { g.strokeStyle = s.xhColor; g.lineWidth = T; g.beginPath(); g.arc(0, 0, gap + L, 0, TAU); g.stroke(); }
    else { bar(-T / 2, -gap - L, T, L); bar(-T / 2, gap, T, L); bar(-gap - L, -T / 2, L, T); bar(gap, -T / 2, L, T); if (s.xhDot) bar(-T / 2, -T / 2, T, T); }
    g.restore();
  },
  /* ---------- pause & match end ---------- */
  pause(on) {
    const el = $('#pause'); show(el, on);
    if (!on) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="box"><h2>Paused</h2><button class="btn go" id="pResume" style="min-width:0">Resume</button><button class="btn" id="pScore">Scoreboard</button><button class="btn" id="pTeam">Change team</button><button class="btn" id="pSet">Settings</button><button class="btn" id="pFull">${document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'}</button><button class="btn danger" id="pLeave">${Net.role === 'client' ? 'Disconnect' : 'Leave match'}</button>
      <p style="color:var(--dim);font-size:12.5px;text-align:center;margin-top:8px;line-height:1.5">${Net.role === 'off' ? 'The match keeps running while this menu is open.' : 'Online match: the game keeps running.'}</p></div>`;
    $('#pResume').addEventListener('click', () => App.resume());
    $('#pScore').addEventListener('click', () => { App.resume(); HUD.showScores(true); setTimeout(() => HUD.showScores(false), 3000); });
    $('#pTeam').addEventListener('click', () => { App.resume(); setTimeout(() => HUD.openTeam(), 50); });
    $('#pSet').addEventListener('click', () => { el.innerHTML = '<div id="pset" style="width:min(900px,94vw);max-height:90vh;overflow:auto"></div>'; this.renderSettings($('#pset'), true); });
    $('#pFull').addEventListener('click', () => App.toggleFullscreen());
    $('#pLeave').addEventListener('click', () => App.confirm('Leave the match?', 'Your progress in this match will be lost.', 'Leave', () => App.leaveMatch()));
  },
  matchEnd(winner, reason) {
    const el = $('#matchEnd'); show(el, true);
    const G = Game, lp = G.local, M = G.mode;
    let title, cls = '';
    if (M.ffa) { title = winner === lp ? 'Victory' : (winner ? esc(winner.name) + ' wins' : 'Match over'); }
    else if (!winner) title = 'Draw';
    else { const won = lp && lp.team === winner; title = won ? 'Victory' : 'Defeat'; cls = winner === 'T' ? 't' : 'ct'; }
    const hs = lp && lp.kills ? Math.round(lp.hsKills / lp.kills * 100) : 0;
    el.innerHTML = `<h1 class="${cls}">${title}</h1>${M.ffa ? '' : `<div class="fs"><span style="color:var(--ct)">${G.score.CT}</span> : <span style="color:var(--t)">${G.score.T}</span></div>`}
      <div class="st">${lp ? `${lp.kills} kills · ${lp.assists} assists · ${lp.deaths} deaths · ${hs}% headshots · ${lp.mvps} MVP${lp.mvps === 1 ? '' : 's'} · ADR ${Math.round(lp.dmgDealt / Math.max(1, lp.roundsPlayed || G.round))}` : ''}</div>
      <div class="row" style="margin-top:14px">${Net.role === 'client' ? '' : '<button class="btn go" id="meAgain">Play again</button>'}<button class="btn" id="meMenu">Main menu</button></div>`;
    const a = $('#meAgain'); if (a) a.addEventListener('click', () => { show(el, false); if (Net.role === 'host') Net.startMatch(); else App.startMatch(G.cfg); });
    $('#meMenu').addEventListener('click', () => { show(el, false); App.leaveMatch(); });
  }
};
