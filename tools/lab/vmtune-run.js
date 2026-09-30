window.__variants = [
  ['deagle', 'pistol', [.19, -.09, -.52, .26], { s: 1.05, x: .16, y: -.42, z: -.26 }],
  ['deagle', 'pistol', [.18, -.06, -.6, .22], { s: .95, x: .15, y: -.48, z: -.3 }],
  ['deagle', 'pistol', [.2, -.07, -.58, .3], { s: .9, x: .18, y: -.5, z: -.32 }],
  ['glock', 'pistol', [.2, -.07, -.58, .3], { s: .9, x: .18, y: -.5, z: -.32 }],
  ['knife', 'knife', [.17, -.13, -.42, .2], { s: 1.05, x: .14, y: -.36, z: -.24 }],
  ['knife', 'knife', [.2, -.12, -.46, .35, .35, .25], { s: .95, x: .2, y: -.44, z: -.3 }],
  ['knife', 'knife', [.22, -.14, -.44, .5, .55, .35], { s: .95, x: .22, y: -.46, z: -.3 }],
  ['he', 'grenade', [.2, -.1, -.46, .2, .2, 0], { s: .95, x: .2, y: -.44, z: -.3 }]
];
// renders variants of the pistol / knife first-person placement side by side
for (const f of ['10_util.js', '13_textures.js', '20_weapons.js', '30_models.js', '32_agents.js', '33_guns.js']) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/src/' + f; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
await Agents.load(await (await fetch('/soldier.glb')).arrayBuffer());
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(480, 270); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9a888);
const envS = new THREE.Scene(); envS.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0xc8d4e0 })));
scene.environment = new THREE.PMREMGenerator(r).fromScene(envS).texture; scene.environmentIntensity = .8;
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a7458, 1.5)); const d = new THREE.DirectionalLight(0xfff0d6, 3); d.position.set(-2, 4, 3); scene.add(d);
const cam = new THREE.PerspectiveCamera(64, 480 / 270, .01, 10); scene.add(cam);
// each variant: [weapon id, table key, base [x,y,z,yaw,pitch,roll], fit {s,x,y,z}]
const V = window.__variants;
const cols = 4, rows = Math.ceil(V.length / cols);
const cv = document.createElement('canvas'); cv.width = cols * 480; cv.height = rows * 270; cv.style.cssText = 'position:absolute;left:0;top:0'; document.body.appendChild(cv); const g2 = cv.getContext('2d');
V.forEach(([id, key, b, fit], k) => {
  Agents.vmFits[key] = fit;
  const def = W[id], cat = def.cat;
  const vm = new THREE.Group(); const gun = Models.gun(id, 'default', 'CT'); vm.add(gun); cam.add(vm);
  vm.position.set(b[0], b[1], b[2]); vm.rotation.set(b[4] || 0, b[3], b[5] || 0);
  const arms = Agents.viewArms('CT'); cam.add(arms.root); cam.updateMatrixWorld(true); vm.updateMatrixWorld(true);
  Agents.poseViewArms(arms, gun, cat);
  r.render(scene, cam); g2.drawImage(r.domElement, (k % cols) * 480, Math.floor(k / cols) * 270);
  g2.fillStyle = '#000'; g2.font = '13px sans-serif'; g2.fillText(`${k}: ${id} b=${b} s=${fit.s} ${fit.x},${fit.y},${fit.z}`, (k % cols) * 480 + 6, Math.floor(k / cols) * 270 + 16);
  cam.remove(vm); cam.remove(arms.root);
});
await snap('grid');
return 'ok';
