import test from 'node:test';
import assert from 'node:assert/strict';
import { stats, fmt, letter, parseRoute, routeUrl, fmtTime } from '../js/measure.js';

test('stats: legs between consecutive points, total is their sum', () => {
  const s = stats([[100.5, 13.75], [100.5, 13.76], [100.51, 13.76]]);
  assert.equal(s.legs.length, 2);
  assert.ok(Math.abs(s.total - (s.legs[0] + s.legs[1])) < 1e-9);
  assert.ok(s.legs[0] > 1100 && s.legs[0] < 1120);
});

test('stats: fewer than two points has no legs', () => {
  assert.deepEqual(stats([[100, 13]]), { legs: [], total: 0 });
  assert.deepEqual(stats([]), { legs: [], total: 0 });
});

test('fmt and letter', () => {
  assert.equal(fmt(420.4), '420 m');
  assert.equal(fmt(1234), '1.23 km');
  assert.equal(fmt(15400), '15.4 km');
  assert.equal(letter(0) + letter(2), 'AC');
});

test('parseRoute: OSRM response -> legs, totals, geometry; failures -> null', () => {
  const j = { code: 'Ok', routes: [{ distance: 12834.5, duration: 1500, geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] }, legs: [{ distance: 4878.7, duration: 465.8 }, { distance: 7955.8, duration: 1034.2 }] }] };
  const r = parseRoute(j);
  assert.equal(r.legs.length, 2);
  assert.equal(r.total, 12834.5);
  assert.equal(r.geometry.coordinates.length, 2);
  assert.equal(parseRoute({ code: 'NoRoute' }), null);
  assert.equal(parseRoute(null), null);
});

test('routeUrl: lon,lat pairs joined by ; with the right profile host', () => {
  const u = routeUrl('foot', [[100.5, 13.75], [100.6, 13.8]]);
  assert.ok(u.includes('/routed-foot/route/v1/foot/100.5,13.75;100.6,13.8?'));
  assert.ok(routeUrl('car', [[1, 2], [3, 4]]).includes('/routed-car/route/v1/driving/'));
});

test('fmtTime', () => { assert.equal(fmtTime(20), '1 min'); assert.equal(fmtTime(3000), '50 min'); assert.equal(fmtTime(5400), '1 h 30 min'); });
