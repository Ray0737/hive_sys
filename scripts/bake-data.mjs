// Bake the non-OSM layers into data/: BMA flood-risk points + floodgates, Air4Thai PM2.5 snapshot, low-lying ground overlay.
// Usage: npm run bake:data [floodrisk floodgate aqi lowland]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { decodePNG, encodePNG } from './png.mjs';
import { fetchStations, toAqiGeoJSON } from './aqi.mjs';

import { REGIONS, UNION } from '../js/config.js';
const BBOX = REGIONS.bkk; // the DEM overlay stays Bangkok-only
const OUT = new URL('../data/', import.meta.url);
const UA = { 'User-Agent': 'hive-map-bake/0.1 (student disaster-map project)' };
const BMA = 'https://data.bangkok.go.th';

const get = async (url, as = 'text') => {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return as === 'json' ? r.json() : as === 'buf' ? Buffer.from(await r.arrayBuffer()) : r.text();
    } catch (e) { if (attempt === 3) throw new Error(`${url}: ${e.message}`); await new Promise(r => setTimeout(r, 2000 * attempt)); }
  }
};

// CSV with quoted fields -> array of objects
function csv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1);
  const names = head.map(h => h.replace(/^﻿/, '').trim());
  return body.map(r => Object.fromEntries(names.map((n, i) => [n, (r[i] ?? '').trim()])));
}

const pointFC = (rows, lat, lng, props) => ({
  type: 'FeatureCollection',
  features: rows.map((r, i) => ({ type: 'Feature', id: i + 1, properties: { ...props(r), '@type': 'bma', '@id': i + 1 }, geometry: { type: 'Point', coordinates: [+r[lng], +r[lat]] } }))
    .filter(f => Number.isFinite(f.geometry.coordinates[0]) && Number.isFinite(f.geometry.coordinates[1]) && f.geometry.coordinates[0] > 99 && f.geometry.coordinates[1] > 12),
});

const licence = async pkg => (await get(`${BMA}/api/3/action/package_show?id=${pkg}`, 'json').catch(() => null))?.result?.license_title || 'see dataset page on data.bangkok.go.th';

const TASKS = {
  async floodrisk() {
    const rows = csv(await get(`${BMA}/dataset/25bc3f04-5707-4b60-a885-5ad45aa38cd6/resource/837b7fb6-ce1f-4356-881e-6bf14eeb075f/download/flood_risk26.csv`));
    const fc = pointFC(rows, 'UTM_Y', 'UTM_X', r => ({ name: r.STATION_NAME, district: r.DISTRICT_NAME, group: r.GROUP_D }));
    return { fc, source: 'Bangkok Metropolitan Administration open data (flood_risk26)', license: await licence('flood_risk26') };
  },
  async floodgate() {
    const rows = csv(await get(`${BMA}/dataset/83ae5639-a37f-4e19-bd37-e1c97930f39d/resource/42948cf7-0759-4719-a32f-8eeabd89b8ee/download/floodgate.csv`));
    const fc = pointFC(rows, 'lat', 'long', r => ({ name: r.name, type: r.type, district: r.district, 'gate level m': r.gate, 'water control m': r.water_control, 'critical m': r.critical, 'warning m': r.warning }));
    return { fc, source: 'Bangkok Metropolitan Administration open data (floodgate)', license: await licence('floodgate') };
  },
  async fm() { // NBTC FM transmitters: public frequency plan, useful when networks are down but radio still works
    const rows = csv(await get('https://bcstandard.nbtc.go.th/fm_station/api/csv_station.php'));
    const fc = pointFC(rows, 'Latitude', 'Longitude', r => ({ name: `${r.Frequency} MHz ${r.Station_Name}`, 'frequency (MHz)': r.Frequency, callsign: r.Callsign, province: r.Province, transmitter: r.Transmitter_Name, 'max ERP (kW)': r.Max_ERP, 'antenna height (m)': r.Ant_Height, polarization: r.Polarization, remark: r.Remark }));
    const [w, s, e, n] = [UNION[0] - 0.3, UNION[1] - 0.3, UNION[2] + 0.3, UNION[3] + 0.3];
    fc.features = fc.features.filter(f => { const [x, y] = f.geometry.coordinates; return x >= w && x <= e && y >= s && y <= n; });
    fc.features.forEach(f => { f.properties['@type'] = 'nbtc'; });
    return { fc, source: 'NBTC open data, FM station technical data (bcstandard.nbtc.go.th)', license: 'NBTC open data catalogue, check terms at datacatalog.nbtc.go.th' };
  },
  async bmapump() {
    const rows = csv(await get(`${BMA}/dataset/82cb9fcc-ddea-436a-abfa-eb5dc9fc85fc/resource/53205669-40f9-4cb6-b902-7b8fbc945919/download/water-pump-station.csv`));
    const fc = pointFC(rows, 'COOR_Y', 'COOR_X', r => ({ name: r.PUMP_NAME, canal: r.CANAL_NAME, 'pumps': r.PUMP_NUM, 'capacity (cms)': r.GP_CAPACITY, remark: r.REMARK }));
    return { fc, source: 'Bangkok Metropolitan Administration open data (pumpstation)', license: await licence('pumpstation') };
  },
  async aqi() {
    const [w, s, e, n] = [UNION[0] - 0.3, UNION[1] - 0.3, UNION[2] + 0.3, UNION[3] + 0.3]; // a little wider: stations just outside still describe the air
    return { fc: toAqiGeoJSON(await fetchStations(), [w, s, e, n]), source: 'Pollution Control Department, Air4Thai (snapshot; the server proxies it live)', license: 'Air4Thai terms apply, check before publishing' };
  },
};

