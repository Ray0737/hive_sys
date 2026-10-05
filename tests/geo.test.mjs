import test from 'node:test';
import assert from 'node:assert/strict';
import { dist, circle, inside, nearby } from '../js/geo.js';
import { stitch, toGeoJSON, buildQuery } from '../js/overpass.js';

test('dist: 0.01 deg of latitude is about 1.11 km', () => {
  const d = dist([100.5, 13.75], [100.5, 13.76]);
  assert.ok(d > 1100 && d < 1120, String(d));
});

test('circle points sit r metres from the centre and ring is closed', () => {
  const c = [100.5, 13.75], ring = circle(c, 500);
  assert.deepEqual(ring[0], ring.at(-1));
  assert.ok(ring.every(p => Math.abs(dist(c, p) - 500) < 2));
});

test('inside: square polygon', () => {
  const sq = { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
  assert.ok(inside([1, 1], sq));
  assert.ok(!inside([3, 1], sq));
});

test('nearby: nearest and count within radius', () => {
  const L = { data: { features: [{ geometry: { coordinates: [100.5, 13.751] } }, { geometry: { coordinates: [100.5, 13.80] } }] } };
  const [r] = nearby([100.5, 13.75], [L], 1000);
  assert.equal(r.within, 1);
  assert.ok(r.d > 100 && r.d < 120);
});

test('stitch joins unordered, reversed segments into one closed ring', () => {
  const rings = stitch([[[0, 0], [1, 0]], [[1, 1], [1, 0]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]]);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 5);
  assert.deepEqual(rings[0][0], rings[0].at(-1));
});

test('boundary relation becomes a Polygon; area relation query is not clipped', () => {
  const g = pts => pts.map(([lon, lat]) => ({ lon, lat }));
  const rel = { type: 'relation', id: 5, tags: { name: 'เขต x' }, members: [
    { type: 'way', role: 'outer', geometry: g([[0, 0], [1, 0], [1, 1]]) },
    { type: 'way', role: 'outer', geometry: g([[1, 1], [0, 1], [0, 0]]) },
  ] };
  const f = toGeoJSON([rel], 'area').features[0];
  assert.equal(f.geometry.type, 'Polygon');
  const q = buildQuery({ kind: 'area', rel: true, f: ['["boundary"="administrative"]'] }, [1, 2, 3, 4]);
  assert.ok(q.includes('out body geom ') && !q.includes('geom('));
});

test('country filter limits a query to the country polygon', () => {
  const q = buildQuery({ kind: 'point', country: 'TH', f: ['["military"]'] }, [1, 2, 3, 4]);
  assert.ok(q.includes('area["ISO3166-1"="TH"]["admin_level"="2"]->.a;'));
  assert.ok(q.includes('nwr["military"](area.a)(2,1,4,3)'));
});
