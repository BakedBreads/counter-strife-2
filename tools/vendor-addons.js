// Bundles three.js addons (GLTFLoader + SkeletonUtils) into a classic script that defines window.THREE_ADDONS.
const fs = require('fs'), path = require('path');
const { minify } = require('terser');
const root = path.join(__dirname, '..'), jsm = path.join(root, 'node_modules', 'three', 'examples', 'jsm');

function convert(file, deps) {
  let src = fs.readFileSync(path.join(jsm, file), 'utf8');
  const head = [];
  // import { a, b as c } from 'x';  (possibly multi-line)
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';/gm, (m, names, from) => {
    const list = names.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+as\s+/, ': '));
    const obj = from === 'three' ? 'THREE' : deps[path.basename(from)];
    if (!obj) throw new Error(file + ': unknown import ' + from);
    head.push(`const { ${list.join(', ')} } = ${obj};`);
    return '';
  });
  let exportsList = [];
  src = src.replace(/^export\s*\{([^}]*)\};?/gm, (m, names) => { exportsList = names.split(',').map(s => s.trim()).filter(Boolean); return ''; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(file + ': leftover module syntax');
  const ret = exportsList.map(n => n.includes(' as ') ? n.split(/\s+as\s+/).reverse().join(': ') : n).join(', ');
  return `(function(){\n${head.join('\n')}\n${src}\nreturn { ${ret} };\n})()`;
}
const bgu = convert('utils/BufferGeometryUtils.js', {});
const su = convert('utils/SkeletonUtils.js', {});
const gl = convert('loaders/GLTFLoader.js', { 'BufferGeometryUtils.js': '__BGU', 'SkeletonUtils.js': '__SU' });
const out = `(function(){"use strict";\nvar __BGU = ${bgu};\nvar __SU = ${su};\nvar __GLTF = ${gl};\nwindow.THREE_ADDONS = { GLTFLoader: __GLTF.GLTFLoader, SkeletonUtils: __SU, BufferGeometryUtils: __BGU };\n})();`;
(async () => {
  const r = await minify(out, { compress: true, mangle: true });
  fs.writeFileSync(path.join(root, 'vendor', 'addons.min.js'), r.code);
  console.log('addons.min.js', (r.code.length / 1024).toFixed(0) + 'KB');
})();
