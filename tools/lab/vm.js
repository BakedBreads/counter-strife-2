// first-person arms test: vm camera at origin, weapon placed like the game's viewmodel, arms solved onto it
for (const f of ['10_util.js', '13_textures.js', '20_weapons.js', '30_models.js', '32_agents.js']) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/src/' + f; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
await Agents.load(await (await fetch('/soldier.glb')).arrayBuffer());
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1280, 720); document.body.appendChild(r.domElement);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9a888);
const envS = new THREE.Scene(); const sph = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0xc8d4e0 })); envS.add(sph);
scene.environment = new THREE.PMREMGenerator(r).fromScene(envS).texture; scene.environmentIntensity = .8;
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a7458, 1.5)); const d = new THREE.DirectionalLight(0xfff0d6, 3); d.position.set(-2, 4, 3); scene.add(d);
const cam = new THREE.PerspectiveCamera(64, 1280 / 720, .01, 10); scene.add(cam);
const base = { rifle: [.19, -.18, -.46], smg: [.18, -.17, -.42], sniper: [.19, -.18, -.48], pistol: [.16, -.15, -.36], knife: [.17, -.17, -.38], grenade: [.16, -.17, -.34], c4: [.05, -.21, -.36] };
const cases = (window.__cases || [['ak47', 'CT'], ['m4a1s', 'T'], ['deagle', 'CT'], ['knife', 'T'], ['awp', 'CT'], ['he', 'T'], ['p90', 'CT'], ['c4', 'T']]);
for (const [id, team] of cases) {
  const cat = W[id].cat, b = base[cat] || base.rifle;
  const vm = new THREE.Group(); const gun = Models.gun(id, 'default', team); vm.add(gun); cam.add(vm);
  vm.position.set(b[0], b[1], b[2]); vm.rotation.set(0, .035, cat === 'knife' ? .15 : 0);
  const arms = Agents.viewArms(team); cam.add(arms.root);
  cam.updateMatrixWorld(true);
  Agents.poseViewArms(arms, gun, cat);
  r.render(scene, cam); await snap(id);
  cam.remove(vm); cam.remove(arms.root);
}
return 'ok';
