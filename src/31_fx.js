/* ===================== effects ===================== */
class Particles {
  constructor(scene, max, tex, additive) {
    this.max = max; this.n = 0;
    this.px = new Float32Array(max); this.py = new Float32Array(max); this.pz = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.age = new Float32Array(max); this.size = new Float32Array(max); this.grow = new Float32Array(max);
    this.cr = new Float32Array(max); this.cg = new Float32Array(max); this.cb = new Float32Array(max); this.a0 = new Float32Array(max);
    this.rot = new Float32Array(max); this.rv = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max); this.fin = new Float32Array(max); this.fout = new Float32Array(max); this.smax = new Float32Array(max);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.aCol.setUsage(THREE.DynamicDrawUsage);
    this.aSR = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2); this.aSR.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iCol', this.aCol); g.setAttribute('iSR', this.aSR);
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 } },
      vertexShader: `attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSR; varying vec2 vUv; varying vec4 vCol; varying float vFog;
        void main(){ vec4 mv = modelViewMatrix * vec4(iPos,1.0); float c=cos(iSR.y), s=sin(iSR.y);
        vec2 p = vec2(position.x*c-position.y*s, position.x*s+position.y*c)*iSR.x; mv.xy += p; vFog = -mv.z;
        gl_Position = projectionMatrix * mv; vUv = uv; vCol = iCol; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear, fogFar; varying vec2 vUv; varying vec4 vCol; varying float vFog;
        void main(){ vec4 t = texture2D(map, vUv); vec4 c = vec4(vCol.rgb*t.rgb, vCol.a*t.a); if(c.a<0.004) discard;
        float f = smoothstep(fogNear, fogFar, vFog); ${additive ? 'c.rgb *= (1.0-f);' : 'c.rgb = mix(c.rgb, fogColor, f);'}
        gl_FragColor = c;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.mat = m;
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
    scene.add(this.mesh);
  }
  spawn(o) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z;
    this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
    this.life[i] = o.life || 1; this.age[i] = 0; this.size[i] = o.size || .3; this.grow[i] = o.grow || 0;
    this.cr[i] = o.r == null ? 1 : o.r; this.cg[i] = o.g == null ? 1 : o.g; this.cb[i] = o.b == null ? 1 : o.b; this.a0[i] = o.a == null ? 1 : o.a;
    this.rot[i] = o.rot == null ? Math.random() * TAU : o.rot; this.rv[i] = o.rv || 0; this.drag[i] = o.drag == null ? 0 : o.drag; this.grav[i] = o.grav || 0;
    this.fin[i] = o.fin || .15; // fraction of life used to fade in
    this.fout[i] = o.fout || (1 - this.fin[i]); this.smax[i] = o.smax || 1e9;
  }
  update(dt, fog) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { n--; this.copy(n, i); i--; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d - this.grav[i] * dt; this.vz[i] *= d;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      this.size[i] = Math.min(this.smax[i], this.size[i] + this.grow[i] * dt); this.rot[i] += this.rv[i] * dt;
    }
    this.n = n;
    const P = this.aPos.array, C = this.aCol.array, S = this.aSR.array;
    for (let i = 0; i < n; i++) {
      const t = this.age[i] / this.life[i], fi = this.fin[i], fo = this.fout[i];
      const a = this.a0[i] * (t < fi ? t / fi : t > 1 - fo ? (1 - t) / fo : 1);
      P[i * 3] = this.px[i]; P[i * 3 + 1] = this.py[i]; P[i * 3 + 2] = this.pz[i];
      C[i * 4] = this.cr[i]; C[i * 4 + 1] = this.cg[i]; C[i * 4 + 2] = this.cb[i]; C[i * 4 + 3] = a;
      S[i * 2] = this.size[i]; S[i * 2 + 1] = this.rot[i];
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSR.needsUpdate = true;
    this.mesh.geometry.instanceCount = n;
    if (fog) { this.mat.uniforms.fogColor.value.copy(fog.color); this.mat.uniforms.fogNear.value = fog.near; this.mat.uniforms.fogFar.value = fog.far; }
  }
  copy(from, to) {
    for (const k of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'age', 'size', 'grow', 'cr', 'cg', 'cb', 'a0', 'rot', 'rv', 'drag', 'grav', 'fin', 'fout', 'smax']) this[k][to] = this[k][from];
  }
  clear() { this.n = 0; this.mesh.geometry.instanceCount = 0; }
}

class DecalPool {
  constructor(scene, max, tex, opacity) {
    this.max = max; this.i = 0; this.count = 0;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity: opacity || 1 });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m, max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._s = new V3(); this._z = new V3(0, 0, 1); this._n = new V3(); this._p = new V3();
  }
  add(p, n, size) {
    this._n.set(n.x, n.y, n.z).normalize();
    this._q.setFromUnitVectors(this._z, this._n);
    this._q2.setFromAxisAngle(this._z, Math.random() * TAU); this._q.multiply(this._q2);
    this._p.set(p.x + n.x * .006, p.y + n.y * .006, p.z + n.z * .006);
    this._s.set(size, size, size);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(this.i, this._m);
    this.i = (this.i + 1) % this.max; this.count = Math.min(this.max, this.count + 1);
    this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.i = 0; this.count = 0; this.mesh.count = 0; }
}

const FX = {
  scene: null, shake: 0, tracers: [], lights: [], shells: [], smokes: new Map(), fires: new Map(),
  init(scene) {
    this.scene = scene;
    const S = Tex.sprites;
    this.pAdd = new Particles(scene, 1400, S.glow, true);
    this.pSmoke = new Particles(scene, 1600, S.puff, false);
    this.pFlash = new Particles(scene, 64, S.flash, true);
    this.holes = new DecalPool(scene, 220, S.hole, .95);
    this.scorch = new DecalPool(scene, 24, S.scorch, .9);
    this.bloodD = new DecalPool(scene, 60, S.blood, .85);
    const tg = new THREE.CylinderGeometry(.006, .006, 1, 5, 1, true); tg.translate(0, .5, 0);
    const tm = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(tg, tm.clone()); m.visible = false; m.frustumCulled = false; scene.add(m); this.tracers.push({ m, t: 0, life: 0, from: new V3(), dir: new V3(), len: 0, speed: 0 }); }
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffaa55, 0, 12, 2); l.castShadow = false; scene.add(l); this.lights.push({ l, t: 0, dur: 1, peak: 0 }); }
    const sg = new THREE.CylinderGeometry(.0045, .0045, .022, 6); const sm = new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: .9, roughness: .3 });
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sg, sm); m.visible = false; scene.add(m); this.shells.push({ m, v: new V3(), t: 0, floor: 0, snd: false }); }
    this._tq = new V3(0, 1, 0);
  },
  update(dt, cam, fog) {
    this.pAdd.update(dt, fog); this.pSmoke.update(dt, fog); this.pFlash.update(dt, fog);
    for (const tr of this.tracers) {
      if (!tr.m.visible) continue;
      tr.t += dt;
      const head = tr.t * tr.speed, tail = Math.max(0, head - 4);
      if (tail >= tr.len) { tr.m.visible = false; continue; }
      const h = Math.min(head, tr.len);
      tr.m.position.copy(tr.from).addScaledVector(tr.dir, tail);
      tr.m.scale.set(1, Math.max(.01, h - tail), 1);
    }
    for (const L of this.lights) { if (L.t < L.dur) { L.t += dt; L.l.intensity = L.peak * Math.max(0, 1 - L.t / L.dur) * (L.flicker ? .7 + Math.random() * .3 : 1); } else L.l.intensity = 0; }
    for (const s of this.shells) {
      if (!s.m.visible) continue;
      s.t += dt; s.v.y -= 9.8 * dt;
      s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 20; s.m.rotation.z += dt * 13;
      if (s.m.position.y < s.floor + .005) { s.m.position.y = s.floor + .005; s.v.y *= -.3; s.v.x *= .5; s.v.z *= .5; if (!s.snd) { s.snd = true; if (s.local) SFX.play('shell', { pos: s.m.position, vol: .35, ref: 2 }); } }
      if (s.t > 1.6) s.m.visible = false;
    }
    // smoke clouds keep churning
    for (const [id, sm] of this.smokes) {
      sm.t += dt;
      if (!sm.made) {
        sm.made = true;
        for (let k = 0; k < 46; k++) {
          const a = Math.random() * TAU, r = Math.pow(Math.random(), .6) * sm.r, h = Math.pow(Math.random(), .8);
          const ox = Math.cos(a) * r, oz = Math.sin(a) * r, oy = .5 + h * sm.h;
          const g = .66 + Math.random() * .12;
          this.pSmoke.spawn({ x: sm.p.x, y: sm.p.y + .4, z: sm.p.z, vx: ox * 3, vy: (oy - .4) * 3, vz: oz * 3, drag: 3, size: 1.2, grow: 4, smax: 3.6 + Math.random() * 1.8, life: sm.dur + Math.random() * 1.5, r: g, g: g, b: g * 1.03, a: .96, rv: (Math.random() - .5) * .15, fin: .03, fout: .12 });
        }
      }
      if (sm.t < sm.dur - 2) {
        sm.acc += dt;
        while (sm.acc > .35) {
          sm.acc -= .35;
          const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * sm.r;
          const g = .68 + Math.random() * .1;
          this.pSmoke.spawn({ x: sm.p.x + Math.cos(a) * r, y: sm.p.y + .5 + Math.random() * sm.h, z: sm.p.z + Math.sin(a) * r, vx: (Math.random() - .5) * .25, vy: .08, vz: (Math.random() - .5) * .25, size: 3, grow: .2, life: 4 + Math.random() * 2, r: g, g: g, b: g * 1.03, a: .85, rv: (Math.random() - .5) * .2, fin: .25, fout: .4 });
        }
      }
      if (sm.t > sm.dur + 6) this.smokes.delete(id);
    }
    for (const [id, f] of this.fires) {
      f.t += dt;
      if (f.t > f.dur) { this.fires.delete(id); continue; }
      f.acc += dt;
      while (f.acc > 1 / 70) {
        f.acc -= 1 / 70;
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * f.r;
        this.pAdd.spawn({ x: f.p.x + Math.cos(a) * r, y: f.p.y + .05, z: f.p.z + Math.sin(a) * r, vy: 1.4 + Math.random() * 1.4, size: .5 + Math.random() * .6, grow: -.3, life: .5 + Math.random() * .4, r: 1, g: .45 + Math.random() * .25, b: .12, a: .9, fin: .1 });
        if (Math.random() < .15) this.pSmoke.spawn({ x: f.p.x + Math.cos(a) * r, y: f.p.y + 1, z: f.p.z + Math.sin(a) * r, vy: 1.2, size: 1, grow: 1, life: 2, r: .15, g: .14, b: .13, a: .5 });
      }
      if (f.light) { f.light.l.position.set(f.p.x, f.p.y + 1, f.p.z); f.light.t = 0; f.light.dur = 1; f.light.peak = 30; f.light.flicker = true; }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  },
  clear() {
    this.pAdd.clear(); this.pSmoke.clear(); this.pFlash.clear(); this.holes.clear(); this.scorch.clear(); this.bloodD.clear();
    this.smokes.clear(); this.fires.clear();
    for (const t of this.tracers) t.m.visible = false;
    for (const s of this.shells) s.m.visible = false;
    for (const L of this.lights) { L.t = L.dur; L.l.intensity = 0; L.flicker = false; }
  },
  light(p, color, peak, dist, dur) {
    let L = this.lights[0]; for (const x of this.lights) if (x.t / x.dur > L.t / L.dur && !x.flicker) L = x;
    if (L.flicker) return L;
    L.l.position.set(p.x, p.y, p.z); L.l.color.setHex(color); L.l.distance = dist; L.peak = peak; L.t = 0; L.dur = dur; L.l.intensity = peak;
    return L;
  },
  tracer(from, to, speed) {
    const tr = this.tracers.find(t => !t.m.visible); if (!tr) return;
    tr.from.copy(from); tr.dir.subVectors(to, from); tr.len = tr.dir.length(); if (tr.len < .5) return; tr.dir.divideScalar(tr.len);
    tr.t = 0; tr.speed = speed || 280;
    tr.m.quaternion.setFromUnitVectors(this._tq, tr.dir); tr.m.position.copy(from); tr.m.scale.set(1, .01, 1); tr.m.visible = true;
  },
  muzzle(p, dir, big) {
    const s = big ? .6 : .38;
    this.pFlash.spawn({ x: p.x + dir.x * .05, y: p.y + dir.y * .05, z: p.z + dir.z * .05, size: s, life: .05, r: 1, g: .85, b: .55, a: 1, fin: .01 });
    this.pAdd.spawn({ x: p.x, y: p.y, z: p.z, size: s * 1.4, life: .06, r: 1, g: .6, b: .25, a: .6, fin: .01 });
    this.light(p, 0xffb060, 6, 7, .06);
  },
  impact(p, n, kind, silent) {
    const col = kind === 'sand' ? [.72, .62, .46] : kind === 'wood' ? [.45, .33, .2] : kind === 'metal' ? [.5, .5, .5] : [.62, .58, .52];
    for (let k = 0; k < 5; k++) this.pSmoke.spawn({ x: p.x, y: p.y, z: p.z, vx: n.x * (1 + Math.random() * 2) + (Math.random() - .5), vy: n.y * (1 + Math.random() * 2) + Math.random() * .8, vz: n.z * (1 + Math.random() * 2) + (Math.random() - .5), size: .12 + Math.random() * .12, grow: .7, life: .6 + Math.random() * .6, r: col[0], g: col[1], b: col[2], a: .7, drag: 2.5, grav: .6 });
    if (kind === 'metal' || kind === 'hard') for (let k = 0; k < (kind === 'metal' ? 8 : 3); k++) this.pAdd.spawn({ x: p.x, y: p.y, z: p.z, vx: n.x * 3 + (Math.random() - .5) * 5, vy: n.y * 3 + Math.random() * 4, vz: n.z * 3 + (Math.random() - .5) * 5, size: .03, life: .18 + Math.random() * .2, r: 1, g: .75, b: .4, a: 1, grav: 9, fin: .01 });
    if (kind === 'wood') for (let k = 0; k < 4; k++) this.pSmoke.spawn({ x: p.x, y: p.y, z: p.z, vx: n.x * 2 + (Math.random() - .5) * 3, vy: 1 + Math.random() * 2, vz: n.z * 2 + (Math.random() - .5) * 3, size: .04, life: .7, r: .5, g: .36, b: .2, a: 1, grav: 9.8, fin: .01 });
    this.holes.add(p, n, .07 + Math.random() * .03);
  },
  blood(p, dir, big) {
    if (!Settings.v.blood) return;
    for (let k = 0; k < (big ? 10 : 5); k++) this.pSmoke.spawn({ x: p.x, y: p.y, z: p.z, vx: dir.x * 2 + (Math.random() - .5) * 1.5, vy: Math.random() * 1.2, vz: dir.z * 2 + (Math.random() - .5) * 1.5, size: .12 + Math.random() * .18, grow: .5, life: .35 + Math.random() * .35, r: .45, g: .03, b: .03, a: .85, drag: 3, grav: 2 });
    const res = {}; const t = World.raycast(p.x, p.y, p.z, dir.x, dir.y, dir.z, 2.2, res);
    if (t < 2.2) this.bloodD.add(new V3(p.x + dir.x * t, p.y + dir.y * t, p.z + dir.z * t), new V3(res.nx, res.ny, res.nz), .35 + Math.random() * .35);
  },
  shell(p, v, local) {
    const s = this.shells.find(x => !x.m.visible) || this.shells[0];
    s.m.position.copy(p); s.v.copy(v); s.t = 0; s.snd = false; s.local = local; s.m.visible = true;
    s.floor = World.groundBelow(p.x, p.y, p.z);
  },
  explosion(p, kind) {
    const big = kind === 'c4', S = big ? 3 : 1;
    for (let k = 0; k < 26 * S; k++) {
      const a = Math.random() * TAU, e = Math.random() * 1.2, sp = (2 + Math.random() * 5) * (big ? 2 : 1);
      this.pAdd.spawn({ x: p.x, y: p.y + .3, z: p.z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 1, vz: Math.sin(a) * Math.cos(e) * sp, size: (1 + Math.random() * 1.5) * (big ? 2.2 : 1), grow: 2, life: .35 + Math.random() * .35, r: 1, g: .55 + Math.random() * .3, b: .2, a: .9, drag: 3, fin: .05 });
    }
    for (let k = 0; k < 18 * S; k++) {
      const a = Math.random() * TAU, sp = (1 + Math.random() * 3) * (big ? 2 : 1);
      this.pSmoke.spawn({ x: p.x, y: p.y + .5, z: p.z, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * sp, size: (1.5 + Math.random() * 2) * (big ? 2 : 1), grow: 1.5, life: 2.5 + Math.random() * 2, r: .2, g: .19, b: .18, a: .75, drag: 1.2, fin: .08 });
    }
    for (let k = 0; k < 30 * S; k++) this.pAdd.spawn({ x: p.x, y: p.y + .3, z: p.z, vx: (Math.random() - .5) * 18, vy: Math.random() * 12, vz: (Math.random() - .5) * 18, size: .06, life: .5 + Math.random() * .5, r: 1, g: .7, b: .3, a: 1, grav: 12, fin: .01 });
    this.pFlash.spawn({ x: p.x, y: p.y + 1, z: p.z, size: big ? 14 : 5, life: .12, r: 1, g: .9, b: .7, a: 1, fin: .01 });
    this.light(new V3(p.x, p.y + 1.5, p.z), 0xffa050, big ? 400 : 120, big ? 60 : 20, big ? .8 : .45);
    const floor = World.groundBelow(p.x, p.y + .5, p.z);
    this.scorch.add(new V3(p.x, floor, p.z), new V3(0, 1, 0), big ? 7 : 3);
  },
  smoke(id, p, dur) { this.smokes.set(id, { p: p.clone(), t: 0, dur, r: 3.2, h: 2.6, acc: 0 }); },
  removeSmoke(id) { const s = this.smokes.get(id); if (s) s.dur = Math.min(s.dur, s.t); },
  fire(id, p, r, dur) { const L = this.light(new V3(p.x, p.y + 1, p.z), 0xff8030, 30, 12, dur); L.flicker = true; this.fires.set(id, { p: p.clone(), r, dur, t: 0, acc: 0, light: L }); },
  removeFire(id) { const f = this.fires.get(id); if (f) { if (f.light) { f.light.flicker = false; f.light.t = f.light.dur; } this.fires.delete(id); } },
  dust(p, amt) { for (let k = 0; k < amt; k++) this.pSmoke.spawn({ x: p.x + (Math.random() - .5) * .5, y: p.y + .05, z: p.z + (Math.random() - .5) * .5, vx: (Math.random() - .5) * 1.5, vy: .3 + Math.random() * .4, vz: (Math.random() - .5) * 1.5, size: .25, grow: .8, life: .7, r: .7, g: .62, b: .48, a: .45, drag: 2 }); },
  spark(p) { for (let k = 0; k < 6; k++) this.pAdd.spawn({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - .5) * 3, vy: Math.random() * 3, vz: (Math.random() - .5) * 3, size: .04, life: .3, r: .6, g: .8, b: 1, a: 1, grav: 5, fin: .01 }); }
};
