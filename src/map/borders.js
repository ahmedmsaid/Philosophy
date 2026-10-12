/**
 * borders.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Historical borders management using GeoJSON data from aourednik/historical-basemaps.
 * 
 * Rules (from CONTEXT.md §1.6, §2 and PLAN.md T3.2):
 * - Loads the GeoJSON for the closest available year <= the current timeline year.
 * - Styles polygons with antique atlas aesthetics (civilization hues, subtle gold borders).
 * - Shows Arabic polity labels from content/polity-names-ar.json.
 * - Unknown polity names fall back to NO label, never to English (anti-hallucination / consistency).
 * - Cross-fades between years with zero visible flash and no memory leaks.
 * - Caches loaded GeoJSON files in memory and pre-fetches neighboring years.
 */

import L from 'leaflet';
import polityNamesAr from '../../content/polity-names-ar.json' with { type: 'json' };
import {
  AVAILABLE_BORDER_YEARS,
  findClosestBorderYear,
  getManifestEntry,
  getPolityColor,
} from './border-utils.js';

export {
  AVAILABLE_BORDER_YEARS,
  findClosestBorderYear,
  getManifestEntry,
  getPolityColor,
};

/** In-memory cache for parsed GeoJSON files */
export const geoJsonCache = new Map();

/** In-flight fetch promises to prevent duplicate simultaneous requests */
const pendingFetches = new Map();

/**
 * Fetches and caches GeoJSON for a specific border year.
 * @param {number} year
 * @returns {Promise<object>} Parsed GeoJSON FeatureCollection
 */
export async function loadBorderGeoJson(year) {
  if (geoJsonCache.has(year)) {
    return geoJsonCache.get(year);
  }

  if (pendingFetches.has(year)) {
    return pendingFetches.get(year);
  }

  const entry = getManifestEntry(year);
  if (!entry) {
    throw new Error(`No border manifest entry found for year: ${year}`);
  }

  const fetchPromise = (async () => {
    try {
      const baseUrl = (import.meta.env && import.meta.env.BASE_URL) || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const url = `${cleanBase}data/borders/${entry.file}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${entry.file}: HTTP ${response.status}`);
      }
      const data = await response.json();
      geoJsonCache.set(year, data);
      return data;
    } finally {
      pendingFetches.delete(year);
    }
  })();

  pendingFetches.set(year, fetchPromise);
  return fetchPromise;
}

/**
 * Creates and manages the interactive historical borders layer on a Leaflet map.
 */
export class BorderLayerManager {
  /**
   * @param {L.Map} map - Leaflet map instance
   * @param {object} [options={}]
   * @param {function} [options.onPolityClick] - Callback when polity polygon clicked
   * @param {function} [options.onPolityHover] - Callback when polity polygon hovered
   */
  constructor(map, options = {}) {
    this.map = map;
    this.options = options;
    this.currentYear = null;
    this.currentBorderYear = null;
    this.currentLayer = null;
    this.transitionTimeout = null;
    this.isTransitioning = false;
  }

  /**
   * Resolves the Arabic name for a feature, or null if untranslated.
   * Conforms strictly to CONTEXT.md §1.6: unknown names fall back to no label, never English.
   * @param {object} feature
   * @returns {string|null}
   */
  getArabicName(feature) {
    const rawName = feature.properties && feature.properties.NAME;
    if (!rawName) return null;

    const trimmed = String(rawName).trim();
    if (polityNamesAr[trimmed]) {
      return polityNamesAr[trimmed];
    }

    return null;
  }

  /**
   * Generates styling for a GeoJSON polygon feature.
   * @param {object} feature
   * @returns {object} Leaflet path options
   */
  getPolygonStyle(feature) {
    const rawName = feature.properties && feature.properties.NAME;
    if (!rawName) {
      return {
        color: 'transparent',
        weight: 0,
        opacity: 0,
        fillColor: 'transparent',
        fillOpacity: 0,
        className: 'historical-unnamed-polygon',
        interactive: false,
      };
    }

    const arabicName = this.getArabicName(feature);
    const accentColor = getPolityColor(rawName, arabicName);
    const hasArabic = Boolean(arabicName);

    return {
      color: accentColor,
      weight: hasArabic ? 1.5 : 1.0,
      opacity: hasArabic ? 0.85 : 0.45,
      fillColor: accentColor,
      fillOpacity: hasArabic ? 0.22 : 0.08,
      dashArray: hasArabic ? null : '2, 3',
      className: 'historical-polygon',
      interactive: true,
    };
  }

