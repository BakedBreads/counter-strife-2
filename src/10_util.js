'use strict';
/* ===================== utilities ===================== */
const V3 = THREE.Vector3;
const TAU = Math.PI * 2, DEG = Math.PI / 180, U = 0.0254; // U: one Source unit in meters
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
function wrapAngle(a) { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; }
const angDiff = (a, b) => wrapAngle(b - a);
// yaw 0 looks down -Z; positive yaw turns left (counter-clockwise seen from above), matching three.js rotation.y
function dirFromAngles(yaw, pitch, out) {
  out = out || new V3(); const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}
function yawTo(dx, dz) { return Math.atan2(-dx, -dz); }
function pitchTo(dx, dy, dz) { return Math.atan2(dy, Math.hypot(dx, dz)); }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
function show(el, on) { if (typeof el === 'string') el = $(el); if (el) el.classList.toggle('hidden', !on); }
let _uid = 1;
const newUid = () => _uid++;
// a tiny pool of scratch vectors for hot paths
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3();

/* ---------- persistent storage (never trusted to exist) ---------- */
const Store = {
  get(k, def) { try { const v = localStorage.getItem('cs2x.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('cs2x.' + k, JSON.stringify(v)); } catch (e) { /* private mode / blocked */ } }
};

/* ---------- settings ---------- */
const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', crouch: 'ControlLeft', crouch2: 'KeyC',
  walk: 'ShiftLeft', reload: 'KeyR', use: 'KeyE', drop: 'KeyG', buy: 'KeyB', scores: 'Tab', inspect: 'KeyF',
  slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4', slot5: 'Digit5', lastWeapon: 'KeyQ',
  chat: 'KeyY', teamChat: 'KeyU', teamMenu: 'KeyM'
};
const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', jump: 'Jump', crouch: 'Crouch',
  crouch2: 'Crouch (alt)', walk: 'Walk (silent)', reload: 'Reload', use: 'Use / defuse / pick up', drop: 'Drop weapon',
  buy: 'Buy menu', scores: 'Scoreboard', inspect: 'Inspect weapon', slot1: 'Primary weapon', slot2: 'Pistol',
  slot3: 'Knife / Zeus', slot4: 'Grenades', slot5: 'C4 bomb', lastWeapon: 'Last weapon', chat: 'Chat (all)',
  teamChat: 'Chat (team)', teamMenu: 'Change team'
};
const DEFAULT_SETTINGS = {
  name: 'Player', sens: 1.6, zoomRatio: 1.0, invertY: false, rawInput: true,
  fov: 74, vmFov: 64, vmHand: 'right', bob: true, showFps: false, announcer: true, blood: true,
  xhStyle: 'classic', xhSize: 5, xhGap: 1, xhThick: 1.5, xhColor: '#4cff5a', xhOutline: true, xhDot: false, xhDynamic: true, xhAlpha: 1,
  volume: 0.7, sfx: 1.0, ui: 0.7,
  renderScale: 1, shadows: 'high', texQ: 'high', aa: true, autoFull: true,
  difficulty: 'hard', mode: 'competitive', team: 'auto', ff: true, botCount: 'fill',
  binds: Object.assign({}, DEFAULT_BINDS)
};
const Settings = {
  v: null,
  load() {
    const s = Store.get('settings', {});
    this.v = Object.assign({}, DEFAULT_SETTINGS, s);
    this.v.binds = Object.assign({}, DEFAULT_BINDS, s.binds || {});
    return this.v;
  },
  save() { Store.set('settings', this.v); }
};
Settings.load();

/* ---------- key names ---------- */
function keyName(code) {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const m = { Space: 'Space', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', AltLeft: 'L-Alt', AltRight: 'R-Alt', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Enter: 'Enter', Backspace: 'Bksp', Mouse3: 'Mouse 3', Mouse4: 'Mouse 4', Mouse5: 'Mouse 5' };
  return m[code] || code.replace('Numpad', 'Num ').replace('Arrow', '');
}

/* ---------- inline SVG icons (24x24) ---------- */
const ICON = {
  health: '<svg viewBox="0 0 24 24"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>',
  armor: '<svg viewBox="0 0 24 24"><path d="M12 1l9 4v6c0 6-4 10.5-9 12C7 21.5 3 17 3 11V5z"/></svg>',
  helmet: '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 3 7.5 3 13v3h8v-3h10v-1C21 7 17.5 3 12 3zM2 17h20v3H2z"/></svg>',
  kit: '<svg viewBox="0 0 24 24"><path d="M7 2l3 7-2 2 5 5 2-2 7 3-3 3-6-2-4-4-2-6zM3 17l4 4-2 1-3-3z"/></svg>',
  bomb: '<svg viewBox="0 0 24 24"><path d="M3 7h18v12H3zM5 9v8h6V9zm8 0v2h6V9zm0 4v2h2v-2zm4 0v2h2v-2zM7 3h2v3H7zm8 0h2v3h-2z"/></svg>',
  hs: '<svg viewBox="0 0 24 24"><path d="M12 2a8 8 0 00-8 8c0 3 1.5 5 3.5 6.3V21h9v-4.7C18.5 15 20 13 20 10a8 8 0 00-8-8zm-3 7.5a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6zm6 0a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6zM17 3l4 1-3 3z"/></svg>',
  wall: '<svg viewBox="0 0 24 24"><path d="M2 4h9v5H2zm11 0h9v5h-9zM2 11h5v5H2zm7 0h6v5H9zm8 0h5v5h-5zM2 18h9v3H2zm11 0h9v3h-9z" opacity=".55"/><path d="M1 12.2h22v1.6H1z"/></svg>',
  smoke: '<svg viewBox="0 0 24 24"><path d="M6 18a4 4 0 01-.6-8A6 6 0 0117 7.5a4.5 4.5 0 011 8.9V18z"/></svg>',
  blind: '<svg viewBox="0 0 24 24"><path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8zM3 3l18 18-1.4 1.4L1.6 4.4z"/></svg>',
  noscope: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 2a7 7 0 016.3 10L9 5.7A7 7 0 0112 5zM5.7 9L15 18.3A7 7 0 015.7 9z"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path d="M12 2a9 9 0 00-9 9c0 3 1.6 5.4 4 6.9V22h3v-2h4v2h3v-4.1c2.4-1.5 4-3.9 4-6.9a9 9 0 00-9-9zM8.5 10a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.4l4 2.4-1 1.7-5-3V7z"/></svg>',
  defuse: '<svg viewBox="0 0 24 24"><path d="M5 3l6 6-2 2L3 5zm14 0l2 2-12 12-3 1 1-3zM14 14l6 6-2 2-6-6z"/></svg>',
  ct: '<svg viewBox="0 0 24 24"><path d="M12 1l9 4v6c0 6-4 10.5-9 12C7 21.5 3 17 3 11V5zm0 4l-5 2.2V11c0 3.8 2.3 6.8 5 7.9 2.7-1.1 5-4.1 5-7.9V7.2z"/></svg>',
  t: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6 7 1-5 4.8L18.2 21 12 17.6 5.8 21 7 13.8 2 9l7-1z" opacity=".25"/><path d="M4 4h16v4h-6v13h-4V8H4z"/></svg>',
  elim: '<svg viewBox="0 0 24 24"><path d="M12 2a9 9 0 00-9 9c0 3 1.6 5.4 4 6.9V22h3v-2h4v2h3v-4.1c2.4-1.5 4-3.9 4-6.9a9 9 0 00-9-9zM8.5 10a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4z"/></svg>',
  bullet: '<svg viewBox="0 0 24 24"><path d="M10 2c-1.5 2-2 4-2 6v12h8V8c0-2-.5-4-2-6z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
};
