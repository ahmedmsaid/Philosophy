/**
 * main.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Main application entry point: coordinates Leaflet map, historical borders,
 * interactive timeline, and central reactive store with two-way URL sync.
 */

import { createMap, setMapView } from './map/map.js';
import { BorderLayerManager } from './map/borders.js';
import { TimelineComponent } from './timeline/timeline.js';
import { store } from './utils/state.js';
import { formatHistoricalYear } from './utils/format.js';

let appState = {
  map: null,
  borderManager: null,
  timeline: null,
  store,
};

/**
 * Initializes the Atlas application.
 */
export async function initApp() {
  console.log('أطلس تاريخ الفلسفة - جاري التهيئة...');

  const initial = store.getState();

  // 1. Initialize Map with state coordinates
  const { map } = createMap('map', {
    center: initial.center,
    zoom: initial.zoom,
  });
  appState.map = map;

  // 2. Synchronize Leaflet map movements back to store (debounced URL update)
  map.on('moveend', () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    store.setState({
      center: [center.lat, center.lng],
      zoom,
    });
  });

  // 3. Initialize Border Layer Manager
  const borderManager = new BorderLayerManager(map, {
    onPolityHover: (arabicName) => {
      // Future hook for status bar or polity spotlight
    },
    onPolityClick: (arabicName, feature, latlng) => {
      console.log('Polity clicked:', arabicName || feature.properties?.NAME, latlng);
    },
  });
  appState.borderManager = borderManager;

  // 4. Load initial historical borders
  try {
    const activeBorderYear = await borderManager.setYear(initial.year);
    console.log(`تم تحميل الحدود التاريخية لعام: ${formatHistoricalYear(activeBorderYear)} (المطابق لـ ${formatHistoricalYear(initial.year)})`);
  } catch (error) {
    console.error('فشل في تحميل الحدود التاريخية الأولية:', error);
  }

  // 5. Initialize Timeline Component
  const timelineContainer = document.getElementById('timeline-container');
  if (timelineContainer) {
    appState.timeline = new TimelineComponent(timelineContainer);
  }

  // 6. Subscribe BorderManager to store year changes
  store.subscribe((state, changedKeys) => {
    if (changedKeys.includes('year')) {
      borderManager.setYear(state.year).catch((err) => {
        console.error('فشل في تحديث الحدود التاريخية:', err);
      });
    }

    // Handle programmatic map center/zoom updates (e.g. from hash navigation)
    if (changedKeys.includes('center') || changedKeys.includes('zoom')) {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const targetCenter = state.center;
      const targetZoom = state.zoom;

      const dist = Math.hypot(currentCenter.lat - targetCenter[0], currentCenter.lng - targetCenter[1]);
      const zoomDiff = Math.abs(currentZoom - targetZoom);

      if (dist > 0.05 || zoomDiff > 0.2) {
        setMapView(targetCenter, targetZoom);
      }
    }
  });

  // Expose app state for debugging and inspection
  window.__atlas = appState;

  console.log('أطلس تاريخ الفلسفة - جاهز للاستكشاف.');
  return appState;
}

// Auto-boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}
