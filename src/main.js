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
import { FigurePopupComponent } from './ui/figure-popup.js';
import { FiltersComponent } from './ui/filters.js';
import { SearchComponent } from './ui/search.js';
import { IntroOverlayComponent } from './ui/intro-overlay.js';
import { AboutModalComponent } from './ui/about-modal.js';
import { store } from './utils/state.js';
import { formatHistoricalYear } from './utils/format.js';

let appState = {
  map: null,
  borderManager: null,
  markerManager: null,
  timeline: null,
  figureCard: null,
  figurePopup: null,
  filters: null,
  search: null,
  introOverlay: null,
  aboutModal: null,
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

  // 6. Initialize On-Map Figure Popup Component (PLAN T8.4)
  const figurePopup = new FigurePopupComponent(map, {
    onMore: (fig) => {
      const moreBtn = document.getElementById('figure-popup-more');
      figureCard.show(fig, moreBtn);
    },
    onClose: (closedId) => {
      if (store.getState().selectedFigure === closedId) {
        store.setState({ selectedFigure: null });
      }
    },
  });
  appState.figurePopup = figurePopup;

  // 7. Initialize Marker Layer Manager (PLAN T8.3)
  const markerManager = new MarkerLayerManager(map, {
    onFigureSelect: (figureId, marker, figure) => {
      const targetFig = figure || markerManager.getFigure(figureId);
      if (targetFig) {
        figurePopup.open(targetFig, marker);
        store.setState({ selectedFigure: figureId });
      }
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
    const fig = markerManager.getFigure(initial.selectedFigure);
    if (fig && fig.location?.lat && fig.location?.lng) {
      markerManager.selectFigure(initial.selectedFigure);
      setMapView([fig.location.lat, fig.location.lng], Math.max(initial.zoom, 6));
      setTimeout(() => {
        markerManager.zoomToShowFigure(initial.selectedFigure, (marker) => {
          figurePopup.open(fig, marker);
        });
      }, 200);
    }
  }

  // 8. Initialize Search Component
  const searchMount = document.getElementById('search-container-mount');
  if (searchMount) {
    const searchComp = new SearchComponent(searchMount, {
      onSelect: (fig) => {
        // Selection is synchronized via store.selectedFigure
      },
    });
    searchComp.setFigures(markerManager.figures);
    appState.search = searchComp;
  }

  // 9. Initialize Filters & Legend Component
  const filtersMount = document.getElementById('filters-container-mount');
  if (filtersMount) {
    appState.filters = new FiltersComponent(filtersMount);
  }

  // 10. Initialize Timeline Component
  const timelineContainer = document.getElementById('timeline-container');
  if (timelineContainer) {
    appState.timeline = new TimelineComponent(timelineContainer);
  }

  // 11. Initialize Intro Overlay & About Modal (PLAN T7.1, T7.2)
  const introMount = document.getElementById('intro-overlay-mount');
  if (introMount) {
    const introOverlay = new IntroOverlayComponent(introMount);
    appState.introOverlay = introOverlay;

    const introBtn = document.getElementById('intro-btn');
    if (introBtn) {
      introBtn.addEventListener('click', () => introOverlay.show());
    }

    // Auto-display intro overlay on first visit if no deep hash
    if (introOverlay.shouldAutoShow()) {
      introOverlay.show();
    }
  }

  const aboutMount = document.getElementById('about-modal-mount');
  if (aboutMount) {
    const aboutModal = new AboutModalComponent(aboutMount);
    appState.aboutModal = aboutModal;

    const aboutBtn = document.getElementById('about-btn');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => aboutModal.show());
    }
  }

  // 12. Subscribe managers to central store changes
  store.subscribe((state, changedKeys) => {
    // Year changes: update borders & markers
    if (changedKeys.includes('year')) {
      borderManager.setYear(state.year).catch((err) => {
        console.error('فشل في تحديث الحدود التاريخية:', err);
      });

      // T8.5: If timeline moves past active range, close popup and remove figure from URL
      if (state.selectedFigure) {
        const selectedFig = markerManager.getFigure(state.selectedFigure);
        if (selectedFig) {
          const from = selectedFig.active?.from ?? selectedFig.birth?.year ?? -3000;
          const to = selectedFig.active?.to ?? selectedFig.death?.year ?? 0;
          if (state.year < from || state.year > to) {
            figurePopup.close();
            figureCard.hide(false);
            store.setState({ selectedFigure: null });
          }
        }
      }
    }

    if (changedKeys.includes('year') || changedKeys.includes('civs') || changedKeys.includes('kinds')) {
      markerManager.update(state.year, {
        civs: state.civs,
        kinds: state.kinds,
      });
    }

    if (changedKeys.includes('selectedFigure')) {
      markerManager.selectFigure(state.selectedFigure);

      if (state.selectedFigure) {
        // If popup is already open for this exact figure (e.g. clicked directly on the map),
        // do not pan, re-zoom, or collapse clusters
        if (figurePopup.isOpen() && figurePopup.getCurrentFigure()?.id === state.selectedFigure) {
          return;
        }

        const fig = markerManager.getFigure(state.selectedFigure);
        if (fig && fig.location?.lat && fig.location?.lng) {
          const currentCenter = map.getCenter();
          const dist = Math.hypot(currentCenter.lat - fig.location.lat, currentCenter.lng - fig.location.lng);
          if (dist > 5 || map.getZoom() < 5) {
            setMapView([fig.location.lat, fig.location.lng], Math.max(map.getZoom(), 6));
          }
          try {
            markerManager.zoomToShowFigure(state.selectedFigure, (marker) => {
              figurePopup.open(fig, marker);
            });
          } catch (err) {
            console.error('[Main] zoomToShowFigure error:', err);
            figurePopup.open(fig);
          }
        } else if (fig) {
          // Figures without map coordinates (e.g. Laozi) show the full card
          figureCard.show(fig);
        }
      } else {
        if (figurePopup.isOpen()) {
          figurePopup.close();
        }
      }
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

  console.log('أطلس تاريخ الفلسفة - المرحلة 8 (المواقع الدقيقة والنوافذ المنبثقة) جاهزة للاستكشاف.');
  return appState;
}

// Auto-boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}
