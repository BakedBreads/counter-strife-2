// load game modules, build agents holding weapons, render poses
for (const f of ['10_util.js', '13_textures.js', '20_weapons.js', '30_models.js', '32_agents.js']) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/src/' + f; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const buf = await (await fetch('/soldier.glb')).arrayBuffer();
await Agents.load(buf);
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(900, 900); document.body.appendChild(r.domElement);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a9aa8);
const envS = new THREE.Scene(); const sph = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
const cols = []; const pos = sph.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; const c = y > 0 ? new THREE.Color(0x9fc0e8).lerp(new THREE.Color(0xe8dcc0), 1 - y) : new THREE.Color(0x8a7458); cols.push(c.r, c.g, c.b); } sph.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); envS.add(sph);
scene.environment = new THREE.PMREMGenerator(r).fromScene(envS).texture; scene.environmentIntensity = .6;
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xb3936a, .9)); const d = new THREE.DirectionalLight(0xfff0d6, 3); d.position.set(-3, 6, 3); scene.add(d);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0xb8a078 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
const cam = new THREE.PerspectiveCamera(30, 1, .05, 100);
const mk = (team, gun, x, z, yaw, st) => {
  const ch = Agents.character(team); ch.root.position.set(x, 0, z); ch.root.rotation.y = yaw; scene.add(ch.root);
  if (gun) { const g = Models.gun(gun, 'default', team); ch.gun = g; ch.gunMount.add(g); }
  for (let i = 0; i < 12; i++) Agents.animate(ch, Object.assign({ speed: 0, fwdSpeed: 0, sideSpeed: 0, crouch: 0, air: false, pitch: 0, dead: 0, planting: false, cat: gun ? W[gun].cat : 'rifle', dt: 1 / 30 }, st));
  return ch;
};
const A = mk('CT', 'ak47', -1.5, 0, -.5, {});
const B = mk('T', 'ak47', 0, 0, -.5, {});
const C = mk('T', 'deagle', 1.5, 0, -.5, { crouch: 1 });
const D = mk('CT', 'm4a1s', 3, 0, -.5, { speed: 2.4, fwdSpeed: 2.4 });
cam.position.set(1.5, 1.6, -7); cam.lookAt(.8, 1, 0); r.render(scene, cam); await snap('front34');
cam.position.set(-6, 1.5, 0); cam.lookAt(.8, 1, 0); r.render(scene, cam); await snap('side');
// close-up of hands on the AK (T)
const h = B.rig.bones.RightHand.getWorldPosition(new V3());
cam.position.set(h.x + .8, h.y + .25, h.z - .7); cam.lookAt(h.x - .1, h.y, h.z - .2); r.render(scene, cam); await snap('hands');
cam.position.set(h.x - .9, h.y + .2, h.z - .5); cam.lookAt(h.x, h.y, h.z - .2); r.render(scene, cam); await snap('hands2');
return 'ok';
