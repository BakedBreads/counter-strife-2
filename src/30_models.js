/* ===================== models: guns, knives, grenades, players, arms, icons ===================== */
const Models = {
  mc: {}, skinTex: {}, skinMats: {}, icons: {}, iconsColor: {},
  mat(color, rough, metal, extra) {
    const k = color + '|' + rough + '|' + metal + '|' + (extra ? JSON.stringify(extra) : '');
    if (!this.mc[k]) this.mc[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? .5 : rough, metalness: metal == null ? .3 : metal }, extra || {}));
    return this.mc[k];
  },
  box(g, w, h, d, x, y, z, m, rx, ry, rz) { const o = new THREE.Mesh(this.geoBox(w, h, d), m); o.position.set(x, y, z); if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0); g.add(o); return o; },
  cyl(g, r1, r2, len, x, y, z, m, axis, seg) {
    const o = new THREE.Mesh(this.geoCyl(r1, r2, len, seg || 12), m); o.position.set(x, y, z);
    if (axis === 'z') o.rotation.x = Math.PI / 2; else if (axis === 'x') o.rotation.z = Math.PI / 2;
    g.add(o); return o;
  },
  gc: {},
  geoBox(w, h, d) { const k = 'b' + w + ',' + h + ',' + d; return this.gc[k] || (this.gc[k] = new THREE.BoxGeometry(w, h, d)); },
  geoCyl(r1, r2, l, s) { const k = 'c' + r1 + ',' + r2 + ',' + l + ',' + s; return this.gc[k] || (this.gc[k] = new THREE.CylinderGeometry(r1, r2, l, s)); },
  // cylinder/capsule between two points
  limb(g, a, b, r, m) {
    const d = new V3().subVectors(b, a), L = d.length();
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(.001, L - r * 2 * .6), 4, 10), m);
    o.position.copy(a).addScaledVector(d, .5);
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    g.add(o); return o;
  },

  /* ---------- skins ---------- */
  skinTexture(id) {
    if (this.skinTex[id]) return this.skinTex[id];
    const s = SKIN[id]; if (!s || s.type === 'none') return null;
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d', { willReadFrequently: true });
    const c = s.c, R = mulberry32(hashStr(id));
    const fill = (col) => { g.fillStyle = col; g.fillRect(0, 0, S, S); };
    switch (s.type) {
      case 'carbon': fill(c[0]); for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) { g.fillStyle = ((x + y) / 8) % 2 ? c[1] : c[0]; g.fillRect(x, y, 8, 4); g.fillStyle = ((x + y) / 8) % 2 ? c[0] : c[1]; g.fillRect(x, y + 4, 8, 4); } break;
      case 'digital': fill(c[0]); for (let k = 0; k < 900; k++) { g.fillStyle = c[1 + Math.floor(R() * (c.length - 1))]; const x = Math.floor(R() * 32) * 8, y = Math.floor(R() * 32) * 8, w = (1 + Math.floor(R() * 3)) * 8, h = (1 + Math.floor(R() * 2)) * 8; g.fillRect(x, y, w, h); } break;
      case 'camo': { fill(c[0]); for (let layer = 1; layer < c.length; layer++) { const f = Tex.field(S, 4, 4, hashStr(id) + layer * 13); const img = g.getImageData(0, 0, S, S), d = img.data; const col = new THREE.Color(c[layer]); for (let i = 0; i < S * S; i++) if (f[i] > .58 + layer * .04) { d[i * 4] = col.r * 255; d[i * 4 + 1] = col.g * 255; d[i * 4 + 2] = col.b * 255; } g.putImageData(img, 0, 0); } break; }
      case 'wave': { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.strokeStyle = c[2]; g.lineWidth = 5; for (let k = 0; k < 12; k++) { g.globalAlpha = .35 + R() * .5; g.beginPath(); for (let x = 0; x <= S; x += 4) { const y = k * 24 + Math.sin(x / 30 + k) * 10; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } g.globalAlpha = 1; break; }
      case 'stripes': fill(c[0]); for (let k = -S; k < S * 2; k += 46) { g.fillStyle = c[1]; g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k + 16 - S, S); g.lineTo(k - S, S); g.fill(); g.fillStyle = c[2]; g.beginPath(); g.moveTo(k + 18, 0); g.lineTo(k + 24, 0); g.lineTo(k + 24 - S, S); g.lineTo(k + 18 - S, S); g.fill(); } break;
      case 'tiger': fill(c[0]); g.fillStyle = c[1]; for (let k = 0; k < 22; k++) { const y = R() * S; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x / 20 + k) * 8 - x * .1); for (let x = S; x >= 0; x -= 8) g.lineTo(x, y + 6 + R() * 5 + Math.sin(x / 20 + k) * 8 - x * .1); g.fill(); } break;
      case 'circuit': fill(c[0]); for (let k = 0; k < 70; k++) { g.strokeStyle = R() < .6 ? c[1] : c[2]; g.lineWidth = 2; g.beginPath(); let x = Math.floor(R() * 16) * 16, y = Math.floor(R() * 16) * 16; g.moveTo(x, y); for (let s2 = 0; s2 < 4; s2++) { if (R() < .5) x += (R() < .5 ? -1 : 1) * 32; else y += (R() < .5 ? -1 : 1) * 32; g.lineTo(x, y); } g.stroke(); g.fillStyle = g.strokeStyle; g.fillRect(x - 3, y - 3, 6, 6); } break;
      case 'floral': fill(c[0]); for (let k = 0; k < 40; k++) { const x = R() * S, y = R() * S, r = 6 + R() * 10; g.fillStyle = c[1]; for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .7, r * .45, a, 0, TAU); g.fill(); } g.fillStyle = c[2]; g.beginPath(); g.arc(x, y, r * .35, 0, TAU); g.fill(); } break;
      case 'fade': { const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, c[0]); gr.addColorStop(.5, c[1]); gr.addColorStop(1, c[2]); g.fillStyle = gr; g.fillRect(0, 0, S, S); break; }
      case 'gold': { const gr = g.createLinearGradient(0, 0, S, S * .3); gr.addColorStop(0, c[0]); gr.addColorStop(.45, c[2]); gr.addColorStop(.55, c[1]); gr.addColorStop(1, c[0]); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.globalAlpha = .15; for (let k = 0; k < 300; k++) { g.fillStyle = R() < .5 ? '#fff' : '#5a4210'; g.fillRect(R() * S, R() * S, 2, 1); } g.globalAlpha = 1; break; }
      case 'web': fill(c[0]); g.strokeStyle = c[1]; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const x0 = R() * S, y0 = R() * S; for (let a = 0; a < 10; a++) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a / 10 * TAU) * 120, y0 + Math.sin(a / 10 * TAU) * 120); g.stroke(); } for (let r = 12; r < 120; r += 14) { g.beginPath(); g.arc(x0, y0, r, 0, TAU); g.stroke(); } } break;
      case 'splash': fill(c[2]); for (let k = 0; k < 60; k++) { g.fillStyle = c[k % 2 ? 0 : 1]; if (k % 7 === 0) g.fillStyle = c[3]; g.beginPath(); const x = R() * S, y = R() * S; for (let p = 0; p < 9; p++) { const a = p / 9 * TAU, r = 6 + R() * 22; p ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); } break;
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.repeat.set(6, 6);
    return this.skinTex[id] = t;
  },
  skinMat(id) {
    if (!id || id === 'default') return null;
    if (this.skinMats[id]) return this.skinMats[id];
    const s = SKIN[id]; if (!s) return null;
    const metal = s.type === 'gold' ? .9 : s.type === 'fade' ? .55 : s.type === 'carbon' ? .3 : .15;
    const rough = s.type === 'gold' ? .25 : s.type === 'fade' ? .3 : .55;
    return this.skinMats[id] = new THREE.MeshStandardMaterial({ map: this.skinTexture(id), metalness: metal, roughness: rough });
  },

  /* ---------- guns ---------- */
  gun(id, skinId, team, knifeType) {
    const w = W[id], m = w.m, sk = this.skinMat(skinId);
    if (m.kind !== 'knife' && m.kind !== 'grenade' && m.kind !== 'c4' && m.kind !== 'zeus') { const g = Guns.build(id, sk); g.userData.id = id; return g; }
    const g = new THREE.Group(); g.userData.id = id;
    const metal = this.mat(0x18191b, .35, .85), grip = this.mat(0x151515, .8, .1);
    const muzzle = new THREE.Object3D(); g.add(muzzle); g.userData.muzzle = muzzle;
    const eject = new THREE.Object3D(); g.add(eject); g.userData.eject = eject;
    if (m.kind === 'knife') this.buildKnife(g, team, sk, knifeType);
    else if (m.kind === 'grenade') this.buildNade(g, m.g);
    else if (m.kind === 'c4') this.buildC4(g);
    else { this.box(g, .03, .05, .12, 0, .04, -.03, this.mat(0xe7c21e, .5, .1)); this.box(g, .028, .09, .04, 0, -.02, .02, grip, -.2); this.cyl(g, .012, .012, .04, 0, .045, -.11, metal, 'z'); muzzle.position.set(0, .045, -.14); }
    g.userData.foreZ = -.2;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return g;
  },
  buildKnife(g, team, sk, knifeType) {
    const type = knifeType || Loadout.v.knife || 'default';
    const steel = sk || this.mat(0xb8bcc2, .22, .95);
    const handleM = this.mat(team === 'CT' ? 0x1e232a : 0x2a221a, .7, .1);
    const blade = (pts, depth, len) => {
      const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .0015, bevelSize: .0015, bevelSegments: 1 });
      geo.translate(0, 0, -depth / 2);
      const o = new THREE.Mesh(geo, steel); o.rotation.y = Math.PI / 2; g.add(o); return o;
    };
    if (type === 'karambit') {
      const pts = []; for (let k = 0; k <= 12; k++) { const a = k / 12; pts.push([.02 + a * .13, .02 + Math.sin(a * Math.PI * .9) * .035 - a * a * .06]); }
      for (let k = 12; k >= 0; k--) { const a = k / 12; pts.push([.02 + a * .13 - .004, .02 + Math.sin(a * Math.PI * .9) * .035 - a * a * .06 - .022 * (1 - a * .9)]); }
      blade(pts, .004);
      this.box(g, .018, .026, .11, 0, .01, .05, handleM);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.018, .005, 8, 16), steel); ring.position.set(0, .01, .12); ring.rotation.y = Math.PI / 2; g.add(ring);
    } else if (type === 'butterfly') {
      blade([[0, .01], [.15, .012], [.19, .0], [.15, -.012], [0, -.01]], .004);
      this.box(g, .006, .02, .12, .008, 0, .06, handleM); this.box(g, .006, .02, .12, -.008, 0, .06, handleM);
    } else if (type === 'bayonet') {
      blade([[0, .015], [.16, .015], [.21, 0], [.17, -.013], [0, -.015]], .005);
      this.box(g, .012, .06, .014, 0, 0, .005, steel);
      for (let k = 0; k < 5; k++) this.box(g, .024, .028, .018, 0, 0, .025 + k * .02, handleM);
    } else if (type === 'flip') {
      blade([[0, .016], [.12, .02], [.16, .004], [.13, -.01], [0, -.014]], .004);
      this.box(g, .02, .03, .11, 0, 0, .06, handleM);
    } else if (type === 'bowie') {
      blade([[0, .02], [.15, .02], [.2, .015], [.23, 0], [.2, -.02], [0, -.02]], .006);
      this.box(g, .014, .07, .012, 0, 0, .004, steel);
      this.box(g, .024, .032, .11, 0, 0, .06, this.mat(0x5b3b22, .6, .05));
    } else {
      blade([[0, .016], [.13, .016], [.18, .002], [.14, -.014], [0, -.016]], .005);
      this.box(g, .022, .03, .11, 0, 0, .06, handleM);
      this.box(g, .012, .045, .01, 0, 0, .004, this.mat(0x222222, .5, .6));
    }
    g.userData.muzzle.position.set(0, 0, -.2);
  },
  buildNade(g, t) {
    const metal = this.mat(0x9a9a92, .4, .7);
    if (t === 'he') { const s = new THREE.Mesh(new THREE.SphereGeometry(.034, 14, 10), this.mat(0x4a5a2a, .6, .2)); g.add(s); this.cyl(g, .01, .012, .02, 0, .04, 0, metal); this.box(g, .012, .06, .006, .012, .02, 0, metal, 0, 0, -.25); }
    else if (t === 'flash') { this.cyl(g, .022, .022, .09, 0, 0, 0, this.mat(0xc9ccc4, .5, .5)); this.cyl(g, .01, .012, .02, 0, .054, 0, metal); this.box(g, .012, .07, .006, .02, .01, 0, metal, 0, 0, -.1); }
    else if (t === 'smoke') { this.cyl(g, .025, .025, .1, 0, 0, 0, this.mat(0x6a7a6a, .6, .3)); this.cyl(g, .026, .026, .012, 0, .03, 0, this.mat(0x2a2a2a, .6, .3)); this.cyl(g, .01, .012, .02, 0, .06, 0, metal); }
    else if (t === 'molotov') { this.cyl(g, .028, .03, .11, 0, 0, 0, this.mat(0x7a4a1a, .1, .1, { transparent: true, opacity: .85 })); this.cyl(g, .012, .018, .05, 0, .075, 0, this.mat(0x7a4a1a, .1, .1, { transparent: true, opacity: .85 })); this.box(g, .02, .05, .02, 0, .11, 0, this.mat(0xd8d0c0, .9, 0)); }
    else if (t === 'inc') { this.cyl(g, .024, .024, .1, 0, 0, 0, this.mat(0x6a1a1a, .5, .4)); this.cyl(g, .01, .012, .02, 0, .06, 0, metal); }
    else { this.cyl(g, .02, .02, .08, 0, 0, 0, this.mat(0x3a4a2a, .6, .3)); this.cyl(g, .008, .01, .02, 0, .05, 0, metal); }
    g.userData.muzzle.position.set(0, 0, -.05);
  },
  buildC4(g) {
    const tan = this.mat(0xb49a6a, .8, .05), dark = this.mat(0x222222, .6, .3);
    for (let k = 0; k < 4; k++) this.cyl(g, .018, .018, .2, -.045 + k * .03, 0, 0, tan, 'z', 10);
    this.box(g, .12, .012, .19, 0, .022, 0, this.mat(0x3b3b3b, .7, .2));
    this.box(g, .07, .02, .08, 0, .035, .02, dark);
    const scr = this.box(g, .05, .004, .02, 0, .046, -.01, this.mat(0x113311, .4, 0, { emissive: 0x33ff55, emissiveIntensity: .8 })); g.userData.screen = scr;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) this.box(g, .012, .004, .01, -.016 + c * .016, .046, .016 + r * .014, this.mat(0x777777, .5, .3));
    this.cyl(g, .003, .003, .15, .04, .03, 0, this.mat(0xaa2222, .6, 0), 'z', 5); this.cyl(g, .003, .003, .15, -.04, .03, 0, this.mat(0x2244aa, .6, 0), 'z', 5);
    g.userData.muzzle.position.set(0, 0, -.1);
  },

  /* ---------- players ---------- */
  teamMats(team) {
    if (team === 'CT') return { top: this.mat(0x2e3c55, .8, .05), pants: this.mat(0x252c38, .85, .05), vest: this.mat(0x1c2430, .7, .1), head: this.mat(0x283243, .5, .3), skin: this.mat(0xc49474, .7, 0), boots: this.mat(0x16181b, .6, .1), glove: this.mat(0x1a1c1f, .7, .1), band: this.mat(0x7b9ad6, .6, 0, { emissive: 0x1b2a4a }), mask: this.mat(0x101418, .2, .6) };
    return { top: this.mat(0x8a6b43, .85, .02), pants: this.mat(0x5a4731, .85, .02), vest: this.mat(0x46382a, .75, .05), head: this.mat(0x1f1c19, .9, 0), skin: this.mat(0xb88964, .7, 0), boots: this.mat(0x2a241d, .7, .05), glove: this.mat(0x2b2723, .8, .05), band: this.mat(0xe5a43f, .6, 0, { emissive: 0x4a3010 }), mask: this.mat(0x1f1c19, .9, 0) };
  },
  character(team) {
    if (typeof Agents !== 'undefined' && Agents.ready) return Agents.character(team);
    const M = this.teamMats(team);
    const root = new THREE.Group(); root.rotation.order = 'YXZ';
    const pelvis = new THREE.Group(); pelvis.position.y = .95; root.add(pelvis);
    const mkLeg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * .1, 0, 0); pelvis.add(hip);
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(.092, .28, 4, 10), M.pants); th.position.y = -.22; hip.add(th);
      const knee = new THREE.Group(); knee.position.y = -.45; hip.add(knee);
      const sh = new THREE.Mesh(new THREE.CapsuleGeometry(.078, .28, 4, 10), M.pants); sh.position.y = -.2; knee.add(sh);
      const pad = new THREE.Mesh(this.geoBox(.1, .09, .06), M.vest); pad.position.set(0, -.02, -.07); knee.add(pad);
      const boot = new THREE.Mesh(this.geoBox(.13, .12, .27), M.boots); boot.position.set(0, -.42, -.045); knee.add(boot);
      return { hip, knee };
    };
    const legL = mkLeg(-1), legR = mkLeg(1);
    const spine = new THREE.Group(); spine.position.y = .04; pelvis.add(spine);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .22, 6, 14), M.top); torso.scale.set(1, 1, .68); torso.position.y = .28; spine.add(torso);
    const hipsM = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .06, 4, 12), M.pants); hipsM.scale.set(1.05, 1, .7); hipsM.position.y = -.02; spine.add(hipsM);
    const vest = new THREE.Mesh(this.geoBox(.4, .34, .29), M.vest); vest.position.y = .31; spine.add(vest);
    for (const sx of [-1, 1]) { const sp = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), M.vest); sp.scale.set(1.1, .7, 1); sp.position.set(sx * .2, .5, 0); spine.add(sp); }
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .1, 10), team === 'T' ? M.head : M.skin); neckM.position.y = .57; spine.add(neckM);
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(this.geoBox(.09, .1, .05), M.vest); p.position.set(-.12 + k * .12, .22, -.155); spine.add(p); }
    const belt = new THREE.Mesh(this.geoBox(.38, .06, .24), M.boots); belt.position.y = .02; spine.add(belt);
    const neck = new THREE.Group(); neck.position.y = .55; spine.add(neck);
    const head = new THREE.Group(); head.position.y = .12; neck.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 12), team === 'T' ? M.head : M.skin); skull.scale.set(.95, 1.08, 1); head.add(skull);
    if (team === 'CT') {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(.128, 16, 10, 0, TAU, 0, Math.PI * .55), M.head); helm.position.y = .02; head.add(helm);
      const gog = new THREE.Mesh(this.geoBox(.2, .05, .06), M.mask); gog.position.set(0, .01, -.09); head.add(gog);
      const mask = new THREE.Mesh(this.geoBox(.16, .07, .05), this.mat(0x2a3140, .8, .05)); mask.position.set(0, -.06, -.085); head.add(mask);
    } else {
      const eyes = new THREE.Mesh(this.geoBox(.16, .03, .03), M.skin); eyes.position.set(0, .015, -.1); head.add(eyes);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .04, 14), M.band); band.position.y = .06; head.add(band);
    }
    const mkArm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * .23, .47, 0); spine.add(sh);
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(.064, .19, 4, 10), M.top); up.position.y = -.14; sh.add(up);
      const el = new THREE.Group(); el.position.y = -.28; sh.add(el);
      const fo = new THREE.Mesh(new THREE.CapsuleGeometry(.056, .19, 4, 10), M.top); fo.position.y = -.13; el.add(fo);
      const hand = new THREE.Mesh(this.geoBox(.07, .09, .07), M.glove); hand.position.y = -.28; el.add(hand);
      if (side > 0) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .05, 10), M.band); b.position.y = -.1; sh.add(b); }
      return { sh, el };
    };
    const armL = mkArm(-1), armR = mkArm(1);
    const gunMount = new THREE.Group(); gunMount.position.set(.06, .34, -.3); spine.add(gunMount);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const ch = { root, pelvis, spine, neck, head, legL, legR, armL, armR, gunMount, gun: null, gunId: null, phase: 0, dead: 0, deathSide: 1, team };
    return ch;
  },
  setCharGun(ch, id, skin, knifeType) {
    if (ch.gunId === id + '|' + skin + '|' + knifeType) return;
    if (ch.gun) { ch.gunMount.remove(ch.gun); }
    ch.gunId = id + '|' + skin + '|' + knifeType; ch.gun = null;
    if (!id) return;
    const g = this.gun(id, skin, ch.team, knifeType);
    const cat = W[id].cat;
    if (!ch.agent && (cat === 'grenade' || cat === 'c4')) { g.position.set(.04, -.1, .05); }
    ch.gun = g; ch.gunMount.add(g);
  },
  // st: {speed, crouch(0..1), air, pitch, dead(0..1 progress), planting, moveAng, dt}
  animChar(ch, st) {
    if (ch.agent) { Agents.animate(ch, st); return; }
    const walk = clamp(st.speed / 5, 0, 1.2);
    ch.phase += st.speed * st.dt * 1.9;
    const s = Math.sin(ch.phase), c = st.crouch;
    const swing = walk * .55 * (1 - c * .4);
    ch.pelvis.position.y = lerp(.95, .5, c) + Math.abs(Math.cos(ch.phase)) * walk * .03;
    const air = st.air ? 1 : 0;
    ch.legL.hip.rotation.x = s * swing + c * 1.25 + air * .5; ch.legR.hip.rotation.x = -s * swing + c * 1.25 + air * .3;
    ch.legL.knee.rotation.x = -(Math.max(0, -s) * walk * .9 + c * 2.1 + air * .9); ch.legR.knee.rotation.x = -(Math.max(0, s) * walk * .9 + c * 2.1 + air * .7);
    const p = clamp(st.pitch, -1.2, 1.2);
    ch.spine.rotation.x = p * .55 + c * .12;
    ch.neck.rotation.x = p * .35;
    // arms hold the weapon forward
    const cat = st.cat;
    if (st.planting) { ch.armR.sh.rotation.set(.5, 0, 0); ch.armL.sh.rotation.set(.5, 0, 0); ch.armR.el.rotation.x = .7; ch.armL.el.rotation.x = .7; }
    else if (cat === 'pistol' || cat === 'grenade' || cat === 'knife' || cat === 'zeus' || cat === 'c4') {
      ch.armR.sh.rotation.set(1.35, 0, .12); ch.armR.el.rotation.x = .15;
      ch.armL.sh.rotation.set(1.3, 0, -.5); ch.armL.el.rotation.x = .25;
    } else {
      ch.armR.sh.rotation.set(.35, 0, .35); ch.armR.el.rotation.x = 1.35;
      ch.armL.sh.rotation.set(1.05, 0, -.75); ch.armL.el.rotation.x = .45;
    }
    if (st.dead > 0) {
      const d = smooth01(st.dead);
      ch.root.rotation.x = d * 1.5 * (ch.deathSide > 0 ? 1 : .9);
      ch.root.rotation.z = d * .25 * ch.deathSide;
      ch.pelvis.position.y = lerp(ch.pelvis.position.y, .2, d);
      ch.legL.knee.rotation.x = -d * .3; ch.legR.knee.rotation.x = -d * .5;
      ch.armL.sh.rotation.x = d * 2.6; ch.armR.sh.rotation.x = d * 2.4;
    } else { ch.root.rotation.x = 0; ch.root.rotation.z = 0; }
  },

  /* ---------- first-person arms ---------- */
  viewModel(id, skin, team, knifeType) {
    const grp = new THREE.Group();
    const gun = this.gun(id, skin, team, knifeType); grp.add(gun);
    if (typeof Agents !== 'undefined' && Agents.ready) { gun.traverse(o => { if (o.isMesh) o.castShadow = false; }); grp.userData.gun = gun; return grp; }
    const M = this.teamMats(team), cat = W[id].cat;
    gun.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const arms = new THREE.Group(); gun.add(arms);
    const hand = (p, big) => { const h = new THREE.Mesh(this.geoBox(big ? .05 : .045, .06, .09), M.glove); h.position.copy(p); arms.add(h); return h; };
    let rh, lh;
    if (cat === 'knife') { rh = new V3(0, -.005, .07); lh = null; }
    else if (cat === 'grenade' || cat === 'c4' || cat === 'zeus') { rh = new V3(.01, -.03, .02); lh = cat === 'c4' ? new V3(-.02, -.03, .03) : null; }
    else if (cat === 'pistol') { rh = new V3(0, -.03, .03); lh = new V3(-.02, -.05, .02); }
    else { rh = new V3(0, -.03, .035); lh = new V3(0, .005, gun.userData.foreZ); }
    hand(rh);
    this.limb(arms, rh.clone().add(new V3(0, -.01, .03)), rh.clone().add(new V3(.07, -.2, .3)), .037, M.top);
    this.limb(arms, rh.clone().add(new V3(.07, -.2, .3)), rh.clone().add(new V3(.12, -.42, .5)), .046, M.top);
    if (lh) {
      hand(lh, true);
      this.limb(arms, lh.clone().add(new V3(0, -.02, .02)), lh.clone().add(new V3(-.13, -.2, .22)), .036, M.top);
      this.limb(arms, lh.clone().add(new V3(-.13, -.2, .22)), lh.clone().add(new V3(-.24, -.45, .36)), .045, M.top);
    }
    grp.userData.gun = gun;
    return grp;
  },

  /* ---------- icons: render every weapon once for HUD, kill feed and buy menu ---------- */
  makeIcons(renderer) {
    const Wd = 256, Hd = 96;
    const rt = new THREE.WebGLRenderTarget(Wd, Hd, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(3, 4, 2); scene.add(dl);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 10);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const buf = new Uint8Array(Wd * Hd * 4);
    const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const g2 = cv.getContext('2d');
    const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    const snap = () => {
      renderer.readRenderTargetPixels(rt, 0, 0, Wd, Hd, buf);
      const img = g2.createImageData(Wd, Hd);
      for (let y = 0; y < Hd; y++) img.data.set(buf.subarray((Hd - 1 - y) * Wd * 4, (Hd - y) * Wd * 4), y * Wd * 4);
      g2.putImageData(img, 0, 0); return cv.toDataURL();
    };
    renderer.setClearColor(0x000000, 0);
    const shoot = (id, skin, silhouette) => {
      const grp = this.gun(id, skin, 'CT');
      if (W[id].cat === 'grenade') grp.rotation.z = -.3;
      scene.add(grp);
      grp.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(grp), size = bb.getSize(new V3()), ctr = bb.getCenter(new V3());
      const aspect = Wd / Hd, sw = Math.max(size.z, size.y * aspect) * .55, sh = sw / aspect;
      cam.left = -sw; cam.right = sw; cam.top = sh; cam.bottom = -sh; cam.updateProjectionMatrix();
      cam.position.set(ctr.x + 3, ctr.y, ctr.z); cam.lookAt(ctr);
      scene.overrideMaterial = silhouette ? white : null;
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
      const url = snap();
      scene.remove(grp);
      return url;
    };
    for (const id in W) { this.icons[id] = shoot(id, 'default', true); this.iconsColor[id] = shoot(id, 'default', false); }
    this.iconShoot = shoot;
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevClear, prevAlpha);
    scene.overrideMaterial = null;
    this._iconRig = { rt, scene, restore: () => { renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevClear, prevAlpha); } };
  },
  // skin preview for the inventory (rendered on demand)
  skinIcon(renderer, id, skin) {
    const key = id + '|' + skin + '|' + (id === 'knife' ? Loadout.v.knife : '');
    if (this.iconsColor[key]) return this.iconsColor[key];
    const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    const url = this.iconShoot(id, skin, false);
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevClear, prevAlpha);
    return this.iconsColor[key] = url;
  }
};
