// Pin + 500 m / 1 km rings for the Nearby panel. Survives basemap changes (re-added on style.load).
import { circle } from './geo.js';

export function initNearby(map) {
  let at = null;
  const data = () => ({
    type: 'FeatureCollection',
    features: at ? [
      ...[500, 1000].map(r => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: circle(at, r) } })),
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: at } },
    ] : [],
  });
  map.on('style.load', () => {
    map.addSource('nearby', { type: 'geojson', data: data() });
    map.addLayer({ id: 'nearby-ring', type: 'line', source: 'nearby', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#fff', 'line-width': 1, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: 'nearby-pin', type: 'circle', source: 'nearby', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#000', 'circle-stroke-width': 2 } });
  });
  const draw = () => map.getSource('nearby')?.setData(data());
  return {
    set(ll) { at = [ll.lng, ll.lat]; draw(); return at; },
    clear() { at = null; draw(); },
  };
}
