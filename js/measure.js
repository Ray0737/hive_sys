// Distance tool: points A, B, C ... with per-leg and total distance, straight-line or along roads (walk / drive).
// Markers are DOM elements, so they survive a basemap change; only the line source is re-added on style.load.
import { dist } from './geo.js';

const MAX = 26;
export const letter = i => String.fromCharCode(65 + i);
export const fmt = d => (d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(d < 10000 ? 2 : 1) + ' km');
export const fmtTime = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };

// legs[i] = distance from point i to i+1; total = sum
export function stats(coords) {
  const legs = coords.slice(1).map((c, i) => dist(coords[i], c));
  return { legs, total: legs.reduce((a, b) => a + b, 0) };
}

// Public OSRM instances by FOSSGIS (OpenStreetMap roads, CORS enabled). Demo infrastructure: online only, no guarantee.
const PROFILES = { foot: ['routed-foot', 'foot'], car: ['routed-car', 'driving'] };
export const routeUrl = (profile, coords) => { const [host, p] = PROFILES[profile]; return `https://routing.openstreetmap.de/${host}/route/v1/${p}/${coords.map(c => c.join(',')).join(';')}?overview=full&geometries=geojson`; };

// OSRM response -> { legs: [{ d, t }], total, time, geometry } or null when no route
export function parseRoute(j) {
  const r = j?.code === 'Ok' && j.routes?.[0];
  if (!r) return null;
  return { legs: r.legs.map(l => ({ d: l.distance, t: l.duration })), total: r.distance, time: r.duration, geometry: r.geometry };
}

export function initMeasure(map, onChange) {
  const pts = []; // { ll: [lng, lat], marker }
  let legMarkers = [], profile = 'line', route = null, status = 'idle', timer, ctl;

  map.on('style.load', () => {
    map.addSource('measure', { type: 'geojson', data: lineData() });
    map.addLayer({ id: 'measure-case', type: 'line', source: 'measure', paint: { 'line-color': '#000', 'line-width': 5 } });
    map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', filter: ['==', ['get', 'kind'], 'line'], paint: { 'line-color': '#fff', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
    map.addLayer({ id: 'measure-route', type: 'line', source: 'measure', filter: ['==', ['get', 'kind'], 'route'], paint: { 'line-color': '#fff', 'line-width': 2.5 } });
  });

  function lineData() {
    const f = [];
    if (route) f.push({ type: 'Feature', properties: { kind: 'route' }, geometry: route.geometry });
    else if (pts.length > 1) f.push({ type: 'Feature', properties: { kind: 'line' }, geometry: { type: 'LineString', coordinates: pts.map(p => p.ll) } });
    return { type: 'FeatureCollection', features: f };
  }

  function render() {
    map.getSource('measure')?.setData(lineData());
    legMarkers.forEach(m => m.remove());
    const coords = pts.map(p => p.ll), straight = stats(coords);
    legMarkers = straight.legs.map((d, i) => {
      const e = document.createElement('div'); e.className = 'leg'; e.textContent = fmt(route ? route.legs[i]?.d ?? d : d);
      return new maplibregl.Marker({ element: e }).setLngLat([(coords[i][0] + coords[i + 1][0]) / 2, (coords[i][1] + coords[i + 1][1]) / 2]).addTo(map);
    });
    pts.forEach((p, i) => { p.marker.getElement().textContent = letter(i); });
    onChange({ coords, straight, route, profile, status });
  }

  // points changed: drop the stale route, fetch a new one (debounced: dragging fires many events)
  function refreshRoute() {
    clearTimeout(timer); ctl?.abort(); route = null;
    if (profile === 'line' || pts.length < 2) { status = 'idle'; return render(); }
    status = 'loading'; render();
    timer = setTimeout(async () => {
      ctl = new AbortController();
      try {
        const r = await fetch(routeUrl(profile, pts.map(p => p.ll)), { signal: ctl.signal });
        route = parseRoute(await r.json());
        status = route ? 'ok' : 'noroute';
      } catch (e) { if (e.name === 'AbortError') return; status = 'error'; }
      render();
    }, 350);
  }

  function add(ll) {
    if (pts.length >= MAX) return false;
    const e = document.createElement('div'); e.className = 'pin';
    const p = { ll: [ll.lng, ll.lat], marker: new maplibregl.Marker({ element: e, draggable: true }).setLngLat(ll).addTo(map) };
    p.marker.on('drag', () => { const c = p.marker.getLngLat(); p.ll = [c.lng, c.lat]; route = null; render(); }); // line follows the drag, route refetched on release
    p.marker.on('dragend', refreshRoute);
    pts.push(p); refreshRoute();
    return true;
  }
  return {
    add,
    undo() { pts.pop()?.marker.remove(); refreshRoute(); },
    clear() { while (pts.length) pts.pop().marker.remove(); refreshRoute(); },
    setProfile(p) { profile = p; refreshRoute(); },
    count: () => pts.length,
  };
}
