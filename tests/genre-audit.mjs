import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { specs, create } = require('../dist/genre-rules.js');
const catalog = JSON.parse(readFileSync(new URL('../dist/livepilot-catalog.json', import.meta.url), 'utf8')).genres;

// Independently transcribed tempo hints and explicitly prescribed positions
// from dreamrec/LivePilot concepts/genres/*.yaml, reviewed 2026-11-04.
// Steps are zero-based sixteenth notes (beat 3 = step 8).
const source = {
  ambient: [[0, 90]],
  boom_bap: [[85, 95], { k: [0], s: [8], h: [2, 6, 10, 14] }],
  deep_minimal: [[125, 135]],
  deep_house: [[118, 124], { k: [0, 4, 8, 12], s: [4, 12], o: [2, 6, 10, 14], clap: true }],
  detroit_techno: [[128, 140]],
  disco: [[110, 125], { k: [0, 4, 8, 12], h: [2, 6, 10, 14] }],
  downtempo: [[70, 100]],
  drone: [[0, 0]],
  drum_and_bass: [[170, 180]],
  dub_techno: [[120, 130], { k: [0, 4, 8, 12] }],
  dub: [[70, 90], { k: [8], h: [4, 12] }],
  dubstep: [[138, 142], { s: [8] }],
  experimental: [[0, 0]],
  footwork: [[155, 165]],
  hip_hop: [[85, 95]],
  house: [[120, 126], { k: [0, 4, 8, 12], s: [4, 12], o: [2, 6, 10, 14], clap: true }],
  hyperpop: [[100, 160]],
  idm: [[80, 150]],
  lo_fi: [[70, 90]],
  microhouse: [[122, 128]],
  minimal_techno: [[128, 132], { k: [0, 4, 8, 12] }],
  modern_classical: [[60, 90]],
  soul: [[85, 100], { k: [0, 8], s: [4, 12] }],
  synthwave: [[85, 115]],
  techno: [[128, 140]],
  trap: [[130, 160], { s: [8] }],
  uk_garage: [[130, 140], { k: [0], s: [8] }],
};

const ids = Object.keys(source).sort();
assert.equal(ids.length, 27);
assert.deepEqual(Object.keys(specs).sort(), ids, 'Every source genre has one independent rule set');
assert.deepEqual(catalog.map(item => item.id).sort(), ids, 'Catalog matches the audited source genres');

for (const { id, tempoMin, tempoMax } of catalog) {
  const [expectedTempo, anchors = {}] = source[id];
  const spec = specs[id];
  assert.deepEqual(spec.t, expectedTempo, `${id}: source tempo hints`);
  assert.deepEqual([tempoMin, tempoMax], expectedTempo, `${id}: facts-only fallback tempo hints`);
  const grid = create(id, () => .5);
  assert.equal(grid.id, id);
  assert.equal(grid.pattern.length, 6, `${id}: six MIDI lanes`);
  assert.ok(grid.pattern.every(row => row.length === 16), `${id}: one bar of sixteenths`);
  assert.ok(grid.bpm >= 60 && grid.bpm <= 190, `${id}: valid audition tempo`);
  if (expectedTempo[0]) {
    assert.ok(grid.bpm >= expectedTempo[0] && grid.bpm <= expectedTempo[1], `${id}: BPM in LivePilot range`);
  }
  for (const [key, specKey, lane] of [['k', 'strictKick', 0], ['s', 'strictSnare', 1], ['h', 'strictHat', 2], ['o', 'strictOpenHat', 3]]) {
    assert.deepEqual(spec[specKey] || [], anchors[key] || [], `${id}: no fabricated explicit ${key} rules`);
    for (const step of anchors[key] || []) assert.ok(grid.pattern[lane][step], `${id}: mandatory ${key} at step ${step + 1}`);
  }
  if (anchors.clap) for (const step of anchors.s) {
    assert.equal(grid.pattern[1][step].pitch, 39, `${id}: clap must export GM hand-clap note 39`);
  }
  for (const row of grid.pattern) for (const hit of row) if (hit) {
    assert.ok(hit.velocity >= 1 && hit.velocity <= 127, `${id}: MIDI velocity`);
    assert.ok(hit.probability >= 0 && hit.probability <= 1, `${id}: hit probability`);
  }
}

function steps(grid, lane, minVelocity = 0) {
  return grid.pattern[lane].flatMap((hit, step) => hit && hit.velocity >= minVelocity ? [step] : []);
}
assert.deepEqual(steps(create('trap'), 1), [8], 'Trap: one snare on beat 3, never snares on 2 and 4');
assert.deepEqual(steps(create('boom_bap'), 1), [8], 'Boom Bap: source snare on beat 3');
assert.deepEqual(steps(create('uk_garage'), 1), [8], 'UK Garage: source snare on beat 3');
assert.deepEqual(steps(create('dubstep'), 1), [8], 'Dubstep: sonic identity specifies a snare on beat 3');
assert.deepEqual(steps(create('soul'), 1, 75), [4, 12], 'Soul: two main snares; ghosts stay quiet');
assert.deepEqual(steps(create('house'), 1), [4, 12], 'House: two claps, not generic snare hits');
assert.deepEqual(steps(create('house'), 3), [2, 6, 10, 14], 'House: sonic identity specifies open offbeat hats');
assert.deepEqual(steps(create('deep_house'), 1), [4, 12], 'Deep House: two claps');
assert.deepEqual(steps(create('techno'), 1), [4, 12], 'Techno: 909 clap is present; exact placement is an interpretation');
assert.deepEqual(steps(create('dub_techno'), 1), [4, 12], 'Dub Techno: a snare is present but placement is not source-prescribed');
assert.deepEqual(steps(create('dub'), 0), [8], 'Dub: kick on beat 3 (one-drop)');
assert.deepEqual(steps(create('dub'), 1), [], 'Dub source does not specify a snare');
assert.equal(create('drone').pattern.flat().filter(Boolean).length, 0, 'Drone: no automatic percussion');
assert.equal(create('modern_classical').pattern.flat().filter(Boolean).length, 0, 'Modern Classical: no invented kit beat');
assert.deepEqual(steps(create('trap'), 2).filter(step => create('trap').pattern[2][step]?.roll === 2), [13, 14, 15], 'Trap 1/32 roll approximations');

console.log('Genre audit passed: all 27 LivePilot tempos, explicit positions and key exceptions.');
