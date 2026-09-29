/* ===================== bots ===================== */
const BOT_DIFF = {
  easy: { react: .55, turn: 260, err: 6.5, decay: 1.6, head: .15, spray: .25, fov: 100, hear: 18, strafe: .1, k: 6, nades: .15, burst: 12, walk: .1 },
  normal: { react: .38, turn: 420, err: 4.5, decay: 2.6, head: .3, spray: .5, fov: 120, hear: 26, strafe: .35, k: 9, nades: .45, burst: 10, walk: .4 },
  hard: { react: .24, turn: 580, err: 3.0, decay: 4.0, head: .5, spray: .78, fov: 140, hear: 34, strafe: .7, k: 13, nades: .8, burst: 8, walk: .8 },
  expert: { react: .17, turn: 780, err: 2.0, decay: 5.5, head: .7, spray: .92, fov: 160, hear: 42, strafe: .9, k: 17, nades: .95, burst: 7, walk: .95 }
};
const BOT_NAMES = ['Viper', 'Ghost', 'Rook', 'Blitz', 'Kilo', 'Havoc', 'Nova', 'Shade', 'Talon', 'Jinx', 'Moss', 'Echo', 'Rift', 'Brick', 'Flux', 'Onyx', 'Zed', 'Pike', 'Dune', 'Frost', 'Raze', 'Cobra', 'Mako', 'Sable', 'Wisp', 'Vandal', 'Crow', 'Nomad'];
const SITE_C = { A: new V3(37, 1.6, -42), B: new V3(-40, 0, -36) };

const BotAI = {
  plan: { T: null, CT: null }, lastRadio: 0,
  v3(x, z) { return new V3(x, World.floorAt(x, z), z); },
  newRound() {
    if (Game.mode.ffa || !Game.mode.bomb) { this.plan.T = this.plan.CT = null; return; }
    // ---- terrorists pick a site and routes ----
    const sites = Game.mode.sites;
    const site = sites.length === 1 ? sites[0] : (Math.random() < .5 ? 'A' : 'B');
    const rush = Math.random() < (Game.mode.id === 'wingman' ? .3 : .18);
    const Ts = Game.players.filter(p => p.team === 'T' && p.isBot);
    const routesA = ['Along', 'Along', 'Ashort'], routesB = ['Btun', 'Btun', 'Bmid', 'Btun', 'Bdoors'];
    const assign = {};
    Ts.forEach((p, i) => { assign[p.id] = site === 'A' ? routesA[i % 3] : routesB[i % (Ts.length >= 4 ? 5 : 2)]; });
    this.plan.T = { site, rush, phase: rush ? 'execute' : 'default', t0: Game.time, assign, execT: rush ? Game.time : 0, staged: new Set(), nades: MAPDEF.nades[site].slice() };
    // ---- counter-terrorists spread over the sites ----
    const CTs = Game.players.filter(p => p.team === 'CT' && p.isBot);
    const order = sites.length === 1 ? ['B', 'B', 'B', 'B', 'B'] : shuffle(['A', 'B']).concat(['MID', 'A', 'B']);
    const used = { A: 0, B: 0, MID: 0 }, holds = {};
    CTs.forEach((p, i) => {
      const area = order[i % order.length], list = MAPDEF.holds[area];
      const h = list[(used[area]++ + Math.floor(Math.random() * 2)) % list.length];
      holds[p.id] = { area, spot: h };
    });
    this.plan.CT = { holds, rotate: null, retake: false, nades: { A: MAPDEF.nades.CT_A.slice(), B: MAPDEF.nades.CT_B.slice() } };
  },
  update() {
    const T = this.plan.T, CT = this.plan.CT; if (!T || Game.phase !== 'live') return;
    const now = Game.time, left = Game.roundLeft();
    if (T.phase === 'default') {
      const alive = Game.players.filter(p => p.team === 'T' && p.alive && p.isBot).length;
      if ((alive && T.staged.size >= Math.max(1, Math.ceil(alive * .6))) || left < 62 || now - T.t0 > 50) { T.phase = 'execute'; T.execT = now; this.radio(Game.players.find(p => p.team === 'T' && p.isBot && p.alive), 'Go go go!'); }
    }
    if (Game.bomb.state === 'planted') { T.phase = 'post'; if (CT && !CT.retake) CT.retake = true; }
    // CT rotations on intel
    if (CT && !CT.retake) {
      const recent = Game.intel.CT.filter(i => now - i.t < 6);
      for (const s of Game.mode.sites) {
        const n = recent.filter(i => i.site === s).length;
        if (n >= 2 && CT.rotate !== s) { CT.rotate = s; this.radio(Game.players.find(p => p.team === 'CT' && p.isBot && p.alive), 'Rotating to ' + s + '!'); }
      }
    }
  },
  radio(p, msg) { if (!p || Game.time - this.lastRadio < 3) return; this.lastRadio = Game.time; HUD.chat(p, msg, true, true); },
  intelSite(pos) {
    for (const s in SITE_C) { if (pos.distanceTo(SITE_C[s]) < 26) return s; }
    const c = World.callout(pos.x, pos.z);
    if (c === 'Long A' || c === 'A Ramp' || c === 'A Short' || c === 'Long Doors') return 'A';
    if (c === 'Upper Tunnels' || c === 'B Doors' || c === 'B Window') return 'B';
    return null;
  }
};

