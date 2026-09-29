/* ===================== map: de_dustline ===================== */
// Block-out on a 60x60 grid of 2m cells (x: west->east, z: north->south). Everything not carved is solid wall.
// World x = (c-30)*2 .. (c-29)*2, z = (r-30)*2 .. (r-29)*2.
const MAPDEF = {
  name: 'Dustline', id: 'de_dustline', N: 60, C: 2, wallH: 7,
  floors: [ // c0 r0 c1 r1 y mat
    [20, 49, 38, 57, 1.2, 'sand'],     // T spawn
    [7, 50, 16, 55, 0, 'sand'],        // outside tunnels
    [7, 21, 10, 49, 0, 'concrete'],    // upper tunnels
    [42, 44, 54, 55, 0, 'sand'],       // outside long
    [49, 41, 51, 43, 0, 'concrete'],   // long doors
    [46, 19, 55, 40, 0, 'sand'],       // long A
    [40, 3, 55, 15, 1.6, 'tiles'],     // A site
    [36, 2, 39, 12, 1.6, 'stone'],     // CT ramp to A
    [20, 2, 35, 9, 1.6, 'stone'],      // CT spawn
    [20, 13, 31, 19, 0, 'concrete'],   // CT mid
    [28, 20, 30, 21, 0, 'concrete'],   // mid doors
    [27, 22, 31, 43, 0, 'sand'],       // mid
    [26, 44, 32, 46, 0, 'sand'],       // outside mid
    [35, 13, 37, 25, 1.6, 'stone'],    // catwalk / short A
    [11, 34, 26, 37, 0, 'concrete'],   // lower tunnels
    [17, 14, 19, 17, 0, 'concrete'],   // B doors
    [3, 3, 16, 20, 0, 'tiles'],        // B site
    [17, 8, 19, 9, 2.0, 'stone']       // B window (walk out from CT spawn, drop into B)
  ],
  stairs: [ // c0 r0 c1 r1 yLow yHigh axis dir(+1: rises toward +axis) mat
    [39, 51, 41, 54, 0, 1.2, 'x', -1, 'stone'],   // T spawn -> outside long
    [27, 47, 31, 48, 0, 1.2, 'z', 1, 'stone'],    // T spawn -> outside mid
    [17, 51, 19, 54, 0, 1.2, 'x', 1, 'stone'],    // T spawn -> outside tunnels
    [47, 16, 55, 18, 0, 1.6, 'z', -1, 'stone'],   // long -> A site ramp
    [26, 10, 30, 12, 0, 1.6, 'z', -1, 'stone'],   // CT spawn -> CT mid
    [17, 3, 19, 6, 0, 1.6, 'x', 1, 'stone'],      // CT spawn -> B
    [32, 22, 34, 25, 0, 1.6, 'x', 1, 'stone']     // mid -> catwalk
  ],
  // solid boxes in world coordinates [x0,y0,z0,x1,y1,z1, mat, pen(bullet-penetrable)]
  solids: [
    [-46.5, 3.7, -10, -37.5, 4.5, 34, 'concrete', 0],   // upper tunnel roof
    [-38.5, 3.7, 7.5, -5.5, 4.5, 16.5, 'concrete', 0],   // lower tunnel roof
    [-4, 3.5, -20, 2, 7.2, -16, 'plaster', 0],           // mid doors lintel
    [38, 3.5, 22, 44, 7.2, 28, 'plaster', 0],            // long doors lintel
    [-26, 3.5, -32, -20, 7.2, -24, 'plaster', 0],        // B doors lintel
    [-26, 4.0, -44, -20, 7.2, -40, 'plaster', 0],        // window lintel
    [38, 0, 24.94, 39.7, 3.3, 25.06, 'wood', 1],         // long door panel W
    [42.3, 0, 24.94, 44, 3.3, 25.06, 'wood', 1],         // long door panel E
    [-4, 0, -18.06, -2.7, 3.3, -17.94, 'wood', 1],       // mid door panel W
    [0.7, 0, -18.06, 2, 3.3, -17.94, 'wood', 1],         // mid door panel E
    [-54, 0, -54, -48, 1.1, -48, 'blocks', 0],           // B back plat
    [49.6, 0, -2, 52, 2.6, 10, 'containerB', 1],         // blue container, long A
    [36, 0, 49.5, 48, 2.6, 52, 'containerR', 1]          // red container, outside long
  ],
  // props placed on the floor under their center. t: crate | crate2 | box(mat) | barrel | car ; y: optional stack base
  props: [
    { t: 'crate', x: 37, z: -45, s: 1.6 }, { t: 'crate', x: 38.9, z: -45.2, s: 1.1 }, { t: 'crate2', x: 37.1, z: -45, s: 1.2, on: 1.6 },
    { t: 'crate', x: 50.4, z: -52.4, s: 1.6 }, { t: 'crate2', x: 50.7, z: -50.5, s: 1.2 },
    { t: 'box', x: 30, z: -38, w: 2.4, h: 1.1, d: 1.1, mat: 'blocks' },
    { t: 'crate', x: 22.2, z: -50.2, s: 1.6 }, { t: 'crate2', x: 44.5, z: -31.5, s: 1.1 },
    { t: 'car', x: 38, z: -12, w: 3.8, h: 1.3, d: 1.9, mat: 'metal' },
    { t: 'crate', x: 34.2, z: -19.6, s: 1.2 }, { t: 'barrel', x: 47, z: 19 }, { t: 'barrel', x: 47.8, z: 20.2 },
    { t: 'crate', x: 30, z: 33.2, s: 1.2 }, { t: 'crate2', x: 31.3, z: 33.3, s: 1.2 }, { t: 'crate', x: 30.6, z: 33.2, s: 1.1, on: 1.2 },
    { t: 'crate', x: -1, z: 2, s: 1.7 }, { t: 'crate2', x: 0.9, z: 3.4, s: .9 },
    { t: 'crate', x: -4.6, z: 18, s: 1.1 }, { t: 'crate2', x: 4.4, z: 31, s: 1.1 },
    { t: 'crate', x: -12, z: -26, s: 1.2 }, { t: 'crate2', x: -13.3, z: -25.9, s: 1.2 },
    { t: 'crate', x: 14.2, z: -12, s: 1.1 },
    { t: 'crate', x: -40, z: -38, s: 1.6 }, { t: 'crate', x: -38.3, z: -38, s: 1.6 }, { t: 'crate2', x: -39.2, z: -38, s: 1.5, on: 1.6 }, { t: 'crate2', x: -42, z: -37.4, s: 1.1 },
    { t: 'crate', x: -30.2, z: -30.4, s: 1.2 }, { t: 'crate2', x: -44.2, z: -21.5, s: 1.2 }, { t: 'crate', x: -34.6, z: -23.8, s: 1.1 },
    { t: 'car', x: -30.5, z: -46, w: 1.9, h: 1.3, d: 3.8, mat: 'metal' },
    { t: 'crate', x: -44.8, z: -6, s: 1.1 }, { t: 'barrel', x: -39, z: 6 }, { t: 'barrel', x: -12, z: 12.4 },
    { t: 'car', x: 0, z: 45.5, w: 3.8, h: 1.3, d: 1.9, mat: 'metal' }, { t: 'crate', x: -14, z: 42, s: 1.2 }, { t: 'crate2', x: 12, z: 51, s: 1.2 },
    { t: 'crate', x: -8, z: -52.5, s: 1.2 }, { t: 'crate2', x: -6.6, z: -52.6, s: 1.2 }, { t: 'box', x: 6, z: -53, w: 2.4, h: 2.4, d: 5, mat: 'containerB' },
    { t: 'crate', x: -36, z: 47, s: 1.2 }, { t: 'barrel', x: -28, z: 51 }
  ],
  decals: [ // sprite, x, y, z, face normal axis, size
    ['letterA', 40, 3.2, -53.98, 'z+', 3.4], ['letterA', 51.98, 3.4, -40, 'x-', 3.4],
    ['letterB', -40, 3, -53.98, 'z+', 3.4], ['letterB', -53.98, 3, -30, 'x+', 3.4],
    ['arrowA', 12, 3.4, 55.98, 'z-', 3.2, true], ['arrowB', -12, 3.4, 55.98, 'z-', 3.2],
    ['arrowA', 32.02, 2.6, -2, 'x+', 3, true], ['arrowB', -5.98, 2.6, 4, 'x+', 3, true]
  ],
  trees: [[-17, 54], [15, 40.5], [-17, -42], [9, -42.5], [48, 46], [-44, 50]],
  spawns: {
    T: [[-6, 50], [-2, 51], [2, 50], [6, 51], [0, 47.8], [-4, 47.8], [4, 47.8], [-8, 52.5], [8, 52.5], [0, 53.5]],
    CT: [[-10, -48], [-6, -47], [-2, -48], [2, -47], [6, -48], [-8, -44], [-4, -44], [0, -44], [4, -44], [8, -44]]
  },
  spawnYaw: { T: 0, CT: Math.PI },
  buy: { T: [-20, 38, 18, 56], CT: [-20, -56, 20, -34] },
  sites: { A: [22, -54, 52, -30], B: [-54, -54, -28, -20] },
  callouts: [
    ['A Site', 22, -54, 52, -28], ['B Site', -54, -54, -26, -18], ['CT Spawn', -20, -56, 12, -38], ['CT Ramp', 12, -56, 20, -34],
    ['A Short', 4, -34, 16, -8], ['CT Mid', -20, -34, 4, -20], ['Mid Doors', -4, -20, 2, -16], ['Mid', -6, -16, 4, 28],
    ['Outside Mid', -8, 28, 6, 38], ['T Spawn', -20, 38, 18, 56], ['Upper Tunnels', -46, -18, -38, 40], ['Lower Tunnels', -38, 8, -6, 16],
    ['Outside Tunnels', -46, 40, -20, 52], ['Long Doors', 38, 22, 44, 28], ['Outside Long', 18, 28, 50, 52], ['Long A', 32, -22, 52, 22],
    ['A Ramp', 32, -28, 52, -22], ['B Doors', -26, -32, -20, -24], ['B Window', -26, -44, -20, -40], ['CT to B', -26, -54, -20, -46]
  ],
  // ----- bot knowledge -----
  holds: { // x z lookX lookZ
    A: [[49, -50, 46, -24], [36.5, -48, 48, -24], [24, -40, 13, -30], [18.5, -46, 14, -30], [44, -36, 44, 6]],
    B: [[-47, -50.5, -42, -18], [-31, -28, -42, -16], [-23, -41, -42, -18], [-32, -43, -42, -18], [-51, -30, -42, -16]],
    MID: [[-2, -30, -1, 12], [13, -21, 2, 4]]
  },
  plants: { A: [[38, -42], [45.5, -46], [31, -47]], B: [[-40, -42], [-46, -33], [-36, -31]] },
  post: {
    A: [[47, -40, 18, -45], [45, -29.5, 13, -30], [44, -18, 44, -40], [33, -50, 18, -45]],
    B: [[-44, -20, -24, -28], [-50, -47, -24, -42], [-41, -10, -40, -40], [-34, -46, -24, -28]]
  },
  routes: { // T approach waypoints; last point is the staging spot
    Along: [[38, 42], [41, 25], [40, 8], [42, -14]],
    Ashort: [[0, 34], [0, 8], [7, -12], [13, -26]],
    Btun: [[-34, 47], [-42, 26], [-42, -10]],
    Bmid: [[0, 34], [-1, 12], [-22, 12], [-42, 8], [-42, -10]],
    Bdoors: [[0, 34], [0, -6], [-1, -26], [-18, -28]]
  },
  nades: { // execute utility for T; defensive utility for CT. [type, targetX, targetY, targetZ]
    A: [['smoke', 18, 1.6, -44], ['smoke', 34, 1.6, -34], ['flash', 42, 5, -38], ['molotov', 50, 1.6, -51]],
    B: [['smoke', -23.5, 0, -28], ['smoke', -23.5, 2, -42], ['flash', -40, 4.5, -32], ['molotov', -51, 1.1, -51]],
    CT_A: [['incgrenade', 46, 0, -21], ['he', 44, 0, -14], ['flash', 14, 3.5, -22]],
    CT_B: [['incgrenade', -42, 0, -16], ['he', -42, 0, -8], ['flash', -42, 3, -14]]
  }
};
