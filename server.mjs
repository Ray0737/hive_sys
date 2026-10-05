// Dev/prod server with no dependencies: static files (never cached stale) + /api/aqi live PM2.5 proxy.
// npm start -> http://localhost:5173
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchStations, toAqiGeoJSON } from './scripts/aqi.mjs';
import { UNION } from './js/config.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = +process.env.PORT || 5173;
const BBOX = UNION.map((v, i) => v + (i < 2 ? -0.3 : 0.3)); // every baked region plus a margin, as in scripts/bake-data.mjs
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain' };

let aqi = null; // { at, body }
async function liveAqi() {
  if (aqi && Date.now() - aqi.at < 10 * 60 * 1000) return aqi.body; // Air4Thai updates hourly; 10 min cache is plenty
  const body = JSON.stringify({ ...toAqiGeoJSON(await fetchStations(), BBOX), generated: new Date().toISOString() });
  aqi = { at: Date.now(), body };
  return body;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/aqi') {
      res.writeHead(200, { 'content-type': 'application/geo+json', 'cache-control': 'no-store' }).end(await liveAqi());
      return;
    }
    let file = normalize(join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; } // no path traversal
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(await readFile(file));
  } catch (e) {
    res.writeHead(url.pathname === '/api/aqi' ? 502 : 404).end(url.pathname === '/api/aqi' ? 'air quality source unavailable' : 'not found');
  }
}).listen(PORT, () => console.log(`Hive Map on http://localhost:${PORT}`));
