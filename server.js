// 운영 서버: node server.js  (Render 등 Node 호스팅용)
// 정적 파일은 public/, API는 api/*.js 를 그대로 불러옵니다. 운영에서는 Upstash Redis 환경변수가 필요합니다.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SECURITY_HEADERS, MAX_BODY_BYTES } from './lib/security.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY_BYTES) { const e = new Error('too large'); e.code = 'TOO_LARGE'; throw e; } // 너무 큰 요청은 읽다가 멈춥니다
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

function decorate(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
      const mod = await import(pathToFileURL(path.join(root, 'api', `${name}.js`)).href);
      req.query = Object.fromEntries(url.searchParams);
      req.body = await readBody(req);
      res.setHeader('Cache-Control', 'no-store');
      return mod.default(req, decorate(res));
    }
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!path.extname(file)) file += '.html';
    const full = path.join(root, 'public', path.normalize(file));
    if (!full.startsWith(path.join(root, 'public') + path.sep)) { res.statusCode = 403; return res.end('Forbidden'); }
    const data = await fs.readFile(full);
    res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream');
    res.setHeader('Cache-Control', url.pathname.startsWith('/fonts/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.end(data);
  } catch (err) {
    if (err.code === 'TOO_LARGE') { res.statusCode = 413; return res.end('Payload too large'); }
    if (err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND') { res.statusCode = 404; return res.end('Not found'); }
    console.error(err);
    res.statusCode = 500;
    res.end('Server error');
  }
}).listen(port, '0.0.0.0', () => console.log(`listening on ${port}`));