  /**
   * Builds a Leaflet GeoJSON layer with tooltips and hover interactions.
   * @param {object} geoJsonData
   * @returns {L.GeoJSON}
   */
  createGeoJsonLayer(geoJsonData) {
    const layer = L.geoJSON(geoJsonData, {
      style: (feature) => this.getPolygonStyle(feature),
      onEachFeature: (feature, featureLayer) => {
        const arabicName = this.getArabicName(feature);

        // Bind interactive Arabic tooltip if translated
        if (arabicName) {
          featureLayer.bindTooltip(arabicName, {
            direction: 'center',
            sticky: true,
            className: 'polity-tooltip',
            opacity: 1,
          });
        }

        // Mouse hover micro-interactions
        featureLayer.on({
          mouseover: (e) => {
            const currentTarget = e.target;
            currentTarget.setStyle({
              weight: 2.2,
              opacity: 0.95,
              fillOpacity: 0.32,
              color: '#f3cf55',
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              currentTarget.bringToFront();
            }
            if (this.options.onPolityHover) {
              this.options.onPolityHover(arabicName, feature);
            }
          },
          mouseout: (e) => {
            layer.resetStyle(e.target);
            if (this.options.onPolityHover) {
              this.options.onPolityHover(null, null);
            }
          },
          click: (e) => {
            if (this.options.onPolityClick) {
              this.options.onPolityClick(arabicName, feature, e.latlng);
            }
          },
        });
      },
    });

    return layer;
  }

  /**
   * Updates the borders display to match the target timeline year.
   * Smoothly cross-fades without visible flashes or memory leaks.
   * 
   * @param {number} targetYear - The timeline year (e.g. -470)
   * @returns {Promise<number>} The resolved border year that is now active
   */
  async setYear(targetYear) {
    this.currentYear = targetYear;
    const borderYear = findClosestBorderYear(targetYear);

    // If already showing this exact border year, nothing to change
    if (this.currentBorderYear === borderYear && this.currentLayer) {
      return borderYear;
    }

    // Load GeoJSON data from cache or network
    const geoJsonData = await loadBorderGeoJson(borderYear);

    // If another year update superseded this one while fetching, abort
    if (findClosestBorderYear(this.currentYear) !== borderYear) {
      return this.currentBorderYear;
    }

    // Cancel any active pending transition cleanup
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }

    const nextLayer = this.createGeoJsonLayer(geoJsonData);
    const oldLayer = this.currentLayer;

    // Apply cross-fade CSS classes and add nextLayer before removing oldLayer
    const nextLayerElement = nextLayer.getPane ? this.map.getPane(nextLayer.options.pane || 'overlayPane') : null;

    nextLayer.addTo(this.map);
    this.currentLayer = nextLayer;
    this.currentBorderYear = borderYear;

    if (oldLayer) {
      // Fade out old layer smoothly over 250ms
      try {
        oldLayer.setStyle({ opacity: 0, fillOpacity: 0 });
      } catch {
        // Fallback if layer is already unmounted
      }

      this.transitionTimeout = setTimeout(() => {
        try {
          this.map.removeLayer(oldLayer);
          oldLayer.clearLayers();
        } catch {
          // ignore
        }
        this.transitionTimeout = null;
      }, 280);
    }

    // Pre-cache adjacent border years in background for instant responsiveness
    this.precacheAdjacentYears(borderYear);

    return borderYear;
  }

  /**
   * Pre-loads adjacent border years into memory cache.
   * @param {number} currentBorderYear
   */
  precacheAdjacentYears(currentBorderYear) {
    const currentIndex = AVAILABLE_BORDER_YEARS.indexOf(currentBorderYear);
    if (currentIndex === -1) return;

    const neighbors = [];
    if (currentIndex > 0) {
      neighbors.push(AVAILABLE_BORDER_YEARS[currentIndex - 1]);
    }
    if (currentIndex < AVAILABLE_BORDER_YEARS.length - 1) {
      neighbors.push(AVAILABLE_BORDER_YEARS[currentIndex + 1]);
    }

    setTimeout(() => {
      neighbors.forEach((year) => {
        if (!geoJsonCache.has(year) && !pendingFetches.has(year)) {
          loadBorderGeoJson(year).catch(() => {});
        }
      });
    }, 200);
  }

  /**
   * Cleans up all layers and listeners.
   */
  destroy() {
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
    if (this.currentLayer) {
      this.map.removeLayer(this.currentLayer);
      this.currentLayer.clearLayers();
      this.currentLayer = null;
    }
    this.currentBorderYear = null;
    this.currentYear = null;
  }
}
