import test from 'node:test';
import assert from 'node:assert/strict';
import { toAqiGeoJSON } from '../scripts/aqi.mjs';

const st = (id, lat, long, pm) => ({ stationID: id, nameEN: id, areaEN: 'x', lat: String(lat), long: String(long), AQILast: { date: '2026-10-05', time: '15:00', PM25: pm } });

test('keeps valid PM2.5 inside bbox, drops missing, negative and outside', () => {
  const fc = toAqiGeoJSON([
    st('in', 13.7, 100.5, { value: '21.5', aqi: '60' }),
    st('neg', 13.7, 100.5, { value: '-1', aqi: '-1' }),
    st('far', 8.0, 98.9, { value: '12', aqi: '40' }),
    { stationID: 'nopm', lat: '13.7', long: '100.5', AQILast: {} },
  ], [100, 13, 101, 14]);
  assert.equal(fc.features.length, 1);
  assert.equal(fc.features[0].properties.pm25, 21.5);
  assert.deepEqual(fc.features[0].geometry.coordinates, [100.5, 13.7]);
});
