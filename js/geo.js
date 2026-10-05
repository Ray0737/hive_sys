// Small geo helpers for the Nearby panel and district counts. Pure, so tests can import them in node.
const R = 6371000;
const rad = Math.PI / 180;

// metres between two [lng, lat] points
export function dist(a, b) {
  const dLat = (b[1] - a[1]) * rad, dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ring of n points, r metres around [lng, lat]
export function circle([lng, lat], r, n = 64) {
  const dLat = r / R / rad, dLng = dLat / Math.cos(lat * rad);
  const co = Array.from({ length: n }, (_, i) => [lng + dLng * Math.cos((i / n) * 2 * Math.PI), lat + dLat * Math.sin((i / n) * 2 * Math.PI)]);
  return [...co, co[0]];
}

// ray casting; polygon = GeoJSON Polygon or MultiPolygon geometry (holes ignored, like the boundary data)
export function inside(pt, geom) {
  const rings = geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.type === 'MultiPolygon' ? geom.coordinates.map(p => p[0]) : [];
  return rings.some(r => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
    }
    return c;
  });
}

// For each point layer: nearest feature, and how many lie within `radius` metres. Straight-line, not a route.
export function nearby(pt, layers, radius = 1000) {
  const out = [];
  for (const L of layers) {
    let best = null, within = 0;
    for (const f of L.data.features) {
      const d = dist(pt, f.geometry.coordinates);
      if (d <= radius) within++;
      if (!best || d < best.d) best = { f, d };
    }
    if (best) out.push({ L, nearest: best.f, d: best.d, within });
  }
  return out;
}
