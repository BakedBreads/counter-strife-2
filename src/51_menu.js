/* ===================== menus ===================== */
const NAVI = (() => {
  // gear drawn from its teeth so every icon here is our own
  let g = '';
  for (let i = 0; i < 8; i++) {
    const c = i / 8 * TAU;
    [[-.3, 7.6], [-.17, 10.6], [.17, 10.6], [.3, 7.6]].forEach(([o, r], k) => { const a = c + o; g += (i === 0 && k === 0 ? 'M' : 'L') + (12 + Math.cos(a) * r).toFixed(2) + ' ' + (12 + Math.sin(a) * r).toFixed(2); });
  }
  g += 'zM12 8.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z';
  const s = d => `<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="${d}"/></svg>`;
  return {
    play: s('M7 4l13 8-13 8z'),
    home: s('M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z'),
    loadout: s('M2 9h13l1.5-1.5H22v3h-2l-1 1.5h-4.2L13.6 15h-3l1-3H8.4l-1.2 5H3.8l1.1-5H2z'),
    help: s('M12 2a10 10 0 110 20 10 10 0 010-20zm0 14.2a1.3 1.3 0 100 2.6 1.3 1.3 0 000-2.6zM12 5.6c-2.2 0-3.7 1.1-4 2.9l2.3.4c.1-.9.8-1.4 1.7-1.4s1.5.5 1.5 1.2c0 .6-.4.9-1 1.3-.8.5-1.7 1.2-1.7 2.5v.9h2.4v-.6c0-.5.3-.7.9-1.1.9-.6 1.8-1.4 1.8-2.8 0-1.9-1.6-3.3-3.9-3.3z'),
    online: s('M9 11a4 4 0 110-8 4 4 0 010 8zm7.5 0a3 3 0 110-6 3 3 0 010 6zM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1zm17.5 1v-1c0-1.9-.8-3.5-2.1-4.7 3.4.4 5.6 2.3 5.6 4.7v1z'),
    gear: s(g),
    full: s('M3 3h7v2H5v5H3zm11 0h7v7h-2V5h-5zM3 14h2v5h5v2H3zm16 0h2v7h-7v-2h5z'),
    close: s('M5.6 4.2L12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z'),
    check: s('M9 16.2l-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z')
  };
})();
const MODE_ORDER = ['competitive', 'wingman', 'casual', 'deathmatch', 'armsrace'];
const DIFFS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['expert', 'Expert']];
const TEAMS = [['auto', 'Auto'], ['T', 'T side'], ['CT', 'CT side']];
const LOADOUT_GROUPS = [['Melee', ['knife']], ['Pistols', ['glock', 'usp', 'p2000', 'elite', 'p250', 'tec9', 'fiveseven', 'cz75a', 'deagle', 'revolver']], ['SMGs', ['mac10', 'mp9', 'mp7', 'mp5sd', 'ump45', 'p90', 'bizon']], ['Rifles', ['galil', 'famas', 'ak47', 'm4a4', 'm4a1s', 'sg553', 'aug']], ['Sniper rifles', ['ssg08', 'awp', 'g3sg1', 'scar20']], ['Heavy', ['nova', 'xm1014', 'sawedoff', 'mag7', 'm249', 'negev']]];
const mapThumb = site => (App.thumbs && App.thumbs[site]) || '';

