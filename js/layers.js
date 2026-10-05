// Map data layers. Sources, in order of preference: baked file in data/ -> live feed / tiles -> live Overpass for the current view.
import { LAYERS } from './config.js';
import { buildQuery, toGeoJSON, queryOverpass } from './overpass.js';
import { parseDms } from './coords.js';

const K = 'hv-'; // prefix: basemap styles already own ids like 'waterway' and 'water'
const inside = (a, b) => a && b[0] >= a[0] && b[1] >= a[1] && b[2] <= a[2] && b[3] <= a[3];
const FRESH = 10 * 60 * 1000;
// Thai PCD PM2.5 bands (ug/m3): blue, green, yellow, orange, red
const AQI_COLOR = ['step', ['to-number', ['get', 'pm25']], '#3fa7ff', 15.1, '#3ddc84', 25.1, '#ffd23f', 37.6, '#ff9a1f', 75.1, '#ff4d4d'];
const SUFFIXES = ['', '-fill', '-case', '-cl', '-cn', '-lbl'];

// live feed id -> GeoJSON normaliser
const SITE_ROLE = { secondary: 'Secondary site: Bangkok not safe', bkk: 'Bangkok alternate: cannot travel far' };
const FEEDS = {
  sites: j => ({ // protocol/contingency.json: the same coordinates the Contingency page shows
    type: 'FeatureCollection',
    features: j.sites.map((s, i) => ({ type: 'Feature', id: i + 1, geometry: { type: 'Point', coordinates: parseDms(s.dms) }, properties: { name: s.name, role: SITE_ROLE[s.kind] || s.kind, coordinates: s.dms, '@type': 'protocol', '@id': s.id } })),
  }),
  quake: j => ({
    type: 'FeatureCollection',
    features: j.features.filter(f => { const [x, y] = f.geometry.coordinates; return x > 90 && x < 115 && y > -12 && y < 30; }) // SE Asia: shaking that Bangkok can feel
      .map(f => ({ type: 'Feature', id: f.id, geometry: f.geometry, properties: { name: `M${f.properties.mag.toFixed(1)} ${f.properties.place}`, mag: f.properties.mag, 'time (UTC)': new Date(f.properties.time).toISOString().slice(0, 16).replace('T', ' '), '@type': 'usgs', '@id': f.id } })),
  }),
};

