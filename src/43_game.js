/* ===================== game rules ===================== */
const MODES = {
  competitive: { id: 'competitive', name: 'Competitive', desc: '5v5 bomb defusal. First to 13 rounds, sides swap at halftime, overtime on 12-12. Friendly fire on.', teamSize: 5, maxRounds: 24, win: 13, half: 12, freeze: 15, buyTime: 20, roundTime: 115, bombTime: 40, bomb: true, sites: ['A', 'B'], ff: true, startMoney: 800, ot: true },
  casual: { id: 'casual', name: 'Casual', desc: 'Relaxed 5v5 bomb defusal. Free armor, no friendly fire, first to 8.', teamSize: 5, maxRounds: 15, win: 8, half: 7, freeze: 6, buyTime: 45, roundTime: 135, bombTime: 40, bomb: true, sites: ['A', 'B'], ff: false, startMoney: 1000, freeArmor: true },
  wingman: { id: 'wingman', name: 'Wingman', desc: '2v2 on bombsite B only. First to 9, short rounds.', teamSize: 2, maxRounds: 16, win: 9, half: 8, freeze: 10, buyTime: 20, roundTime: 90, bombTime: 40, bomb: true, sites: ['B'], ff: true, startMoney: 800, ot: true },
  deathmatch: { id: 'deathmatch', name: 'Deathmatch', desc: 'Free-for-all. Instant respawns, every gun free. Most kills in 8 minutes wins.', teamSize: 5, ffa: true, respawn: true, timeLimit: 480, fragLimit: 50, freeBuy: true, infiniteAmmo: true, bomb: false, sites: [], freeze: 3 },
  armsrace: { id: 'armsrace', name: 'Arms Race', desc: 'Gun game. Every kill upgrades your weapon. First knife kill after the Golden Deagle wins.', teamSize: 5, ffa: true, respawn: true, timeLimit: 900, armsRace: true, infiniteAmmo: true, bomb: false, sites: [], freeze: 3 }
};
const ARMS = ['m4a4', 'ak47', 'aug', 'famas', 'galil', 'p90', 'ump45', 'mp7', 'mac10', 'nova', 'xm1014', 'ssg08', 'awp', 'negev', 'fiveseven', 'tec9', 'p250', 'deagle', 'knife'];
const DIFF_NAMES = { easy: 'Easy', normal: 'Normal', hard: 'Hard', expert: 'Expert' };

