import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePNG, decodePNG } from '../scripts/png.mjs';

test('png roundtrip keeps pixels', () => {
  const w = 3, h = 2, px = Buffer.from([
    255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0,
    10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 1,
  ]);
  const back = decodePNG(encodePNG(w, h, px));
  assert.equal(back.w, 3); assert.equal(back.h, 2); assert.equal(back.bpp, 4);
  assert.deepEqual([...back.data], [...px]);
});
