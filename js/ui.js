// Sidebar (layers, themes, tools), detail + nearby panel, map controls, status.
import { GROUPS, GROUP_COLORS, LAYERS } from './config.js';
import { icon, iconify } from './icons.js';
import { nearby as findNearby, inside } from './geo.js';
import { initNearby } from './nearby.js';
import { initMeasure, letter, fmt, fmtTime } from './measure.js';

const $ = id => document.getElementById(id);
const narrow = () => matchMedia('(max-width: 640px)').matches;
const age = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min' : m < 2880 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const km = d => (d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km');
const firstCoord = c => (typeof c[0] === 'number' ? c : firstCoord(c[0]));
const isGrid = L => L.kind === 'raster' || L.kind === 'image'; // overlays have no feature count

export function initUI({ map, layers, baked, theme, onTheme, onChange }) {
  iconify();
  const say = msg => { const m = $('st-msg'); m.textContent = msg; setTimeout(() => { if (m.textContent === msg) m.textContent = ''; }, 5000); };
  const nb = initNearby(map);

  // ---- layer panel ----
  const panel = $('layers'), side = $('side'), detail = $('panel-detail');
  const rows = {}, counts = [];
  GROUPS.forEach((g, gi) => {
    const wrap = el('section', 'group');
    const head = el('button', 'group-head'); head.setAttribute('aria-expanded', 'true');
    head.style.setProperty('--c', GROUP_COLORS[gi]);
    const cnt = el('span', 'cnt'); counts[gi] = cnt;
    head.append(el('span', 'swatch'), el('span', 'label', g), cnt, icon('chevron-down'));
    head.onclick = () => { const c = wrap.dataset.collapsed !== 'true'; wrap.dataset.collapsed = c; head.setAttribute('aria-expanded', !c); };
    wrap.append(head);
    LAYERS.filter(L => L.g === gi).forEach(L => {
      const b = el('button', 'row'), c = el('span', 'c'), chip = el('span', 'chip');
      b.style.setProperty('--c', L.color);
      chip.append(icon(L.icon));
      b.append(chip, el('span', 'n', L.name), c);
      b.title = L.name;
      b.onclick = () => { layers.setOn(L, !L.on); onChange(); };
      rows[L.id] = { b, c };
      wrap.append(b);
    });
    panel.append(wrap);
  });
  panel.append(el('p', 'foot', 'Saved layers show their bake date; live ones show their fetch age. Last known state, not live truth. Military and power: public OSM data only. Low-lying ground is approximate (DEM).'));

  function update() {
    LAYERS.forEach(L => {
      const { b, c } = rows[L.id], st = layers.fs[L.id] || {};
      b.setAttribute('aria-pressed', L.on);
      b.classList.toggle('err', st.status === 'error' || st.status === 'no data');
      const gate = !baked[L.id] && L.z >= 10 && !L.static ? 'z≥' + L.z : '';
      c.textContent = !L.on ? gate : st.status || (st.at ? (isGrid(L) ? age(st.at) : `${L.data.features.length}${st.partial ? '*' : ''} · ${age(st.at)}`) : '');
      b.title = st.partial ? `${L.name}. Partial: some tiles failed to download, re-run npm run bake` : st.status === 'error' ? `${L.name}. Live fetch failed. Run npm run bake (or npm run bake:data) to save it locally` : L.name;
    });
    GROUPS.forEach((_, gi) => { const g = LAYERS.filter(L => L.g === gi), on = g.filter(L => L.on).length; counts[gi].textContent = `${on}/${g.length}`; counts[gi].classList.toggle('some', on > 0); });
    $('st-layers').textContent = `${LAYERS.filter(L => L.on).length} on`;
    drawLegend();
  }

  // legend: only for layers whose colours or sizes carry meaning
  const LEGENDS = {
    aqi: { title: 'PM2.5 ug/m3', items: [['#3fa7ff', '15 or less'], ['#3ddc84', '15 to 25'], ['#ffd23f', '25 to 37'], ['#ff9a1f', '37 to 75'], ['#ff4d4d', 'over 75']] },
    quake: { title: 'Earthquake magnitude', circles: [[3, 8], [5, 20], [7, 36]] },
    military: { ids: ['army', 'navy', 'airforce', 'ammo', 'milother', 'military', 'ammoarea'], title: 'Military (public OSM)', items: [['#ff2a1f', 'ammunition / ordnance'], ['#ff9a1f', 'army'], ['#5aa9ff', 'navy, marines'], ['#b6e3ff', 'air force'], ['#9a9a9a', 'other']] },
    lowland: { title: 'Ground height, relative (DEM)', items: [['#ff4d4d', 'lowest 10%'], ['#ff9a1f', 'next 15%'], ['#ffd23f', 'next 20%']] },
  };
  function drawLegend() {
    const box = $('legend');
    box.replaceChildren();
    Object.entries(LEGENDS).filter(([id, def]) => (def.ids || [id]).some(i => LAYERS.find(L => L.id === i).on)).forEach(([, def]) => {
      const sec = el('div', 'lg');
      sec.append(el('div', 'label', def.title));
      (def.items || []).forEach(([c, t]) => { const r = el('div', 'lgi'), sw = el('span', 'lgs'); sw.style.background = c; r.append(sw, el('span', null, t)); sec.append(r); });
      (def.circles || []).forEach(([m, d]) => { const r = el('div', 'lgi'), sw = el('span', 'lgc'); sw.style.width = sw.style.height = d + 'px'; r.append(sw, el('span', null, 'M' + m)); sec.append(r); });
      box.append(sec);
    });
    box.hidden = !box.children.length;
  }

  const btnLayers = $('btn-layers');
  const setPanel = open => { side.hidden = !open; document.body.classList.toggle('side-closed', !open); btnLayers.setAttribute('aria-expanded', open); };
  btnLayers.onclick = () => setPanel(side.hidden);
  setPanel(!narrow());

  // ---- layer tools: clear, copy link, export ----
  $('btn-clear').onclick = () => { LAYERS.filter(L => L.on).forEach(L => layers.setOn(L, false)); onChange(); };
  $('btn-link').onclick = () => navigator.clipboard.writeText(location.href).then(() => say('Link copied'), () => say('Copy failed'));
  $('btn-export').onclick = () => { // GeoJSON of every enabled layer's features inside the current view
    const b = map.getBounds(), features = [];
    LAYERS.filter(L => L.on && !isGrid(L)).forEach(L => L.data.features.forEach(f => { if (b.contains(firstCoord(f.geometry.coordinates))) features.push({ ...f, properties: { ...f.properties, layer: L.id } }); }));
    if (!features.length) return say('Nothing in view to export');
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ type: 'FeatureCollection', features })], { type: 'application/geo+json' }));
    a.download = 'hive-export.geojson'; a.click(); URL.revokeObjectURL(a.href);
    say(`Exported ${features.length} features`);
  };

  // ---- themes ----
  const themeBtns = document.querySelectorAll('[data-theme]');
  const showTheme = t => themeBtns.forEach(b => b.setAttribute('aria-checked', b.dataset.theme === t));
  themeBtns.forEach(b => b.onclick = () => { showTheme(b.dataset.theme); onTheme(b.dataset.theme); });
  showTheme(theme);

  // ---- right panel: feature detail or nearby ----
  const hideDetail = () => { detail.hidden = true; document.body.classList.remove('detail-open'); };
  const openRight = () => { detail.hidden = false; document.body.classList.add('detail-open'); if (narrow()) setPanel(false); };
  const header = (iconName, title, onClose) => {
    const head = el('div', 'detail-head'), close = el('button', 'close');
    close.setAttribute('aria-label', 'Close'); close.title = 'Close'; close.append(icon('x')); close.onclick = onClose;
    head.append(icon(iconName), el('h2', null, title), close);
    return head;
  };

  function showDetail({ L, feature }) {
    const p = feature.properties;
    detail.replaceChildren();
    const at = layers.fs[L.id]?.at;
    const kind = ['amenity', 'shop', 'railway', 'waterway', 'power', 'landuse', 'aeroway', 'leisure', 'man_made'].map(k => p[k]).find(Boolean);
    const src = typeof p['@type'] === 'string' && /^(node|way|relation)$/.test(p['@type']) ? 'OSM' : { usgs: 'USGS', air4thai: 'Air4Thai', bma: 'BMA open data', nbtc: 'NBTC open data', protocol: 'Contingency protocol' }[p['@type']] || '';
    const sub = el('div', 'detail-sub label', `${L.name}${kind ? ' · ' + kind : ''}${src ? ' · ' + src : ''}${at ? ' · ' + age(at) + ' ago' : ''}`);
    const addr = ['addr:housenumber', 'addr:street', 'addr:subdistrict', 'addr:district'].map(k => p[k]).filter(Boolean).join(' ');
    const tags = Object.entries(p).filter(([k]) => !/^(name|addr:|source|wikidata|wikipedia|@|colour|admin_level|boundary|type$|ref:)/.test(k)).slice(0, 16);
    if (addr) tags.unshift(['address', addr]);
    if (p['name:th'] && p['name:th'] !== p['name:en']) tags.unshift(['name th', p['name:th']]);
    if (L.kind === 'area' && L.keepColor) { // district: how much of each enabled point layer lies inside it
      const poly = L.data.features.find(f => f.properties['@id'] === p['@id'])?.geometry || feature.geometry;
      LAYERS.filter(M => M.on && M.kind === 'point' && M.style !== 'circle' && M.data.features.length).forEach(M => tags.push([M.name, M.data.features.filter(f => inside(f.geometry.coordinates, poly)).length]));
    }
    const kv = el('dl', 'kv');
    tags.forEach(([k, v]) => kv.append(el('dt', null, k.replace(/_/g, ' ')), el('dd', null, v)));
    detail.append(header(L.icon, p['name:en'] || p.name || L.name, hideDetail), sub);
    if (L.id === 'ammo' || L.id === 'ammoarea') detail.append(el('p', 'foot warn', 'Shown as a hazard to avoid: keep clear of restricted military land and any exclusion zone in an emergency. Public OpenStreetMap data only; the real site boundary and status may differ.'));
    detail.append(tags.length ? kv : el('p', 'detail-sub label', 'No more tags'));
    if (p['@type'] === 'protocol') {
      const link = el('a', 'detail-link');
      link.href = 'contingency.html';
      link.append(icon('external-link'), el('span', null, 'Open the contingency protocol'));
      detail.append(link);
    }
    if (/^(node|way|relation)$/.test(p['@type'])) {
      const link = el('a', 'detail-link');
      link.href = `https://www.openstreetmap.org/${p['@type']}/${p['@id']}`; link.target = '_blank'; link.rel = 'noopener';
      link.append(icon('external-link'), el('span', null, 'View on OpenStreetMap'));
      detail.append(link);
    }
    openRight();
  }

  // Nearby: straight-line nearest feature + count within 1 km for every enabled icon layer
  const closeNearby = () => { nb.clear(); hideDetail(); };
  function showNearby(ll) {
    const pt = nb.set(ll);
    const res = findNearby(pt, LAYERS.filter(L => L.on && L.kind === 'point' && L.style !== 'circle' && L.data.features.length)).sort((a, b) => a.d - b.d);
    detail.replaceChildren(header('crosshair', 'Nearby', closeNearby), el('div', 'detail-sub label', `${pt[1].toFixed(5)}, ${pt[0].toFixed(5)} · rings 500 m / 1 km`));
    if (!res.length) detail.append(el('p', 'foot', LAYERS.some(L => L.on) ? 'No icon layer has data loaded here yet. Zoom in or wait for layers to load.' : 'Switch some layers on first.'));
    res.forEach(({ L, nearest, d, within }) => {
      const r = el('button', 'nb'), chip = el('span', 'chip');
      chip.style.setProperty('--c', L.color); chip.append(icon(L.icon));
      const t = el('span', 'nbt');
      t.append(el('span', 'label', L.name), el('span', 'nbn', nearest.properties['name:en'] || nearest.properties.name || '(unnamed)'));
      r.append(chip, t, el('span', 'nbd', km(d)), el('span', 'nbc', within ? `${within} ≤1 km` : ''));
      r.onclick = () => map.easeTo({ center: nearest.geometry.coordinates, zoom: Math.max(map.getZoom(), 16) });
      detail.append(r);
    });
    detail.append(el('p', 'foot', 'Straight-line distance to features in layers that are switched on, not a walking or driving route. Check conditions on the ground.'));
    openRight();
  }

  // Distance tool: points A, B, C ... with per-leg and total straight-line distance
  let mode = null, last = { coords: [], straight: { legs: [], total: 0 }, route: null, profile: 'line', status: 'idle' }; // mode: 'nearby' | 'measure' | null
  const ms = initMeasure(map, info => { last = info; if (mode === 'measure') showMeasure(); });
  const PROFILE_LABEL = { line: 'Straight', foot: 'Walk', car: 'Drive' };
  function showMeasure() {
    const { coords, straight, route, profile, status } = last;
    detail.replaceChildren(header('ruler', 'Distance', () => setMode('measure')));
    const choose = el('div', 'mbtns three');
    Object.entries(PROFILE_LABEL).forEach(([k, label]) => {
      const b = el('button', null, label); b.setAttribute('aria-pressed', profile === k); b.onclick = () => ms.setProfile(k); choose.append(b);
    });
    detail.append(choose);
    const note = { loading: 'Finding the route…', noroute: 'No road route between these points. Showing straight line.', error: 'Routing needs a network. Showing straight line.' }[status];
    detail.append(el('div', 'detail-sub label', note || (coords.length ? `${coords.length} point${coords.length > 1 ? 's' : ''} · drag a point to move it` : 'Tap the map or a marker to add point A')));
    straight.legs.forEach((d, i) => {
      const leg = route?.legs[i], r = el('div', 'mrow');
      r.append(el('span', null, `${letter(i)} \u2192 ${letter(i + 1)}`), el('span', null, leg ? `${fmt(leg.d)} · ${fmtTime(leg.t)}` : fmt(d)));
      detail.append(r);
    });
    if (straight.legs.length) {
      const t = el('div', 'mrow total'); t.append(el('span', null, 'Total'), el('span', null, fmt(route ? route.total : straight.total))); detail.append(t);
      const w = el('div', 'mrow');
      if (route) { w.append(el('span', 'dim', profile === 'foot' ? 'Walking time' : 'Driving time'), el('span', 'dim', fmtTime(route.time))); detail.append(w); }
      else { w.append(el('span', 'dim', 'Walking at 5 km/h'), el('span', 'dim', fmtTime((straight.total / 5000) * 3600))); detail.append(w); }
      if (route) { const s = el('div', 'mrow'); s.append(el('span', 'dim', 'Straight line'), el('span', 'dim', fmt(straight.total))); detail.append(s); }
    }
    const btns = el('div', 'mbtns'), undo = el('button', null, 'Undo'), clr = el('button', null, 'Clear');
    undo.onclick = ms.undo; clr.onclick = ms.clear;
    btns.append(undo, clr);
    detail.append(btns, el('p', 'foot', route
      ? 'Route follows OpenStreetMap roads (routing.openstreetmap.de, a public demo server, online only). It does not know about flooding, closures or traffic: check conditions before relying on it.'
      : 'Straight-line distance between points, not a route along roads. Real travel is longer.'));
    openRight();
  }

  const modeBtns = { nearby: $('btn-nearby'), measure: $('btn-measure') };
  function setMode(m) {
    mode = mode === m ? null : m;
    Object.entries(modeBtns).forEach(([k, b]) => b.setAttribute('aria-pressed', mode === k));
    document.body.classList.toggle('pick-mode', !!mode);
    if (mode !== 'nearby') nb.clear();
    if (!mode) hideDetail();
    else if (mode === 'measure') showMeasure();
    else { hideDetail(); say('Tap the map to see what is nearby'); }
  }
  Object.entries(modeBtns).forEach(([k, b]) => { b.onclick = () => setMode(k); });

  map.on('click', e => {
    if (layers.clusterAt(e.point)) return;
    const h = layers.featureAt(e.point);
    if (mode === 'measure') { // snap to a marker when one is tapped
      const g = h?.feature.geometry;
      if (!ms.add(g?.type === 'Point' ? { lng: g.coordinates[0], lat: g.coordinates[1] } : e.lngLat)) say('26 points is the limit');
      return;
    }
    if (mode === 'nearby') return showNearby(e.lngLat);
    h ? showDetail(h) : hideDetail();
  });
  map.on('mousemove', e => { if (!mode) map.getCanvas().style.cursor = layers.featureAt(e.point) ? 'pointer' : ''; });

  // ---- map controls ----
  $('zoom-in').onclick = () => map.zoomIn();
  $('zoom-out').onclick = () => map.zoomOut();
  $('north').onclick = () => map.easeTo({ bearing: 0, pitch: 0 });

  // ---- status ----
  const pos = $('st-pos'), zoom = $('st-zoom');
  const showPos = () => { const c = map.getCenter(); pos.innerHTML = `<b>${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</b>`; zoom.innerHTML = `Z <b>${map.getZoom().toFixed(1)}</b>`; };
  map.on('move', showPos); showPos();

  // ---- about ----
  const about = $('about');
  $('btn-about').onclick = () => about.showModal();
  about.querySelector('.close').onclick = () => about.close();
  about.onclick = e => { if (e.target === about) about.close(); };

  update();
  return { update, say, onLocate(ll) { if (mode === 'nearby') showNearby(ll); } };
}
