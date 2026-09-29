// rest-pose world axes of arm/hand/finger bones, and texture info
const gltf = await new THREE_ADDONS.GLTFLoader().loadAsync('/soldier.glb');
const m = gltf.scene; m.updateMatrixWorld(true);
const out = {};
const ax = (o) => { const q = o.getWorldQuaternion(new THREE.Quaternion()); const f = v => new THREE.Vector3(...v).applyQuaternion(q).toArray().map(x => +x.toFixed(2)); return { x: f([1, 0, 0]), y: f([0, 1, 0]), z: f([0, 0, 1]) }; };
m.traverse(o => { if (o.isBone && /RightArm$|RightForeArm$|RightHand$|RightHandIndex1$|RightHandIndex2$|RightHandThumb1$|RightHandThumb2$|LeftArm$|LeftForeArm$|LeftHand$|LeftHandIndex1$|LeftHandThumb1$|Spine2$|Hips$|RightUpLeg$|RightLeg$|Head$/.test(o.name)) out[o.name.replace('mixamorig', '')] = Object.assign(ax(o), { pos: o.getWorldPosition(new THREE.Vector3()).toArray().map(x => +x.toFixed(3)), localPos: o.position.toArray().map(x => +x.toFixed(3)) }); });
m.traverse(o => { if (o.isSkinnedMesh) { const img = o.material.map.image; out[o.name + '_tex'] = [img.width, img.height, o.material.map.flipY, o.material.normalMap && o.material.normalMap.image.width]; out[o.name + '_verts'] = o.geometry.attributes.position.count; out[o.name + '_bindMode'] = o.bindMode; out[o.name + '_parent'] = o.parent.name + ' rot ' + o.parent.rotation.toArray().slice(0, 3).map(v => +(+v).toFixed(2)) + ' scale ' + o.parent.scale.x; } });
out.clips = gltf.animations.map(a => a.name + ':' + a.duration.toFixed(2) + 's tracks ' + a.tracks.length + ' ' + a.tracks.slice(0, 3).map(t => t.name).join(','));
// how far does the root move in Run/Walk (in place or root motion?)
for (const c of gltf.animations) { const t = c.tracks.find(t => /Hips\.position/.test(t.name)); if (t) { const v = t.values; out['hipsMotion_' + c.name] = [v[0], v[2], v[v.length - 3], v[v.length - 1]].map(x => +x.toFixed(2)); } }
return out;
