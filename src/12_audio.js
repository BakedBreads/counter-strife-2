/* ===================== audio: every sound is synthesized ===================== */
const SFX = {
  ctx: null, master: null, bus: null, uiBus: null, buf: {}, ready: false, voices: 0,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    // soft ceiling instead of a compressor (compressors add makeup gain and still clip)
    const sh = c.createWaveShaper(); const curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2); }
    sh.curve = curve; sh.oversample = '2x';
    this.master.connect(sh); sh.connect(c.destination);
    this.bus = c.createGain(); this.bus.connect(this.master);
    this.uiBus = c.createGain(); this.uiBus.connect(this.master);
    this.gen();
    this.ready = true;
    this.applyVolume();
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { }); },
  applyVolume() {
    if (!this.ctx) return;
    const s = Settings.v;
    this.master.gain.value = s.volume * 0.9;
    this.bus.gain.value = s.sfx;
    this.uiBus.gain.value = s.ui;
  },
  setListener(pos, fwd) {
    if (!this.ready) return;
    const l = this.ctx.listener, t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t); l.positionY.setValueAtTime(pos.y, t); l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(fwd.x, t); l.forwardY.setValueAtTime(fwd.y, t); l.forwardZ.setValueAtTime(fwd.z, t);
      l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  },
  // opt: pos(V3) | vol | rate | ref | roll | occ (muffled through walls) | ui | loop
  play(name, opt) {
    if (!this.ready) return null;
    const b = this.buf[name]; if (!b) return null;
    opt = opt || {};
    if (this.voices > 48 && !opt.ui) return null;
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = b;
    src.playbackRate.value = (opt.rate || 1) * (opt.norand ? 1 : (1 + (Math.random() - 0.5) * 0.06));
    if (opt.loop) src.loop = true;
    const g = c.createGain(); g.gain.value = opt.vol == null ? 1 : opt.vol;
    src.connect(g);
    let tail = g;
    if (opt.occ) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.5; tail.connect(f); tail = f; g.gain.value *= 0.7; }
    if (opt.pos) {
      const p = c.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
      p.refDistance = opt.ref || 5; p.rolloffFactor = opt.roll == null ? 1 : opt.roll; p.maxDistance = 400;
      if (p.positionX) { p.positionX.value = opt.pos.x; p.positionY.value = opt.pos.y; p.positionZ.value = opt.pos.z; }
      else p.setPosition(opt.pos.x, opt.pos.y, opt.pos.z);
      tail.connect(p); tail = p;
    }
    tail.connect(opt.ui ? this.uiBus : this.bus);
    this.voices++;
    src.onended = () => { this.voices--; try { src.disconnect(); } catch (e) { } };
    src.start(opt.when ? c.currentTime + opt.when : 0);
    return { src, g, stop: () => { try { src.stop(); } catch (e) { } } };
  },
  ui(name, vol) { return this.play(name, { ui: true, vol: vol == null ? 1 : vol, norand: true }); },
  say(text) {
    if (!Settings.v.announcer || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
      const pref = vs.find(v => /male|david|guy|mark|daniel/i.test(v.name)) || vs[0];
      if (pref) u.voice = pref;
      u.rate = 1.05; u.pitch = 0.8; u.volume = clamp(Settings.v.volume * 1.1, 0, 1);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { }
  },

  /* ---------------- synthesis ---------------- */
  gen() {
    const c = this.ctx, sr = c.sampleRate;
    let seed = 1234;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    const mk = (dur, fn, peak) => {
      const n = Math.max(1, Math.floor(dur * sr)); const b = c.createBuffer(1, n, sr); const d = b.getChannelData(0);
      fn(d, n);
      let m = 0; for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > m) m = a; }
      if (m > 0) { const k = (peak || 0.9) / m; for (let i = 0; i < n; i++) d[i] *= k; }
      // tiny fade in/out to avoid clicks
      const f = Math.min(64, n >> 2); for (let i = 0; i < f; i++) { d[i] *= i / f; d[n - 1 - i] *= i / f; }
      return b;
    };
    const lpA = fc => 1 - Math.exp(-TAU * fc / sr);
    // RBJ biquad
    const biq = (type, f0, Q) => {
      const w = TAU * f0 / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
      let b0, b1, b2, a0, a1, a2;
      if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
      else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
      else { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
      b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      return x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
    };
    const B = this.buf;

    const gun = (p) => mk(p.dur, (d, n) => {
      const hp = biq('hp', p.crackHP || 2500, 0.7), a1 = lpA(p.bodyLP), a2 = lpA(p.tailLP), bpR = biq('bp', p.ring || 900, 3);
      let l1 = 0, l2 = 0, l2b = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, w = rnd();
        const crack = hp(w) * Math.exp(-t / (p.crackT || 0.004)) * p.crack;
        l1 += a1 * (w - l1);
        const body = l1 * Math.exp(-t / p.bodyD) * p.body * 3;
        const f = p.f1 + (p.f0 - p.f1) * Math.exp(-t / 0.02);
        ph += TAU * f / sr;
        const thump = Math.sin(ph) * Math.exp(-t / p.thD) * p.thump;
        l2 += a2 * (w - l2); l2b += a2 * (l2 - l2b);
        const tailEnv = Math.min(1, t / 0.012) * Math.exp(-t / p.tailD);
        const tail = l2b * tailEnv * p.tail * 6;
        const ring = bpR(w) * Math.exp(-t / 0.05) * (p.ringA || 0);
        d[i] = Math.tanh((crack + body + thump + tail + ring) * 1.4);
      }
    }, p.peak || 0.95);
    B.g_pistol = gun({ dur: .6, crack: .6, body: .9, bodyLP: 3200, bodyD: .04, thump: .6, f0: 190, f1: 60, thD: .05, tail: .3, tailLP: 900, tailD: .3, ringA: .3, ring: 1800, peak: .8 });
    B.g_heavyp = gun({ dur: .9, crack: .9, body: 1, bodyLP: 2400, bodyD: .07, thump: 1, f0: 150, f1: 45, thD: .09, tail: .45, tailLP: 700, tailD: .55, ringA: .2, ring: 1200, peak: .95 });
    B.g_rifle = gun({ dur: .85, crack: .8, body: 1, bodyLP: 2700, bodyD: .06, thump: .9, f0: 140, f1: 48, thD: .07, tail: .38, tailLP: 800, tailD: .5, ringA: .15, ring: 1100, peak: .95 });
    B.g_m4 = gun({ dur: .8, crack: .7, body: .9, bodyLP: 3600, bodyD: .05, thump: .7, f0: 165, f1: 55, thD: .06, tail: .32, tailLP: 1000, tailD: .45, ringA: .2, ring: 1500, peak: .9 });
    B.g_smg = gun({ dur: .5, crack: .6, body: .8, bodyLP: 4200, bodyD: .035, thump: .5, f0: 210, f1: 75, thD: .04, tail: .22, tailLP: 1300, tailD: .28, ringA: .25, ring: 2100, peak: .8 });
    B.g_awp = gun({ dur: 1.7, crack: 1, body: 1, bodyLP: 1900, bodyD: .12, thump: 1.2, f0: 110, f1: 32, thD: .16, tail: .65, tailLP: 480, tailD: 1.1, ringA: .1, ring: 700, peak: 1 });
    B.g_scout = gun({ dur: 1.2, crack: .9, body: .9, bodyLP: 2600, bodyD: .08, thump: .9, f0: 130, f1: 40, thD: .1, tail: .45, tailLP: 650, tailD: .8, ringA: .2, ring: 1300, peak: .95 });
    B.g_shotgun = gun({ dur: 1.1, crack: .7, body: 1.1, bodyLP: 1700, bodyD: .1, thump: 1.1, f0: 120, f1: 40, thD: .12, tail: .5, tailLP: 600, tailD: .75, ringA: .1, ring: 800, peak: 1 });
    B.g_mg = gun({ dur: .8, crack: .8, body: 1, bodyLP: 2300, bodyD: .065, thump: 1, f0: 130, f1: 45, thD: .08, tail: .4, tailLP: 700, tailD: .5, ringA: .12, ring: 900, peak: .95 });
    B.g_sil = gun({ dur: .35, crack: .12, crackHP: 5000, body: .55, bodyLP: 1300, bodyD: .025, thump: .28, f0: 240, f1: 90, thD: .03, tail: .07, tailLP: 1500, tailD: .12, ringA: .5, ring: 3000, peak: .55 });
    B.zeus = mk(.45, (d, n) => { const bp = biq('bp', 2400, 1.5); for (let i = 0; i < n; i++) { const t = i / sr; const buzz = Math.sign(Math.sin(TAU * 118 * t)) * 0.4 + (Math.random() < 0.02 ? rnd() * 3 : 0); d[i] = (buzz + bp(rnd()) * 2) * Math.exp(-t / .18); } }, .8);

    const clickS = (dur, f, Q, dec, peak) => mk(dur, (d, n) => { const bp = biq('bp', f, Q); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * Math.exp(-t / dec); } }, peak);
    B.dry = clickS(.06, 3000, 4, .008, .5);
    B.click = clickS(.05, 2600, 3, .006, .45);
    B.mag_out = mk(.25, (d, n) => { const bp = biq('bp', 2200, 3), bp2 = biq('bp', 700, 2); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * Math.exp(-t / .01) + bp2(rnd()) * 0.5 * Math.exp(-Math.abs(t - .09) / .03); } }, .6);
    B.mag_in = mk(.25, (d, n) => { const bp = biq('bp', 1800, 3), bp2 = biq('bp', 3400, 5); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * (t > .02 ? Math.exp(-(t - .02) / .015) : 0) + bp2(rnd()) * (t > .06 ? Math.exp(-(t - .06) / .01) : 0) * 1.3; } }, .7);
    B.bolt = mk(.32, (d, n) => { const bp = biq('bp', 2600, 4); for (let i = 0; i < n; i++) { const t = i / sr; const e = Math.exp(-t / .012) + (t > .12 ? Math.exp(-(t - .12) / .012) * 1.2 : 0); d[i] = bp(rnd()) * e + Math.sin(TAU * 3200 * t) * 0.25 * e; } }, .7);
    B.pump = mk(.4, (d, n) => { const lp = biq('lp', 900, 1), bp = biq('bp', 2000, 3); for (let i = 0; i < n; i++) { const t = i / sr; const e = Math.exp(-t / .03) + (t > .18 ? Math.exp(-(t - .18) / .03) * 1.2 : 0); d[i] = (lp(rnd()) * 1.5 + bp(rnd())) * e; } }, .75);
    B.shell_in = clickS(.12, 1500, 2.5, .02, .6);
    B.draw = mk(.3, (d, n) => { const bp = biq('bp', 1400, 1.2), bp2 = biq('bp', 3000, 4); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * Math.sin(Math.PI * Math.min(1, t / .16)) * 0.6 + bp2(rnd()) * (t > .18 ? Math.exp(-(t - .18) / .01) : 0); } }, .5);
    B.shell = mk(.2, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 4200 * t) + Math.sin(TAU * 6100 * t) * .6) * Math.exp(-t / .03); } }, .25);

    const step = (lpF, crunch, s) => mk(.16, (d, n) => { seed = s; const lp = biq('lp', lpF, 0.8), hp = biq('hp', 3000, 0.7); for (let i = 0; i < n; i++) { const t = i / sr; const e = Math.exp(-t / .025) + (t > .045 ? Math.exp(-(t - .045) / .03) * .7 : 0); d[i] = lp(rnd()) * e * 2 + hp(rnd()) * crunch * e; } }, .7);
    B.step1 = step(700, .5, 11); B.step2 = step(800, .45, 29); B.step3 = step(650, .55, 71); B.step4 = step(750, .5, 97);
    B.stepm = mk(.18, (d, n) => { const bp = biq('bp', 1300, 6), bp2 = biq('bp', 2900, 8); for (let i = 0; i < n; i++) { const t = i / sr; const e = Math.exp(-t / .03); d[i] = (bp(rnd()) + bp2(rnd()) * .7) * e; } }, .6);
    B.land = mk(.25, (d, n) => { const lp = biq('lp', 400, .8); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = lp(rnd()) * Math.exp(-t / .05) * 3; } }, .8);

    B.slash = mk(.28, (d, n) => { const f0 = 500, f1 = 3000; let y1 = 0, y2 = 0; for (let i = 0; i < n; i++) { const t = i / sr, k = t / .28; const f = f0 + (f1 - f0) * k; const w = TAU * f / sr, al = Math.sin(w) / 6, cs = Math.cos(w); const x = rnd(); const y = (al * x - (-2 * cs) * y1 - (1 - al) * y2) / (1 + al); y2 = y1; y1 = y; d[i] = y * Math.sin(Math.PI * Math.min(1, k)); } }, .5);
    B.stab = mk(.3, (d, n) => { const lp = biq('lp', 350, 1); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * (160 - 100 * t) / sr; d[i] = lp(rnd()) * 3 * Math.exp(-t / .06) + Math.sin(ph) * Math.exp(-t / .05); } }, .8);
    B.knife_wall = mk(.4, (d, n) => { const hp = biq('hp', 2000, .7); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 1850 * t) + Math.sin(TAU * 2760 * t) * .7 + Math.sin(TAU * 4130 * t) * .5) * Math.exp(-t / .09) + hp(rnd()) * Math.exp(-t / .01); } }, .6);

    B.hit_body = mk(.18, (d, n) => { const lp = biq('lp', 500, 1); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = lp(rnd()) * 3 * Math.exp(-t / .04) + rnd() * .3 * Math.exp(-t / .004); } }, .7);
    B.hit_helmet = mk(.45, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 2350 * t) + Math.sin(TAU * 3720 * t) * .6 + Math.sin(TAU * 5600 * t) * .25) * Math.exp(-t / .1) + rnd() * Math.exp(-t / .003); } }, .75);
    B.hit_head = mk(.25, (d, n) => { const lp = biq('lp', 900, 1.2); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * 190 / sr; d[i] = lp(rnd()) * 3 * Math.exp(-t / .05) + Math.sin(ph) * .6 * Math.exp(-t / .06); } }, .8);
    B.hit_armor = mk(.2, (d, n) => { const bp = biq('bp', 900, 2); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * 3 * Math.exp(-t / .035); } }, .7);

    B.imp_hard = mk(.2, (d, n) => { const hp = biq('hp', 1500, .7), lp = biq('lp', 600, 1); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = hp(rnd()) * Math.exp(-t / .006) + lp(rnd()) * 2 * Math.exp(-t / .03); } }, .5);
    B.imp_metal = mk(.35, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 3100 * t) + Math.sin(TAU * 5200 * t) * .5) * Math.exp(-t / .06) + rnd() * Math.exp(-t / .004); } }, .5);
    B.imp_wood = mk(.2, (d, n) => { const bp = biq('bp', 420, 3), lp = biq('lp', 1200, .8); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * 4 * Math.exp(-t / .03) + lp(rnd()) * Math.exp(-t / .01); } }, .5);
    B.imp_sand = mk(.18, (d, n) => { const lp = biq('lp', 900, .7); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = lp(rnd()) * 2 * Math.exp(-t / .04); } }, .4);
    B.ricochet = mk(.4, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * (3200 - 3000 * t + Math.sin(t * 70) * 150) / sr; d[i] = Math.sin(ph) * Math.exp(-t / .12) * (t < .01 ? t / .01 : 1); } }, .35);
    B.whiz = mk(.25, (d, n) => { const bp = biq('bp', 2500, 2); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * Math.sin(Math.PI * t / .25); } }, .35);

    const boom = (dur, lpF, thumpD, tailD, peak) => mk(dur, (d, n) => {
      const lp = biq('lp', lpF, .7), lp2 = biq('lp', lpF * .4, .7), hp = biq('hp', 1800, .7); let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr; ph += TAU * (30 + 70 * Math.exp(-t / .12)) / sr;
        d[i] = Math.tanh(Math.sin(ph) * 1.4 * Math.exp(-t / thumpD) + lp(rnd()) * 3 * Math.exp(-t / tailD) + lp2(rnd()) * 3 * Math.exp(-t / (tailD * 2)) + hp(rnd()) * Math.exp(-t / .01));
      }
    }, peak);
    B.he = boom(2.2, 1400, .35, .5, 1);
    B.c4boom = boom(4, 700, .7, 1.1, 1);
    B.flashbang = mk(1.2, (d, n) => { const hp = biq('hp', 1200, .7), lp = biq('lp', 800, .7); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.tanh(hp(rnd()) * 2 * Math.exp(-t / .05) + lp(rnd()) * 3 * Math.exp(-t / .3)); } }, 1);
    B.ring = mk(3.2, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(TAU * 3400 * t) * (0.8 + 0.2 * Math.sin(TAU * 3 * t)) * Math.min(1, t / .05) * Math.exp(-t / 1.3); } }, .5);
    B.smoke = mk(3, (d, n) => { const hp = biq('hp', 2200, .6), lp = biq('lp', 5000, .6); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = lp(hp(rnd())) * Math.min(1, t / .08) * Math.exp(-t / 1.1); } }, .55);
    B.molly = mk(1.2, (d, n) => { const lp = biq('lp', 700, .7); const pings = []; for (let k = 0; k < 18; k++) pings.push([Math.random() * .12, 2000 + Math.random() * 4500]); for (let i = 0; i < n; i++) { const t = i / sr; let s = 0; for (const [t0, f] of pings) if (t > t0) s += Math.sin(TAU * f * (t - t0)) * Math.exp(-(t - t0) / .03) * .3; d[i] = s + lp(rnd()) * 2.5 * Math.min(1, t / .15) * Math.exp(-t / .5); } }, .8);
    B.fire = mk(2.0, (d, n) => { const lp = biq('lp', 500, .7), bp = biq('bp', 2500, 1); for (let i = 0; i < n; i++) { const t = i / sr; const pop = Math.random() < 0.0015 ? 1 : 0; d[i] = lp(rnd()) * 2 + bp(rnd() * pop * 30); } }, .5);
    B.bounce = mk(.12, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 2100 * t) + Math.sin(TAU * 3300 * t) * .5 + rnd() * .5) * Math.exp(-t / .025); } }, .4);
    B.pin = mk(.3, (d, n) => { const bp = biq('bp', 3500, 5); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * Math.exp(-t / .01) + Math.sin(TAU * 4800 * t) * .3 * Math.exp(-t / .08); } }, .5);
    B.throw = mk(.3, (d, n) => { const bp = biq('bp', 900, 1); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * Math.sin(Math.PI * t / .3); } }, .45);

    B.beep = mk(.09, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 2350 * t) * .8 + Math.sign(Math.sin(TAU * 2350 * t)) * .2) * (t < .07 ? 1 : Math.max(0, 1 - (t - .07) / .02)); } }, .6);
    B.key = mk(.12, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 1209 * t) + Math.sin(TAU * 770 * t)) * (t < .09 ? 1 : 0); } }, .35);
    B.defuse = mk(.3, (d, n) => { const bp = biq('bp', 2800, 4); for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp(rnd()) * (Math.exp(-t / .01) + (t > .15 ? Math.exp(-(t - .15) / .01) : 0)); } }, .5);

    const chord = (freqs, dur, dec, peak, arp) => mk(dur, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; let s = 0; freqs.forEach((f, k) => { const t0 = arp ? k * arp : 0; if (t < t0) return; const tt = t - t0; s += (Math.sin(TAU * f * tt) + Math.sin(TAU * f * 2 * tt) * .3 + Math.sin(TAU * f * 3 * tt) * .12) * Math.exp(-tt / dec) * Math.min(1, tt / .01); }); d[i] = s; } }, peak);
    B.ui_click = mk(.05, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(TAU * 1800 * t) * Math.exp(-t / .008); } }, .35);
    B.ui_hover = mk(.03, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(TAU * 2600 * t) * Math.exp(-t / .005); } }, .12);
    B.buy = chord([1320, 1760], .25, .06, .4, .06);
    B.deny = mk(.2, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sign(Math.sin(TAU * 140 * t)) * Math.exp(-t / .08); } }, .3);
    B.round_start = chord([392, 523, 659], .9, .35, .5, .08);
    B.win = chord([523, 659, 784, 1046], 1.8, .6, .6, .07);
    B.lose = chord([440, 523, 622], 1.6, .5, .5, .09);
    B.mvp = chord([659, 784, 988, 1318], 1.6, .45, .55, .12);
    B.tick = mk(.05, (d, n) => { for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(TAU * 1000 * t) * Math.exp(-t / .01); } }, .35);
    B.pickup = clickS(.1, 1800, 2, .015, .6);
  }
};
