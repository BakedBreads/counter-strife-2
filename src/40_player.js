/* ===================== players: movement + weapons ===================== */
const PHYS = {
  grav: 800 * U, jumpV: 301.993 * U, step: .45, fric: 5.2, stop: 80 * U, accel: 5.5, airAccel: 12, airCap: 30 * U,
  r: .4, hStand: 1.83, hDuck: 1.37, eyeStand: 1.64, eyeDuck: 1.17, duckLift: .23
};
class WeaponInst {
  constructor(id, skin) {
    this.uid = newUid(); this.id = id; this.def = W[id];
    this.clip = this.def.mag || 0; this.reserve = this.def.res || 0;
    this.skin = skin || 'default'; this.silenced = !!this.def.sil; this.burst = false; this.readyAt = 0;
  }
}
let _pid = 100; // humans use ids 1..99 (assigned by the lobby), bots count up from 100
class Player {
  constructor(o) {
    this.id = o.id || _pid++; this.name = o.name || 'Player'; this.team = o.team || 'CT';
    this.isBot = !!o.isBot; this.isLocal = !!o.isLocal; this.remote = !!o.remote; this.peer = o.peer || null;
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0; this.pitch = 0;
    this.onGround = true; this.ducked = false; this.eyeOff = PHYS.eyeStand;
    this.hp = 100; this.armor = 0; this.helmet = false; this.defuser = false; this.alive = false;
    this.money = 800;
    this.kills = 0; this.deaths = 0; this.assists = 0; this.score = 0; this.mvps = 0; this.hsKills = 0; this.dmgDealt = 0; this.roundsPlayed = 0;
    this.roundKills = 0; this.dmgTo = {}; this.flashedBy = null; this.flashedByT = 0;
    this.primary = null; this.secondary = null; this.knife = null; this.zeus = null; this.nades = []; this.c4 = null;
    this.active = null; this.lastActive = null;
    this.nextAttack = 0; this.nextAttack2 = 0; this.reloadEnd = 0; this.reloadStart = 0; this.drawEnd = 0; this.drawStart = 0;
    this.recoilIdx = 0; this.lastShot = -9; this.spreadAcc = 0; this.punchX = 0; this.punchY = 0;
    this.zoom = 0; this.rezoom = 0; this.rezoomAt = 0; this.burstLeft = 0; this.burstNext = 0; this.silencerEnd = 0;
    this.inspectStart = -9; this.inspectEnd = 0; this.fireT = -9; this.swingT = -9; this.swingHeavy = false; this.slashAlt = false;
    this.nadeState = 'idle'; this.nadePullT = 0; this.nadeStrength = 1;
    this.planting = false; this.plantStart = 0; this.defusing = false; this.defuseStart = 0;
    this.flashEnd = 0; this.flashStart = 0; this.flashDur = 0;
    this.tagUntil = 0; this.stepDist = 0; this.jumpBuf = 0; this.landSlowUntil = 0; this.lastDamageT = -9; this.deathT = 0;
    this.flinchX = 0; this.flinchY = 0; this.immuneUntil = 0; this.armsLevel = 0; this.ping = 0;
    this.cmd = { fwd: 0, side: 0, jump: false, duck: false, walk: false, fire: false, fire2: false, fireHit: false, fire2Hit: false, use: false, useHit: false, reload: false, inspect: false };
    this.skins = null; this.knifeType = 'default';
    this.model = null; this.bot = null; this.spectating = null;
    this.netPos = null; // remote interpolation buffer
  }
  hull() { return this.ducked ? PHYS.hDuck : PHYS.hStand; }
  eye(out) { return (out || new V3()).set(this.pos.x, this.pos.y + this.eyeOff, this.pos.z); }
  aimDir(out) { return dirFromAngles(this.yaw, this.pitch, out); }
  get duckAmt() { return clamp((PHYS.eyeStand - this.eyeOff) / (PHYS.eyeStand - PHYS.eyeDuck), 0, 1); }
  speed2d() { return Math.hypot(this.vel.x, this.vel.z); }
  isEnemy(o) { return o !== this && (Game.mode.ffa || o.team !== this.team); }

