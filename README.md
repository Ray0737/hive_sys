# Hive Map

Multi-hazard decision map for Bangkok. Spec: [context_hive.md](context_hive.md).
Phase now: **map layers**. Local-first features (PWA, offline packs, saved places, road pins, routing, drills) are paused.

## Run

ES modules need a server, not `file://`. `npm start` runs `server.mjs`: static files with no stale caching, plus a live PM2.5 proxy at `/api/aqi` (Air4Thai sends no CORS headers). Any other static host works too; PM2.5 then falls back to the baked snapshot.

```
npm start        # http://localhost:5173
npm test         # converter tests, node only
npm run bake       # OpenStreetMap layers for greater Bangkok into data/ (slow, run once)
npm run bake:data  # BMA flood risk + floodgates, Air4Thai PM2.5, relative low-ground overlay
```

No build step, no npm dependencies. MapLibre and the font are vendored (`vendor/`, `assets/fonts/`).

## Structure

```
index.html            page skeleton
server.mjs            static server + /api/aqi live proxy
vendor/               MapLibre GL 4.7.1 (BSD-3, licence file alongside)
css/
  base.css            tokens, reset, font, icon mask
  layout.css          bar, panels, status, responsive
  components.css      rows, detail, map controls, popup, dialog
contingency.html      protocol page, rendered from protocol/contingency.json
protocol/             the protocol content (edit this)
js/
  contingency.js      renders the protocol page
  coords.js           DMS coordinate parsing
  main.js             wiring
  config.js           layer catalogue (add a layer here)
  basemaps.js         dark / contrast / satellite styles
  layers.js           per-layer GeoJSON sources, Overpass loading
  overpass.js         query builder, OSM -> GeoJSON (pure, tested)
  icons.js            Lucide masks + map marker images
  ui.js               toolbar, layer panel, detail panel, status
  search.js           Nominatim search, locate me, / shortcut
  nearby.js           pin + 500 m / 1 km rings
  geo.js              distance, circle, point-in-polygon, nearest (pure, tested)
  state.js            view/theme/layers in the URL hash (shareable)
assets/
  icons/              vendored Lucide SVGs (ISC)
  favicon.svg
scripts/bake.mjs      OSM layers -> data/*.geojson + manifest.json
scripts/bake-data.mjs BMA / Air4Thai / DEM layers -> data/
scripts/aqi.mjs       Air4Thai -> GeoJSON (shared by bake-data and the server)
scripts/png.mjs       tiny PNG codec for the DEM overlay
data/                 baked layer files (the app prefers these over live Overpass)
tests/                node:test files (npm test)
```

## Add a layer

Append an entry to `LAYERS` in `js/config.js`: `id`, `g` (group index), `icon` (file in `assets/icons`), `name`, `z` (min zoom), `f` (Overpass tag filters). Use `kind: 'line' | 'area'` for non-point layers.

## Baked data

`npm run bake` fetches every layer for Bangkok plus a buffer (bbox in `scripts/bake.mjs`) in 3x3 tiles and writes `data/<layer>.geojson` and `data/manifest.json` (count, fetched_at, source, license). `npm run bake air fire` refreshes only those layers. The app loads a baked layer from `data/` once and never calls Overpass for it; layers without a file still load live. Layer age in the panel is the bake date. Data is OSM (ODbL): keep the attribution if you publish it.

## Contingency page

The real `protocol/contingency.json` is git-ignored (it holds personal sites and names). A fresh clone uses `protocol/contingency.example.json`; copy it to `protocol/contingency.json` and fill in your own.

`contingency.html` (tab at the top centre of both pages) renders `protocol/contingency.json`: evacuation steps, the secondary and alternate locations (coordinates as DMS text, also drawn on the map as the "Contingency sites" layer), and the Motorola radio plan. Edit the JSON and reload. Empty fields show as TO FILL. `Print` gives a black-on-white copy. "Nearest to my location" ranks sites by straight-line distance.

## Coverage

`js/config.js` lists the download regions (`REGIONS`): Bangkok area, EEC (Chonburi to Rayong), west coast (Phetchaburi to Hua Hin) and the Saraburi to Nakhon Ratchasima corridor. Add a box there and re-run `npm run bake` to cover more. Military layers are fetched for the whole of Thailand (inside the country polygon, so neighbours are excluded) and sorted into army, navy, air force, other and ammunition / ordnance by `js/military.js`, using only the tags and names OSM mappers wrote. BMA data (flood risk, floodgates, pumps), the district outlines and the low-ground overlay are Bangkok-only because their sources are.

## Layer sources

| Group | Source | How |
|---|---|---|
| Access, Supply, Transit, Water, Safety, Critical infra, Comms | OpenStreetMap | `npm run bake`, else live Overpass |
| Boundaries (50 khet, 180 khwaeng) | OpenStreetMap relations | `npm run bake` (rings stitched in `overpass.js`) |
| BMA flood-risk points, floodgates, pumping stations | data.bangkok.go.th CSV (licence is "not specified" there: check before publishing) | `npm run bake:data` |
| FM radio stations (frequency, callsign, power) | NBTC open data CSV | `npm run bake:data` |
| Air quality PM2.5 | Air4Thai | live through `server.mjs` (10 min cache), baked snapshot as fallback. Fetched with curl: the API's TLS chain is incomplete |
| Relatively low ground | AWS Terrain Tiles | `npm run bake:data`. Smoothed and banded by percentile: the DEM reads city roofs, so absolute heights are wrong |
| Earthquakes | USGS 2.5+ weekly feed | live, refreshed every 10 min while on |
| Rain radar | RainViewer | live tiles |

Radio in OSM is thin around Bangkok (5 radio/TV towers, ~25 cell towers, no amateur repeaters tagged). The NBTC FM layer fills the gap with real frequencies.

## Measure and routing

Measure drops points A, B, C. Straight-line works offline. Walk and Drive call the public OSRM instances at routing.openstreetmap.de (OpenStreetMap roads, CORS enabled): online only, demo infrastructure with no guarantee, and the route knows nothing about flooding, closures or traffic. A local routing graph is the next step if it must work offline.

## Keeping data fresh

Re-run `npm run bake` (OSM, slow) and `npm run bake:data` (BMA, NBTC, DEM, PM2.5 snapshot) when you want newer data. To do it weekly on Windows:

```
schtasks /Create /SC WEEKLY /D SUN /ST 03:00 /TN "HiveBake" /TR "cmd /c cd /d \"<path to Program - hive>\" && npm run bake && npm run bake:data"
```

## What still needs the network

Basemap tiles (OpenFreeMap, CARTO, Esri), place search (Nominatim), road routing (OSRM), earthquakes (USGS), rain radar (RainViewer), live PM2.5. Everything in `data/` works offline once loaded, but the PWA/offline-pack work is still paused.

## Notes

- Fonts: LINE Seed Sans TH is self-hosted in `assets/fonts/`. LINE publishes it under the SIL Open Font Licence; confirm at seed.line.me before shipping (see `assets/fonts/NOTE.txt`).
- Public Overpass is rate limited (2 requests at a time here). For real use, host your own or pre-bake per-district data.
- Flood extent (GISTDA) is not wired. BMA flood-risk points, floodgates and pumps are, plus a relative low-ground overlay. BMA daily water-level CSVs have no coordinates, so they are not mapped.
- Sensitive layers (military, power): public data only, no inference. See context_hive.md section 7.