export function createLayers(map, markers, baked, getTheme, onUpdate) {
  const fs = {}; // id -> { bbox, at, ctl, status, partial }
  const live = () => LAYERS.filter(L => !L.off);
  const ids = L => SUFFIXES.map(s => K + L.id + s).filter(i => map.getLayer(i));
  const firstData = () => map.getStyle().layers.find(l => l.id.startsWith(K))?.id; // rasters go under every data layer
  const font = () => { // reuse whatever font the basemap's own labels use, so text always has glyphs
    const f = map.getStyle().layers.find(l => l.layout?.['text-font'])?.layout['text-font'];
    return Array.isArray(f) && typeof f[0] === 'string' && f[0] !== 'literal' ? f : ['Noto Sans Regular'];
  };

  function installRaster(L) { // live tiles, replaced whenever a newer frame arrives
    ids(L).forEach(i => map.removeLayer(i));
    if (map.getSource('src-' + L.id)) map.removeSource('src-' + L.id);
    if (!L.tiles) return;
    map.addSource('src-' + L.id, { type: 'raster', tiles: [L.tiles], tileSize: 256, maxzoom: 7, attribution: 'Radar © RainViewer' });
    map.addLayer({ id: K + L.id, type: 'raster', source: 'src-' + L.id, layout: { visibility: L.on ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.6 } }, firstData());
  }

  function add(L) {
    const mono = getTheme() === 'contrast', col = mono && !L.keepColor ? '#fff' : L.color; // contrast map: lines stay white, markers are always colour-filled
    const src = 'src-' + L.id, layout = { visibility: L.on ? 'visible' : 'none' };
    const local = baked[L.id];
    const minzoom = local ? (L.kind === 'point' ? 9 : L.z) : 0; // baked data costs no request, so gate on the map: points cluster from z9
    if (L.kind === 'raster') return installRaster(L);
    if (L.kind === 'image') {
      if (!local) return;
      map.addSource(src, { type: 'image', url: 'data/' + local.file, coordinates: local.coordinates });
      return map.addLayer({ id: K + L.id, type: 'raster', source: src, layout, paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 } });
    }
    const cluster = L.kind === 'point' && L.style !== 'circle';
    if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: L.data, ...(cluster && { cluster: true, clusterRadius: 45, clusterMaxZoom: 14 }) });
    if (L.kind === 'point' && L.style === 'circle') {
      const aqi = L.id === 'aqi';
      map.addLayer({ id: K + L.id, type: 'circle', source: src, layout, paint: {
        'circle-radius': aqi ? 8 : ['interpolate', ['linear'], ['get', 'mag'], 2, 4, 5, 10, 7, 24],
        'circle-color': aqi ? AQI_COLOR : col, 'circle-opacity': aqi ? 1 : 0.55, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000' } });
    } else if (L.kind === 'point') {
      if (!map.hasImage('m-' + L.id)) map.addImage('m-' + L.id, markers[L.id], { pixelRatio: 2 });
      map.addLayer({ minzoom, id: K + L.id, type: 'symbol', source: src, filter: ['!', ['has', 'point_count']], layout: { ...layout, 'icon-image': 'm-' + L.id, 'icon-allow-overlap': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7 * (L.size || 1), 17, 1 * (L.size || 1)] } });
      map.addLayer({ minzoom, id: K + L.id + '-cl', type: 'circle', source: src, filter: ['has', 'point_count'], layout, paint: {
        'circle-color': L.color, 'circle-stroke-color': '#000', 'circle-stroke-width': 1.5, 'circle-radius': ['step', ['get', 'point_count'], 10, 10, 14, 100, 18, 1000, 22] } });
      map.addLayer({ minzoom, id: K + L.id + '-cn', type: 'symbol', source: src, filter: ['has', 'point_count'], layout: { ...layout, 'text-field': ['get', 'point_count_abbreviated'], 'text-font': font(), 'text-size': 10, 'text-allow-overlap': true }, paint: { 'text-color': '#000' } });
    } else if (L.kind === 'area') {
      const quiet = L.keepColor; // boundaries: hairline outline, near-invisible fill that still takes clicks
      map.addLayer({ minzoom, id: K + L.id + '-fill', type: 'fill', source: src, layout, paint: { 'fill-color': col, 'fill-opacity': quiet ? 0.02 : 0.1 } });
      map.addLayer({ minzoom, id: K + L.id, type: 'line', source: src, layout, paint: { 'line-color': col, 'line-width': quiet ? 0.8 : 1.25, 'line-dasharray': quiet ? [1, 2] : [3, 2] } });
      if (L.label) map.addLayer({ id: K + L.id + '-lbl', type: 'symbol', source: src, minzoom: Math.max(minzoom, L.label), layout: { ...layout, 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': font(), 'text-size': 9, 'text-transform': 'uppercase', 'text-letter-spacing': 0.06 }, paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.5 } });
    } else {
      const dash = { water: [3, 2], rail: [6, 2, 1, 2] }[L.st];
      map.addLayer({ minzoom, id: K + L.id + '-case', type: 'line', source: src, layout, paint: { 'line-color': '#000', 'line-width': L.rel ? 6 : 5 } });
      map.addLayer({ minzoom, id: K + L.id, type: 'line', source: src, layout, paint: { 'line-color': L.rel ? ['to-color', ['get', 'colour'], col] : col, 'line-width': L.st === 'bridge' ? 2.5 : L.rel ? 3 : 1.5, ...(dash && { 'line-dasharray': dash }) } });
    }
  }

  async function loadFeed(L, st) {
    if (st.at && Date.now() - st.at < FRESH) return onUpdate();
    st.status = '…'; onUpdate();
    try {
      let r = await fetch(L.feed);
      if (!r.ok && L.fallback) r = await fetch(L.fallback); // fresh clone: private file absent, use the example
      L.data = FEEDS[L.id](await r.json());
      st.at = Date.now(); st.status = '';
      map.getSource('src-' + L.id)?.setData(L.data);
    } catch { st.status = 'error'; }
    onUpdate();
  }

  async function loadRadar(L, st) {
    if (L.tiles && Date.now() - st.at < FRESH) return onUpdate();
    st.status = '…'; onUpdate();
    try {
      const j = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
      const f = j.radar.past.at(-1);
      L.tiles = `${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`;
      st.at = f.time * 1000; st.status = '';
      installRaster(L);
    } catch { st.status = 'error'; }
    onUpdate();
  }

  async function load(L) {
    const st = (fs[L.id] ||= {});
    if (L.kind === 'raster') return loadRadar(L, st);
    if (L.feed) return loadFeed(L, st);
    if (L.live && !(st.liveFailed) && (!st.at || Date.now() - st.at > FRESH)) { // server proxy (api/aqi): fresher than the baked snapshot
      try {
        const j = await (await fetch(L.live)).json();
        L.data = j; st.at = Date.parse(j.generated) || Date.now(); st.status = '';
        map.getSource('src-' + L.id)?.setData(L.data);
        return onUpdate();
      } catch { st.liveFailed = true; } // static host with no proxy: use the baked file
    }
    const local = baked[L.id];
    if (local) { // file from the bake scripts: load once, no network
      if (!st.at) {
        try {
          if (L.kind !== 'image') {
            L.data = await (await fetch('data/' + local.file)).json();
            map.getSource('src-' + L.id)?.setData(L.data);
          }
          st.at = Date.parse(local.fetched_at); st.partial = local.partial;
        } catch { delete baked[L.id]; return load(L); } // file missing: fall back to live where possible
      }
      st.status = '';
      return onUpdate();
    }
    if (L.static || L.kind === 'image') { st.status = 'no data'; return onUpdate(); }
    const b = map.getBounds(), view = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    if (map.getZoom() < L.z) { st.status = 'z≥' + L.z; return onUpdate(); }
    if (inside(st.bbox, view)) { st.status = ''; return onUpdate(); }
    const px = (view[2] - view[0]) * 0.25, py = (view[3] - view[1]) * 0.25; // pad so small pans stay covered
    const box = [view[0] - px, view[1] - py, view[2] + px, view[3] + py];
    st.ctl?.abort(); st.ctl = new AbortController(); st.status = '…'; onUpdate();
    try {
      L.data = toGeoJSON(await queryOverpass(buildQuery(L, box), st.ctl.signal), L.kind);
      st.bbox = box; st.at = Date.now(); st.status = '';
      map.getSource('src-' + L.id)?.setData(L.data);
    } catch (e) { if (e.name === 'AbortError') return; st.status = 'error'; }
    onUpdate();
  }

  let timer;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(() => live().filter(L => L.on).forEach(load), 500); };

  map.on('style.load', () => { live().forEach(add); refresh(); });
  map.on('moveend', refresh);
  setInterval(refresh, FRESH); // feeds and radar re-check every 10 min while a layer is on (a no-op until their data is stale)

  const clickable = L => L.kind !== 'raster' && L.kind !== 'image';
  return {
    fs,
    setOn(L, on) {
      L.on = on;
      ids(L).forEach(i => map.setLayoutProperty(i, 'visibility', on ? 'visible' : 'none'));
      if (on) load(L); else onUpdate();
    },
    // topmost enabled-layer feature near a screen point
    featureAt(pt) {
      const hitIds = live().filter(L => L.on && clickable(L)).flatMap(ids).filter(i => !/-(case|cl|cn|lbl)$/.test(i));
      if (!hitIds.length) return null;
      const hit = map.queryRenderedFeatures([[pt.x - 6, pt.y - 6], [pt.x + 6, pt.y + 6]], { layers: hitIds })[0];
      return hit && { L: LAYERS.find(L => K + L.id === hit.layer.id.replace(/-fill$/, '')), feature: hit };
    },
    // click on a cluster zooms into it; returns true when it handled the click
    clusterAt(pt) {
      const cl = live().filter(L => L.on && L.kind === 'point').map(L => K + L.id + '-cl').filter(i => map.getLayer(i));
      const hit = cl.length && map.queryRenderedFeatures([[pt.x - 4, pt.y - 4], [pt.x + 4, pt.y + 4]], { layers: cl })[0];
      if (!hit) return false;
      map.getSource(hit.source).getClusterExpansionZoom(hit.properties.cluster_id).then(zoom => map.easeTo({ center: hit.geometry.coordinates, zoom: zoom + 0.5 }));
      return true;
    },
  };
}
