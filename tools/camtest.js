// Camera checks: drives the real game frame at a steady 60 fps (rendering stubbed out, so the slow software
// renderer does not skew timing) and measures the view: stairs down/up, landing, crouch, mouse, menu camera.
// usage: node tools/camtest.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(root, 'dist', 'index.html')).pipe(res); }).listen(0, async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.setDefaultTimeout(240000);
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 400000 });
  const r = await page.evaluate(() => {
    const { App, Game: G, World, Input, Settings, HUD } = window.__cs;
    const DEGR = Math.PI / 180, out = {};
    // menu camera first: how much does the view direction wobble frame to frame?
    App.renderer.setAnimationLoop(null); App.render = () => { };
    const dirs = []; for (let f = 0; f < 240; f++) { App.menuFrame(1 / 60); dirs.push(App.camera.getWorldDirection(new THREE.Vector3())); }
    const rates = []; for (let i = 1; i < dirs.length; i++) rates.push(dirs[i].angleTo(dirs[i - 1]) * 60 / DEGR);
    const jerk = []; for (let i = 1; i < rates.length; i++) jerk.push(Math.abs(rates[i] - rates[i - 1]));
    out.menu = { maxTurnDegPerSec: Math.max(...rates).toFixed(2), maxJerkDegPerSec: Math.max(...jerk).toFixed(2) };
    // match with bots frozen in place
    Settings.v.autoFull = false;
    App.startMatch({ mode: 'competitive', diff: 'hard', team: 'CT', ff: true });
    Input.lock = () => { }; Input.locked = true; document.getElementById('clickplay').classList.add('hidden');
    G.players.forEach(p => { if (p.bot) p.bot.update = () => { }; });
    const lp = G.local;
    const golive = () => { G.phase = 'live'; G.liveStart = G.time; G.phaseEnd = G.time + 999; };
    for (let f = 0; f < 5; f++) { App.gameFrame(1 / 60); Input.endFrame(); }
    golive();
    const place = (x, z, yaw) => { lp.pos.set(x, World.floorAt(x, z), z); lp.vel.set(0, 0, 0); lp.yaw = yaw; lp.pitch = 0; lp.onGround = true; lp.ducked = false; lp.eyeOff = 1.64; App.stepOffset = 0; App.landKick = 0; lp.alive = true; lp.hp = 100; };
    const run = (frames, keys) => {
      const rec = [];
      for (let f = 0; f < frames; f++) {
        Input.keys.clear(); for (const k of (typeof keys === 'function' ? keys(f) : keys)) Input.keys.add(k);
        App.gameFrame(1 / 60); Input.endFrame();
        rec.push({ cy: App.camera.position.y, py: lp.pos.y, eye: lp.eyeOff, x: lp.pos.x });
      }
      Input.keys.clear(); return rec;
    };
    const steps = rec => { let maxD = 0, snaps = 0; for (let i = 1; i < rec.length; i++) { const d = Math.abs(rec[i].cy - rec[i - 1].cy); maxD = Math.max(maxD, d); if (d > .06) snaps++; } return { maxFrameMove: maxD.toFixed(3), framesOver6cm: snaps, dropTotal: (rec[0].py - rec[rec.length - 1].py).toFixed(2) }; };
    // CT spawn -> B stairs: x -20 (top, y 1.6) down to x -26 (bottom), z -50; facing -x is yaw +90 deg
    place(-17, -50, Math.PI / 2); out.stairsDown = steps(run(150, ['KeyW']));
    place(-33, -50, -Math.PI / 2); out.stairsUp = steps(run(150, ['KeyW']));
    // landing: drop from 2.5 m onto flat ground
    let maxKickStep = 0, peak = 0, prev = 0; const kicks = [];
    place(-10, -46, 0); lp.pos.y += 2.5; lp.onGround = false;
    for (let f = 0; f < 90; f++) { App.gameFrame(1 / 60); Input.endFrame(); const k = App.landKick; maxKickStep = Math.max(maxKickStep, Math.abs(k - prev)); peak = Math.max(peak, Math.abs(k)); prev = k; kicks.push(+k.toFixed(3)); }
    out.landing = { peakDip: peak.toFixed(3), maxDipChangePerFrame: maxKickStep.toFixed(3), firstFrames: kicks.filter(k => k).slice(0, 8) };
    // crouch: hold 40 frames, release 40
    place(-10, -46, 0);
    const cr = run(80, f => f < 40 ? ['ControlLeft'] : []);
    let downF = cr.findIndex(p => Math.abs(p.eye - 1.17) < .005), upF = cr.slice(40).findIndex(p => Math.abs(p.eye - 1.64) < .005);
    out.crouch = { downMs: Math.round((downF + 1) * 1000 / 60), upMs: Math.round((upF + 1) * 1000 / 60), maxFrameMove: Math.max(...cr.slice(1).map((p, i) => Math.abs(p.cy - cr[i].cy))).toFixed(3) };
    // mouse: real mousemove events, normal and a fast flick
    // several events per frame, like a real mouse at 1000 Hz
    const look = seq => { const y0 = lp.yaw; for (const dx of seq) window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: 0 })); App.gameFrame(1 / 60); Input.endFrame(); let d = (y0 - lp.yaw) / DEGR; while (d > 180) d -= 360; while (d < -180) d += 360; return d.toFixed(2) + ' deg (expect ' + (seq.reduce((a, b) => a + b, 0) * Settings.v.sens * .022).toFixed(2) + ')'; };
    Input.raw = true; out.mouseRaw = { sens: Settings.v.sens, move100: look([100]), flick: look([900, 1500, 1500, 900]) };
    Input.raw = false; Input.lastBig = false; out.mouseNoRaw = { flick: look([900, 1500, 1500, 900]), isolatedSpike: look([20, 1400, 20]) };
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await browser.close(); server.close();
});
