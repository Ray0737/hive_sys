// Three basemaps. All keyless.
const OFM = 'https://tiles.openfreemap.org';

const road = (id, classes, color, w0, w1, minzoom = 0) => ({
  id, type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom,
  filter: ['all', ['in', ['get', 'class'], ['literal', classes]], ['!=', ['get', 'brunnel'], 'tunnel']],
  layout: { 'line-cap': 'butt', 'line-join': 'miter' },
  paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, w0, 18, w1] },
});
const dashed = { 'line-color': '#fff', 'line-width': 0.8, 'line-dasharray': [3, 2] };
const label = { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.5 };
const name = ['coalesce', ['get', 'name_en'], ['get', 'name']]; // ponytail: Latin labels, OFM glyph set has no reliable Thai

// Black base, thin white roads, dashed water outlines, no fills (context_hive.md section 9)
const contrast = {
  version: 8,
  glyphs: OFM + '/fonts/{fontstack}/{range}.pbf',
  sources: { omt: { type: 'vector', url: OFM + '/planet', attribution: '© OpenStreetMap contributors · OpenFreeMap' } },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#000' } },
    { id: 'water', type: 'line', source: 'omt', 'source-layer': 'water', paint: dashed },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: dashed },
    { id: 'admin', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 6], paint: { 'line-color': '#666', 'line-width': 0.8, 'line-dasharray': [1, 3] } },
    { id: 'bldg', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 15, paint: { 'line-color': '#333', 'line-width': 0.6 } },
    road('road-minor', ['minor', 'service', 'track', 'path'], '#8a8a8a', 0.3, 1, 13),
    road('road-mid', ['secondary', 'tertiary'], '#fff', 0.4, 2, 10),
    road('road-major', ['motorway', 'trunk', 'primary'], '#fff', 0.8, 3),
    { id: 'rail-base', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 10, filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': '#8a8a8a', 'line-width': 0.8, 'line-dasharray': [4, 2] } },
    { id: 'road-label', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Regular'], 'text-size': 10 }, paint: label },
    { id: 'place-label', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 8,
      layout: { 'text-field': name, 'text-font': ['Noto Sans Regular'], 'text-size': ['match', ['get', 'class'], ['city', 'town'], 14, 11], 'text-transform': 'uppercase', 'text-letter-spacing': 0.06 }, paint: label },
  ],
};

const sat = {
  version: 8,
  glyphs: OFM + '/fonts/{fontstack}/{range}.pbf', // cluster counts and labels need a glyph source
  sources: { sat: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
  layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
};

export const THEMES = {
  dark: { label: 'Dark', style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  contrast: { label: 'Contrast', style: contrast },
  sat: { label: 'Satellite', style: sat },
};
export const DEFAULT_THEME = 'contrast';
