/* ===================== combat: bullets, hitboxes, knife, zeus, grenades, dropped items ===================== */
const HB = {
  s: { head: [0, 1.665, -.01, .13], chest: [-.23, 1.17, -.15, .23, 1.53, .15], stomach: [-.2, .9, -.14, .2, 1.17, .14], legs: [-.22, 0, -.16, .22, .9, .16], arms: [-.27, 1.08, -.62, .3, 1.42, -.1] },
  d: { head: [0, 1.22, -.08, .13], chest: [-.23, .8, -.2, .23, 1.1, .1], stomach: [-.2, .56, -.18, .2, .8, .12], legs: [-.25, 0, -.34, .25, .56, .22], arms: [-.27, .72, -.62, .3, 1.02, -.12] }
};
const Combat = {
  _o: new V3(), _d: new V3(), _r: {}, _hp: new V3(),
  // ray vs one player's hitboxes. returns {t, hg} or null
  hitTest(pl, o, d, maxT) {
    const px = pl.pos.x, py = pl.pos.y, pz = pl.pos.z;
    // cheap reject: closest approach to the player's vertical axis
    const wx = px - o.x, wz = pz - o.z, dh = d.x * d.x + d.z * d.z;
    const tc = dh > 1e-8 ? (wx * d.x + wz * d.z) / dh : 0;
    const cx = o.x + d.x * tc - px, cz = o.z + d.z * tc - pz;
    if (cx * cx + cz * cz > 0.8 * 0.8 && dh > .02) return null;
    if (tc < -1) return null;
    const cy = Math.cos(pl.yaw), sy = Math.sin(pl.yaw);
    const lx0 = o.x - px, ly0 = o.y - py, lz0 = o.z - pz;
    const ox = cy * lx0 - sy * lz0, oy = ly0, oz = sy * lx0 + cy * lz0;
    const dx = cy * d.x - sy * d.z, dy = d.y, dz = sy * d.x + cy * d.z;
    const k = pl.duckAmt, S = HB.s, D = HB.d;
    let best = maxT, hg = null;
    // head sphere
    const hx = lerp(S.head[0], D.head[0], k), hy = lerp(S.head[1], D.head[1], k), hz = lerp(S.head[2], D.head[2], k), hr = S.head[3];
    const mx = ox - hx, my = oy - hy, mz = oz - hz, b = mx * dx + my * dy + mz * dz, c = mx * mx + my * my + mz * mz - hr * hr, disc = b * b - c;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < best) { best = t; hg = 'head'; } }
    for (const part of ['chest', 'stomach', 'arms', 'legs']) {
      const a = S[part], e = D[part];
      const x0 = lerp(a[0], e[0], k), y0 = lerp(a[1], e[1], k), z0 = lerp(a[2], e[2], k), x1 = lerp(a[3], e[3], k), y1 = lerp(a[4], e[4], k), z1 = lerp(a[5], e[5], k);
      let t1 = (x0 - ox) / dx, t2 = (x1 - ox) / dx; let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (y0 - oy) / dy; t2 = (y1 - oy) / dy; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (z0 - oz) / dz; t2 = (z1 - oz) / dz; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= tmin && tmax > 0 && tmin < best && tmin > 0) { best = tmin; hg = part; }
    }
    return hg ? { t: best, hg } : null;
  },
  cone(dir, deg, out) {
    if (deg <= 0) return out.copy(dir);
    const a = Math.random() * deg * DEG, ph = Math.random() * TAU;
    const up = Math.abs(dir.y) > .95 ? _v3.set(1, 0, 0) : _v3.set(0, 1, 0);
    const r = _v4.crossVectors(dir, up).normalize(); const u = up.crossVectors(r, dir).normalize();
    const ta = Math.tan(a);
    return out.copy(dir).addScaledVector(r, Math.cos(ph) * ta).addScaledVector(u, Math.sin(ph) * ta).normalize();
  },
  // trace one bullet; returns {hits:[{pl,hg,dmg,pen,smoke,p}], imps:[{p,n,kind}], end}
  trace(shooter, o, dir, d) {
    const hits = [], imps = []; const pos = o.clone(); let dmg = d.dmg, traveled = 0, pens = 0, penetrated = false, smoked = false;
    const R = this._r, MAX = 210;
    for (let guard = 0; guard < 4; guard++) {
      const tw = World.raycast(pos.x, pos.y, pos.z, dir.x, dir.y, dir.z, MAX - traveled, R);
      let bp = null, bt = tw === Infinity ? MAX - traveled : tw, bh = null;
      for (const pl of Game.players) {
        if (!pl.alive || pl === shooter) continue;
        const r = this.hitTest(pl, pos, dir, bt);
        if (r && r.t < bt) { bt = r.t; bp = pl; bh = r.hg; }
      }
      if (!smoked && Game.smokeOnSegment(pos, dir, bt)) smoked = true;
      if (bp) {
        const dist = traveled + bt, p = pos.clone().addScaledVector(dir, bt);
        hits.push({ pl: bp, hg: bh, dmg: dmg * Math.pow(d.rm || 1, dist / (500 * U)), pen: penetrated, smoke: smoked, p });
        return { hits, imps, end: p };
      }
      if (tw === Infinity) return { hits, imps, end: pos.clone().addScaledVector(dir, MAX - traveled) };
      const hp = pos.clone().addScaledVector(dir, tw), box = R.box;
      imps.push({ p: hp, n: new V3(R.nx, R.ny, R.nz), kind: World.matKind(box.mat) });
      if (pens < 2 && d.pen && box.pen) {
        const th = World.rayExit(box, hp.x, hp.y, hp.z, dir.x, dir.y, dir.z);
        if (th < d.pen) {
          dmg *= (1 - th / d.pen) * .8; pens++; penetrated = true; traveled += tw + th;
          pos.copy(hp).addScaledVector(dir, th + .01);
          imps.push({ p: pos.clone(), n: dir.clone(), kind: World.matKind(box.mat), exit: true });
          if (dmg < 1) return { hits, imps, end: pos.clone() };
          continue;
        }
      }
      return { hits, imps, end: hp };
    }
    return { hits, imps, end: pos.clone() };
  },
  fire(shooter, w, eye, yaw, pitch, spread) {
    const d = w.def, pellets = d.pellets || 1, base = dirFromAngles(yaw, pitch, this._d.clone());
    const ends = [], allImps = [], hitsNet = [];
    const dir = new V3();
    const noscope = d.cat === 'sniper' && shooter.zoom === 0, blind = Game.time < shooter.flashEnd - shooter.flashDur * .5;
    for (let k = 0; k < pellets; k++) {
      if (pellets > 1) { this.cone(base, d.pSpread * Math.sqrt(Math.random()), dir); this.cone(dir, spread, dir); }
      else this.cone(base, spread, dir);
      const r = this.trace(shooter, eye, dir, d);
      ends.push(r.end);
      for (const im of r.imps) allImps.push(im);
      for (const h of r.hits) {
        const info = { hg: h.hg, ap: d.ap, pen: h.pen, smoke: h.smoke, noscope, blind, dir: dir.clone(), type: 'bullet', p: h.p };
        if (Net.role === 'client') { if (shooter.isLocal) hitsNet.push([h.pl.id, h.hg, +h.dmg.toFixed(2), h.pen ? 1 : 0, h.smoke ? 1 : 0, noscope ? 1 : 0, blind ? 1 : 0, +h.p.x.toFixed(2), +h.p.y.toFixed(2), +h.p.z.toFixed(2)]); }
        else Game.damage(h.pl, h.dmg, shooter, w.id, info);
        this.bloodFx(h.p, dir, h.hg === 'head');
      }
    }
    this.shotFx(shooter, w, eye, ends, allImps, true);
    Game.noise(shooter, w.silenced ? 'silenced' : 'shot');
    if (Net.role === 'client' && shooter.isLocal) Net.sendShot(w, eye, ends, allImps, hitsNet);
    else if (Net.role === 'host') Net.broadcastShot(shooter, w, eye, ends, allImps);
  },
  bloodFx(p, dir, head) { FX.blood(p, dir, head); },
  // sounds, muzzle flash, tracers and impacts (also used to replay remote shots)
  shotFx(shooter, w, eye, ends, imps, local) {
    const d = w.def, me = shooter.isLocal && !App.spectating;
    const snd = w.silenced ? 'g_sil' : d.snd;
    if (me) SFX.play(snd, { vol: w.silenced ? .7 : 1 });
    else SFX.play(snd, { pos: eye, vol: w.silenced ? .55 : 1.1, ref: w.silenced ? 3 : 8, roll: w.silenced ? 1.6 : .9, occ: !Game.hearClear(eye) });
    const mz = me ? null : Game.muzzlePos(shooter);
    if (!me && !w.silenced) FX.muzzle(mz || eye, dirFromAngles(shooter.yaw, shooter.pitch, _v2), d.cat === 'sniper' || d.cat === 'shotgun');
    const from = me ? Game.vmMuzzleWorld() : (mz || eye);
    for (let i = 0; i < ends.length; i++) {
      if (d.pellets && i % 3) continue;
      if (me && (shooter._tr = (shooter._tr || 0) + 1) % 2) continue;
      if (!w.silenced || !me) FX.tracer(from, ends[i], 300);
    }
    for (const im of imps) {
      FX.impact(im.p, im.n, im.kind);
      if (!im.exit && Math.random() < .5) SFX.play(im.kind === 'metal' ? 'imp_metal' : im.kind === 'wood' ? 'imp_wood' : im.kind === 'sand' ? 'imp_sand' : 'imp_hard', { pos: im.p, vol: .5, ref: 3 });
      if (im.kind !== 'sand' && Math.random() < .06) SFX.play('ricochet', { pos: im.p, vol: .5, ref: 3 });
    }
    // bullets that pass close to the local player's head make a whiz
    const lp = Game.viewPlayer(); if (lp && lp !== shooter && lp.alive) {
      const e = lp.eye(_v3); for (const en of ends) { const ab = _v4.subVectors(en, eye), L = ab.length(); if (L < 2) continue; ab.divideScalar(L); const t = clamp((e.x - eye.x) * ab.x + (e.y - eye.y) * ab.y + (e.z - eye.z) * ab.z, 0, L); const cxp = eye.x + ab.x * t - e.x, cyp = eye.y + ab.y * t - e.y, czp = eye.z + ab.z * t - e.z; if (cxp * cxp + cyp * cyp + czp * czp < 1.2 && t < L - .5) { SFX.play('whiz', { pos: new V3(eye.x + ab.x * t, eye.y + ab.y * t, eye.z + ab.z * t), vol: .6, ref: 1 }); break; } }
    }
    if (me && d.cat !== 'shotgun') FX.shell(Game.vmEjectWorld(), _v1.set(0, 1.5, 0).addScaledVector(dirFromAngles(shooter.yaw - Math.PI / 2, 0, _v2), 1.8), true);
  },
  knife(p, heavy) {
    const now = Game.time;
    const eye = p.eye(), base = p.aimDir();
    const range = heavy ? 1.3 : 1.6;
    let best = null, bt = range, bh = null;
    const dir = new V3();
    for (let k = 0; k < 7; k++) {
      if (k === 0) dir.copy(base); else { const a = (k - 1) / 6 * TAU; dir.copy(base).addScaledVector(_v2.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw)), Math.cos(a) * .12); dir.y += Math.sin(a) * .1; dir.normalize(); }
      for (const pl of Game.players) {
        if (!pl.alive || pl === p) continue;
        const r = this.hitTest(pl, eye, dir, bt);
        if (r && r.t < bt) { bt = r.t; best = pl; bh = r.hg; }
      }
    }
    const tw = World.raycast(eye.x, eye.y, eye.z, base.x, base.y, base.z, range, this._r);
    p.swingT = now; p.swingHeavy = heavy; p.slashAlt = !p.slashAlt;
    if (best) {
      // backstab: attacker is behind the victim
      const fx = -Math.sin(best.yaw), fz = -Math.cos(best.yaw), tx = p.pos.x - best.pos.x, tz = p.pos.z - best.pos.z, L = Math.hypot(tx, tz) || 1;
      const back = (fx * tx + fz * tz) / L < -.3;
      const quick = now - (p.lastSlash || -9) < 1.2 && !heavy;
      const dmg = heavy ? (back ? 180 : 65) : (back ? 90 : quick ? 25 : 40);
      p.lastSlash = now;
      p.nextAttack = now + (heavy ? 1.0 : .5);
      const hp = eye.clone().addScaledVector(base, bt);
      SFX.play('stab', { pos: hp, vol: .9, ref: 3 });
      this.bloodFx(hp, base, back);
      if (Net.role === 'client') { if (p.isLocal) Net.send({ t: 'knife', v: best.id, dmg, hg: bh }); }
      else Game.damage(best, dmg, p, 'knife', { hg: 'chest', ap: .85, type: 'knife', dir: base.clone(), p: hp, raw: true });
    } else if (tw < range) {
      p.nextAttack = now + (heavy ? 1.0 : .4);
      const hp = eye.clone().addScaledVector(base, tw);
      SFX.play('knife_wall', { pos: hp, vol: .7, ref: 3 }); FX.spark(hp); FX.holes.add(hp, new V3(this._r.nx, this._r.ny, this._r.nz), .05);
    } else { p.nextAttack = now + (heavy ? 1.0 : .4); }
    SFX.play('slash', p.isLocal ? { vol: .6 } : { pos: eye, vol: .6, ref: 3 });
    if (Net.role === 'host') Net.broadcastFx({ t: 'swing', id: p.id, h: heavy ? 1 : 0 });
  },
  zeus(p) {
    const now = Game.time, w = p.active; w.clip = 0; w.readyAt = now + W.zeus.recharge; p.nextAttack = now + 1; p.fireT = now;
    const eye = p.eye(), dir = p.aimDir(); let best = null, bt = W.zeus.range;
    for (const pl of Game.players) { if (!pl.alive || pl === p) continue; const r = this.hitTest(pl, eye, dir, bt); if (r && r.t < bt) { bt = r.t; best = pl; } }
    const tw = World.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, bt, null);
    if (tw < bt) best = null;
    SFX.play('zeus', p.isLocal ? { vol: .8 } : { pos: eye, ref: 4 });
    const end = eye.clone().addScaledVector(dir, best ? bt : Math.min(tw, W.zeus.range));
    FX.tracer(eye, end, 200); FX.spark(end);
    if (best) {
      if (Net.role === 'client') { if (p.isLocal) Net.send({ t: 'zeus', v: best.id }); }
      else Game.damage(best, 500, p, 'zeus', { hg: 'chest', ap: 1, type: 'zeus', dir, raw: true });
    }
  },
  throwNade(p, strength) {
    const inst = p.active; if (!inst || inst.def.cat !== 'grenade') return;
    const eye = p.eye();
    // CS throws a little above the crosshair
    let pitch = p.pitch; pitch = pitch + (Math.PI / 2 - Math.abs(pitch)) * .12;
    const dir = dirFromAngles(p.yaw, pitch);
    const speed = 750 * U * clamp(strength * .7 + .3, 0, 1);
    const pos = eye.clone().addScaledVector(dir, .25);
    const vel = dir.multiplyScalar(speed).addScaledVector(p.vel, 1.25);
    if (Net.role === 'client') Net.send({ t: 'nade', w: inst.id, o: [pos.x, pos.y, pos.z], v: [vel.x, vel.y, vel.z] });
    else Grenades.spawn(inst.id, pos, vel, p);
    SFX.play('throw', p.isLocal ? { vol: .5 } : { pos: eye, ref: 3 });
    p.removeWeapon(inst);
    if (Net.role === 'host') Net.broadcastFx({ t: 'throw', id: p.id });
  }
};

