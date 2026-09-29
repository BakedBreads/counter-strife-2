/* ===================== procedural textures ===================== */
const Tex = {
  mats: {}, sprites: {}, anis: 4,
  // tiling fbm field, remapped to 0..1
  field(S, P, oct, seed, pers) {
    pers = pers == null ? 0.5 : pers;
    const out = new Float32Array(S * S); const rng = mulberry32(seed); let amp = 1, norm = 0;
    for (let o = 0; o < oct && P <= S; o++) {
      const L = new Float32Array(P * P); for (let i = 0; i < L.length; i++) L[i] = rng();
      const k = P / S;
      for (let y = 0; y < S; y++) {
        const fy = y * k, y0 = Math.floor(fy), ty = fy - y0, v = ty * ty * (3 - 2 * ty);
        const r0 = (y0 % P) * P, r1 = ((y0 + 1) % P) * P, row = y * S;
        for (let x = 0; x < S; x++) {
          const fx = x * k, x0 = Math.floor(fx), tx = fx - x0, u = tx * tx * (3 - 2 * tx);
          const c0 = x0 % P, c1 = (x0 + 1) % P;
          const a = L[r0 + c0], b = L[r0 + c1], c = L[r1 + c0], d = L[r1 + c1];
          out[row + x] += amp * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
        }
      }
      norm += amp; amp *= pers; P *= 2;
    }
    let mn = 1e9, mx = -1e9;
    for (let i = 0; i < out.length; i++) { const v = out[i] / norm; out[i] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
    const rg = mx - mn || 1; for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / rg;
    return out;
  },
  hash(a, b, s) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; },
  // fn(i, x, y) must write col[0..2] (0..255) and return height 0..1
  paint(S, fn) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); const img = g.createImageData(S, S), d = img.data;
    const H = new Float32Array(S * S), col = [0, 0, 0];
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
      H[i] = fn(i, x, y, col);
      const j = i * 4; d[j] = clamp(col[0], 0, 255); d[j + 1] = clamp(col[1], 0, 255); d[j + 2] = clamp(col[2], 0, 255); d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { cv, H, S };
  },
  normalCanvas(t, str) {
    const { H, S } = t; const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const xl = (x - 1 + S) % S, xr = (x + 1) % S, yu = (y - 1 + S) % S, yd = (y + 1) % S;
      const dx = (H[y * S + xr] - H[y * S + xl]) * str, dy = (H[yd * S + x] - H[yu * S + x]) * str;
      let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const j = (y * S + x) * 4; d[j] = (nx * .5 + .5) * 255; d[j + 1] = (ny * .5 + .5) * 255; d[j + 2] = (nz * .5 + .5) * 255; d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0); return cv;
  },
  tex(cv, srgb) {
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.anis; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t;
  },
  mat(t, o) {
    const m = new THREE.MeshStandardMaterial({
      map: this.tex(t.cv, true), normalMap: this.tex(this.normalCanvas(t, o.ns || 6), false),
      roughness: o.rough == null ? 0.9 : o.rough, metalness: o.metal || 0, vertexColors: !!o.vc
    });
    m.normalScale.set(o.nk || 1, o.nk || 1);
    m.userData.tile = o.tile || 4; m.userData.name = o.name;
    return m;
  },

  /* ---------- generators ---------- */
  sand(S) {
    const f1 = this.field(S, 4, 6, 11), f2 = this.field(S, 64, 3, 12), f3 = this.field(S, 8, 4, 13), pb = this.field(S, 128, 1, 14);
    return this.paint(S, (i, x, y, c) => {
      const rip = Math.sin((x / S * 6 + y / S * 2 + f3[i] * 1.6) * TAU) * .5 + .5;
      const peb = pb[i] > .82 ? (pb[i] - .82) * 5 : 0;
      const tone = .8 + .28 * f1[i] + (f2[i] - .5) * .2 - peb * .25 + rip * .04;
      c[0] = 218 * tone; c[1] = 188 * tone; c[2] = 140 * tone * (.94 + .1 * f3[i]);
      return f1[i] * .3 + f2[i] * .35 + rip * .15 + peb * .6;
    });
  },
  plaster(S, base, seed) {
    seed = seed || 21;
    const f1 = this.field(S, 3, 6, seed), f2 = this.field(S, 32, 4, seed + 1), f3 = this.field(S, 6, 5, seed + 2), fc = this.field(S, 4, 6, seed + 3), f4 = this.field(S, 2, 3, seed + 4);
    const rows = 16, cols = 8, bw = S / cols, bh = S / rows;
    return this.paint(S, (i, x, y, c) => {
      const stain = smooth01((f1[i] - .55) / .35), r = 1 - Math.abs(2 * fc[i] - 1), crack = smooth01((r - .965) / .025);
      const chip = smooth01((f3[i] - .86) / .04) * .85;
      let R = base[0], G = base[1], Bc = base[2];
      const tone = .9 + f2[i] * .14 + (f4[i] - .5) * .12 - stain * .16 - crack * .45;
      R *= tone; G *= tone; Bc *= tone * (1 - stain * .06);
      let h = .62 + f2[i] * .12 - crack * .5;
      if (chip > 0) {
        const row = Math.floor(y / bh), off = (row & 1) * bw * .5, bx = (x + off) % bw, by = y % bh;
        const edge = Math.min(bx, bw - bx, by, bh - by), mort = edge < S * .004;
        const bt = .85 + this.hash(Math.floor((x + off) / bw), row, 5) * .25;
        const br = mort ? [160, 150, 132] : [168 * bt, 128 * bt, 98 * bt];
        R = lerp(R, br[0], chip); G = lerp(G, br[1], chip); Bc = lerp(Bc, br[2], chip);
        h -= chip * (mort ? .55 : .3);
      }
      c[0] = R; c[1] = G; c[2] = Bc; return h;
    });
  },
  blocks(S, rows, cols, base, mortar, seed) {
    const f1 = this.field(S, 4, 5, seed), f2 = this.field(S, 32, 4, seed + 1), f3 = this.field(S, 16, 3, seed + 2);
    const bw = S / cols, bh = S / rows, mw = S * .006;
    return this.paint(S, (i, x, y, c) => {
      const row = Math.floor(y / bh), off = (row & 1) * bw * .5, xx = (x + off) % S, col = Math.floor(xx / bw);
      const bx = xx - col * bw, by = y - row * bh, edge = Math.min(bx, bw - bx, by, bh - by);
      const hsh = this.hash(col, row, seed), tint = .84 + hsh * .26;
      if (edge < mw) { const m = .9 + f2[i] * .2; c[0] = mortar[0] * m; c[1] = mortar[1] * m; c[2] = mortar[2] * m; return .15 + f2[i] * .05; }
      const bev = smooth01((edge - mw) / (S * .014));
      const wear = smooth01((f3[i] - .6) / .3);
      const tone = tint * (.84 + f1[i] * .24 + (f2[i] - .5) * .12) * (1 - wear * .12) * (.9 + bev * .1);
      c[0] = base[0] * tone; c[1] = base[1] * tone * (.98 + hsh * .04); c[2] = base[2] * tone;
      return .45 + bev * .35 + f2[i] * .12 - wear * .1;
    });
  },
  concrete(S, base, seed) {
    const f1 = this.field(S, 4, 6, seed), f2 = this.field(S, 64, 3, seed + 1), f3 = this.field(S, 32, 2, seed + 2);
    const half = S / 2, sw = S * .004;
    return this.paint(S, (i, x, y, c) => {
      const dx = Math.min(x % half, half - x % half), dy = Math.min(y % half, half - y % half);
      const seam = (dx < sw || dy < sw) ? 1 : 0, pit = f3[i] > .86 ? 1 : 0;
      const tone = (.82 + f1[i] * .26 + (f2[i] - .5) * .14) * (1 - seam * .35) * (1 - pit * .25);
      c[0] = base[0] * tone; c[1] = base[1] * tone; c[2] = base[2] * tone;
      return .5 + f2[i] * .2 - seam * .4 - pit * .3;
    });
  },
  tiles(S, n, pal, grout, seed) {
    const f1 = this.field(S, 4, 5, seed), f2 = this.field(S, 64, 3, seed + 1), fc = this.field(S, 8, 5, seed + 2);
    const tw = S / n, gw = S * .007;
    return this.paint(S, (i, x, y, c) => {
      const tx = Math.floor(x / tw), ty = Math.floor(y / tw), bx = x - tx * tw, by = y - ty * tw;
      const edge = Math.min(bx, tw - bx, by, tw - by);
      if (edge < gw) { c[0] = grout[0]; c[1] = grout[1]; c[2] = grout[2]; return .1; }
      const h = this.hash(tx, ty, seed), p = pal[Math.floor(h * pal.length) % pal.length];
      const r = 1 - Math.abs(2 * fc[i] - 1), crack = r > .975 ? 1 : 0;
      const bev = smooth01((edge - gw) / (S * .012));
      const tone = (.86 + f1[i] * .22 + (f2[i] - .5) * .12) * (1 - crack * .35) * (.9 + bev * .1);
      c[0] = p[0] * tone; c[1] = p[1] * tone; c[2] = p[2] * tone;
      return .5 + bev * .3 + f2[i] * .15 - crack * .3;
    });
  },
  metal(S, base, seed, corr) {
    const f1 = this.field(S, 4, 6, seed), f2 = this.field(S, 64, 3, seed + 1), f3 = this.field(S, 8, 5, seed + 2);
    return this.paint(S, (i, x, y, c) => {
      const rust = smooth01((f1[i] - .68) / .2), scr = (this.hash(x >> 1, Math.floor(y / 3), seed) > .997) ? 1 : 0;
      const ridge = corr ? Math.sin(x / S * corr * TAU) : 0;
      const tone = (.82 + f3[i] * .2 + (f2[i] - .5) * .1 + ridge * .06) * (1 + scr * .4);
      c[0] = lerp(base[0] * tone, 120 * (.7 + f2[i] * .4), rust); c[1] = lerp(base[1] * tone, 66 * (.7 + f2[i] * .4), rust); c[2] = lerp(base[2] * tone, 38 * (.7 + f2[i] * .4), rust);
      return .5 + ridge * .45 + f2[i] * .1 - rust * .1;
    });
  },
  wood(S, base, planks, vertical, seed) {
    const f1 = this.field(S, 8, 5, seed), f2 = this.field(S, 64, 2, seed + 1);
    const pw = S / planks;
    return this.paint(S, (i, x, y, c) => {
      const a = vertical ? x : y, b = vertical ? y : x;
      const p = Math.floor(a / pw), within = a - p * pw, gap = within < S * .006 ? 1 : 0;
      const grain = Math.sin((b / S * 3 + f1[i] * 5 + p * 1.7) * TAU * 2) * .5 + .5;
      const tint = .85 + this.hash(p, 0, seed) * .3;
      const tone = tint * (.78 + grain * .18 + f2[i] * .1) * (1 - gap * .6);
      c[0] = base[0] * tone; c[1] = base[1] * tone; c[2] = base[2] * tone;
      return .5 + grain * .15 - gap * .5;
    });
  },
  crate(S, base, seed) {
    const f1 = this.field(S, 8, 5, seed), f2 = this.field(S, 64, 2, seed + 1);
    const fw = .11 * S;
    return this.paint(S, (i, x, y, c) => {
      const frame = x < fw || x > S - fw || y < fw || y > S - fw;
      // diagonal brace
      const d = Math.abs((x - y)) / Math.SQRT2, brace = !frame && d < fw * .5;
      let grain, tone, h;
      if (frame || brace) {
        grain = Math.sin(((frame && (x < fw || x > S - fw) ? y : x) / S * 4 + f1[i] * 4) * TAU * 2) * .5 + .5;
        tone = 1.05 * (.8 + grain * .15 + f2[i] * .1); h = .8;
        const e = frame ? Math.min(Math.abs(x - fw), Math.abs(x - (S - fw)), Math.abs(y - fw), Math.abs(y - (S - fw)), x, S - x, y, S - y) : Math.abs(d - fw * .5);
        if (e < S * .008) { tone *= .55; h = .5; }
        const nail = [[fw / 2, fw / 2], [S - fw / 2, fw / 2], [fw / 2, S - fw / 2], [S - fw / 2, S - fw / 2]].some(([nx, ny]) => Math.hypot(x - nx, y - ny) < S * .012);
        if (nail) { c[0] = c[1] = c[2] = 70; return .9; }
      } else {
        const pw = (S - 2 * fw) / 4, pp = Math.floor((y - fw) / pw), wy = (y - fw) - pp * pw;
        grain = Math.sin((x / S * 3 + f1[i] * 5 + pp * 2.1) * TAU * 2) * .5 + .5;
        tone = (.72 + this.hash(pp, 3, seed) * .2) * (.8 + grain * .16 + f2[i] * .08); h = .4;
        if (wy < S * .006) { tone *= .45; h = .1; }
      }
      c[0] = base[0] * tone; c[1] = base[1] * tone; c[2] = base[2] * tone; return h;
    });
  },

  /* ---------- small 2D canvas sprites ---------- */
  canvas(S, fn) { const cv = document.createElement('canvas'); cv.width = cv.height = S; fn(cv.getContext('2d'), S); return cv; },
  spriteTex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; },
  buildSprites() {
    const sp = this.sprites;
    sp.puff = this.spriteTex(this.canvas(128, (g, S) => {
      const img = g.createImageData(S, S), d = img.data; const f = this.field(S, 4, 4, 91);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), r = Math.hypot(dx, dy);
        const a = Math.max(0, 1 - r) ** 1.4 * (.55 + f[y * S + x] * .7);
        const j = (y * S + x) * 4; d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = clamp(a * 255, 0, 255);
      }
      g.putImageData(img, 0, 0);
    }));
    sp.glow = this.spriteTex(this.canvas(64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }));
    sp.flash = this.spriteTex(this.canvas(128, (g, S) => {
      g.translate(S / 2, S / 2);
      for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3 + (k % 2) * .2); const gr = g.createLinearGradient(0, 0, S / 2, 0); gr.addColorStop(0, 'rgba(255,245,200,1)'); gr.addColorStop(1, 'rgba(255,160,40,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -S * .06); g.lineTo(S / 2 * (.7 + (k % 3) * .15), 0); g.lineTo(0, S * .06); g.fill(); }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, S * .28); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, S * .28, 0, TAU); g.fill();
    }));
    sp.hole = this.spriteTex(this.canvas(64, (g, S) => {
      const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(10,8,6,1)'); gr.addColorStop(.28, 'rgba(25,20,16,.95)'); gr.addColorStop(.42, 'rgba(60,50,40,.55)'); gr.addColorStop(1, 'rgba(60,50,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }));
    sp.scorch = this.spriteTex(this.canvas(128, (g, S) => {
      const img = g.createImageData(S, S), d = img.data; const f = this.field(S, 8, 4, 77);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const r = Math.hypot(x - S / 2, y - S / 2) / (S / 2); const a = clamp((1 - r) * 1.6 * (.5 + f[y * S + x] * .8), 0, .92);
        const j = (y * S + x) * 4; d[j] = 20; d[j + 1] = 16; d[j + 2] = 12; d[j + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    }));
    sp.blood = this.spriteTex(this.canvas(64, (g, S) => {
      g.fillStyle = 'rgba(110,8,8,.9)';
      for (let k = 0; k < 14; k++) { const a = Math.random() * TAU, r = Math.random() * S * .3; g.beginPath(); g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 2 + Math.random() * S * .14, 0, TAU); g.fill(); }
    }));
    sp.letterA = this.spriteTex(this.letter('A'));
    sp.letterB = this.spriteTex(this.letter('B'));
    sp.arrowA = this.spriteTex(this.letter('A', true));
    sp.arrowB = this.spriteTex(this.letter('B', true));
  },
  letter(ch, arrow) {
    return this.canvas(256, (g, S) => {
      g.clearRect(0, 0, S, S);
      g.font = `bold ${arrow ? 120 : 200}px "Barlow Condensed",Impact,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 10;
      g.fillStyle = 'rgba(30,30,30,.85)';
      if (arrow) {
        g.fillText(ch, S * .32, S / 2);
        g.beginPath(); g.moveTo(S * .55, S * .42); g.lineTo(S * .78, S * .42); g.lineTo(S * .78, S * .32); g.lineTo(S * .95, S * .5); g.lineTo(S * .78, S * .68); g.lineTo(S * .78, S * .58); g.lineTo(S * .55, S * .58); g.closePath(); g.fill();
      } else g.fillText(ch, S / 2, S / 2 + 8);
      // spray-paint speckle
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .5})`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
    });
  },

  async build(renderer, progress) {
    this.anis = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const hi = Settings.v.texQ === 'high', S1 = hi ? 1024 : 512, S2 = 512;
    const M = this.mats;
    const steps = [
      ['sand', () => M.sand = this.mat(this.sand(S1), { tile: 5, rough: .95, ns: 5, vc: true, name: 'sand' })],
      ['plaster', () => M.plaster = this.mat(this.plaster(S1, [226, 208, 172], 21), { tile: 4.5, rough: .92, ns: 5, vc: true, name: 'plaster' })],
      ['plaster2', () => M.plaster2 = this.mat(this.plaster(S2, [214, 186, 150], 31), { tile: 4, rough: .92, ns: 5, vc: true, name: 'plaster' })],
      ['blocks', () => M.blocks = this.mat(this.blocks(S1, 6, 3, [214, 182, 130], [168, 150, 122], 41), { tile: 3.2, rough: .9, ns: 7, vc: true, name: 'stone' })],
      ['brick', () => M.brick = this.mat(this.blocks(S2, 20, 6, [150, 84, 58], [150, 140, 128], 51), { tile: 2.4, rough: .9, ns: 6, vc: true, name: 'stone' })],
      ['concrete', () => M.concrete = this.mat(this.concrete(S2, [150, 147, 140], 61), { tile: 4, rough: .88, ns: 4, vc: true, name: 'concrete' })],
      ['tiles', () => M.tiles = this.mat(this.tiles(S1, 3, [[196, 136, 92], [182, 124, 84], [206, 156, 108], [170, 118, 82]], [120, 100, 82], 71), { tile: 3, rough: .8, ns: 5, vc: true, name: 'stone' })],
      ['stone', () => M.stone = this.mat(this.tiles(S2, 2, [[176, 168, 150], [164, 156, 140], [186, 178, 160]], [110, 104, 96], 81), { tile: 3, rough: .85, ns: 5, vc: true, name: 'stone' })],
      ['metal', () => M.metal = this.mat(this.metal(S2, [64, 104, 118], 91, 0), { tile: 2, rough: .55, metal: .35, ns: 3, vc: true, name: 'metal' })],
      ['container', () => { M.containerB = this.mat(this.metal(S2, [44, 86, 140], 101, 14), { tile: 3, rough: .6, metal: .3, ns: 10, vc: true, name: 'metal' }); M.containerR = this.mat(this.metal(S2, [150, 52, 38], 111, 14), { tile: 3, rough: .6, metal: .3, ns: 10, vc: true, name: 'metal' }); }],
      ['wood', () => M.wood = this.mat(this.wood(S2, [104, 70, 42], 6, true, 121), { tile: 2, rough: .85, ns: 4, vc: true, name: 'wood' })],
      ['crate', () => { M.crate = this.mat(this.crate(S2, [178, 132, 80], 131), { tile: 1, rough: .85, ns: 6, vc: true, name: 'wood' }); M.crate2 = this.mat(this.crate(S2, [120, 118, 84], 141), { tile: 1, rough: .85, ns: 6, vc: true, name: 'wood' }); }],
      ['sprites', () => this.buildSprites()]
    ];
    for (let i = 0; i < steps.length; i++) {
      progress && progress('Generating textures: ' + steps[i][0], i / steps.length);
      await new Promise(r => setTimeout(r, 0));
      steps[i][1]();
    }
  }
};
