/* ===================== input ===================== */
const Input = {
  keys: new Set(), pressed: new Set(),
  mdx: 0, mdy: 0, wheel: 0,
  mb: [false, false, false], mbHit: [false, false, false], mbUp: [false, false, false],
  locked: false, canvas: null,
  typing: false,         // chat box focused
  rebindCb: null,        // settings "press a key" capture
  onKey: null,           // (code, event) => handled?  set by App for menus / toggles
  onLockChange: null,
  vc: { on: false, x: 0, y: 0, hov: null, el: null },

  init(canvas) {
    this.canvas = canvas;
    this.vc.el = $('#vcursor');
    const gameKeys = new Set(['Tab', 'Space', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyE', 'KeyR', 'KeyB', 'KeyQ', 'Backquote', 'Quote', 'Slash']);
    window.addEventListener('keydown', e => {
      if (this.rebindCb) { e.preventDefault(); const cb = this.rebindCb; this.rebindCb = null; cb(e.code); return; }
      if (this.typing) return;
      if (this.onKey && this.onKey(e.code, e)) { e.preventDefault(); return; }
      if (App.inGame) {
        // block browser shortcuts that collide with game keys (Ctrl+W cannot be blocked outside keyboard-lock fullscreen)
        if (gameKeys.has(e.code) || e.ctrlKey || e.code.startsWith('Digit')) e.preventDefault();
      }
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); if (App.inGame && gameKeys.has(e.code)) e.preventDefault(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mb = [false, false, false]; });
    const mcode = b => b === 1 ? 'Mouse3' : b === 3 ? 'Mouse4' : b === 4 ? 'Mouse5' : null;
    window.addEventListener('mousedown', e => {
      if (this.rebindCb && mcode(e.button)) { e.preventDefault(); const cb = this.rebindCb; this.rebindCb = null; cb(mcode(e.button)); return; }
      const mc = mcode(e.button); if (mc) { this.pressed.add(mc); this.keys.add(mc); }
      if (e.button > 2) return;
      if (this.vc.on && e.button === 0) { this.vcClick(); return; }
      if (!this.locked) return;
      this.mb[e.button] = true; this.mbHit[e.button] = true;
    });
    window.addEventListener('mouseup', e => {
      const mc = mcode(e.button); if (mc) this.keys.delete(mc);
      if (e.button > 2) return;
      if (this.mb[e.button]) this.mbUp[e.button] = true;
      this.mb[e.button] = false;
    });
    window.addEventListener('mousemove', e => {
      if (!this.locked) return;
      let dx = e.movementX || 0, dy = e.movementY || 0;
      // Chrome occasionally reports huge spikes on lock/unlock; drop them
      if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
      if (this.vc.on) { this.vcMove(dx, dy); return; }
      this.mdx += dx; this.mdy += dy;
    });
    window.addEventListener('wheel', e => { if (App.inGame) { this.wheel += Math.sign(e.deltaY); } }, { passive: true });
    window.addEventListener('contextmenu', e => { if (App.inGame) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.mb = [false, false, false]; this.setVCursor(false); }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { if (this.onLockChange) this.onLockChange(false, true); });
  },
  bind(a) { return Settings.v.binds[a]; },
  down(a) {
    const b = Settings.v.binds;
    if (a === 'crouch') return this.keys.has(b.crouch) || this.keys.has(b.crouch2);
    return this.keys.has(b[a]);
  },
  hit(a) {
    const b = Settings.v.binds;
    if (a === 'crouch') return this.pressed.has(b.crouch) || this.pressed.has(b.crouch2);
    return this.pressed.has(b[a]);
  },
  endFrame() {
    this.pressed.clear(); this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.mbHit[0] = this.mbHit[1] = this.mbHit[2] = false;
    this.mbUp[0] = this.mbUp[1] = this.mbUp[2] = false;
  },
  clearAll() { this.keys.clear(); this.pressed.clear(); this.mb = [false, false, false]; this.mdx = this.mdy = 0; },
  lock() {
    if (this.locked) return;
    const c = this.canvas;
    try {
      const p = Settings.v.rawInput ? c.requestPointerLock({ unadjustedMovement: true }) : c.requestPointerLock();
      if (p && p.catch) p.catch(() => { try { const q = c.requestPointerLock(); if (q && q.catch) q.catch(() => { }); } catch (e) { } });
    } catch (e) { try { c.requestPointerLock(); } catch (e2) { } }
  },
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); },
  // virtual cursor used for in-game overlays while the mouse stays captured
  setVCursor(on) {
    const vc = this.vc; vc.on = on && this.locked;
    vc.el.style.display = vc.on ? 'block' : 'none';
    if (vc.on) { vc.x = innerWidth / 2; vc.y = innerHeight / 2; this.vcMove(0, 0); }
    else if (vc.hov) { vc.hov.classList.remove('hov'); vc.hov = null; }
  },
  vcMove(dx, dy) {
    const vc = this.vc, k = 1.0;
    vc.x = clamp(vc.x + dx * k, 0, innerWidth - 2); vc.y = clamp(vc.y + dy * k, 0, innerHeight - 2);
    vc.el.style.transform = `translate(${vc.x}px,${vc.y}px)`;
    const t = document.elementFromPoint(vc.x, vc.y);
    const b = t && t.closest ? t.closest('button,.it') : null;
    if (b !== vc.hov) {
      if (vc.hov) { vc.hov.classList.remove('hov'); vc.hov.dispatchEvent(new MouseEvent('mouseleave')); }
      vc.hov = b; if (b) { b.classList.add('hov'); b.dispatchEvent(new MouseEvent('mouseenter')); }
    }
  },
  vcClick() { const vc = this.vc; const t = document.elementFromPoint(vc.x, vc.y); const b = t && t.closest ? t.closest('button,.it') : null; if (b) b.click(); }
};
