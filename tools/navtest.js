// Headless check of the map: collision boxes, nav mesh, and paths between key areas.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
globalThis.window = globalThis; globalThis.self = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(root, 'vendor/three.min.js'), 'utf8'));
const files = ['10_util.js', '13_textures.js', '20_weapons.js', '21_map.js', '22_world.js'];
let code = files.map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
code += '\n;globalThis.__T={World,MAPDEF,W,Tex};';
vm.runInThisContext(code, { filename: 'game.js' });
const { World, MAPDEF } = globalThis.__T;
World.buildMeshes = () => { }; World.buildDecor = () => { }; World.buildRadar = () => { };
const scene = new THREE.Scene();
let t0 = Date.now();
World.build(scene);
console.log('boxes', World.boxes.length, 'build ms', Date.now() - t0);
t0 = Date.now();
const n = World.buildNav();
console.log('nav nodes', n, 'ms', Date.now() - t0);
const P = {
  Tspawn: [0, 1.2, 50], CTspawn: [-2, 1.6, -46], Asite: [38, 1.6, -42], Bsite: [-40, 0, -42], Long: [40, 0, 0], Mid: [0, 0, 10],
  Cat: [13, 1.6, -26], CTmid: [-10, 0, -28], UpperTun: [-42, 0, 20], LowerTun: [-20, 0, 12], OutLong: [36, 0, 40], Window: [-23, 2, -42],
  Bplat: [-51, 1.1, -51]
};
const node = {};
for (const k in P) { node[k] = World.nearestNode(P[k][0], P[k][1], P[k][2]); const N = World.nav; console.log(k.padEnd(10), 'node', node[k], node[k] >= 0 ? [N.nx[node[k]], N.ny[node[k]], N.nz[node[k]]].map(v => v.toFixed(1)).join(',') : 'NONE'); }
const pairs = [['Tspawn', 'Asite'], ['Tspawn', 'Bsite'], ['Tspawn', 'CTspawn'], ['CTspawn', 'Bsite'], ['CTspawn', 'Asite'], ['Tspawn', 'Cat'], ['Mid', 'LowerTun'], ['CTspawn', 'Window'], ['Window', 'Bsite'], ['Bsite', 'Window'], ['Asite', 'Tspawn'], ['Bsite', 'Tspawn'], ['OutLong', 'Long'], ['CTmid', 'Bsite']];
for (const [a, b] of pairs) {
  t0 = performance.now();
  const p = World.findPath(node[a], node[b]);
  const ms = (performance.now() - t0).toFixed(1);
  let len = 0; if (p) for (let i = 1; i < p.length; i++) len += World.h(p[i - 1], p[i]);
  console.log((a + ' -> ' + b).padEnd(22), p ? 'OK len ' + len.toFixed(1) + 'm nodes ' + p.length : 'NO PATH', ms + 'ms');
}
// raycast sanity: from T spawn toward north wall
const res = {};
const t = World.raycast(0, 2.8, 50, 0, 0, -1, 200, res);
console.log('ray from T spawn north hits at', t.toFixed(2), 'box', res.box && res.box.kind, res.box && res.box.mat, 'normal', res.nz);
// floor probe
console.log('floorAt Asite', World.floorAt(38, -42), 'Tspawn', World.floorAt(0, 50), 'stairs', World.floorAt(40, 52));
// spawn validity
for (const team of ['T', 'CT']) for (const [x, z] of MAPDEF.spawns[team]) {
  const y = World.floorAt(x, z);
  if (World.overlaps(x - .41, y + .05, z - .41, x + .41, y + 1.8, z + .41)) console.log('BLOCKED spawn', team, x, z);
}
// nav connected components
const N = World.nav, comp = new Int32Array(N.n).fill(-1); let nc = 0; const sizes = [];
for (let s = 0; s < N.n; s++) { if (comp[s] >= 0) continue; const st = [s]; comp[s] = nc; let sz = 0; while (st.length) { const c = st.pop(); sz++; const A = N.adj[c]; for (let k = 0; k < A.length; k += 2) { const m = A[k]; if (comp[m] < 0) { comp[m] = nc; st.push(m); } } } sizes.push(sz); nc++; }
sizes.sort((a, b) => b - a);
console.log('components (directed reach approx)', nc, 'largest', sizes.slice(0, 6));
