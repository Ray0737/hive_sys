// Download OpenStreetMap layers into data/<id>.geojson + data/manifest.json.
// Each layer is fetched for every region in js/config.js (REGIONS), military nationwide. A box that Overpass cannot answer
// (timeout / too big) is split into four and retried, so dense layers need no hand-tuned tile size.
// Usage: npm run bake [layerId ...]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { LAYERS, SOURCES, REGIONS, COUNTRY, isOverpass } from '../js/config.js';
import { buildQuery, toGeoJSON, queryOverpass, ENDPOINTS } from '../js/overpass.js';
import { branchOf, ammoBasis } from '../js/military.js';

const HEADERS = { 'User-Agent': 'hive-map-bake/0.1 (student disaster-map project)' }; // Overpass mirrors rate-limit anonymous clients
const MIRRORS = ['https://overpass.openstreetmap.fr/api/interpreter', ...ENDPOINTS]; // no CORS needed in node
const OUT = new URL('../data/', import.meta.url);
const MAX_DEPTH = 3;

const quarters = ([w, s, e, n]) => { const x = (w + e) / 2, y = (s + n) / 2; return [[w, s, x, y], [x, s, e, y], [w, y, x, n], [x, y, e, n]]; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// -> { features, failed }: failed counts leaf boxes that could not be downloaded at all
async function fetchBox(L, box, depth = 0) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { return { features: toGeoJSON(await queryOverpass(buildQuery(L, box, { timeout: 120, limit: '' }), undefined, 150000, HEADERS, MIRRORS), L.kind).features, failed: 0 }; }
    catch { await wait(4000); }
  }
  if (depth >= MAX_DEPTH) { console.warn(`  ${L.id}: gave up on ${box.map(v => v.toFixed(2))}`); return { features: [], failed: 1 }; }
  const parts = [];
  for (const q of quarters(box)) parts.push(await fetchBox(L, q, depth + 1)); // one at a time: be gentle with the public servers
  return { features: parts.flatMap(p => p.features), failed: parts.reduce((a, p) => a + p.failed, 0) };
}

// one feature per OSM element; clipped line pieces share an id, so they also need their ends to tell them apart
const keyOf = f => `${f.properties['@type']}/${f.properties['@id']}/${f.id}` + (f.geometry.type === 'LineString' ? `/${f.geometry.coordinates[0]}/${f.geometry.coordinates.at(-1)}` : '');

await mkdir(OUT, { recursive: true });
const manifestFile = new URL('manifest.json', OUT);
const record = async (id, entry) => { // re-read first: bake-data.mjs may have written meanwhile
  const m = await readFile(manifestFile, 'utf8').then(JSON.parse, () => ({ layers: {} }));
  delete m.bbox; m.regions = { ...REGIONS, country: COUNTRY }; m.layers[id] = entry;
  await writeFile(manifestFile, JSON.stringify(m, null, 1));
};

const only = process.argv.slice(2);
const wanted = L => !only.length || only.includes(L.id) || LAYERS.some(T => T.split === L.id && only.includes(T.id));

for (const L of [...SOURCES, ...LAYERS.filter(isOverpass)].filter(wanted)) {
  const seen = new Map();
  let failed = 0;
  for (const box of L.scope === 'country' ? [COUNTRY] : Object.values(REGIONS)) {
    const r = await fetchBox(L, box);
    failed += r.failed;
    r.features.forEach(f => seen.set(keyOf(f), f));
  }
  const features = [...seen.values()];
  const targets = LAYERS.filter(T => T.split === L.id && (!only.length || only.includes(T.id) || only.includes(L.id)));
  for (const T of targets.length ? targets : [L]) {
    let mine = features;
    if (T !== L) { // military: sort by branch; area layers are "ammo" or "everything else"
      mine = features.filter(f => { const b = branchOf(f.properties); return T.kind === 'area' ? (T.pick === 'ammo') === (b === 'ammo') : b === T.pick; })
        .map(f => { const b = branchOf(f.properties); return { ...f, properties: { ...f.properties, branch: b, ...(b === 'ammo' && { 'marked because': ammoBasis(f.properties) }) } }; });
    }
    if (failed && !mine.length && T === L) { console.warn(`${T.id}: skipped, nothing downloaded`); continue; }
    await writeFile(new URL(`${T.id}.geojson`, OUT), JSON.stringify({ type: 'FeatureCollection', features: mine }));
    await record(T.id, { file: `${T.id}.geojson`, count: mine.length, fetched_at: new Date().toISOString(), source: 'OpenStreetMap via Overpass', license: 'ODbL', partial: failed > 0 });
    console.log(`${T.id}: ${mine.length}${failed ? ` (${failed} boxes failed, partial)` : ''}`);
  }
}
