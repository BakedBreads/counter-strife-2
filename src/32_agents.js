/* ===================== agents: realistic skinned player models (Mixamo rig) ===================== */
// Third-person characters and first-person arms share one rigged soldier. Legs come from the walk/run/idle clips,
// the upper body is posed procedurally: spine follows the aim, and two-bone IK puts both hands on the weapon.
const Agents = {
  ready: false, gltf: null, clips: {}, mats: {}, portraits: {}, vmFit: { s: 1.2, x: .04, y: .02, z: -.3 },
  _q: new THREE.Quaternion(), _q2: new THREE.Quaternion(), _m: new THREE.Matrix4(), _a: new V3(), _b: new V3(), _c: new V3(), _d: new V3(), _e: new V3(),
  async load(buf) {
    const b64 = window.__AGENT_GLB; if (!buf && !b64) return false;
    const bin = buf || Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const gltf = await new Promise((res, rej) => new THREE_ADDONS.GLTFLoader().parse(bin, '', res, rej));
    this.gltf = gltf;
    for (const c of gltf.animations) {
      // scale tracks are constant; finger and arm tracks get overwritten by the pose each frame
      c.tracks = c.tracks.filter(t => !t.name.endsWith('.scale'));
      this.clips[c.name] = c;
    }
    await this.makeTeamMaterials();
    this.ready = true;
    return true;
  },
  /* ---------- team looks: recolor the armor texture per team ---------- */
  async makeTeamMaterials() {
    let body = null, visor = null;
    this.gltf.scene.traverse(o => { if (o.isSkinnedMesh) { if (/visor/i.test(o.name)) visor = o.material; else body = o.material; } });
    const src = body.map.image, W2 = src.width, H2 = src.height;
    const cv = document.createElement('canvas'); cv.width = W2; cv.height = H2;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
    const base = g.getImageData(0, 0, W2, H2);
    const col = new THREE.Color();
    const recolor = (team) => {
      const out = new ImageData(new Uint8ClampedArray(base.data), W2, H2), d = out.data, hsl = {}, rgb = {};
      for (let i = 0; i < d.length; i += 4) {
        col.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); col.getHSL(hsl, THREE.SRGBColorSpace);
        const h = hsl.h * 360, s = hsl.s, l = hsl.l;
        const tan = h > 12 && h < 55 && s > .12 && l > .22;
        const red = (h < 12 || h > 340) && s > .45 && l > .15;
        const green = h >= 55 && h < 190 && l < .5;
        if (team === 'CT') {
          if (tan) col.setHSL(.6, .22 + s * .2, clamp(l * .42, .05, .5), THREE.SRGBColorSpace);          // armor plates: slate navy
          else if (red) col.setHSL(.57, .65, clamp(l * 1.1, .2, .6), THREE.SRGBColorSpace);            // stripes: CT blue
          else if (green) col.setHSL(.6, .12, clamp(l * .6, .03, .3), THREE.SRGBColorSpace);           // undersuit: charcoal
          else continue;
        } else {
          if (tan) col.setHSL(.085 + (s - .3) * .02, clamp(s * .85, .1, .55), clamp(l * .92, .1, .85), THREE.SRGBColorSpace); // desert tan
          else if (red) col.setHSL(.03, .75, clamp(l, .2, .55), THREE.SRGBColorSpace);                 // stripes: burnt orange
          else if (green) col.setHSL(.1, .22, clamp(l * .75, .03, .35), THREE.SRGBColorSpace);         // undersuit: dark khaki
          else continue;
        }
        col.getRGB(rgb, THREE.SRGBColorSpace); d[i] = rgb.r * 255; d[i + 1] = rgb.g * 255; d[i + 2] = rgb.b * 255;
      }
      const tc = document.createElement('canvas'); tc.width = W2; tc.height = H2; tc.getContext('2d').putImageData(out, 0, 0);
      const t = new THREE.CanvasTexture(tc); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
      return t;
    };
    for (const team of ['CT', 'T']) {
      const b = body.clone(); b.map = recolor(team); b.roughness = team === 'CT' ? .62 : .78; b.metalness = team === 'CT' ? .22 : .08; b.envMapIntensity = 1;
      const v = visor.clone(); v.color = new THREE.Color(team === 'CT' ? 0x6f9fd8 : 0xd08a3a); v.roughness = .18; v.metalness = .7;
      if (team === 'T') v.emissive = new THREE.Color(0x2a1204);
      this.mats[team] = { body: b, visor: v };
    }
  },
  /* ---------- rig ---------- */
  rig(team, opts) {
    opts = opts || {};
    const model = THREE_ADDONS.SkeletonUtils.clone(this.gltf.scene);
    const bones = {}, meshes = [];
    model.traverse(o => {
      if (o.isBone) bones[o.name.replace('mixamorig', '')] = o;
      if (o.isSkinnedMesh) { o.material = /visor/i.test(o.name) ? this.mats[team].visor : this.mats[team].body; o.castShadow = !opts.arms; o.receiveShadow = !opts.arms; o.frustumCulled = false; meshes.push(o); }
    });
    const rest = {};
    for (const k in bones) rest[k] = bones[k].quaternion.clone();
    const r = { model, bones, meshes, rest, team };
    if (opts.arms) this.armsOnly(r);
    return r;
  },
  // keep only forearms, hands and fingers (first-person arms)
  armsOnly(r) {
    const keep = new Set(); const names = r.meshes[0].skeleton.bones.map(b => b.name.replace('mixamorig', ''));
    names.forEach((n, i) => { if (/(Left|Right)(ForeArm|Hand)$|Hand(Thumb|Index|Middle|Ring|Pinky)\d$/.test(n)) keep.add(i); });
    for (const m of r.meshes) {
      if (/visor/i.test(m.name)) { m.visible = false; continue; }
      const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
      const dom = new Int16Array(si.count);
      for (let v = 0; v < si.count; v++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } } dom[v] = best; }
      const out = [];
      for (let t = 0; t < idx.count; t += 3) { const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (keep.has(dom[a]) && keep.has(dom[b]) && keep.has(dom[c])) out.push(a, b, c); }
      const ng = g.clone(); ng.setIndex(out); m.geometry = ng;
      this.slimForearms(m, names, si, sw);
    }
  },
  // the Soldier's armoured sleeves and glove cuffs fill the screen up close: pull those vertices toward the
  // bone axis, fully along the forearm and fading out from the wrist to the knuckles
  armSlim: .62, cuffSlim: .62,
  slimForearms(m, names, si, sw) {
    if (this.armSlim >= 1 && this.cuffSlim >= 1) return;
    const sk = m.skeleton, bm = m.bindMatrix, bmi = m.bindMatrixInverse, M4 = new THREE.Matrix4();
    const at = i => new V3().setFromMatrixPosition(M4.copy(sk.boneInverses[i]).invert());
    const axis = {};
    for (const side of ['Left', 'Right']) {
      const fa = names.indexOf(side + 'ForeArm'), h = names.indexOf(side + 'Hand'), mid = names.indexOf(side + 'HandMiddle1');
      if (fa >= 0 && h >= 0) axis[fa] = { a: at(fa), b: at(h), s0: this.armSlim, s1: this.armSlim, t1: 1 };
      if (h >= 0 && mid >= 0) axis[h] = { a: at(h), b: at(mid), s0: this.cuffSlim, s1: 1, t1: .75 };
    }
    const pos = m.geometry.attributes.position, p = new V3(), c = new V3(), ab = new V3(), acc = new V3();
    for (let v = 0; v < pos.count; v++) {
      p.fromBufferAttribute(pos, v).applyMatrix4(bm); acc.set(0, 0, 0);
      let wsum = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(v, k), ax = axis[si.getComponent(v, k)]; if (!ax || w <= 0) continue;
        ab.subVectors(ax.b, ax.a);
        const t = clamp(c.subVectors(p, ax.a).dot(ab) / ab.lengthSq(), 0, 1);
        const s = ax.s0 + (ax.s1 - ax.s0) * clamp(t / ax.t1, 0, 1);
        c.copy(ax.a).addScaledVector(ab, t);
        acc.addScaledVector(c.sub(p), (1 - s) * w); wsum += w;
      }
      if (!wsum) continue;
      p.add(acc).applyMatrix4(bmi);
      pos.setXYZ(v, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  },
  /* ---------- pose helpers ---------- */
  // rotate a bone (in world space) so the direction to its child points along dir
  aimBone(bone, child, dir) {
    const a = bone.getWorldPosition(this._a), b = child.getWorldPosition(this._b);
    const cur = this._c.subVectors(b, a).normalize();
    this._q.setFromUnitVectors(cur, dir);
    const wq = bone.getWorldQuaternion(this._q2); wq.premultiply(this._q);
    this.setWorldQuat(bone, wq);
  },
  setWorldQuat(bone, wq) {
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(pq.multiply(wq));
    bone.updateMatrixWorld(true);
  },
  // two-bone IK: upper -> lower -> hand reaches target (world), elbow bends toward pole (world)
  ik(upper, lower, hand, target, pole) {
    const A = upper.getWorldPosition(new V3()), B = lower.getWorldPosition(new V3()), C = hand.getWorldPosition(new V3());
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const toT = new V3().subVectors(target, A); let d = toT.length();
    d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const dir = toT.normalize();
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), a = Math.acos(cosA);
    const pv = new V3().subVectors(pole, A); pv.addScaledVector(dir, -pv.dot(dir)); if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0); pv.normalize();
    const elbow = new V3().copy(A).addScaledVector(dir, Math.cos(a) * l1).addScaledVector(pv, Math.sin(a) * l1);
    this.aimBone(upper, lower, new V3().subVectors(elbow, A).normalize());
    const end = new V3().copy(A).addScaledVector(dir, d);
    this.aimBone(lower, hand, new V3().subVectors(end, lower.getWorldPosition(new V3())).normalize());
  },
  // set a hand's world orientation from finger direction and palm normal; side: 'R' | 'L'
  orientHand(hand, fingerDir, palmN, side) {
    const y = fingerDir.clone().normalize();
    const pn = palmN.clone().addScaledVector(y, -palmN.dot(y)).normalize();
    const x = pn.clone().negate();              // back of the hand = local +x
    const z = new V3().crossVectors(x, y).normalize();
    this._m.makeBasis(x, y, z);
    const wq = new THREE.Quaternion().setFromRotationMatrix(this._m);
    // spread the roll over the forearm so the wrist does not candy-wrap
    const fore = hand.parent;
    const fq = fore.getWorldQuaternion(new THREE.Quaternion());
    const fx = new V3(1, 0, 0).applyQuaternion(fq), fy = new V3(0, 1, 0).applyQuaternion(fq);
    const hx = x.clone().addScaledVector(fy, -x.dot(fy)).normalize();
    const ang = Math.atan2(new V3().crossVectors(fx, hx).dot(fy), fx.dot(hx));
    fq.premultiply(new THREE.Quaternion().setFromAxisAngle(fy, ang * .6));
    this.setWorldQuat(fore, fq);
    this.setWorldQuat(hand, wq);
  },
  fingers(r, side, curl, thumb) {
    const b = r.bones, S = side === 'R' ? 'Right' : 'Left';
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
      const c = f === 'Index' ? curl[0] : curl[1];
      for (let k = 1; k <= 3; k++) { const bn = b[S + 'Hand' + f + k]; if (!bn) continue; bn.quaternion.copy(r.rest[S + 'Hand' + f + k]).multiply(this._q.setFromAxisAngle(this._e.set(0, 0, 1), c * (k === 1 ? .8 : 1))); }
    }
    for (let k = 1; k <= 3; k++) { const bn = b[S + 'HandThumb' + k]; if (!bn) continue; bn.quaternion.copy(r.rest[S + 'HandThumb' + k]).multiply(this._q.setFromAxisAngle(this._e.set(side === 'R' ? 1 : -1, 0, 0), thumb[0] * (k === 1 ? 1 : .6))).multiply(this._q2.setFromAxisAngle(this._e.set(0, 0, 1), thumb[1])); }
  },
  // put both hands on a weapon object (its userData: grip + foregrip, in its local space)
  holdWeapon(r, gun, cat, opts) {
    const b = r.bones; opts = opts || {};
    r.model.updateMatrixWorld(true);
    const G = new V3(), F = new V3();
    const gunQ = gun.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new V3(0, 0, -1).applyQuaternion(gunQ), up = new V3(0, 1, 0).applyQuaternion(gunQ), right = new V3(1, 0, 0).applyQuaternion(gunQ);
    const root = r.model.getWorldQuaternion(new THREE.Quaternion());
    const rootRight = new V3(1, 0, 0).applyQuaternion(root), rootUp = new V3(0, 1, 0).applyQuaternion(root);
    const sh = b.RightArm.getWorldPosition(new V3()), shL = b.LeftArm.getWorldPosition(new V3());
    const one = cat === 'knife' || cat === 'grenade' || cat === 'zeus';
    // right hand: wrist sits behind and above the grip, fingers wrap forward-down around it
    gun.localToWorld(G.set(0, -.02, .035));
    const fdR = new V3().copy(fwd).multiplyScalar(.62).addScaledVector(up, -.72).addScaledVector(right, -.18).normalize();
    const wristR = G.clone().addScaledVector(fdR, -.075).addScaledVector(right, .025);
    const view = !!opts.view;
    // first person: elbows hang low so the forearms rise from the bottom of the screen
    const poleR = view ? sh.clone().addScaledVector(rootRight, .25).addScaledVector(rootUp, -1.3).addScaledVector(fwd, .25) : sh.clone().addScaledVector(rootRight, .45).addScaledVector(rootUp, -.7).addScaledVector(fwd, -.1);
    const poleL = view ? shL.clone().addScaledVector(rootRight, -.12).addScaledVector(rootUp, -1.6).addScaledVector(fwd, .15) : null;
    this.ik(b.RightArm, b.RightForeArm, b.RightHand, wristR, poleR);
    this.orientHand(b.RightHand, fdR, right.clone().negate(), 'R');
    this.fingers(r, 'R', one ? [1.1, 1.3] : [.55, 1.35], [.35, .5]);
    // left hand
    if (cat === 'c4') {
      gun.localToWorld(F.set(-.05, .02, .03));
      const fdL = new V3().copy(fwd).multiplyScalar(.5).addScaledVector(right, .6).addScaledVector(up, -.3).normalize();
      this.ik(b.LeftArm, b.LeftForeArm, b.LeftHand, F.clone().addScaledVector(fdL, -.07), shL.clone().addScaledVector(rootRight, -.5).addScaledVector(rootUp, -.6));
      this.orientHand(b.LeftHand, fdL, up.clone(), 'L'); this.fingers(r, 'L', [.3, .4], [.2, .2]);
    } else if (one) {
      // free hand hangs relaxed a little forward
      const lp = shL.clone().addScaledVector(rootUp, -.5).addScaledVector(fwd, .18).addScaledVector(rootRight, -.08);
      this.ik(b.LeftArm, b.LeftForeArm, b.LeftHand, lp, shL.clone().addScaledVector(rootRight, -.4).addScaledVector(rootUp, -.2).addScaledVector(fwd, -.4));
      this.fingers(r, 'L', [.35, .5], [.2, .2]);
    } else if (gun.userData.dual) {
      // dual pistols: the left hand grips its own gun, mirrored
      gun.localToWorld(F.set(gun.userData.dual, -.02, .035));
      const fdL = new V3().copy(fwd).multiplyScalar(.62).addScaledVector(up, -.72).addScaledVector(right, .18).normalize();
      this.ik(b.LeftArm, b.LeftForeArm, b.LeftHand, F.clone().addScaledVector(fdL, -.075).addScaledVector(right, -.025), poleL || shL.clone().addScaledVector(rootRight, -.45).addScaledVector(rootUp, -.7).addScaledVector(fwd, -.1));
      this.orientHand(b.LeftHand, fdL, right.clone(), 'L');
      this.fingers(r, 'L', [.55, 1.35], [.35, .5]);
    } else if (cat === 'pistol') {
      // support hand cups the shooting hand
      gun.localToWorld(F.set(-.03, -.045, .03));
      const fdL = new V3().copy(fwd).multiplyScalar(.55).addScaledVector(right, .55).addScaledVector(up, -.45).normalize();
      this.ik(b.LeftArm, b.LeftForeArm, b.LeftHand, F.clone().addScaledVector(fdL, -.075), poleL || shL.clone().addScaledVector(rootRight, -.5).addScaledVector(rootUp, -.65));
      this.orientHand(b.LeftHand, fdL, right.clone().multiplyScalar(.7).addScaledVector(up, .4), 'L');
      this.fingers(r, 'L', [1.0, 1.15], [.3, .3]);
    } else {
      // rifles: support hand under the handguard
      const fz = gun.userData.foreZ != null ? gun.userData.foreZ : -.25;
      gun.localToWorld(F.set(0, -.03, fz));
      const fdL = new V3().copy(right).multiplyScalar(.7).addScaledVector(fwd, .55).addScaledVector(up, .2).normalize();
      const wristL = F.clone().addScaledVector(fdL, -.07).addScaledVector(up, -.025);
      this.ik(b.LeftArm, b.LeftForeArm, b.LeftHand, wristL, poleL || shL.clone().addScaledVector(rootRight, -.35).addScaledVector(rootUp, -.75));
      this.orientHand(b.LeftHand, fdL, up.clone().multiplyScalar(.9).addScaledVector(right, .3), 'L');
      this.fingers(r, 'L', [.9, 1.05], [.4, .2]);
    }
  },
  /* ---------- third-person character ---------- */
  character(team) {
    const r = this.rig(team);
    const root = new THREE.Group(); root.rotation.order = 'YXZ';
    root.add(r.model);
    const mixer = new THREE.AnimationMixer(r.model);
    const act = {};
    for (const n of ['Idle', 'Walk', 'Run']) { act[n] = mixer.clipAction(this.clips[n]); act[n].play(); act[n].setEffectiveWeight(n === 'Idle' ? 1 : 0); }
    const gunMount = new THREE.Group(); root.add(gunMount);
    return { agent: true, root, rig: r, mixer, act, gunMount, gun: null, gunId: null, dead: 0, deathSide: 1, team, phase: 0, w: { Idle: 1, Walk: 0, Run: 0 } };
  },
  // st: {speed, fwdSpeed, sideSpeed, crouch, air, pitch, dead, planting, cat, dt}
  animate(ch, st) {
    const r = ch.rig, b = r.bones, dt = st.dt;
    // locomotion weights
    const fwdS = st.fwdSpeed || 0, sideS = st.sideSpeed || 0;
    const sp = st.speed || 0, want = { Idle: sp < .4 ? 1 : 0, Walk: sp >= .4 && sp < 3.8 ? 1 : 0, Run: sp >= 3.8 ? 1 : 0 };
    if (st.air || st.dead) { want.Idle = 1; want.Walk = want.Run = 0; }
    const k = 1 - Math.exp(-dt * 10);
    for (const n in ch.act) { ch.w[n] += (want[n] - ch.w[n]) * k; ch.act[n].setEffectiveWeight(ch.w[n]); }
    const back = fwdS < -.3 ? -1 : 1;
    ch.act.Walk.timeScale = back * clamp(sp / 1.6, .5, 1.6) * (st.crouch > .5 ? .7 : 1);
    ch.act.Run.timeScale = back * clamp(sp / 5.2, .6, 1.3);
    ch.mixer.update(dt);
    // strafing: twist the hips toward the movement direction, keep the chest on the aim
    const strafe = sp > .4 ? clamp(Math.atan2(sideS, Math.abs(fwdS) + .01), -1.1, 1.1) * (back < 0 ? -1 : 1) : 0;
    ch.hipYaw = lerp(ch.hipYaw || 0, st.dead ? 0 : -strafe * .75, k);
    const q = this._q;
    b.Hips.quaternion.premultiply(q.setFromAxisAngle(this._e.set(0, 0, 1), ch.hipYaw));
    const c = st.crouch;
    if (c > .01) {
      b.Hips.position.z -= c * 44;                                    // centimeters, in the rig's own space
      b.Hips.quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), c * .25));
      for (const s of ['Left', 'Right']) {
        b[s + 'UpLeg'].quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), -c * (s === 'Left' ? 1.45 : 1.15)));
        b[s + 'Leg'].quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), c * (s === 'Left' ? 1.9 : 2.3)));
        b[s + 'Foot'].quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), -c * .45));
      }
    }
    if (st.air && !st.dead) for (const s of ['Left', 'Right']) {
      b[s + 'UpLeg'].quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), -.55));
      b[s + 'Leg'].quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), .9));
    }
    // spine and head follow the aim (undo the hip twist on the way up)
    const p = clamp(st.pitch, -1.2, 1.2);
    for (const s of ['Spine', 'Spine1', 'Spine2']) {
      b[s].quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), -p * .22 - c * .06));
      b[s].quaternion.multiply(q.setFromAxisAngle(this._e.set(0, 1, 0), -ch.hipYaw / 3));
    }
    b.Neck.quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), -p * .15));
    b.Head.quaternion.multiply(q.setFromAxisAngle(this._e.set(1, 0, 0), -p * .19));
    // death: fall over backward and let the pose settle
    if (st.dead > 0) {
      const d = smooth01(st.dead);
      ch.root.rotation.x = d * 1.52 * (ch.deathSide > 0 ? 1 : .92);
      ch.root.rotation.z = d * .22 * ch.deathSide;
      if (ch.gun) ch.gun.visible = d < .15;
      return;
    }
    ch.root.rotation.x = 0; ch.root.rotation.z = 0;
    // the weapon hangs off the upper chest, pitched with the aim; then both hands are solved onto it
    if (ch.gun) {
      ch.gun.visible = true;
      r.model.updateMatrixWorld(true);
      const piv = b.Spine2.getWorldPosition(this._d); ch.root.worldToLocal(piv);
      const cat = st.cat, P = st.planting;
      const off = P ? [.04, -.62, -.34] : cat === 'pistol' || cat === 'zeus' ? [.02, .04, -.46] : cat === 'knife' ? [.2, -.08, -.34] : cat === 'grenade' ? [.2, .05, -.26] : cat === 'c4' ? [.06, -.2, -.3] : [.11, .05, -.2];
      const aimP = P ? -.9 : p;
      const aq = this._q2.setFromAxisAngle(this._e.set(1, 0, 0), aimP);
      const o = this._a.set(off[0], off[1] + .12, off[2]).applyQuaternion(aq);
      ch.gun.position.set(piv.x + o.x, piv.y + o.y, piv.z + o.z);
      ch.gun.quaternion.copy(aq);
      if (cat === 'knife') ch.gun.quaternion.multiply(this._q.setFromAxisAngle(this._e.set(1, 0, 0), -.5));
      ch.gun.updateMatrixWorld(true);
      this.holdWeapon(r, ch.gun, P ? 'c4' : cat);
    }
  },
  /* ---------- first-person arms ---------- */
  viewArms(team) {
    const r = this.rig(team, { arms: true });
    const root = new THREE.Group(); root.add(r.model);
    return { root, rig: r, team };
  },
  // arms rig lives in the viewmodel camera space; gun already placed there
  vmFits: {
    long: { s: 1.2, x: .1, y: -.3, z: -.3 }, pistol: { s: 1.05, x: .16, y: -.42, z: -.26 }, dual: { s: 1.05, x: .0, y: -.4, z: -.24 },
    knife: { s: .95, x: .22, y: -.46, z: -.3 }, grenade: { s: .95, x: .2, y: -.44, z: -.3 }, c4: { s: 1.05, x: .02, y: -.36, z: -.2 }
  },
  // camera-space weapon placement [x, y, z, yaw] per family, tuned together with vmFits so both hands reach
  vmBase(d) {
    const cat = d.cat;
    const t = this.vmTable[d.dual ? 'dual' : cat] || this.vmTable.rifle;
    const b = t.slice();
    if (d.id === 'famas' || d.id === 'aug' || d.id === 'p90') { b[2] -= .1; b[1] -= .01; }
    return b;
  },
  vmTable: { rifle: [.19, -.18, -.46, .035], smg: [.18, -.17, -.44, .04], mg: [.2, -.19, -.48, .035], shotgun: [.19, -.18, -.46, .035], sniper: [.19, -.18, -.48, .035], pistol: [.19, -.07, -.53, .22], dual: [.1, -.1, -.52, 0], knife: [.22, -.14, -.44, .5, .55, .35], grenade: [.2, -.1, -.46, .2, .2, 0], c4: [.05, -.16, -.4, 0], zeus: [.19, -.07, -.53, .22] },
  poseViewArms(arms, gun, cat, dz) {
    const r = arms.rig;
    // head of the rig sits at the camera; body slid forward so both hands reach the weapon
    const F = this.vmFits, dual = !!gun.userData.dual;
    const V = dual ? F.dual : cat === 'pistol' || cat === 'zeus' ? F.pistol : cat === 'knife' ? F.knife : cat === 'grenade' ? F.grenade : cat === 'c4' ? F.c4 : F.long; r.model.scale.setScalar(V.s); r.model.position.set(V.x, -1.62 * V.s + V.y, V.z + (dz || 0));
    for (const k in r.rest) r.bones[k].quaternion.copy(r.rest[k]);
    arms.root.updateMatrixWorld(true);
    this.holdWeapon(r, gun, cat, { view: true });
  },
  // small head-and-shoulders portraits for the HUD
  makePortraits(renderer) {
    const rt = new THREE.WebGLRenderTarget(128, 128, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.5));
    const dl = new THREE.DirectionalLight(0xffffff, 2.4); dl.position.set(-1, 2, -2); scene.add(dl);
    const cam = new THREE.PerspectiveCamera(24, 1, .05, 10);
    const buf = new Uint8Array(128 * 128 * 4), cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const team of ['CT', 'T']) {
      const r = this.rig(team); scene.add(r.model);
      const mixer = new THREE.AnimationMixer(r.model); mixer.clipAction(this.clips.Idle).play(); mixer.update(.5);
      r.model.updateMatrixWorld(true);
      const h = r.bones.Head.getWorldPosition(new V3());
      cam.position.set(h.x - .22, h.y + .12, h.z - .95); cam.lookAt(h.x, h.y + .06, h.z);
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, 128, 128, buf);
      const img = g.createImageData(128, 128);
      for (let y = 0; y < 128; y++) img.data.set(buf.subarray((127 - y) * 512, (128 - y) * 512), y * 512);
      g.putImageData(img, 0, 0); this.portraits[team] = cv.toDataURL();
      scene.remove(r.model);
    }
    renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); rt.dispose();
  }
};
