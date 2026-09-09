// Shared extraction + rendering logic. Zero dependencies. Node >= 18.

const { URL } = require('node:url');

const DEFAULT_URL = 'https://www.sanctuarycovegolf.com.au/cms/social-sunday-schedule/';
const UA = 'Mozilla/5.0 (compatible; SanctuaryScheduleProxy/1.0)';
// Theme asset base: the page loads the same webfonts the original site uses.
const THEME = 'https://www.sanctuarycovegolf.com.au/cms/wp-content/themes/Sanctuary';
const FONT_FILES = ['fonts/avenir-book-webfont.woff2', 'fonts/avenir-medium-webfont.woff2', 'webFonts/JansonTextLTProRoman/font.woff2'];

/** Extract the outer HTML of the first element with the given id (balanced tag matching). */
function extractById(html, id) {
  const re = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const m = re.exec(html);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  const start = m.index;
  let depth = 1;
  const tokRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tokRe.lastIndex = m.index + m[0].length;
  let t;
  while ((t = tokRe.exec(html))) {
    if (t[0][1] === '/') depth--;
    else if (!/\/>$/.test(t[0])) depth++;
    if (depth === 0) return html.slice(start, t.index + t[0].length);
  }
  return html.slice(start);
}

function removeById(html, id) {
  const chunk = extractById(html, id);
  return chunk ? html.replace(chunk, '') : html;
}

function stripTags(html, tag) {
  return html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
}

/** Drop fixed sizing that would stop the content filling the screen. */
function unconstrain(html) {
  return html
    .replace(/\sstyle=("|')([^"']*)\1/gi, (all, q, css) => {
      const cleaned = css
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d && !/^(max-width|min-width|width|height|max-height|min-height)\s*:/i.test(d))
        .join('; ');
      return cleaned ? ` style=${q}${cleaned}${q}` : '';
    })
    .replace(/\s(width|height)=("|')[^"']*\2/gi, '');
}

function getTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1].replace(/\s+/g, ' ').trim() : 'Schedule';
}