  /* ---------- inventory ---------- */
  weapons() { const L = []; if (this.primary) L.push(this.primary); if (this.secondary) L.push(this.secondary); if (this.knife) L.push(this.knife); if (this.zeus) L.push(this.zeus); for (const n of this.nades) L.push(n); if (this.c4) L.push(this.c4); return L; }
  clearInventory() { this.primary = this.secondary = this.zeus = this.c4 = null; this.nades = []; this.knife = new WeaponInst('knife', this.skinFor('knife')); this.active = null; this.lastActive = null; }
  skinFor(id) { if (this.isLocal) return Loadout.skinFor(id); const s = this.skins; return (s && s[id]) || 'default'; }
  addWeapon(inst) {
    const s = inst.def.slot;
    if (s === 1) this.primary = inst; else if (s === 2) this.secondary = inst;
    else if (s === 3) { if (inst.id === 'zeus') this.zeus = inst; else this.knife = inst; }
    else if (s === 4) this.nades.push(inst); else if (s === 5) this.c4 = inst;
    return inst;
  }
  removeWeapon(inst) {
    if (this.primary === inst) this.primary = null; else if (this.secondary === inst) this.secondary = null;
    else if (this.zeus === inst) this.zeus = null; else if (this.c4 === inst) this.c4 = null; else if (this.knife === inst) this.knife = null;
    else { const i = this.nades.indexOf(inst); if (i >= 0) this.nades.splice(i, 1); }
    if (this.lastActive === inst) this.lastActive = null;
    if (this.active === inst) { this.active = null; this.equip(this.lastActive || this.best(), true); }
  }
  best() { return this.primary || this.secondary || this.knife || this.weapons()[0] || null; }
  nadeCount(id) { return this.nades.filter(n => !id || n.id === id).length; }
  equip(inst, quick) {
    if (!inst || inst === this.active) return;
    if (this.active && this.active !== inst) this.lastActive = this.active;
    this.active = inst; const now = Game.time;
    this.drawStart = now; this.drawEnd = now + (quick ? inst.def.dep * .8 : inst.def.dep);
    this.reloadEnd = 0; this.zoom = 0; this.rezoom = 0; this.nadeState = 'idle'; this.inspectEnd = 0; this.burstLeft = 0; this.silencerEnd = 0;
    this.recoilIdx = 0; this.spreadAcc = 0; this.cancelPlant();
    if (this.isLocal) SFX.play('draw', { vol: .5 });
    if (Net.role === 'client' && this.isLocal) Net.sendSwitch(inst.uid);
  }
  selectSlot(n) {
    if (!this.alive) return;
    if (n === 1 && this.primary) this.equip(this.primary);
    else if (n === 2 && this.secondary) this.equip(this.secondary);
    else if (n === 3) { if (this.active === this.knife && this.zeus) this.equip(this.zeus); else this.equip(this.knife || this.zeus); }
    else if (n === 4 && this.nades.length) {
      // cycle through grenade types in CS order
      const types = [...new Set(NADE_ORDER.filter(t => this.nades.some(x => x.id === t)))];
      const cur = this.active && this.active.def.slot === 4 ? types.indexOf(this.active.id) : -1;
      const next = types[(cur + 1) % types.length]; this.equip(this.nades.find(x => x.id === next));
    }
    else if (n === 5 && this.c4) this.equip(this.c4);
  }
  cycle(dir) {
    const L = this.weapons(); if (!L.length) return;
    let i = L.indexOf(this.active); i = (i + dir + L.length) % L.length; this.equip(L[i]);
  }
  lastWeapon() { if (this.lastActive && this.weapons().includes(this.lastActive)) this.equip(this.lastActive); }

