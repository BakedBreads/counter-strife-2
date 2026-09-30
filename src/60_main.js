/* ===================== app: renderer, loop, camera, viewmodel ===================== */
const SUN_DIR = new V3(-.42, .82, .38).normalize();
const App = {
  renderer: null, scene: null, camera: null, vmScene: null, vmCam: null, inGame: false, paused: false,
  stepOffset: 0, landKick: 0, landVel: 0, landW: 14, captureFlash: false, specTarget: null, thirdPerson: false, spectating: false,
  vm: null, vmKey: '', vmBob: 0, swayX: 0, swayY: 0, lastT: 0, fpsT: 0, fpsN: 0, fov: 74, deathT: 0, killer: null,
  specYaw: 0, specPitch: .2, menuT: 0, vmLight: 1, lastFireT: -9,
  async boot() {
    const bar = $('#loadbar i'), txt = $('#loadtxt');
    const prog = (t, f) => { txt.textContent = t; bar.style.transform = 'scaleX(' + clamp(f, 0, 1).toFixed(3) + ')'; };
    prog('Starting renderer', .02);
    await new Promise(r => setTimeout(r, 30));
    const S = Settings.v;
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: S.aa, powerPreference: 'high-performance', stencil: false }); }
    catch (e) { txt.textContent = 'WebGL is not available in this browser. Try Chrome, Edge or Firefox with hardware acceleration on.'; return; }
    this.renderer = r;
    r.domElement.className = 'gl'; $('#app').prepend(r.domElement);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.02;
    r.shadowMap.enabled = S.shadows !== 'off'; r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd9c6a2, 110, 360);
    this.camera = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, .05, 900); this.camera.rotation.order = 'YXZ';
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(S.vmFov, innerWidth / innerHeight, .01, 5);
    this.vmScene.add(this.vmCam);
    // lights
    const hemi = new THREE.HemisphereLight(0xcfe0ff, 0xb3936a, .95); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 3.3); sun.position.copy(SUN_DIR).multiplyScalar(140); sun.target.position.set(0, 0, 0);
    sun.castShadow = true; const sc = sun.shadow.camera; sc.left = -78; sc.right = 78; sc.top = 78; sc.bottom = -78; sc.near = 20; sc.far = 320;
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .035; this.sun = sun;
    this.scene.add(sun); this.scene.add(sun.target);
    this.scene.add(new THREE.AmbientLight(0xffffff, .12));
    const vh = new THREE.HemisphereLight(0xdfe8ff, 0x8a7458, 1.3); this.vmScene.add(vh); this.vmHemi = vh;
    const vs = new THREE.DirectionalLight(0xfff0d6, 2.6); this.vmScene.add(vs); this.vmScene.add(vs.target); this.vmSun = vs;
    this.buildSky();
    this.buildEnv();
    this.applySettings();
    prog('Generating textures', .06);
    await Tex.build(r, (t, f) => prog(t, .06 + f * .5));
    prog('Loading agents', .57); await new Promise(r2 => setTimeout(r2, 0));
    try { await Agents.load(); } catch (e) { console.warn('agent model failed, using fallback models', e); }
    prog('Building de_dustline', .6); await new Promise(r2 => setTimeout(r2, 0));
    World.build(this.scene);
    prog('Computing bot navigation', .72); await new Promise(r2 => setTimeout(r2, 0));
    World.buildNav();
    prog('Preparing effects', .8); await new Promise(r2 => setTimeout(r2, 0));
    FX.init(this.scene);
    prog('Rendering weapon icons', .86); await new Promise(r2 => setTimeout(r2, 0));
    Models.makeIcons(r);
    if (Agents.ready) Agents.makePortraits(r);
    prog('Warming up shaders', .94); await new Promise(r2 => setTimeout(r2, 0));
    HUD.init(); Menu.init(); Input.init(r.domElement);
    Input.onKey = (code, e) => this.onKey(code, e);
    Input.onLockChange = (locked, err) => this.onLock(locked, err);
    this.menuChar = Models.character(Math.random() < .5 ? 'CT' : 'T'); this.scene.add(this.menuChar.root);
    this.refreshMenuModel();
    try { r.compile(this.scene, this.camera); } catch (e) { }
    window.addEventListener('resize', () => this.resize()); this.resize();
    prog('Photographing de_dustline', .97); await new Promise(r2 => setTimeout(r2, 0));
    try { this.makeThumbs(); } catch (e) { console.warn('map thumbnails failed', e); }
    document.addEventListener('visibilitychange', () => { this.lastT = performance.now(); });
    const unlockAudio = () => { SFX.init(); SFX.resume(); };
    window.addEventListener('pointerdown', unlockAudio); window.addEventListener('keydown', unlockAudio);
    // Ctrl is crouch, and Ctrl+W closes a browser tab: ask before leaving a running match
    window.addEventListener('beforeunload', e => { if (this.inGame) { e.preventDefault(); e.returnValue = ''; } });
    $('#clickplay').addEventListener('click', () => { SFX.init(); SFX.resume(); if (Settings.v.autoFull && !document.fullscreenElement) this.toggleFullscreen(true); this.relock(); });
    prog('Ready', 1);
    await new Promise(r2 => setTimeout(r2, 150));
    show('#loading', false);
    Menu.open('home');
    this.lastT = performance.now();
    r.setAnimationLoop(t => this.frame(t));
    window.__cs = { Game, World, App, Net, HUD, Menu, W, Settings, Combat, Input, SFX, FX, Items, Grenades, MAPDEF, BotAI };
  },
  buildSky() {
    const g = new THREE.SphereGeometry(600, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sun: { value: SUN_DIR.clone() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 sun; varying vec3 vD;
        void main(){ float h = clamp(vD.y, -0.2, 1.0);
          vec3 zen = vec3(0.24,0.45,0.78), hor = vec3(0.86,0.8,0.68), gnd = vec3(0.7,0.6,0.45);
          vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : mix(hor, gnd, min(1.0, -h * 5.0));
          float s = max(dot(normalize(vD), sun), 0.0);
          c += vec3(1.0,0.85,0.6) * pow(s, 400.0) * 3.0 + vec3(1.0,0.8,0.55) * pow(s, 12.0) * 0.25;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.sky = new THREE.Mesh(g, m); this.sky.frustumCulled = false; this.sky.renderOrder = -1; this.scene.add(this.sky);
  },
  // image-based lighting from the sky, so metal and paint pick up reflections (PBR looks flat without it)
  buildEnv() {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.sky.material));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshBasicMaterial({ color: 0x9c8260 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2; env.add(floor);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromScene(env, .03);
    this.scene.environment = rt.texture; this.vmScene.environment = rt.texture;
    this.scene.environmentIntensity = .55; this.vmScene.environmentIntensity = .8;
    pm.dispose();
  },
  // pictures of both bomb sites for the map cards and the crosshair preview
  makeThumbs() {
    const r = this.renderer, W2 = 640, H2 = 360, out = {};
    const cam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 900);
    const cv = document.createElement('canvas'); cv.width = W2; cv.height = H2; const g = cv.getContext('2d');
    const shots = { A: [[47, 11, -13], [35, 1.5, -44]], B: [[-25, 11, -13], [-43, 1, -41]] };
    const ch = this.menuChar, vis = ch && ch.root.visible; if (ch) ch.root.visible = false;
    for (const k in shots) {
      const [p, t] = shots[k]; cam.position.set(p[0], p[1], p[2]); cam.lookAt(t[0], t[1], t[2]); cam.updateMatrixWorld();
      r.setRenderTarget(null); r.clear(); r.render(this.scene, cam);
      const cw = r.domElement.width, chh = r.domElement.height, sh = Math.min(chh, cw * H2 / W2), sw = sh * W2 / H2;
      g.drawImage(r.domElement, (cw - sw) / 2, (chh - sh) / 2, sw, sh, 0, 0, W2, H2);
      out[k] = cv.toDataURL('image/jpeg', .84);
    }
    if (ch) ch.root.visible = vis;
    this.thumbs = out;
  },
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCam.aspect = w / h; this.vmCam.updateProjectionMatrix();
    const fc = $('#flashImg'); fc.width = Math.max(1, Math.floor(w / 2)); fc.height = Math.max(1, Math.floor(h / 2));
  },
  applySettings() {
    const S = Settings.v, r = this.renderer; if (!r) return;
    r.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1)) * S.renderScale);
    const want = S.shadows !== 'off';
    if (r.shadowMap.enabled !== want) { r.shadowMap.enabled = want; this.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } }); }
    const size = S.shadows === 'high' ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    // dolly zoom: a longer lens with the weapon pushed back by vmK frames it exactly as S.vmFov would,
    // with flatter perspective so the forearms and gloves near the camera do not balloon
    const lens = Math.max(30, S.vmFov - 24); this.vmK = Math.tan(S.vmFov / 2 * DEG) / Math.tan(lens / 2 * DEG);
    this.vmCam.fov = lens; this.vmCam.updateProjectionMatrix();
    SFX.applyVolume();
    show('#fps', S.showFps);
    if (innerWidth) this.resize();
  },
  toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), 2600); },
  confirm(title, text, ok, cb) {
    const d = $('#dialog'); show(d, true);
    d.innerHTML = `<div class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn danger" id="dOk">${esc(ok)}</button><button class="btn" id="dNo">Cancel</button></div></div>`;
    $('#dOk').addEventListener('click', () => { show(d, false); cb(); });
    $('#dNo').addEventListener('click', () => show(d, false));
  },
  alert(title, text) {
    const d = $('#dialog'); show(d, true);
    d.innerHTML = `<div class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn" id="dOk">OK</button></div></div>`;
    $('#dOk').addEventListener('click', () => show(d, false));
  },
  refreshMenuModel() {
    const ch = this.menuChar; if (!ch) return;
    Models.setCharGun(ch, ch.team === 'T' ? 'ak47' : 'm4a1s', Loadout.skinFor(ch.team === 'T' ? 'ak47' : 'm4a1s'), Loadout.v.knife);
    this.vmKey = '';
  },

  /* ---------- match flow ---------- */
  startMatch(cfg) {
    SFX.init(); SFX.resume();
    Menu.close(); show('#matchEnd', false); HUD.reset();
    if (this.menuChar) this.menuChar.root.visible = false;
    this.clearVM();
    Game.start(cfg);
    this.inGame = true; this.paused = false; this.specTarget = null; this.thirdPerson = false; this.deathT = 0;
    HUD.show(true); Menu.pause(false);
    if (Settings.v.autoFull && !document.fullscreenElement) this.toggleFullscreen(true);
    this.relock();
  },
  startClientMatch(cfg, roster, myId) {
    Menu.close(); show('#matchEnd', false); HUD.reset(); Game.stop();
    if (this.menuChar) this.menuChar.root.visible = false;
    const G = Game;
    G.cfg = cfg || {}; G.mode = Object.assign({}, MODES[G.cfg.mode] || MODES.competitive); G.time = 0; G.round = 0; G.score = { CT: 0, T: 0 }; G.history = [];
    G.maxRounds = G.mode.maxRounds || 0; G.win = G.mode.win || 0; G.running = true; G.phase = 'freeze'; G.bomb = { state: 'none' };
    for (const r of roster) {
      const p = G.addPlayer({ id: r.id, name: r.name, team: r.team, isLocal: r.id === myId });
      p.isBot = !!r.bot; p.skins = r.skins || null; p.knifeType = r.knife || 'default';
      if (p.isLocal) { G.local = p; p.knifeType = Loadout.v.knife; }
    }
    const lp = G.local; lp.clearInventory(); lp.alive = false;
    this.inGame = true; this.paused = false; this.specTarget = null; this.deathT = 0;
    HUD.show(true); Menu.pause(false);
    show('#clickplay', true);
  },
  leaveMatch(fromNet) {
    Game.stop(); this.inGame = false; this.paused = false;
    if (!fromNet && Net.role !== 'off') Net.leave();
    HUD.show(false); HUD.reset(); Menu.pause(false); show('#clickplay', false); show('#matchEnd', false);
    Input.unlock(); Input.setVCursor(false);
    this.clearVM();
    if (this.menuChar) this.menuChar.root.visible = true;
    Menu.open(Net.role !== 'off' ? 'online' : 'home');
  },
  matchOver(winner, reason) { Input.unlock(); HUD.closeBuy(); Menu.matchEnd(winner, reason); },
  onRoundStart() { this.specTarget = null; this.deathT = 0; this.thirdPerson = false; if (Game.local) Game.local.pitch = 0; },
  onRespawn() { this.specTarget = null; this.deathT = 0; this.thirdPerson = false; },
  onLocalDeath(att) {
    if (this.deathT && Game.time - this.deathT < .5) return;
    this.deathT = Game.time; this.killer = att || null; HUD.closeBuy();
    if (att && att !== Game.local) HUD.center('', 'Killed by ' + att.name, 3);
    const lp = Game.local; if (lp) { lp.zoom = 0; lp.planting = false; lp.defusing = false; }
  },
  changeTeam(t) {
    const G = Game, lp = G.local; if (!lp || Net.role !== 'off' || G.mode.ffa) return;
    if (t === 'auto') t = G.teamOf('T').length < G.teamOf('CT').length ? 'T' : 'CT';
    if (t === lp.team) return;
    const bot = G.players.find(p => p.team === t && p.isBot);
    if (bot) { bot.team = lp.team; G.rebuildModel(bot); bot.bot.reset(); if (G.phase !== 'freeze') { bot.alive = false; } }
    lp.team = t; G.rebuildModel(lp);
    if (lp.c4 && t === 'CT') G.dropWeapon(lp, lp.c4, true);
    if (G.phase === 'freeze') { G.spawnAll(); for (const p of G.players) { if (!p.secondary) p.secondary = new WeaponInst(p.team === 'T' ? 'glock' : 'usp', p.skinFor(p.team === 'T' ? 'glock' : 'usp')); if (!p.active) p.equip(p.best(), true); } BotAI.newRound(); }
    else { lp.alive = false; lp.hp = 0; this.onLocalDeath(null); }
    HUD.sys(lp.name + ' joined the ' + (t === 'T' ? 'Terrorists' : 'Counter-Terrorists'));
  },
  relock() { if (!this.inGame || this.paused) return; show('#clickplay', false); Input.lock(); setTimeout(() => { if (this.inGame && !Input.locked && !this.paused && !Input.typing && !this.overlayOpen()) show('#clickplay', true); }, 350); },
  overlayOpen() { return HUD.buyOpen || HUD.teamOpen; },
  overlayChanged() { Input.setVCursor(this.overlayOpen()); },
  onLock(locked, err) {
    if (!this.inGame) return;
    if (locked) { show('#clickplay', false); Input.setVCursor(this.overlayOpen()); return; }
    if (Input.typing || this.paused) return;
    if (this.overlayOpen()) { HUD.closeBuy(); HUD.closeTeam(); }
    if (err) { show('#clickplay', true); return; }
    if (!$('#matchEnd').classList.contains('hidden')) return;
    this.openPause();
  },
  openPause() { this.paused = true; show('#clickplay', false); Menu.pause(true); HUD.showScores(false); },
  resume() { this.paused = false; Menu.pause(false); SFX.resume(); this.relock(); },
  toggleFullscreen(quiet) {
    if (document.fullscreenElement) { if (!quiet) document.exitFullscreen().catch(() => { }); return; }
    const el = document.documentElement;
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p) p.then(() => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => { }); if (!quiet) this.toast('Fullscreen: hold Esc to leave'); if (this.paused) this.resume(); }).catch(() => { if (!quiet) this.toast('Fullscreen was blocked by the browser'); });
  },
  onKey(code, e) {
    if (!this.inGame) {
      if (code !== 'Escape') return false;
      if (!$('#dialog').classList.contains('hidden')) { show('#dialog', false); return true; }
      if (Menu.pane !== 'home' && !$('#menu').classList.contains('hidden')) { Menu.open('home'); return true; }
      return false;
    }
    const b = Settings.v.binds, lp = Game.local;
    if (code === 'Escape') {
      if (!$('#dialog').classList.contains('hidden')) { show('#dialog', false); return true; }
      if (HUD.buyOpen) { HUD.closeBuy(); return true; }
      if (HUD.teamOpen) { HUD.closeTeam(); return true; }
      if (this.paused) { this.resume(); return true; }
      if (Game.phase !== 'matchover') { Input.unlock(); this.openPause(); return true; }
      return false;
    }
    if (this.paused || Game.phase === 'matchover') return false;
    if (HUD.buyOpen && code.startsWith('Digit')) { HUD.buyKey(+code.slice(5)); return true; }
    if (code === b.buy) { if (HUD.buyOpen) HUD.closeBuy(); else HUD.openBuy(); return true; }
    if (code === b.chat || code === b.teamChat) { if (!e.repeat) { HUD.openChat(code === b.teamChat); if (Input.locked) Input.unlock(); } return true; }
    if (code === b.teamMenu) { if (HUD.teamOpen) HUD.closeTeam(); else HUD.openTeam(); return true; }
    if (!Input.locked && !this.overlayOpen() && (code === 'Enter' || code === 'Space')) { this.relock(); return true; }
    return false;
  },

  /* ---------- per frame ---------- */
  frame(tms) {
    const now = performance.now();
    let dt = (now - this.lastT) / 1000; this.lastT = now;
    if (!(dt > 0)) dt = 1 / 60; dt = Math.min(dt, .1);
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT > .5) { if (Settings.v.showFps) $('#fps').textContent = Math.round(this.fpsN / this.fpsT) + ' fps · ' + Math.round(this.renderer.info.render.calls) + ' draws'; this.fpsT = 0; this.fpsN = 0; }
    if (this.inGame) this.gameFrame(dt); else this.menuFrame(dt);
    Input.endFrame();
  },
  menuFrame(dt) {
    // an agent showing off the equipped rifle skin on A site, camera drifting slowly around it
    this.menuT += dt;
    const ch = this.menuChar, cam = this.camera, base = _v3.set(33.5, 1.6, -40.5), cyaw = .6;
    if (ch) {
      ch.root.visible = true; ch.root.position.copy(base); ch.root.rotation.y = cyaw;
      Models.animChar(ch, { speed: 0, crouch: 0, air: false, pitch: -.08 + Math.sin(this.menuT * .7) * .03, dead: 0, planting: false, cat: 'rifle', dt });
    }
    const a = cyaw - .75 + Math.sin(this.menuT * .12) * .3, f = dirFromAngles(a, 0, _v1);
    cam.position.set(base.x + f.x * 3.3, base.y + 1.5, base.z + f.z * 3.3);
    // aim at the hips, not the model origin: the idle animation shifts the body off it
    let lx = base.x, lz = base.z;
    if (ch && ch.rig && ch.rig.bones.Hips) { ch.root.updateMatrixWorld(true); ch.rig.bones.Hips.getWorldPosition(_v2); lx = _v2.x; lz = _v2.z; }
    cam.lookAt(lx, base.y + 1.05, lz);
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
    FX.update(dt, cam, this.scene.fog);
    this.render(false);
  },
  gameFrame(dt) {
    const G = Game, lp = G.local, S = Settings.v;
    Net.tick(dt);
    // look
    if (lp && Input.locked && !Input.vc.on && !this.paused) {
      const zoomK = lp.zoom > 0 && lp.active && lp.active.def.scope ? (lp.active.def.scope[lp.zoom - 1] / S.fov) * S.zoomRatio : 1;
      const k = S.sens * .022 * DEG * zoomK;
      if (lp.alive) {
        lp.yaw = wrapAngle(lp.yaw - Input.mdx * k);
        lp.pitch = clamp(lp.pitch - Input.mdy * k * (S.invertY ? -1 : 1), -89 * DEG, 89 * DEG);
      } else { this.specYaw -= Input.mdx * k; this.specPitch = clamp(this.specPitch - Input.mdy * k, -1.2, 1.4); }
      this.swayX += Input.mdx * .0006; this.swayY += Input.mdy * .0006;
    }
    this.swayX *= Math.exp(-dt * 10); this.swayY *= Math.exp(-dt * 10);
    // commands
    if (lp) this.buildCmd(lp);
    // simulation in small fixed-size steps
    let rem = dt; const maxStep = 1 / 120;
    while (rem > 1e-6) { const st = Math.min(maxStep, rem); Game.step(st); rem -= st; }
    // remote players drawn 100 ms behind, with their hitboxes
    for (const p of G.players) if ((Net.role === 'client' && !p.isLocal) || (Net.role === 'host' && p.remote)) Net.interp(p);
    // spectating
    if (lp && !lp.alive) this.updateSpectate(dt);
    // tab scoreboard
    const sc = Input.down('scores') && !this.paused;
    if (sc !== HUD.scoreOpen) HUD.showScores(sc);
    FX.update(dt, this.camera, this.scene.fog);
    this.updateCamera(dt);
    this.updateModels(dt);
    this.updateVM(dt);
    const vp = G.viewPlayer();
    if (vp) SFX.setListener(this.camera.position, this.camera.getWorldDirection(_v1));
    HUD.update(dt);
    this.render(true);
    if (this.captureFlash) { this.captureFlash = false; try { const fc = $('#flashImg'); fc.getContext('2d').drawImage(this.renderer.domElement, 0, 0, fc.width, fc.height); } catch (e) { } }
  },
  buildCmd(lp) {
    const c = lp.cmd, I = Input, free = !this.paused && !Input.typing && Input.locked;
    if (!lp.alive || !free) {
      c.fwd = c.side = 0; c.fire = c.fire2 = false; c.walk = false; c.use = false;
      if (!lp.alive) {
        c.duck = false; if (I.mbHit[0]) this.cycleSpec(1); if (I.mbHit[2]) this.cycleSpec(-1);
        // third person starts behind the watched player instead of wherever the orbit was left
        if (I.hit('jump')) { this.thirdPerson = !this.thirdPerson; if (this.thirdPerson && this.specTarget) { this.specYaw = this.specTarget.yaw; this.specPitch = .25; } }
      }
      return;
    }
    c.fwd = (I.down('forward') ? 1 : 0) - (I.down('back') ? 1 : 0);
    c.side = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
    c.walk = I.down('walk'); c.duck = I.down('crouch');
    // with the buy menu open the mouse drives the cursor, not the gun
    c.fire = I.mb[0] && !I.vc.on; c.fire2 = I.mb[2] && !I.vc.on;
    if (I.mbHit[0] && !I.vc.on) c.fireHit = true; if (I.mbHit[2] && !I.vc.on) c.fire2Hit = true;
    if (I.hit('jump')) c.jumpHit = true;
    c.use = I.down('use'); if (I.hit('use')) c.useHit = true;
    if (I.hit('reload')) c.reload = true;
    if (I.hit('inspect')) c.inspect = true;
    if (I.hit('drop')) c.dropHit = true;
    if (!HUD.buyOpen) for (let n = 1; n <= 5; n++) if (I.hit('slot' + n)) lp.selectSlot(n);
    if (I.hit('lastWeapon')) lp.lastWeapon();
    if (I.wheel) lp.cycle(I.wheel > 0 ? 1 : -1);
    // CS2 style: mouse wheel down also jumps? no. Keep wheel for weapon switching.
  },
  cycleSpec(dir) {
    const lp = Game.local; if (!lp) return;
    const pool = Game.players.filter(p => p.alive && p !== lp && (Game.mode.ffa || !lp.isEnemy(p) || Game.alive(lp.team).length === 0));
    if (!pool.length) { this.specTarget = null; return; }
    let i = pool.indexOf(this.specTarget); i = (i + dir + pool.length) % pool.length; this.specTarget = pool[i];
  },
  updateSpectate(dt) {
    const lp = Game.local, now = Game.time;
    if (now - this.deathT < 2.2 && !Game.mode.respawn) { this.specTarget = null; return; }
    if (Game.mode.respawn) { this.specTarget = null; return; }
    if (!this.specTarget || !this.specTarget.alive) { this.specTarget = null; this.cycleSpec(1); }
  },
  updateCamera(dt) {
    const G = Game, lp = G.local, cam = this.camera, S = Settings.v;
    let fovT = S.fov;
    this.stepOffset = clamp(this.stepOffset * Math.exp(-dt * 14), -.6, .6); if (Math.abs(this.stepOffset) < .001) this.stepOffset = 0;
    // critically damped spring for the landing dip (sub-stepped so low frame rates stay stable)
    for (let t = dt; t > 1e-6; t -= 1 / 240) { const h = Math.min(t, 1 / 240), w = this.landW; this.landVel += (-w * w * this.landKick - 2 * w * this.landVel) * h; this.landKick += this.landVel * h; }
    if (Math.abs(this.landKick) < 1e-4 && Math.abs(this.landVel) < 1e-3) this.landKick = this.landVel = 0;
    const sh = FX.shake;
    if (lp && lp.alive) {
      const e = lp.eye(_v1);
      cam.position.set(e.x, e.y + this.stepOffset - this.landKick, e.z);
      cam.rotation.set(lp.pitch + lp.punchY * DEG * .45 + lp.flinchY + (Math.random() - .5) * sh * .02, lp.yaw - lp.punchX * DEG * .45 + lp.flinchX + (Math.random() - .5) * sh * .02, 0);
      if (lp.zoom > 0 && lp.active && lp.active.def.scope) fovT = lp.active.def.scope[lp.zoom - 1];
    } else if (lp) {
      const t = this.specTarget;
      if (t && t.alive) {
        if (this.thirdPerson) {
          const e = t.eye(_v1), d = dirFromAngles(this.specYaw, -this.specPitch, _v2);
          const dist = 3.2; const hit = World.raycast(e.x, e.y, e.z, -d.x, -d.y, -d.z, dist, null);
          const L = Math.min(dist, hit - .2);
          cam.position.set(e.x - d.x * L, e.y - d.y * L, e.z - d.z * L); cam.lookAt(e);
        } else {
          const e = t.eye(_v1); cam.position.copy(e);
          cam.rotation.set(t.pitch + t.punchY * DEG * .45, t.yaw - t.punchX * DEG * .45, 0);
          if (t.zoom > 0 && t.active && t.active.def.scope) fovT = t.active.def.scope[t.zoom - 1];
        }
      } else {
        // death cam: look at the killer from where we fell
        const e = lp.eye(_v1); e.y = lp.pos.y + .6 + Math.min(1.2, (G.time - this.deathT) * .6);
        cam.position.lerp(e, 1 - Math.exp(-dt * 4));
        const k = this.killer && this.killer.alive ? this.killer : null;
        if (k) { const q = cam.quaternion.clone(); cam.lookAt(k.pos.x, k.pos.y + 1.4, k.pos.z); const q2 = cam.quaternion.clone(); cam.quaternion.copy(q).slerp(q2, 1 - Math.exp(-dt * 3)); cam.rotation.setFromQuaternion(cam.quaternion, 'YXZ'); }
        else if (!Game.mode.respawn && G.time - this.deathT > 2.2) {
          // nobody left to watch: slow overview
          const a = G.time * .05; cam.position.set(Math.sin(a) * 30, 22, Math.cos(a) * 30); cam.lookAt(0, 0, -5);
        }
      }
    }
    this.fov = lerp(this.fov, fovT, 1 - Math.exp(-dt * 18));
    if (Math.abs(cam.fov - this.fov) > .01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  },
  updateModels(dt) {
    const G = Game, vp = G.viewPlayer(), now = G.time;
    for (const p of G.players) {
      const ch = p.model; if (!ch) continue;
      const firstPersonHidden = (p === vp && (p.alive && (p === G.local || !this.thirdPerson)));
      const showBody = p.alive || (p.deathT && now - p.deathT < 60);
      ch.root.visible = !firstPersonHidden && showBody && G.phase !== 'idle';
      if (!ch.root.visible) continue;
      ch.root.position.copy(p.pos);
      ch.root.rotation.y = p.yaw;
      const deadP = p.alive ? 0 : clamp((now - p.deathT) / .7, 0, 1);
      const w = p.active;
      Models.setCharGun(ch, p.alive && w ? w.id : null, w ? w.skin : 'default', p.knifeType);
      const fwdS = -Math.sin(p.yaw) * p.vel.x - Math.cos(p.yaw) * p.vel.z, sideS = Math.cos(p.yaw) * p.vel.x - Math.sin(p.yaw) * p.vel.z;
      Models.animChar(ch, { speed: Math.hypot(p.vel.x, p.vel.z), fwdSpeed: fwdS, sideSpeed: sideS, crouch: p.duckAmt, air: !p.onGround, pitch: p.pitch, dead: deadP, planting: p.planting || p.defusing, cat: w ? w.def.cat : 'rifle', dt });
      if (!p.alive) ch.root.rotation.y = p.yaw;
      // mark enemies the local player can see for the radar
      if (p.alive && G.local && G.local.alive && G.local.isEnemy(p)) { if ((p._visT = (p._visT || 0) - dt) <= 0) { p._visT = .15; if (World.los(G.local.eye(_v3), _v4.set(p.pos.x, p.pos.y + 1.4, p.pos.z)) && !G.smokeBlocks(G.local.eye(_v3), _v4)) p.spotLocal = now; } }
    }
  },
  /* ---------- viewmodel ---------- */
  clearVM() { if (this.vm) { this.vmCam.remove(this.vm); this.vm = null; } if (this.vmArms) { this.vmCam.remove(this.vmArms.root); this.vmArms = null; } this.vmKey = ''; },
  vmPointWorld(which) {
    const out = new V3();
    if (!this.vm) return this.camera.position.clone();
    const gun = this.vm.userData.gun, vp = Game.viewPlayer();
    let node = gun.userData[which] || gun.userData.muzzle;
    if (which === 'muzzle' && gun.userData.muzzle2 && vp && (vp.shotCount || 0) % 2 === 0) node = gun.userData.muzzle2;
    this.vm.updateMatrixWorld(true);
    node.getWorldPosition(out); // in vmCam space (vmCam sits at the origin with identity rotation)
    out.z /= this.vmK || 1; // undo the dolly push so effects start where the muzzle appears
    // take it into the world camera space: viewmodel FOV differs slightly, which is fine for effects
    return this.camera.localToWorld(out);
  },
  updateVM(dt) {
    const G = Game, lp = G.local, S = Settings.v, now = G.time;
    const vp = G.viewPlayer();
    const show = vp && vp.alive && !this.thirdPerson && vp.active && !(vp.zoom > 0 && vp.active.def.scope);
    if (!show) { if (this.vm) this.vm.visible = false; if (this.vmArms) this.vmArms.root.visible = false; return; }
    const w = vp.active, key = w.uid + '|' + w.skin + '|' + vp.team + '|' + (w.id === 'knife' ? vp.knifeType : '');
    if (key !== this.vmKey) {
      this.clearVM(); this.vmKey = key;
      this.vm = Models.viewModel(w.id, w.skin, vp.team, vp.knifeType);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(.22, .22), new THREE.MeshBasicMaterial({ map: Tex.sprites.flash, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      fl.visible = false; this.vm.userData.gun.userData.muzzle.add(fl); this.vm.userData.flash = fl;
      this.vmCam.add(this.vm);
      if (typeof Agents !== 'undefined' && Agents.ready) { this.vmArms = Agents.viewArms(vp.team); this.vmCam.add(this.vmArms.root); }
    }
    const vm = this.vm; vm.visible = true;
    const gun = vm.userData.gun, d = w.def, cat = d.cat;
    // base placement
    // camera-space placement per weapon family [x, y, z, yaw] (tuned so the hands reach grip and handguard)
    const base = Agents.vmBase(d);
    const dz = base[2] * ((this.vmK || 1) - 1);
    let px = base[0], py = base[1], pz = base[2] + dz, rx = base[4] || 0, ry = base[3], rz = base[5] || 0;
    // bob & sway
    const sp = Math.hypot(vp.vel.x, vp.vel.z), moving = vp.onGround ? clamp(sp / 5, 0, 1.2) : 0;
    this.vmBob += dt * (6 + sp * 1.2) * (moving > .05 ? 1 : 0);
    if (S.bob) { px += Math.sin(this.vmBob) * .008 * moving; py += -Math.abs(Math.cos(this.vmBob)) * .008 * moving; rz += Math.sin(this.vmBob) * .012 * moving; }
    py -= clamp(-vp.vel.y * .004, -.03, .03);
    px -= this.swayX * .4; py += this.swayY * .4; ry += this.swayX * 1.5; rx += this.swayY * 1.5;
    if (vp.duckAmt > .5) { px -= .01; py += .008; }
    // idle breathing
    py += Math.sin(now * 1.6) * .0015; rx += Math.sin(now * 1.1) * .003;
    // draw
    if (now < vp.drawEnd) { const t = smooth01((now - vp.drawStart) / Math.max(.01, vp.drawEnd - vp.drawStart)); py -= (1 - t) * .22; rx -= (1 - t) * .9; }
    // recoil kick
    const ft = now - vp.fireT;
    if (ft >= 0 && ft < .25 && vp.fireT > 0) {
      const k = Math.exp(-ft * 22), big = cat === 'sniper' || cat === 'shotgun' || d.id === 'deagle' ? 2.2 : cat === 'pistol' ? 1.4 : 1;
      pz += .035 * k * big; rx += .06 * k * big; py += .006 * k * big;
    }
    // muzzle flash on the viewmodel
    const fl = vm.userData.flash;
    if (fl) { const on = ft >= 0 && ft < .045 && !w.silenced && cat !== 'knife' && cat !== 'grenade'; fl.visible = on; if (on) { fl.rotation.z = Math.random() * TAU; fl.scale.setScalar(.8 + Math.random() * .6); fl.lookAt(this.vmCam.getWorldPosition(_v2)); } }
    if (vp.fireT !== this.lastFireT) { this.lastFireT = vp.fireT; if (vp === lp && cat !== 'knife' && !w.silenced) FX.light(this.camera.position.clone().add(this.camera.getWorldDirection(_v2).multiplyScalar(1)), 0xffb060, 5, 8, .06); }
    // reload
    if (vp.reloadEnd && now < vp.reloadEnd) {
      const L = d.shellReload ? d.rl : (vp.reloadEnd - vp.reloadStart), t = d.shellReload ? 1 - (vp.reloadEnd - now) / L : (now - vp.reloadStart) / L;
      const e = Math.sin(clamp(t, 0, 1) * Math.PI);
      if (d.shellReload) { rz += .25; py -= .02 + Math.sin(t * TAU) * .006; }
      else { py -= e * .06; rz += e * .55; rx += e * .15; px -= e * .02; }
      const mag = gun.userData.mag;
      if (mag && !d.shellReload) { const m = t < .15 ? 0 : t < .45 ? (t - .15) / .3 : t < .6 ? 1 : t < .8 ? 1 - (t - .6) / .2 : 0; mag.position.y = -m * .16; mag.visible = m < .95; }
    } else if (gun.userData.mag) { gun.userData.mag.position.y = 0; gun.userData.mag.visible = true; }
    // inspect
    if (now < vp.inspectEnd) {
      const t = (now - vp.inspectStart) / (vp.inspectEnd - vp.inspectStart), e = Math.sin(clamp(t, 0, 1) * Math.PI);
      if (cat === 'knife') { ry += Math.sin(t * TAU) * 1.2; rz += e * .9; px -= e * .05; }
      else { ry += e * .9; rz += e * .45; px -= e * .06; py += e * .03; rx += Math.sin(t * TAU * 2) * .05 * e; }
    }
    // knife swings
    if (cat === 'knife') {
      const st = now - vp.swingT;
      if (st >= 0 && st < .45) {
        const t = st / (vp.swingHeavy ? .45 : .3);
        if (vp.swingHeavy) { const e = Math.sin(clamp(t, 0, 1) * Math.PI); pz -= e * .14; rx -= e * .3; py += e * .03; }
        else { const e = Math.sin(clamp(t, 0, 1) * Math.PI); const dir = vp.slashAlt ? 1 : -1; ry += dir * (clamp(t, 0, 1) * 2 - 1) * 1.1 * e; rz += dir * .6 * e; px -= e * .05 * dir; pz -= e * .06; }
      }
    }
    // grenades
    if (cat === 'grenade') {
      if (vp.nadeState === 'pull') { py += .03; pz += .05; rx += .3; }
      else if (vp.nadeState === 'throw') { const t = (now - vp.nadeThrowT) / .45; pz -= t * .4; py += t * .1; rx -= t * 1.2; if (t > .25) vm.visible = false; }
    }
    // C4 typing
    if (cat === 'c4' && vp.planting) { py -= .05; pz += .05; rx += .5 + Math.sin(now * 20) * .02; }
    if (cat === 'zeus' && w.clip === 0) py -= .02;
    vm.position.set(px, py, pz); vm.rotation.set(rx, ry, rz);
    if (this.vmArms) { this.vmArms.root.visible = vm.visible; if (vm.visible) { vm.updateMatrixWorld(true); Agents.poseViewArms(this.vmArms, gun, cat, dz); } }
    // viewmodel light follows the sun, dimmed in shadow
    if ((this._vmlt = (this._vmlt || 0) - dt) <= 0) {
      this._vmlt = .12; const e = vp.eye(_v3);
      const blocked = World.raycast(e.x, e.y, e.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 200, null) < 200;
      this._vmTarget = blocked ? .25 : 1;
    }
    this.vmLight = lerp(this.vmLight, this._vmTarget || 1, 1 - Math.exp(-dt * 6));
    this.vmSun.intensity = 3.2 * this.vmLight; this.vmHemi.intensity = 1.5 + .6 * this.vmLight;
    const sd = _v2.copy(SUN_DIR).applyQuaternion(this.camera.quaternion.clone().invert());
    this.vmSun.position.copy(sd).multiplyScalar(5); this.vmSun.target.position.set(0, 0, 0);
  },
  render(game) {
    const r = this.renderer;
    r.setRenderTarget(null); r.clear();
    r.render(this.scene, this.camera);
    if (game && this.vm && this.vm.visible) { r.clearDepth(); r.render(this.vmScene, this.vmCam); }
  }
};
window.addEventListener('load', () => App.boot().catch(e => { console.error(e); const t = $('#loadtxt'); if (t) t.textContent = 'Failed to start: ' + e.message; }));