const Menu = {
  el: null, pane: 'home', invSel: 'ak47', setTab: 'game', _shown: '',
  init() { this.el = $('#menu'); },
  open(p) {
    this.pane = p || this.pane;
    show(this.el, true);
    if (!this.el.querySelector('.topnav')) {
      this.el.innerHTML = `<div class="scrim"></div><header class="topnav">
        <div class="brand"><div class="wordmark"><span class="w">Counter-Strife</span><span class="n">2</span></div></div>
        <button class="navplay" data-p="play">${NAVI.play}Play</button>
        <button class="navtab" data-p="home">${NAVI.home}<span>Home</span></button>
        <button class="navtab" data-p="inventory">${NAVI.loadout}<span>Loadout</span></button>
        <button class="navtab" data-p="online">${NAVI.online}<span>Online</span></button>
        <button class="navtab" data-p="help">${NAVI.help}<span>How to play</span></button>
        <div class="navright"><div class="mecard" id="meCard"></div>
          <button class="iconbtn" id="navFull" aria-label="Fullscreen" title="Fullscreen">${NAVI.full}</button>
          <button class="iconbtn" data-p="settings" aria-label="Settings" title="Settings">${NAVI.gear}</button></div>
      </header><main class="screen" id="mpane"></main>`;
      for (const b of this.el.querySelectorAll('[data-p]')) b.addEventListener('click', () => { SFX.ui('ui_click'); this.open(b.dataset.p); });
      $('#navFull').addEventListener('click', () => App.toggleFullscreen());
    }
    for (const b of this.el.querySelectorAll('.topnav [data-p]')) b.classList.toggle('on', b.dataset.p === this.pane);
    this.renderMe();
    this.renderPane();
  },
  close() { show(this.el, false); this.el.innerHTML = ''; this._shown = ''; },
  renderMe() {
    const c = $('#meCard'); if (!c) return;
    const team = App.menuChar ? App.menuChar.team : 'CT';
    c.innerHTML = `<img src="${portrait(team)}" alt=""><div><b>${esc(Settings.v.name)}</b><small>All items unlocked</small></div>`;
  },
  // entrance animation only when the pane changes, not on every re-render inside it
  enter() { const f = this._shown !== this.pane; this._shown = this.pane; return f ? ' enter' : ''; },
  renderPane() {
    const m = $('#mpane'); if (!m) return;
    const p = this.pane;
    if (p === 'play') this.renderPlay(m);
    else if (p === 'online') this.renderOnline(m);
    else if (p === 'inventory') this.renderInventory(m);
    else if (p === 'settings') this.renderSettings(m, false);
    else if (p === 'help') this.renderHelp(m);
    else this.renderHome(m);
  },
  seg(name, opts, cur, cls) { return `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''} ${cls && cls[v] || ''}">${l}</button>`).join('')}</div>`; },
  bindSeg(root, name, cb) { const s = root.querySelector(`[data-seg="${name}"]`); if (!s) return; for (const b of s.querySelectorAll('button')) b.addEventListener('click', () => { for (const x of s.querySelectorAll('button')) x.classList.toggle('on', x === b); SFX.ui('ui_click'); cb(b.dataset.v); }); },
  closeBtn() { return `<span style="flex:1"></span><button class="iconbtn" data-close aria-label="Close" style="align-self:center;margin-right:10px">${NAVI.close}</button>`; },
  bindClose(m) { const c = m.querySelector('[data-close]'); if (c) c.addEventListener('click', () => { SFX.ui('ui_click'); this.open('home'); }); },
  curMode() { const S = Settings.v; return MODES[S.mode] || MODES.competitive; },
  modeFacts(md) {
    if (md.ffa) return [['Players', 'Free for all · 10'], ['Time limit', Math.round(md.timeLimit / 60) + ' minutes'], ['Respawn', 'Instant'], ['Weapons', md.armsRace ? 'Upgrade on every kill' : 'All free']];
    return [['Teams', md.teamSize + ' vs ' + md.teamSize], ['Win', 'First to ' + md.win], ['Round time', fmtTime(md.roundTime)], ['Start money', fmtMoney(md.startMoney || 800)], ['Bomb sites', md.sites.join(' and ')]];
  },
  startCurrent() { const S = Settings.v; SFX.ui('ui_click'); App.startMatch({ mode: this.curMode().id, diff: S.difficulty, team: S.team, ff: S.ff }); },

  /* ---------- home ---------- */
  renderHome(m) {
    const md = this.curMode(), S = Settings.v;
    m.innerHTML = `<div class="home${this.enter()}">
      <div class="left">
        <button class="news big" data-go="inventory" style="--thumb:url(${mapThumb('A')})"><span class="tag">ALL FREE</span><h3>Every CS2 weapon</h3><p>All 34 guns from the R8 Revolver to the SCAR-20, six knives and fifteen finishes. Nothing to buy, ever.</p></button>
        <button class="news" data-go="online"><h3>Play with friends</h3><p>Host a room and share the five-letter code. Peer to peer, no account.</p></button>
        <button class="news" data-go="help"><h3>How to play</h3><p>Economy, spray control, utility and the bomb, explained in one page.</p></button>
      </div>
      <div></div>
      <div class="right"><div class="quick"><div class="qh"><div><b>${esc(md.name)}</b><span>de_dustline · ${md.ffa ? 'Free for all' : md.teamSize + 'v' + md.teamSize} · ${DIFF_NAMES[S.difficulty] || 'Hard'} bots</span></div><button class="pill" data-go="play" style="color:var(--text)">Change</button></div>
        <div class="qs">${(md.ffa ? [Math.round(md.timeLimit / 60) + ' minutes', 'Instant respawn'] : ['First to ' + md.win, 'Friendly fire ' + (md.ff && S.ff ? 'on' : 'off')]).map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>
        <button class="gobtn" id="quickGo">${NAVI.play}GO</button></div></div>
    </div>`;
    for (const b of m.querySelectorAll('[data-go]')) b.addEventListener('click', () => { SFX.ui('ui_click'); this.open(b.dataset.go); });
    $('#quickGo').addEventListener('click', () => this.startCurrent());
  },

  /* ---------- play: offline with bots ---------- */
  playTabs(on) { return `<div class="tabs1"><button class="tab1${on === 'play' ? ' on' : ''}" data-tab="play">Play with bots</button><button class="tab1${on === 'online' ? ' on' : ''}" data-tab="online">Play online</button>${this.closeBtn()}</div>`; },
  bindPlayTabs(m) { for (const b of m.querySelectorAll('[data-tab]')) b.addEventListener('click', () => { if (this.pane === b.dataset.tab) return; SFX.ui('ui_click'); this.pane = b.dataset.tab; this._shown = this.pane; for (const n of this.el.querySelectorAll('.topnav [data-p]')) n.classList.toggle('on', n.dataset.p === this.pane); this.renderPane(); }); this.bindClose(m); },
  renderPlay(m) {
    const S = Settings.v, md = this.curMode();
    const site = md.sites && md.sites.length === 1 ? md.sites[0] : 'A';
    m.innerHTML = `<section class="sheet${this.enter()}">${this.playTabs('play')}
      <div class="tabs2">${MODE_ORDER.map(id => `<button class="tab2${md.id === id ? ' on' : ''}" data-m="${id}">${esc(MODES[id].name)}</button>`).join('')}</div>
      <div class="body"><div class="main"><p class="modedesc">${esc(md.desc)}</p>
        <div class="maps"><button class="mapcard on" style="--thumb:url(${mapThumb(site)})"><span class="chk">${NAVI.check}</span><span class="mn"><b>Dustline</b><span>de_dustline · ${md.bomb ? 'Bomb defusal' + (md.sites.length === 1 ? ', site ' + md.sites[0] : '') : 'Deathmatch arena'}</span></span></button></div>
        <div class="stats">${this.modeFacts(md).map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
        <aside class="side">
          <div class="field"><label>Bot difficulty</label>${this.seg('diff', DIFFS, S.difficulty)}</div>
          ${md.ffa ? '' : `<div class="field"><label>Your team</label>${this.seg('team', TEAMS, S.team, { T: 't', CT: 'ct' })}</div>`}
          ${md.ffa || !md.ff ? '' : `<div class="field"><label>Friendly fire</label>${this.seg('ff', [['true', 'On'], ['false', 'Off']], S.ff)}</div>`}
        </aside></div>
      <div class="bottom"><div class="sum"><b>${esc(md.name)}</b> · de_dustline · ${DIFF_NAMES[S.difficulty] || 'Hard'} bots<br><span class="note">Hold <kbd>${esc(keyName(S.binds.walk))}</kbd> to walk silently · crouch with <kbd>${esc(keyName(S.binds.crouch))}</kbd> or <kbd>${esc(keyName(S.binds.crouch2))}</kbd></span></div><button class="gobtn" id="goBtn">${NAVI.play}GO</button></div>
    </section>`;
    this.bindPlayTabs(m);
    for (const b of m.querySelectorAll('[data-m]')) b.addEventListener('click', () => { S.mode = b.dataset.m; Settings.save(); SFX.ui('ui_click'); this.renderPlay(m); });
    this.bindSeg(m, 'diff', v => { S.difficulty = v; Settings.save(); this.renderPlay(m); });
    this.bindSeg(m, 'team', v => { S.team = v; Settings.save(); });
    this.bindSeg(m, 'ff', v => { S.ff = v === 'true'; Settings.save(); });
    $('#goBtn').addEventListener('click', () => this.startCurrent());
  },

  /* ---------- play online ---------- */
  renderOnline(m) {
    const S = Settings.v, N = Net;
    let main = '', go = '';
    if (N.role === 'off' && !N.connecting) {
      main = `<div class="grid2"><div class="card"><h3>Host a match</h3><p>Create a room and share its code. Bots fill the empty slots, and the match runs on your computer.</p><button class="btn prim" id="hostBtn">Create room</button></div>
        <div class="card"><h3>Join a match</h3><p>Enter the five-letter code your friend sees on their screen.</p><div style="display:flex;gap:10px"><input class="tfield" id="joinCode" maxlength="5" placeholder="CODE" aria-label="Room code" style="text-transform:uppercase;letter-spacing:.24em;font-family:var(--d);font-weight:700;font-size:20px"><button class="btn prim" id="joinBtn">Join</button></div></div></div>`;
    } else if (N.connecting) {
      main = `<div class="card"><h3>Connecting</h3><p>${esc(N.statusText || 'Connecting…')}</p><button class="btn danger" id="leaveBtn">Cancel</button></div>`;
    } else {
      const isHost = N.role === 'host', L = N.lobby || { players: [], cfg: {} }, cfg = L.cfg || {};
      main = `<div class="card"><div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px"><div><h3 style="margin:0 0 6px">Room code</h3><div class="code">${esc(N.code || '')}</div></div><button class="btn danger" id="leaveBtn">${isHost ? 'Close room' : 'Leave'}</button></div>
          <div class="lobby">${L.players.map(p => `<div class="pl ${p.team === 'T' ? 't' : p.team === 'CT' ? 'ct' : ''}"><img src="${portrait(p.team === 'T' ? 'T' : 'CT')}" alt=""><b>${esc(p.name)}${p.host ? ' (host)' : ''}</b><small class="${p.team === 'T' || p.team === 'CT' ? '' : 'auto'}">${p.team === 'T' ? 'Terrorists' : p.team === 'CT' ? 'Counter-Terrorists' : 'Auto'}</small></div>`).join('')}</div></div>
        <div class="field" style="margin-top:20px"><label>Your team</label>${this.seg('nteam', TEAMS, N.myTeam || 'auto', { T: 't', CT: 'ct' })}</div>
        ${isHost ? `<div class="field"><label>Mode</label>${this.seg('nmode', MODE_ORDER.map(id => [id, MODES[id].name]), cfg.mode || 'competitive')}</div><div class="field"><label>Bot difficulty</label>${this.seg('ndiff', DIFFS, cfg.diff || 'hard')}</div>`
          : `<p class="note">Mode: <b style="color:var(--text)">${esc((MODES[cfg.mode] || MODES.competitive).name)}</b>. The host starts the match.</p>`}`;
      if (isHost) go = `<button class="gobtn" id="nstart">${NAVI.play}Start</button>`;
    }
    m.innerHTML = `<section class="sheet${this.enter()}">${this.playTabs('online')}
      <div class="body"><div class="main"><div class="field"><label for="nameIn">Your name</label><input class="tfield" id="nameIn" maxlength="16" value="${esc(S.name)}" style="max-width:360px"></div>${main}</div>
        <aside class="side"><div class="field"><label>How it works</label><p class="note">Everyone opens this same page. One player hosts, the others join with the code. Connections go directly between players over the free PeerJS signaling network, so there is nothing to install and no account.</p></div>
          <div class="field"><label>Trouble joining?</label><p class="note">Very strict networks, such as some school or mobile carrier connections, block direct links. If joining times out, try a different network.</p></div></aside></div>
      <div class="bottom"><div class="sum"><div class="status ${N.statusCls || ''}" id="netStatus">${esc(N.status || '')}</div></div>${go}</div>
    </section>`;
    this.bindPlayTabs(m);
    const nameIn = $('#nameIn'); nameIn.addEventListener('input', () => { S.name = nameIn.value.replace(/[<>]/g, '').slice(0, 16) || 'Player'; Settings.save(); this.renderMe(); });
    const hb = $('#hostBtn'); if (hb) hb.addEventListener('click', () => { SFX.ui('ui_click'); Net.host(); });
    const jc = $('#joinCode'), jb = $('#joinBtn');
    const join = () => { const c = jc.value.trim().toUpperCase(); if (c.length < 4) { Net.setStatus('Enter the room code', 'err'); return; } SFX.ui('ui_click'); Net.join(c); };
    if (jb) jb.addEventListener('click', join);
    if (jc) jc.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    const lb = $('#leaveBtn'); if (lb) lb.addEventListener('click', () => { Net.leave(); this.renderPane(); });
    this.bindSeg(m, 'nteam', v => Net.setTeam(v));
    this.bindSeg(m, 'nmode', v => Net.setCfg({ mode: v }));
    this.bindSeg(m, 'ndiff', v => Net.setCfg({ diff: v }));
    const ns = $('#nstart'); if (ns) ns.addEventListener('click', () => { SFX.ui('ui_click'); Net.startMatch(); });
  },

  /* ---------- loadout ---------- */
  wName(id) { return id === 'knife' ? KNIVES.find(k => k.id === Loadout.v.knife).name : W[id].name; },
  renderInventory(m) {
    const sel = this.invSel, cur = Loadout.skinFor(sel), R = App.renderer;
    const skin = SKINS.find(s => s.id === cur) || SKINS[0];
    let list = '';
    for (const [g, ids] of LOADOUT_GROUPS) { list += `<h5>${g}</h5>`; for (const id of ids) list += `<button class="wb${id === sel ? ' on' : ''}" data-w="${id}"><img src="${Models.skinIcon(R, id, Loadout.skinFor(id))}" alt=""><span>${esc(this.wName(id))}</span></button>`; }
    const skins = SKINS.map(s => `<button class="skin${s.id === cur ? ' on' : ''}" data-s="${s.id}" style="--rc:var(--r${s.r + 1})">${s.id === cur ? '<span class="eq">EQUIPPED</span>' : ''}<img src="${Models.skinIcon(R, sel, s.id)}" alt=""><span class="sn"><b>${esc(s.name)}</b><span>${RARITY[s.r]}</span></span><i></i></button>`).join('');
    const scroll = m.querySelector('.lo .cats') ? m.querySelector('.lo .cats').scrollTop : 0;
    m.innerHTML = `<section class="sheet${this.enter()}"><div class="tabs1"><button class="tab1 on">Loadout</button>${this.closeBtn()}</div>
      <div class="lo"><nav class="cats">${list}</nav><div class="view">
        <div class="hero"><img src="${Models.skinHero(R, sel, cur)}" alt=""><div><h2>${esc(this.wName(sel))}</h2><div class="sk" style="color:var(--r${skin.r + 1})">${esc(skin.name)} · ${RARITY[skin.r]}</div><span class="free">FREE</span>
          ${sel === 'knife' ? `<div class="field" style="margin-top:18px"><label>Knife type</label>${this.seg('ktype', KNIVES.map(k => [k.id, k.name.replace(' Knife', '')]), Loadout.v.knife)}</div>` : `<p class="note" style="margin-top:14px">Shows in your hands, on your agent and when you drop it.</p>`}</div></div>
        <div class="skins">${skins}</div></div></div></section>`;
    const cats = m.querySelector('.lo .cats'); if (cats) cats.scrollTop = scroll;
    this.bindClose(m);
    for (const b of m.querySelectorAll('.wb')) b.addEventListener('click', () => { this.invSel = b.dataset.w; SFX.ui('ui_click'); this.renderInventory(m); });
    for (const b of m.querySelectorAll('.skin')) b.addEventListener('click', () => {
      if (sel === 'knife') Loadout.v.knifeSkin = b.dataset.s; else Loadout.v.skins[sel] = b.dataset.s;
      Loadout.save(); SFX.ui('buy', .4); this.renderInventory(m); App.refreshMenuModel();
    });
    this.bindSeg(m, 'ktype', v => { Loadout.v.knife = v; Loadout.save(); this.renderInventory(m); App.refreshMenuModel(); });
  },

  /* ---------- how to play ---------- */
  renderHelp(m) {
    const b = Settings.v.binds, k = a => `<kbd>${esc(keyName(b[a]))}</kbd>`;
    m.innerHTML = `<section class="sheet${this.enter()}"><div class="tabs1"><button class="tab1 on">How to play</button>${this.closeBtn()}</div><div class="main" style="flex:1;overflow:auto;padding:22px 24px"><div class="help">
      <div class="card"><h3>Controls</h3><ul><li>${k('forward')}${k('left')}${k('back')}${k('right')} move, ${k('jump')} jump</li><li>${k('crouch')} or ${k('crouch2')} crouch, ${k('walk')} walk silently</li><li>Mouse 1 fire, Mouse 2 scope, burst, silencer or stab</li><li>${k('reload')} reload, ${k('use')} use, defuse, pick up, ${k('drop')} drop</li><li>${k('slot1')} to ${k('slot5')} weapons, ${k('lastWeapon')} last weapon, wheel cycles</li><li>${k('buy')} buy menu, ${k('scores')} scoreboard, ${k('inspect')} inspect</li><li>${k('chat')} chat, ${k('teamChat')} team chat, ${k('teamMenu')} change team</li></ul></div>
      <div class="card"><h3>Bomb defusal</h3><p>Terrorists plant the C4 at site A or B: hold Mouse 1 with the bomb inside a site for 3.2 s. Counter-Terrorists defuse it by holding ${k('use')} for 10 s, or 5 s with a kit. The bomb explodes 40 s after it is planted. Eliminate the enemy team or run out the clock to win as CT.</p></div>
      <div class="card"><h3>Economy</h3><p>Round win $3250 (bomb or defuse $3500). Losing pays $1400, rising by $500 per consecutive loss up to $3400. Kill rewards: $300 rifles and pistols, $600 SMGs, $900 shotguns, $100 AWP, $1500 knife. Terrorists get $800 for a planted bomb even when they lose. Money caps at $16,000.</p></div>
      <div class="card"><h3>Shooting</h3><p>Every automatic weapon has a fixed spray pattern: pull down and against the sideways drift. You are only accurate when standing still, so tap the opposite strafe key to stop instantly before you shoot. Crouching tightens spread. Headshots deal 4× damage. Bullets go through wood, doors and containers.</p></div>
      <div class="card"><h3>Utility</h3><p>Smokes block vision for 18 s and put out fires. Flashbangs blind anyone looking at them, so turn away. Molotovs and incendiaries deny an area for 7 s. HE grenades deal up to 98 damage. Decoys imitate gunfire. Mouse 1 throws far, Mouse 2 lobs short, both together throw medium.</p></div>
      <div class="card"><h3>Special weapons</h3><p>The R8 Revolver fires after a short hammer pull on Mouse 1, or fans the hammer on Mouse 2. The Dual Berettas alternate barrels. The CZ75-Auto is fully automatic. The MP5-SD is always silenced. The G3SG1 and SCAR-20 are semi-auto snipers with two zoom levels.</p></div>
      <div class="card"><h3>Sound</h3><p>Running and jumping make noise that everyone can hear, bots included. Walk (${k('walk')}) or crouch to move silently. Gunfire carries across the map; sounds behind walls are muffled.</p></div>
      <div class="card"><h3>Browser note</h3><p>Ctrl+W closes a browser tab and cannot be blocked in a normal window. Play in fullscreen (the game locks the keyboard there), or crouch with ${k('crouch2')}.</p></div>
    </div></div></section>`;
    this.bindClose(m);
  },

  /* ---------- settings (main menu and pause menu) ---------- */
  renderSettings(m, inGame) {
    const S = Settings.v, tab = this.setTab;
    const tabs = [['game', 'Game'], ['xhair', 'Crosshair'], ['mouse', 'Mouse'], ['video', 'Video'], ['audio', 'Audio'], ['keys', 'Controls']];
    const pct = (k, min, max) => ((S[k] - min) / (max - min) * 100).toFixed(1) + '%';
    const range = (key, label, min, max, step, fmt) => `<div class="set"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${S[key]}" aria-label="${label}" style="--p:${pct(key, min, max)}"><output>${fmt ? fmt(S[key]) : S[key]}</output></div>`;
    const tog = (key, label) => `<div class="set"><span>${label}</span>${this.seg('t_' + key, [['true', 'On'], ['false', 'Off']], S[key])}<output></output></div>`;
    let body = '';
    if (tab === 'game') body = `<div class="set"><span>Name</span><input class="tfield" id="setName" maxlength="16" value="${esc(S.name)}" aria-label="Name" style="max-width:360px"><output></output></div>` + range('fov', 'Field of view (vertical)', 60, 90, 1, v => v + '°') + range('vmFov', 'Viewmodel field of view', 54, 75, 1, v => v + '°') + tog('bob', 'Weapon bob') + tog('autoFull', 'Fullscreen during matches') + tog('showFps', 'Show FPS') + tog('announcer', 'Announcer voice') + tog('blood', 'Blood effects');
    else if (tab === 'xhair') body = `<div style="display:grid;grid-template-columns:1fr auto;gap:28px;align-items:start"><div>` + `<div class="set"><span>Style</span>${this.seg('xst', [['classic', 'Classic'], ['dot', 'Dot'], ['circle', 'Circle']], S.xhStyle)}<output></output></div>` + range('xhSize', 'Length', 0, 12, .5) + range('xhGap', 'Gap', -2, 8, .5) + range('xhThick', 'Thickness', .5, 4, .5) + range('xhAlpha', 'Opacity', .2, 1, .05) + `<div class="set"><span>Color</span><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${['#4cff5a', '#00ffff', '#ffff00', '#ff3b3b', '#ffffff', '#ff4fd8'].map(c => `<button class="swatch${S.xhColor === c ? ' on' : ''}" data-col="${c}" aria-label="Color ${c}" style="background:${c}"></button>`).join('')}<input type="color" id="xhCol" value="${S.xhColor}" aria-label="Custom color" style="width:40px;height:30px;border:0;background:none"></div><output></output></div>` + tog('xhOutline', 'Outline') + tog('xhDot', 'Center dot') + tog('xhDynamic', 'Dynamic (shows spread)') + `</div><canvas class="xhprev" id="xhPrev" width="240" height="240" style="background-image:url(${mapThumb('A')})"></canvas></div>`;
    else if (tab === 'mouse') body = range('sens', 'Sensitivity', .1, 8, .05) + range('zoomRatio', 'Zoom sensitivity ratio', .3, 2, .05) + tog('invertY', 'Invert Y axis') + tog('rawInput', 'Raw input (unadjusted movement)');
    else if (tab === 'video') body = range('renderScale', 'Render scale', .5, 1.5, .05, v => Math.round(v * 100) + '%') + `<div class="set"><span>Shadows</span>${this.seg('shadows', [['off', 'Off'], ['medium', 'Medium'], ['high', 'High']], S.shadows)}<output></output></div><div class="set"><span>Texture detail (after reload)</span>${this.seg('texQ', [['medium', 'Medium'], ['high', 'High']], S.texQ)}<output></output></div>` + tog('aa', 'Anti-aliasing (after reload)') + `<p class="note" style="margin-top:14px">Lower the render scale or shadows if the frame rate drops.</p>`;
    else if (tab === 'audio') body = range('volume', 'Master volume', 0, 1, .01, v => Math.round(v * 100) + '%') + range('sfx', 'Game effects', 0, 1.5, .01, v => Math.round(v * 100) + '%') + range('ui', 'Interface', 0, 1, .01, v => Math.round(v * 100) + '%');
    else body = Object.keys(BIND_LABELS).map(a => `<div class="set key"><span>${BIND_LABELS[a]}</span><button class="keybtn" data-bind="${a}">${esc(keyName(S.binds[a]))}</button></div>`).join('') + `<div style="margin-top:18px"><button class="btn" id="resetKeys">Reset to defaults</button></div>`;
    const right = inGame ? `<span style="flex:1"></span><button class="btn" id="setBack" style="align-self:center;margin-right:10px;height:38px">Back</button>` : this.closeBtn();
    const scroll = m.querySelector('.sheet>.main') ? m.querySelector('.sheet>.main').scrollTop : 0;
    const anim = inGame ? (this._shown !== 'pset' ? ' enter' : '') : this.enter(); if (inGame) this._shown = 'pset';
    m.innerHTML = `<section class="sheet${anim}"><div class="tabs1">${tabs.map(([k, n]) => `<button class="tab1${tab === k ? ' on' : ''}" data-t="${k}">${n}</button>`).join('')}${right}</div><div class="main">${body}</div></section>`;
    const main = m.querySelector('.sheet>.main'); if (main && tab === this._setTabShown) main.scrollTop = scroll; this._setTabShown = tab;
    this.bindClose(m);
    for (const b of m.querySelectorAll('[data-t]')) b.addEventListener('click', () => { this.setTab = b.dataset.t; SFX.ui('ui_click'); this.renderSettings(m, inGame); });
    const fmts = { fov: v => v + '°', vmFov: v => v + '°', renderScale: v => Math.round(v * 100) + '%', volume: v => Math.round(v * 100) + '%', sfx: v => Math.round(v * 100) + '%', ui: v => Math.round(v * 100) + '%' };
    for (const r of m.querySelectorAll('input[type=range]')) r.addEventListener('input', () => {
      const k = r.dataset.k; S[k] = parseFloat(r.value);
      r.style.setProperty('--p', ((S[k] - r.min) / (r.max - r.min) * 100).toFixed(1) + '%');
      const o = r.parentElement.querySelector('output'); o.textContent = fmts[k] ? fmts[k](S[k]) : S[k];
      Settings.save(); App.applySettings(); this.drawXhPrev();
    });
    for (const k of ['bob', 'autoFull', 'showFps', 'announcer', 'blood', 'xhOutline', 'xhDot', 'xhDynamic', 'invertY', 'rawInput', 'aa']) this.bindSeg(m, 't_' + k, v => { S[k] = v === 'true'; Settings.save(); App.applySettings(); this.drawXhPrev(); });
    this.bindSeg(m, 'xst', v => { S.xhStyle = v; Settings.save(); this.drawXhPrev(); });
    this.bindSeg(m, 'shadows', v => { S.shadows = v; Settings.save(); App.applySettings(); });
    this.bindSeg(m, 'texQ', v => { S.texQ = v; Settings.save(); App.toast('Texture detail applies after reloading the page'); });
    const nm = $('#setName'); if (nm) nm.addEventListener('input', () => { S.name = nm.value.replace(/[<>]/g, '').slice(0, 16) || 'Player'; Settings.save(); this.renderMe(); if (Game.local && Net.role === 'off') Game.local.name = S.name; });
    for (const b of m.querySelectorAll('[data-col]')) b.addEventListener('click', () => { S.xhColor = b.dataset.col; Settings.save(); for (const x of m.querySelectorAll('[data-col]')) x.classList.toggle('on', x === b); $('#xhCol').value = S.xhColor; this.drawXhPrev(); });
    const xc = $('#xhCol'); if (xc) xc.addEventListener('input', () => { S.xhColor = xc.value; Settings.save(); for (const x of m.querySelectorAll('[data-col]')) x.classList.remove('on'); this.drawXhPrev(); });
    for (const b of m.querySelectorAll('[data-bind]')) b.addEventListener('click', () => {
      b.classList.add('wait'); b.textContent = 'Press a key';
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
    el.innerHTML = `<div class="box"><h2>Paused</h2><button class="btn prim" id="pResume">Resume</button><button class="btn" id="pScore">Scoreboard</button><button class="btn" id="pTeam">Change team</button><button class="btn" id="pSet">Settings</button><button class="btn" id="pFull">${document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'}</button><button class="btn danger" id="pLeave">${Net.role === 'client' ? 'Disconnect' : 'Leave match'}</button>
      <p>${Net.role === 'off' ? 'The match keeps running while this menu is open.' : 'Online match: the game keeps running.'}</p></div>`;
    $('#pResume').addEventListener('click', () => App.resume());
    $('#pScore').addEventListener('click', () => { App.resume(); HUD.showScores(true); setTimeout(() => HUD.showScores(false), 3000); });
    $('#pTeam').addEventListener('click', () => { App.resume(); setTimeout(() => HUD.openTeam(), 50); });
    $('#pSet').addEventListener('click', () => { this._shown = ''; el.innerHTML = '<div class="setwrap" id="pset"></div>'; this.renderSettings($('#pset'), true); });
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
    const st = lp ? [[lp.kills, 'Kills'], [lp.deaths, 'Deaths'], [lp.assists, 'Assists'], [hs + '%', 'Headshots'], [Math.round(lp.dmgDealt / Math.max(1, lp.roundsPlayed || G.round)), 'ADR'], [lp.mvps, 'MVPs']] : [];
    el.innerHTML = `<h1 class="${cls}">${title}</h1>${M.ffa ? '' : `<div class="fs num"><span style="color:var(--ct)">${G.score.CT}</span> : <span style="color:var(--t)">${G.score.T}</span></div>`}
      <div class="st">${st.map(([v, l]) => `<div><b class="num">${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="row">${Net.role === 'client' ? '' : '<button class="btn prim" id="meAgain">Play again</button>'}<button class="btn" id="meMenu">Main menu</button></div>`;
    const a = $('#meAgain'); if (a) a.addEventListener('click', () => { show(el, false); if (Net.role === 'host') Net.startMatch(); else App.startMatch(G.cfg); });
    $('#meMenu').addEventListener('click', () => { show(el, false); App.leaveMatch(); });
  }
};
