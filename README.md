# C3 Team Dashboard (web)

A React + Vite reconstruction of the original Flask team-scheduling dashboard,
built to deploy entirely on **Netlify** — mirroring the architecture of the
Conference project.

## How it works

The original Flask app ran a heavy live Planning Center sync into SQLite on
every load. That doesn't fit Netlify's serverless model (thousands of PCO calls,
no persistent disk). Instead this app uses a **build-time data bake**:

- On every deploy, `scripts/build-data.mjs` runs a full Planning Center sync
  (a JS port of the original `sync.py` + `pco_client.py`) and writes a compact
  static dataset to `client/public/data/dataset.json` — no SQLite in between.
  If `PCO_APP_ID` / `PCO_SECRET` aren't set, it leaves the last committed
  dataset in place so the deploy still succeeds.
- The React app loads that JSON once and computes **every** view client-side
  (`client/src/lib/transform.js` is a faithful port of the Flask `database.py`
  aggregation — verified to match it exactly).
- The only mutable state is **editable team targets**, stored in **Netlify
  Blobs** via a single serverless function (`netlify/functions/targets.mjs`).
  In local dev (plain `vite`, no functions server) targets fall back to
  `localStorage`.

## Project layout

```
client/                 React + Vite front end
  public/data/dataset.json   baked dataset (committed snapshot / build output)
  src/lib/transform.js       aggregation logic (port of database.py)
  src/lib/api.js             targets client (Netlify fn + localStorage fallback)
  src/components/            Scheduling, ServingTeam, Settings, charts
shared/pco.mjs                  Planning Center API client (port of pco_client.py)
scripts/build-data.mjs          build-time PCO sync -> dataset.json (port of sync.py)
scripts/export_dataset.py       offline alternative: bake from an existing teams.db
netlify/functions/targets.mjs   targets persistence (Netlify Blobs)
netlify.toml                    build + redirects config
```

## Refreshing the data

The dataset refreshes **automatically on every Netlify deploy** — the build runs
`scripts/build-data.mjs`, which pulls live data from Planning Center (so just
trigger a redeploy, or push any commit). It needs `PCO_APP_ID` / `PCO_SECRET`
set in the Netlify environment; without them the build keeps the committed
dataset.

To re-bake locally:

```bash
export PCO_APP_ID=... PCO_SECRET=...
npm run sync          # = node scripts/build-data.mjs  (live PCO -> dataset.json)
```

Offline alternative (no PCO calls) — bake from the original Flask app's SQLite
DB instead:

```bash
npm run bake          # = python3 scripts/export_dataset.py  (reads ../teams/data/teams.db)
```

The committed `dataset.json` acts as a safe fallback snapshot for any deploy
where credentials are unavailable.

## Local development

```bash
npm --prefix client install
npm --prefix client run dev     # http://localhost:5188
```

Targets edited locally are stored in `localStorage`. To exercise the real
Netlify Blobs path locally, use the Netlify CLI: `netlify dev`.

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project** and pick the repo.
3. Netlify reads `netlify.toml` automatically — no manual build settings needed
   (build re-bakes the dataset then runs the Vite build, publish `client/dist`,
   functions `netlify/functions`).
4. Set `PCO_APP_ID` and `PCO_SECRET` in **Site settings → Environment variables**
   so the build-time sync can pull fresh data. **Never commit them.** (If they're
   omitted, deploys still succeed using the committed dataset snapshot — PCO is
   never called at runtime, only at build.)
5. Deploy. Team targets persist automatically in Netlify Blobs (provisioned
   on first write — no setup).

## Tabs

- **Scheduling** — filters (service / campus / team / period), KPI cards,
  response-breakdown donut, serving-frequency bar, campus comparison (shown when
  no campus is filtered), sortable members table, CSV export.
- **Serving Team** — campus filter driving KPI cards, cumulative-oriented and
  rolling-3-month-active trend lines, coaches-by-campus grouped bar chart, and a
  team-staffing-vs-target table with sparklines and traffic-light status.
- **Settings** — opened via the gear icon on the staffing table (not a visible
  tab). Edit per-team targets; fill/reset to suggested (each team's 12-month
  rolling-3-month peak).
