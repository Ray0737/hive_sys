import test from 'node:test';
import assert from 'node:assert/strict';
import { branchOf, ammoBasis } from '../js/military.js';

test('branchOf: tag and name rules, English and Thai', () => {
  assert.equal(branchOf({ military: 'ammunition' }), 'ammo');
  assert.equal(branchOf({ military: 'barracks', name: 'คลังแสง กองทัพบก' }), 'ammo'); // ammo wins over branch
  assert.equal(branchOf({ military: 'naval_base' }), 'navy');
  assert.equal(branchOf({ landuse: 'military', name: 'ฐานทัพเรือสัตหีบ' }), 'navy');
  assert.equal(branchOf({ military: 'airfield', operator: 'Royal Thai Navy' }), 'navy'); // navy airfield stays navy
  assert.equal(branchOf({ military: 'airfield', name: 'Don Mueang' }), 'airforce');
  assert.equal(branchOf({ name: 'กองบิน 1', military: 'base' }), 'airforce');
  assert.equal(branchOf({ military: 'barracks' }), 'army');
  assert.equal(branchOf({ landuse: 'military', operator: 'Royal Thai Army' }), 'army');
  assert.equal(branchOf({ military: 'training_area' }), 'other');
  assert.equal(branchOf({ military: 'checkpoint', name: 'Army checkpoint' }), 'other');
  assert.equal(branchOf({ military: 'office', name: 'Ordnance School' }), 'other'); // an ordnance school is not a depot
  assert.equal(branchOf({ name: 'Ordnance Department', military: 'base' }), 'other');
  assert.equal(branchOf({ name: 'Incendiary Factory Division', military: 'base' }), 'ammo');
  assert.equal(branchOf({ name: 'ศูนย์สรรพาวุธ', military: 'base' }), 'ammo');
  assert.equal(branchOf({ military: 'bunker' }), 'other');
});

test('ammoBasis tells tag matches from name matches', () => {
  assert.match(ammoBasis({ military: 'ammunition' }), /tag/);
  assert.match(ammoBasis({ name: 'Ordnance depot' }), /name/);
});
