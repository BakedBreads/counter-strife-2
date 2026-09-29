/* ===================== online play (PeerJS, host-authoritative) ===================== */
const NET_VER = 1;
const Net = {
  role: 'off', peer: null, conns: new Map(), hostConn: null, code: '', lobby: null, myId: 0, myTeam: 'auto',
  status: '', statusCls: '', connecting: false, statusText: '', evq: [], snapT: 0, inT: 0, pingT: 0, inN: 0,
  cGren: new Map(), cItems: new Map(), lastRound: 0,
  setStatus(t, cls) { this.status = t; this.statusCls = cls || ''; const s = $('#netStatus'); if (s) { s.textContent = t; s.className = 'status ' + (cls || ''); } },
  refresh() { if (Menu.pane === 'online' && !App.inGame && $('#mpane')) Menu.renderPane(); },
  iceConfig() { return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] }; },
  makeCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; },
  available() { return typeof window.Peer === 'function'; },

  /* ---------- lobby ---------- */
  host(retry) {
    if (!this.available()) { this.setStatus('Online play needs the PeerJS library, which failed to load.', 'err'); return; }
    this.leave(true);
    const code = this.makeCode();
    this.connecting = true; this.statusText = 'Creating room…'; this.refresh();
    let peer;
    try { peer = new Peer('cs2x-' + code.toLowerCase(), { debug: 0, config: this.iceConfig() }); } catch (e) { this.fail('Could not start networking: ' + e.message); return; }
    this.peer = peer;
    peer.on('open', () => {
      this.role = 'host'; this.connecting = false; this.code = code; this.myId = 1;
      this.lobby = { players: [{ id: 1, name: Settings.v.name, team: this.myTeam, host: true }], cfg: { mode: Settings.v.mode, diff: Settings.v.difficulty } };
      this.setStatus('Room ready. Share the code with your friends.', 'ok'); this.refresh();
    });
    peer.on('connection', conn => this.hostAccept(conn));
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && !retry) { this.host(true); return; }
      if (this.role === 'host' && err.type !== 'peer-unavailable') { this.setStatus('Network: ' + err.type, 'err'); return; }
      this.fail('Could not create the room (' + (err.type || err.message) + '). Check your internet connection.');
    });
    peer.on('disconnected', () => { if (this.role === 'host') { try { peer.reconnect(); } catch (e) { } } });
  },
  join(code) {
    if (!this.available()) { this.setStatus('Online play needs the PeerJS library, which failed to load.', 'err'); return; }
    this.leave(true);
    this.connecting = true; this.statusText = 'Connecting to room ' + code + '…'; this.refresh();
    let peer;
    try { peer = new Peer(undefined, { debug: 0, config: this.iceConfig() }); } catch (e) { this.fail('Could not start networking: ' + e.message); return; }
    this.peer = peer;
    const to = setTimeout(() => { if (this.connecting) this.fail('Timed out. Check the code, or try another network.'); }, 15000);
    peer.on('open', () => {
      const conn = peer.connect('cs2x-' + code.toLowerCase(), { reliable: true, serialization: 'json' });
      this.hostConn = conn;
      conn.on('open', () => {
        clearTimeout(to); this.role = 'client'; this.connecting = false; this.code = code;
        conn.send({ t: 'hello', name: Settings.v.name, v: NET_VER, skins: Loadout.v.skins, ks: Loadout.v.knifeSkin, knife: Loadout.v.knife, team: this.myTeam });
        this.setStatus('Connected. Waiting for the host.', 'ok'); this.refresh();
      });
      conn.on('data', d => { try { this.onClient(d); } catch (e) { console.error(e); } });
      conn.on('close', () => { if (this.role === 'client') this.hostGone(); });
      conn.on('error', () => { });
    });
    peer.on('error', err => { clearTimeout(to); this.fail(err.type === 'peer-unavailable' ? 'Room ' + code + ' was not found.' : 'Connection failed (' + err.type + ').'); });
  },
  fail(msg) { this.leave(true); this.setStatus(msg, 'err'); this.refresh(); },
  leave(silent) {
    for (const c of this.conns.values()) { try { c.conn.close(); } catch (e) { } }
    this.conns.clear();
    if (this.hostConn) { try { this.hostConn.close(); } catch (e) { } this.hostConn = null; }
    if (this.peer) { try { this.peer.destroy(); } catch (e) { } this.peer = null; }
    this.role = 'off'; this.connecting = false; this.lobby = null; this.code = ''; this.cGren.clear(); this.cItems.clear();
    if (!silent) { this.setStatus(''); this.refresh(); }
  },
  hostGone() { this.leave(true); if (App.inGame) { App.leaveMatch(true); App.alert('Disconnected', 'The host closed the match or the connection was lost.'); } else { this.setStatus('The host closed the room.', 'err'); this.refresh(); } },
  hostAccept(conn) {
    conn.on('data', d => { try { this.onHost(conn, d); } catch (e) { console.error(e); } });
    conn.on('close', () => this.dropPeer(conn));
    conn.on('error', () => { });
  },
  dropPeer(conn) {
    const c = this.conns.get(conn.peer); if (!c) return;
    this.conns.delete(conn.peer);
    if (this.lobby) this.lobby.players = this.lobby.players.filter(p => p.id !== c.id);
    const p = Game.players.find(q => q.id === c.id);
    if (p && App.inGame) {
      // the seat is taken over by a bot so the teams stay even
      p.remote = false; p.isBot = true; p.name = p.name + ' (bot)'; p.bot = new Bot(p, Game.cfg.diff || 'hard');
      HUD.sys(c.name + ' left the match. A bot took over.'); this.event({ t: 'chat', id: 0, m: c.name + ' left the match.', tm: 0 });
    }
    this.pushLobby(); this.refresh();
  },
  setTeam(t) { this.myTeam = t; if (this.role === 'host') { const me = this.lobby.players.find(p => p.id === 1); if (me) me.team = t; this.pushLobby(); this.refresh(); } else if (this.role === 'client') this.send({ t: 'team', team: t }); },
  setCfg(o) { if (this.role !== 'host') return; Object.assign(this.lobby.cfg, o); this.pushLobby(); },
  pushLobby() { if (this.role !== 'host' || !this.lobby) return; const m = { t: 'lobby', players: this.lobby.players.map(p => ({ id: p.id, name: p.name, team: p.team, host: !!p.host })), cfg: this.lobby.cfg }; for (const c of this.conns.values()) this.sendConn(c.conn, m); },
  sendConn(conn, m) { try { if (conn.open) conn.send(m); } catch (e) { } },
  send(m) { if (this.role === 'client' && this.hostConn) this.sendConn(this.hostConn, m); },
  sendTo(p, m) { if (this.role !== 'host') return; for (const c of this.conns.values()) if (c.id === p.id) { this.sendConn(c.conn, { t: 'e', e: [m] }); return; } },
  event(e) { if (this.role === 'host' && App.inGame) this.evq.push(e); },

  /* ---------- host: match ---------- */
  startMatch() {
    if (this.role !== 'host') return;
    const cfg = Object.assign({ mode: 'competitive', diff: 'hard', ff: true }, this.lobby.cfg);
    const humans = this.lobby.players.map(p => {
      const c = [...this.conns.values()].find(x => x.id === p.id);
      return { id: p.id, name: p.name, team: p.team, local: p.id === 1, skins: c ? c.skins : null, knife: c ? c.knife : null, peer: c ? c.conn.peer : null };
    });
    App.startMatch(Object.assign({}, cfg, { humans }));
    const roster = Game.players.map(p => ({ id: p.id, name: p.name, team: p.team, bot: p.isBot ? 1 : 0, skins: p.skins || (p.isLocal ? Object.assign({ knife: Loadout.v.knifeSkin }, Loadout.v.skins) : null), knife: p.knifeType }));
    for (const c of this.conns.values()) this.sendConn(c.conn, { t: 'start', cfg: Game.cfg && { mode: cfg.mode, diff: cfg.diff, ff: cfg.ff }, roster, you: c.id });
    for (const p of Game.players) if (p.remote) this.teleport(p);
  },
  onHost(conn, m) {
    let c = this.conns.get(conn.peer);
    if (m.t === 'hello') {
      if (m.v !== NET_VER) { this.sendConn(conn, { t: 'err', m: 'Version mismatch. Reload the page.' }); return; }
      if (App.inGame || this.lobby.players.length >= 10) { this.sendConn(conn, { t: 'err', m: App.inGame ? 'The match already started.' : 'The room is full.' }); return; }
      const id = 2 + Math.max(0, ...[...this.conns.values()].map(x => x.id - 1));
      const skins = {}; if (m.skins && typeof m.skins === 'object') for (const k in m.skins) if (W[k] && SKIN[m.skins[k]]) skins[k] = m.skins[k];
      if (SKIN[m.ks]) skins.knife = m.ks;
      c = { conn, id, name: String(m.name || 'Player').replace(/[<>]/g, '').slice(0, 16) || 'Player', skins, knife: KNIVES.some(k => k.id === m.knife) ? m.knife : 'default', ping: 0 };
      this.conns.set(conn.peer, c);
      this.lobby.players.push({ id, name: c.name, team: ['T', 'CT'].includes(m.team) ? m.team : 'auto' });
      this.sendConn(conn, { t: 'welcome', id, code: this.code });
      this.pushLobby(); this.refresh();
      return;
    }
    if (!c) return;
    const p = App.inGame ? Game.players.find(q => q.id === c.id) : null;
    switch (m.t) {
      case 'team': { const lp = this.lobby.players.find(x => x.id === c.id); if (lp && ['T', 'CT', 'auto'].includes(m.team)) { lp.team = m.team; this.pushLobby(); this.refresh(); } break; }
      case 'pong': c.ping = Math.round(performance.now() - m.ts); if (p) p.ping = c.ping; break;
      case 'in': if (p && p.alive) this.applyInput(p, m); break;
      case 'shot': if (p && p.alive) this.hostShot(p, m); break;
      case 'knife': if (p && p.alive) { const v = Game.players.find(q => q.id === m.v); if (v && v.alive && v.pos.distanceTo(p.pos) < 3.5) Game.damage(v, clamp(+m.dmg || 0, 0, 180), p, 'knife', { hg: 'chest', ap: .85, type: 'knife', raw: true }); this.broadcastFx({ t: 'swing', id: p.id }, c); } break;
      case 'zeus': if (p && p.alive) { const v = Game.players.find(q => q.id === m.v); if (v && v.alive && v.pos.distanceTo(p.pos) < 6) Game.damage(v, 500, p, 'zeus', { hg: 'chest', ap: 1, type: 'zeus', raw: true }); if (p.zeus) { p.zeus.clip = 0; p.zeus.readyAt = Game.time + W.zeus.recharge; } } break;
      case 'nade': if (p && p.alive && Array.isArray(m.o) && Array.isArray(m.v)) { const inst = p.nades.find(x => x.id === m.w); if (inst) { p.removeWeapon(inst); Grenades.spawn(m.w, new V3(+m.o[0], +m.o[1], +m.o[2]), new V3(clamp(+m.v[0], -40, 40), clamp(+m.v[1], -40, 40), clamp(+m.v[2], -40, 40)), p); } } break;
      case 'buy': if (p) { const err = Game.buy(p, String(m.i)); this.sendConn(conn, { t: 'e', e: [{ t: 'buyr', e: err || '' }] }); } break;
      case 'drop': if (p) p.cmd.dropHit = true; break;
      case 'use': if (p) p.cmd.useHit = true; break;
      case 'switch': if (p) { const w = p.weapons().find(x => x.uid === m.u); if (w && w !== p.active) { p.lastActive = p.active; p.active = w; p.zoom = 0; } } break;
      case 'chat': if (p) { const text = String(m.m || '').slice(0, 120); HUD.chat(p, text, !!m.tm); this.event({ t: 'chat', id: p.id, m: text, tm: m.tm ? 1 : 0 }); } break;
    }
  },
  applyInput(p, m) {
    if (!Array.isArray(m.p) || m.p.length !== 3) return;
    const x = +m.p[0], y = +m.p[1], z = +m.p[2]; if (!isFinite(x + y + z)) return;
    if (Math.abs(x) > 70 || Math.abs(z) > 70 || y < -40 || y > 30) return;
    if (p.tpUntil && performance.now() < p.tpUntil && Math.hypot(x - p.tpPos.x, z - p.tpPos.z) > 2.5) return;
    if (Array.isArray(m.v)) p.vel.set(+m.v[0] || 0, +m.v[1] || 0, +m.v[2] || 0);
    p.yaw = +m.y || 0; p.pitch = clamp(+m.pi || 0, -1.6, 1.6); p.eyeOff = clamp(+m.e || PHYS.eyeStand, PHYS.eyeDuck - .3, PHYS.eyeStand + .1);
    p.ducked = !!m.dk; p.onGround = !!m.g; p.zoom = m.z | 0;
    p.cmd.fire = !!(m.f & 1); p.cmd.use = !!(m.f & 2);
    if (m.w && (!p.active || p.active.uid !== m.w)) { const w = p.weapons().find(q => q.uid === m.w); if (w) { p.lastActive = p.active; p.active = w; } }
    if (Array.isArray(m.am)) for (const [uid, clip, res] of m.am) { const w = p.weapons().find(q => q.uid === uid); if (w && w.def.mag) { w.clip = clamp(clip | 0, 0, w.def.mag); w.reserve = clamp(res | 0, 0, w.def.res * 2); } }
    this.pushInterp(p, x, y, z, p.yaw, p.pitch);
  },
  hostShot(p, m) {
    const d = W[m.w]; if (!d || !Array.isArray(m.o)) return;
    const eye = new V3(+m.o[0], +m.o[1], +m.o[2]);
    if (eye.distanceTo(p.pos) > 3) return;
    const w = p.weapons().find(x => x.id === m.w) || { def: d, silenced: !!m.s, id: m.w };
    w.silenced = !!m.s;
    if (Array.isArray(m.h)) for (const h of m.h.slice(0, 12)) {
      const v = Game.players.find(q => q.id === h[0]); if (!v || !v.alive) continue;
      const hp = new V3(+h[7], +h[8], +h[9]);
      if (hp.distanceTo(v.pos) > 3) continue;
      Game.damage(v, clamp(+h[2] || 0, 0, d.dmg * 1.05), p, m.w, { hg: ['head', 'chest', 'stomach', 'arms', 'legs'].includes(h[1]) ? h[1] : 'chest', ap: d.ap, pen: !!h[3], smoke: !!h[4], noscope: !!h[5], blind: !!h[6], type: 'bullet', p: hp, dir: hp.clone().sub(eye).normalize() });
    }
    const ends = (m.e || []).slice(0, 12).map(a => new V3(+a[0], +a[1], +a[2]));
    const imps = (m.i || []).slice(0, 16).map(a => ({ p: new V3(+a[0], +a[1], +a[2]), n: new V3(+a[3], +a[4], +a[5]), kind: ['sand', 'hard', 'wood', 'metal'][a[6] | 0] || 'hard', exit: !!a[7] }));
    p.fireT = Game.time; p.lastShot = Game.time;
    Combat.shotFx(p, w, eye, ends, imps, false);
    Game.noise(p, w.silenced ? 'silenced' : 'shot');
    this.broadcastRaw({ t: 'shot', id: p.id, w: m.w, s: m.s ? 1 : 0, o: m.o, e: m.e, i: m.i }, p);
  },
  broadcastShot(shooter, w, eye, ends, imps) {
    this.broadcastRaw({ t: 'shot', id: shooter.id, w: w.id, s: w.silenced ? 1 : 0, o: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], e: ends.map(v => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]), i: this.packImps(imps) }, shooter);
  },
  packImps(imps) { const K = { sand: 0, hard: 1, wood: 2, metal: 3 }; return imps.slice(0, 16).map(im => [+im.p.x.toFixed(2), +im.p.y.toFixed(2), +im.p.z.toFixed(2), +im.n.x.toFixed(2), +im.n.y.toFixed(2), +im.n.z.toFixed(2), K[im.kind] || 0, im.exit ? 1 : 0]); },
  broadcastRaw(ev, except) { if (this.role !== 'host') return; this.evq.push(Object.assign(ev, { _x: except ? except.id : 0 })); },
  broadcastFx(ev, exceptConn) { if (this.role === 'host') this.evq.push(Object.assign(ev, { _x: exceptConn && exceptConn.id ? exceptConn.id : 0 })); },
  teleport(p) {
    if (this.role !== 'host' || !p.remote) return;
    // ignore stale positions the client sends before it has applied the teleport
    p.netBuf = [{ t: performance.now(), x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: 0 }]; p.tpPos = p.pos.clone(); p.tpUntil = performance.now() + 800;
    this.sendTo(p, { t: 'tp', p: [p.pos.x, p.pos.y, p.pos.z], y: p.yaw });
  },
  roundStart() { if (this.role === 'host') { this.evq.push({ t: 'rs', r: Game.round }); for (const p of Game.players) if (p.remote) this.teleport(p); } },
  sendSwitch(uid) { this.send({ t: 'switch', u: uid }); },
  sendShot(w, eye, ends, imps, hits) {
    this.send({ t: 'shot', w: w.id, s: w.silenced ? 1 : 0, o: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], e: ends.map(v => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]), i: this.packImps(imps), h: hits });
  },
  // called every frame by App
  tick(dt) {
    if (this.role === 'host' && App.inGame) {
      this.snapT -= dt; this.pingT -= dt;
      if (this.pingT <= 0) { this.pingT = 2; for (const c of this.conns.values()) this.sendConn(c.conn, { t: 'ping', ts: performance.now() }); }
      if (this.snapT <= 0) { this.snapT = 1 / 20; this.sendSnapshots(); }
    } else if (this.role === 'client' && App.inGame) {
      this.inT -= dt;
      if (this.inT <= 0) { this.inT = 1 / 30; this.sendInput(); }
      this.clientTick(dt);
    }
  },
  sendSnapshots() {
    const G = Game, now = G.time;
    const B = G.bomb;
    const base = {
      t: 's', ph: G.phase, pe: +(G.phaseEnd - now).toFixed(2), re: +(G.roundEnd - now).toFixed(2), el: +(now - G.liveStart).toFixed(2), r: G.round, sc: [G.score.CT, G.score.T], mr: G.maxRounds, w: G.win, me: +(G.matchEnd - now).toFixed(1),
      b: [B.state, B.pos ? +B.pos.x.toFixed(2) : 0, B.pos ? +B.pos.y.toFixed(2) : 0, B.pos ? +B.pos.z.toFixed(2) : 0, B.state === 'planted' ? +(B.explodeAt - now).toFixed(2) : 0, B.defuser ? B.defuser.id : 0, B.defuser ? +(now - B.defuser.defuseStart).toFixed(2) : 0, B.defuseLen || 10, B.carrier ? B.carrier.id : 0, B.site || ''],
      p: G.players.map(p => [p.id, +p.pos.x.toFixed(3), +p.pos.y.toFixed(3), +p.pos.z.toFixed(3), +p.yaw.toFixed(3), +p.pitch.toFixed(3), +p.eyeOff.toFixed(3),
        (p.alive ? 1 : 0) | (p.onGround ? 2 : 0) | (p.planting ? 4 : 0) | (p.defusing ? 8 : 0) | (p.c4 ? 16 : 0) | (p.zoom ? 32 : 0) | (p.helmet ? 64 : 0) | (p.defuser ? 128 : 0) | (p.ducked ? 256 : 0),
        p.hp, p.armor, p.active ? p.active.id : '', p.kills, p.deaths, p.assists, p.score, p.mvps, p.hsKills, p.dmgDealt, p.team, p.ping || 0, p.money, p.active ? p.active.skin : 'default', p.armsLevel, p.roundsPlayed, +(p.vel.x).toFixed(2), +(p.vel.z).toFixed(2)]),
      g: Grenades.list.map(n => [n.id, n.wid, +n.pos.x.toFixed(2), +n.pos.y.toFixed(2), +n.pos.z.toFixed(2)]),
      it: Items.list.map(it => [it.id, it.inst.id, +it.pos.x.toFixed(2), +it.pos.y.toFixed(2), +it.pos.z.toFixed(2), +it.yaw.toFixed(2), it.inst.skin]),
      sm: G.smokes.map(s => [s.id, +s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2), +(now - s.t0).toFixed(2)]),
      hi: G.history.length
    };
    const evs = this.evq; this.evq = [];
    for (const c of this.conns.values()) {
      const p = G.players.find(q => q.id === c.id);
      const m = Object.assign({}, base);
      if (p) m.you = { inv: p.weapons().map(w => [w.uid, w.id, w.clip, w.reserve, w.skin]), a: p.active ? p.active.uid : 0 };
      m.hist = G.history.slice(-30);
      this.sendConn(c.conn, m);
      const mine = evs.filter(e => e._x !== c.id);
      if (mine.length) this.sendConn(c.conn, { t: 'e', e: mine.map(e => { const o = Object.assign({}, e); delete o._x; return o; }) });
    }
  },
  pushInterp(p, x, y, z, yaw, pitch) {
    const b = p.netBuf || (p.netBuf = []);
    b.push({ t: performance.now(), x, y, z, yaw, pitch });
    if (b.length > 12) b.shift();
  },
  // smooth render position for network-driven players (100 ms behind)
  // writes the smoothed pose straight into the player, so hitboxes match what is drawn
  interp(p) {
    const b = p.netBuf; if (!b || !b.length) return; if (b.length < 2) { const a = b[0]; p.pos.set(a.x, a.y, a.z); p.yaw = a.yaw; p.pitch = a.pitch; return; }
    const rt = performance.now() - 100;
    let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
    const a = b[Math.max(0, i - 1)], c = b[i];
    const t = c.t === a.t ? 1 : clamp((rt - a.t) / (c.t - a.t), 0, 1);
    p.pos.set(lerp(a.x, c.x, t), lerp(a.y, c.y, t), lerp(a.z, c.z, t)); p.yaw = a.yaw + angDiff(a.yaw, c.yaw) * t; p.pitch = lerp(a.pitch, c.pitch, t);
  },

  /* ---------- client ---------- */
  sendInput() {
    const p = Game.local; if (!p) return;
    this.inN++;
    const m = { t: 'in', p: [+p.pos.x.toFixed(3), +p.pos.y.toFixed(3), +p.pos.z.toFixed(3)], v: [+p.vel.x.toFixed(2), +p.vel.y.toFixed(2), +p.vel.z.toFixed(2)], y: +p.yaw.toFixed(3), pi: +p.pitch.toFixed(3), e: +p.eyeOff.toFixed(3), dk: p.ducked ? 1 : 0, g: p.onGround ? 1 : 0, z: p.zoom, f: (p.cmd.fire ? 1 : 0) | (p.cmd.use ? 2 : 0), w: p.active ? p.active.uid : 0 };
    if (this.inN % 8 === 0) m.am = p.weapons().filter(w => w.def.mag).map(w => [w.uid, w.clip, w.reserve]);
    this.send(m);
  },
  onClient(m) {
    switch (m.t) {
      case 'welcome': this.myId = m.id; break;
      case 'lobby': this.lobby = { players: m.players, cfg: m.cfg }; this.refresh(); break;
      case 'err': this.fail(m.m); break;
      case 'ping': this.send({ t: 'pong', ts: m.ts }); break;
      case 'start': this.clientStart(m); break;
      case 's': if (App.inGame) this.applySnap(m); break;
      case 'e': if (App.inGame) for (const e of m.e) this.clientEvent(e); break;
    }
  },
  clientStart(m) {
    const roster = m.roster;
    App.startClientMatch(m.cfg, roster, m.you);
    this.lastRound = 0;
  },
  applySnap(m) {
    const G = Game, now = G.time, lp = G.local;
    G.phase = m.ph; G.phaseEnd = now + m.pe; G.roundEnd = now + m.re; G.liveStart = now - m.el; G.maxRounds = m.mr; G.win = m.w; G.matchEnd = now + m.me;
    G.score.CT = m.sc[0]; G.score.T = m.sc[1];
    if (m.hist) G.history = m.hist;
    if (m.r !== this.lastRound) { const first = this.lastRound === 0; this.lastRound = m.r; G.round = m.r; this.clientNewRound(first); }
    // players
    for (const a of m.p) {
      const p = G.players.find(q => q.id === a[0]); if (!p) continue;
      const alive = !!(a[7] & 1), team = a[18];
      if (team !== p.team) { p.team = team; if (p !== lp) G.rebuildModel(p); else { G.rebuildModel(p); } }
      p.kills = a[11]; p.deaths = a[12]; p.assists = a[13]; p.score = a[14]; p.mvps = a[15]; p.hsKills = a[16]; p.dmgDealt = a[17]; p.ping = a[19]; p.money = a[20]; p.armsLevel = a[22]; p.roundsPlayed = a[23];
      p.hp = a[8]; p.armor = a[9]; p.helmet = !!(a[7] & 64); p.defuser = !!(a[7] & 128);
      if (p === lp) {
        if (lp.alive && !alive) { lp.alive = false; lp.deathT = now; App.onLocalDeath(null); }
        if (!alive) lp.alive = false;
        const pl = !!(a[7] & 4); if (pl && !lp.planting) lp.plantStart = now; lp.planting = pl;
        continue;
      }
      if (p.alive && !alive) { p.deathT = now; if (p.model) p.model.deathSide = Math.random() < .5 ? 1 : -1; }
      if (!p.alive && alive) { p.netBuf = []; p.pos.set(a[1], a[2], a[3]); if (p.model) p.model.dead = 0; }
      p.alive = alive;
      p.eyeOff = a[6];
      p.vel.set(a[24] || 0, 0, a[25] || 0);
      p.onGround = !!(a[7] & 2); p.planting = !!(a[7] & 4); p.defusing = !!(a[7] & 8); p.zoom = (a[7] & 32) ? 1 : 0; p.ducked = !!(a[7] & 256);
      p.c4 = (a[7] & 16) ? (p.c4 || new WeaponInst('c4')) : null;
      const wid = a[10];
      if (wid && (!p.active || p.active.id !== wid)) { p.active = new WeaponInst(wid, a[21]); }
      else if (!wid) p.active = null;
      this.pushInterp(p, a[1], a[2], a[3], a[4], a[5]);
    }
    if (m.you && lp) this.syncInv(lp, m.you);
    // bomb
    const b = m.b, B = G.bomb, prev = B.state;
    B.state = b[0]; B.pos = (B.state === 'none' || B.state === 'carried') ? null : new V3(b[1], b[2], b[3]);
    B.site = b[9];
    if (B.state === 'carried') { B.carrier = G.players.find(q => q.id === b[8]) || null; B.pos = null; }
    if (B.state === 'planted') { B.explodeAt = now + b[4]; B.defuser = G.players.find(q => q.id === b[5]) || null; B.defuseLen = b[7]; if (B.defuser) B.defuser.defuseStart = now - b[6]; if (prev !== 'planted') { G.makeBombMesh(B.pos); B.nextBeep = now; } }
    else if (prev === 'planted' && B.state !== 'defused') G.clearBombMesh();
    if (lp && B.defuser === lp) { lp.defusing = true; lp.defuseStart = now - b[6]; } else if (lp) lp.defusing = false;
    // grenades in flight
    const seenG = new Set();
    for (const [id, wid, x, y, z] of m.g) {
      seenG.add(id); let g = this.cGren.get(id);
      if (!g) { const mesh = Models.gun(wid, 'default', 'T'); mesh.scale.setScalar(1.2); App.scene.add(mesh); g = { mesh, pos: new V3(x, y, z), tgt: new V3(x, y, z) }; this.cGren.set(id, g); }
      g.tgt.set(x, y, z);
    }
    for (const [id, g] of this.cGren) if (!seenG.has(id)) { App.scene.remove(g.mesh); this.cGren.delete(id); }
    // items on the ground
    const seenI = new Set();
    for (const [id, wid, x, y, z, yaw, skin] of m.it) {
      seenI.add(id); let it = this.cItems.get(id);
      if (!it) { const inst = new WeaponInst(wid, skin); const mesh = Models.gun(wid, skin, 'T'); mesh.rotation.set(0, yaw, Math.PI / 2); App.scene.add(mesh); it = { id, inst, pos: new V3(x, y, z), mesh, rest: true, t: 1, yaw }; this.cItems.set(id, it); }
      it.pos.set(x, y, z); it.mesh.position.set(x, y, z);
    }
    for (const [id, it] of this.cItems) if (!seenI.has(id)) { App.scene.remove(it.mesh); this.cItems.delete(id); }
    Items.list = [...this.cItems.values()];
    // smokes (needed for "through smoke" detection)
    G.smokes = m.sm.map(([id, x, y, z, age]) => ({ id, pos: new V3(x, y, z), t0: now - age, dur: 18 }));
  },
  syncInv(p, you) {
    const have = new Map(p.weapons().map(w => [w.uid, w]));
    const next = [];
    for (const [uid, id, clip, res, skin] of you.inv) {
      let w = have.get(uid);
      if (!w) { w = new WeaponInst(id, skin); w.uid = uid; w.clip = clip; w.reserve = res; w.fresh = true; }
      next.push(w);
    }
    const sameSet = next.length === have.size && next.every(w => have.has(w.uid));
    if (sameSet) return;
    const oldActive = p.active;
    p.primary = p.secondary = p.zeus = p.c4 = null; p.nades = []; p.knife = null;
    for (const w of next) p.addWeapon(w);
    if (!p.knife) p.knife = new WeaponInst('knife', Loadout.skinFor('knife'));
    const fresh = next.find(w => w.fresh && w.def.slot <= 2);
    for (const w of next) delete w.fresh;
    if (fresh) p.equip(fresh);
    else if (!oldActive || !p.weapons().includes(oldActive)) { p.active = null; p.equip(p.best(), true); }
  },
  clientNewRound(first) {
    FX.clear(); Game.clearBombMesh();
    for (const [, g] of this.cGren) App.scene.remove(g.mesh); this.cGren.clear();
    const lp = Game.local; if (lp) { lp.planting = lp.defusing = false; lp.flashEnd = 0; }
    HUD.roundStart(); App.onRoundStart();
  },
  clientTick(dt) {
    for (const [, g] of this.cGren) { g.pos.lerp(g.tgt, 1 - Math.exp(-dt * 20)); g.mesh.position.copy(g.pos); g.mesh.rotation.x += dt * 6; }
    const B = Game.bomb;
    if (B.state === 'planted' && B.pos && Game.time >= (B.nextBeep || 0)) {
      const left = B.explodeAt - Game.time;
      if (left > 0) { B.nextBeep = Game.time + clamp(Math.pow(left / Game.mode.bombTime, 1.4), .08, 1) * 1.05; SFX.play('beep', { pos: B.pos, vol: .9, ref: 5, roll: .9, norand: true }); }
    }
  },
  clientEvent(e) {
    const G = Game, lp = G.local, P = id => G.players.find(q => q.id === id);
    switch (e.t) {
      case 'tp': if (lp) { lp.pos.set(e.p[0], e.p[1], e.p[2]); lp.vel.set(0, 0, 0); lp.yaw = e.y; lp.pitch = 0; lp.onGround = true; lp.ducked = false; lp.eyeOff = PHYS.eyeStand; const wasDead = !lp.alive; lp.alive = true; lp.hp = 100; if (wasDead) App.onRespawn(); } break;
      case 'shot': { const p = P(e.id); if (!p) break; const w = { def: W[e.w], silenced: !!e.s, id: e.w }; if (!w.def) break; p.fireT = G.time; Combat.shotFx(p, w, new V3(e.o[0], e.o[1], e.o[2]), (e.e || []).map(a => new V3(a[0], a[1], a[2])), (e.i || []).map(a => ({ p: new V3(a[0], a[1], a[2]), n: new V3(a[3], a[4], a[5]), kind: ['sand', 'hard', 'wood', 'metal'][a[6]] || 'hard', exit: !!a[7] })), false); break; }
      case 'kill': HUD.killfeed(e.e); if (lp && e.e.v === lp.id && lp.alive) { lp.alive = false; App.onLocalDeath(P(e.e.a)); } break;
      case 'hurt': if (lp) { lp.lastDamageT = G.time; if (e.f) HUD.hurt({ x: e.f[0], z: e.f[1] }, e.d); lp.flinchY += 1.6 * DEG; lp.tagUntil = G.time + .35; } break;
      case 'flash': if (lp) { lp.flashStart = G.time; lp.flashDur = e.d; lp.flashEnd = G.time + e.d; HUD.flash(e.d); } break;
      case 'buyr': if (e.e) { SFX.ui('deny', .5); HUD.hint(e.e, 1.4); } else SFX.ui('buy', .6); HUD._buyKey = ''; break;
      case 'chat': { const p = e.id ? P(e.id) : null; if (e.id && !p) break; if (p) HUD.chat(p, e.m, !!e.tm); else HUD.sys(e.m); break; }
      case 'rend': { const mvp = e.mvp ? P(e.mvp) : null; HUD.roundEnd(e.w, e.m, mvp); SFX.say(e.w === 'T' ? 'Terrorists win' : 'Counter-Terrorists win'); SFX.ui(lp && lp.team === e.w ? 'win' : 'lose', .7); break; }
      case 'live': HUD.roundLive(); break;
      case 'mend': { const w = G.mode.ffa ? P(e.w) : e.w; G.phase = 'matchover'; App.matchOver(w, 'score'); break; }
      case 'planted': SFX.say('Bomb has been planted'); HUD.center('', 'The bomb has been planted', 3); break;
      case 'defused': SFX.say('Bomb has been defused'); SFX.play('defuse', { pos: G.bomb.pos || lp.pos, ref: 4 }); if (G.bombMesh && G.bombMesh.userData.led) G.bombMesh.userData.led.visible = false; break;
      case 'boom': { const p = new V3(e.p[0], e.p[1], e.p[2]); FX.explosion(p, e.k); SFX.play(e.k === 'c4' ? 'c4boom' : 'he', { pos: p, vol: 1.3, ref: e.k === 'c4' ? 20 : 10, roll: .6 }); if (e.k === 'c4') G.clearBombMesh(); const vp = G.viewPlayer(); if (vp) FX.shake = Math.max(FX.shake, clamp(1 - vp.pos.distanceTo(p) / (e.k === 'c4' ? 60 : 20), 0, 1) * (e.k === 'c4' ? 1.4 : .8)); break; }
      case 'fb': { const p = new V3(e.p[0], e.p[1], e.p[2]); FX.pFlash.spawn({ x: p.x, y: p.y, z: p.z, size: 5, life: .15, fin: .01 }); FX.light(p, 0xffffff, 200, 30, .25); SFX.play('flashbang', { pos: p, vol: 1.1, ref: 8 }); break; }
      case 'sboom': SFX.play('he', { pos: new V3(e.p[0], e.p[1], e.p[2]), vol: .3, ref: 3 }); break;
      case 'smoke': { const p = new V3(e.p[0], e.p[1], e.p[2]); FX.smoke(e.id, p, 18); SFX.play('smoke', { pos: p, ref: 5 }); break; }
      case 'fire': { const p = new V3(e.p[0], e.p[1], e.p[2]); FX.fire(e.id, p, 2.6, 7); SFX.play('molly', { pos: p, ref: 5 }); const s = SFX.play('fire', { pos: p, loop: true, vol: .8, ref: 4 }); this.fireSnd = this.fireSnd || new Map(); this.fireSnd.set(e.id, s); break; }
      case 'fireoff': { FX.removeFire(e.id); const s = this.fireSnd && this.fireSnd.get(e.id); if (s) { s.stop(); this.fireSnd.delete(e.id); } break; }
      case 'swing': { const p = P(e.id); if (p) { p.swingT = G.time; SFX.play('slash', { pos: p.eye(), vol: .6, ref: 3 }); } break; }
      case 'throw': { const p = P(e.id); if (p) SFX.play('throw', { pos: p.eye(), ref: 3 }); break; }
      case 'plantst': break;
      case 'defst': break;
      case 'rs': break;
    }
  }
};