const Game = {
  mode: MODES.competitive, cfg: null, players: [], local: null, time: 0, phase: 'idle', phaseEnd: 0, liveStart: 0, roundEnd: 0,
  round: 0, maxRounds: 24, win: 13, halfAt: 12, swapPending: false, score: { CT: 0, T: 0 }, loss: { CT: 1, T: 1 }, history: [],
  bomb: { state: 'none' }, smokes: [], fires: [], noises: [], intel: { CT: [], T: [] }, nid: 1, matchEnd: 0, plantBonusT: false,
  running: false,
  /* ---------- lifecycle ---------- */
  start(cfg) {
    this.stop();
    this.cfg = cfg; this.mode = Object.assign({}, MODES[cfg.mode] || MODES.competitive);
    if (cfg.ff === false && !this.mode.ffa) this.mode.ff = false;
    this.time = 0; this.round = 0; this.score = { CT: 0, T: 0 }; this.loss = { CT: 1, T: 1 }; this.history = [];
    this.maxRounds = this.mode.maxRounds; this.win = this.mode.win; this.halfAt = this.mode.half; this.swapPending = false; this.otNum = 0;
    this.running = true; this.matchEnd = this.mode.timeLimit ? this.mode.timeLimit : 0;
    const size = this.mode.teamSize;
    // humans
    const humans = cfg.humans || [{ id: 1, name: Settings.v.name || 'Player', team: cfg.team, local: true }];
    let nT = 0, nCT = 0;
    for (const h of humans) {
      let team = h.team;
      if (!team || team === 'auto') team = nT < nCT ? 'T' : nCT < nT ? 'CT' : (Math.random() < .5 ? 'T' : 'CT');
      if (team === 'T') nT++; else nCT++;
      const p = this.addPlayer({ id: h.id, name: h.name, team, isLocal: !!h.local, remote: !h.local, peer: h.peer });
      if (h.local) this.local = p;
      if (h.skins) p.skins = h.skins; if (h.knife) p.knifeType = h.knife;
    }
    if (this.local) this.local.knifeType = Loadout.v.knife;
    // bots fill both teams
    const names = shuffle(BOT_NAMES.slice()); let ni = 0;
    const fill = cfg.bots === false ? 0 : 1;
    if (fill) {
      for (let k = nT; k < size; k++) this.addBot('T', names[ni++ % names.length]);
      for (let k = nCT; k < size; k++) this.addBot('CT', names[ni++ % names.length]);
    }
    this.newRound(true);
  },
  stop() {
    for (const p of this.players) if (p.model) App.scene.remove(p.model.root);
    this.players = []; this.local = null; this.running = false; this.phase = 'idle';
    Items.clear(); Grenades.clear(); FX.clear(); this.clearBombMesh(); this.stopFireSounds();
    this.smokes = []; this.fires = []; this.noises = []; this.intel = { CT: [], T: [] };
  },
  addPlayer(o) {
    const p = new Player(o);
    p.model = Models.character(p.team); App.scene.add(p.model.root);
    p.model.root.visible = false;
    this.players.push(p);
    return p;
  },
  addBot(team, name) {
    const p = this.addPlayer({ name, team, isBot: true });
    p.bot = new Bot(p, this.cfg.diff || 'hard');
    const sk = SKINS.filter(s => s.r >= 1);
    p.skins = {}; for (const id in W) if (Math.random() < .5) p.skins[id] = pick(sk).id;
    p.skins.knife = Math.random() < .6 ? pick(sk).id : 'default'; p.knifeType = pick(KNIVES).id;
    return p;
  },
  rebuildModel(p) {
    if (p.model) App.scene.remove(p.model.root);
    p.model = Models.character(p.team); App.scene.add(p.model.root); p.model.root.visible = false;
  },
  teamOf(t) { return this.players.filter(p => p.team === t); },
  alive(t) { return this.players.filter(p => p.alive && (!t || p.team === t)); },
  viewPlayer() { const l = this.local; if (!l) return null; if (l.alive) return l; return App.specTarget || l; },
  frozen(p) { return this.phase === 'freeze' || this.phase === 'matchover' || this.phase === 'halftime'; },
  roundLeft() { return this.phase === 'live' ? Math.max(0, this.roundEnd - this.time) : 0; },
  isPistolRound() { return this.round === 1 || this.round === this.mode.half + 1; },

  /* ---------- rounds ---------- */
  newRound(first) {
    const M = this.mode;
    if (this.swapPending) this.swapSides();
    this.round++;
    Items.clear(); Grenades.clear(); FX.clear(); this.clearBombMesh(); this.stopFireSounds();
    this.smokes = []; this.fires = []; this.noises = []; this.intel = { CT: [], T: [] };
    this.bomb = { state: 'none', carrier: null, pos: null, site: null };
    this.plantBonusT = false;
    const firstOfHalf = first || this.round === M.half + 1 || this.otRoundStart === this.round || this.otHalfRound === this.round;
    if (firstOfHalf) for (const p of this.players) { p.money = this.otNum ? 12500 : (M.startMoney || 800); p.alive = false; }
    for (const p of this.players) {
      const survived = p.alive && !firstOfHalf;
      if (!survived) { p.clearInventory(); p.secondary = new WeaponInst(p.team === 'T' ? 'glock' : 'usp', p.skinFor(p.team === 'T' ? 'glock' : 'usp')); if (!M.freeArmor) { p.armor = 0; p.helmet = false; } p.defuser = false; }
      if (M.freeArmor) { p.armor = 100; p.helmet = true; }
      p.hp = 100; p.roundKills = 0; p.dmgFrom = {}; p.planting = false; p.defusing = false; p.flashEnd = 0; p.fireAcc = 0;
      p.c4 = null;
      if (M.ffa) { p.clearInventory(); this.ffaLoadout(p); }
    }
    this.spawnAll();
    if (M.bomb) {
      const Ts = this.players.filter(p => p.team === 'T');
      if (Ts.length) { const c = pick(Ts); c.c4 = new WeaponInst('c4'); this.bomb.state = 'carried'; this.bomb.carrier = c; }
    }
    for (const p of this.players) { p.active = null; p.equip(p.best(), true); p.drawEnd = 0; }
    this.phase = 'freeze'; this.phaseEnd = this.time + M.freeze;
    for (const p of this.players) if (p.bot) p.bot.reset();
    BotAI.newRound();
    for (const p of this.players) if (p.bot && !M.ffa) this.botBuy(p);
    App.onRoundStart();
    HUD.roundStart();
    Net.roundStart();
  },
  spawnAll() {
    const M = this.mode;
    if (M.ffa) { for (const p of this.players) this.respawnFFA(p, true); return; }
    for (const team of ['T', 'CT']) {
      let pts = MAPDEF.spawns[team].slice();
      if (M.id === 'wingman') pts = team === 'T' ? [[-16, 52], [-18, 50], [-14, 50], [-16, 54]] : [[-16, -44], [-18, -47], [-14, -47], [-18, -42]];
      shuffle(pts);
      this.teamOf(team).forEach((p, i) => {
        const [x, z] = pts[i % pts.length];
        const jitter = i >= pts.length ? (i / pts.length) * .9 : 0;
        this.placePlayer(p, x + jitter, z, M.id === 'wingman' ? Math.PI / 2 : MAPDEF.spawnYaw[team]);
      });
    }
  },
  placePlayer(p, x, z, yaw, y) {
    p.pos.set(x, (y == null ? World.floorAt(x, z) : y) + .01, z); p.vel.set(0, 0, 0); p.yaw = yaw; p.pitch = 0;
    p.onGround = true; p.ducked = false; p.eyeOff = PHYS.eyeStand; p.alive = true; p.deathT = 0;
    if (p.model) { p.model.dead = 0; p.model.root.rotation.set(0, yaw, 0); }
    if (p.remote) Net.teleport(p);
  },
  ffaLoadout(p) {
    const M = this.mode;
    p.armor = 100; p.helmet = true;
    if (M.armsRace) {
      const id = ARMS[Math.min(p.armsLevel, ARMS.length - 1)];
      p.clearInventory();
      if (id !== 'knife') { const w = new WeaponInst(id, p.skinFor(id)); p.addWeapon(w); }
    } else {
      const pri = pick(['ak47', 'm4a4', 'm4a1s', 'awp', 'galil', 'famas', 'mp7', 'p90', 'ump45', 'sg553', 'aug', 'xm1014', 'ssg08']);
      const sec = pick(['deagle', 'usp', 'glock', 'p250', 'fiveseven', 'tec9']);
      p.addWeapon(new WeaponInst(p.isLocal && this.lastLocalPrimary ? this.lastLocalPrimary : pri, p.skinFor(pri)));
      p.addWeapon(new WeaponInst(p.isLocal && this.lastLocalSecondary ? this.lastLocalSecondary : sec, p.skinFor(sec)));
    }
  },
  respawnFFA(p, first) {
    const N = World.nav; let best = null, bd = -1;
    for (let k = 0; k < 30; k++) {
      const m = World.randomNode(i => N.ny[i] < 2.2 && !N.nearWall[i]);
      let md = 1e9; for (const q of this.players) if (q !== p && q.alive) md = Math.min(md, Math.hypot(q.pos.x - N.nx[m], q.pos.z - N.nz[m]));
      if (md > bd) { bd = md; best = m; }
      if (md > 25) break;
    }
    p.hp = 100; p.dmgFrom = {}; p.flashedBy = null; if (!first) { p.clearInventory(); this.ffaLoadout(p); }
    this.placePlayer(p, N.nx[best], N.nz[best], Math.random() * TAU, N.ny[best]);
    p.active = null; p.equip(p.best(), true); p.drawEnd = this.time + .3;
    p.immuneUntil = this.time + 2; p.respawnAt = 0; p.flashEnd = 0;
    if (p.bot) p.bot.reset();
    if (p === this.local) App.onRespawn();
  },
  swapSides() {
    this.swapPending = false;
    const s = this.score.CT; this.score.CT = this.score.T; this.score.T = s;
    this.loss = { CT: 1, T: 1 };
    for (const p of this.players) { p.team = p.team === 'T' ? 'CT' : 'T'; p.alive = false; p.armor = 0; p.helmet = false; p.defuser = false; this.rebuildModel(p); }
    HUD.center('Switching sides', 'Halftime', 4);
    this.history.push({ half: true });
  },
  endRound(winner, reason) {
    if (this.phase !== 'live') return;
    const M = this.mode, loser = winner === 'T' ? 'CT' : 'T';
    this.phase = 'over'; this.phaseEnd = this.time + 6;
    this.score[winner]++;
    this.history.push({ w: winner, r: reason });
    // economy
    const winReward = reason === 'bomb' ? 3500 : reason === 'defuse' ? 3500 : 3250;
    const lossBonus = 1400 + 500 * (Math.min(this.loss[loser], 5) - 1);
    for (const p of this.players) {
      if (p.team === winner) p.money += winReward;
      else {
        let bonus = lossBonus;
        if (reason === 'time' && p.team === 'T' && p.alive) bonus = 0;   // saving Ts forfeit the loss bonus
        if (p.team === 'T' && this.plantBonusT) bonus += 800;
        p.money += bonus;
      }
      p.money = Math.min(16000, p.money);
      p.roundsPlayed++;
    }
    this.loss[loser] = Math.min(5, this.loss[loser] + 1); this.loss[winner] = Math.max(1, this.loss[winner] - 1);
    // MVP
    let mvp = null;
    if (reason === 'bomb' && this.bomb.planter) mvp = this.bomb.planter;
    else if (reason === 'defuse' && this.bomb.defuserP) mvp = this.bomb.defuserP;
    else { let bk = 0; for (const p of this.players) if (p.team === winner && p.roundKills > bk) { bk = p.roundKills; mvp = p; } }
    if (mvp && mvp.team === winner) mvp.mvps++; else mvp = null;
    const msg = { elim: winner === 'T' ? 'All Counter-Terrorists eliminated' : 'All Terrorists eliminated', bomb: 'Target bombed', defuse: 'The bomb has been defused', time: 'Target saved' }[reason];
    HUD.roundEnd(winner, msg, mvp);
    SFX.say(winner === 'T' ? 'Terrorists win' : 'Counter-Terrorists win');
    SFX.ui(this.local && this.local.team === winner ? 'win' : 'lose', .7);
    if (mvp) setTimeout(() => SFX.ui('mvp', .5), 900);
    Net.event({ t: 'rend', w: winner, m: msg, mvp: mvp ? mvp.id : 0 });
    // match state
    const played = this.round;
    if (this.score.CT >= this.win || this.score.T >= this.win) { this.phaseEnd = this.time + 5; this.pendingEnd = true; }
    else if (played >= this.maxRounds) {
      if (M.ot && this.score.CT === this.score.T) {
        this.otNum++; this.maxRounds += 6; this.win = this.score.CT + 4; this.otRoundStart = played + 1; this.otHalfRound = played + 4; this.halfAt = played + 3;
        HUD.center('Overtime', 'First to ' + this.win, 4);
      } else { this.phaseEnd = this.time + 5; this.pendingEnd = true; }
    } else if (played === this.halfAt) { this.swapPending = true; if (this.otNum) this.halfAt = null; }
  },
  endMatch(reason) {
    this.phase = 'matchover'; this.phaseEnd = this.time + 9999;
    let winner = this.score.CT > this.score.T ? 'CT' : this.score.T > this.score.CT ? 'T' : null;
    if (this.mode.ffa) { const top = this.players.slice().sort((a, b) => b.kills - a.kills)[0]; winner = top; }
    App.matchOver(winner, reason);
    Net.event({ t: 'mend', w: this.mode.ffa ? (winner ? winner.id : 0) : winner });
  },

  /* ---------- per-step ---------- */
  step(dt) {
    if (!this.running) return;
    this.time += dt;
    const client = Net.role === 'client';
    for (const p of this.players) {
      if (client && !p.isLocal) continue;
      if (p.remote) {
        if (!client && p.alive) { this.useInput(p, p.cmd.use); if (p.cmd.useHit) this.tryPickup(p); if (p.cmd.dropHit) this.dropActive(p); if (p.active && p.active.def.cat === 'c4') this.plantInput(p, p.cmd.fire); }
        p.cmd.useHit = p.cmd.dropHit = false; continue;
      }
      if (!p.alive) { if (this.mode.respawn && p.respawnAt && this.time >= p.respawnAt && this.phase === 'live') this.respawnFFA(p); continue; }
      if (p.bot) p.bot.update(dt);
      const c = p.cmd;
      if (c.jumpHit) p.jumpBuf = .12;
      p.simulate(dt, c);
      p.updateWeapon(dt, c);
      if (!client) { this.useInput(p, c.use); if (c.useHit) this.tryPickup(p); if (c.dropHit) this.dropActive(p); }
      else if (c.useHit || c.dropHit) Net.send({ t: c.dropHit ? 'drop' : 'use' });
      c.jumpHit = c.fireHit = c.fire2Hit = c.useHit = c.dropHit = c.reload = c.inspect = false;
    }
    if (!client) this.separate();
    Grenades.update(dt); Items.update(dt);
    if (client) return;
    this.autoPickups();
    this.updateHazards(dt);
    this.updateBomb(dt);
    this.updatePhase();
    BotAI.update();
    if (this.noises.length && this.time - this.noises[0].t > 1.2) this.noises = this.noises.filter(n => this.time - n.t < 1.2);
    for (const t of ['CT', 'T']) if (this.intel[t].length > 30) this.intel[t] = this.intel[t].slice(-20);
  },
  updatePhase() {
    const M = this.mode, now = this.time;
    if (this.phase === 'freeze' && now >= this.phaseEnd) {
      this.phase = 'live'; this.liveStart = now; this.roundEnd = now + (M.roundTime || 99999);
      HUD.roundLive(); Net.event({ t: 'live' });
    }
    if (this.phase === 'live') {
      if (M.ffa) {
        if (this.matchEnd && now >= this.matchEnd) this.endMatch('time');
        if (M.fragLimit && this.players.some(p => p.kills >= M.fragLimit)) this.endMatch('frags');
        return;
      }
      const aT = this.alive('T').length, aCT = this.alive('CT').length, hasT = this.teamOf('T').length, hasCT = this.teamOf('CT').length;
      if (this.bomb.state === 'planted') { if (aCT === 0 && hasCT) this.endRound('T', 'elim'); }
      else {
        if (aT === 0 && hasT) this.endRound('CT', 'elim');
        else if (aCT === 0 && hasCT) this.endRound('T', 'elim');
        else if (now >= this.roundEnd) this.endRound('CT', 'time');
      }
    } else if (this.phase === 'over' && now >= this.phaseEnd) {
      if (this.pendingEnd) { this.pendingEnd = false; this.endMatch('score'); }
      else this.newRound(false);
    }
  },
  separate() {
    const L = this.players;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (!a.alive) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz, R = PHYS.r * 2;
        if (d2 >= R * R || Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
        const d = Math.sqrt(d2) || .01, push = (R - d) * .5, nx = d > .01 ? dx / d : 1, nz = d > .01 ? dz / d : 0;
        if (!a.remote && (Net.role !== 'client' || a.isLocal)) a.moveH(-nx * push, -nz * push);
        if (!b.remote && (Net.role !== 'client' || b.isLocal)) b.moveH(nx * push, nz * push);
      }
    }
  },

  /* ---------- damage & death ---------- */
  damage(v, amount, att, wid, info) {
    if (!v.alive || Net.role === 'client' || this.phase === 'matchover') return;
    if (this.time < v.immuneUntil) return;
    info = info || {};
    const type = info.type || 'world';
    if (att && att !== v && !att.isEnemy(v)) {
      if (!this.mode.ff) return;
      amount *= type === 'bullet' || type === 'knife' ? .33 : .5;
    }
    let dmg = amount;
    if (type === 'bullet') dmg *= info.hg === 'head' ? 4 : info.hg === 'stomach' ? 1.25 : info.hg === 'legs' ? .75 : 1;
    let armored = false;
    if (v.armor > 0 && type !== 'fire' && type !== 'fall' && type !== 'world') armored = info.hg === 'head' ? v.helmet : info.hg !== 'legs';
    let hpD = dmg;
    if (armored) {
      const ap = info.ap == null ? .5 : info.ap;
      hpD = dmg * ap; let arD = (dmg - hpD) * .5;
      if (arD > v.armor) { hpD = dmg - v.armor * 2; v.armor = 0; } else v.armor = Math.max(0, v.armor - arD);
      v.armor = Math.round(v.armor); if (v.armor <= 0) { v.armor = 0; }
    }
    hpD = Math.max(1, Math.floor(hpD));
    const before = v.hp;
    v.hp -= hpD; v.lastDamageT = this.time;
    const real = Math.min(before, hpD);
    if (att && att !== v) { v.dmgFrom[att.id] = (v.dmgFrom[att.id] || 0) + real; if (att.isEnemy(v)) att.dmgDealt += real; }
    // feedback
    if (type === 'bullet' || type === 'knife') {
      v.tagUntil = this.time + .35;
      v.flinchY += (info.hg === 'head' ? 3.5 : 1.6) * DEG; v.flinchX += (Math.random() - .5) * 1.5 * DEG;
      const hp = info.p || v.eye();
      const snd = info.hg === 'head' ? (armored ? 'hit_helmet' : 'hit_head') : armored ? 'hit_armor' : 'hit_body';
      SFX.play(snd, { pos: hp, vol: info.hg === 'head' ? 1 : .8, ref: info.hg === 'head' ? 6 : 3 });
    }
    if (v.isLocal) HUD.hurt(att ? att.pos : null, hpD);
    if (v.remote) Net.sendTo(v, { t: 'hurt', f: att ? [att.pos.x, att.pos.z] : null, d: hpD, fy: +(v.flinchY).toFixed(3) });
    if (v.bot && att && att !== v && att.isEnemy(v)) { v.bot.heard = att.pos.clone(); v.bot.heardT = this.time; }
    if (v.hp <= 0) { v.hp = 0; this.kill(v, att, wid, info); }
  },
  kill(v, att, wid, info) {
    const M = this.mode;
    v.alive = false; v.deaths++; v.deathT = this.time; v.planting = false;
    if (v.defusing) this.stopDefuse(v);
    if (v.model) v.model.deathSide = Math.random() < .5 ? 1 : -1;
    // drops
    const drop = v.primary || v.secondary;
    if (drop && !M.ffa) this.dropWeapon(v, drop, true);
    if (v.c4) this.dropWeapon(v, v.c4, true);
    if (v.nades.length && !M.ffa) { const n = v.nades.slice().sort((a, b) => NADE_ORDER.indexOf(a.id) - NADE_ORDER.indexOf(b.id))[0]; this.dropWeapon(v, n, true); }
    let assister = null;
    const enemyKill = att && att !== v && att.isEnemy(v);
    if (enemyKill) {
      att.kills++; att.roundKills++; att.score += 2;
      if (info.hg === 'head') att.hsKills++;
      const reward = M.ffa ? 0 : (W[wid] ? W[wid].reward : 300) * (this.mode.id === 'casual' ? .5 : 1);
      att.money = Math.min(16000, att.money + reward);
      if (M.armsRace && (att.active && ARMS[att.armsLevel] === att.active.id || wid === ARMS[att.armsLevel])) this.armsUp(att, wid);
    } else if (att && att !== v) { att.kills--; att.score -= 2; if (!M.ffa) att.money = Math.max(0, att.money - 300); }
    else { v.score -= 1; }
    // assists: 41+ damage, or a flash on the victim in the last 2 seconds (no assists in free-for-all)
    if (!M.ffa) for (const id in v.dmgFrom) {
      const q = this.players.find(p => p.id == id);
      if (q && q !== att && v.dmgFrom[id] >= 41 && q.isEnemy(v)) { q.assists++; q.score += 1; assister = q; break; }
    }
    if (!assister && !M.ffa && v.flashedBy && v.flashedBy !== att && this.time - v.flashedByT < 2.5 && v.flashedBy.isEnemy(v)) { assister = v.flashedBy; assister.assists++; assister.score += 1; }
    const ev = { a: att ? att.id : 0, v: v.id, w: wid, hs: info.hg === 'head' ? 1 : 0, pen: info.pen ? 1 : 0, sm: info.smoke ? 1 : 0, ns: info.noscope ? 1 : 0, bl: info.blind ? 1 : 0, as: assister ? assister.id : 0 };
    HUD.killfeed(ev);
    Net.event({ t: 'kill', e: ev });
    if (v === this.local) App.onLocalDeath(att);
    if (v.bot) v.bot.target = null;
    if (M.respawn) v.respawnAt = this.time + 2;
  },
  armsUp(p, wid) {
    if (wid === 'knife' && ARMS[p.armsLevel] === 'knife') { p.armsLevel = ARMS.length; this.endMatch('arms'); return; }
    p.armsLevel = Math.min(ARMS.length - 1, p.armsLevel + 1);
    const id = ARMS[p.armsLevel];
    if (p.primary) p.removeWeapon(p.primary); if (p.secondary) p.removeWeapon(p.secondary);
    if (id !== 'knife') { const w = new WeaponInst(id, p.skinFor(id)); p.addWeapon(w); p.equip(w, true); } else p.equip(p.knife, true);
    if (p.isLocal) HUD.center('Level ' + (p.armsLevel + 1) + ' / ' + ARMS.length, W[id].name, 1.6);
  },

  /* ---------- items ---------- */
  dropWeapon(p, inst, death) {
    if (!inst || inst.def.cat === 'knife') return;
    p.removeWeapon(inst);
    const e = p.eye(), dir = p.aimDir();
    const pos = death ? new V3(p.pos.x, p.pos.y + 1, p.pos.z) : e.clone().addScaledVector(dir, .4);
    const vel = death ? new V3((Math.random() - .5) * 2, 1.5, (Math.random() - .5) * 2) : dir.clone().multiplyScalar(4).add(new V3(0, 1.5, 0)).addScaledVector(p.vel, 1);
    const it = Items.drop(inst, pos, vel, p.yaw + Math.PI / 2);
    it.by = p;
    if (inst.id === 'c4') { this.bomb.state = 'dropped'; this.bomb.carrier = null; this.bomb.item = it; this.bomb.pos = it.pos; if (!death) BotAI.radio(p, 'Dropped the bomb'); }
    if (p.isLocal) SFX.play('draw', { vol: .4 });
    return it;
  },
  dropActive(p) {
    const w = p.active; if (!w || !p.alive || w.def.cat === 'knife') return;
    if (w.def.cat === 'grenade' && p.nadeState !== 'idle') return;
    this.dropWeapon(p, w, false);
  },
  canTake(p, inst) {
    const d = inst.def;
    if (d.id === 'c4') return p.team === 'T' && !p.c4 && !this.mode.ffa;
    if (d.slot === 1) return !p.primary; if (d.slot === 2) return !p.secondary;
    if (d.id === 'zeus') return !p.zeus;
    if (d.slot === 4) return p.nades.length < MAX_NADES && p.nadeCount(d.id) < d.max;
    return false;
  },
  take(p, it) {
    const inst = it.inst; Items.remove(it);
    p.addWeapon(inst);
    if (inst.id === 'c4') { this.bomb.state = 'carried'; this.bomb.carrier = p; this.bomb.item = null; this.bomb.pos = null; if (p.isLocal) HUD.center('', 'You picked up the bomb', 2); }
    if (p.isLocal) SFX.play('pickup', { vol: .6 });
    if (!p.active || p.active.def.cat === 'knife' && inst.def.slot <= 2) p.equip(inst);
  },
  autoPickups() {
    if (!Items.list.length) return;
    for (const p of this.players) {
      if (!p.alive) continue;
      for (const it of Items.list.slice()) {
        if (!it.rest && it.t < .4) continue;
        if (it.by === p && it.t < 1.5) continue;
        const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z, dy = it.pos.y - p.pos.y;
        if (dx * dx + dz * dz > 1.1 || dy < -.5 || dy > 1.6) continue;
        if (this.canTake(p, it.inst)) this.take(p, it);
      }
    }
  },
  tryPickup(p) {
    if (!p.alive) return;
    const e = p.eye(), d = p.aimDir(); let best = null, bs = .3;
    for (const it of Items.list) {
      const tx = it.pos.x - e.x, ty = it.pos.y - e.y, tz = it.pos.z - e.z, L = Math.hypot(tx, ty, tz);
      if (L > 2.3) continue;
      const s = 1 - (tx * d.x + ty * d.y + tz * d.z) / L;
      if (s < bs && World.los(e, it.pos)) { bs = s; best = it; }
    }
    if (!best) return;
    const inst = best.inst;
    if (inst.id === 'c4' && p.team !== 'T') return;
    if (!this.canTake(p, inst)) {
      const old = inst.def.slot === 1 ? p.primary : inst.def.slot === 2 ? p.secondary : null;
      if (!old) return;
      this.dropWeapon(p, old, false);
    }
    this.take(p, best); p.equip(inst);
  },

  /* ---------- buying ---------- */
  canBuy(p) {
    if (!p.alive) return false;
    if (this.mode.freeBuy) return true;
    if (this.mode.armsRace) return false;
    const inTime = this.phase === 'freeze' || (this.phase === 'live' && this.time - this.liveStart < this.mode.buyTime);
    return inTime && World.inBuy(p.team, p.pos.x, p.pos.z);
  },
  buy(p, id) {
    if (!this.canBuy(p)) return 'You can’t buy right now';
    const M = this.mode, free = !!M.freeBuy;
    let price = free ? 0 : itemPrice(id);
    const w = W[id];
    if (w) {
      if (w.team && w.team !== p.team && !M.ffa) return 'Not available for your team';
      if (w.slot === 1 && p.primary && p.primary.id === id) return 'You already have this weapon';
      if (w.slot === 2 && p.secondary && p.secondary.id === id) return 'You already have this weapon';
      if (id === 'zeus' && p.zeus) return 'You already have a Zeus';
      if (w.slot === 4) { if (p.nadeCount(id) >= w.max) return 'You can’t carry any more of these'; if (p.nades.length >= MAX_NADES) return 'You can’t carry any more grenades'; }
      if (p.money < price) return 'Not enough money';
      p.money -= price;
      if (w.slot === 1 && p.primary) this.dropWeapon(p, p.primary, false);
      if (w.slot === 2 && p.secondary) this.dropWeapon(p, p.secondary, false);
      const inst = new WeaponInst(id, p.skinFor(id));
      p.addWeapon(inst);
      if (w.slot <= 2 || !p.active || (p.active.def.cat === 'knife')) p.equip(inst);
      if (p.isLocal && M.ffa) { if (w.slot === 1) this.lastLocalPrimary = id; if (w.slot === 2) this.lastLocalSecondary = id; }
    } else {
      if (id === 'vest') { if (p.armor >= 100) return 'You already have kevlar'; if (p.money < price) return 'Not enough money'; p.money -= price; p.armor = 100; }
      else if (id === 'vesthelm') {
        if (p.armor >= 100 && p.helmet) return 'You already have kevlar and a helmet';
        if (p.armor >= 100 && !free) price = 350;
        if (p.money < price) return 'Not enough money'; p.money -= price; p.armor = 100; p.helmet = true;
      } else if (id === 'defuser') {
        if (p.team !== 'CT') return 'Not available for your team'; if (p.defuser) return 'You already have a defuse kit';
        if (p.money < price) return 'Not enough money'; p.money -= price; p.defuser = true;
      } else return 'Unknown item';
    }
    if (p.isLocal) SFX.ui('buy', .6);
    return null;
  },
  botBuy(p) {
    const M = this.mode, team = p.team, rifle = team === 'T' ? 'ak47' : pick(['m4a4', 'm4a1s', 'm4a4']);
    const teamMoney = this.teamOf(team).reduce((s, q) => s + q.money, 0) / Math.max(1, this.teamOf(team).length);
    const lastOfHalf = this.round === M.half || this.round === this.maxRounds || this.score.CT === this.win - 1 || this.score.T === this.win - 1;
    const b = id => this.buy(p, id) === null;
    const nadeSet = team === 'T' ? ['smoke', 'flash', 'molotov', 'he', 'flash'] : ['smoke', 'flash', 'incgrenade', 'he', 'flash'];
    if (this.isPistolRound()) {
      const r = Math.random();
      if (r < .5) b('vest'); else if (r < .8) { b('p250'); b('flash'); b('smoke'); } else { b(team === 'T' ? 'tec9' : 'fiveseven'); }
      if (team === 'CT' && p.money >= 400 && Math.random() < .5) b('defuser');
      return;
    }
    const sniper = p.bot && (p.id % 5 === 0) && p.money >= 4750 + 1000 + 400;
    const full = (sniper ? 4750 : W[rifle].price) + 1000;
    if (p.money >= full) {
      b(sniper ? 'awp' : rifle); b('vesthelm');
      for (const n of nadeSet) if (p.money >= itemPrice(n) + 200) b(n);
      if (team === 'CT' && p.money >= 400) b('defuser');
      if (p.money >= 700 && Math.random() < .3) b('deagle');
    } else if (teamMoney >= 3000 || lastOfHalf || p.money >= 3600) {
      const f = team === 'T' ? (p.money >= 2800 ? 'galil' : 'mac10') : (p.money >= 3050 ? 'famas' : 'mp9');
      b(f); if (p.money >= 1000) b('vesthelm'); else b('vest');
      if (p.money >= 300) b('flash'); if (p.money >= 300) b('smoke');
    } else {
      // eco: maybe a cheap pistol upgrade
      if (p.money >= 2200 && Math.random() < .4) { b('deagle'); b('vest'); } else if (p.money >= 1400 && Math.random() < .3) b('p250');
    }
  },

  /* ---------- bomb ---------- */
  canPlantHere(p) {
    return this.mode.bomb && this.phase === 'live' && p.alive && p.c4 && p.onGround && this.bomb.state === 'carried' && this.inActiveSite(p.pos) && Math.hypot(p.vel.x, p.vel.z) < 1.4;
  },
  inActiveSite(pos) { const s = World.inSite(pos.x, pos.z); return s && this.mode.sites.includes(s) ? s : null; },
  plantInput(p, holding) {
    if (Net.role === 'client') return;
    if (!holding) { if (p.planting) { p.planting = false; this.onPlantCancel(p); } return; }
    if (!p.planting) {
      if (!this.canPlantHere(p)) { if (p.isLocal && holding && p.active === p.c4 && !this.inActiveSite(p.pos) && this.phase === 'live') HUD.hint('You must be in a bomb site to plant the bomb', 1.2); return; }
      p.planting = true; p.plantStart = this.time; p.plantBeep = 0;
      if (p.isBot) BotAI.radio(p, 'Planting the bomb');
      Net.event({ t: 'plantst', id: p.id });
      return;
    }
    if (!this.canPlantHere(p) && !(p.c4 && p.onGround && this.inActiveSite(p.pos))) { p.planting = false; this.onPlantCancel(p); return; }
    const el = this.time - p.plantStart;
    if (el > p.plantBeep * .45 + .1 && p.plantBeep < 7) { p.plantBeep++; SFX.play('key', { pos: p.pos, vol: .5, ref: 3 }); }
    if (el >= 3.2) this.plantBomb(p);
  },
  onPlantCancel() { },
  plantBomb(p) {
    const B = this.bomb, site = this.inActiveSite(p.pos);
    p.planting = false; p.removeWeapon(p.c4); p.c4 = null;
    B.state = 'planted'; B.site = site; B.pos = new V3(p.pos.x, p.pos.y + .02, p.pos.z); B.plantedAt = this.time; B.explodeAt = this.time + this.mode.bombTime;
    B.planter = p; B.nextBeep = this.time; B.defuser = null;
    p.money = Math.min(16000, p.money + 300); p.score += 2; this.plantBonusT = true;
    this.roundEnd = Math.max(this.roundEnd, B.explodeAt);
    this.makeBombMesh(B.pos);
    SFX.say('Bomb has been planted'); SFX.play('beep', { pos: B.pos, ref: 6 });
    HUD.center('', 'The bomb has been planted', 3);
    this.intelPush('CT', B.pos, this.time);
    Net.event({ t: 'planted', p: [B.pos.x, B.pos.y, B.pos.z], s: site, e: this.mode.bombTime, by: p.id });
  },
  makeBombMesh(pos) {
    this.clearBombMesh();
    const g = Models.gun('c4', 'default', 'T'); g.position.copy(pos); g.rotation.y = Math.random() * TAU;
    const led = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    led.position.set(.03, .05, -.05); g.add(led); g.userData.led = led;
    App.scene.add(g); this.bombMesh = g;
  },
  clearBombMesh() { if (this.bombMesh) { App.scene.remove(this.bombMesh); this.bombMesh = null; } },
  useInput(p, holding) {
    const B = this.bomb;
    if (!holding) { if (p.defusing) this.stopDefuse(p); return; }
    if (B.state !== 'planted' || p.team !== 'CT' || !p.alive || this.phase !== 'live') return;
    const e = p.eye(), d = e.distanceTo(B.pos);
    let facing = true;
    if (!p.isBot) { const dir = p.aimDir(), tx = B.pos.x - e.x, ty = B.pos.y - e.y, tz = B.pos.z - e.z, L = Math.hypot(tx, ty, tz) || 1; facing = (dir.x * tx + dir.y * ty + dir.z * tz) / L > .55; }
    if (!p.defusing) {
      if (d > 2.0 || !facing || !p.onGround || (B.defuser && B.defuser !== p)) return;
      p.defusing = true; p.defuseStart = this.time; B.defuser = p; B.defuseLen = p.defuser ? 5 : 10;
      SFX.play('defuse', { pos: B.pos, ref: 4 });
      if (p.isBot) BotAI.radio(p, 'Defusing the bomb');
      if (p.isLocal) HUD.hint(p.defuser ? 'Defusing with kit…' : 'Defusing…', 1);
      Net.event({ t: 'defst', id: p.id, l: B.defuseLen });
      return;
    }
    if (d > 2.4 || !p.onGround) { this.stopDefuse(p); return; }
    if (this.time - p.defuseStart >= B.defuseLen) {
      p.defusing = false; B.state = 'defused'; B.defuserP = p; p.money = Math.min(16000, p.money + 300); p.score += 2;
      SFX.play('defuse', { pos: B.pos, ref: 4 }); SFX.say('Bomb has been defused');
      if (this.bombMesh && this.bombMesh.userData.led) this.bombMesh.userData.led.visible = false;
      Net.event({ t: 'defused' });
      this.endRound('CT', 'defuse');
    }
  },
  stopDefuse(p) { p.defusing = false; if (this.bomb.defuser === p) this.bomb.defuser = null; Net.event({ t: 'defst', id: 0 }); },
  updateBomb(dt) {
    const B = this.bomb;
    if (B.state === 'dropped' && B.item) B.pos = B.item.pos;
    if (B.state !== 'planted') return;
    const now = this.time, left = B.explodeAt - now;
    if (now >= B.nextBeep && left > 0) {
      const iv = clamp(Math.pow(left / this.mode.bombTime, 1.4), .08, 1) * 1.05;
      B.nextBeep = now + iv;
      SFX.play('beep', { pos: B.pos, vol: .9, ref: 5, roll: .9, norand: true });
      if (this.bombMesh) { const led = this.bombMesh.userData.led; led.material.color.setHex(0xff4040); led.scale.setScalar(2); setTimeout(() => { if (led) { led.scale.setScalar(1); led.material.color.setHex(0x661010); } }, 90); }
    }
    if (left <= 0 && this.phase === 'live') this.explodeBomb();
  },
  explodeBomb() {
    const B = this.bomb; B.state = 'exploded';
    this.fxExplosion(B.pos, 'c4');
    this.clearBombMesh();
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = p.pos.distanceTo(B.pos), s = 44 / 3;
      const dmg = 500 * Math.exp(-(d * d) / (2 * s * s));
      if (dmg >= 1) this.damage(p, dmg, null, 'c4', { type: 'bomb', ap: .5, hg: 'chest' });
    }
    this.endRound('T', 'bomb');
  },

  /* ---------- grenades & hazards ---------- */
  detonate(type, pos, owner, wid) {
    if (type === 'he') {
      this.fxExplosion(pos, 'he');
      for (const p of this.players) {
        if (!p.alive) continue;
        const c = new V3(p.pos.x, p.pos.y + 1, p.pos.z), d = c.distanceTo(pos);
        if (d > 9.5) continue;
        if (!World.los(new V3(pos.x, pos.y + .3, pos.z), c)) continue;
        const dmg = 98 * Math.pow(1 - d / 9.5, 1.15);
        if (dmg >= 1) this.damage(p, dmg, owner, 'he', { type: 'he', ap: .5, hg: 'chest', dir: c.clone().sub(pos).normalize() });
      }
      this.noise({ pos, team: owner ? owner.team : null, src: owner }, 'nade');
    } else if (type === 'flash') {
      this.fxFlash(pos);
      for (const p of this.players) {
        if (!p.alive) continue;
        const e = p.eye(), d = e.distanceTo(pos);
        if (d > 40 || !World.los(pos, e)) continue;
        const dir = p.aimDir(), tx = (pos.x - e.x) / d, ty = (pos.y - e.y) / d, tz = (pos.z - e.z) / d, dot = dir.x * tx + dir.y * ty + dir.z * tz;
        const angF = dot > .7 ? 1 : dot > .3 ? .8 : dot > -.2 ? .5 : .22;
        const distF = d < 6 ? 1 : clamp(1 - (d - 6) / 34, 0, 1);
        const dur = 4.9 * angF * distF;
        if (dur < .25) continue;
        this.applyFlash(p, dur, owner);
      }
    } else if (type === 'smoke') this.addSmoke(pos, owner);
    else if (type === 'fire') {
      const g = World.groundBelow(pos.x, pos.y + .2, pos.z);
      if (pos.y - g > 3) return;
      this.addFire(new V3(pos.x, g, pos.z), owner, wid);
    } else if (type === 'decoy') { this.fxSmallBoom(pos); }
  },
  applyFlash(p, dur, owner) {
    const now = this.time;
    if (now < p.flashEnd && p.flashEnd - now > dur) return;
    p.flashStart = now; p.flashDur = dur; p.flashEnd = now + dur;
    if (owner && owner !== p) { p.flashedBy = owner; p.flashedByT = now; }
    if (p.isLocal) HUD.flash(dur);
    if (p.remote) Net.sendTo(p, { t: 'flash', d: +dur.toFixed(2) });
  },
  fxExplosion(pos, kind) {
    FX.explosion(pos, kind); SFX.play(kind === 'c4' ? 'c4boom' : 'he', { pos, vol: 1.3, ref: kind === 'c4' ? 20 : 10, roll: .6 });
    const lp = this.viewPlayer(); if (lp) { const d = lp.pos.distanceTo(pos); FX.shake = Math.max(FX.shake, clamp(1 - d / (kind === 'c4' ? 60 : 20), 0, 1) * (kind === 'c4' ? 1.4 : .8)); }
    Net.event({ t: 'boom', k: kind, p: [pos.x, pos.y, pos.z] });
  },
  fxFlash(pos) {
    FX.pFlash.spawn({ x: pos.x, y: pos.y, z: pos.z, size: 5, life: .15, r: 1, g: 1, b: 1, a: 1, fin: .01 }); FX.light(pos, 0xffffff, 200, 30, .25);
    SFX.play('flashbang', { pos, vol: 1.1, ref: 8 });
    Net.event({ t: 'fb', p: [pos.x, pos.y, pos.z] });
  },
  fxSmallBoom(pos) { FX.pAdd.spawn({ x: pos.x, y: pos.y, z: pos.z, size: 1, life: .2, r: 1, g: .7, b: .3 }); SFX.play('he', { pos, vol: .3, ref: 3 }); Net.event({ t: 'sboom', p: [pos.x, pos.y, pos.z] }); },
  addSmoke(pos, owner) {
    const s = { id: this.nid++, pos: pos.clone(), t0: this.time, dur: 18 };
    this.smokes.push(s);
    for (const f of this.fires.slice()) if (f.pos.distanceTo(pos) < 4.2) this.removeFire(f);
    FX.smoke(s.id, s.pos, s.dur); SFX.play('smoke', { pos, ref: 5 });
    Net.event({ t: 'smoke', id: s.id, p: [pos.x, pos.y, pos.z] });
  },
  addFire(pos, owner, wid) {
    for (const s of this.smokes) if (s.pos.distanceTo(pos) < 4.2 && this.time - s.t0 < s.dur) { FX.dust(pos, 12); SFX.play('smoke', { pos, vol: .5, ref: 4 }); return; }
    const f = { id: this.nid++, pos: pos.clone(), t0: this.time, dur: 7, r: 2.6, owner, wid: wid || 'molotov' };
    this.fires.push(f);
    FX.fire(f.id, pos, f.r, f.dur); SFX.play('molly', { pos, ref: 5 });
    f.snd = SFX.play('fire', { pos, loop: true, vol: .8, ref: 4 });
    Net.event({ t: 'fire', id: f.id, p: [pos.x, pos.y, pos.z] });
  },
  removeFire(f) { if (f.snd) f.snd.stop(); FX.removeFire(f.id); this.fires = this.fires.filter(x => x !== f); Net.event({ t: 'fireoff', id: f.id }); },
  stopFireSounds() { for (const f of this.fires) if (f.snd) f.snd.stop(); },
  updateHazards(dt) {
    const now = this.time;
    for (const s of this.smokes.slice()) if (now - s.t0 > s.dur) { this.smokes.splice(this.smokes.indexOf(s), 1); }
    for (const f of this.fires.slice()) {
      if (now - f.t0 > f.dur) { this.removeFire(f); continue; }
      for (const p of this.players) {
        if (!p.alive) continue;
        const dx = p.pos.x - f.pos.x, dz = p.pos.z - f.pos.z;
        if (dx * dx + dz * dz > f.r * f.r || Math.abs(p.pos.y - f.pos.y) > 1.2) continue;
        p.fireAcc = (p.fireAcc || 0) + 40 * dt;
        if (p.fireAcc >= 4) { const d = Math.floor(p.fireAcc); p.fireAcc -= d; this.damage(p, d, f.owner, f.wid, { type: 'fire' }); }
      }
    }
  },
  smokeRadius(s) {
    const t = this.time - s.t0;
    if (t < 0 || t > s.dur) return 0;
    return 3.3 * Math.min(1, t / 1.3) * (t > s.dur - 1.5 ? Math.max(0, (s.dur - t) / 1.5) : 1);
  },
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      const r = this.smokeRadius(s) * .92; if (r <= .2) continue;
      const cx = s.pos.x, cy = s.pos.y + 1.4, cz = s.pos.z;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz || 1;
      const t = clamp(((cx - a.x) * dx + (cy - a.y) * dy + (cz - a.z) * dz) / L2, 0, 1);
      const px = a.x + dx * t - cx, py = (a.y + dy * t - cy) * 1.25, pz = a.z + dz * t - cz;
      if (px * px + py * py + pz * pz < r * r) return true;
    }
    return false;
  },
  smokeOnSegment(o, d, len) { _v4.set(o.x + d.x * len, o.y + d.y * len, o.z + d.z * len); return this.smokeBlocks(o, _v4); },

  /* ---------- sound events & information ---------- */
  noise(src, type) {
    const pos = src.pos || src;
    this.noises.push({ pos: pos.clone ? pos.clone() : new V3(pos.x, pos.y, pos.z), t: this.time, type, team: src.team, src });
  },
  footstep(p, land) {
    this.noise(p, 'step');
    const vp = this.viewPlayer(); if (!vp) return;
    const d = vp.pos.distanceTo(p.pos); if (d > 38 && p !== vp) return;
    const m = World.overlaps(p.pos.x - .1, p.pos.y - .05, p.pos.z - .1, p.pos.x + .1, p.pos.y + .01, p.pos.z + .1) ? this.surfaceAt(p) : 'sand';
    const name = land ? 'land' : m === 'metal' ? 'stepm' : 'step' + (1 + Math.floor(Math.random() * 4));
    if (p === vp) SFX.play(name, { vol: land ? .5 : .28 });
    else SFX.play(name, { pos: p.pos, vol: land ? .9 : .75, ref: 3, roll: 1.4, occ: !this.hearClear(p.pos.clone().setY(p.pos.y + 1)) });
  },
  surfaceAt(p) { let k = 'sand'; World.forOverlaps(p.pos.x - .1, p.pos.y - .05, p.pos.z - .1, p.pos.x + .1, p.pos.y + .01, p.pos.z + .1, b => { k = World.matKind(b.mat); return true; }); return k; },
  audible(pos, r) { const vp = this.viewPlayer(); return !!vp && vp.pos.distanceTo(pos) < r; },
  hearClear(pos) { const vp = this.viewPlayer(); if (!vp) return true; return World.los(vp.eye(_v4), pos); },
  spot(e, by) { e['spot' + by.team] = this.time; if (!this.mode.ffa) this.intelPush(by.team, e.pos, this.time); },
  intelPush(team, pos, t) { if (!team || team === 'none') return; this.intel[team].push({ pos: pos.clone(), t, site: BotAI.intelSite(pos) }); },
  hint(t, d) { if (this.local) HUD.hint(t, d); },
  stepSmooth(dy) { App.stepOffset -= dy; },
  landKick(f) { App.landKick = Math.min(.12, f * .006); },
  muzzlePos(p) { const g = p.model && p.model.gun; if (!g || !p.model.root.visible) return null; return g.userData.muzzle.getWorldPosition(new V3()); },
  vmMuzzleWorld() { return App.vmPointWorld('muzzle'); },
  vmEjectWorld() { return App.vmPointWorld('eject'); }
};
