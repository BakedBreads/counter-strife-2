// Model lab: serves three.js + addons + the soldier model and runs a script file inside the page, then screenshots.
// usage: node tools/modellab.js <script.js> [out-prefix]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
const prefix = process.argv[3] || 'lab';
const page = `<!doctype html><html><head><style>html,body{margin:0;background:#2a2f36;overflow:hidden}</style></head><body>
<script src="/three.js"></script><script src="/addons.js"></script><script>window.__ready=true</script></body></html>`;
const files = { '/three.js': 'vendor/three.min.js', '/addons.js': 'vendor/addons.min.js', '/soldier.glb': 'vendor/models/Soldier.glb' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/src/')) { res.writeHead(200, { 'content-type': 'text/javascript' }); fs.createReadStream(path.join(root, req.url)).pipe(res); return; }
  if (files[req.url]) { res.writeHead(200); fs.createReadStream(path.join(root, files[req.url])).pipe(res); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(page);
}).listen(0, async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const vw = +(process.env.VW || 900), vh = +(process.env.VH || 900);
  const p = await browser.newPage({ viewport: { width: vw, height: vh } });
  p.on('console', m => console.log('[page]', m.text()));
  p.on('pageerror', e => console.log('[pageerror]', e.message, (e.stack || '').split('\n')[1]));
  await p.goto('http://127.0.0.1:' + server.address().port + '/');
  await p.waitForFunction(() => window.__ready);
  let n = 0;
  await p.exposeFunction('snap', async (name) => { await p.screenshot({ path: path.join(root, 'test-out', prefix + '-' + (name || n++) + '.png') }); });
  const r = await p.evaluate(`(async () => { ${script} })()`);
  if (r !== undefined) console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1));
  await browser.close(); server.close();
});
