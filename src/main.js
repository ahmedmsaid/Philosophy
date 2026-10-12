/**
 * main.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Main application entry point: coordinates Leaflet map, historical borders,
 * figure markers, interactive timeline, search, filters, and figure details.
 */

import { createMap, setMapView } from './map/map.js';
import { BorderLayerManager } from './map/borders.js';
import { MarkerLayerManager } from './map/markers.js';
import { TimelineComponent } from './timeline/timeline.js';
import { FigureCardComponent } from './ui/figure-card.js';
import { FiltersComponent } from './ui/filters.js';
import { SearchComponent } from './ui/search.js';
import { store } from './utils/state.js';
import { formatHistoricalYear } from './utils/format.js';

let appState = {
  map: null,
  borderManager: null,
  markerManager: null,
  timeline: null,
  figureCard: null,
  filters: null,
  search: null,
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
      // Polity spotlight or status message
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

  // 5. Initialize Figure Card Component (Mount in #figure-card-mount)
  const figureCardMount = document.getElementById('figure-card-mount');
  const figureCard = new FigureCardComponent(figureCardMount);
  appState.figureCard = figureCard;

  // 6. Initialize Marker Layer Manager
  const markerManager = new MarkerLayerManager(map, {
    onFigureSelect: (figureId) => {
      store.setState({ selectedFigure: figureId });
    },
  });
  appState.markerManager = markerManager;

  // Load figures and populate marker layer and figure details
  await markerManager.loadData();
  figureCard.setFigures(markerManager.figures);

  // Initial marker display for current year and filters
  markerManager.update(initial.year, {
    civs: initial.civs,
    kinds: initial.kinds,
  });

  if (initial.selectedFigure) {
    markerManager.selectFigure(initial.selectedFigure);
  }

  // 7. Initialize Search Component
  const searchMount = document.getElementById('search-container-mount');
  if (searchMount) {
    const searchComp = new SearchComponent(searchMount, {
      onSelect: (fig) => {
        // Any extra callback logic
      },
    });
    searchComp.setFigures(markerManager.figures);
    appState.search = searchComp;
  }

  // 8. Initialize Filters & Legend Component
  const filtersMount = document.getElementById('filters-container-mount');
  if (filtersMount) {
    appState.filters = new FiltersComponent(filtersMount);
  }

  // 9. Initialize Timeline Component
  const timelineContainer = document.getElementById('timeline-container');
  if (timelineContainer) {
    appState.timeline = new TimelineComponent(timelineContainer);
  }

  // 10. Subscribe managers to central store changes
  store.subscribe((state, changedKeys) => {
    // Year changes: update borders & markers
    if (changedKeys.includes('year')) {
      borderManager.setYear(state.year).catch((err) => {
        console.error('فشل في تحديث الحدود التاريخية:', err);
      });
    }

    if (changedKeys.includes('year') || changedKeys.includes('civs') || changedKeys.includes('kinds')) {
      markerManager.update(state.year, {
        civs: state.civs,
        kinds: state.kinds,
      });
    }

    if (changedKeys.includes('selectedFigure')) {
      markerManager.selectFigure(state.selectedFigure);
    }

    // Programmatic map center/zoom updates (e.g. from hash navigation or search)
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

  console.log('أطلس تاريخ الفلسفة - المرحلة 5 جاهزة للاستكشاف.');
  return appState;
}

// Auto-boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}
