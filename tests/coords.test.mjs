import test from 'node:test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseDms, decimal } from '../js/coords.js';

test('parseDms: degrees, minutes, seconds to decimal', () => {
  const [lng, lat] = parseDms(`13°45'36.0"N 100°30'18.0"E`);
  assert.ok(Math.abs(lat - 13.76) < 1e-9, String(lat));
  assert.ok(Math.abs(lng - 100.505) < 1e-9, String(lng));
});

test('parseDms: every site in the protocol parses to a point in Thailand', async () => {
  const { readFile } = await import('node:fs/promises');
  const { sites } = JSON.parse(await readFile(new URL('../protocol/' + (existsSync(new URL('../protocol/contingency.json', import.meta.url)) ? 'contingency.json' : 'contingency.example.json'), import.meta.url), 'utf8'));
  assert.ok(sites.length >= 6);
  for (const s of sites) {
    const [lng, lat] = parseDms(s.dms);
    assert.ok(lng > 97 && lng < 106 && lat > 5 && lat < 21, `${s.name}: ${lng},${lat}`);
  }
});

test('parseDms: south and west are negative, typographic quotes accepted, garbage throws', () => {
  const [lng, lat] = parseDms('10°30′00″S 20°15′00″W');
  assert.equal(lat, -10.5); assert.equal(lng, -20.25);
  assert.throws(() => parseDms('13.7, 100.5'));
});

test('decimal formats lat then lng', () => assert.equal(decimal([100.5, 13.75]), '13.75000, 100.50000'));
