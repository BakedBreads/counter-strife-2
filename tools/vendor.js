// Bundles three.js (ESM, split into core + module) into one classic script that
// defines window.THREE, then minifies it. Run once: node tools/vendor.js
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'node_modules', 'three', 'build');
const core = fs.readFileSync(path.join(dir, 'three.core.js'), 'utf8').split('\n');
const mod = fs.readFileSync(path.join(dir, 'three.module.js'), 'utf8').split('\n');

function names(line) {
  const m = line.match(/\{([^}]*)\}/);
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}

let coreExports = null;
const coreBody = core.filter(l => {
  if (l.startsWith('export {')) { coreExports = names(l); return false; }
  if (l.startsWith('import ')) throw new Error('unexpected import in core');
  return true;
});

let modImports = null, modExports = [];
const modBody = mod.filter(l => {
  if (l.startsWith('import {')) { modImports = names(l); return false; }
  // re-exports of core names: already covered by __core
  if (l.startsWith('export {') && l.includes("from './three.core.js'")) return false;
  if (l.startsWith('export {')) { modExports.push(...names(l)); return false; }
  if (l.startsWith('import ') || l.startsWith('export ')) throw new Error('unexpected: ' + l.slice(0, 60));
  return true;
});
if (!coreExports || !modImports) throw new Error('parse failed');
for (const n of [...coreExports, ...modImports, ...modExports]) if (n.includes(' as ')) throw new Error('alias ' + n);

const out = [
  '(function(){"use strict";',
  'var __core=(function(){', coreBody.join('\n'), 'return {' + coreExports.join(',') + '};})();',
  'var __mod=(function(' + modImports.join(',') + '){', modBody.join('\n'),
  'return {' + [...new Set(modExports)].join(',') + '};})(' + modImports.map(n => '__core.' + n).join(',') + ');',
  'var T={};for(var k in __core)T[k]=__core[k];for(var k2 in __mod)T[k2]=__mod[k2];',
  'window.THREE=Object.freeze(T);',
  '})();'
].join('\n');

fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
(async () => {
  const res = await minify(out, { compress: { passes: 1 }, mangle: true, format: { comments: /@license/ } });
  fs.writeFileSync(path.join(root, 'vendor', 'three.min.js'), res.code);
  const peer = fs.readFileSync(path.join(root, 'node_modules', 'peerjs', 'dist', 'peerjs.min.js'), 'utf8')
    .replace(/\/\/# sourceMappingURL=.*$/m, '');
  fs.writeFileSync(path.join(root, 'vendor', 'peer.min.js'), peer);
  console.log('three.min.js', (res.code.length / 1024).toFixed(0) + 'KB', 'peer', (peer.length / 1024).toFixed(0) + 'KB');
})();
