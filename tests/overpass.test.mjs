import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, toGeoJSON } from '../js/overpass.js';

const ring = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 0, lon: 0 }];

test('points: node, way center, skips elements with no position', () => {
  const fc = toGeoJSON([
    { type: 'node', id: 1, lat: 13.7, lon: 100.5, tags: { name: 'a' } },
    { type: 'way', id: 2, center: { lat: 1, lon: 2 } },
    { type: 'way', id: 3 },
  ], 'point');
  assert.equal(fc.features.length, 2);
  assert.deepEqual(fc.features[1].geometry.coordinates, [2, 1]);
  assert.equal(fc.features[0].properties['@type'], 'node');
});

test('closed way is a polygon only for area layers', () => {
  const el = [{ type: 'way', id: 4, geometry: ring }];
  assert.equal(toGeoJSON(el, 'area').features[0].geometry.type, 'Polygon');
  assert.equal(toGeoJSON(el, 'line').features[0].geometry.type, 'LineString');
});

test('bbox is sent as south,west,north,east', () => {
  const q = buildQuery({ kind: 'point', f: ['["a"="b"]'] }, [1, 2, 3, 4]);
  assert.ok(q.includes('nwr["a"="b"](2,1,4,3)'));
});

test('route relation becomes one coloured line per member way, clipped query', () => {
  const rel = { type: 'relation', id: 9, tags: { name: 'BTS', colour: '#75bf43' }, members: [{ type: 'way', ref: 1, geometry: ring }, { type: 'node', ref: 2 }, { type: 'way', ref: 3 }] };
  const fc = toGeoJSON([rel], 'line');
  assert.equal(fc.features.length, 1);
  assert.equal(fc.features[0].properties.colour, '#75bf43');
  const q = buildQuery({ kind: 'line', rel: true, f: ['["route"="subway"]'] }, [1, 2, 3, 4]);
  assert.ok(q.includes('rel["route"="subway"](2,1,4,3)') && q.includes('out body geom(2,1,4,3)'));
});

test('clipped geometry (null nodes) splits into runs instead of crashing', () => {
  const g = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, null, { lat: 1, lon: 1 }, { lat: 1, lon: 2 }, { lat: 2, lon: 2 }, null];
  const fc = toGeoJSON([{ type: 'way', id: 7, geometry: g }], 'area');
  assert.equal(fc.features.length, 2);
  assert.ok(fc.features.every(f => f.geometry.type === 'LineString'));
});
