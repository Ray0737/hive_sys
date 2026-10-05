import { LAYERS, DEFAULT_VIEW } from './config.js';
import { THEMES, DEFAULT_THEME } from './basemaps.js';
import { readHash, writeHash } from './state.js';
import { loadMarkers } from './icons.js';
import { createLayers } from './layers.js';
import { initUI } from './ui.js';
import { initSearch } from './search.js';

const hash = readHash();
if (hash.layers) LAYERS.forEach(L => { L.on = !L.off && hash.layers.includes(L.id); });
let theme = THEMES[hash.theme] ? hash.theme : DEFAULT_THEME;

const markers = await loadMarkers(LAYERS);
const baked = await fetch('data/manifest.json').then(r => (r.ok ? r.json() : {})).then(m => m.layers || {}).catch(() => ({})); // layers saved by `npm run bake`
const view = hash.view || DEFAULT_VIEW;
const map = new maplibregl.Map({ container: 'map', style: THEMES[theme].style, center: view.center, zoom: view.zoom, maxZoom: 19, attributionControl: { compact: true } });

const save = () => writeHash({ center: map.getCenter(), zoom: map.getZoom(), theme, layers: LAYERS.filter(L => L.on).map(L => L.id) });
let ui;
const layers = createLayers(map, markers, baked, () => theme, () => ui?.update());
ui = initUI({
  map, layers, baked, theme, onChange: save,
  onTheme: t => { theme = t; map.setStyle(THEMES[t].style, { diff: false }); save(); }, // style.load re-adds the data layers
});
initSearch(map, ui.say, ui.onLocate);
map.on('moveend', save);
