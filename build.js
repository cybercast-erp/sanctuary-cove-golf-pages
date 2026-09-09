// Static build: fetch each configured page from the golf site, trim it, and write it to
// dist/<same path>/index.html so the published URL mirrors the source path:
//   https://www.sanctuarycovegolf.com.au/cms/honour-board-events/
//   https://<owner>.github.io/<repo>/cms/honour-board-events/
// Also writes dist/index.html listing every page. Run by GitHub Actions; deployed to Pages.
//
//   node build.js                      -> dist/
//   ZOOM=1.6 REFRESH=600 OUT_DIR=dist node build.js

const fs = require('node:fs');
const path = require('node:path');
const { fetchUpstream, transform, render, renderIndex } = require('./lib');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'pages.json'), 'utf8'));
const SOURCE = (process.env.SOURCE || config.source).replace(/\/+$/, '');
const OUT_DIR = process.env.OUT_DIR || 'dist';
const ZOOM = Number(process.env.ZOOM) || config.zoom || 1;
const REFRESH = Number(process.env.REFRESH) || config.refresh || 600; // kiosk reloads to pick up new builds
const CONTENT_ID = process.env.CONTENT_ID || config.contentId || 'pageContent';

/** "/cms/honour-board-events/" -> "cms/honour-board-events" */
function normalisePath(p) {
  const clean = p.trim().replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '');
  if (!clean || clean.split('/').some((seg) => seg === '..' || seg === '')) throw new Error(`bad page path: ${p}`);
  return clean;
}

(async () => {
  const fetchedAt = new Date();
  const results = [];
  const failures = [];

  for (const entry of config.pages) {
    const rel = normalisePath(typeof entry === 'string' ? entry : entry.path);
    const url = `${SOURCE}/${rel}/`;
    try {
      const page = transform(await fetchUpstream(url), url, CONTENT_ID);
      const html = render({ ...page, zoom: ZOOM, refresh: REFRESH, source: url, fetchedAt });
      const dir = path.join(OUT_DIR, rel);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      results.push({ path: `/${rel}/`, source: url, title: page.title, bytes: html.length });
      console.log(`ok   /${rel}/  <-  ${url}  (${html.length} bytes)`);
    } catch (err) {
      failures.push({ path: `/${rel}/`, source: url, error: err.message });
      console.error(`FAIL /${rel}/  <-  ${url}: ${err.message}`);
    }
  }

  if (failures.length) {
    // Any failure aborts the build so the previous (complete) deployment stays live.
    console.error(`build failed: ${failures.length} of ${config.pages.length} pages failed`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex({ pages: results, source: SOURCE, fetchedAt }));
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');
  fs.writeFileSync(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify({ source: SOURCE, fetchedAt: fetchedAt.toISOString(), pages: results }, null, 2),
  );
  console.log(`built ${results.length} pages into ${OUT_DIR}/`);
})().catch((err) => {
  console.error('build failed:', err.message);
  process.exit(1);
});
