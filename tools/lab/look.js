// first look at the soldier: bounds, bones, rest pose, textures; renders front / side / back
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(900, 900); document.body.appendChild(r.domElement);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a4048);
scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.4)); const d = new THREE.DirectionalLight(0xffffff, 2.5); d.position.set(2, 4, 3); scene.add(d);
const cam = new THREE.PerspectiveCamera(35, 1, .1, 100);
const gltf = await new THREE_ADDONS.GLTFLoader().loadAsync('/soldier.glb');
const m = gltf.scene; scene.add(m);
const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3());
const out = { size: size.toArray().map(v => +v.toFixed(3)), min: box.min.toArray().map(v => +v.toFixed(3)), scale: m.scale.toArray(), children: [] };
m.traverse(o => { if (o.isSkinnedMesh) out.children.push({ name: o.name, mat: o.material.name, map: !!o.material.map, normal: !!o.material.normalMap, rough: o.material.roughness, metal: o.material.metalness, color: o.material.color.getHexString() }); });
const bones = {}; m.traverse(o => { if (o.isBone) { const wp = o.getWorldPosition(new THREE.Vector3()); bones[o.name.replace('mixamorig', '')] = wp.toArray().map(v => +v.toFixed(3)); } });
out.bones = bones;
out.rootRot = m.children.map(c => c.name + ' ' + c.rotation.toArray().slice(0, 3).map(v => +v.toFixed(2)) + ' s' + c.scale.x.toFixed(3));
const ctr = box.getCenter(new THREE.Vector3());
for (const [name, ang] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) {
  cam.position.set(ctr.x + Math.sin(ang) * 5, ctr.y + .2, ctr.z + Math.cos(ang) * 5); cam.lookAt(ctr); r.render(scene, cam); await snap(name);
}
// head close-up
const hp = new THREE.Vector3(...bones['Head']); cam.position.set(hp.x, hp.y + .1, hp.z + 1.1); cam.lookAt(hp); r.render(scene, cam); await snap('head');
return out;
