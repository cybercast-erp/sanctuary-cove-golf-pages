// Static build: fetch the schedule page, trim it, write dist/index.html.
// Run by GitHub Actions on a schedule; the result is deployed to GitHub Pages.
//
//   node build.js                 -> dist/index.html
//   SOURCE_URL=... ZOOM=1.6 REFRESH=600 OUT_DIR=dist node build.js

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_URL, fetchUpstream, transform, render } = require('./lib');

const SOURCE_URL = process.env.SOURCE_URL || DEFAULT_URL;
const OUT_DIR = process.env.OUT_DIR || 'dist';
const ZOOM = Number(process.env.ZOOM) || 1;
const REFRESH = Number(process.env.REFRESH) || 600; // kiosk reloads every 10 min to pick up new builds
const CONTENT_ID = process.env.CONTENT_ID || 'pageContent';

(async () => {
  const fetchedAt = new Date();
  const raw = await fetchUpstream(SOURCE_URL);
  const page = transform(raw, SOURCE_URL, CONTENT_ID);
  const html = render({ ...page, zoom: ZOOM, refresh: REFRESH, source: SOURCE_URL, fetchedAt });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');
  fs.writeFileSync(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify({ source: SOURCE_URL, fetchedAt: fetchedAt.toISOString(), title: page.title }, null, 2),
  );
  console.log(`built ${OUT_DIR}/index.html (${html.length} bytes) from ${SOURCE_URL}`);
})().catch((err) => {
  console.error('build failed:', err.message);
  process.exit(1); // failed build => previous Pages deployment stays live
});
