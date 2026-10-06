// Layer catalogue (context_hive.md section 7).
// Overpass layers: f = tag filters, kind = point | line | area, z = min zoom to fetch, rel = query route/boundary relations.
// Other sources: static = baked by scripts/bake-data.mjs only, feed = live GeoJSON url, kind 'raster' = live tiles, kind 'image' = baked overlay.
// style 'circle' draws data-driven circles instead of an icon marker. icon = file in assets/icons.
export const GROUPS = ['Access', 'Supply', 'Transit', 'Water', 'Safety', 'Critical infra', 'Comms', 'Hazard data', 'Boundaries', 'Military (public)', 'Contingency'];

// Marker/line colour per group on every map. Layer can override with `color`.
export const GROUP_COLORS = ['#4da3ff', '#ffd23f', '#3ddc84', '#2ee6d6', '#ff4d4d', '#ff9a1f', '#c77dff', '#ff6bd6', '#b0b0b0', '#ff9a1f', '#00e5a0'];

// Array order = map stacking order (first = bottom). Overlays and boundaries go first so markers stay clickable on top.
export const LAYERS = [
  // ---- overlays / boundaries (bottom) ----
  { id: 'lowland', g: 7, icon: 'mountain', name: 'Relatively low ground (DEM)', kind: 'image', static: true, color: '#ff9a1f' },
  { id: 'radar',   g: 7, icon: 'cloud-rain', name: 'Rain radar (RainViewer)', kind: 'raster', color: '#2ee6d6' },
  { id: 'khet',    g: 8, icon: 'land-plot', name: 'Districts (khet)', z: 8, kind: 'area', rel: true, label: 9, keepColor: true, f: ['["boundary"="administrative"]["admin_level"="6"]["name"~"^เขต"]'] },
  { id: 'khwaeng', g: 8, icon: 'grid-3x3', name: 'Sub-districts (khwaeng)', z: 12, kind: 'area', rel: true, label: 13, keepColor: true, f: ['["boundary"="administrative"]["admin_level"="8"]["name"~"^แขวง"]'] },

  // ---- Military (public OSM only): sorted into branches at bake time by js/military.js ----
  { id: 'military', g: 9, icon: 'shield', name: 'Military areas', kind: 'area', static: true, split: 'milarea', pick: 'area', z: 8, color: '#ff9a1f' },
  { id: 'ammoarea', g: 9, icon: 'bomb',   name: 'Ammunition / ordnance sites (area)', kind: 'area', static: true, split: 'milarea', pick: 'ammo', z: 8, color: '#ff2a1f' },

  // ---- Access ----
  { id: 'shelter',  g: 0, icon: 'tent',     name: 'Shelters / assembly', z: 14, f: ['["emergency"="assembly_point"]', '["amenity"="shelter"]', '["amenity"="school"]', '["leisure"="stadium"]', '["leisure"="park"]', '["amenity"="place_of_worship"]["religion"="buddhist"]'] },
  { id: 'hospital', g: 0, icon: 'hospital', name: 'Hospitals / clinics', color: '#ff4d4d', z: 12, f: ['["amenity"~"^(hospital|clinic)$"]'] },

  // ---- Supply ----
  { id: 'conv',      g: 1, icon: 'store',         name: 'Convenience stores',  z: 14, f: ['["shop"="convenience"]'] },
  { id: 'super',     g: 1, icon: 'shopping-cart', name: 'Supermarkets',        z: 13, f: ['["shop"="supermarket"]'] },
  { id: 'market',    g: 1, icon: 'carrot',        name: 'Fresh / wet markets', z: 13, f: ['["amenity"="marketplace"]'] },
  { id: 'wholesale', g: 1, icon: 'warehouse',     name: 'Food supply hubs',    z: 12, f: ['["shop"="wholesale"]', '["industrial"="cold_storage"]'] },
  { id: 'fuel',      g: 1, icon: 'fuel',          name: 'Fuel / EV charging',  z: 14, f: ['["amenity"~"^(fuel|charging_station)$"]'] },
  { id: 'pharmacy',  g: 1, icon: 'pill',          name: 'Pharmacies',          z: 14, f: ['["amenity"="pharmacy"]'] },
  { id: 'mall',      g: 1, icon: 'shopping-bag',  name: 'Shopping malls',      z: 13, f: ['["shop"="mall"]'] },
  { id: 'bank',      g: 1, icon: 'landmark',      name: 'Banks / ATMs',        z: 15, f: ['["amenity"~"^(bank|atm)$"]'] },

  // ---- Transit ----
  { id: 'station', g: 2, icon: 'train-front', name: 'Rail stations', z: 11, f: ['["railway"~"^(station|halt)$"]', '["station"~"^(subway|light_rail)$"]'] },
  { id: 'rail',    g: 2, icon: 'train-track', name: 'Rail lines (BTS MRT ARL SRT)', z: 11, kind: 'line', st: 'rail', rel: true, f: ['["route"~"^(subway|light_rail|train|monorail)$"]'] },
  { id: 'bus',     g: 2, icon: 'bus',         name: 'Bus stops',     z: 15, f: ['["highway"="bus_stop"]'] },
  { id: 'pier',    g: 2, icon: 'ship',        name: 'Boats / piers', z: 12, f: ['["amenity"="ferry_terminal"]', '["public_transport"="station"]["ferry"="yes"]', '["man_made"="pier"]["name"]'] },

  // ---- Water ----
  { id: 'waterway',  g: 3, icon: 'waves',     name: 'Rivers / canals',       z: 11, kind: 'line', st: 'water', f: ['["waterway"~"^(river|canal)$"]'] },
  { id: 'pump',      g: 3, icon: 'droplets',  name: 'Pumps / gates / works', z: 12, f: ['["man_made"~"^(pumping_station|water_works)$"]', '["waterway"~"^(sluice_gate|lock_gate)$"]'] },
  { id: 'bmapump',   g: 3, icon: 'droplets',  name: 'BMA pumping stations',  static: true },
  { id: 'floodgate', g: 3, icon: 'door-open', name: 'BMA floodgates',        static: true },

  // ---- Safety ----
  { id: 'police', g: 4, icon: 'siren', name: 'Police',        z: 13, f: ['["amenity"="police"]'] },
  { id: 'fire',   g: 4, icon: 'flame', name: 'Fire stations', z: 12, f: ['["amenity"="fire_station"]'] },

  // ---- Critical infra ----
  { id: 'power',    g: 5, icon: 'zap',    name: 'Substations',             z: 13, f: ['["power"="substation"]'] },
  { id: 'air',      g: 5, icon: 'plane',  name: 'Airports / helipads',     z: 9,  f: ['["aeroway"~"^(aerodrome|helipad)$"]'] },
  { id: 'port',     g: 5, icon: 'anchor', name: 'Ports',                   z: 11, f: ['["landuse"="port"]', '["industrial"="port"]'] },
  { id: 'bridge',   g: 5, icon: 'route',  name: 'Major bridges',           z: 12, kind: 'line', st: 'bridge', f: ['["bridge"="yes"]["highway"~"^(motorway|trunk|primary)$"]'] },

  // ---- Comms (public OSM tags: frequency shows in the detail panel where it is mapped) ----
  { id: 'radio',    g: 6, icon: 'radio-tower', name: 'Radio / TV towers',        z: 11, f: ['["tower:type"="communication"]["communication:radio"]', '["tower:type"="communication"]["communication:television"]', '["man_made"~"^(mast|tower|communications_tower)$"]["frequency"]'] },
  { id: 'fm',       g: 6, icon: 'radio',       name: 'FM radio stations (NBTC)', static: true },
  { id: 'cell',     g: 6, icon: 'signal',      name: 'Cell towers',              z: 12, f: ['["communication:mobile_phone"="yes"]'] },
  { id: 'telecom',  g: 6, icon: 'radio-tower', name: 'Data centres / comm towers', z: 13, f: ['["telecom"="data_center"]', '["man_made"="communications_tower"]'] },

  // ---- Military points ----
  { id: 'ammo',      g: 9, icon: 'bomb',         name: 'Ammunition / ordnance depots', static: true, split: 'milpts', pick: 'ammo',     color: '#ff2a1f', size: 1.4 },
  { id: 'army',      g: 9, icon: 'shield',       name: 'Army',                          static: true, split: 'milpts', pick: 'army',     color: '#ff9a1f' },
  { id: 'navy',      g: 9, icon: 'sailboat',     name: 'Navy and marines',              static: true, split: 'milpts', pick: 'navy',     color: '#5aa9ff' },
  { id: 'airforce',  g: 9, icon: 'plane-takeoff', name: 'Air force',                    static: true, split: 'milpts', pick: 'airforce', color: '#b6e3ff' },
  { id: 'milother',  g: 9, icon: 'flag',         name: 'Other (ranges, training, posts)', static: true, split: 'milpts', pick: 'other', color: '#9a9a9a' },

  // ---- Contingency: sites from protocol/contingency.json (edit that file, reload) ----
  { id: 'sites', g: 10, icon: 'map-pin', name: 'Contingency sites', feed: 'protocol/contingency.json', fallback: 'protocol/contingency.example.json', color: '#00e5a0', size: 1.25 },

  // ---- Hazard data ----
  { id: 'floodrisk', g: 7, icon: 'triangle-alert', name: 'BMA flood-risk points', static: true },
  { id: 'quake',     g: 7, icon: 'activity', name: 'Earthquakes (USGS, 7 days)', feed: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson', style: 'circle' },
  { id: 'aqi',       g: 7, icon: 'wind',     name: 'Air quality PM2.5 (Air4Thai)', static: true, live: 'api/aqi', style: 'circle' },
];

LAYERS.forEach(L => {
  L.color ||= GROUP_COLORS[L.g];
  L.kind ||= 'point';
  L.on ||= false;
  L.z ??= 0;
  L.data = { type: 'FeatureCollection', features: [] };
});

// layers that come from Overpass (scripts/bake.mjs); the rest are baked by bake-data.mjs, live feeds or live tiles
export const isOverpass = L => !L.split && !L.static && !L.feed && L.kind !== 'raster' && L.kind !== 'image';

// Download regions for scripts/bake.mjs [west, south, east, north]. Military goes nationwide (SOURCES, scope 'country').
export const REGIONS = {
  bkk:       [100.25, 13.45, 100.95, 14.10], // Bangkok + Nonthaburi, Pathum Thani, Samut Prakan buffer
  eec:       [100.75, 12.45, 102.05, 13.75], // Chonburi to Rayong (Pattaya, Sattahip, Map Ta Phut, Ban Chang)
  west:      [99.45, 12.35, 100.30, 13.50],  // Phetchaburi to Hua Hin (Cha-am, Pran Buri)
  northeast: [100.60, 14.10, 102.40, 15.35], // Saraburi, Pak Chong, Khao Yai to Nakhon Ratchasima
};
export const COUNTRY = [97.3, 5.6, 105.7, 20.5];
// the box around every region, for sources that are fetched whole (air quality, FM stations)
export const UNION = Object.values(REGIONS).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);

// Hidden Overpass queries that feed several layers (split by `pick` at bake time). "@way" / "@rel" / "@nwr" prefix picks the element type.
export const SOURCES = [
  { id: 'milpts',  kind: 'point', scope: 'country', country: 'TH', f: ['["military"]', '["landuse"="military"]'] },
  { id: 'milarea', kind: 'area', rel: true, scope: 'country', country: 'TH', f: ['@way["landuse"="military"]', '@rel["landuse"="military"]', '@way["military"~"^(airfield|naval_base|barracks|ammunition|base|training_area|range|danger_area)$"]', '@rel["military"~"^(airfield|naval_base|barracks|ammunition|base|training_area|range|danger_area)$"]'] },
];

export const DEFAULT_VIEW = { center: [100.5018, 13.7563], zoom: 12 };
