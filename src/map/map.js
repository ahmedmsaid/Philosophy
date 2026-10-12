/**
 * map.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Leaflet map setup with unlabeled dark historical base tiles, sensible zoom limits,
 * and RTL-compliant controls.
 * 
 * Rules (from CONTEXT.md §2, §6.1, §6.4 and PLAN.md T3.1, T3.3):
 * - Unlabeled base layer (never modern labels with anachronistic modern borders/names).
 * - Attribution control positioned on the left (RTL).
 * - Zoom limits: minZoom 3, maxZoom 11.
 * - RTL-friendly controls and titles in Arabic.
 */

import L from 'leaflet';

// Fix default Leaflet icon paths in Vite/bundler environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

/** Default geographic center: Near East & Mediterranean cradle of ancient wisdom */
export const DEFAULT_MAP_CENTER = [29.5, 38.0];
export const DEFAULT_MAP_ZOOM = 4.5;
export const MIN_MAP_ZOOM = 2.5;
export const MAX_MAP_ZOOM = 11;

/** Unlabeled World Physical Map tile layer (Esri - public, free, purely physical, zero modern labels) */
const BASE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}';
const BASE_TILE_ATTRIBUTION = [
  'تضاريس الأرض: &copy; Esri',
  '<a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener">historical-basemaps (GPL-3.0)</a>',
].join(' · ');

let mapInstance = null;
let baseTileLayerInstance = null;
let zoomControlInstance = null;
let attributionControlInstance = null;

/**
 * Creates and initializes the Leaflet map instance.
 * @param {string|HTMLElement} container - The container id or element.
 * @param {object} [customOptions={}] - Custom Leaflet map options.
 * @returns {object} { map, baseLayer, zoomControl, attributionControl }
 */
export function createMap(container = 'map', customOptions = {}) {
  if (mapInstance) {
    console.warn('Map instance already exists. Returning current instance.');
    return {
      map: mapInstance,
      baseLayer: baseTileLayerInstance,
      zoomControl: zoomControlInstance,
      attributionControl: attributionControlInstance,
    };
  }

  const mapOptions = {
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_MAP_ZOOM,
    minZoom: MIN_MAP_ZOOM,
    maxZoom: MAX_MAP_ZOOM,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    attributionControl: false, // Custom attribution control added below on the left
    zoomControl: false,        // Custom zoom control with Arabic tooltips added below
    worldCopyJump: false,
    maxBounds: [
      [-65, -180],
      [82, 180],
    ],
    maxBoundsViscosity: 0.85,
    preferCanvas: false,
    ...customOptions,
  };

  mapInstance = L.map(container, mapOptions);

  // 1. Add unlabeled dark matter base layer
  baseTileLayerInstance = L.tileLayer(BASE_TILE_URL, {
    subdomains: 'abcd',
    maxZoom: 19,
    minZoom: MIN_MAP_ZOOM,
    attribution: BASE_TILE_ATTRIBUTION,
    detectRetina: true,
  }).addTo(mapInstance);

  // 2. Add Zoom Control on the top-left with Arabic tooltips
  zoomControlInstance = L.control.zoom({
    position: 'topleft',
    zoomInTitle: 'تكبير الخريطة',
    zoomOutTitle: 'تصغير الخريطة',
  }).addTo(mapInstance);

  // 3. Add Attribution Control on the bottom-left (as specified in PLAN T3.1)
  attributionControlInstance = L.control.attribution({
    position: 'bottomleft',
    prefix: false,
  }).addTo(mapInstance);

  // Ensure Leaflet recalculates dimensions if container rendered dynamically
  requestAnimationFrame(() => {
    mapInstance.invalidateSize();
  });

  return {
    map: mapInstance,
    baseLayer: baseTileLayerInstance,
    zoomControl: zoomControlInstance,
    attributionControl: attributionControlInstance,
  };
}

/**
 * Gets the current active map instance.
 * @returns {L.Map|null}
 */
export function getMap() {
  return mapInstance;
}

/**
 * Smoothly navigates the map to given coordinates and zoom level.
 * @param {number|number[]} lat - Latitude or [lat, lng] array
 * @param {number} [lng] - Longitude
 * @param {number} [zoom] - Zoom level
 * @param {object} [options={}] - Leaflet flyTo options
 */
export function setMapView(lat, lng, zoom, options = {}) {
  if (!mapInstance) return;

  const targetCoords = Array.isArray(lat) ? lat : [lat, lng];
  const targetZoom = typeof lat === 'number' && typeof lng === 'number' && typeof zoom === 'number'
    ? zoom
    : (typeof lat === 'object' && typeof lng === 'number' ? lng : mapInstance.getZoom());

  mapInstance.flyTo(targetCoords, targetZoom, {
    duration: 1.2,
    easeLinearity: 0.25,
    ...options,
  });
}

/**
 * Resets map view to default center and zoom.
 */
export function resetMapView() {
  if (!mapInstance) return;
  setMapView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
}