// Box blur that skips NaN (sea) cells: running sums of values and of valid-cell counts, rows then columns
function blur(v, W, H, r) {
  const val = Float64Array.from(v, x => (Number.isNaN(x) ? 0 : x)), cnt = Float64Array.from(v, x => (Number.isNaN(x) ? 0 : 1));
  const pass = (a, horiz) => {
    const n = horiz ? W : H, lines = horiz ? H : W, out = new Float64Array(a.length), P = new Float64Array(n + 1);
    for (let l = 0; l < lines; l++) {
      const at = i => (horiz ? l * W + i : i * W + l);
      for (let i = 0; i < n; i++) P[i + 1] = P[i] + a[at(i)];
      for (let i = 0; i < n; i++) out[at(i)] = P[Math.min(n, i + r + 1)] - P[Math.max(0, i - r)];
    }
    return out;
  };
  const sv = pass(pass(val, true), false), sc = pass(pass(cnt, true), false);
  return Float32Array.from(v, (x, i) => (Number.isNaN(x) ? NaN : sv[i] / sc[i]));
}

// Low-lying ground: Terrarium DEM tiles (z12, ~38 m/px). Absolute heights in the city are unreliable (SRTM sees roofs and canopy:
// central Bangkok reads 3-12 m, reality is 1-2 m), so smooth to ~300 m and band by percentile within the area: "relatively low".
async function lowland() {
  const Z = 12, N = 2 ** Z, TS = 256;
  const tx = lon => Math.floor(((lon + 180) / 360) * N), ty = lat => Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * N);
  const [x0, x1, y0, y1] = [tx(BBOX[0]), tx(BBOX[2]), ty(BBOX[3]), ty(BBOX[1])];
  const W = (x1 - x0 + 1) * TS, H = (y1 - y0 + 1) * TS, elev = new Float32Array(W * H).fill(NaN);
  const jobs = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) jobs.push([x, y]);
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < jobs.length) {
      const [x, y] = jobs[next++];
      const t = decodePNG(await get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`, 'buf'));
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const i = (py * TS + px) * t.bpp, e = t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
        if (e >= -1) elev[((y - y0) * TS + py) * W + (x - x0) * TS + px] = e; // below -1 m is sea / bathymetry: left clear
      }
    }
  }));
  const smooth = blur(elev, W, H, 8);
  const sample = []; // percentile cut-offs from a subsample of land cells
  for (let i = 0; i < smooth.length; i += 7) if (!Number.isNaN(smooth[i])) sample.push(smooth[i]);
  sample.sort((a, b) => a - b);
  const cut = [0.10, 0.25, 0.45].map(p => sample[Math.floor(sample.length * p)]);
  const colours = [[255, 77, 77, 160], [255, 154, 31, 140], [255, 210, 63, 110]]; // lowest 10%, next 15%, next 20%
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < smooth.length; i++) {
    const k = cut.findIndex(c => smooth[i] < c);
    if (k >= 0 && !Number.isNaN(smooth[i])) Buffer.from(colours[k]).copy(rgba, i * 4);
  }
  const lon = x => (x / N) * 360 - 180, lat = y => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / N))) * 180) / Math.PI;
  await writeFile(new URL('lowland.png', OUT), encodePNG(W, H, rgba));
  console.log(`lowland cut-offs (smoothed DEM, m): ${cut.map(c => c.toFixed(1)).join(' / ')}`);
  return {
    file: 'lowland.png', kind: 'image', count: 0,
    coordinates: [[lon(x0), lat(y0)], [lon(x1 + 1), lat(y0)], [lon(x1 + 1), lat(y1 + 1)], [lon(x0), lat(y1 + 1)]],
    source: 'Terrain Tiles (AWS Open Data; SRTM and other DEMs). Relative only: lowest 10/25/45% of smoothed ground within the area', license: 'see registry.opendata.aws/terrain-tiles',
  };
}

await mkdir(OUT, { recursive: true });
const manifestFile = new URL('manifest.json', OUT);
const manifest = await readFile(manifestFile, 'utf8').then(JSON.parse, () => ({ layers: {} }));
const save = async id => { // re-read first: bake.mjs may have written meanwhile
  const fresh = await readFile(manifestFile, 'utf8').then(JSON.parse, () => ({ layers: {} }));
  fresh.layers[id] = manifest.layers[id];
  await writeFile(manifestFile, JSON.stringify(fresh, null, 1));
};
const only = process.argv.slice(2);

for (const id of [...Object.keys(TASKS), 'lowland'].filter(id => !only.length || only.includes(id))) {
  try {
    if (id === 'lowland') manifest.layers.lowland = { ...(await lowland()), fetched_at: new Date().toISOString() };
    else {
      const { fc, source, license } = await TASKS[id]();
      await writeFile(new URL(`${id}.geojson`, OUT), JSON.stringify(fc));
      manifest.layers[id] = { file: `${id}.geojson`, count: fc.features.length, fetched_at: new Date().toISOString(), source, license };
    }
    await save(id);
    console.log(`${id}: ${manifest.layers[id].count || 'image'} ok`);
  } catch (e) { console.warn(`${id}: failed (${e.message})`); }
}
