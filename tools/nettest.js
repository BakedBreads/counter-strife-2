// Two browser sessions: one hosts a room over PeerJS, the other joins. Verifies lobby, start, sync, hits, buying, chat.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(root, 'dist', 'index.html')).pipe(res); }).listen(0, async () => {
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mk = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage(); page.errs = [];
    page.on('pageerror', e => page.errs.push(name + ' PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    page.on('console', m => { if (m.type() === 'error') page.errs.push(name + ' console ' + m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 120000 });
    return page;
  };
  const ok = (c, msg) => console.log((c ? 'PASS ' : 'FAIL ') + msg);
  const A = await mk('host'), B = await mk('client');
  await A.evaluate(() => { window.__cs.Settings.v.name = 'Hosty'; window.__cs.Menu.open('online'); window.__cs.Net.host(); });
  await A.waitForFunction(() => window.__cs.Net.role === 'host' && window.__cs.Net.code, null, { timeout: 30000 }).catch(() => { });
  const code = await A.evaluate(() => window.__cs.Net.code);
  ok(!!code, 'host created room ' + code + ' (' + await A.evaluate(() => window.__cs.Net.status) + ')');
  if (!code) { console.log(A.errs.join('\n')); process.exit(1); }
  await B.evaluate(c => { window.__cs.Settings.v.name = 'Joiner'; window.__cs.Menu.open('online'); window.__cs.Net.join(c); }, code);
  await A.waitForFunction(() => window.__cs.Net.lobby && window.__cs.Net.lobby.players.length === 2, null, { timeout: 30000 }).catch(() => { });
  const lob = await A.evaluate(() => window.__cs.Net.lobby.players.map(p => p.name));
  ok(lob.length === 2, 'lobby has ' + lob.join(', ') + ' / client status: ' + await B.evaluate(() => window.__cs.Net.status));
  await B.evaluate(() => window.__cs.Net.setTeam('T'));
  await A.evaluate(() => window.__cs.Net.setTeam('CT'));
  await A.waitForTimeout(500);
  await A.evaluate(() => window.__cs.Net.startMatch());
  await B.waitForFunction(() => window.__cs.App.inGame && window.__cs.Game.players.length === 10, null, { timeout: 15000 }).catch(() => { });
  const bInfo = await B.evaluate(() => ({ n: window.__cs.Game.players.length, me: window.__cs.Game.local && window.__cs.Game.local.id, team: window.__cs.Game.local && window.__cs.Game.local.team }));
  ok(bInfo.n === 10, 'client match started with ' + bInfo.n + ' players, local id ' + bInfo.me + ' team ' + bInfo.team);
  await B.waitForTimeout(2500);
  const s1 = await B.evaluate(() => { const G = window.__cs.Game, lp = G.local; return { phase: G.phase, alive: lp.alive, pos: [lp.pos.x.toFixed(1), lp.pos.z.toFixed(1)], inv: lp.weapons().map(w => w.id), money: lp.money, others: G.players.filter(p => !p.isLocal && p.alive).length }; });
  ok(s1.alive && s1.inv.includes('glock'), 'client spawned alive at ' + s1.pos + ' with ' + s1.inv.join('+') + ', $' + s1.money + ', phase ' + s1.phase + ', ' + s1.others + ' others alive');
  const tA0 = await A.evaluate(() => window.__cs.Game.time), tB0 = await B.evaluate(() => window.__cs.Game.time); await A.waitForTimeout(1000);
  console.log('game clocks advance: host', (await A.evaluate(() => window.__cs.Game.time) - tA0).toFixed(2), 'client', (await B.evaluate(() => window.__cs.Game.time) - tB0).toFixed(2));
  const hostView = await A.evaluate(id => { const p = window.__cs.Game.players.find(q => q.id === id); return { pos: [p.pos.x.toFixed(2), p.pos.z.toFixed(2)], money: p.money, canBuy: window.__cs.Game.canBuy(p), buf: p.netBuf ? p.netBuf.length : 0 }; }, bInfo.me);
  console.log('host view of client', JSON.stringify(hostView));
  // buying through the host
  await B.evaluate(() => window.__cs.Net.send({ t: 'buy', i: 'ak47' }));
  await B.evaluate(() => window.__cs.Net.send({ t: 'buy', i: 'p250' }));
  await B.waitForTimeout(800);
  const inv2 = await B.evaluate(() => ({ inv: window.__cs.Game.local.weapons().map(w => w.id), money: window.__cs.Game.local.money, hint: document.getElementById('hint').textContent }));
  ok(inv2.inv.includes('p250') && !inv2.inv.includes('ak47'), 'buy: ak47 denied (' + inv2.hint + '), p250 bought → ' + inv2.inv.join('+') + ' $' + inv2.money);
  // movement sync: client moves, host sees it
  await B.evaluate(() => { const lp = window.__cs.Game.local; lp.pos.x += 2; });
  await B.waitForTimeout(4000);
  const syncd = await A.evaluate(id => { const p = window.__cs.Game.players.find(q => q.id === id); return p ? [p.pos.x.toFixed(2), p.pos.z.toFixed(2)] : null; }, bInfo.me);
  const bpos = await B.evaluate(() => [window.__cs.Game.local.pos.x.toFixed(2), window.__cs.Game.local.pos.z.toFixed(2)]);
  ok(syncd && Math.abs(syncd[0] - bpos[0]) < .3, 'host sees client at ' + syncd + ' (client at ' + bpos + ')');
  // client-side hit registration: headshot an enemy bot
  const victim = await B.evaluate(() => {
    const G = window.__cs.Game, lp = G.local; const e = G.players.find(p => p.team !== lp.team && p.alive && p.isBot);
    const eye = lp.eye();
    window.__cs.Net.send({ t: 'shot', w: 'glock', s: 0, o: [eye.x, eye.y, eye.z], e: [[e.pos.x, e.pos.y + 1.6, e.pos.z]], i: [], h: [[e.id, 'head', 30, 0, 0, 0, 0, e.pos.x, e.pos.y + 1.6, e.pos.z]] });
    return { id: e.id, name: e.name };
  });
  await A.waitForTimeout(900);
  const vh = await A.evaluate(id => { const p = window.__cs.Game.players.find(q => q.id === id); return { hp: p.hp, alive: p.alive }; }, victim.id);
  const feedB = await B.evaluate(() => document.getElementById('killfeed').textContent);
  ok(!vh.alive, 'client headshot killed ' + victim.name + ' on host (hp ' + vh.hp + '); client kill feed: "' + feedB.trim() + '"');
  // chat both ways
  await B.evaluate(() => window.__cs.HUD.sendChat('gg from client', false));
  await A.evaluate(() => window.__cs.HUD.sendChat('hello from host', false));
  await A.waitForTimeout(900);
  const chatA = await A.evaluate(() => document.getElementById('chat').textContent), chatB = await B.evaluate(() => document.getElementById('chat').textContent);
  ok(chatA.includes('gg from client') && chatB.includes('hello from host'), 'chat both ways');
  // let the round go live and play for a bit
  await A.evaluate(() => { const G = window.__cs.Game; G.phaseEnd = G.time + .5; });
  await A.waitForTimeout(6000);
  const s2 = await B.evaluate(() => { const G = window.__cs.Game; return { phase: G.phase, round: G.round, sc: G.score, alive: G.players.filter(p => p.alive).length, moving: G.players.filter(p => !p.isLocal && p.alive && p.netBuf && p.netBuf.length > 3).length }; });
  ok(s2.phase === 'live', 'client sees live round ' + s2.round + ', ' + s2.alive + ' alive, ' + s2.moving + ' interpolated');
  await B.screenshot({ path: path.join(root, 'test-out', 'net-client.png') });
  await A.screenshot({ path: path.join(root, 'test-out', 'net-host.png') });
  // client leaves: host converts seat to a bot
  await B.evaluate(() => window.__cs.App.leaveMatch());
  await A.waitForTimeout(2500);
  const seat = await A.evaluate(id => { const p = window.__cs.Game.players.find(q => q.id === id); return p ? { bot: p.isBot, name: p.name } : null; }, bInfo.me);
  ok(seat && seat.bot, 'after client left, seat is a bot: ' + JSON.stringify(seat));
  const errs = A.errs.concat(B.errs);
  console.log('errors:', errs.length ? errs.slice(0, 15).join('\n') : 'none');
  await browser.close(); server.close(); process.exit(0);
});
