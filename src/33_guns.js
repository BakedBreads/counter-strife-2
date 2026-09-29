/* ===================== firearm models: side profiles extruded with bevels ===================== */
// Coordinates: u = distance toward the muzzle (maps to -z), v = up, x = sideways. Origin = top of the pistol grip,
// where the web of the shooting hand sits. Every builder sets muzzle, eject, foregrip and a magazine group.
const Guns = {
  M: null, gc: new Map(),
  mats() {
    if (this.M) return this.M;
    // fine speckle normal map shared by metal and polymer, plus a wood grain texture
    const S = 256, f = Tex.field(S, 32, 3, 501), f2 = Tex.field(S, 8, 3, 502);
    const t = Tex.paint(S, (i, x, y, c) => { c[0] = c[1] = c[2] = 128 + (f[i] - .5) * 40; return f[i] * .6 + f2[i] * .4; });
    const nm = Tex.tex(Tex.normalCanvas(t, 3), false); nm.repeat.set(12, 12);
    const W2 = 512, H2 = 128, wf = Tex.field(W2, 16, 4, 503);
    const wood = document.createElement('canvas'); wood.width = W2; wood.height = H2;
    const wg = wood.getContext('2d'), img = wg.createImageData(W2, H2);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const n = wf[(y * 4 % W2) * W2 + x] || 0, grain = Math.sin((y / H2 * 26 + n * 1.6 + x / W2 * 1.5) * Math.PI) * .5 + .5;
      const k = .8 + grain * .16 + (n - .5) * .08, j = (y * W2 + x) * 4;
      img.data[j] = 112 * k; img.data[j + 1] = 56 * k; img.data[j + 2] = 30 * k; img.data[j + 3] = 255;
    }
    wg.putImageData(img, 0, 0);
    const wt = new THREE.CanvasTexture(wood); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(5, 5); wt.anisotropy = 8;
    const std = (o) => { const useN = o.nm !== false; delete o.nm; const m = new THREE.MeshStandardMaterial(o); if (useN) { m.normalMap = nm; m.normalScale.set(.35, .35); } return m; };
    this.M = {
      steel: std({ color: 0x34373b, metalness: .85, roughness: .36 }),
      black: std({ color: 0x1f2124, metalness: .55, roughness: .48 }),
      poly: std({ color: 0x232427, metalness: .05, roughness: .72 }),
      wood: std({ map: wt, metalness: 0, roughness: .5 }),
      tan: std({ color: 0x8f7c5c, metalness: .05, roughness: .7 }),
      od: std({ color: 0x46503a, metalness: .05, roughness: .66 }),
      bright: std({ color: 0x8c9095, metalness: .9, roughness: .3 }),
      two: std({ color: 0x6d6a60, metalness: .7, roughness: .35 }),
      lens: std({ color: 0x1d3a58, metalness: .95, roughness: .06, emissive: 0x040a12, nm: false }),
      brass: std({ color: 0xb58d3c, metalness: .9, roughness: .3, nm: false }),
      rubber: std({ color: 0x141414, metalness: 0, roughness: .92 }),
      smoke: new THREE.MeshStandardMaterial({ color: 0x3c3a30, metalness: .1, roughness: .2, transparent: true, opacity: .8 })
    };
    return this.M;
  },
  mat(c, name) { const paint = name[0] === '*', base = this.M[paint ? name.slice(1) : name]; return paint && c.skin ? c.skin : base; },
  add(c, geo, name, x) { const m = new THREE.Mesh(geo, this.mat(c, name)); if (x) m.position.x = x; (c.into || c.g).add(m); return m; },
  // extrude a side profile (array of [u,v]) to a given thickness
  ext(c, pts, depth, name, x, bevel, holes) {
    bevel = bevel == null ? Math.min(.0022, depth * .2) : bevel;
    const key = 'e' + JSON.stringify([pts, depth, bevel, holes || 0]);
    let geo = this.gc.get(key);
    if (!geo) {
      const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
      if (holes) for (const h of holes) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
      const d = Math.max(.0008, depth - bevel * 2);
      geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
      geo.translate(0, 0, -d / 2); geo.rotateY(Math.PI / 2); geo.computeVertexNormals();
      this.gc.set(key, geo);
    }
    return this.add(c, geo, name, x);
  },
  // rounded rectangle profile
  rr(u0, v0, u1, v1, r) {
    r = Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2); const p = [];
    const arc = (cu, cv, a0) => { for (let k = 0; k <= 3; k++) { const a = a0 + k / 3 * Math.PI / 2; p.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } };
    arc(u1 - r, v0 + r, -Math.PI / 2); arc(u1 - r, v1 - r, 0); arc(u0 + r, v1 - r, Math.PI / 2); arc(u0 + r, v0 + r, Math.PI);
    return p;
  },
  // quadratic curve samples
  qb(a, b, e, n) { const p = []; for (let k = 1; k <= (n || 6); k++) { const t = k / (n || 6), s = 1 - t; p.push([s * s * a[0] + 2 * s * t * b[0] + t * t * e[0], s * s * a[1] + 2 * s * t * b[1] + t * t * e[1]]); } return p; },
  // cylinder along the bore from u0 to u1 at height v
  cyl(c, r, u0, u1, v, name, x, seg, r2) {
    const key = 'c' + [r, r2 || r, u1 - u0, seg || 16].join(',');
    let geo = this.gc.get(key);
    if (!geo) { geo = new THREE.CylinderGeometry(r2 || r, r, u1 - u0, seg || 16); geo.rotateX(-Math.PI / 2); this.gc.set(key, geo); }
    const m = this.add(c, geo, name); m.position.set(x || 0, v, -(u0 + u1) / 2); return m;
  },
  // lathe profile [[u, r], ...] around the bore line at height v
  lathe(c, prof, v, name, x) {
    const key = 'l' + JSON.stringify(prof);
    let geo = this.gc.get(key);
    if (!geo) { geo = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1], p[0])), 24); geo.rotateX(-Math.PI / 2); this.gc.set(key, geo); }
    const m = this.add(c, geo, name); m.position.set(x || 0, v, 0); return m;
  },
  box(c, u0, u1, v0, v1, w, name, x) { return this.ext(c, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], w, name, x, Math.min(.0012, w * .15)); },
  // picatinny rail: a notched profile
  rail(c, u0, u1, v, w, name) {
    const p = [[u0, v], [u1, v]]; const n = Math.max(2, Math.floor((u1 - u0) / .01));
    for (let k = n; k >= 0; k--) { const u = u0 + (u1 - u0) * k / n; p.push([u, v + .009], [u - .004, v + .009], [u - .004, v + .006]); }
    p.push([u0, v + .006]);
    return this.ext(c, p.filter((q, i) => i < 2 || q[0] >= u0 - 1e-6), w, name || 'black', 0, .0008);
  },
  scope(c, u0, len, v, r, name) {
    const L = len;
    this.lathe(c, [[u0 + L, 0], [u0 + L, r * 1.45], [u0 + L - .012, r * 1.5], [u0 + L - .05, r * 1.05], [u0 + L * .55, r], [u0 + L * .45, r], [u0 + .05, r * 1.02], [u0 + .02, r * 1.3], [u0, r * 1.32], [u0, 0]], v, name || 'black');
    this.cyl(c, r * .55, u0 + L * .45, u0 + L * .55, v + r * 1.2, name || 'black', 0, 12).rotation.set(0, 0, 0);
    const t = this.cyl(c, r * .5, 0, r * .9, v, name || 'black', r + r * .4, 12); t.rotation.set(0, Math.PI / 2, 0); t.position.set(r * 1.35, v, -(u0 + L * .5));
    this.cyl(c, r * 1.4, u0 + L - .004, u0 + L - .001, v, 'lens');
    // mounts
    this.box(c, u0 + L * .22, u0 + L * .3, v - r * 1.6, v - r * .6, r * 1.2, 'black');
    this.box(c, u0 + L * .7, u0 + L * .78, v - r * 1.6, v - r * .6, r * 1.2, 'black');
  },
  grip(c, style, name) {
    const P = {
      ak: [[-.036, .008], [.03, .008], [.022, -.03], [.01, -.098], [-.028, -.104], [-.042, -.064], [-.038, -.02]],
      ar: [[-.03, .006], [.03, .006], [.018, -.035], [.004, -.1], [-.032, -.104], [-.044, -.07], [-.036, -.02]],
      poly: [[-.03, .006], [.032, .006], [.026, -.02], [.014, -.1], [-.026, -.106], [-.04, -.066], [-.034, -.018]],
      pistol: [[-.036, .004], [.028, .004], [.02, -.03], [.012, -.098], [-.03, -.104], [-.046, -.07], [-.042, -.02]]
    }[style];
    return this.ext(c, P, style === 'pistol' ? .03 : .029, name || '*poly');
  },
  guard(c, u0, u1, v, name) {
    return this.ext(c, [[u0, v], [u1, v], [u1, v - .03], [u0 + .01, v - .036], [u0 + .01, v - .03], [u1 - .008, v - .026], [u1 - .008, v]], .009, name || 'black');
  },
  curvedMag(c, u0, u1, v, du, dv, name, w) {
    const p = [[u0, v], [u1, v]].concat(this.qb([u1, v], [u1 + du * .25, v + dv * .5], [u1 + du, v + dv], 6)).concat([[u0 + du, v + dv - .02]]).concat(this.qb([u0 + du, v + dv - .02], [u0 + du * .25, v + dv * .5], [u0, v], 6));
    return this.ext(c, p, w || .03, name || '*black');
  },
  straightMag(c, u0, u1, v, len, lean, name, w) {
    return this.ext(c, [[u0, v], [u1, v], [u1 + lean, v - len], [u0 + lean, v - len - .004]], w || .026, name || '*black');
  },
  // ---------------------------------------------------------------------------------------------
  build(id, skin) {
    this.mats();
    const g = new THREE.Group(), c = { g, skin, into: null };
    const mag = new THREE.Group(); g.add(mag); c.magG = mag;
    const res = (this.B[id] || this.B.generic).call(this, c, W[id]);
    g.userData.muzzle = new THREE.Object3D(); g.userData.muzzle.position.set(0, res.mv, -res.mu); g.add(g.userData.muzzle);
    g.userData.eject = new THREE.Object3D(); g.userData.eject.position.set(.02, res.ev || res.mv + .01, -(res.eu || .05)); g.add(g.userData.eject);
    g.userData.foreZ = -(res.fu == null ? .3 : res.fu); g.userData.foreV = res.fv == null ? 0 : res.fv; g.userData.mag = mag;
    if (res.dual) { g.userData.dual = res.dual; g.userData.muzzle2 = new THREE.Object3D(); g.userData.muzzle2.position.set(res.dual, res.mv, -res.mu); g.add(g.userData.muzzle2); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  },
  onMag(c, fn) { c.into = c.magG; fn(); c.into = null; },
  B: {
    // ================= rifles =================
    ak47(c) {
      this.ext(c, [[-.1, .006], [.25, .006], [.256, .02], [.256, .058], [.24, .066], [-.06, .07], [-.1, .06]], .036, '*steel');
      this.ext(c, this.rr(-.065, .06, .232, .074, .006), .031, '*steel');
      this.box(c, .228, .27, .062, .082, .024, 'steel');
      this.grip(c, 'ak', '*wood'); this.guard(c, .012, .088, .008, 'steel'); this.box(c, .04, .048, -.022, .006, .005, 'steel');
      this.onMag(c, () => { this.curvedMag(c, .095, .158, .006, .1, -.2, '*black', .03); this.box(c, .19, .27, -.205, -.19, .034, 'black'); });
      this.ext(c, [[.255, .012], [.458, .014], [.47, .03], [.458, .05], [.255, .052]], .052, '*wood');
      this.ext(c, this.rr(.27, .054, .44, .079, .01), .036, '*wood');
      this.cyl(c, .0105, .44, .7, .036, 'steel'); this.cyl(c, .008, .44, .62, .066, 'steel');
      this.box(c, .46, .5, .03, .08, .03, 'steel');
      this.ext(c, [[.6, .028], [.66, .028], [.656, .086], [.646, .086], [.64, .05], [.618, .05]], .022, 'steel');
      this.cyl(c, .0145, .68, .735, .036, 'black', 0, 12);
      this.ext(c, [[-.1, .064], [-.1, .014], [-.12, 0], [-.345, -.055], [-.352, -.03], [-.35, .044], [-.34, .053], [-.12, .066]], .042, '*wood');
      this.ext(c, this.rr(-.362, -.06, -.346, .05, .004), .045, 'steel');
      this.cyl(c, .007, 0, .03, .045, 'steel', .026, 8).rotation.set(0, Math.PI / 2, 0);
      this.box(c, .0, .1, .03, .046, .004, 'steel', .02);
      return { mu: .735, mv: .036, fu: .36, fv: .012, eu: .12 };
    },
    galil(c) {
      this.ext(c, [[-.1, .006], [.24, .006], [.246, .02], [.246, .058], [.23, .067], [-.06, .07], [-.1, .06]], .036, '*black');
      this.box(c, .22, .26, .065, .09, .02, 'steel');
      this.grip(c, 'ak', '*poly'); this.guard(c, .012, .088, .008, 'black');
      this.onMag(c, () => this.curvedMag(c, .095, .16, .006, .09, -.21, '*black', .03));
      const rib = []; for (let k = 0; k < 7; k++) rib.push(k);
      this.ext(c, [[.245, .01], [.46, .012], [.47, .03], [.46, .054], [.245, .056]], .054, '*poly');
      for (const k of rib) this.box(c, .26 + k * .028, .272 + k * .028, .014, .05, .056, 'black');
      this.cyl(c, .0105, .44, .69, .038, 'steel'); this.cyl(c, .014, .66, .72, .038, 'black', 0, 12);
      this.ext(c, [[.6, .03], [.64, .03], [.636, .095], [.628, .095], [.62, .05]], .02, 'steel');
      this.ext(c, [[-.1, .062], [-.1, .02], [-.33, -.04], [-.345, -.04], [-.345, .06], [-.33, .07]], .03, '*black', 0, .002, [[[-.13, .052], [-.13, .025], [-.31, -.022], [-.325, -.02], [-.325, .052]]]);
      return { mu: .72, mv: .038, fu: .36, fv: .012, eu: .12 };
    },
    m4a4(c) { return this.B.arCore.call(this, c, { sup: false }); },
    m4a1s(c) { return this.B.arCore.call(this, c, { sup: true }); },
    arCore(c, o) {
      this.ext(c, [[-.065, .03], [.205, .03], [.205, .074], [-.05, .074], [-.065, .066]], .032, '*black');
      this.ext(c, [[-.075, -.004], [.06, -.004], [.07, -.012], [.158, -.012], [.162, .032], [-.08, .032]], .036, '*black');
      this.rail(c, -.05, .2, .074, .022);
      this.box(c, -.058, -.03, .084, .1, .018, 'black');
      this.grip(c, 'ar', '*poly'); this.guard(c, .012, .092, .006, 'black'); this.box(c, .04, .048, -.02, .006, .005, 'steel');
      this.onMag(c, () => this.ext(c, [[.077, -.01], [.14, -.01]].concat(this.qb([.14, -.01], [.152, -.1], [.168, -.165], 5)).concat([[.108, -.172]]).concat(this.qb([.108, -.172], [.09, -.1], [.077, -.01], 5)), .025, '*black'));
      if (o.sup) {
        this.ext(c, this.rr(.205, .02, .41, .078, .012), .044, '*black');
        this.cyl(c, .0095, .41, .44, .049, 'steel'); this.lathe(c, [[.43, 0], [.43, .016], [.44, .02], [.645, .02], [.652, .016], [.652, 0]], .049, '*black');
      } else {
        this.ext(c, this.rr(.205, .012, .44, .084, .01), .05, '*black');
        this.rail(c, .21, .43, .084, .02);
        this.cyl(c, .0095, .44, .6, .049, 'steel'); this.lathe(c, [[.598, 0], [.598, .012], [.648, .012], [.652, .009], [.652, 0]], .049, 'black');
        this.ext(c, [[.47, .064], [.52, .064], [.506, .112], [.496, .112]], .02, 'black');
      }
      this.cyl(c, .017, -.07, -.26, .047, 'black');
      this.ext(c, [[-.19, .074], [-.33, .072], [-.337, -.062], [-.3, -.062], [-.22, .006], [-.19, .02]], .044, '*poly');
      this.ext(c, this.rr(-.345, -.066, -.33, .076, .004), .046, 'rubber');
      return { mu: o.sup ? .652 : .652, mv: .049, fu: .33, fv: .012, eu: .07, ev: .06 };
    },
    famas(c) {
      this.ext(c, [[-.34, .0], [.12, .0], [.22, .012], [.23, .04], [.2, .066], [-.33, .07], [-.345, .05]], .044, '*black');
      this.ext(c, [[-.26, .07], [-.24, .104], [.14, .104], [.16, .07], [.13, .07], [.12, .092], [-.22, .092], [-.23, .07]], .018, '*black');
      this.grip(c, 'poly', '*black'); this.guard(c, .012, .09, .004, 'black');
      this.onMag(c, () => this.straightMag(c, -.14, -.075, .002, .15, .01, '*black', .025));
      this.cyl(c, .0095, .22, .4, .036, 'steel'); this.lathe(c, [[.39, 0], [.39, .014], [.43, .014], [.43, 0]], .036, 'black');
      this.ext(c, this.rr(-.36, -.035, -.335, .066, .004), .046, 'rubber');
      return { mu: .43, mv: .036, fu: .13, fv: 0, eu: -.1, ev: .05 };
    },
    aug(c) {
      this.ext(c, [[-.36, -.01]].concat(this.qb([-.36, -.01], [-.35, -.06], [-.28, -.06], 5)).concat([[-.1, -.02], [.06, -.02], [.18, .0], [.2, .035], [.18, .06], [-.32, .062], [-.365, .04]]), .052, '*od');
      this.grip(c, 'poly', '*od');
      this.ext(c, [[-.03, .004], [.1, .004], [.1, -.03], [.084, -.03], [.084, -.01], [-.02, -.01]], .012, '*od');
      this.ext(c, [[.13, -.015], [.16, -.015], [.152, -.1], [.128, -.1]], .026, '*od');
      this.onMag(c, () => this.straightMag(c, -.13, -.07, -.015, .14, .012, 'smoke', .026));
      this.cyl(c, .0095, .19, .44, .036, 'steel'); this.lathe(c, [[.43, 0], [.43, .012], [.47, .012], [.47, 0]], .036, 'black');
      this.lathe(c, [[.13, 0], [.13, .026], [.11, .028], [-.08, .02], [-.12, .024], [-.12, 0]], .1, '*od');
      this.cyl(c, .026, .129, .131, .1, 'lens');
      this.box(c, -.06, .1, .06, .085, .02, '*od');
      return { mu: .47, mv: .036, fu: .145, fv: -.02, eu: -.12, ev: .05 };
    },
    sg553(c) {
      this.ext(c, [[-.08, .0], [.2, .0], [.21, .02], [.21, .064], [-.06, .07], [-.08, .06]], .038, '*tan');
      this.grip(c, 'poly', '*black'); this.guard(c, .012, .088, .004, 'black');
      this.onMag(c, () => this.curvedMag(c, .09, .15, .0, .08, -.19, 'smoke', .029));
      this.ext(c, this.rr(.21, .006, .42, .062, .01), .05, '*black');
      for (let k = 0; k < 6; k++) this.box(c, .23 + k * .03, .242 + k * .03, .06, .066, .05, 'black');
      this.cyl(c, .0095, .42, .6, .036, 'steel'); this.lathe(c, [[.58, 0], [.58, .013], [.62, .013], [.62, 0]], .036, 'black');
      this.scope(c, -.02, .19, .115, .017);
      this.ext(c, [[-.08, .062], [-.08, .03], [-.3, .0], [-.3, .066], [-.28, .072]], .03, '*black', 0, .002, [[[-.11, .056], [-.11, .04], [-.27, .02], [-.27, .058]]]);
      return { mu: .62, mv: .036, fu: .32, fv: .006, eu: .08 };
    },
    ssg08(c) {
      this.ext(c, this.rr(-.07, .02, .19, .066, .012), .034, '*black');
      this.grip(c, 'poly', '*black'); this.guard(c, .012, .088, .01, 'black');
      this.onMag(c, () => this.straightMag(c, .07, .13, .02, .06, .0, '*black', .026));
      this.ext(c, [[-.07, .02], [.46, .012], [.47, .03], [.46, .05], [.19, .054], [.19, .02]], .05, '*black');
      this.ext(c, [[-.07, .058], [-.07, .014], [-.1, -.004], [-.37, -.06], [-.378, -.04], [-.37, .06], [-.3, .068], [-.1, .066]], .044, '*black', 0, .0024, [[[-.13, .046], [-.13, .018], [-.2, .002], [-.2, .046]]]);
      this.cyl(c, .0085, .45, .76, .045, 'steel'); this.cyl(c, .012, .74, .78, .045, 'black', 0, 12);
      this.scope(c, -.07, .29, .11, .019);
      this.cyl(c, .006, 0, .05, .05, 'steel', .03, 8).rotation.set(0, Math.PI / 2, 0);
      return { mu: .78, mv: .045, fu: .34, fv: .012, eu: .08 };
    },
    awp(c) {
      this.ext(c, this.rr(-.08, .02, .21, .072, .012), .04, '*od');
      this.onMag(c, () => this.straightMag(c, .07, .15, .02, .07, .0, '*black', .034));
      this.ext(c, [[-.46, -.06], [-.44, -.078], [-.24, -.05], [-.08, -.03], [.0, -.04], [.04, -.02], [.21, .0], [.5, .006], [.51, .03], [.5, .06], [.21, .064], [-.08, .07], [-.2, .074], [-.44, .07], [-.46, .06]], .052, '*od', 0, .003, [[[-.06, .01], [-.02, -.02], [.0, -.02], [-.03, .02]], [[-.33, .048], [-.24, .045], [-.24, -.02], [-.33, -.035]]]);
      this.ext(c, this.rr(-.478, -.08, -.458, .075, .005), .054, 'rubber');
      this.cyl(c, .0135, .5, .88, .046, 'black'); this.lathe(c, [[.86, 0], [.86, .02], [.93, .02], [.93, .016], [.935, 0]], .046, 'black');
      this.scope(c, -.08, .36, .13, .025);
      this.cyl(c, .007, 0, .06, .052, 'steel', .034, 8).rotation.set(0, Math.PI / 2, 0);
      const k = new THREE.Mesh(new THREE.SphereGeometry(.012, 10, 8), this.M.steel); k.position.set(.066, .052, -.02); c.g.add(k); c.g.userData.bolt = k;
      return { mu: .935, mv: .046, fu: .36, fv: .006, eu: .06 };
    },
    g3sg1(c) {
      this.ext(c, this.rr(-.09, .0, .24, .07, .01), .04, '*black');
      this.grip(c, 'poly', '*black'); this.guard(c, .012, .09, .0, 'black');
      this.onMag(c, () => this.straightMag(c, .09, .16, .0, .16, .02, '*black', .028));
      this.ext(c, this.rr(.24, .004, .5, .064, .012), .05, '*black');
      for (let k = 0; k < 8; k++) this.box(c, .26 + k * .028, .268 + k * .028, .012, .056, .052, 'black');
      this.cyl(c, .011, .5, .74, .04, 'steel'); this.lathe(c, [[.72, 0], [.72, .016], [.77, .016], [.77, 0]], .04, 'black');
      this.scope(c, -.06, .3, .115, .02);
      this.ext(c, [[-.09, .066], [-.09, .01], [-.39, -.06], [-.4, .07], [-.3, .09], [-.12, .08]], .042, '*black');
      this.box(c, -.2, .05, -.03, -.01, .012, 'steel', .03);
      return { mu: .77, mv: .04, fu: .36, fv: .004, eu: .08 };
    },
    scar20(c) {
      this.ext(c, this.rr(-.09, .03, .42, .078, .008), .044, '*tan');
      this.ext(c, [[-.08, -.004], [.1, -.004], [.1, -.014], [.17, -.014], [.17, .032], [-.08, .032]], .04, '*black');
      this.rail(c, -.08, .42, .078, .022);
      this.grip(c, 'poly', '*black'); this.guard(c, .012, .092, .0, 'black');
      this.onMag(c, () => this.straightMag(c, .1, .165, -.01, .15, .015, '*black', .028));
      this.cyl(c, .011, .42, .7, .054, 'steel'); this.lathe(c, [[.68, 0], [.68, .015], [.73, .015], [.73, 0]], .054, 'black');
      this.scope(c, -.04, .3, .128, .02);
      this.ext(c, [[-.08, .074], [-.1, .02], [-.36, -.05], [-.37, .08], [-.18, .09]], .046, '*tan', 0, .0025, [[[-.14, .06], [-.14, .03], [-.3, .0], [-.3, .06]]]);
      return { mu: .73, mv: .054, fu: .34, fv: .03, eu: .08, ev: .07 };
    },
    // ================= SMGs =================
    mac10(c) {
      this.ext(c, this.rr(-.12, -.004, .14, .06, .006), .045, '*steel');
      this.onMag(c, () => { this.ext(c, [[-.03, -.004], [.022, -.004], [.014, -.2], [-.034, -.2]], .026, '*black'); });
      this.ext(c, [[-.034, -.004], [.026, -.004], [.018, -.11], [-.036, -.112]], .034, '*poly');
      this.guard(c, .03, .1, -.004, 'steel');
      this.cyl(c, .011, .14, .2, .03, 'steel'); this.cyl(c, .013, .185, .205, .03, 'black', 0, 10);
      this.box(c, .1, .13, -.06, -.004, .006, 'steel');
      this.ext(c, [[-.12, .05], [-.24, .05], [-.24, .04], [-.12, .04]], .006, 'steel', .02); this.ext(c, [[-.12, .05], [-.24, .05], [-.24, .04], [-.12, .04]], .006, 'steel', -.02);
      this.box(c, -.02, .02, .06, .07, .008, 'steel');
      return { mu: .205, mv: .03, fu: .11, fv: -.03, eu: .03 };
    },
    mp9(c) {
      this.ext(c, [[-.14, .0], [.17, .0], [.18, .02], [.17, .058], [-.13, .062], [-.14, .05]], .042, '*poly');
      this.rail(c, -.12, .15, .062, .02);
      this.ext(c, [[-.034, .0], [.024, .0], [.016, -.11], [-.04, -.112]], .034, '*poly');
      this.onMag(c, () => this.ext(c, [[-.03, -.1], [.018, -.1], [.014, -.2], [-.034, -.2]], .026, '*black'));
      this.guard(c, .03, .1, .0, 'poly');
      this.ext(c, [[.12, .0], [.15, .0], [.144, -.07], [.126, -.07]], .024, '*poly');
      this.cyl(c, .01, .17, .23, .034, 'steel');
      this.ext(c, [[-.14, .045], [-.14, .012], [-.28, .012], [-.28, .045]], .008, 'black', .03);
      return { mu: .23, mv: .034, fu: .135, fv: -.04, eu: .05 };
    },
    mp7(c) {
      this.ext(c, [[-.12, .0], [.16, .0], [.18, .02], [.17, .064], [-.11, .068], [-.12, .05]], .044, '*poly');
      this.rail(c, -.1, .15, .068, .02);
      this.ext(c, [[-.034, .0], [.024, .0], [.016, -.11], [-.04, -.112]], .034, '*poly');
      this.onMag(c, () => this.ext(c, [[-.03, -.1], [.018, -.1], [.016, -.24], [-.032, -.24]], .026, '*black'));
      this.guard(c, .03, .1, .0, 'poly');
      this.ext(c, [[.13, .0], [.155, .0], [.15, -.08], [.132, -.08]], .022, '*poly');
      this.cyl(c, .01, .17, .25, .034, 'steel'); this.cyl(c, .014, .23, .26, .034, 'black', 0, 10);
      this.cyl(c, .005, -.12, -.25, .05, 'steel', .016, 8); this.cyl(c, .005, -.12, -.25, .05, 'steel', -.016, 8);
      this.ext(c, this.rr(-.27, -.02, -.25, .07, .004), .05, 'poly');
      return { mu: .26, mv: .034, fu: .145, fv: -.04, eu: .05 };
    },
    mp5sd(c) {
      this.lathe(c, [[-.12, 0], [-.12, .026], [.16, .026], [.17, .02], [.17, 0]], .045, '*black');
      this.ext(c, [[-.1, -.004], [.1, -.004], [.1, .03], [-.1, .03]], .034, '*black');
      this.grip(c, 'poly', '*poly'); this.guard(c, .012, .088, -.004, 'black');
      this.onMag(c, () => this.curvedMag(c, .09, .135, -.004, .05, -.2, '*black', .024));
      this.lathe(c, [[.17, 0], [.17, .026], [.176, .03], [.46, .03], [.466, .025], [.466, 0]], .045, '*black');
      this.ext(c, [[-.12, .06], [-.12, .01], [-.34, -.03], [-.34, .07], [-.14, .074]], .04, '*poly');
      this.ext(c, [[.0, .07], [.06, .07], [.06, .085], [.0, .085]], .02, 'black');
      return { mu: .466, mv: .045, fu: .3, fv: .016, eu: .06 };
    },
    ump45(c) {
      this.ext(c, [[-.12, -.004], [.26, -.004], [.28, .02], [.27, .07], [-.11, .074], [-.12, .06]], .044, '*poly');
      this.rail(c, -.1, .2, .074, .02);
      this.grip(c, 'poly', '*poly'); this.guard(c, .012, .09, -.004, 'poly');
      this.onMag(c, () => this.straightMag(c, .09, .15, -.004, .17, .01, '*black', .028));
      this.cyl(c, .01, .28, .36, .04, 'steel'); this.cyl(c, .013, .34, .37, .04, 'black', 0, 10);
      this.ext(c, [[-.12, .06], [-.12, .02], [-.36, -.03], [-.36, .07]], .02, '*poly', 0, .002, [[[-.15, .052], [-.15, .03], [-.33, .0], [-.33, .052]]]);
      return { mu: .37, mv: .04, fu: .23, fv: -.004, eu: .06 };
    },
    p90(c) {
      this.ext(c, [[-.3, -.04]].concat(this.qb([-.3, -.04], [-.32, -.12], [-.22, -.12], 5)).concat([[-.08, -.1], [.02, -.1], [.08, -.02], [.18, -.02], [.2, .02], [.2, .05], [-.28, .06], [-.31, .02]]), .06, '*poly', 0, .004, [[[-.07, -.02], [.0, -.08], [.03, -.08], [-.02, -.02]]]);
      this.onMag(c, () => this.box(c, -.22, .18, .06, .085, .05, 'smoke'));
      this.cyl(c, .01, .2, .27, .03, 'steel'); this.cyl(c, .013, .25, .28, .03, 'black', 0, 10);
      this.box(c, -.02, .08, .085, .1, .016, 'black');
      return { mu: .28, mv: .03, fu: .12, fv: -.03, eu: -.1, ev: -.08 };
    },
    bizon(c) {
      this.ext(c, [[-.1, .006], [.2, .006], [.206, .02], [.206, .058], [.19, .066], [-.06, .07], [-.1, .06]], .036, '*black');
      this.grip(c, 'ak', '*poly'); this.guard(c, .012, .088, .008, 'black');
      this.onMag(c, () => { this.cyl(c, .027, .06, .38, -.012, '*black'); this.cyl(c, .029, .36, .385, -.012, 'black'); });
      this.ext(c, this.rr(.2, .018, .38, .06, .008), .04, '*poly');
      this.cyl(c, .0095, .38, .5, .04, 'steel'); this.cyl(c, .013, .48, .52, .04, 'black', 0, 10);
      this.ext(c, [[-.1, .06], [-.1, .02], [-.35, -.02], [-.35, .06]], .018, 'steel', 0, .002, [[[-.13, .05], [-.13, .03], [-.33, .0], [-.33, .05]]]);
      return { mu: .52, mv: .04, fu: .3, fv: -.04, eu: .1 };
    },
    // ================= heavy =================
    nova(c) {
      this.ext(c, this.rr(-.09, .0, .2, .068, .008), .04, '*black');
      this.grip(c, 'poly', '*poly'); this.guard(c, .012, .09, .0, 'black');
      this.cyl(c, .011, .2, .6, .052, 'steel'); this.cyl(c, .012, .2, .5, .02, 'black');
      const p = this.cyl(c, .022, .24, .4, .024, '*poly'); c.g.userData.pump = p;
      this.ext(c, [[-.09, .062], [-.09, .01], [-.37, -.07], [-.38, .06], [-.3, .07]], .042, '*poly');
      this.ext(c, this.rr(-.39, -.074, -.372, .064, .004), .044, 'rubber');
      this.onMag(c, () => { });
      return { mu: .6, mv: .052, fu: .32, fv: .002, eu: .06 };
    },
    xm1014(c) {
      this.ext(c, this.rr(-.08, .0, .22, .072, .008), .042, '*black');
      this.grip(c, 'poly', '*black'); this.guard(c, .012, .092, .0, 'black');
      this.rail(c, -.06, .2, .072, .02);
      this.cyl(c, .011, .22, .62, .054, 'steel'); this.cyl(c, .014, .22, .54, .022, '*black');
      this.ext(c, this.rr(.22, .006, .42, .07, .012), .046, '*poly');
      this.ext(c, [[-.08, .066], [-.08, .01], [-.36, -.06], [-.37, .07], [-.28, .076]], .042, '*black');
      this.onMag(c, () => { });
      return { mu: .62, mv: .054, fu: .32, fv: .006, eu: .06 };
    },
    sawedoff(c) {
      this.ext(c, this.rr(-.06, .0, .16, .064, .008), .04, '*steel');
      this.ext(c, [[-.04, .006], [.03, .006], [.0, -.03], [-.03, -.12], [-.07, -.11], [-.07, -.02]], .032, '*wood');
      this.guard(c, .012, .09, .0, 'steel');
      this.cyl(c, .014, .16, .34, .048, 'steel'); this.cyl(c, .012, .16, .3, .018, 'steel');
      const p = this.cyl(c, .022, .18, .3, .02, '*wood'); c.g.userData.pump = p;
      this.onMag(c, () => { });
      return { mu: .34, mv: .048, fu: .24, fv: -.002, eu: .05 };
    },
    mag7(c) {
      this.ext(c, this.rr(-.1, .0, .22, .07, .008), .044, '*black');
      this.ext(c, [[-.034, .0], [.026, .0], [.018, -.1], [-.038, -.104]], .036, '*poly');
      this.onMag(c, () => this.ext(c, [[-.03, -.09], [.02, -.09], [.018, -.18], [-.032, -.18]], .03, '*black'));
      this.guard(c, .03, .1, .0, 'black');
      this.cyl(c, .013, .22, .42, .05, 'steel');
      const p = this.ext(c, [[.24, .0], [.36, .0], [.36, .045], [.24, .045]], .05, '*poly'); c.g.userData.pump = p;
      this.ext(c, [[.26, .0], [.29, .0], [.285, -.07], [.265, -.07]], .024, '*poly');
      this.ext(c, [[-.1, .06], [-.28, .06], [-.28, .05], [-.1, .05]], .008, 'steel', .025);
      return { mu: .42, mv: .05, fu: .275, fv: -.04, eu: .06 };
    },
    negev(c) { return this.B.lmg.call(this, c, 'black'); },
    m249(c) { return this.B.lmg.call(this, c, 'black', true); },
    lmg(c, col, handle) {
      this.ext(c, this.rr(-.1, .0, .23, .085, .008), .05, '*' + col);
      this.ext(c, [[-.08, .085], [.2, .085], [.19, .1], [-.07, .1]], .05, '*' + col);
      this.grip(c, 'poly', '*poly'); this.guard(c, .012, .092, .0, 'black');
      this.onMag(c, () => this.box(c, .05, .2, -.14, .0, .07, handle ? 'od' : 'black'));
      this.ext(c, this.rr(.23, .015, .46, .085, .012), .058, '*poly');
      this.cyl(c, .013, .46, .78, .05, 'steel'); this.cyl(c, .017, .75, .8, .05, 'black', 0, 12);
      if (handle) this.ext(c, [[.34, .085], [.36, .12], [.5, .12], [.52, .085]], .012, 'black');
      this.box(c, .56, .7, .02, .03, .01, 'black', .02); this.box(c, .56, .7, .02, .03, .01, 'black', -.02);
      this.ext(c, [[-.1, .075], [-.1, .02], [-.38, -.05], [-.39, .08], [-.3, .09]], .046, '*poly', 0, .0025, handle ? [[[-.14, .065], [-.14, .035], [-.33, .0], [-.33, .07]]] : null);
      return { mu: .8, mv: .05, fu: .34, fv: .015, eu: .06 };
    },
    // ================= pistols =================
    pistolCore(c, o) {
      const L = o.len || .19, sv = o.slide || '*black', fv = o.frame || '*poly';
      this.ext(c, o.slideP || [[-.036, .02], [L - .004, .02], [L, .026], [L, .05], [L - .01, .054], [-.03, .054], [-.038, .046]], .03, sv);
      this.ext(c, [[-.03, .0], [L - .03, .0], [L - .03, .021], [-.034, .021]], .028, fv);
      this.ext(c, o.gripP || [[-.036, .004], [.026, .004], [.02, -.03], [.012, -.098], [-.03, -.104], [-.046, -.07], [-.042, -.02]], .03, fv);
      this.guard(c, .01, .075, .004, fv.replace('*', '') === 'poly' ? 'poly' : 'black');
      this.box(c, .03, .038, -.018, .004, .005, 'steel');
      this.box(c, L - .02, L - .012, .054, .062, .006, 'black'); this.box(c, -.03, -.018, .054, .062, .018, 'black');
      this.onMag(c, () => this.box(c, -.036, .006, -.108, -.098, .026, 'black'));
      return { mu: L, mv: .038, fu: .0, fv: -.03, eu: .06, ev: .05 };
    },
    glock(c) { return this.B.pistolCore.call(this, c, { len: .188, slideP: [[-.036, .02], [.188, .02], [.188, .052], [-.036, .052]] }); },
    usp(c) { const r = this.B.pistolCore.call(this, c, { len: .196 }); this.lathe(c, [[.196, 0], [.196, .015], [.2, .017], [.33, .017], [.334, .012], [.334, 0]], .038, '*black'); r.mu = .334; return r; },
    p2000(c) { return this.B.pistolCore.call(this, c, { len: .178 }); },
    p250(c) { return this.B.pistolCore.call(this, c, { len: .185, slide: '*two', slideP: [[-.036, .02], [.18, .02], [.188, .03], [.184, .05], [-.028, .054], [-.038, .044]] }); },
    fiveseven(c) { return this.B.pistolCore.call(this, c, { len: .2, slide: '*two', slideP: [[-.04, .02], [.2, .02], [.206, .032], [.19, .052], [-.03, .054], [-.042, .04]] }); },
    cz75a(c) { return this.B.pistolCore.call(this, c, { len: .196, slide: '*steel', frame: '*black', slideP: [[-.036, .024], [.196, .024], [.196, .05], [.186, .054], [-.03, .054], [-.038, .046]] }); },
    deagle(c) {
      const r = this.B.pistolCore.call(this, c, { len: .26, slide: '*bright', frame: '*bright', slideP: [[-.045, .02], [.26, .02], [.266, .034], [.258, .064], [-.034, .068], [-.05, .05]], gripP: [[-.04, .004], [.03, .004], [.022, -.034], [.014, -.108], [-.034, -.114], [-.052, -.076], [-.048, -.02]] });
      this.box(c, .0, .26, .068, .074, .008, 'bright'); r.mv = .044; return r;
    },
    tec9(c) {
      this.ext(c, this.rr(-.1, .0, .12, .05, .006), .04, '*black');
      this.grip(c, 'pistol', '*poly'); this.guard(c, .01, .075, .0, 'black');
      this.onMag(c, () => this.ext(c, [[.085, .0], [.125, .0], [.12, -.16], [.08, -.16]], .026, '*black'));
      this.lathe(c, [[.12, 0], [.12, .017], [.26, .017], [.26, .011], [.29, .011], [.29, 0]], .03, 'black');
      return { mu: .29, mv: .03, fu: .1, fv: -.05, eu: .02, ev: .05 };
    },
    revolver(c) {
      this.ext(c, [[-.05, .0], [.09, .0], [.09, .062], [.02, .07], [-.04, .066], [-.06, .03]], .03, '*steel');
      this.ext(c, [[-.04, .006], [.024, .006], [.012, -.03], [.004, -.1], [-.036, -.104], [-.058, -.06], [-.052, -.02]], .034, 'wood');
      this.guard(c, .005, .07, .004, 'steel');
      const cy = this.lathe(c, [[.012, 0], [.012, .02], [.016, .025], [.066, .025], [.07, .02], [.07, 0]], .036, '*steel'); c.g.userData.cyl = cy;
      this.cyl(c, .011, .07, .22, .038, '*steel'); this.box(c, .07, .22, .046, .058, .012, '*steel');
      this.box(c, .205, .215, .058, .07, .005, 'steel'); this.box(c, -.05, -.036, .06, .08, .01, 'steel');
      this.onMag(c, () => { });
      return { mu: .22, mv: .038, fu: .0, fv: -.03, eu: .04 };
    },
    elite(c) {
      const one = (x) => {
        const sub = new THREE.Group(); sub.position.x = x; c.g.add(sub);
        const prev = c.into; c.into = sub;
        this.ext(c, [[-.036, .02], [.2, .02], [.2, .05], [.12, .054], [.1, .042], [.04, .042], [.03, .054], [-.03, .054], [-.038, .044]], .028, '*steel');
        this.cyl(c, .008, .1, .21, .038, 'steel');
        this.ext(c, [[-.03, .0], [.17, .0], [.17, .021], [-.034, .021]], .026, '*black');
        this.ext(c, [[-.036, .004], [.026, .004], [.02, -.03], [.012, -.098], [-.03, -.104], [-.046, -.07], [-.042, -.02]], .03, '*black');
        this.guard(c, .01, .075, .004, 'black');
        c.into = prev; return sub;
      };
      one(.0); const L = one(-.2); L.userData.left = true;
      this.onMag(c, () => { });
      return { mu: .21, mv: .038, fu: .0, fv: -.03, eu: .06, dual: -.2 };
    },
    generic(c) { this.box(c, -.1, .3, .0, .06, .04, '*black'); return { mu: .3, mv: .03, fu: .2 }; }
  }
};
