// Локальный dev-сервер (замена vercel dev)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
};

// Загружаем .env
import { config } from 'dotenv';
config({ path: join(__dirname, '.env') });
config({ path: join(__dirname, '.env.local'), override: true });

// Маппинг API-роутов на файлы
const apiRoutes = [
  { match: /^\/api\/managers\/([^/]+)$/, file: './api/managers/[id].js',  paramName: 'id' },
  { match: /^\/api\/events\/([^/]+)$/,   file: './api/events/[id].js',   paramName: 'id' },
  { match: /^\/api\/managers$/,           file: './api/managers.js' },
  { match: /^\/api\/events$/,             file: './api/events.js' },
  { match: /^\/api\/auth$/,               file: './api/auth.js' },
  { match: /^\/api\/aggregates$/,         file: './api/aggregates.js' },
  { match: /^\/api\/backup$/,             file: './api/backup.js' },
  { match: /^\/api\/restore$/,            file: './api/restore.js' },
  { match: /^\/api\/reset$/,              file: './api/reset.js' },
  { match: /^\/api\/set-password$/,       file: './api/set-password.js' },
  { match: /^\/api\/(.+)$/,              file: './api/[[...slug]].js' },  // catch-all
];

// Парсим query string
function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx));
  return Object.fromEntries(params);
}

// Парсим body
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      try { resolve(JSON.parse(raw)); } catch { resolve(raw || {}); }
    });
  });
}

// Создаём объекты req/res, совместимые с Vercel handler(req, res)
function makeRes(nodeRes) {
  const res = {
    _status: 200,
    _headers: {},
    status(code) { res._status = code; return res; },
    setHeader(k, v) { nodeRes.setHeader(k, v); },
    json(data) {
      nodeRes.writeHead(res._status, { 'Content-Type': 'application/json; charset=utf-8' });
      nodeRes.end(JSON.stringify(data));
    },
    end(data) {
      nodeRes.writeHead(res._status);
      nodeRes.end(data);
    },
  };
  return res;
}

const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // --- API ---
  if (url.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    for (const route of apiRoutes) {
      const m = url.match(route.match);
      if (!m) continue;

      try {
        const mod = await import(route.file);
        const handler = mod.default;
        const query = parseQuery(req.url);
        if (route.paramName && m[1]) query[route.paramName] = m[1];

        const fakeReq = {
          method: req.method,
          url: req.url,
          query,
          body: await readBody(req),
          headers: req.headers,
        };

        return await handler(fakeReq, makeRes(res));
      } catch (e) {
        console.error(`API error [${url}]:`, e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  // --- Статика ---
  let filePath = url === '/' ? '/index.html' : url;
  filePath = join(__dirname, filePath);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // SPA fallback
    try {
      const html = await readFile(join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n  🚀 Dev server: http://localhost:${PORT}\n`);
});
