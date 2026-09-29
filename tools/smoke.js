// End-to-end smoke test in headless Chromium: loads the built page over HTTP, checks for errors,
// takes screenshots, starts a match and fast-forwards bot-only rounds.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..'), out = path.join(root, 'test-out');
fs.mkdirSync(out, { recursive: true });
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const mode = arg('mode') || 'competitive', simMin = +(arg('minutes') || 4);

const server = http.createServer((req, res) => {
  const f = path.join(root, 'dist', 'index.html');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(res);
}).listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden') || /Failed/.test(document.getElementById('loadtxt').textContent), null, { timeout: 120000 });
  console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'loadtxt:', await page.$eval('#loadtxt', e => e.textContent));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, '1-menu.png') });
  // start a match (pointer lock will fail headless; that is fine)
  await page.evaluate(m => window.__cs.App.startMatch({ mode: m, diff: 'hard', team: 'CT', ff: true }), mode);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, '2-spawn.png') });
  // fast-forward the simulation in chunks, logging round results
  const report = await page.evaluate(async (minutes) => {
    const { Game, App } = window.__cs; const log = []; let lastRound = Game.round, kills = 0, plants = 0, defuses = 0, booms = 0;
    const origKill = Game.kill.bind(Game); const tks = []; Game.kill = (v, att, wid, info) => { kills++; if (att && att !== v && att.team === v.team) tks.push('TEAMKILL ' + att.name + '(' + att.team + ') -> ' + v.name + '(' + v.team + ') ' + wid + ' ' + (info && info.type) + ' t=' + Game.time.toFixed(1)); return origKill(v, att, wid, info); }; window.__tks = tks;
    const origPlant = Game.plantBomb.bind(Game); Game.plantBomb = (...a) => { plants++; return origPlant(...a); };
    const steps = Math.floor(minutes * 60 * 60);
    // the local player stands still in spawn (so bots decide rounds)
    const lp = Game.local; lp.cmd.fwd = 0; if (window.__noLocal !== false) { lp.alive = false; lp.hp = 0; }
    for (let i = 0; i < steps; i++) {
      Game.step(1 / 60);
      if (Game.round !== lastRound) { const h = Game.history.filter(x => !x.half).slice(-1)[0]; log.push('R' + lastRound + ' ' + (h ? h.w + ' ' + h.r : '?') + ' score CT ' + Game.score.CT + ' T ' + Game.score.T); lastRound = Game.round; }
      if (Game.phase === 'matchover') { log.push('MATCH OVER'); break; }
      if (i % 600 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const P = Game.players.map(p => `${p.team} ${p.name} K${p.kills} D${p.deaths} A${p.assists} $${p.money} ${p.alive ? 'alive' : 'dead'}`);
    return { tks: window.__tks, log, kills, plants, round: Game.round, phase: Game.phase, P, bomb: Game.bomb.state };
  }, simMin);
  console.log(report.log.join('\n'));
  console.log((report.tks || []).join('\n') || 'no teamkills');
  console.log('kills', report.kills, 'plants', report.plants, 'round', report.round, 'phase', report.phase, 'bomb', report.bomb);
  console.log(report.P.join('\n'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, '3-after-sim.png') });
  console.log('ERRORS (' + errors.length + '):\n' + [...new Set(errors)].slice(0, 30).join('\n'));
  await browser.close(); server.close();
});