function absolutise(html, base) {
  return html.replace(/\s(href|src)=("|')(?!https?:|data:|mailto:|tel:|#|\/\/)([^"']+)\2/gi, (all, attr, q, val) => {
    try {
      return ` ${attr}=${q}${new URL(val, base).href}${q}`;
    } catch {
      return all;
    }
  });
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

async function fetchUpstream(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function transform(html, url, contentId = 'pageContent') {
  // Members-only pages redirect to a login form; never publish that.
  if (/Members Login/i.test(getTitle(html)) || /\bid=["']login-(left|error)["']/.test(html)) {
    throw new Error('page requires members login (not public)');
  }
  let content = extractById(html, contentId) || extractById(html, 'page-wrap');
  if (!content) throw new Error(`#${contentId} / #page-wrap not found in upstream page`);
  content = removeById(content, 'right-column');
  content = stripTags(content, 'script');
  content = stripTags(content, 'style');
  content = content.replace(/\son[a-z]+=("|')[^"']*\1/gi, '');
  content = unconstrain(content);
  content = absolutise(content, url);
  return { title: getTitle(html), content };
}

/**
 * Render the final page. `zoom` and `refresh` are defaults; the page also honours
 * ?zoom= and ?refresh= query params at runtime via a tiny head script that runs
 * before first paint (so no flicker).
 */
function render({ title, content, zoom = 1, refresh = 0, source, fetchedAt = new Date() }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
${FONT_FILES.map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${THEME}/${f}">`).join('\n')}
<title>${esc(title)}</title>
<style>
  /* Fonts from the Sanctuary theme (same files the original page loads). */
  @font-face { font-family: 'avenirregular'; font-display: block; font-weight: normal; font-style: normal;
    src: url('${THEME}/fonts/avenir-book-webfont.woff2') format('woff2'), url('${THEME}/fonts/avenir-book-webfont.woff') format('woff'); }
  @font-face { font-family: 'avenirmedium'; font-display: block; font-weight: normal; font-style: normal;
    src: url('${THEME}/fonts/avenir-medium-webfont.woff2') format('woff2'), url('${THEME}/fonts/avenir-medium-webfont.woff') format('woff'); }
  @font-face { font-family: 'JansonTextLTPro-Roman'; font-display: block;
    src: url('${THEME}/webFonts/JansonTextLTProRoman/font.woff2') format('woff2'), url('${THEME}/webFonts/JansonTextLTProRoman/font.woff') format('woff'); }

  html { font-size: calc(14px * ${zoom}); }
  html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; background: #fff; }
  body {
    /* Matches original computed styles: avenirregular 14px / 21px, #555 */
    font-family: 'avenirregular', Helvetica, Arial, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
    color: #555;
    -webkit-text-size-adjust: 100%;
  }
  #proxy-root { width: 100%; box-sizing: border-box; padding: 0 20px 20px; }
  #proxy-root > * { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; float: none !important; }
  /* Original h1: JansonTextLTPro-Roman 28px / 42px, #555, padding 20px 0 */
  h1 { font-family: 'JansonTextLTPro-Roman', 'jansonlt', Georgia, 'Times New Roman', serif; font-weight: normal; font-size: 2em; margin: 0; padding: 20px 0; line-height: 1.5; color: #555; border: none; }
  h2, h3, h4, h5, h6 { font-family: 'avenirmedium', Helvetica, Arial, sans-serif; font-weight: normal; margin: 10px 0; line-height: 1.5; }
  table { border-collapse: collapse; width: 100% !important; max-width: none !important; table-layout: auto; }
  td, th { text-align: left; vertical-align: top; }
  img { max-width: 100%; height: auto; }
  a { color: inherit; }
  #right-column, .side-content, .show-mobile, .pum, .pum-overlay { display: none !important; }
</style>
<script>
(function () {
  var q = new URLSearchParams(location.search);
  var z = parseFloat(q.get('zoom'));
  if (z >= 0.5 && z <= 5) document.documentElement.style.fontSize = (14 * z) + 'px';
  var r = q.has('refresh') ? parseInt(q.get('refresh'), 10) : ${Number(refresh) || 0};
  if (r > 0) setTimeout(function () { location.reload(); }, r * 1000);
})();
</script>
</head>
<body>
<div id="proxy-root" data-source="${esc(source)}" data-fetched-at="${esc(new Date(fetchedAt).toISOString())}" data-live="baked">
${content}
</div>
<script>
// Live refresh: fetch the source page directly (it sends Access-Control-Allow-Origin: *),
// trim it the same way the build does, and swap it in only if the content changed.
// The baked content above is already painted, so a failure here changes nothing.
(function () {
  var root = document.getElementById('proxy-root');
  var src = root.getAttribute('data-source');
  var SIZE = /^(max-width|min-width|width|height|max-height|min-height)$/i;
  function trim(doc) {
    var el = doc.getElementById(${JSON.stringify(process.env.CONTENT_ID || 'pageContent')}) || doc.getElementById('page-wrap');
    if (!el) throw new Error('content not found');
    el.querySelectorAll('#right-column, script, style').forEach(function (n) { n.remove(); });
    el.querySelectorAll('*').forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || a.name === 'width' || a.name === 'height') n.removeAttribute(a.name);
      });
      if (n.style && n.style.length) {
        for (var i = n.style.length - 1; i >= 0; i--) if (SIZE.test(n.style[i])) n.style.removeProperty(n.style[i]);
        if (!n.style.length) n.removeAttribute('style');
      }
      ['href', 'src'].forEach(function (k) { if (n.hasAttribute(k)) n.setAttribute(k, new URL(n.getAttribute(k), src).href); });
    });
    return el;
  }
  function norm(s) { return s.replace(/\\s+/g, ' ').replace(/> </g, '><').trim(); }
  var ctrl = new AbortController();
  setTimeout(function () { ctrl.abort(); }, 15000);
  fetch(src, { cache: 'no-store', signal: ctrl.signal })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (html) {
      var el = trim(new DOMParser().parseFromString(html, 'text/html'));
      var live = el.outerHTML;
      if (norm(live) !== norm(root.innerHTML)) root.innerHTML = live;
      root.setAttribute('data-live', 'live');
      root.setAttribute('data-fetched-at', new Date().toISOString());
    })
    .catch(function (e) {
      root.setAttribute('data-live', 'failed: ' + e.message);
      console.warn('live refresh failed, showing built copy:', e.message);
    });
})();
</script>
</body>
</html>`;
}

/** Root index listing every published page (same typography as the pages). */
function renderIndex({ pages, source, fetchedAt = new Date() }) {
  const items = pages
    .map((p) => `<li><a href=".${esc(p.path)}">${esc(p.title.replace(/\s*-\s*Sanctuary Cove.*$/i, ''))}</a><br><small>${esc(p.path)}</small></li>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>Sanctuary Cove display pages</title>
<style>
  @font-face { font-family: 'avenirregular'; font-display: swap; src: url('${THEME}/fonts/avenir-book-webfont.woff2') format('woff2'); }
  @font-face { font-family: 'JansonTextLTPro-Roman'; font-display: swap; src: url('${THEME}/webFonts/JansonTextLTProRoman/font.woff2') format('woff2'); }
  body { margin: 0; padding: 0 20px 20px; font: 14px/1.5 'avenirregular', Helvetica, Arial, sans-serif; color: #555; background: #fff; }
  h1 { font: normal 28px/1.5 'JansonTextLTPro-Roman', Georgia, serif; margin: 0; padding: 20px 0; }
  ul { list-style: none; margin: 0; padding: 0; max-width: 600px; }
  li { padding: 10px 12px; } li:nth-child(even) { background: #ccd4dd; }
  a { color: inherit; font-weight: bold; text-decoration: none; } a:hover { text-decoration: underline; }
  small { opacity: .7; }
  p { max-width: 600px; }
</style>
</head>
<body>
<h1>Sanctuary Cove display pages</h1>
<ul>
${items}
</ul>
<p>Each page mirrors the path on <a href="${esc(source)}">${esc(source)}</a>, trimmed to its content and stretched full width.
Add <code>?zoom=1.8</code> to scale text for a TV, <code>?refresh=300</code> to change the reload interval.</p>
<p><small>Built ${esc(new Date(fetchedAt).toISOString())}</small></p>
</body>
</html>`;
}

module.exports = { DEFAULT_URL, esc, fetchUpstream, transform, render, renderIndex };
