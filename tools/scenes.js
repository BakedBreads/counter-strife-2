// Visual checks: screenshots of specific situations (viewmodels, players up close, grenades, menus).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..'), out = path.join(root, 'test-out');
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] || '';
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(root, 'dist', 'index.html')).pipe(res); }).listen(0, async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 120000 });
  const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => { const { App } = window.__cs; App.startMatch({ mode: 'competitive', diff: 'hard', team: 'CT', ff: true }); document.getElementById('clickplay').classList.add('hidden'); });
  // freeze bots so scenes are stable
  await ev(() => { const { Game } = window.__cs; Game.players.forEach(p => { if (p.bot) p.bot.update = () => { }; }); Game.phaseEnd = Game.time + 999; });
  const give = async (id, skin) => ev(([id, skin]) => { const { Game } = window.__cs; const lp = Game.local; const w = new (lp.knife.constructor)(id, skin || 'default'); if (w.def.slot === 1) lp.primary = w; else if (w.def.slot === 2) lp.secondary = w; lp.addWeapon && w.def.slot > 2 && lp.addWeapon(w); lp.active = null; lp.equip(w, true); lp.drawEnd = 0; }, [id, skin]);
  const place = async (x, z, yaw, pitch) => ev(([x, z, yaw, pitch]) => { const { Game, World } = window.__cs; const lp = Game.local; lp.pos.set(x, World.floorAt(x, z), z); lp.yaw = yaw; lp.pitch = pitch || 0; lp.vel.set(0, 0, 0); }, [x, z, yaw, pitch]);
  if (!only || only === 'vm') {
    await place(36, -40, Math.PI * .75, -.05);
    for (const [id, skin] of [['ak47', 'default'], ['m4a1s', 'neon'], ['awp', 'default'], ['deagle', 'gold'], ['knife', 'fade'], ['p90', 'default'], ['nova', 'default'], ['he', 'default']]) { await give(id, skin); await page.waitForTimeout(300); await shot('vm-' + id); }
  }
  if (!only || only === 'players') {
    await give('ak47');
    await ev(() => { const { Game, World } = window.__cs; const L = Game.players.filter(p => !p.isLocal); const lp = Game.local; lp.pos.set(0, World.floorAt(0, 10), 10); lp.yaw = 0; lp.pitch = 0;
      L.forEach((p, i) => { p.alive = true; p.pos.set(-3 + i * 1.1, World.floorAt(0, 4), 4 - (i % 2) * 1.5); p.yaw = Math.PI + (i - 4) * .3; p.vel.set(0, 0, 0); p.pitch = 0; if (i === 2) { p.ducked = true; p.eyeOff = 1.17; } }); });
    await shot('players-mid');
  }
  if (!only || only === 'nades') {
    await ev(() => { const { Game, World, V3 } = window.__cs; const lp = Game.local; lp.pos.set(0, World.floorAt(0, 20), 20); lp.yaw = 0; lp.pitch = -.05;
      Game.addSmoke(new THREE.Vector3(-1, 0, 6), null); Game.addFire(new THREE.Vector3(2.5, 0, 12), null, 'molotov'); });
    await page.waitForTimeout(2500); await shot('nades-smoke-fire');
    await ev(() => { const { Game } = window.__cs; Game.detonate('he', new THREE.Vector3(1, .2, 9), null, 'he'); });
    await page.waitForTimeout(120); await shot('nades-he');
    await ev(() => { const { Game } = window.__cs; Game.applyFlash(Game.local, 4, null); });
    await page.waitForTimeout(1000); await shot('nades-flash');
  }
  if (!only || only === 'ui') {
    await ev(() => { const { Game } = window.__cs; Game.local.flashEnd = 0; Game.local.pos.set(-2, 1.6, -46); Game.local.yaw = Math.PI; Game.local.alive = true; Game.phase = 'freeze'; });
    await ev(() => window.__cs.HUD.openBuy()); await page.waitForTimeout(400); await shot('ui-buy');
    await ev(() => window.__cs.HUD.closeBuy());
    await ev(() => window.__cs.HUD.showScores(true)); await shot('ui-score'); await ev(() => window.__cs.HUD.showScores(false));
    await ev(() => { window.__cs.App.openPause(); }); await shot('ui-pause');
    await ev(() => { window.__cs.App.leaveMatch(); window.__cs.Menu.open('inventory'); }); await page.waitForTimeout(800); await shot('ui-inventory');
    await ev(() => { window.__cs.Menu.open('settings'); window.__cs.Menu.setTab = 'xhair'; window.__cs.Menu.renderPane(); }); await shot('ui-settings');
    await ev(() => { window.__cs.Menu.open('online'); }); await shot('ui-online');
    await ev(() => { window.__cs.Menu.open('help'); }); await shot('ui-help');
  }
  console.log('errors:', errors.length ? errors.slice(0, 20).join('\n') : 'none');
  await browser.close(); server.close();
});
