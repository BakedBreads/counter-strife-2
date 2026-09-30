/* ===================== HUD ===================== */
const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const portrait = t => (Agents.portraits && Agents.portraits[t === 'T' ? 'T' : 'CT']) || BLANK_IMG;
const teamCls = t => t === 'T' ? 't' : 'ct';
const HUD = {
  el: {}, kf: [], dmg: [], lastW: '', wlistT: 0, chatLines: [], buyOpen: false, scoreOpen: false, teamOpen: false,
  buyCat: -1, xhKey: '', moneyShown: -1, gainT: 0, centerT: 0, hintT: 0, flashT0: 0, flashDur: 0, sbT: 0, radarT: 0,
  init() {
    for (const id of ['hud', 'xhair', 'topbar', 'radar', 'loc', 'money', 'buyhint', 'killfeed', 'center', 'roundBanner', 'hint', 'prog', 'chat', 'chatIn', 'chatText', 'vitals', 'wlist', 'ammo', 'spec', 'fps', 'net', 'score', 'buy', 'teamSel', 'scope', 'vignette', 'flashImg', 'flashWhite', 'dmgRing', 'bombStat'])
      this.el[id] = document.getElementById(id);
    this.rg = this.el.radar.getContext('2d');
    this.el.chatText.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const t = this.el.chatText.value.trim(); if (t) this.sendChat(t, this.chatTeam); this.closeChat(); e.preventDefault(); }
      else if (e.key === 'Escape') { this.closeChat(); e.preventDefault(); }
      e.stopPropagation();
    });
  },
  show(on) { show(this.el.hud, on); },
  reset() {
    this.kf = []; this.el.killfeed.innerHTML = ''; this.el.roundBanner.innerHTML = ''; this.el.center.innerHTML = '';
    this.chatLines = []; this.el.chat.innerHTML = ''; this.closeBuy(); this.showScores(false); this.closeTeam();
    this.el.flashWhite.style.opacity = 0; this.el.flashImg.style.opacity = 0; this.flashDur = 0; this.moneyShown = -1; this.lastW = '';
    this._top = this._vit = this._am = this._spec = this._hint = '';
  },
  /* ---------- per frame ---------- */
  update(dt) {
    const G = Game, lp = G.local; if (!lp) return;
    const vp = G.viewPlayer() || lp, now = G.time;
    // health and armor plate
    const hpLow = vp.hp <= 25 && vp.alive;
    const vit = `<div class="vital${hpLow ? ' low' : ''}">${ICON.health}<span class="v">${vp.hp}</span><div class="bar"><i style="transform:scaleX(${vp.hp / 100})"></i></div></div>` +
      `<div class="vital">${vp.helmet ? ICON.helmet : ICON.armor}<span class="v">${vp.armor}</span><div class="bar"><i style="transform:scaleX(${vp.armor / 100})"></i></div></div>` +
      (vp.defuser ? `<div id="kitIcon">${ICON.kit}</div>` : '');
    if (vit !== this._vit) { this.el.vitals.innerHTML = vit; this._vit = vit; }
    // ammo plate
    const w = vp.active; let am = '';
    if (w && vp.alive) {
      const d = w.def;
      if (d.mag && d.cat !== 'zeus') {
        const tag = w.burst ? 'Burst' : d.sil && !w.silenced ? 'No silencer' : '';
        am = `${tag ? `<span class="wn">${tag}</span>` : ''}<span class="clip${w.clip <= Math.ceil(d.mag * .2) ? ' low' : ''}">${w.clip}</span><span class="res">/ ${G.mode.infiniteAmmo ? '∞' : w.reserve}</span>${ICON.bullet}`;
      } else am = `<span class="wn">${esc(d.name)}</span>${d.cat === 'grenade' ? `<span class="clip">${vp.nadeCount(w.id)}</span>` : d.cat === 'zeus' ? `<span class="res">${w.clip === 0 ? 'Charging' : 'Ready'}</span>` : ''}`;
    }
    if (am !== this._am) { this.el.ammo.innerHTML = am; this._am = am; }
    // weapon list (fades after a short while)
    const key = vp.weapons().map(x => x.uid).join(',') + '|' + (w ? w.uid : 0);
    if (key !== this.lastW) { this.lastW = key; this.wlistT = 2.5; this.renderWList(vp); }
    this.wlistT -= dt; this.el.wlist.classList.toggle('fade', this.wlistT < 0 && !this.buyOpen);
    // money
    if (lp.money !== this.moneyShown) {
      const diff = this.moneyShown >= 0 ? lp.money - this.moneyShown : 0;
      this.el.money.querySelector('.v').textContent = fmtMoney(lp.money);
      const g = this.el.money.querySelector('.gain');
      if (diff !== 0) { g.textContent = (diff > 0 ? '+' : '−') + fmtMoney(Math.abs(diff)); g.classList.toggle('neg', diff < 0); g.classList.add('show'); this.gainT = 2.5; }
      this.moneyShown = lp.money;
    }
    if (this.gainT > 0) { this.gainT -= dt; if (this.gainT <= 0) this.el.money.querySelector('.gain').classList.remove('show'); }
    const canBuy = G.canBuy(lp), bk = `<kbd>${esc(keyName(Settings.v.binds.buy))}</kbd>`;
    const bh = G.mode.freeBuy ? (lp.alive ? 'Free buy ' + bk : '') : canBuy ? 'Buy zone ' + bk : '';
    if (bh !== this._bh) { this.el.buyhint.innerHTML = bh; this._bh = bh; }
    if (this.buyOpen && !canBuy) this.closeBuy();
    const loc = World.callout(vp.pos.x, vp.pos.z); if (loc !== this._loc) { this.el.loc.textContent = loc; this._loc = loc; }
    this.renderTop();
    this.radarT -= dt; if (this.radarT <= 0) { this.radarT = 1 / 30; this.renderRadar(vp); }
    this.renderXhair(vp);
    // scope
    const scoped = vp.alive && vp.zoom > 0 && w && w.def.scope && !App.thirdPerson;
    this.el.scope.classList.toggle('on', !!scoped);
    // flash
    const fl = this.flashAmount(vp);
    this.el.flashWhite.style.opacity = fl.white; this.el.flashImg.style.opacity = fl.img;
    // hurt vignette + damage arcs
    const since = now - (vp.lastDamageT || -9);
    this.el.vignette.style.opacity = vp.alive ? clamp(.8 - since * 1.6, 0, .8) * (vp === lp ? 1 : .5) + (vp.hp <= 20 && vp.alive ? .25 : 0) : 0;
    this.updateDmg(vp);
    // plant / defuse progress
    this.renderProgress(vp);
    // hints and center text timers
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) show(this.el.hint, false); }
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) this.el.center.innerHTML = ''; }
    // use prompts
    if (lp.alive && G.phase !== 'freeze') this.usePrompt(lp);
    // spectator card
    let sp = '';
    if (!lp.alive && App.specTarget && App.specTarget !== lp) {
      const t = App.specTarget;
      sp = `<img src="${portrait(t.team)}" alt=""><div><b style="color:var(--${teamCls(t.team)})">${esc(t.name)}</b><small>${t.hp} HP · Mouse 1 / Mouse 2 next player · Space ${App.thirdPerson ? 'first person' : 'third person'}${G.mode.respawn ? ' · respawning' : ''}</small></div>`;
    } else if (!lp.alive && G.mode.respawn) sp = `<img src="${portrait(lp.team)}" alt=""><div><b>Respawning</b><small>Back in a moment</small></div>`;
    if (sp !== this._spec) { this._spec = sp; show(this.el.spec, !!sp); if (sp) this.el.spec.innerHTML = sp; }
    // chat fade
    for (const l of this.chatLines) if (!l.old && performance.now() - l.t > 10000) { l.old = true; l.el.classList.add('old'); }
    if (this.scoreOpen) { this.sbT -= dt; if (this.sbT <= 0) { this.sbT = .25; this.renderScores(); } }
    if (this.buyOpen) { this.buyT = (this.buyT || 0) - dt; if (this.buyT <= 0) { this.buyT = .2; this.renderBuy(); } }
    // bomb carrier line under the radar
    const bs = this.el.bombStat;
    if (lp.c4 && lp.alive) { show(bs, true); if (bs._s !== 1) { bs.innerHTML = ICON.bomb + '<span>You have the bomb</span>'; bs._s = 1; } }
    else show(bs, false), bs._s = 0;
  },
  flashAmount(vp) {
    const now = Game.time;
    if (!vp.flashEnd || now >= vp.flashEnd) return { white: 0, img: 0 };
    const t = now - vp.flashStart, dur = vp.flashDur, full = Math.max(0, dur - 1.6);
    const a = t < full ? 1 : clamp(1 - (t - full) / Math.max(.2, dur - full), 0, 1);
    return { white: a * .97, img: t < full ? .9 : a * .9 };
  },
  renderWList(vp) {
    let h = '';
    for (const x of vp.weapons()) {
      const on = x === vp.active;
      h += `<div class="w${on ? ' on' : ''}"><span>${esc(x.def.cat === 'grenade' ? '' : x.def.name)}</span><img src="${Models.icons[x.id]}" alt=""><b>${x.def.slot}</b></div>`;
    }
    this.el.wlist.innerHTML = h;
  },
  // top bar: agent tiles, scores and the round clock
  renderTop() {
    const G = Game, M = G.mode, lp = G.local;
    let clock = '', sub = '', red = false, bomb = false;
    if (G.phase === 'freeze') { clock = fmtTime(G.phaseEnd - G.time); sub = M.ffa ? 'Get ready' : 'Buy time'; }
    else if (G.phase === 'live') {
      if (M.ffa) { clock = fmtTime(G.matchEnd - G.time); sub = M.armsRace && lp ? 'Level ' + Math.min(lp.armsLevel + 1, ARMS.length) + ' / ' + ARMS.length : 'Time left'; }
      else if (G.bomb.state === 'planted') { bomb = true; sub = 'Bomb planted'; }
      else { const l = G.roundLeft(); clock = fmtTime(l); red = l < 10; sub = 'Round ' + G.round; }
    } else if (G.phase === 'over') { if (G.bomb.state === 'planted') { bomb = true; sub = 'Bomb planted'; } else { clock = '0:00'; sub = 'Round over'; } }
    else clock = '-';
    const tile = (p, label) => `<div class="tile ${teamCls(p.team)}${p.alive ? '' : ' dead'}${p.c4 && lp && lp.team === 'T' && p.alive ? ' bomb' : ''}"><img src="${portrait(p.team)}" alt=""><b>${esc(label || p.name)}</b></div>`;
    let key, build;
    if (M.ffa) {
      const leader = G.players.slice().sort((a, b) => b.kills - a.kills)[0];
      key = ['f', clock, sub, lp ? lp.kills : 0, leader ? leader.id + ':' + leader.kills : ''].join('|');
      build = () => `<div class="tm ct">${lp ? tile({ team: lp.team, alive: true, name: 'You' }) : ''}</div><div class="mid"><div class="sc ct">${lp ? lp.kills : 0}</div><div class="clk${red ? ' red' : ''}"><b>${clock}</b><small>${sub}</small></div><div class="sc t">${leader ? leader.kills : 0}</div></div><div class="tm t">${leader ? tile({ team: 'T', alive: true, name: leader === lp ? 'You' : leader.name }) : ''}</div>`;
    } else {
      const ct = G.teamOf('CT'), t = G.teamOf('T');
      key = [clock, sub, red, bomb, G.score.CT, G.score.T, ct.concat(t).map(p => p.id + p.name + (p.alive ? 1 : 0) + (p.c4 ? 'b' : '')).join(',')].join('|');
      build = () => `<div class="tm ct">${ct.map(p => tile(p)).join('')}</div><div class="mid"><div class="sc ct">${G.score.CT}</div><div class="clk${red || bomb ? ' red' : ''}">${bomb ? ICON.bomb : `<b>${clock}</b>`}<small>${sub}</small></div><div class="sc t">${G.score.T}</div></div><div class="tm t">${t.map(p => tile(p)).join('')}</div>`;
    }
    if (key !== this._top) { this._top = key; this.el.topbar.innerHTML = build(); }
  },
  renderRadar(vp) {
    const g = this.rg, S = this.el.radar.width, k = 4.2 * S / 416;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.roundRect ? g.roundRect(0, 0, S, S, 8) : g.rect(0, 0, S, S); g.clip();
    g.translate(S / 2, S / 2); g.rotate(vp.yaw); g.scale(k, k); g.translate(-vp.pos.x, -vp.pos.z);
    g.globalAlpha = .95; g.drawImage(World.radarCanvas, -60, -60, 120, 120); g.globalAlpha = 1;
    const G = Game, lp = G.local, now = G.time;
    const B = G.bomb;
    if (B.pos && (B.state === 'planted' || (B.state === 'dropped' && (lp.team === 'T' || now - (B.seenT || -9) < 2)))) {
      g.fillStyle = B.state === 'planted' ? (Math.floor(now * 4) % 2 ? '#ff4040' : '#ffcf5c') : '#ffcf5c';
      g.fillRect(B.pos.x - 1.1, B.pos.z - .8, 2.2, 1.6);
    }
    for (const p of G.players) {
      if (!p.alive || p === vp) continue;
      const mate = !lp.isEnemy(p) && !G.mode.ffa;
      const seen = now - (p['spot' + lp.team] || -9) < 1.2 || now - (p.spotLocal || -9) < .5;
      if (!mate && !seen) continue;
      g.fillStyle = mate ? (p.team === 'T' ? '#e9b95b' : '#8db4ea') : '#ef4a44';
      g.beginPath(); g.arc(p.pos.x, p.pos.z, 1.25, 0, TAU); g.fill();
      if (mate) { g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .3; g.stroke(); g.fillStyle = '#fff'; g.save(); g.translate(p.pos.x, p.pos.z); g.rotate(-p.yaw); g.fillRect(-.15, -2.2, .3, 1.2); g.restore(); }
      if (p.c4 && lp.team === 'T') { g.fillStyle = '#ffcf5c'; g.fillRect(p.pos.x + .8, p.pos.z - 1.6, 1, .7); }
    }
    g.restore();
    // self arrow
    const a = S / 416;
    g.save(); g.translate(S / 2, S / 2); g.scale(a, a);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.stroke(); g.fill();
    g.restore();
  },
  renderXhair(vp) {
    const s = Settings.v, cv = this.el.xhair;
    const w = vp.active, hide = !vp.alive || (vp.zoom > 0 && w && w.def.scope) || App.thirdPerson || (w && w.def.cat === 'sniper');
    let gap = s.xhGap * 2;
    if (s.xhDynamic && w && w.def.sp && vp.alive) {
      const spreadPx = Math.tan(vp.spread() * DEG) / Math.tan(App.camera.fov * DEG / 2) * (innerHeight / 2);
      gap += clamp(spreadPx * .6, 0, 60);
    }
    gap = Math.round(gap);
    const key = [hide, gap, s.xhSize, s.xhThick, s.xhColor, s.xhOutline, s.xhDot, s.xhAlpha, s.xhStyle].join('|');
    if (key === this.xhKey) return; this.xhKey = key;
    const g = cv.getContext('2d'); g.clearRect(0, 0, 160, 160);
    if (hide) return;
    g.save(); g.translate(80, 80);
    const L = s.xhSize * 2, T = Math.max(1, s.xhThick * 2);
    g.globalAlpha = s.xhAlpha;
    const bar = (x, y, w, h) => { if (s.xhOutline) { g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, h + 2); } g.fillStyle = s.xhColor; g.fillRect(x, y, w, h); };
    if (s.xhStyle === 'dot') bar(-T / 2 - 1, -T / 2 - 1, T + 2, T + 2);
    else if (s.xhStyle === 'circle') { g.strokeStyle = s.xhColor; g.lineWidth = T; g.beginPath(); g.arc(0, 0, gap + L, 0, TAU); g.stroke(); bar(-T / 2, -T / 2, T, T); }
    else {
      bar(-T / 2, -gap - L, T, L); bar(-T / 2, gap, T, L);
      bar(-gap - L, -T / 2, L, T); bar(gap, -T / 2, L, T);
      if (s.xhDot) bar(-T / 2, -T / 2, T, T);
    }
    g.restore();
  },
  usePrompt(lp) {
    const B = Game.bomb;
    if (this.hintT > 0 && !this._autoHint) return;
    const use = keyName(Settings.v.binds.use);
    let t = '';
    if (B.state === 'planted' && lp.team === 'CT' && lp.eye().distanceTo(B.pos) < 2.5 && !lp.defusing) t = ['Hold', use, 'to defuse the bomb' + (lp.defuser ? '' : ' (no kit: 10 s)')];
    else if (lp.c4 && lp.active === lp.c4 && Game.inActiveSite(lp.pos) && !lp.planting) t = ['Hold', 'Mouse 1', 'to plant the bomb'];
    else {
      const e = lp.eye(), d = lp.aimDir();
      for (const it of Items.list) { const L = it.pos.distanceTo(e); if (L < 2.2) { const dot = ((it.pos.x - e.x) * d.x + (it.pos.y - e.y) * d.y + (it.pos.z - e.z) * d.z) / L; if (dot > .85) { t = ['Press', use, 'to pick up ' + it.inst.def.name]; break; } } }
    }
    if (t) { this.setHint(`${esc(t[0])} <kbd>${esc(t[1])}</kbd> ${esc(t[2])}`); show(this.el.hint, true); this._autoHint = true; this.hintT = .15; }
    else if (this._autoHint) { this._autoHint = false; }
  },
  setHint(h) { if (h !== this._hint) { this._hint = h; this.el.hint.innerHTML = h; } },
  renderProgress(vp) {
    const B = Game.bomb, now = Game.time, el = this.el.prog;
    let lbl = '', f = 0, t = false;
    if (vp.planting) { lbl = 'Planting the bomb'; f = (now - vp.plantStart) / 3.2; t = true; }
    else if (vp.defusing && B.defuseLen) { lbl = vp.defuser ? 'Defusing with kit' : 'Defusing'; f = (now - vp.defuseStart) / B.defuseLen; }
    if (!lbl) { show(el, false); return; }
    show(el, true); el.classList.toggle('t', t);
    el.querySelector('.lbl').textContent = lbl; el.querySelector('i').style.width = clamp(f * 100, 0, 100) + '%';
  },
  /* ---------- events ---------- */
  hurt(from, dmg) {
    if (!from) return;
    const lp = Game.local; if (!lp) return;
    const ang = yawTo(from.x - lp.pos.x, from.z - lp.pos.z) - lp.yaw;
    this.dmg.push({ a: ang, t: performance.now(), x: from.x, z: from.z });
    if (this.dmg.length > 6) this.dmg.shift();
  },
  updateDmg(vp) {
    const now = performance.now(); this.dmg = this.dmg.filter(d => now - d.t < 1400);
    let h = '';
    for (const d of this.dmg) {
      const a = yawTo(d.x - vp.pos.x, d.z - vp.pos.z) - vp.yaw, o = clamp(1 - (now - d.t) / 1400, 0, 1);
      h += `<svg class="dmgArc" viewBox="0 0 180 180" style="transform:rotate(${(-a) / DEG}deg);opacity:${o}"><path d="M60 22 A72 72 0 0 1 120 22"/></svg>`;
    }
    if (h !== this._dmg) { this.el.dmgRing.innerHTML = h; this._dmg = h; }
  },
  flash(dur) {
    this.flashDur = dur; App.captureFlash = true;
    if (dur > 1.2) { SFX.play('ring', { vol: clamp(dur / 5, .2, .7), ui: true }); if (SFX.bus) { const g = SFX.bus.gain, t = SFX.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(Settings.v.sfx * .25, t); g.linearRampToValueAtTime(Settings.v.sfx, t + dur); } }
  },
  killfeed(ev) {
    const G = Game, lp = G.local, a = G.players.find(p => p.id === ev.a), v = G.players.find(p => p.id === ev.v), as = ev.as ? G.players.find(p => p.id === ev.as) : null;
    if (!v) return;
    const nm = p => `<span class="${teamCls(p.team)}">${esc(p.name)}</span>`;
    let h = '';
    if (a && a !== v) h += nm(a) + (as ? ' + ' + nm(as) : '');
    if (ev.bl) h += ICON.blind;
    const icon = Models.icons[ev.w];
    h += icon ? `<img src="${icon}" alt="">` : ICON.skull;
    if (ev.ns) h += ICON.noscope; if (ev.sm) h += ICON.smoke; if (ev.pen) h += ICON.wall; if (ev.hs) h += ICON.hs;
    h += nm(v);
    const d = document.createElement('div');
    d.className = 'kf' + ((a === lp || as === lp) && a !== v ? ' me' : '') + (v === lp ? ' dead' : '');
    d.innerHTML = h;
    this.el.killfeed.appendChild(d);
    this.kf.push({ el: d, t: performance.now() });
    while (this.kf.length > 6) { const o = this.kf.shift(); o.el.remove(); }
    setTimeout(() => { d.classList.add('out'); setTimeout(() => { d.remove(); this.kf = this.kf.filter(x => x.el !== d); }, 400); }, 7000);
  },
  center(big, small, dur, cls) {
    this.el.center.innerHTML = (big ? `<div class="big ${cls || ''}">${esc(big)}</div>` : '') + (small ? `<div class="small">${esc(small)}</div>` : '');
    this.centerT = dur || 3;
  },
  hint(t, dur) { this.setHint(esc(t)); show(this.el.hint, true); this.hintT = dur || 2; this._autoHint = false; },
  roundStart() {
    this.el.roundBanner.innerHTML = '';
    const G = Game;
    if (G.mode.ffa) this.center(G.mode.name, 'Get ready', 3);
    else {
      const half = G.round === G.mode.half + 1 ? ' · Second half' : '';
      this.center('Round ' + G.round + (G.otNum ? ' · Overtime' : ''), (G.local && G.local.team === 'T' ? 'Terrorists' : 'Counter-Terrorists') + half + ' · Buy time', 3);
    }
    SFX.ui('round_start', .45);
  },
  roundLive() { if (!Game.mode.ffa) { this.center('', 'Go!', 1.2); } },
  roundEnd(w, msg, mvp) {
    const tn = w === 'T' ? 'Terrorists win' : 'Counter-Terrorists win', cls = teamCls(w);
    let why = '';
    if (mvp) {
      why = mvp.roundKills ? `Most eliminations (${mvp.roundKills})` : 'Round MVP';
      if (Game.bomb.planter === mvp && Game.bomb.state === 'exploded') why = 'Planted the bomb';
      if (Game.bomb.defuserP === mvp) why = 'Defused the bomb';
    }
    this.el.roundBanner.innerHTML = `<div class="rb ${cls}"><div class="band"><h3>${tn}</h3><p>${esc(msg)}</p></div>${mvp ? `<div class="mvp"><img src="${portrait(mvp.team)}" alt=""><span class="star">${ICON.star}</span><div><b>${esc(mvp.name)}</b><span>${why}</span></div></div>` : ''}</div>`;
  },
  /* ---------- chat ---------- */
  openChat(team) {
    this.chatTeam = team; show(this.el.chatIn, true); this.el.chatIn.querySelector('span').textContent = team ? 'Team' : 'All';
    this.el.chatText.value = ''; Input.typing = true; Input.clearAll(); setTimeout(() => this.el.chatText.focus(), 0);
  },
  closeChat() { show(this.el.chatIn, false); this.el.chatText.blur(); Input.typing = false; App.relock(); },
  sendChat(text, team) {
    const lp = Game.local; if (!lp) return;
    text = text.slice(0, 120);
    if (Net.role === 'client') Net.send({ t: 'chat', m: text, tm: team ? 1 : 0 });
    else { this.chat(lp, text, team); Net.event({ t: 'chat', id: lp.id, m: text, tm: team ? 1 : 0 }); }
  },
  chat(p, text, team, radio) {
    const lp = Game.local;
    if (team && lp && p && p.team !== lp.team) return;
    const d = document.createElement('div'); d.className = 'ln';
    const nm = p ? `<span class="${teamCls(p.team)}">${esc(p.name)}${p.alive ? '' : ' (dead)'}</span>` : '<span class="sys">[SERVER]</span>';
    d.innerHTML = radio ? `${nm} <span class="rad">(RADIO): ${esc(text)}</span>` : `${team ? '<span class="sys">(Team)</span> ' : ''}${nm}: ${esc(text)}`;
    this.el.chat.appendChild(d); this.chatLines.push({ el: d, t: performance.now() });
    while (this.chatLines.length > 8) this.chatLines.shift().el.remove();
  },
  sys(text) { this.chat(null, text, false, false); },
  /* ---------- scoreboard ---------- */
  showScores(on) { this.scoreOpen = on; show(this.el.score, on); if (on) { this.sbT = 0; this.renderScores(); } },
  renderScores() {
    const G = Game, lp = G.local, M = G.mode, online = Net.role !== 'off';
    const row = p => {
      const hs = p.kills > 0 ? Math.round(p.hsKills / Math.max(1, p.kills) * 100) : 0;
      const adr = Math.round(p.dmgDealt / Math.max(1, p.roundsPlayed || G.round));
      const money = !M.ffa && lp && p.team === lp.team ? fmtMoney(p.money) : '';
      const bomb = p.c4 && lp && lp.team === 'T' && p.alive ? ` <span style="color:var(--gold)">${ICON.bomb}</span>` : '';
      return `<tr class="${p === lp ? 'me ' : ''}${p.alive ? '' : 'dead'}"><td><div class="who"><img src="${portrait(p.team)}" alt="">${esc(p.name)}${p.isBot ? '<span class="bot">BOT</span>' : ''}${bomb}</div></td>${M.ffa ? '' : `<td>${money}</td>`}<td>${p.kills}</td><td>${p.deaths}</td><td>${p.assists}</td><td>${hs}%</td><td>${adr}</td><td>${p.mvps ? '★ ' + p.mvps : ''}</td><td>${p.score}</td>${online ? `<td>${p.isBot ? 'BOT' : p.ping + ' ms'}</td>` : ''}</tr>`;
    };
    const head = `<tr><th>Player</th>${M.ffa ? '' : '<th class="m">Money</th>'}<th>K</th><th>D</th><th>A</th><th>HS</th><th>ADR</th><th>MVP</th><th>Score</th>${online ? '<th>Ping</th>' : ''}</tr>`;
    let h = `<div class="sh"><b>${esc(M.name)} · ${esc(MAPDEF.id)}</b><span>${M.ffa ? 'Time left ' + fmtTime(G.matchEnd - G.time) : 'Round ' + G.round + ' of ' + G.maxRounds + ' · first to ' + G.win}</span></div>`;
    if (M.ffa) {
      const L = G.players.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      h += `<table>${head}${L.map(row).join('')}</table>`;
    } else {
      const team = t => {
        const L = G.teamOf(t).sort((a, b) => b.score - a.score || b.kills - a.kills);
        return `<div class="team ${teamCls(t)}"><div class="big num">${G.score[t]}<small>${t === 'T' ? 'T' : 'CT'}</small></div><table>${head}${L.map(row).join('')}</table></div>`;
      };
      const icon = r => r === 'bomb' ? ICON.bomb : r === 'defuse' ? ICON.defuse : r === 'time' ? ICON.clock : ICON.elim;
      const hist = `<div class="hist"><span>Rounds</span>${G.history.map(x => x.half ? '<i class="half"></i>' : `<i class="${teamCls(x.w)}">${icon(x.r)}</i>`).join('')}</div>`;
      const mine = lp && lp.team === 'T' ? 'T' : 'CT';
      h += team(mine) + hist + team(mine === 'T' ? 'CT' : 'T');
    }
    this.el.score.innerHTML = h;
  },
  /* ---------- buy menu ---------- */
  openBuy() {
    const lp = Game.local; if (!lp || !Game.canBuy(lp)) { if (lp && lp.alive) this.hint(Game.mode.armsRace ? 'No buying in Arms Race' : 'You are not in a buy zone or buy time is over', 1.5); return; }
    this.buyOpen = true; this.buyCat = -1; show(this.el.buy, true); this.renderBuy(true); App.overlayChanged();
  },
  closeBuy() { if (!this.buyOpen) return; this.buyOpen = false; show(this.el.buy, false); App.overlayChanged(); },
  buyList(col, lp) { return Game.mode.ffa ? [...new Set(col.T.concat(col.CT))].filter(id => id !== 'defuser') : col[lp.team]; },
  renderBuy(force) {
    const G = Game, lp = G.local; if (!lp) return;
    const free = G.mode.freeBuy;
    const left = free ? 'Every weapon is free' : G.phase === 'freeze' ? 'Buy time ' + fmtTime(G.phaseEnd - G.time + G.mode.buyTime) : 'Buy time ' + fmtTime(G.mode.buyTime - (G.time - G.liveStart));
    const owned = id => (lp.primary && lp.primary.id === id) || (lp.secondary && lp.secondary.id === id) || (id === 'zeus' && lp.zeus) || (W[id] && W[id].slot === 4 && lp.nadeCount(id) >= W[id].max) || (id === 'vest' && lp.armor >= 100) || (id === 'vesthelm' && lp.armor >= 100 && lp.helmet) || (id === 'defuser' && lp.defuser);
    const key = [lp.money, lp.armor, lp.helmet, lp.defuser, lp.weapons().map(w => w.id).join(), this.buyCat, left].join('|');
    if (key === this._buyKey && !force) return; this._buyKey = key;
    let h = `<div class="box"><div class="top"><h3>Buy menu</h3><span class="tl">${left}</span><span class="cash num">${free ? 'Free' : fmtMoney(lp.money)}</span></div><div class="cols">`;
    BUY.forEach((col, ci) => {
      const hl = this.buyCat === ci;
      h += `<div class="col${hl ? ' hl' : ''}"><h4><kbd>${ci + 1}</kbd>${col.name}</h4>`;
      this.buyList(col, lp).forEach((id, ii) => {
        const price = free ? 0 : (id === 'vesthelm' && lp.armor >= 100 && !lp.helmet ? 350 : itemPrice(id));
        const own = owned(id), can = lp.money >= price && !own;
        const img = W[id] ? `<img src="${W[id].cat === 'grenade' || id === 'zeus' ? Models.iconsColor[id] : Models.icons[id]}" alt="">` : `<div class="eq">${id === 'defuser' ? ICON.kit : id === 'vest' ? ICON.armor : ICON.helmet}</div>`;
        h += `<button class="it${can ? '' : ' no'}${own ? ' own' : ''}" data-id="${id}"><span class="k">${hl ? ii + 1 : ''}</span>${img}<span class="nm">${esc(itemName(id))}</span><span class="pr num">${own ? 'Owned' : free ? '' : fmtMoney(price)}</span></button>`;
      });
      h += '</div>';
    });
    h += `</div><div class="foot"><span><kbd>1</kbd>–<kbd>${BUY.length}</kbd> pick a column, then the item number</span><span><kbd>${esc(keyName(Settings.v.binds.buy))}</kbd> or <kbd>Esc</kbd> close</span><span>Weapons you replace are dropped</span></div></div>`;
    this.el.buy.innerHTML = h;
    for (const b of this.el.buy.querySelectorAll('.it')) b.addEventListener('click', () => this.buyItem(b.dataset.id));
    this.el.buy.onclick = e => { if (e.target === this.el.buy) this.closeBuy(); };
  },
  buyItem(id) {
    const lp = Game.local; if (!lp) return;
    if (Net.role === 'client') { Net.send({ t: 'buy', i: id }); return; }
    const err = Game.buy(lp, id);
    if (err) { SFX.ui('deny', .5); this.hint(err, 1.4); }
    this._buyKey = ''; this.renderBuy();
  },
  buyKey(n) {
    const lp = Game.local; if (!lp) return;
    if (this.buyCat < 0) { if (n >= 1 && n <= BUY.length) { this.buyCat = n - 1; this.renderBuy(true); } return; }
    const id = this.buyList(BUY[this.buyCat], lp)[n - 1]; this.buyCat = -1;
    if (id) this.buyItem(id); else this.renderBuy(true);
  },
  /* ---------- team select ---------- */
  openTeam() {
    if (Net.role !== 'off' || Game.mode.ffa) { this.hint('Team changes are not available in this mode', 1.5); return; }
    this.teamOpen = true; show(this.el.teamSel, true);
    this.el.teamSel.innerHTML = `<button class="tcard t" data-t="T"><img src="${portrait('T')}" alt=""><b>Terrorists</b><span>Plant the bomb or eliminate the Counter-Terrorists</span></button><button class="tcard auto" data-t="auto"><b>Auto</b><span>Join the team that needs you</span></button><button class="tcard ct" data-t="CT"><img src="${portrait('CT')}" alt=""><b>Counter-Terrorists</b><span>Defend the bomb sites or eliminate the Terrorists</span></button>`;
    for (const b of this.el.teamSel.querySelectorAll('button')) b.addEventListener('click', () => { App.changeTeam(b.dataset.t); this.closeTeam(); });
    App.overlayChanged();
  },
  closeTeam() { if (!this.teamOpen) return; this.teamOpen = false; show(this.el.teamSel, false); App.overlayChanged(); }
};
