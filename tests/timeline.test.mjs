import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_TIMELINE_YEAR,
  MAX_TIMELINE_YEAR,
  ERAS,
  yearToPercent,
  percentToYear,
  generateCenturyTicks,
  getActiveEras,
} from '../src/timeline/era-data.js';

test('yearToPercent maps -3000 to 0% and -1 to 100%', () => {
  assert.equal(yearToPercent(-3000), 0);
  assert.equal(Math.round(yearToPercent(-1)), 100);

  // Midpoint ~ -1500
  const mid = yearToPercent(-1500);
  assert.ok(mid >= 49 && mid <= 51);
});

test('percentToYear converts percent back to year accurately', () => {
  assert.equal(percentToYear(0), -3000);
  assert.equal(percentToYear(100), -1);

  const midYear = percentToYear(50);
  assert.ok(midYear >= -1505 && midYear <= -1495);
});

test('ERAS covers all required MVP civilizations and eras', () => {
  const eraIds = ERAS.map((e) => e.id);
  assert.ok(eraIds.includes('ancient-egypt'));
  assert.ok(eraIds.includes('mesopotamia'));
  assert.ok(eraIds.includes('ancient-persia'));
  assert.ok(eraIds.includes('ancient-india'));
  assert.ok(eraIds.includes('ancient-china'));
  assert.ok(eraIds.includes('presocratic'));
  assert.ok(eraIds.includes('classical-greek'));
  assert.ok(eraIds.includes('hellenistic'));

  // Ensure each era has Arabic name, color, valid center coords, and zoom
  ERAS.forEach((era) => {
    assert.ok(era.name_ar && era.name_ar.length > 0);
    assert.ok(era.color && era.color.startsWith('#'));
    assert.ok(Array.isArray(era.center) && era.center.length === 2);
    assert.ok(typeof era.zoom === 'number');
    assert.ok(era.from < era.to);
  });
});

test('getActiveEras returns correct eras for specific years', () => {
  // At -450 (Classical Greek era, Socrates)
  const erasAt450 = getActiveEras(-450);
  const ids = erasAt450.map((e) => e.id);
  assert.ok(ids.includes('classical-greek'));
  assert.ok(ids.includes('ancient-egypt'));

  // At -2500 (Old Kingdom Egypt and Mesopotamia)
  const erasAt2500 = getActiveEras(-2500);
  const ids2500 = erasAt2500.map((e) => e.id);
  assert.ok(ids2500.includes('ancient-egypt'));
  assert.ok(ids2500.includes('mesopotamia'));
  assert.ok(!ids2500.includes('classical-greek'));
});

test('generateCenturyTicks produces century and major 500-year ticks', () => {
  const ticks = generateCenturyTicks(-3000, -1);
  assert.ok(ticks.length > 25);

  const majorTicks = ticks.filter((t) => t.isMajor);
  const majorYears = majorTicks.map((t) => t.year);

  assert.ok(majorYears.includes(-3000));
  assert.ok(majorYears.includes(-2500));
  assert.ok(majorYears.includes(-2000));
  assert.ok(majorYears.includes(-1500));
  assert.ok(majorYears.includes(-1000));
  assert.ok(majorYears.includes(-500));
  assert.ok(majorYears.includes(-1));
});
