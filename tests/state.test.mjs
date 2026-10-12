import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeYear,
  stepYear,
  parseHashState,
  serializeHashState,
  AtlasStore,
} from '../src/utils/state.js';

test('sanitizeYear sanitizes year and skips 0', () => {
  assert.equal(sanitizeYear(-470), -470);
  assert.equal(sanitizeYear(300), 300);
  assert.equal(sanitizeYear(' -500 '), -500);
  assert.equal(sanitizeYear(0), -3000);
  assert.equal(sanitizeYear('invalid', -500), -500);
});

test('stepYear advances and rewinds correctly skipping 0', () => {
  // Negative stepping towards 0
  assert.equal(stepYear(-10, 5), -5);
  assert.equal(stepYear(-5, 5, -3000, 100), 1); // Skips 0, becomes 1!
  assert.equal(stepYear(-1, 1, -3000, 100), 1); // Skips 0 directly from -1 to 1

  // Stepping backwards across 0
  assert.equal(stepYear(1, -1), -1); // Skips 0 directly from 1 to -1
  assert.equal(stepYear(5, -5), -1); // Skips 0

  // Clamping
  assert.equal(stepYear(-2990, -50, -3000, -1), -3000);
  assert.equal(stepYear(-5, 10, -3000, -1), -1);
});

test('parseHashState correctly parses hash state', () => {
  const hash = '#year=-470&figure=socrates&z=6&ll=37.97,23.72&civs=greece,egypt&kinds=philosopher';
  const state = parseHashState(hash);

  assert.equal(state.year, -470);
  assert.equal(state.selectedFigure, 'socrates');
  assert.equal(state.zoom, 6);
  assert.deepEqual(state.center, [37.97, 23.72]);
  assert.deepEqual(state.civs, ['greece', 'egypt']);
  assert.deepEqual(state.kinds, ['philosopher']);
});

test('parseHashState handles empty or partial hashes safely', () => {
  assert.deepEqual(parseHashState(''), {});
  assert.deepEqual(parseHashState('#'), {});
  assert.deepEqual(parseHashState('#year=0'), {}); // Year 0 rejected

  const partial = parseHashState('#year=-323');
  assert.equal(partial.year, -323);
  assert.equal(partial.selectedFigure, undefined);
});

test('serializeHashState serializes state cleanly', () => {
  const state = {
    year: -470,
    selectedFigure: 'socrates',
    zoom: 6.2,
    center: [37.9715, 23.7257],
    civs: ['greece'],
    kinds: ['philosopher'],
  };

  const hash = serializeHashState(state);
  assert.ok(hash.includes('year=-470'));
  assert.ok(hash.includes('figure=socrates'));
  assert.ok(hash.includes('z=6.2'));
  assert.ok(hash.includes('ll=37.97%2C23.73') || hash.includes('ll=37.97,23.73'));
  assert.ok(hash.includes('civs=greece'));
  assert.ok(hash.includes('kinds=philosopher'));
});

test('AtlasStore handles subscription and state updates', () => {
  const store = new AtlasStore({ year: -1000 });
  let notified = false;
  let receivedYear = null;

  const unsubscribe = store.subscribe((state, changedKeys) => {
    notified = true;
    receivedYear = state.year;
    assert.ok(changedKeys.includes('year'));
  });

  store.setState({ year: -500 }, { syncUrl: false });
  assert.equal(notified, true);
  assert.equal(receivedYear, -500);

  unsubscribe();
  notified = false;
  store.setState({ year: -300 }, { syncUrl: false });
  assert.equal(notified, false);
});
