// Tiny static server for local testing: serves dist/index.html on http://localhost:5191
const http = require('http'), fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'dist', 'index.html');
http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(5191, () => console.log('serving on http://localhost:5191'));
