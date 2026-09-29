for (const f of ['10_util.js', '13_textures.js', '20_weapons.js', '30_models.js', '32_agents.js']) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/src/' + f; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
await Agents.load(await (await fetch('/soldier.glb')).arrayBuffer());
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(640, 360); document.body.appendChild(r.domElement); r.domElement.style.cssText = 'position:absolute;left:0;top:0';
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9a888);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a7458, 2)); const d = new THREE.DirectionalLight(0xfff0d6, 3); d.position.set(-2, 4, 3); scene.add(d);
const cam = new THREE.PerspectiveCamera(64, 640 / 360, .01, 10); scene.add(cam);
const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; cv.style.cssText = 'position:absolute;left:0;top:0'; document.body.appendChild(cv); const g2 = cv.getContext('2d');
const fits = window.__fits || [[1.25, .06, -.12, -.36], [1.25, .1, -.16, -.34], [1.3, .12, -.2, -.36], [1.2, .1, -.18, -.3]];
const guns = window.__gun ? [window.__gun] : ['ak47', 'deagle'];
for (const id of guns) {
  fits.forEach(([s, x, y, z], k) => {
    Agents.vmFit = { s, x, y, z };
    const cat = W[id].cat, b = (window.__bases && window.__bases[k]) || (cat === 'pistol' ? [.16, -.15, -.36] : [.19, -.18, -.46]);
    const vm = new THREE.Group(); const gun = Models.gun(id, 'default', 'CT'); vm.add(gun); cam.add(vm);
    vm.position.set(b[0], b[1], b[2]); vm.rotation.set(0, .035, 0);
    const arms = Agents.viewArms('CT'); cam.add(arms.root); cam.updateMatrixWorld(true);
    Agents.poseViewArms(arms, gun, cat);
    r.render(scene, cam); g2.drawImage(r.domElement, (k % 2) * 640, Math.floor(k / 2) * 360);
    g2.fillStyle = '#000'; g2.font = '18px sans-serif'; g2.fillText(`s${s} x${x} y${y} z${z} gun ${b}`, (k % 2) * 640 + 10, Math.floor(k / 2) * 360 + 24);
    cam.remove(vm); cam.remove(arms.root);
  });
  await snap(id);
}
return 'ok';