  /* ---------- movement ---------- */
  maxSpeed(cmd) {
    const w = this.active; let s = w ? w.def.speed : 250 * U;
    if (w && this.zoom > 0 && w.def.scopedSpd) s = w.def.scopedSpd * U;
    if (cmd.walk) s *= .52;
    if (this.ducked && this.onGround) s *= .34;
    if (Game.time < this.tagUntil) s *= .6;
    if (Game.time < this.landSlowUntil) s *= .85;
    return s;
  }
  blocked(x, y, z, h) { const r = PHYS.r; return World.overlaps(x - r, y + .002, z - r, x + r, y + h, z + r) || this.playerBlocked(x, y, z, h); }
  playerBlocked() { return false; }
  groundTop(x, z, yFrom, maxDrop) {
    const r = PHYS.r; let top = null;
    World.forOverlaps(x - r, yFrom - maxDrop, z - r, x + r, yFrom + .001, z + r, b => { if (b.y1 <= yFrom + .002 && (top === null || b.y1 > top)) top = b.y1; });
    return top;
  }
  simulate(dt, cmd) {
    const P = PHYS, p = this.pos, v = this.vel;
    // --- crouch ---
    if (cmd.duck && !this.ducked) {
      if (!this.onGround && !this.blocked(p.x, p.y + P.duckLift, p.z, P.hDuck)) { p.y += P.duckLift; this.eyeOff -= P.duckLift; }
      this.ducked = true;
    } else if (!cmd.duck && this.ducked) {
      if (this.onGround) { if (!this.blocked(p.x, p.y, p.z, P.hStand)) this.ducked = false; }
      else if (!this.blocked(p.x, p.y - P.duckLift, p.z, P.hStand) && !World.overlaps(p.x - P.r, p.y - P.duckLift, p.z - P.r, p.x + P.r, p.y, p.z + P.r)) { p.y -= P.duckLift; this.eyeOff += P.duckLift; this.ducked = false; }
      else if (!this.blocked(p.x, p.y, p.z, P.hStand)) this.ducked = false;
    }
    const eyeT = this.ducked ? P.eyeDuck : P.eyeStand;
    this.eyeOff += clamp(eyeT - this.eyeOff, -dt * 3.4, dt * 3.4);
    // --- wish direction ---
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * cmd.fwd + rx * cmd.side, wz = fz * cmd.fwd + rz * cmd.side;
    const wl = Math.hypot(wx, wz); if (wl > 1e-4) { wx /= wl; wz /= wl; }
    let wish = wl > 1e-4 ? this.maxSpeed(cmd) : 0;
    if (this.planting || this.defusing || Game.frozen(this)) wish = 0;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.onGround) {
      if (this.jumpBuf > 0 && !Game.frozen(this) && !this.planting && !this.defusing) {
        this.jumpBuf = 0; v.y = P.jumpV; this.onGround = false;
        Game.noise(this, 'jump');
      } else {
        const sp = Math.hypot(v.x, v.z);
        if (sp > 1e-3) { const ctl = Math.max(sp, P.stop), drop = ctl * P.fric * dt, ns = Math.max(sp - drop, 0) / sp; v.x *= ns; v.z *= ns; } else { v.x = v.z = 0; }
      }
      if (this.onGround) this.accel(wx, wz, wish, P.accel, dt);
      else this.airAccel(wx, wz, wish, dt);
    } else this.airAccel(wx, wz, wish, dt);
    // --- move ---
    const ox = p.x, oz = p.z;
    this.moveH(v.x * dt, v.z * dt);
    if (Math.abs((p.x - ox) - v.x * dt) > 1e-4) v.x = 0;
    if (Math.abs((p.z - oz) - v.z * dt) > 1e-4) v.z = 0;
    const r = P.r, h = this.hull();
    if (!this.onGround) {
      v.y -= P.grav * dt;
      const py = p.y; p.y += v.y * dt;
      let land = null, ceil = null;
      World.forOverlaps(p.x - r, p.y, p.z - r, p.x + r, p.y + h, p.z + r, b => {
        if (v.y <= 0) { if (b.y1 <= py + P.step + .01 && (land === null || b.y1 > land)) land = b.y1; }
        else if (ceil === null || b.y0 < ceil) ceil = b.y0;
      });
      if (land !== null) { const fall = -v.y; p.y = land; v.y = 0; this.onGround = true; this.landed(fall); }
      else if (ceil !== null) { p.y = ceil - h - 1e-3; v.y = 0; }
      if (p.y < -30) { p.y = 5; Game.damage(this, 1000, null, 'world', { hg: 'body' }); }
    } else {
      const g = this.groundTop(p.x, p.z, p.y + .002, P.step + .06);
      if (g === null) { this.onGround = false; v.y = 0; } else p.y = g;
    }
    // footsteps (running only; walking and crouching are silent)
    const sp2 = Math.hypot(v.x, v.z);
    if (this.onGround && sp2 > 3.45 && !this.ducked) {
      this.stepDist += sp2 * dt;
      if (this.stepDist > 1.85) { this.stepDist = 0; Game.footstep(this); }
    }
  }
  accel(wx, wz, wish, a, dt) {
    const v = this.vel, cur = v.x * wx + v.z * wz, add = wish - cur; if (add <= 0) return;
    const acc = Math.min(a * dt * wish, add); v.x += acc * wx; v.z += acc * wz;
  }
  airAccel(wx, wz, wish, dt) {
    const v = this.vel, ws = Math.min(wish, PHYS.airCap), cur = v.x * wx + v.z * wz, add = ws - cur; if (add <= 0) return;
    const acc = Math.min(PHYS.airAccel * wish * dt, add); v.x += acc * wx; v.z += acc * wz;
  }
  // horizontal move with collision and stair stepping
  moveH(dx, dz) {
    if (!dx && !dz) return;
    const p = this.pos, r = PHYS.r, h = this.hull();
    const axis = (ax, d) => {
      if (!d) return false;
      if (ax === 0) p.x += d; else p.z += d;
      let hit = false;
      World.forOverlaps(p.x - r, p.y + .002, p.z - r, p.x + r, p.y + h, p.z + r, b => {
        hit = true;
        if (ax === 0) p.x = d > 0 ? Math.min(p.x, b.x0 - r - 1e-4) : Math.max(p.x, b.x1 + r + 1e-4);
        else p.z = d > 0 ? Math.min(p.z, b.z0 - r - 1e-4) : Math.max(p.z, b.z1 + r + 1e-4);
      });
      return hit;
    };
    const ox = p.x, oy = p.y, oz = p.z;
    const hx = axis(0, dx), hz = axis(1, dz);
    if ((hx || hz) && this.onGround) {
      const fx = p.x, fz = p.z, S = PHYS.step;
      p.set(ox, oy, oz);
      if (!World.overlaps(p.x - r, p.y + S, p.z - r, p.x + r, p.y + S + h, p.z + r)) {
        p.y += S; axis(0, dx); axis(1, dz);
        const g = this.groundTop(p.x, p.z, p.y + .002, S + .01);
        const gainStep = Math.hypot(p.x - ox, p.z - oz), gainFlat = Math.hypot(fx - ox, fz - oz);
        if (g !== null && g <= oy + S + .002 && gainStep > gainFlat + 1e-4) { p.y = g; if (this.isLocal && g - oy > .05) Game.stepSmooth(g - oy); }
        else p.set(fx, oy, fz);
      } else p.set(fx, oy, fz);
    }
  }
  landed(fall) {
    if (fall > 14.7) { const dmg = Math.round((fall - 14.7) * 9); if (dmg > 0) Game.damage(this, dmg, null, 'fall', { hg: 'body' }); }
    if (fall > 5) { this.landSlowUntil = Game.time + .25; Game.footstep(this, true); if (this.isLocal) Game.landKick(fall); }
  }

  /* ---------- weapons ---------- */
  spread() {
    const w = this.active; if (!w || !w.def.sp) return 0;
    const d = w.def, sp = d.sp;
    let base = (this.ducked && this.onGround) ? sp[1] : sp[0];
    if (d.scope && this.zoom > 0 && d.scopedSpread != null) base = d.scopedSpread;
    if (w.burst && d.id === 'famas') base *= .7;
    const sp2 = Math.hypot(this.vel.x, this.vel.z), maxS = d.speed, accS = maxS * .34;
    const mv = sp2 > accS ? clamp((sp2 - accS) / (maxS - accS), 0, 1) : 0;
    let s = base + mv * sp[2];
    if (!this.onGround) s = Math.max(s, sp[3] * (d.id === 'ssg08' && Math.abs(this.vel.y) < 1.2 ? .15 : 1));
    if (this.revFan) s += 1.5;
    return s + this.spreadAcc;
  }
  cancelPlant() { if (this.planting) { this.planting = false; Game.onPlantCancel(this); } }
  // called every sim step with current command
  updateWeapon(dt, cmd) {
    const now = Game.time, w = this.active;
    // recoil recovery
    if (w && w.def.pattern) {
      const idle = now - this.lastShot;
      if (idle > w.def.interval * 1.3 + .02) this.recoilIdx = Math.max(0, this.recoilIdx - dt * w.def.rc.rec);
      const pat = w.def.pattern, fi = Math.min(this.recoilIdx, pat.length - 1), i0 = Math.floor(fi), i1 = Math.min(i0 + 1, pat.length - 1), t = fi - i0;
      const tx = lerp(pat[i0][0], pat[i1][0], t), ty = lerp(pat[i0][1], pat[i1][1], t);
      const k = 1 - Math.exp(-dt * 30);
      this.punchX += (tx - this.punchX) * k; this.punchY += (ty - this.punchY) * k;
      this.spreadAcc = Math.max(0, this.spreadAcc - w.def.sp[5] * dt);
    } else { this.punchX *= .8; this.punchY *= .8; }
    this.flinchX *= Math.exp(-dt * 10); this.flinchY *= Math.exp(-dt * 10);
    if (!w || !this.alive) return;
    const d = w.def;
    // finish reload
    if (this.reloadEnd && now >= this.reloadEnd) this.finishReload();
    if (this.rezoom && now >= this.rezoomAt) { if (w.def.scope && !this.reloadEnd && w.clip > 0) this.zoom = this.rezoom; this.rezoom = 0; }
    if (Game.frozen(this)) { if (cmd.reload) this.startReload(); return; }
    if (this.silencerEnd && now < this.silencerEnd) return; else this.silencerEnd = 0;
    // inspect
    if (cmd.inspect && !this.reloadEnd && now >= this.drawEnd && d.cat !== 'grenade') { this.inspectStart = now; this.inspectEnd = now + (d.cat === 'knife' ? 2.4 : 2.0); }
    if (cmd.reload) this.startReload();
    const ready = now >= this.drawEnd;
    // C4 planting is handled by the game (hold attack in a site)
    if (d.cat === 'c4') { Game.plantInput(this, cmd.fire && ready); return; }
    if (d.cat === 'grenade') { this.updateNade(cmd, now, ready); return; }
    if (d.cat === 'knife') {
      if (!ready) return;
      if (cmd.fire && now >= this.nextAttack) { Combat.knife(this, false); this.inspectEnd = 0; }
      else if (cmd.fire2 && now >= this.nextAttack) { Combat.knife(this, true); this.inspectEnd = 0; }
      return;
    }
    if (d.cat === 'zeus') {
      if (ready && cmd.fireHit && now >= this.nextAttack && w.clip > 0) { Combat.zeus(this); }
      if (w.clip <= 0 && now >= w.readyAt && w.readyAt) { w.clip = 1; w.readyAt = 0; }
      return;
    }
    // --- guns ---
    // secondary actions
    if (cmd.fire2Hit && ready && !this.reloadEnd) {
      if (d.scope) { this.zoom = (this.zoom + 1) % (d.scope.length + 1); this.rezoom = 0; if (this.isLocal) SFX.play('click', { vol: .35 }); }
      else if (d.sil) { w.silenced = !w.silenced; this.silencerEnd = now + 1.6; this.inspectEnd = 0; if (this.isLocal) SFX.play('mag_in', { vol: .4, when: 1.2 }); return; }
      else if (d.burst) { w.burst = !w.burst; if (this.isLocal) Game.hint(w.burst ? 'Switched to burst-fire mode' : (d.id === 'glock' ? 'Switched to semi-automatic' : 'Switched to automatic'), 1.4); }
    }
    // burst continuation
    if (this.burstLeft > 0 && now >= this.burstNext) {
      if (w.clip > 0) { this.shoot(); this.burstLeft--; this.burstNext = now + (d.id === 'glock' ? .05 : .075); if (!this.burstLeft) this.nextAttack = now + (d.id === 'glock' ? .5 : .45); }
      else this.burstLeft = 0;
      return;
    }
    if (this.reloadEnd) {
      if (d.shellReload && cmd.fireHit && w.clip > 0) { this.reloadEnd = 0; }
      else return;
    }
    if (!ready) return;
    // R8 Revolver: primary fire cocks the hammer for 0.4 s before the shot, secondary fans the hammer (fast, loose)
    if (d.revolver) {
      if (w.clip <= 0) { if (cmd.fireHit || cmd.fire2Hit) { if (this.isLocal) SFX.play('dry', { vol: .6 }); if (w.reserve > 0) this.startReload(); } this.cockStart = 0; return; }
      if (cmd.fire2 && now >= this.nextAttack) { this.cockStart = 0; this.revFan = true; this.shoot(); this.revFan = false; this.nextAttack = now + .4; return; }
      if (cmd.fire) {
        if (!this.cockStart) { this.cockStart = now; if (this.isLocal) SFX.play('click', { vol: .4 }); }
        if (now - this.cockStart >= .4 && now >= this.nextAttack) { this.shoot(); this.cockStart = 0; this.nextAttack = now + .5; }
      } else this.cockStart = 0;
      return;
    }
    const auto = d.auto && !(w.burst);
    const trig = auto ? cmd.fire : cmd.fireHit;
    if (!trig) return;
    if (now < this.nextAttack) return;
    if (w.clip <= 0) {
      if (cmd.fireHit) { if (this.isLocal) SFX.play('dry', { vol: .6 }); this.nextAttack = now + .2; }
      if (w.reserve > 0) this.startReload();
      return;
    }
    if (w.burst) { this.burstLeft = 2; this.burstNext = now + (d.id === 'glock' ? .05 : .075); this.shoot(); this.nextAttack = now + 1; return; }
    this.shoot();
  }
  shoot() {
    const w = this.active, d = w.def, now = Game.time;
    w.clip--; this.nextAttack = Math.max(this.nextAttack, now) + (w.burst ? 0 : d.interval);
    this.lastShot = now; this.fireT = now; this.inspectEnd = 0; this.shotCount = (this.shotCount || 0) + 1;
    this.immuneUntil = 0;
    const spread = this.spread();
    const pat = d.pattern, idx = Math.min(Math.floor(this.recoilIdx), pat.length - 1);
    const px = pat[idx][0], py = pat[idx][1];
    const eye = this.eye(_v1);
    const baseYaw = this.yaw - px * DEG, basePitch = this.pitch + py * DEG;
    Combat.fire(this, w, eye, baseYaw, basePitch, spread);
    this.recoilIdx += 1;
    this.spreadAcc = Math.min(d.sp[6] || 0, this.spreadAcc + (d.sp[4] || 0));
    if (d.bolt && this.zoom > 0) { this.rezoom = this.zoom; this.zoom = 0; this.rezoomAt = now + d.interval * .85; }
    if (w.clip <= 0 && w.reserve > 0 && !this.isLocal) this.startReload();
    if (Game.mode.infiniteAmmo) w.reserve = Math.max(w.reserve, d.res);
  }
  startReload() {
    const w = this.active; if (!w) return; const d = w.def;
    if (!d.mag || d.cat === 'zeus' || w.clip >= d.mag || w.reserve <= 0 || this.reloadEnd || Game.time < this.drawEnd) return;
    const now = Game.time; this.reloadStart = now; this.zoom = 0; this.rezoom = 0; this.inspectEnd = 0; this.burstLeft = 0;
    if (d.shellReload) { this.reloadEnd = now + d.rl + .25; }
    else {
      this.reloadEnd = now + d.rl;
      if (this.isLocal || Game.audible(this.pos, 12)) {
        const o = this.isLocal ? { vol: .55 } : { pos: this.pos, vol: .5, ref: 2 };
        SFX.play('mag_out', o); SFX.play('mag_in', Object.assign({ when: d.rl * .62 }, o));
        if (d.cat === 'rifle' || d.cat === 'smg' || d.cat === 'mg') SFX.play('bolt', Object.assign({ when: d.rl * .85 }, o));
      }
    }
  }
  finishReload() {
    const w = this.active, d = w.def;
    if (d.shellReload) {
      w.clip++; w.reserve--;
      if (this.isLocal || Game.audible(this.pos, 10)) SFX.play('shell_in', this.isLocal ? { vol: .6 } : { pos: this.pos, ref: 2 });
      if (w.clip < d.mag && w.reserve > 0) this.reloadEnd = Game.time + d.rl;
      else { this.reloadEnd = 0; if (d.id === 'nova') SFX.play('pump', this.isLocal ? { vol: .6 } : { pos: this.pos, ref: 2 }); }
    } else {
      const take = Math.min(d.mag - w.clip, w.reserve); w.clip += take; w.reserve -= take; this.reloadEnd = 0; this.recoilIdx = 0;
    }
  }
  updateNade(cmd, now, ready) {
    if (!ready) return;
    if (this.nadeState === 'idle') {
      if (cmd.fire || cmd.fire2) { this.nadeState = 'pull'; this.nadePullT = now; if (this.isLocal) SFX.play('pin', { vol: .5 }); }
    } else if (this.nadeState === 'pull') {
      const strength = cmd.fire && cmd.fire2 ? .6 : cmd.fire ? 1 : cmd.fire2 ? .35 : this.nadeStrength;
      if (cmd.fire || cmd.fire2) this.nadeStrength = strength;
      if (!cmd.fire && !cmd.fire2 && now - this.nadePullT > .25) { this.nadeState = 'throw'; this.nadeThrowT = now; Combat.throwNade(this, this.nadeStrength); }
    } else if (this.nadeState === 'throw' && now - this.nadeThrowT > .45) {
      this.nadeState = 'idle';
    }
  }
}
