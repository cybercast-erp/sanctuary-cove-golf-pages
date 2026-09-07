// Optional live proxy for local preview / self-hosting (not used by GitHub Pages).
// Fetches the page on request, trims it, serves it. Zero dependencies. Node >= 18.
//
//   node server.js            -> http://localhost:8080/?zoom=1.5&refresh=300

const http = require('node:http');
const { URL } = require('node:url');
const { DEFAULT_URL, fetchUpstream, transform, render, esc } = require('./lib');

const PORT = Number(process.env.PORT || 8080);
const SOURCE_URL = process.env.DEFAULT_URL || DEFAULT_URL;
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'www.sanctuarycovegolf.com.au,sanctuarycovegolf.com.au')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);
const CONTENT_ID = process.env.CONTENT_ID || 'pageContent';

const cache = new Map();

async function getPage(url) {
  const hit = cache.get(url);
  const now = Date.now();
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) return { ...hit, stale: false };
  try {
    const entry = { ...transform(await fetchUpstream(url), url, CONTENT_ID), fetchedAt: now };
    cache.set(url, entry);
    return { ...entry, stale: false };
  } catch (err) {
    if (hit) return { ...hit, stale: true };
    throw err;
  }
}

function resolveTarget(reqUrl) {
  const target = new URL(reqUrl.searchParams.get('url') || SOURCE_URL);
  if (!/^https?:$/.test(target.protocol)) throw new Error('bad protocol');
  if (!ALLOWED_HOSTS.includes(target.hostname.toLowerCase())) throw new Error(`host not allowed: ${target.hostname}`);
  target.hash = '';
  return target.href;
}

http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (reqUrl.pathname === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (reqUrl.pathname !== '/') { res.writeHead(404); return res.end('not found'); }

  let target;
  try { target = resolveTarget(reqUrl); }
  catch (err) { res.writeHead(400); return res.end(`Bad request: ${err.message}`); }

  try {
    const page = await getPage(target);
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
      'x-proxy-fetched-at': new Date(page.fetchedAt).toISOString(),
      'x-proxy-stale': page.stale ? '1' : '0',
    });
    res.end(render({ ...page, source: target }));
  } catch (err) {
    console.error(new Date().toISOString(), 'ERROR', target, err.message);
    res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(render({ title: 'Schedule unavailable', refresh: 60, source: target,
      content: `<h1>Schedule temporarily unavailable</h1><p>${esc(err.message)}</p>` }));
  }
}).listen(PORT, () => console.log(`schedule proxy listening on :${PORT} -> ${SOURCE_URL}`));