/* ---------- grenades in flight ---------- */
const Grenades = {
  list: [], nid: 1, g: 800 * U * .4,
  spawn(id, pos, vel, owner) {
    const def = W[id];
    const n = { id: this.nid++, wid: id, type: def.gtype, pos: pos.clone(), vel: vel.clone(), owner, team: owner ? owner.team : null, t: 0, still: 0, mesh: null, done: false };
    n.mesh = Models.gun(id, 'default', owner ? owner.team : 'T'); n.mesh.scale.setScalar(1.2);
    App.scene.add(n.mesh); n.mesh.position.copy(pos);
    this.list.push(n);
    return n;
  },
  clear() { for (const n of this.list) App.scene.remove(n.mesh); this.list = []; },
  update(dt) {
    const R = {};
    for (const n of this.list) {
      n.t += dt;
      if (!n.still) {
        n.vel.y -= this.g * dt;
        const sp = n.vel.length(), step = sp * dt;
        if (step > 1e-5) {
          const dx = n.vel.x / sp, dy = n.vel.y / sp, dz = n.vel.z / sp;
          const t = World.raycast(n.pos.x, n.pos.y, n.pos.z, dx, dy, dz, step + .06, R);
          if (t < step + .06) {
            n.pos.x += dx * Math.max(0, t - .06); n.pos.y += dy * Math.max(0, t - .06); n.pos.z += dz * Math.max(0, t - .06);
            const vn = n.vel.x * R.nx + n.vel.y * R.ny + n.vel.z * R.nz;
            n.vel.x -= 1.45 * vn * R.nx; n.vel.y -= 1.45 * vn * R.ny; n.vel.z -= 1.45 * vn * R.nz;
            if (R.ny > .7) { n.vel.x *= .7; n.vel.z *= .7; }
            if (sp > 1.5) SFX.play('bounce', { pos: n.pos, vol: clamp(sp / 12, .15, .8), ref: 3 });
            if (n.type === 'fire' && R.ny > .7) { this.detonate(n); continue; }
            if (R.ny > .7 && Math.abs(n.vel.y) < .6 && Math.hypot(n.vel.x, n.vel.z) < .25) { n.still = 1; n.vel.set(0, 0, 0); }
          } else { n.pos.x += n.vel.x * dt; n.pos.y += n.vel.y * dt; n.pos.z += n.vel.z * dt; }
        }
        // rolling friction when resting on the ground
        const below = World.raycast(n.pos.x, n.pos.y, n.pos.z, 0, -1, 0, .08, null);
        if (below < .08 && Math.abs(n.vel.y) < .6) { n.vel.x *= Math.max(0, 1 - 3 * dt); n.vel.z *= Math.max(0, 1 - 3 * dt); if (Math.hypot(n.vel.x, n.vel.z) < .15) { n.still = 1; n.vel.set(0, 0, 0); } }
        n.mesh.rotation.x += dt * 9; n.mesh.rotation.z += dt * 5;
      } else n.still += dt;
      n.mesh.position.copy(n.pos);
      if (n.type === 'he' || n.type === 'flash') { if (n.t > 1.6) this.detonate(n); }
      else if (n.type === 'smoke') { if ((n.still > .3) || n.t > 5) this.detonate(n); }
      else if (n.type === 'fire') { if (n.t > 2.0) this.detonate(n); }
      else if (n.type === 'decoy') { if (n.still > .3 && !n.decoyEnd) { n.decoyEnd = n.t + 15; n.nextPop = n.t + .2; } if (n.decoyEnd) { if (n.t >= n.nextPop) { n.nextPop = n.t + .25 + Math.random() * 1.1; SFX.play(n.owner && n.owner.primary ? n.owner.primary.def.snd || 'g_rifle' : 'g_pistol', { pos: n.pos, ref: 8, vol: 1 }); Game.noise({ pos: n.pos, team: n.team, id: -1, decoy: true }, 'shot'); } if (n.t > n.decoyEnd) this.detonate(n); } }
    }
    if (this.list.some(n => n.done)) this.list = this.list.filter(n => { if (n.done) App.scene.remove(n.mesh); return !n.done; });
  },
  detonate(n) {
    if (n.done) return; n.done = true;
    const p = n.pos.clone();
    if (Net.role !== 'client') Game.detonate(n.type, p, n.owner, n.wid);
  }
};

