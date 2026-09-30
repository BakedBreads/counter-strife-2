// first-person arms with different forearm slimming: node tools/modellab.js tools/lab/vmslim.js slim
for (const f of ['10_util.js', '13_textures.js', '20_weapons.js', '30_models.js', '32_agents.js', '33_guns.js']) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/src/' + f; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
await Agents.load(await (await fetch('/soldier.glb')).arrayBuffer());
const Wd = 640, Hd = 360;
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(Wd, Hd); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9a888);
const envS = new THREE.Scene(); envS.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0xc8d4e0 })));
scene.environment = new THREE.PMREMGenerator(r).fromScene(envS).texture; scene.environmentIntensity = .8;
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a7458, 1.5)); const d = new THREE.DirectionalLight(0xfff0d6, 3); d.position.set(-2, 4, 3); scene.add(d);
const V = window.__variants || [['usp', 1, 64, 'CT', 1], ['usp', .7, 64, 'CT', .72], ['usp', .62, 64, 'CT', .6], ['ak47', 1, 64, 'CT', 1], ['ak47', .7, 64, 'CT', .72], ['deagle', .7, 64, 'T', .72], ['knife', .7, 64, 'CT', .72], ['elite', .7, 64, 'T', .72]];
const cols = 4, rows = Math.ceil(V.length / cols);
const cv = document.createElement('canvas'); cv.width = cols * Wd; cv.height = rows * Hd; cv.style.cssText = 'position:absolute;left:0;top:0'; document.body.appendChild(cv); const g2 = cv.getContext('2d');
V.forEach(([id, slim, fov, team, cuff, fit], k) => {
  if (fit) { Agents._fitBak = Agents._fitBak || JSON.parse(JSON.stringify(Agents.vmFits)); Agents.vmFits = JSON.parse(JSON.stringify(Agents._fitBak)); Object.assign(Agents.vmFits[fit.key], fit.v); } else if (Agents._fitBak) Agents.vmFits = JSON.parse(JSON.stringify(Agents._fitBak));
  Agents.armSlim = slim; Agents.cuffSlim = cuff == null ? 1 : cuff;
  const cam = new THREE.PerspectiveCamera(fov, Wd / Hd, .01, 10); scene.add(cam);
  const def = W[id], cat = def.cat, b = Agents.vmBase(def);
  const vm = new THREE.Group(); const gun = Models.gun(id, 'default', team || 'CT'); vm.add(gun); cam.add(vm);
  const ref = window.__ref || 64, kz = Math.tan(ref / 2 * Math.PI / 180) / Math.tan(fov / 2 * Math.PI / 180), dz = b[2] * (kz - 1);
  vm.position.set(b[0], b[1], b[2] + dz); vm.rotation.set(b[4] || 0, b[3], b[5] || 0);
  const arms = Agents.viewArms(team || 'CT'); cam.add(arms.root); cam.updateMatrixWorld(true); vm.updateMatrixWorld(true);
  Agents.poseViewArms(arms, gun, cat, dz);
  r.render(scene, cam); g2.drawImage(r.domElement, (k % cols) * Wd, Math.floor(k / cols) * Hd);
  g2.fillStyle = '#000'; g2.font = '14px sans-serif'; g2.fillText(`${k}: ${id} slim=${slim} cuff=${cuff} fov=${fov} ${fit ? JSON.stringify(fit.v) : ''}`, (k % cols) * Wd + 6, Math.floor(k / cols) * Hd + 18);
  scene.remove(cam);
});
await snap('grid');
return 'ok';
