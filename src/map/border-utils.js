/**
 * border-utils.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Pure utilities for historical borders year resolution and polity metadata.
 * Environment-agnostic (runs in both browser and Node.js without DOM dependencies).
 */

/**
 * Available historical border files from aourednik/historical-basemaps.
 * Manifest of available years in public/data/borders/.
 */
export const BORDER_MANIFEST = [
  { year: -3000, file: 'world_bc3000.geojson' },
  { year: -2000, file: 'world_bc2000.geojson' },
  { year: -1500, file: 'world_bc1500.geojson' },
  { year: -1000, file: 'world_bc1000.geojson' },
  { year: -700,  file: 'world_bc700.geojson' },
  { year: -500,  file: 'world_bc500.geojson' },
  { year: -400,  file: 'world_bc400.geojson' },
  { year: -323,  file: 'world_bc323.geojson' },
  { year: -300,  file: 'world_bc300.geojson' },
  { year: -200,  file: 'world_bc200.geojson' },
  { year: -100,  file: 'world_bc100.geojson' },
  { year: -1,    file: 'world_bc1.geojson' },
];

/** Available border years sorted ascending */
export const AVAILABLE_BORDER_YEARS = BORDER_MANIFEST
  .map((entry) => entry.year)
  .sort((a, b) => a - b);

/**
 * Finds the closest available border year <= targetYear.
 * Clamps to min/max if out of range.
 * 
 * Rules (from PLAN.md T3.2):
 * - loads the GeoJSON for the closest available year <= the current timeline year.
 * 
 * @param {number} targetYear - Year on the timeline (e.g. -470)
 * @param {number[]} [availableYears=AVAILABLE_BORDER_YEARS]
 * @returns {number} The resolved border year (e.g. -500)
 */
export function findClosestBorderYear(targetYear, availableYears = AVAILABLE_BORDER_YEARS) {
  if (!availableYears || availableYears.length === 0) {
    return targetYear;
  }

  const sorted = [...availableYears].sort((a, b) => a - b);
  const minYear = sorted[0];
  const maxYear = sorted[sorted.length - 1];

  if (targetYear <= minYear) {
    return minYear;
  }
  if (targetYear >= maxYear) {
    return maxYear;
  }

  // Find greatest year in sorted that is <= targetYear
  let bestYear = minYear;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] <= targetYear) {
      bestYear = sorted[i];
    } else {
      break;
    }
  }

  return bestYear;
}

/**
 * Finds the manifest entry for a specific year.
 * @param {number} year
 * @returns {object|null}
 */
export function getManifestEntry(year) {
  return BORDER_MANIFEST.find((entry) => entry.year === year) || null;
}

/**
 * Heuristic to match a polity to civilization color palette if applicable.
 * @param {string} polityNameEn
 * @param {string} polityNameAr
 * @returns {string} HEX color code
 */
export function getPolityColor(polityNameEn, polityNameAr) {
  const en = (polityNameEn || '').toLowerCase();
  const ar = polityNameAr || '';

  // Egypt
  if (en.includes('egypt') || ar.includes('مصر') || en.includes('ptolemaic')) {
    return '#C9A227';
  }
  // Mesopotamia / Babylon / Assyria / Sumer
  if (
    en.includes('babylon') || en.includes('assyria') || en.includes('sumer') ||
    en.includes('akkad') || ar.includes('بابل') || ar.includes('آشور') || ar.includes('الرافدين')
  ) {
    return '#C86432';
  }
  // Persia / Achaemenid / Parthia
  if (
    en.includes('achaemenid') || en.includes('persia') || en.includes('parthia') ||
    ar.includes('فارس') || ar.includes('الأخمينية')
  ) {
    return '#2A7B9B';
  }
  // India / Maurya / Magadha
  if (
    en.includes('india') || en.includes('maurya') || en.includes('magadha') ||
    ar.includes('الهند') || ar.includes('موريا') || ar.includes('ماغادها')
  ) {
    return '#D97706';
  }
  // China / Zhou / Qin / Han
  if (
    en.includes('china') || en.includes('zhou') || en.includes('qin') ||
    en.includes('han') || ar.includes('الصين') || ar.includes('تشو') || ar.includes('تشين')
  ) {
    return '#B83A4B';
  }
  // Greece / Athens / Sparta / Macedonia / Seleucid
  if (
    en.includes('greece') || en.includes('macedon') || en.includes('sparta') ||
    en.includes('athens') || en.includes('seleucid') || ar.includes('اليونان') ||
    ar.includes('مقدونيا') || ar.includes('أثينا') || ar.includes('السلوقية')
  ) {
    return '#3D5A80';
  }
  // Carthage / Phoenicia
  if (en.includes('carthag') || en.includes('phoenic') || ar.includes('قرطاج') || ar.includes('فينيق')) {
    return '#9B5DE5';
  }

  // Default antique bronze / parchment tint
  return '#B5945B';
}