/* ---------- dropped weapons on the ground ---------- */
const Items = {
  list: [], nid: 1,
  drop(inst, pos, vel, yaw) {
    const it = { id: this.nid++, inst, pos: pos.clone(), vel: vel ? vel.clone() : new V3(), yaw: yaw || 0, t: 0, rest: false, mesh: null, by: null };
    it.mesh = Models.gun(inst.id, inst.skin, 'T', inst.knifeType);
    it.mesh.rotation.set(0, it.yaw, Math.PI / 2);
    App.scene.add(it.mesh); it.mesh.position.copy(pos);
    this.list.push(it);
    return it;
  },
  remove(it) { App.scene.remove(it.mesh); this.list = this.list.filter(x => x !== it); },
  clear() { for (const it of this.list) App.scene.remove(it.mesh); this.list = []; },
  update(dt) {
    for (const it of this.list) {
      it.t += dt;
      if (!it.rest) {
        it.vel.y -= 9.8 * dt;
        const g = World.groundBelow(it.pos.x, it.pos.y + .05, it.pos.z);
        it.pos.addScaledVector(it.vel, dt);
        // keep inside the level
        if (World.overlaps(it.pos.x - .05, it.pos.y + .05, it.pos.z - .05, it.pos.x + .05, it.pos.y + .1, it.pos.z + .05)) { it.pos.x -= it.vel.x * dt; it.pos.z -= it.vel.z * dt; it.vel.x = it.vel.z = 0; }
        if (it.pos.y <= g + .03) { it.pos.y = g + .03; it.vel.set(0, 0, 0); it.rest = true; }
        it.mesh.position.copy(it.pos);
      }
    }
  }
};
