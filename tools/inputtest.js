// Drives the game with real keyboard/mouse events (pointer lock is faked because headless cannot lock).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(root, 'dist', 'index.html')).pipe(res); }).listen(0, async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 120000 });
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  // click GO like a player
  await page.evaluate(() => { const S = window.__cs.Settings.v; S.autoFull = false; S.shadows = 'off'; S.renderScale = .5; S.team = 'CT'; window.__cs.App.applySettings(); window.__cs.Menu.open('play'); });
  await page.click('#goBtn');
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => window.__cs.App.inGame), 'GO button starts a match');
  // pretend the pointer is locked; freeze bots so nothing interferes
  await page.evaluate(() => { const { Input, Game } = window.__cs; Input.locked = true; document.getElementById('clickplay').classList.add('hidden'); Game.players.forEach(p => { if (p.bot) p.bot.update = () => { }; }); });
  const st = () => page.evaluate(() => { const lp = window.__cs.Game.local; return { x: lp.pos.x, z: lp.pos.z, y: lp.pos.y, clip: lp.active.clip, w: lp.active.id, duck: lp.ducked, money: lp.money, phase: window.__cs.Game.phase, inv: lp.weapons().map(w => w.id).join('+'), vy: lp.vel.y }; });
  const s0 = await st();
  // freeze time: cannot move
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
  const s1 = await st();
  ok(Math.hypot(s1.x - s0.x, s1.z - s0.z) < .05, 'no movement during freeze time (' + s0.phase + ')');
  // buy menu with the keyboard: B, 2 (mid-tier), 1 (first SMG)
  await page.keyboard.press('KeyB'); await page.waitForTimeout(400);
  const buyOpen = await page.evaluate(() => window.__cs.HUD.buyOpen);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(200); await page.keyboard.press('Digit3'); await page.waitForTimeout(1200);
  const s2 = await st();
  ok(buyOpen && s2.w === 'fiveseven' && s2.money === s0.money - 500, 'B → 1 → 3 buys a Five-SeveN as CT (money ' + s0.money + ' → ' + s2.money + ', holding ' + s2.w + ')');
  await page.keyboard.press('KeyB'); await page.waitForTimeout(200);
  ok(!(await page.evaluate(() => window.__cs.HUD.buyOpen)), 'B closes the buy menu');
  // go live
  await page.evaluate(() => { const G = window.__cs.Game; G.phaseEnd = G.time; });
  await page.waitForTimeout(600);
  const s3 = await st();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
  const s4 = await st();
  ok(Math.hypot(s4.x - s3.x, s4.z - s3.z) > .5, 'W moves the player (' + Math.hypot(s4.x - s3.x, s4.z - s3.z).toFixed(2) + ' m) in phase ' + s4.phase);
  // shoot: click the mouse a few times
  const c0 = (await st()).clip;
  for (let k = 0; k < 3; k++) { await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up(); await page.waitForTimeout(900); }
  const c1 = (await st()).clip;
  ok(c1 < c0, 'mouse fires (clip ' + c0 + ' → ' + c1 + ')');
  await page.keyboard.press('KeyR'); await page.waitForTimeout(4500);
  ok((await st()).clip === 20, 'R reloads to a full magazine (' + (await st()).clip + ')');
  // weapon switching
  await page.keyboard.press('Digit3'); await page.waitForTimeout(1200);
  ok((await st()).w === 'knife', '3 selects the knife');
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(1200);
  ok((await st()).w === 'fiveseven', 'Q returns to the last weapon');
  // crouch and jump
  await page.keyboard.down('KeyC'); await page.waitForTimeout(500);
  ok((await st()).duck, 'C crouches');
  await page.keyboard.up('KeyC'); await page.waitForTimeout(400);
  const y0 = (await st()).y; await page.keyboard.down('Space'); await page.waitForTimeout(60); await page.keyboard.up('Space'); await page.waitForTimeout(250);
  const j = await st(); ok(j.y > y0 + .05 || j.vy > .5, 'Space jumps (y ' + y0.toFixed(2) + ' → ' + j.y.toFixed(2) + ')');
  // drop and scoreboard
  await page.waitForTimeout(1500); await page.keyboard.press('Digit2'); await page.waitForTimeout(1500);
  await page.keyboard.press('KeyG'); await page.waitForTimeout(500);
  ok(!(await st()).inv.includes('fiveseven') && (await page.evaluate(() => window.__cs.Items.list.length)) > 0, 'G drops the weapon (' + (await st()).inv + ')');
  await page.keyboard.down('Tab'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => !document.getElementById('score').classList.contains('hidden')), 'Tab shows the scoreboard');
  await page.keyboard.up('Tab'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('score').classList.contains('hidden')), 'releasing Tab hides it');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__cs.App.paused), 'Esc pauses');
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await browser.close(); server.close();
});
