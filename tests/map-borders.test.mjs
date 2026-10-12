import test from 'node:test';
import assert from 'node:assert/strict';
import { findClosestBorderYear, AVAILABLE_BORDER_YEARS } from '../src/map/border-utils.js';
import { formatHistoricalYear, toArabicDigits, formatYearRange } from '../src/utils/format.js';

test('findClosestBorderYear resolves closest available year <= targetYear', () => {
  const years = [-3000, -2000, -1500, -1000, -700, -500, -400, -323, -300, -200, -100, -1];

  // Exact matches
  assert.equal(findClosestBorderYear(-3000, years), -3000);
  assert.equal(findClosestBorderYear(-500, years), -500);
  assert.equal(findClosestBorderYear(-1, years), -1);

  // In between matches (must pick largest year <= target)
  // Socrates (-470): -500 <= -470 < -400 -> -500
  assert.equal(findClosestBorderYear(-470, years), -500);

  // Plato (-428): -500 <= -428 < -400 -> -500
  assert.equal(findClosestBorderYear(-428, years), -500);

  // Aristotle (-384): -400 <= -384 < -323 -> -400
  assert.equal(findClosestBorderYear(-384, years), -400);

  // Alexander death (-323): exact -> -323
  assert.equal(findClosestBorderYear(-323, years), -323);

  // Epicurus (-307): -323 <= -307 < -300 -> -323
  assert.equal(findClosestBorderYear(-307, years), -323);

  // Boundary clamping
  assert.equal(findClosestBorderYear(-4000, years), -3000);
  assert.equal(findClosestBorderYear(50, years), -1);
});

test('AVAILABLE_BORDER_YEARS contains all MVP border years', () => {
  assert.ok(AVAILABLE_BORDER_YEARS.includes(-3000));
  assert.ok(AVAILABLE_BORDER_YEARS.includes(-500));
  assert.ok(AVAILABLE_BORDER_YEARS.includes(-400));
  assert.ok(AVAILABLE_BORDER_YEARS.includes(-323));
  assert.ok(AVAILABLE_BORDER_YEARS.includes(-1));
  assert.equal(AVAILABLE_BORDER_YEARS.length, 12);
});

test('toArabicDigits converts Western digits to Eastern Arabic numerals', () => {
  assert.equal(toArabicDigits('0123456789'), '٠١٢٣٤٥٦٧٨٩');
  assert.equal(toArabicDigits(-470), '-٤٧٠');
});

test('formatHistoricalYear formats BCE and CE years correctly with no thousands separators', () => {
  // BCE
  assert.equal(formatHistoricalYear(-470), '٤٧٠ ق.م');
  assert.equal(formatHistoricalYear(-3000), '٣٠٠٠ ق.م');
  assert.equal(formatHistoricalYear(-1), '١ ق.م');

  // Approx
  assert.equal(formatHistoricalYear(-470, { approx: true }), 'حوالي ٤٧٠ ق.م');

  // CE
  assert.equal(formatHistoricalYear(1200), '١٢٠٠ م');
  assert.equal(formatHistoricalYear(1), '١ م');

  // Year range
  assert.equal(formatYearRange(-470, -399), '٤٧٠ ق.م – ٣٩٩ ق.م');
});
