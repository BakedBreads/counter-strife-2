// Contact sheet: node tools/sheet.js out.png cols cellW cellH img1 img2 ...
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const [out, cols, cw, ch, ...imgs] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ headless: true });
  const rows = Math.ceil(imgs.length / cols);
  const p = await b.newPage({ viewport: { width: cols * cw, height: rows * ch } });
  const html = '<body style="margin:0;display:grid;grid-template-columns:repeat(' + cols + ',' + cw + 'px);background:#111">' +
    imgs.map(f => `<div style="position:relative;width:${cw}px;height:${ch}px;overflow:hidden"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;left:4px;top:2px;color:#ff0;font:12px sans-serif">${path.basename(f)}</span></div>`).join('') + '</body>';
  await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: out }); await b.close();
})();
