// Assembles src/ + vendor/ into one self-contained HTML file: counter-strife-2.html (and dist/index.html for hosting).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), src = path.join(root, 'src'), ven = path.join(root, 'vendor');
const read = f => fs.readFileSync(f, 'utf8');

const fonts = [['Barlow', 400, 'barlow-400'], ['Barlow', 600, 'barlow-600'], ['Rajdhani', 500, 'rajdhani-500'], ['Rajdhani', 600, 'rajdhani-600'], ['Rajdhani', 700, 'rajdhani-700']]
  .map(([fam, w, f]) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(ven, 'fonts', f + '.woff2')).toString('base64')}) format('woff2')}`).join('\n');

const head = read(path.join(src, '00_head.html')).replace('/*FONTS*/', fonts);
const body = read(path.join(src, '01_body.html'));
const jsFiles = fs.readdirSync(src).filter(f => f.endsWith('.js')).sort();
const game = '(function(){\n' + jsFiles.map(f => `/* ===== ${f} ===== */\n` + read(path.join(src, f))).join('\n') + '\n})();';

// fail the build on syntax errors, and report the file + line
try { new vm.Script(game, { filename: 'game.js' }); }
catch (e) {
  const m = String(e.stack).match(/game\.js:(\d+)/); let where = '';
  if (m) { let line = +m[1], acc = 1; for (const f of jsFiles) { const n = read(path.join(src, f)).split('\n').length + 1; if (line < acc + n) { where = `${f}:${line - acc}`; break; } acc += n; } }
  console.error('SYNTAX ERROR', where, e.message); process.exit(1);
}
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const three = safe(read(path.join(ven, 'three.min.js'))), peer = safe(read(path.join(ven, 'peer.min.js')));
const addons = safe(read(path.join(ven, 'addons.min.js')));
// the rigged agent model (three.js example asset "Soldier", Mixamo rig) travels inside the page as base64
const agent = fs.readFileSync(path.join(ven, 'models', 'Soldier.glb')).toString('base64');
const html = head + body + `<script>${three}</script>\n<script>${addons}</script>\n<script>${peer}</script>\n<script>window.__AGENT_GLB="${agent}";</script>\n<script>${safe(game)}</script>\n</body>\n</html>\n`;
fs.writeFileSync(path.join(root, 'counter-strife-2.html'), html);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(root, 'index.html'), html); // served by GitHub Pages
console.log('built counter-strife-2.html', (html.length / 1024 / 1024).toFixed(2) + ' MB', game.split('\n').length + ' lines of game code');
