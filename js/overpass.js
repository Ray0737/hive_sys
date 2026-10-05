// Overpass query + OSM -> GeoJSON. No DOM, so tests/overpass.test.mjs can import it in node.
// Mirrors are raced in parallel: any single one can be down or blocked on a given network
// Browser mirrors must send CORS headers (overpass.openstreetmap.fr does not, so it is only used by scripts/bake.mjs)
export const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

// bbox = [west, south, east, north]; Overpass wants (south, west, north, east)
export function buildQuery(L, [w, s, e, n], { timeout = 25, limit = 3000 } = {}) {
  const t = L.rel ? 'rel' : L.kind === 'point' ? 'nwr' : 'way'; // ponytail: area layers use ways only, multipolygon relations skipped
  const bb = `(${s},${w},${n},${e})`;
  const inCountry = L.country ? '(area.a)' : ''; // only elements inside the country polygon, not the neighbours that share its bbox
  const body = L.f.map(f => { const m = /^@(\w+)(.*)$/.exec(f); return m ? `${m[1]}${m[2]}${inCountry}${bb};` : `${t}${f}${inCountry}${bb};`; }).join('');
  const area = L.country ? `area["ISO3166-1"="${L.country}"]["admin_level"="2"]->.a;` : ''; // '@way[...]' overrides the layer's element type
  // geom(bbox) clips long routes to the view; area relations stay whole so their rings can close
  const geom = L.kind === 'area' && L.rel ? 'body geom' : 'body geom' + bb;
  return `[out:json][timeout:${timeout}];${area}(${body});out ${L.kind === 'point' ? 'center tags' : geom} ${limit};`;
}

// Join way segments (arrays of [lon, lat]) end to end into closed rings
export function stitch(segs) {
  const key = p => p[0] + ',' + p[1];
  const left = segs.map(s => s.slice());
  const rings = [];
  while (left.length) {
    let ring = left.pop();
    for (let grew = true; grew && key(ring[0]) !== key(ring.at(-1));) {
      grew = false;
      const end = key(ring.at(-1));
      const i = left.findIndex(s => key(s[0]) === end || key(s.at(-1)) === end);
      if (i >= 0) {
        const s = left.splice(i, 1)[0];
        if (key(s[0]) !== end) s.reverse();
        ring = ring.concat(s.slice(1));
        grew = true;
      }
    }
    if (ring.length > 3 && key(ring[0]) === key(ring.at(-1))) rings.push(ring);
  }
  return rings;
}

// out geom(bbox) clips to the view: nodes outside the box come back as null, so a way can split into several runs
const runs = geom => {
  const out = [];
  let cur = [];
  for (const g of geom) {
    if (g) cur.push([g.lon, g.lat]);
    else { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
};

export function toGeoJSON(els, kind) {
  const features = [];
  const line = (id, props, co) => features.push({ type: 'Feature', id, properties: props, geometry: { type: 'LineString', coordinates: co } });
  for (const el of els) {
    const props = { ...el.tags, '@type': el.type, '@id': el.id };
    if (el.type === 'relation' && kind === 'area') { // boundary: outer ways stitched into rings (ponytail: inner rings / holes ignored)
      const outer = (el.members || []).filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry && !m.geometry.includes(null)).map(m => m.geometry.map(g => [g.lon, g.lat]));
      const rings = stitch(outer);
      if (rings.length) features.push({ type: 'Feature', id: el.id, properties: props, geometry: rings.length === 1 ? { type: 'Polygon', coordinates: rings } : { type: 'MultiPolygon', coordinates: rings.map(r => [r]) } });
    } else if (el.type === 'relation') { // route relation: one line per member way, carrying the route's tags (colour, ref, name)
      for (const m of el.members || []) {
        if (m.type === 'way' && m.geometry) runs(m.geometry).forEach(co => line(m.ref, props, co));
      }
    } else if (kind === 'point') {
      const p = el.type === 'node' ? el : el.center;
      if (p) features.push({ type: 'Feature', id: el.id, properties: props, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
    } else if (el.geometry) {
      const full = !el.geometry.includes(null);
      const co = full && el.geometry.map(g => [g.lon, g.lat]);
      const closed = full && co.length > 3 && co[0][0] === co[co.length - 1][0] && co[0][1] === co[co.length - 1][1];
      if (kind === 'area' && closed) features.push({ type: 'Feature', id: el.id, properties: props, geometry: { type: 'Polygon', coordinates: [co] } });
      else runs(el.geometry).forEach(r => line(el.id, props, r)); // ponytail: clipped area becomes an outline, not a fill
    }
  }
  return { type: 'FeatureCollection', features };
}

// public Overpass allows ~2 slots per IP: queue anything beyond that
const MAX = 2;
let active = 0;
const waiting = [];
const acquire = () => (active < MAX ? (active++, Promise.resolve()) : new Promise(r => waiting.push(r)));
const release = () => { const next = waiting.shift(); next ? next() : active--; };

export async function queryOverpass(q, signal, timeoutMs = 25000, headers = {}, endpoints = ENDPOINTS) {
  await acquire();
  try {
    signal?.throwIfAborted();
    const race = new AbortController(); // cancels the losers once one mirror answers
    const stop = () => race.abort();
    signal?.addEventListener('abort', stop);
    try {
      return await Promise.any(endpoints.map(async url => {
        const r = await fetch(url, { method: 'POST', headers, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.any([race.signal, AbortSignal.timeout(timeoutMs)]) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (j.remark && /error|timed out|out of memory/i.test(j.remark)) throw new Error(j.remark); // Overpass answers 200 with an empty list on timeout
        return j.elements;
      }));
    } catch (e) {
      if (signal?.aborted) throw signal.reason; // caller cancelled: not an error
      throw e;
    } finally { race.abort(); signal?.removeEventListener('abort', stop); }
  } finally { release(); }
}