class Bot {
  constructor(p, diff) { this.p = p; this.setDiff(diff); this.reset(); }
  setDiff(d) { this.diff = d; this.s = BOT_DIFF[d] || BOT_DIFF.hard; }
  reset() {
    const p = this.p;
    this.goal = null; this.goalKey = ''; this.path = null; this.pi = 0; this.repathAt = 0;
    this.stuckT = 0; this.stuckN = 0; this.chkPos = p.pos.clone(); this.chkT = Game.time;
    this.target = null; this.reactAt = 0; this.aimHead = true; this.errX = 0; this.errY = 0;
    this.lastSeen = null; this.lastSeenT = -99; this.heard = null; this.heardT = -99;
    this.task = 'idle'; this.wp = null; this.wpi = 0; this.hold = null; this.look = null;
    this.thinkT = Math.random() * .1; this.burstN = 0; this.pauseUntil = 0; this.lastFire = false;
    this.strafeDir = Math.random() < .5 ? 1 : -1; this.strafeUntil = 0; this.stopUntil = 0;
    this.nade = null; this.nadeT = 0; this.nadesThrown = 0; this.crouchPref = false; this.walkNow = false;
    this.spotted = new Set(); this.plantSpot = null; this.post = null;
  }
  // ---------------- per-step ----------------
  update(dt) {
    const p = this.p, c = p.cmd, now = Game.time;
    c.fireHit = c.fire2Hit = c.reload = c.jumpHit = c.inspect = c.useHit = false;
    c.fire = c.fire2 = c.use = false;
    if (!p.alive) return;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = .1; this.perceive(); this.decide(); }
    this.aim(dt);
    this.move(dt);
    this.shoot(dt);
  }
  // ---------------- perception ----------------
  canSee(e, eye) {
    if (!e.alive) return false;
    const hy = e.pos.y + lerp(1.66, 1.22, e.duckAmt), cy = e.pos.y + lerp(1.3, .92, e.duckAmt);
    for (const y of [hy, cy]) {
      _v2.set(e.pos.x, y, e.pos.z);
      if (World.los(eye, _v2) && !Game.smokeBlocks(eye, _v2)) return true;
    }
    return false;
  }
  perceive() {
    const p = this.p, s = this.s, now = Game.time, eye = p.eye();
    const blind = now < p.flashEnd - Math.min(1, p.flashDur * .35);
    let best = null, bestScore = 1e9;
    const fwd = p.aimDir(_v1);
    for (const e of Game.players) {
      if (!p.isEnemy(e) || !e.alive) continue;
      const dx = e.pos.x - p.pos.x, dy = e.pos.y + 1.2 - eye.y, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dy, dz);
      if (d > 95) continue;
      if (Game.time < e.immuneUntil) continue;
      const ang = Math.acos(clamp((fwd.x * dx + fwd.y * dy + fwd.z * dz) / (d || 1), -1, 1)) / DEG;
      const close = d < 2.5;
      if (blind && !close) continue;
      if (ang > s.fov / 2 && !close && e !== this.target) continue;
      if (!this.canSee(e, eye)) continue;
      const score = d + ang * .35 - (e === this.target ? 12 : 0);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) {
      if (best !== this.target) {
        const d = best.pos.distanceTo(p.pos);
        const ang = this.angleTo(best);
        this.reactAt = now + s.react * rand(.85, 1.25) * (1 + clamp(ang / 90, 0, 1) * .6) * (this.target ? .6 : 1);
        const e = s.err * rand(.6, 1.3) * (1 + d / 70) * (p.vel.length() > 2 ? 1.3 : 1);
        const a = Math.random() * TAU; this.errX = Math.cos(a) * e; this.errY = Math.sin(a) * e * .7;
        this.aimHead = Math.random() < s.head * (d > 30 ? .8 : 1);
        this.burstN = 0; this.pauseUntil = 0; this.seenShots = p.shotCount || 0;
        this.strafer = Math.random() < s.strafe; this.crouchSpray = Math.random() < .45;
        if (!this.spotted.has(best.id)) { this.spotted.add(best.id); if (Math.random() < .35) BotAI.radio(p, 'Enemy spotted at ' + (World.callout(best.pos.x, best.pos.z) || 'unknown')); }
      }
      this.target = best; this.lastSeen = best.pos.clone(); this.lastSeenT = now;
      Game.spot(best, p);
    } else if (this.target && now - this.lastSeenT > .45) this.target = null;
    // hearing
    for (const n of Game.noises) {
      if (now - n.t > .5 || !n.team || n.team === p.team && !Game.mode.ffa || n.src === p) continue;
      const r = n.type === 'shot' ? s.hear * 2.6 : n.type === 'silenced' ? s.hear * .7 : n.type === 'nade' ? s.hear * 2 : s.hear;
      if (n.pos.distanceTo(p.pos) < r) { this.heard = n.pos.clone(); this.heardT = n.t; if (!Game.mode.ffa) Game.intelPush(p.team, n.pos, n.t); }
    }
  }
  angleTo(e) { const f = this.p.aimDir(_v1), dx = e.pos.x - this.p.pos.x, dy = e.pos.y + 1.2 - this.p.pos.y - this.p.eyeOff, dz = e.pos.z - this.p.pos.z, d = Math.hypot(dx, dy, dz) || 1; return Math.acos(clamp((f.x * dx + f.y * dy + f.z * dz) / d, -1, 1)) / DEG; }
  // ---------------- decisions ----------------
  decide() {
    const p = this.p, now = Game.time, M = Game.mode;
    this.weaponChoice();
    if (!this.target && p.active && p.active.def.mag && p.active.clip < p.active.def.mag * .35 && now - this.lastSeenT > 1.5 && p.active.reserve > 0) p.cmd.reload = true;
    if (Game.phase === 'freeze') { this.task = 'idle'; return; }
    if (M.ffa || !M.bomb) { this.decideDM(); return; }
    const knownEnemyNear = (now - this.lastSeenT < 5 && this.lastSeen && this.lastSeen.distanceTo(p.pos) < 25) || (now - this.heardT < 4 && this.heard && this.heard.distanceTo(p.pos) < 22);
    this.walkNow = knownEnemyNear && Math.random() < this.s.walk && !this.target;
    if (p.team === 'T') this.decideT(); else this.decideCT();
  }
  setGoal(pos, key) {
    if (this.goalKey === key && this.goal) return;
    this.goal = pos.clone(); this.goalKey = key; this.path = null; this.repathAt = 0;
  }
  decideDM() {
    const p = this.p, now = Game.time;
    if (this.target) return;
    if (this.heard && now - this.heardT < 3) { this.setGoal(this.heard, 'heard' + Math.round(this.heardT)); this.look = this.heard; return; }
    if (!this.goal || p.pos.distanceTo(this.goal) < 3 || this.stuckN > 2) {
      const N = World.nav, m = World.randomNode(k => N.ny[k] < 2.5 && Math.hypot(N.nx[k] - p.pos.x, N.nz[k] - p.pos.z) > 20);
      this.setGoal(new V3(N.nx[m], N.ny[m], N.nz[m]), 'roam' + m); this.stuckN = 0;
    }
    this.look = null;
  }
  decideT() {
    const p = this.p, now = Game.time, plan = BotAI.plan.T, B = Game.bomb;
    if (!plan) return;
    // the bomb is lying around: closest free terrorist fetches it
    if (B.state === 'dropped' && B.pos) {
      const Ts = Game.players.filter(q => q.team === 'T' && q.alive && q.isBot);
      let near = null, nd = 1e9; for (const q of Ts) { const d = q.pos.distanceTo(B.pos); if (d < nd) { nd = d; near = q; } }
      if (near === p) { this.task = 'bomb'; this.setGoal(B.pos, 'bomb'); this.look = null; return; }
    }
    if (B.state === 'planted') {
      if (!this.post) { const L = MAPDEF.post[B.site]; const idx = Game.players.filter(q => q.team === 'T' && q.isBot).indexOf(p); this.post = L[(idx + 4) % L.length]; }
      this.task = 'post'; this.setGoal(BotAI.v3(this.post[0], this.post[1]), 'post'); this.look = BotAI.v3(this.post[2], this.post[3]).setY(1.2 + World.floorAt(this.post[2], this.post[3]));
      if (this.target === null && this.heard && now - this.heardT < 3) this.look = this.heard;
      return;
    }
    const carrier = !!p.c4;
    if (plan.phase === 'execute' || carrier && this.task === 'site') {
      // utility on the way in
      if (!this.nade && this.nadesThrown < 2 && Math.random() < this.s.nades && now - plan.execT < 12) {
        const want = plan.nades.findIndex(n => p.nades.some(x => x.def.gtype === (n[0] === 'molotov' ? 'fire' : n[0]) || x.id === n[0]));
        if (want >= 0) { const n = plan.nades[want]; const tgt = new V3(n[1], n[2], n[3]); if (tgt.distanceTo(p.pos) < 40) { plan.nades.splice(want, 1); this.startNade(n[0], tgt); } }
      }
      this.task = 'site';
      if (carrier) {
        if (!this.plantSpot) { const L = MAPDEF.plants[plan.site]; this.plantSpot = BotAI.v3(...pick(L)); }
        this.setGoal(this.plantSpot, 'plant');
        this.look = null;
      } else {
        if (!this.post) { const L = MAPDEF.post[plan.site]; this.post = L[Math.floor(Math.random() * L.length)]; }
        this.setGoal(BotAI.v3(this.post[0], this.post[1]), 'entry');
        if (p.pos.distanceTo(this.goal) < 4) this.look = BotAI.v3(this.post[2], this.post[3]).setY(World.floorAt(this.post[2], this.post[3]) + 1.3);
        else this.look = null;
      }
      return;
    }
    // default: walk the assigned route to the staging point and wait there
    const route = MAPDEF.routes[plan.assign[p.id] || 'Along'];
    if (!this.wp || this.wpRoute !== route) { this.wp = route.map(([x, z]) => BotAI.v3(x, z)); this.wpi = 0; this.wpRoute = route; }
    while (this.wpi < this.wp.length - 1 && p.pos.distanceTo(this.wp[this.wpi]) < 5) this.wpi++;
    const last = this.wpi >= this.wp.length - 1;
    this.task = last ? 'stage' : 'route';
    this.setGoal(this.wp[this.wpi], 'wp' + this.wpi);
    if (last && p.pos.distanceTo(this.wp[this.wpi]) < 6) { plan.staged.add(p.id); this.look = SITE_C[plan.site].clone().setY(SITE_C[plan.site].y + 1.4); }
    else this.look = null;
    if (this.heard && now - this.heardT < 2.5) this.look = this.heard;
  }
  decideCT() {
    const p = this.p, now = Game.time, plan = BotAI.plan.CT, B = Game.bomb;
    if (!plan) return;
    if (B.state === 'planted') {
      const d = p.pos.distanceTo(B.pos), timeLeft = B.explodeAt - now, need = p.defuser ? 5 : 10;
      if (timeLeft < need - .3 && d > 8) { this.task = 'save'; const h = MAPDEF.holds.MID[0]; this.setGoal(BotAI.v3(h[0], h[1]), 'save'); this.look = null; return; }
      this.task = 'retake';
      const enemiesKnown = now - this.lastSeenT < 3;
      this.setGoal(B.pos, 'bombpos');
      if (d < 1.1 && !this.target && (!enemiesKnown || timeLeft < need + 1.5)) { this.task = 'defuse'; p.cmd.use = true; p.cmd.duck = true; this.look = B.pos.clone(); }
      else this.look = null;
      return;
    }
    const mine = plan.holds[p.id]; if (!mine) return;
    let area = mine.area, spot = mine.spot;
    if (plan.rotate && area !== plan.rotate) {
      // keep one anchor on the other site, everybody else rotates
      const sameArea = Game.players.filter(q => q.team === 'CT' && q.alive && q.isBot && plan.holds[q.id] && plan.holds[q.id].area === area);
      if (area === 'MID' || sameArea.indexOf(p) > 0) { area = plan.rotate; const L = MAPDEF.holds[area]; spot = L[(p.id * 7) % L.length]; }
    }
    // defensive utility when enemies are heard approaching
    if (!this.nade && this.nadesThrown < 1 && this.heard && now - this.heardT < 2 && (area === 'A' || area === 'B') && Math.random() < this.s.nades * .5) {
      const L = plan.nades[area]; const i = L.findIndex(n => p.nades.some(x => x.id === n[0] || (n[0] === 'incgrenade' && x.id === 'molotov')));
      if (i >= 0) { const n = L.splice(i, 1)[0]; const t = new V3(n[1], n[2], n[3]); if (t.distanceTo(p.pos) < 40) this.startNade(p.nades.some(x => x.id === n[0]) ? n[0] : 'molotov', t); }
    }
    this.task = 'hold';
    this.setGoal(BotAI.v3(spot[0], spot[1]), 'hold' + area + spot[0]);
    const atSpot = p.pos.distanceTo(this.goal) < 2.5;
    this.look = atSpot || p.pos.distanceTo(this.goal) < 10 ? new V3(spot[2], World.floorAt(spot[2], spot[3]) + 1.4, spot[3]) : null;
    if (this.heard && now - this.heardT < 2.5) this.look = this.heard.clone().setY(this.heard.y + 1.3);
    else if (this.lastSeen && now - this.lastSeenT < 3) this.look = this.lastSeen.clone().setY(this.lastSeen.y + 1.4);
    this.crouchPref = atSpot && Math.random() < .3;
  }
  weaponChoice() {
    const p = this.p; if (this.nade) return;
    const w = p.active;
    const has = x => x && (x.clip > 0 || x.reserve > 0);
    if (p.c4 && this.task === 'site' && this.plantSpot && p.pos.distanceTo(this.plantSpot) < 2 && !this.target && World.inSite(p.pos.x, p.pos.z)) { if (w !== p.c4) p.equip(p.c4); return; }
    let want = has(p.primary) ? p.primary : has(p.secondary) ? p.secondary : p.knife;
    if (this.target && w && w.def.mag && w.clip === 0 && w === p.primary && has(p.secondary) && this.target.pos.distanceTo(p.pos) < 15 && p.secondary.clip > 0) want = p.secondary;
    if (w !== want && !(w && w.def.cat === 'grenade' && p.nadeState !== 'idle')) p.equip(want);
  }
  // ---------------- grenades ----------------
  startNade(type, tgt) {
    const p = this.p, inst = p.nades.find(x => x.id === type) || (type === 'incgrenade' && p.nades.find(x => x.id === 'molotov')) || (type === 'molotov' && p.nades.find(x => x.id === 'incgrenade'));
    if (!inst) return;
    const sol = this.solveThrow(tgt, type === 'flash' || type === 'smoke');
    if (!sol) return;
    this.nade = { inst, yaw: sol.yaw, pitch: sol.pitch, t0: Game.time };
    p.equip(inst);
  }
  solveThrow(tgt, preferHigh) {
    const p = this.p, eye = p.eye(), v = 750 * U, g = Grenades.g;
    const dx = tgt.x - eye.x, dz = tgt.z - eye.z, D = Math.hypot(dx, dz), H = tgt.y - eye.y;
    const disc = v ** 4 - g * (g * D * D + 2 * H * v * v); if (disc < 0) return null;
    const cands = [Math.atan((v * v - Math.sqrt(disc)) / (g * D)), Math.atan((v * v + Math.sqrt(disc)) / (g * D))];
    if (preferHigh) cands.reverse();
    const yaw = yawTo(dx, dz);
    for (const th of cands) {
      if (th > 1.35) continue;
      // check the arc is clear of walls
      let ok = true; const vx = Math.cos(th) * v * dx / D, vz = Math.cos(th) * v * dz / D, vy = Math.sin(th) * v;
      let px = eye.x, py = eye.y, pz = eye.z; const T = D / (Math.cos(th) * v);
      for (let t = .05; t < T - .1; t += .05) {
        const nx = eye.x + vx * t, ny = eye.y + vy * t - .5 * g * t * t, nz = eye.z + vz * t;
        const sx = nx - px, sy = ny - py, sz = nz - pz, L = Math.hypot(sx, sy, sz);
        if (World.raycast(px, py, pz, sx / L, sy / L, sz / L, L, null) < L) { ok = false; break; }
        px = nx; py = ny; pz = nz;
      }
      if (!ok) continue;
      const pitch = th >= .1885 ? (th - .1885) / .88 : (th - .1885) / 1.12;
      return { yaw, pitch };
    }
    return null;
  }
  // ---------------- aiming ----------------
  aim(dt) {
    const p = this.p, s = this.s, now = Game.time;
    let ty = null, tp = null, speed = s.turn;
    if (this.nade) { ty = this.nade.yaw; tp = this.nade.pitch; speed = s.turn * .6; }
    else if (this.target) {
      const e = this.target, eye = p.eye(_v3);
      const hy = this.aimHead ? lerp(1.66, 1.22, e.duckAmt) : lerp(1.3, .92, e.duckAmt);
      // light leading of moving targets on higher difficulties
      const lead = s.spray * .06;
      const tx = e.pos.x + e.vel.x * lead - eye.x, tyy = e.pos.y + hy - eye.y, tz = e.pos.z + e.vel.z * lead - eye.z;
      ty = yawTo(tx, tz) + this.errX * DEG; tp = pitchTo(tx, tyy, tz) + this.errY * DEG;
      const k = Math.exp(-s.decay * dt); this.errX *= k; this.errY *= k;
      // pull down against the spray
      tp -= p.punchY * DEG * s.spray; ty += p.punchX * DEG * s.spray;
      tp -= p.flinchY * .5;
    } else if (this.look) {
      const eye = p.eye(_v3); const dx = this.look.x - eye.x, dy = this.look.y - eye.y, dz = this.look.z - eye.z;
      if (dx * dx + dz * dz > .25) { ty = yawTo(dx, dz); tp = pitchTo(dx, dy, dz); }
      speed = s.turn * .45;
    } else if (this.path && this.pi < this.path.length) {
      const N = World.nav, j = Math.min(this.path.length - 1, this.pi + 6), n = this.path[j];
      const dx = N.nx[n] - p.pos.x, dz = N.nz[n] - p.pos.z;
      if (dx * dx + dz * dz > 1) { ty = yawTo(dx, dz); tp = pitchTo(dx, N.ny[n] + 1.5 - p.pos.y - p.eyeOff, dz) * .5; }
      speed = s.turn * .35;
    }
    if (ty === null) return;
    const kk = 1 - Math.exp(-s.k * dt), lim = speed * DEG * dt;
    const dy = angDiff(p.yaw, ty), dp = tp - p.pitch;
    p.yaw = wrapAngle(p.yaw + clamp(dy * kk * (this.target ? 1 : .6), -lim, lim));
    p.pitch = clamp(p.pitch + clamp(dp * kk, -lim, lim), -1.5, 1.5);
  }
  // ---------------- movement ----------------
  move(dt) {
    const p = this.p, c = p.cmd, now = Game.time, N = World.nav;
    c.fwd = c.side = 0; c.walk = this.walkNow; c.duck = false;
    if (Game.frozen(p)) return;
    let mx = 0, mz = 0;
    const engaging = this.target && now >= this.reactAt - .1;
    if (this.nade) return; // stand still while lining up a throw
    if (this.task === 'defuse') { c.duck = true; c.use = true; return; }
    if (p.planting) return;
    if (engaging) {
      const w = p.active, d = w ? w.def : null, dist = this.target.pos.distanceTo(p.pos);
      const needStill = d && (d.cat === 'rifle' || d.cat === 'sniper' || d.cat === 'pistol' || d.cat === 'mg') && dist > 7;
      if (d && (d.cat === 'knife' || d.cat === 'zeus')) {
        // close the distance: run straight in, zig-zag a little, hop over small obstacles
        const f = _v1.set(this.target.pos.x - p.pos.x, 0, this.target.pos.z - p.pos.z).normalize();
        mx = f.x - f.z * Math.sin(now * 5) * .35; mz = f.z + f.x * Math.sin(now * 5) * .35;
        if (p.onGround && Math.random() < .01) c.jumpHit = true;
      } else if (now < this.stopUntil || (needStill && this.wantShot) || !this.strafer) {
        // counter-strafe: push against our own velocity until we are accurate
        const sp = Math.hypot(p.vel.x, p.vel.z);
        if (sp > 1.2) { mx = -p.vel.x / sp; mz = -p.vel.z / sp; }
      } else {
        if (now > this.strafeUntil) { this.strafeDir = -this.strafeDir; this.strafeUntil = now + rand(.25, .6); if (Math.random() < .3) this.stopUntil = now + rand(.2, .4); }
        const f = _v1.set(this.target.pos.x - p.pos.x, 0, this.target.pos.z - p.pos.z).normalize();
        mx = -f.z * this.strafeDir; mz = f.x * this.strafeDir;
        if (d && (d.cat === 'smg' || d.cat === 'shotgun') && dist > 5) { mx += f.x * .6; mz += f.z * .6; }
      }
      if (d && (d.cat === 'rifle' || d.cat === 'mg') && dist > 22 && this.crouchSpray) c.duck = this.wantShot;
    } else if (this.goal) {
      // path following
      if (!this.path || now > this.repathAt) {
        const a = World.nearestNode(p.pos.x, p.pos.y, p.pos.z), b = World.nearestNode(this.goal.x, this.goal.y, this.goal.z);
        this.path = World.findPath(a, b); this.pi = 0; this.repathAt = now + 3 + Math.random();
      }
      if (this.path && this.path.length) {
        while (this.pi < this.path.length - 1) { const n = this.path[this.pi]; if (Math.hypot(N.nx[n] - p.pos.x, N.nz[n] - p.pos.z) < .9) this.pi++; else break; }
        let j = this.pi; const lim = Math.min(this.path.length - 1, this.pi + 8), py = N.ny[this.path[this.pi]];
        for (let k = lim; k > this.pi; k--) { const n = this.path[k]; if (World.walkLine(p.pos.x, p.pos.z, p.pos.y, N.nx[n], N.nz[n])) { j = k; break; } }
        const n = this.path[j];
        const gx = N.nx[n] - p.pos.x, gz = N.nz[n] - p.pos.z, gl = Math.hypot(gx, gz);
        const final = j === this.path.length - 1;
        const gd = Math.hypot(this.goal.x - p.pos.x, this.goal.z - p.pos.z);
        if (!(final && gd < .7)) { if (gl > .05) { mx = gx / gl; mz = gz / gl; } }
        if (final && gd < 2.5 && (this.task === 'hold' || this.task === 'post' || this.task === 'stage')) c.walk = true;
        if (final && gd < .7 && this.crouchPref && this.task === 'hold') c.duck = true;
      }
      // light separation from teammates
      for (const q of Game.players) {
        if (q === p || !q.alive || p.isEnemy(q)) continue;
        const dx = p.pos.x - q.pos.x, dz = p.pos.z - q.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < 1.2 && d2 > 1e-4) { const d = Math.sqrt(d2); mx += dx / d * .5; mz += dz / d * .5; }
      }
      // stuck detection
      if (now - this.chkT > 1) {
        const moved = Math.hypot(p.pos.x - this.chkPos.x, p.pos.z - this.chkPos.z);
        const wants = (mx || mz) && !(this.task === 'hold' && this.goal.distanceTo(p.pos) < 2);
        if (wants && moved < .35) { this.stuckN++; c.jumpHit = true; if (this.stuckN >= 2) { this.path = null; this.repathAt = 0; } if (this.stuckN >= 4) { this.goalKey = ''; this.stuckN = 0; this.path = null; } }
        else this.stuckN = 0;
        this.chkPos.copy(p.pos); this.chkT = now;
      }
    }
    // world direction -> local fwd/side
    const l = Math.hypot(mx, mz); if (l < .01) return;
    mx /= l; mz /= l;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    c.fwd = mx * fx + mz * fz; c.side = mx * rx + mz * rz;
  }
  // ---------------- shooting ----------------
  shoot(dt) {
    const p = this.p, c = p.cmd, now = Game.time, w = p.active;
    this.wantShot = false;
    if (this.nade) {
      const n = this.nade;
      if (p.active !== n.inst) { if (!p.nades.includes(n.inst)) { this.nade = null; this.nadesThrown++; } return; }
      if (now < p.drawEnd) return;
      const err = Math.abs(angDiff(p.yaw, n.yaw)) + Math.abs(n.pitch - p.pitch);
      if (p.nadeState === 'idle' && err < 1.2 * DEG) { c.fire = true; }
      else if (p.nadeState === 'pull') { if (now - p.nadePullT < .3) c.fire = true; }
      if (now - n.t0 > 4) { this.nade = null; this.nadesThrown++; }
      return;
    }
    if (p.c4 && w === p.c4 && this.task === 'site' && !this.target && Game.canPlantHere(p)) { c.fire = true; return; }
    if (!this.target || !w || now < this.reactAt) return;
    const d = w.def; if (d.cat === 'grenade' || d.cat === 'c4') return;
    if (d.cat === 'knife') { if (this.target.pos.distanceTo(p.pos) < 1.7) c.fire = true; return; }
    if (w.clip === 0) { c.reload = true; return; }
    const e = this.target, eye = p.eye(_v3), dist = e.pos.distanceTo(p.pos);
    // angular error between where bullets go and the target point
    const hy = this.aimHead ? lerp(1.66, 1.22, e.duckAmt) : lerp(1.3, .92, e.duckAmt);
    const tx = e.pos.x - eye.x, ty = e.pos.y + hy - eye.y, tz = e.pos.z - eye.z;
    const byaw = p.yaw - p.punchX * DEG, bpitch = p.pitch + p.punchY * DEG;
    const err = Math.hypot(angDiff(byaw, yawTo(tx, tz)) * Math.cos(bpitch), pitchTo(tx, ty, tz) - bpitch) / DEG;
    const rad = this.aimHead ? .14 : .24, tol = Math.atan(rad / Math.max(dist, .5)) / DEG * (1.6 + this.s.spray * .6) + .25;
    const spread = p.spread();
    this.wantShot = err < tol * 2.5;
    if (d.scope && dist > 9 && p.zoom === 0 && !p.rezoom && d.cat === 'sniper') { c.fire2Hit = true; return; }
    if (d.cat === 'sniper' && (p.zoom === 0 && dist > 9 || Math.hypot(p.vel.x, p.vel.z) > d.speed * .3)) return;
    if (err > tol) { if (!(d.auto && this.burstN > 0 && err < tol * 3)) { this.lastFire = false; return; } }
    // don't waste a first shot while running at range
    if (dist > 10 && spread > tol * 4 && this.burstN === 0 && d.cat !== 'smg' && d.cat !== 'shotgun') return;
    if (now < this.pauseUntil) { this.lastFire = false; return; }
    if (!Game.mode.ffa) { const bd = dirFromAngles(byaw, bpitch, _v4); for (const q of Game.players) { if (q === p || !q.alive || p.isEnemy(q)) continue; const r = Combat.hitTest(q, eye, bd, dist); if (r) { this.lastFire = false; return; } } }
    if (d.auto && !w.burst) {
      const maxB = dist > 28 ? 3 : dist > 14 ? 5 : this.s.burst + 6;
      c.fire = true;
      const sc = p.shotCount || 0;
      if (sc !== this.seenShots) { this.burstN += sc - (this.seenShots || 0); this.seenShots = sc; if (this.burstN >= maxB) { this.burstN = 0; this.pauseUntil = now + (dist > 20 ? rand(.28, .45) : rand(.15, .3)); c.fire = false; } }
    } else {
      // semi-auto: tap with a cadence that keeps the gun accurate
      const gap = d.cat === 'pistol' ? (dist > 18 ? .32 : .16) : d.cat === 'sniper' ? .1 : .12;
      if (!this.lastFire && now - p.lastShot > d.interval + gap) { c.fireHit = true; c.fire = true; this.lastFire = true; }
      else this.lastFire = false;
    }
  }
}
