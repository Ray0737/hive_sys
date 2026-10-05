import test from 'node:test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate } from '../js/protocol.js';

const load = async () => JSON.parse(await readFile(new URL('../protocol/' + (existsSync(new URL('../protocol/contingency.json', import.meta.url)) ? 'contingency.json' : 'contingency.example.json'), import.meta.url), 'utf8'));

test('the shipped protocol passes its own shape check', async () => {
  assert.deepEqual(validate(await load()), []);
});

test('validate catches an unknown block, a ragged table row and a duplicate id', () => {
  const bad = { sites: [{}], sections: [
    { id: 'a', title: 'A', blocks: [{ type: 'bogus' }, { type: 'table', headers: ['x', 'y'], rows: [['1']] }] },
    { id: 'a', title: 'B', blocks: [] },
  ] };
  const e = validate(bad).join('|');
  assert.match(e, /unknown block type "bogus"/);
  assert.match(e, /1 cells for 2 headers/);
  assert.match(e, /duplicate section id a/);
});

test('evacuation order is preserved: go home first, secondary location second', async () => {
  const p = await load();
  const steps = p.sections.find(s => s.id === 'evacuation').blocks.find(b => b.type === 'steps').items;
  assert.equal(steps[0].title, 'Go home immediately');
  assert.equal(steps[1].title, 'Move to a secondary location');
});
