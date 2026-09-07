# Sanctuary Golf Schedule (GitHub Pages)

Publishes https://www.sanctuarycovegolf.com.au/cms/social-sunday-schedule/ as a clean,
full-width static page containing only the schedule table.

**Why:** injecting a script into the live site flashes the full website before trimming it.
Here the trimming happens at **build time** in GitHub Actions, so the browser only ever
receives the finished page. No flicker.

## How it works

1. `.github/workflows/pages.yml` runs every 30 min (and on push / manual trigger).
2. `build.js` fetches the schedule page, extracts `#pageContent`, strips widths/heights,
   scripts and sidebar, and writes `dist/index.html`.
3. The `dist` folder is deployed to GitHub Pages.
4. If the golf site is down the build fails and the **previous** page stays live.

## One-time setup

```
git init && git add -A && git commit -m "Schedule static site"
gh repo create <owner>/sanctuary-golf-schedule --public --source=. --push
```

Then in the repo: **Settings > Pages > Source = "GitHub Actions"**. The first workflow run
publishes to `https://<owner>.github.io/sanctuary-golf-schedule/`.

(Public repo required for Pages on a free plan; private repos need GitHub Pro/Team.)

## Kiosk URL options

| Query     | Example      | Effect                                        |
|-----------|--------------|-----------------------------------------------|
| `zoom`    | `?zoom=1.6`  | Scale text (0.5 to 5). Applied before paint.  |
| `refresh` | `?refresh=300` | Reload every N s (default 600, baked in).   |

Example: `https://<owner>.github.io/sanctuary-golf-schedule/?zoom=1.8`

## Local

```
node build.js && start dist/index.html     # static build
node server.js                              # live proxy on :8080 (optional, for preview)
```

Build env vars: `SOURCE_URL`, `ZOOM`, `REFRESH`, `OUT_DIR`, `CONTENT_ID`.
