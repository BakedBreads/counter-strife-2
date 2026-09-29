/* ===================== world: geometry, collision, raycast, navigation ===================== */
const World = {
  def: MAPDEF, boxes: [], group: null, G: 4, off: 64, gn: 32, cells: null, stamp: null, stampId: 1,
  hgt: null, fmat: null,
  build(scene) {
    const D = this.def, N = D.N, C = D.C;
    this.group = new THREE.Group(); scene.add(this.group);
    // ---------- grid heights ----------
    const hgt = this.hgt = new Float32Array(N * N).fill(NaN);
    const fmat = this.fmat = new Array(N * N).fill(null);
    const stairCell = new Int16Array(N * N).fill(-1);
    for (const [c0, r0, c1, r1, y, m] of D.floors) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { hgt[r * N + c] = y; fmat[r * N + c] = m; }
    D.stairs.forEach((s, si) => { const [c0, r0, c1, r1] = s; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { stairCell[r * N + c] = si; fmat[r * N + c] = s[8]; } });
    const cx = c => (c - N / 2) * C, cz = r => (r - N / 2) * C;
    const B = this.boxes = [];
    const add = (x0, y0, z0, x1, y1, z1, mat, pen, kind) => { const b = { x0, y0, z0, x1, y1, z1, mat, pen: pen || 0, kind: kind || 'wall' }; B.push(b); return b; };
    // ---------- floors: greedy merge ----------
    const used = new Uint8Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c; if (used[i] || isNaN(hgt[i]) || stairCell[i] >= 0) continue;
      const y = hgt[i], m = fmat[i];
      const same = (cc, rr) => cc < N && rr < N && !used[rr * N + cc] && stairCell[rr * N + cc] < 0 && hgt[rr * N + cc] === y && fmat[rr * N + cc] === m;
      let w = 1; while (same(c + w, r)) w++;
      let h = 1; outer: while (r + h < N) { for (let k = 0; k < w; k++) if (!same(c + k, r + h)) break outer; h++; }
      for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) used[rr * N + cc] = 1;
      add(cx(c), -2, cz(r), cx(c + w), y, cz(r + h), m, 0, 'floor');
    }
    // ---------- stairs: 4 sub-steps per cell ----------
    for (const [c0, r0, c1, r1, yl, yh, ax, dir, m] of D.stairs) {
      const x0 = cx(c0), x1 = cx(c1 + 1), z0 = cz(r0), z1 = cz(r1 + 1);
      const len = ax === 'x' ? x1 - x0 : z1 - z0, K = Math.round(len / (C / 4)), st = len / K;
      for (let k = 0; k < K; k++) {
        const top = yl + (yh - yl) * (k + 1) / K;
        let a0, a1;
        if (dir > 0) { a0 = (ax === 'x' ? x0 : z0) + k * st; a1 = a0 + st; } else { a1 = (ax === 'x' ? x1 : z1) - k * st; a0 = a1 - st; }
        if (ax === 'x') add(a0, -2, z0, a1, top, z1, m, 0, 'floor'); else add(x0, -2, a0, x1, top, a1, m, 0, 'floor');
      }
    }
    // ---------- walls: greedy merge of uncarved cells ----------
    used.fill(0);
    const wallBoxes = [];
    const isWall = (c, r) => c >= 0 && r >= 0 && c < N && r < N && isNaN(hgt[r * N + c]) && stairCell[r * N + c] < 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (used[r * N + c] || !isWall(c, r)) continue;
      const same = (cc, rr) => isWall(cc, rr) && !used[rr * N + cc];
      let w = 1; while (w < 8 && same(c + w, r)) w++;
      let h = 1; outer2: while (h < 8 && r + h < N) { for (let k = 0; k < w; k++) if (!same(c + k, r + h)) break outer2; h++; }
      for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) used[rr * N + cc] = 1;
      const edge = c === 0 || r === 0 || c + w >= N || r + h >= N;
      const hh = edge ? 10 : D.wallH + Math.floor(Tex.hash(c, r, 7) * 3) * 0.8;
      const matPick = Tex.hash(c, r, 3);
      const wm = matPick < .58 ? 'plaster' : matPick < .82 ? 'blocks' : matPick < .92 ? 'plaster2' : 'brick';
      wallBoxes.push(add(cx(c), -2, cz(r), cx(c + w), hh, cz(r + h), wm, 0, 'wall'));
    }
    // ---------- explicit solids ----------
    for (const s of D.solids) add(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[6].startsWith('container') ? 'prop' : 'wall');
    // ---------- props ----------
    const propMeshes = [];
    for (const p of D.props) {
      const base = this.floorAt(p.x, p.z) + (p.on || 0);
      if (p.t === 'crate' || p.t === 'crate2') {
        const s = p.s / 2; const b = add(p.x - s, base, p.z - s, p.x + s, base + p.s, p.z + s, p.t, 1, 'crate'); propMeshes.push(b);
      } else if (p.t === 'barrel') {
        const b = add(p.x - .34, base, p.z - .34, p.x + .34, base + 1.0, p.z + .34, 'metal', 1, 'barrel'); propMeshes.push(b);
      } else {
        const b = add(p.x - p.w / 2, base, p.z - p.d / 2, p.x + p.w / 2, base + p.h, p.z + p.d / 2, p.mat, p.t === 'car' ? 1 : 0, p.t); propMeshes.push(b);
      }
    }
    for (const [tx, tz] of D.trees) { const y = this.floorAt(tx, tz); add(tx - .22, y, tz - .22, tx + .22, y + 6, tz + .22, 'wood', 0, 'tree'); }
    // ---------- spatial grid ----------
    this.cells = []; for (let i = 0; i < this.gn * this.gn; i++) this.cells.push([]);
    B.forEach((b, bi) => {
      const gx0 = clamp(Math.floor((b.x0 + this.off) / this.G), 0, this.gn - 1), gx1 = clamp(Math.floor((b.x1 - 1e-4 + this.off) / this.G), 0, this.gn - 1);
      const gz0 = clamp(Math.floor((b.z0 + this.off) / this.G), 0, this.gn - 1), gz1 = clamp(Math.floor((b.z1 - 1e-4 + this.off) / this.G), 0, this.gn - 1);
      for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) this.cells[gz * this.gn + gx].push(bi);
    });
    this.stamp = new Uint32Array(B.length);
    // ---------- render ----------
    this.buildMeshes(wallBoxes);
    this.buildDecor();
    this.buildRadar();
  },
  floorAt(x, z) {
    // top of the highest floor/stair box under this point (ignores props)
    let best = 0, found = false;
    for (const b of this.boxes) {
      if (b.kind !== 'floor') continue;
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && (!found || b.y1 > best)) { best = b.y1; found = true; }
    }
    return best;
  },
  matKind(m) {
    if (m === 'sand') return 'sand';
    if (m === 'wood' || m === 'crate' || m === 'crate2') return 'wood';
    if (m === 'metal' || m === 'containerB' || m === 'containerR') return 'metal';
    return 'hard';
  },

  /* ---------- queries ---------- */
  forOverlaps(x0, y0, z0, x1, y1, z1, cb) {
    const G = this.G, o = this.off, n = this.gn, B = this.boxes, st = ++this.stampId;
    const gx0 = clamp(Math.floor((x0 + o) / G), 0, n - 1), gx1 = clamp(Math.floor((x1 + o) / G), 0, n - 1);
    const gz0 = clamp(Math.floor((z0 + o) / G), 0, n - 1), gz1 = clamp(Math.floor((z1 + o) / G), 0, n - 1);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const L = this.cells[gz * n + gx];
      for (let k = 0; k < L.length; k++) {
        const bi = L[k]; if (this.stamp[bi] === st) continue; this.stamp[bi] = st;
        const b = B[bi];
        if (b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0 && b.z0 < z1 && b.z1 > z0) { if (cb(b) === true) return true; }
      }
    }
    return false;
  },
  overlaps(x0, y0, z0, x1, y1, z1) { return this.forOverlaps(x0, y0, z0, x1, y1, z1, () => true); },
  // returns distance along the (unit) ray or Infinity. res gets {box, nx, ny, nz}
  raycast(ox, oy, oz, dx, dy, dz, maxT, res) {
    if (dx === 0) dx = 1e-9; if (dy === 0) dy = 1e-9; if (dz === 0) dz = 1e-9;
    const G = this.G, o = this.off, n = this.gn, B = this.boxes, st = ++this.stampId;
    let best = maxT, bb = null, bax = 0;
    let gx = Math.floor((ox + o) / G), gz = Math.floor((oz + o) / G);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(G / dx) : Infinity, tdz = dz !== 0 ? Math.abs(G / dz) : Infinity;
    let tmx = dx !== 0 ? (((dx > 0 ? gx + 1 : gx) * G - o) - ox) / dx : Infinity;
    let tmz = dz !== 0 ? (((dz > 0 ? gz + 1 : gz) * G - o) - oz) / dz : Infinity;
    const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
    for (let guard = 0; guard < 200; guard++) {
      if (gx >= 0 && gx < n && gz >= 0 && gz < n) {
        const L = this.cells[gz * n + gx];
        for (let k = 0; k < L.length; k++) {
          const bi = L[k]; if (this.stamp[bi] === st) continue; this.stamp[bi] = st;
          const b = B[bi];
          let t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx, tmin, tmax, ax = 0;
          if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } tmin = t1; tmax = t2;
          t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
          if (t1 > tmin) { tmin = t1; ax = 1; } if (t2 < tmax) tmax = t2;
          t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
          if (t1 > tmin) { tmin = t1; ax = 2; } if (t2 < tmax) tmax = t2;
          if (tmax < 0 || tmin > tmax) continue;
          const te = tmin < 0 ? 0 : tmin;
          if (te < best) { best = te; bb = b; bax = tmin < 0 ? -1 : ax; }
        }
      } else if ((gx < 0 && sx < 0) || (gx >= n && sx > 0) || (gz < 0 && sz < 0) || (gz >= n && sz > 0)) break;
      const tn = tmx < tmz ? tmx : tmz;
      if (tn >= best || tn > maxT) break;
      if (tmx < tmz) { gx += sx; tmx += tdx; } else { gz += sz; tmz += tdz; }
    }
    if (!bb) return Infinity;
    if (res) {
      res.box = bb; res.nx = res.ny = res.nz = 0;
      if (bax === 0) res.nx = dx > 0 ? -1 : 1; else if (bax === 1) res.ny = dy > 0 ? -1 : 1; else if (bax === 2) res.nz = dz > 0 ? -1 : 1; else res.ny = 1;
    }
    return best;
  },
  // exit distance of a ray that entered box b
  rayExit(b, ox, oy, oz, dx, dy, dz) {
    let t = Infinity;
    const f = (o, d, a0, a1) => { if (d > 0) t = Math.min(t, (a1 - o) / d); else if (d < 0) t = Math.min(t, (a0 - o) / d); };
    f(ox, dx, b.x0, b.x1); f(oy, dy, b.y0, b.y1); f(oz, dz, b.z0, b.z1); return t;
  },
  los(a, b) { const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz); if (L < 1e-4) return true; return this.raycast(a.x, a.y, a.z, dx / L, dy / L, dz / L, L, null) >= L - 1e-3; },
  groundBelow(x, y, z) { const t = this.raycast(x, y, z, 0, -1, 0, 60, null); return t === Infinity ? 0 : y - t; },
  callout(x, z) { for (const c of this.def.callouts) if (x >= c[1] && x <= c[3] && z >= c[2] && z <= c[4]) return c[0]; return ''; },
  inSite(x, z) { for (const k in this.def.sites) { const s = this.def.sites[k]; if (x >= s[0] && x <= s[2] && z >= s[1] && z <= s[3]) return k; } return null; },
  inBuy(team, x, z) { const s = this.def.buy[team]; return !!s && x >= s[0] && x <= s[2] && z >= s[1] && z <= s[3]; },

  /* ---------- meshes ---------- */
  buildMeshes(wallBoxes) {
    const acc = {};
    const get = m => acc[m] || (acc[m] = { p: [], n: [], uv: [], c: [], faceUV: m === 'crate' || m === 'crate2' });
    const edgeLo = -60 + 0.01, edgeHi = 60 - 0.01;
    const ao = y => clamp(0.52 + 0.48 * (y / 2.6), 0.52, 1);
    for (const b of this.boxes) {
      if (b.kind === 'tree' || b.kind === 'barrel') continue;
      const A = get(b.mat), t = Tex.mats[b.mat] ? Tex.mats[b.mat].userData.tile : 4;
      const isWall = b.kind === 'wall';
      const faces = ['px', 'nx', 'pz', 'nz', 'py'];
      for (const f of faces) {
        if (isWall && ((f === 'px' && b.x1 >= 60) || (f === 'nx' && b.x0 <= -60) || (f === 'pz' && b.z1 >= 60) || (f === 'nz' && b.z0 <= -60))) continue;
        if (f === 'py' && b.y1 > 9.5) { /* top of tall border walls still drawn for silhouette */ }
        this.face(A, b, f, t, ao, b.kind === 'floor' || isWall);
      }
    }
    // wall caps (visual trim)
    const cap = get('blocks');
    for (const b of wallBoxes) {
      const c = { x0: b.x0 - .12, x1: b.x1 + .12, z0: b.z0 - .12, z1: b.z1 + .12, y0: b.y1 - .02, y1: b.y1 + .28 };
      for (const f of ['px', 'nx', 'pz', 'nz', 'py']) this.face(cap, c, f, 1.6, () => .8, false);
    }
    for (const m in acc) {
      const A = acc[m]; if (!A.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(A.c, 3));
      const mesh = new THREE.Mesh(g, Tex.mats[m] || Tex.mats.plaster);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      this.group.add(mesh);
    }
  },
  // push one box face; splits side faces at y=0 and y=2.6 so the baked ambient occlusion gradient reads well
  face(A, b, f, t, aoFn, split) {
    const { x0, y0, z0, x1, y1, z1 } = b;
    const quad = (P, N, UV, Cc) => {
      const idx = [0, 1, 2, 0, 2, 3];
      for (const i of idx) { A.p.push(P[i][0], P[i][1], P[i][2]); A.n.push(N[0], N[1], N[2]); A.uv.push(UV[i][0], UV[i][1]); A.c.push(Cc[i], Cc[i], Cc[i]); }
    };
    if (f === 'py') {
      const P = [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]];
      const UV = A.faceUV ? [[0, 0], [1, 0], [1, 1], [0, 1]] : P.map(p => [p[0] / t, -p[2] / t]);
      quad(P, [0, 1, 0], UV, [1, 1, 1, 1]); return;
    }
    const cuts = [y0];
    if (split) { if (0 > y0 + .01 && 0 < y1 - .01) cuts.push(0); if (2.6 > y0 + .01 && 2.6 < y1 - .01) cuts.push(2.6); }
    cuts.push(y1);
    for (let k = 0; k < cuts.length - 1; k++) {
      const ya = cuts[k], yb = cuts[k + 1]; let P, N;
      if (f === 'px') { P = [[x1, ya, z1], [x1, ya, z0], [x1, yb, z0], [x1, yb, z1]]; N = [1, 0, 0]; }
      else if (f === 'nx') { P = [[x0, ya, z0], [x0, ya, z1], [x0, yb, z1], [x0, yb, z0]]; N = [-1, 0, 0]; }
      else if (f === 'pz') { P = [[x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1]]; N = [0, 0, 1]; }
      else { P = [[x1, ya, z0], [x0, ya, z0], [x0, yb, z0], [x1, yb, z0]]; N = [0, 0, -1]; }
      let UV;
      if (A.faceUV) { const h = y1 - y0; UV = [[0, (ya - y0) / h], [1, (ya - y0) / h], [1, (yb - y0) / h], [0, (yb - y0) / h]]; }
      else if (f === 'px') UV = P.map(p => [-p[2] / t, p[1] / t]);
      else if (f === 'nx') UV = P.map(p => [p[2] / t, p[1] / t]);
      else if (f === 'pz') UV = P.map(p => [p[0] / t, p[1] / t]);
      else UV = P.map(p => [-p[0] / t, p[1] / t]);
      const ca = aoFn(ya), cb = aoFn(yb);
      quad(P, N, UV, [ca, ca, cb, cb]);
    }
  },
  buildDecor() {
    const D = this.def, grp = this.group;
    // site letters and arrows
    for (const [spr, x, y, z, face, size, flip] of D.decals) {
      const m = new THREE.MeshBasicMaterial({ map: Tex.sprites[spr], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: true, opacity: .9 });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
      pl.position.set(x, y, z);
      pl.rotation.y = face === 'z+' ? 0 : face === 'z-' ? Math.PI : face === 'x+' ? Math.PI / 2 : -Math.PI / 2;
      if (flip) pl.scale.x = -1;
      grp.add(pl);
    }
    // cars and barrels get a nicer silhouette on top of their collision box
    const metalDark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: .6, metalness: .4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1b2833, roughness: .15, metalness: .6 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x8d4a2a, roughness: .8, metalness: .3 });
    const barrelM = [new THREE.MeshStandardMaterial({ color: 0x7c2a22, roughness: .6, metalness: .35 }), new THREE.MeshStandardMaterial({ color: 0x2a4d6e, roughness: .6, metalness: .35 })];
    for (const b of this.boxes) {
      if (b.kind === 'car') {
        const w = b.x1 - b.x0, d = b.z1 - b.z0, long = w > d ? 'x' : 'z';
        const cxp = (b.x0 + b.x1) / 2, czp = (b.z0 + b.z1) / 2;
        const cab = new THREE.Mesh(new THREE.BoxGeometry(long === 'x' ? w * .5 : w * .9, .5, long === 'x' ? d * .9 : d * .5), glass);
        cab.position.set(cxp + (long === 'x' ? -w * .08 : 0), b.y1 + .22, czp + (long === 'z' ? -d * .08 : 0)); cab.castShadow = true; grp.add(cab);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(long === 'x' ? w * .46 : w * .86, .08, long === 'x' ? d * .86 : d * .46), rust);
        roof.position.set(cab.position.x, b.y1 + .5, cab.position.z); roof.castShadow = true; grp.add(roof);
        for (let k = 0; k < 4; k++) {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .25, 14), metalDark);
          const a = (k & 1) ? 1 : -1, c = (k & 2) ? 1 : -1;
          if (long === 'x') { wh.rotation.x = Math.PI / 2; wh.position.set(cxp + a * w * .32, b.y0 + .3, czp + c * (d / 2)); }
          else { wh.rotation.z = Math.PI / 2; wh.position.set(cxp + a * (w / 2), b.y0 + .3, czp + c * d * .32); }
          grp.add(wh);
        }
      } else if (b.kind === 'barrel') {
        const bm = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, 1.0, 18), barrelM[Math.floor(Tex.hash(b.x0 * 10, b.z0 * 10, 1) * 2)]);
        bm.position.set((b.x0 + b.x1) / 2, b.y0 + .5, (b.z0 + b.z1) / 2); bm.castShadow = bm.receiveShadow = true; grp.add(bm);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.335, .02, 6, 18), metalDark); ring.rotation.x = Math.PI / 2; ring.position.copy(bm.position); ring.position.y += .2; grp.add(ring);
        const ring2 = ring.clone(); ring2.position.y -= .4; grp.add(ring2);
      }
    }
    // barrels are drawn as cylinders; hide their box faces by removing them from the box mesh is not needed (cylinder covers it)
    // palm trees
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: .95 });
    const leafM = new THREE.MeshStandardMaterial({ color: 0x5f7f35, roughness: .8, side: THREE.DoubleSide });
    for (const [tx, tz] of D.trees) {
      const y = this.floorAt(tx, tz), tree = new THREE.Group(); tree.position.set(tx, y, tz);
      let px = 0, pz = 0, lean = Tex.hash(tx, tz, 2) * TAU;
      for (let k = 0; k < 6; k++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(.16 - k * .012, .2 - k * .012, 1.05, 8), trunkM);
        px += Math.cos(lean) * .08 * k; pz += Math.sin(lean) * .08 * k;
        seg.position.set(px, k * 1.0 + .5, pz); seg.castShadow = true; tree.add(seg);
      }
      for (let k = 0; k < 8; k++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(.7, 3.2, 1, 4), leafM);
        const pos = leaf.geometry.attributes.position;
        for (let v = 0; v < pos.count; v++) { const yy = pos.getY(v); pos.setZ(v, -(((yy + 1.6) / 3.2) ** 2) * 1.3); pos.setX(v, pos.getX(v) * (1 - Math.abs(yy) / 2.2)); }
        leaf.geometry.computeVertexNormals();
        leaf.position.set(px, 6.1, pz); leaf.rotation.order = 'YXZ'; leaf.rotation.y = k / 8 * TAU; leaf.rotation.x = -1.15;
        leaf.translateY(1.5); leaf.castShadow = true; tree.add(leaf);
      }
      grp.add(tree);
    }
    // backdrop: skyline of houses around the map and a desert floor to the horizon
    const bd = new THREE.Group();
    const noVC = m => { const c = m.clone(); c.vertexColors = false; return c; };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), noVC(Tex.mats.sand));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = false;
    const gu = ground.geometry.attributes.uv; for (let i = 0; i < gu.count; i++) gu.setXY(i, gu.getX(i) * 180, gu.getY(i) * 180);
    // keep the outside ground from showing through floors: it sits under everything and is only visible beyond the walls
    bd.add(ground);
    const rng = mulberry32(99), houseMats = [noVC(Tex.mats.plaster), noVC(Tex.mats.plaster2), noVC(Tex.mats.blocks)];
    for (let k = 0; k < 64; k++) {
      const a = k / 64 * TAU + rng() * .05, r = 72 + rng() * 30;
      const w = 8 + rng() * 14, h = 7 + rng() * 11, d = 8 + rng() * 12;
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * h / 4);
      const house = new THREE.Mesh(g, houseMats[k % 3]);
      house.position.set(Math.cos(a) * r, h / 2 - 0.5, Math.sin(a) * r); house.rotation.y = rng() * .6;
      if (Math.abs(house.position.x) < 68 && Math.abs(house.position.z) < 68) continue;
      bd.add(house);
    }
    grp.add(bd);
  },
  buildRadar() {
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), k = S / 120;
    g.clearRect(0, 0, S, S);
    const D = this.def, N = D.N;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const h = this.hgt[r * N + c]; const isSt = this.fmat[r * N + c] && isNaN(h);
      if (isNaN(h) && !isSt) continue;
      const y = isNaN(h) ? .8 : h, l = 44 + y * 16;
      g.fillStyle = `rgb(${l + 12},${l + 8},${l})`; g.fillRect(c * 2 * k, r * 2 * k, 2 * k + .5, 2 * k + .5);
    }
    // props
    g.fillStyle = 'rgba(20,18,16,.75)';
    for (const b of this.boxes) if (b.kind === 'crate' || b.kind === 'car' || b.kind === 'prop' || b.kind === 'barrel' || b.kind === 'box') g.fillRect((b.x0 + 60) * k, (b.z0 + 60) * k, (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
    // outline
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const open = (cc, rr) => cc >= 0 && rr >= 0 && cc < N && rr < N && !!this.fmat[rr * N + cc];
      if (!open(c, r)) continue;
      const x = c * 2 * k, y = r * 2 * k, s = 2 * k;
      g.beginPath();
      if (!open(c - 1, r)) { g.moveTo(x, y); g.lineTo(x, y + s); }
      if (!open(c + 1, r)) { g.moveTo(x + s, y); g.lineTo(x + s, y + s); }
      if (!open(c, r - 1)) { g.moveTo(x, y); g.lineTo(x + s, y); }
      if (!open(c, r + 1)) { g.moveTo(x, y + s); g.lineTo(x + s, y + s); }
      g.stroke();
    }
    // site tint + letters
    g.font = 'bold 44px "Barlow Condensed",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s in D.sites) {
      const [x0, z0, x1, z1] = D.sites[s];
      g.fillStyle = 'rgba(226,70,63,.13)'; g.fillRect((x0 + 60) * k, (z0 + 60) * k, (x1 - x0) * k, (z1 - z0) * k);
      g.fillStyle = 'rgba(255,90,80,.9)'; g.fillText(s, ((x0 + x1) / 2 + 60) * k, ((z0 + z1) / 2 + 60) * k);
    }
    this.radarCanvas = cv;
  },

  /* ---------- navigation ---------- */
  buildNav() {
    const R = 120, O = 60;
    const nx = [], ny = [], nz = [], col = new Array(R * R);
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const x = -O + i + .5, z = -O + j + .5; const tops = [];
      this.forOverlaps(x - .01, -5, z - .01, x + .01, 20, z + .01, b => { if (b.y1 <= 4.3 && b.kind !== 'tree') tops.push(b.y1); });
      tops.sort((a, b) => a - b);
      let last = -99;
      for (const y of tops) {
        if (y - last < .05) continue; last = y;
        // the point must not be inside another box, and a standing hull must fit (steps up to 0.45 m are fine)
        if (this.overlaps(x - .02, y + .02, z - .02, x + .02, y + .3, z + .02)) continue;
        if (this.overlaps(x - .4, y + .46, z - .4, x + .4, y + 1.8, z + .4)) continue;
        const id = nx.length; nx.push(x); ny.push(y); nz.push(z);
        (col[j * R + i] || (col[j * R + i] = [])).push(id);
      }
    }
    const n = nx.length, adj = new Array(n);
    for (let id = 0; id < n; id++) adj[id] = [];
    const cnode = (i, j, y, tol) => { if (i < 0 || j < 0 || i >= R || j >= R) return -1; const L = col[j * R + i]; if (!L) return -1; let best = -1, bd = tol; for (const m of L) { const d = Math.abs(ny[m] - y); if (d <= bd) { bd = d; best = m; } } return best; };
    const nearWall = new Uint8Array(n);
    for (let id = 0; id < n; id++) {
      const i = Math.floor(nx[id] + O), j = Math.floor(nz[id] + O), y = ny[id];
      let walkN = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const L = (i + di >= 0 && j + dj >= 0 && i + di < R && j + dj < R) ? col[(j + dj) * R + i + di] : null; if (!L) continue;
        for (const m of L) {
          const dy = ny[m] - y;
          const mx = (nx[id] + nx[m]) / 2, mz = (nz[id] + nz[m]) / 2;
          if (Math.abs(dy) <= .5) {
            if (di && dj && (cnode(i + di, j, y, .5) < 0 || cnode(i, j + dj, y, .5) < 0)) continue;
            const top = Math.max(y, ny[m]);
            if (this.overlaps(mx - .3, top + .46, mz - .3, mx + .3, top + 1.7, mz + .3)) continue;
            adj[id].push(m, Math.hypot(di, dj, dy)); walkN++;
          } else if (dy < -.5 && dy >= -3.3 && !(di && dj)) {
            if (this.overlaps(mx - .3, y + .46, mz - .3, mx + .3, y + 1.7, mz + .3)) continue;
            adj[id].push(m, 1.5 + (-dy) * .5);
          }
        }
      }
      if (walkN < 8) nearWall[id] = 1;
    }
    this.nav = { n, nx: Float32Array.from(nx), ny: Float32Array.from(ny), nz: Float32Array.from(nz), adj, col, R, O, nearWall,
      g: new Float32Array(n), f: new Float32Array(n), came: new Int32Array(n), seen: new Uint32Array(n), closed: new Uint32Array(n), gen: 0 };
    return n;
  },
  nearestNode(x, y, z) {
    const N = this.nav, i0 = Math.floor(x + N.O), j0 = Math.floor(z + N.O);
    let best = -1, bd = 1e9;
    for (let r = 0; r <= 4 && best < 0; r++) {
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (r && Math.abs(i - i0) !== r && Math.abs(j - j0) !== r) continue;
        if (i < 0 || j < 0 || i >= N.R || j >= N.R) continue;
        const L = N.col[j * N.R + i]; if (!L) continue;
        for (const m of L) {
          const dy = N.ny[m] - y; const pen = dy > .6 ? 4 + dy * 3 : (dy < -1.2 ? -dy : 0);
          const d = Math.hypot(N.nx[m] - x, N.nz[m] - z) + pen;
          if (d < bd) { bd = d; best = m; }
        }
      }
    }
    return best;
  },
  findPath(a, b) {
    const N = this.nav; if (a < 0 || b < 0) return null;
    if (a === b) return [a];
    const gen = ++N.gen, g = N.g, f = N.f, came = N.came, seen = N.seen, closed = N.closed;
    const heap = [a]; g[a] = 0; f[a] = this.h(a, b); seen[a] = gen; came[a] = -1;
    const push = v => { heap.push(v); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[v]) break; heap[k] = heap[p]; k = p; } heap[k] = v; };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let k = 0; const L = heap.length; while (true) { let c = 2 * k + 1; if (c >= L) break; if (c + 1 < L && f[heap[c + 1]] < f[heap[c]]) c++; if (f[heap[c]] >= f[last]) break; heap[k] = heap[c]; k = c; } heap[k] = last; } return top; };
    let iters = 0;
    while (heap.length && iters++ < 40000) {
      const cur = pop(); if (closed[cur] === gen) continue; closed[cur] = gen;
      if (cur === b) { const path = []; let c = b; while (c !== -1) { path.push(c); c = came[c]; } return path.reverse(); }
      const A = N.adj[cur];
      for (let k = 0; k < A.length; k += 2) {
        const m = A[k]; if (closed[m] === gen) continue;
        const ng = g[cur] + A[k + 1] + (N.nearWall[m] ? .35 : 0);
        if (seen[m] !== gen || ng < g[m]) { seen[m] = gen; g[m] = ng; came[m] = cur; f[m] = ng + this.h(m, b); push(m); }
      }
    }
    return null;
  },
  h(a, b) { const N = this.nav; return Math.hypot(N.nx[a] - N.nx[b], N.ny[a] - N.ny[b], N.nz[a] - N.nz[b]); },
  // can a player walk straight from node-height y at (ax,az) to (bx,bz)?
  walkLine(ax, az, ay, bx, bz) {
    const N = this.nav, L = Math.hypot(bx - ax, bz - az), steps = Math.ceil(L / .45);
    let y = ay;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const i = Math.floor(x + N.O), j = Math.floor(z + N.O);
      const Lc = (i >= 0 && j >= 0 && i < N.R && j < N.R) ? N.col[j * N.R + i] : null; if (!Lc) return false;
      let ok = false; for (const m of Lc) if (Math.abs(N.ny[m] - y) <= .5) { y = N.ny[m]; ok = true; break; }
      if (!ok) return false;
    }
    return true;
  },
  randomNode(filter) {
    const N = this.nav;
    for (let k = 0; k < 200; k++) { const m = Math.floor(Math.random() * N.n); if (!filter || filter(m)) return m; }
    return 0;
  }
};
