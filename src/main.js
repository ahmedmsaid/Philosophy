/**
 * main.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Main application entry point.
 */

import { createMap } from './map/map.js';
import { BorderLayerManager, findClosestBorderYear } from './map/borders.js';
import { formatHistoricalYear } from './utils/format.js';

let appState = {
  year: -3000,
  borderYear: -3000,
  map: null,
  borderManager: null,
};

/**
 * Parses initial parameters from window location hash.
 * Example: #year=-500
 */
function parseUrlState() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};

  const params = new URLSearchParams(hash);
  const result = {};

  if (params.has('year')) {
    const parsedYear = parseInt(params.get('year'), 10);
    if (!Number.isNaN(parsedYear) && parsedYear !== 0) {
      result.year = parsedYear;
    }
  }

  return result;
}

/**
 * Initializes the Atlas application.
 */
export async function initApp() {
  console.log('أطلس تاريخ الفلسفة - جاري التهيئة...');

  const initialUrlState = parseUrlState();
  const initialYear = initialUrlState.year !== undefined ? initialUrlState.year : -3000;
  appState.year = initialYear;

  // 1. Initialize Map
  const { map } = createMap('map');
  appState.map = map;

  // 2. Initialize Border Layer Manager
  const borderManager = new BorderLayerManager(map, {
    onPolityHover: (arabicName) => {
      if (arabicName) {
        // Can be used by UI components to show current polity in status bar
      }
    },
    onPolityClick: (arabicName, feature, latlng) => {
      console.log('Polity clicked:', arabicName || feature.properties?.NAME, latlng);
    },
  });
  appState.borderManager = borderManager;

  // 3. Load initial historical borders
  try {
    const activeBorderYear = await borderManager.setYear(initialYear);
    appState.borderYear = activeBorderYear;
    console.log(`تم تحميل الحدود التاريخية لعام: ${formatHistoricalYear(activeBorderYear)} (المطابق لـ ${formatHistoricalYear(initialYear)})`);
  } catch (error) {
    console.error('فشل في تحميل الحدود التاريخية الأولية:', error);
  }

  // Expose app state for debugging and inspection
  window.__atlas = appState;

  // 4. Listen for URL hash changes (e.g. #year=-323)
  window.addEventListener('hashchange', async () => {
    const newState = parseUrlState();
    if (newState.year !== undefined && newState.year !== appState.year) {
      await setAppYear(newState.year);
    }
  });

  console.log('أطلس تاريخ الفلسفة - جاهز للاستكشاف.');
  return appState;
}

/**
 * Updates application timeline year and synchronizes borders and URL.
 * @param {number} newYear
 */
export async function setAppYear(newYear) {
  if (typeof newYear !== 'number' || Number.isNaN(newYear) || newYear === 0) return;
  appState.year = newYear;

  if (appState.borderManager) {
    try {
      const activeBorderYear = await appState.borderManager.setYear(newYear);
      appState.borderYear = activeBorderYear;
      console.log(`تم تحديث الحدود التاريخية لعام: ${formatHistoricalYear(activeBorderYear)}`);
    } catch (err) {
      console.error('فشل في تحديث الحدود التاريخية:', err);
    }
  }

  // Update hash without triggering redundant hashchange reload
  const currentParams = parseUrlState();
  if (currentParams.year !== newYear) {
    window.location.hash = `#year=${newYear}`;
  }
}

// Auto-boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}
