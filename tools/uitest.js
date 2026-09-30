// Screenshots of every menu screen and HUD state: node tools/uitest.js [width height] [only]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..'), out = path.join(root, 'test-out', 'ui');
fs.mkdirSync(out, { recursive: true });
const Wv = +process.argv[2] || 1280, Hv = +process.argv[3] || 720, only = process.argv[4] || '';
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(root, 'dist', 'index.html')).pipe(res); }).listen(0, async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: Wv, height: Hv } });
  page.setDefaultTimeout(240000); // big software-rendered frames are slow to capture
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('http://127.0.0.1:' + server.address().port + '/');
  await page.waitForTimeout(2500); await page.screenshot({ path: path.join(out, Wv + 'x' + Hv + '-loading.png') });
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 180000 });
  await page.addStyleTag({ content: '#clickplay{display:none!important}' });
  const tag = Wv + 'x' + Hv;
  const shot = async (name, wait) => { await page.waitForTimeout(wait || 900); await page.screenshot({ path: path.join(out, tag + '-' + name + '.png') }); console.log('shot', name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const click = async sel => { await page.click(sel); };
  const want = k => !only || only.split(',').includes(k);
  if (want('menu')) {
    await shot('home', 1500);
    await click('.navplay'); await shot('play');
    await click('.tab2[data-m="wingman"]'); await shot('play-wingman');
    await click('.tab2[data-m="deathmatch"]'); await shot('play-dm');
    await click('.tab2[data-m="competitive"]');
    await click('.tab1[data-tab="online"]'); await shot('online');
    await click('.navtab[data-p="inventory"]'); await shot('loadout', 1500);
    await click('.wb[data-w="knife"]'); await shot('loadout-knife', 1500);
    await click('[data-p="settings"]'); await shot('settings');
    await click('.tab1[data-t="xhair"]'); await shot('settings-xhair');
    await click('.tab1[data-t="keys"]'); await shot('settings-keys');
    await click('.navtab[data-p="help"]'); await shot('help');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const pane = await ev(() => window.__cs.Menu.pane); console.log('after Esc pane =', pane);
  }
  if (want('knives')) {
    await ev(() => { const { Menu } = window.__cs; Menu.invSel = 'knife'; Menu.open('inventory'); });
    for (const k of ['default', 'bayonet', 'karambit', 'butterfly', 'flip', 'bowie']) { await click(`[data-seg="ktype"] [data-v="${k}"]`); await page.waitForTimeout(700); const el = await page.$('.lo .hero img'); await el.screenshot({ path: path.join(out, tag + '-knife-' + k + '.png') }); console.log('knife', k); }
    await click('.skin[data-s="fade"]'); await page.waitForTimeout(700); await (await page.$('.lo .hero img')).screenshot({ path: path.join(out, tag + '-knife-fade.png') });
    await click('.skin[data-s="default"]'); await click(`[data-seg="ktype"] [data-v="default"]`);
    await ev(() => { window.__cs.Menu.invSel = 'ak47'; window.__cs.Menu.open('home'); });
  }
  if (want('hud')) {
    await ev(() => { const { App } = window.__cs; App.startMatch({ mode: 'competitive', diff: 'hard', team: 'CT', ff: true }); document.getElementById('clickplay').classList.add('hidden'); });
    await ev(() => { const { Game } = window.__cs; Game.players.forEach(p => { if (p.bot) p.bot.update = () => { }; }); Game.phaseEnd = Game.time + 999; });
    await shot('hud-freeze', 2500);
    await ev(() => { const { HUD } = window.__cs; HUD.openBuy(); }); await shot('buy');
    await ev(() => { const { HUD } = window.__cs; HUD.buyKey(4); }); await shot('buy-rifles');
    await ev(() => { const { HUD, Input, Settings } = window.__cs; HUD.closeBuy(); Input.keys.add(Settings.v.binds.scores); }); await shot('score');
    await ev(() => { const { Input, Settings } = window.__cs; Input.keys.delete(Settings.v.binds.scores); });
    await ev(() => { const { HUD, Game } = window.__cs; HUD.showScores(false);
      const P = Game.players, lp = Game.local, e = P.filter(p => p.team !== lp.team), m = P.filter(p => p.team === lp.team && p !== lp);
      Game.phaseEnd = Game.time; });
    await page.waitForTimeout(1500);
    await ev(() => { const { HUD, Game } = window.__cs;
      const P = Game.players, lp = Game.local, e = P.filter(p => p.team !== lp.team), m = P.filter(p => p.team === lp.team && p !== lp);
      Game.players.forEach(p => { if (p.bot) p.bot.update = () => { }; });
      e[0].alive = false; e[1].alive = false; m[0].alive = false;
      HUD.killfeed({ a: lp.id, v: e[0].id, w: 'ak47', hs: true });
      HUD.killfeed({ a: m[1].id, v: e[1].id, w: 'awp', ns: true, pen: true });
      HUD.killfeed({ a: e[2].id, v: m[0].id, w: 'deagle' });
      lp.hp = 18; lp.armor = 64; lp.helmet = true; lp.money = 4350; lp.lastDamageT = Game.time;
      HUD.chat(m[1], 'rotating B', true); HUD.sys('Bomb has been planted');
    });
    await shot('hud-live', 1200);
    await ev(() => { const { HUD, Game } = window.__cs; const lp = Game.local; lp.kills = 3; lp.roundKills = 3; HUD.roundEnd('CT', 'All enemies eliminated', lp); HUD.center('', '', 0.01); });
    await shot('round-win', 1000);
    await ev(() => { const { HUD, Game } = window.__cs; HUD.el.roundBanner.innerHTML = ''; HUD.openTeam(); }); await shot('team');
    await ev(() => { const { HUD, App } = window.__cs; HUD.closeTeam(); App.openPause(); }); await shot('pause');
    await page.click('#pSet'); await shot('pause-settings');
    await ev(() => { const { App, Game, Menu } = window.__cs; App.resume(); Menu.matchEnd('CT', 'win'); }); await shot('matchend');
    await ev(() => { const { App } = window.__cs; App.leaveMatch(); });
  }
  if (want('dm')) {
    await ev(() => { const { App } = window.__cs; App.startMatch({ mode: 'deathmatch', diff: 'hard', team: 'auto', ff: true }); document.getElementById('clickplay').classList.add('hidden'); });
    await shot('hud-dm', 4000);
    await ev(() => { const { App } = window.__cs; App.leaveMatch(); });
  }
  const layout = await ev(() => ({ sx: document.documentElement.scrollWidth, w: innerWidth, fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight) }));
  console.log('layout', JSON.stringify(layout));
  console.log('errors:', errors.length ? errors.slice(0, 20).join('\n') : 'none');
  await browser.close(); server.close();
});
