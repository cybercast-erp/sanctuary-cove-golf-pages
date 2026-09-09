# Sanctuary Cove Golf display pages

Publishes selected pages from https://www.sanctuarycovegolf.com.au as clean, full-width
static pages containing only the page content (no header, nav, sidebar, footer). Built for
TV / kiosk displays.

**Live:** https://cybercast-erp.github.io/sanctuary-cove-golf-pages/

**URL mapping:** swap the host, keep the path.

| Source                                                        | Published                                                              |
|---------------------------------------------------------------|------------------------------------------------------------------------|
| `https://www.sanctuarycovegolf.com.au/cms/social-sunday-schedule/` | `https://cybercast-erp.github.io/sanctuary-cove-golf-pages/cms/social-sunday-schedule/` |
| `https://www.sanctuarycovegolf.com.au/cms/honour-board-events/`    | `https://cybercast-erp.github.io/sanctuary-cove-golf-pages/cms/honour-board-events/`    |

The root URL lists every published page.

**Why:** injecting a script into the live site flashes the full website before trimming it.
Here the trimming happens at build time, so the browser only ever receives the finished page.

## Adding a page

Edit `pages.json` and push. Only **public** pages work; anything behind the members login
fails the build with `page requires members login`.

```json
{
  "source": "https://www.sanctuarycovegolf.com.au",
  "pages": [
    "/cms/social-sunday-schedule/",
    "/cms/honour-board-events/"
  ]
}
```

## How it works (hybrid)

1. **Build time:** `.github/workflows/pages.yml` runs daily (and on push / manual trigger).
   `build.js` fetches each page in `pages.json`, extracts `#pageContent`, strips widths/heights,
   scripts and sidebar, and writes `dist/<path>/index.html`. Deployed to GitHub Pages.
2. **Page load:** the baked HTML paints instantly. A small script then fetches the golf site
   directly (it sends `Access-Control-Allow-Origin: *`), trims it the same way, and swaps the
   content in only if it changed. Always live, no blank state.
3. If the live fetch fails the baked copy stays. `#proxy-root[data-live]` reports
   `baked`, `live`, or `failed: ...`.
4. If any page fails at build time the whole build fails and the previous deployment stays live.

Typography (Avenir, Janson) is loaded from the golf site's own theme so pages match the original.

## Kiosk URL options

| Query     | Example        | Effect                                        |
|-----------|----------------|-----------------------------------------------|
| `zoom`    | `?zoom=1.8`    | Scale text (0.5 to 5). Applied before paint.  |
| `refresh` | `?refresh=300` | Reload every N s (default 600).               |

## Local

```
node build.js            # -> dist/
node server.js           # optional live proxy on :8080 (?url=<any allowed page>)
```

Build env overrides: `SOURCE`, `ZOOM`, `REFRESH`, `OUT_DIR`, `CONTENT_ID`.
