/**
 * markers.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Comprehensive Marker Layer Manager with Historical Clustering,
 * Civilization Color-coding, Kind Glyphs, and RTL Arabic Tooltips.
 * 
 * Rules (from CONTEXT.md §4.2, §6.3, §6.4 and PLAN.md T5.1, T5.2):
 * - Markers shown when active range contains current year (active.from <= year <= active.to).
 * - Marker color matches civilization (from civilizations.json).
 * - Marker icon/shape per kind:
 *     - philosopher: ●
 *     - sage: 📜
 *     - religious-thinker: 🪔
 * - Clustering via Leaflet.markercluster with Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩).
 * - Hover tooltip with Arabic name and dates.
 * - Clicking marker selects figure and updates state/URL.
 */

import L from 'leaflet';
import 'leaflet.markercluster';
import { formatHistoricalYear, toArabicDigits, formatYearRange } from '../utils/format.js';
import { store } from '../utils/state.js';

/** Fallback colors for civilizations */
export const DEFAULT_CIV_COLORS = {
  egypt: '#C9A227',
  mesopotamia: '#C86432',
  persia: '#2A7B9B',
  india: '#D97706',
  china: '#B83A4B',
  greece: '#3D5A80',
};

/** Glyph / Emoji for kind */
export const KIND_GLYPHS = {
  philosopher: '●',
  sage: '📜',
  'religious-thinker': '🪔',
};

/** Arabic labels for kind */
export const KIND_LABELS_AR = {
  philosopher: 'فيلسوف',
  sage: 'حكيم / أدب الحكمة',
  'religious-thinker': 'مفكّر ديني',
};

export class MarkerLayerManager {
  /**
   * @param {L.Map} map
   * @param {object} [options={}]
   * @param {function(string): void} [options.onFigureSelect]
   */
  constructor(map, options = {}) {
    this.map = map;
    this.options = options;
    this.figures = [];
    this.civilizations = new Map();
    this.civColors = { ...DEFAULT_CIV_COLORS };

    // Marker cache: figureId -> { figure, marker }
    this.markerMap = new Map();
    this.activeFigureIds = new Set();
    this.selectedFigureId = null;

    // Initialize Leaflet MarkerClusterGroup
    this.clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 36,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      animate: true,
      iconCreateFunction: (cluster) => this.createClusterIcon(cluster),
    });

    this.map.addLayer(this.clusterGroup);
  }

  /**
   * Loads figures and civilizations datasets.
   * @returns {Promise<void>}
   */
  async loadData() {
    try {
      const baseUrl = (import.meta.env && import.meta.env.BASE_URL) || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      const [figRes, civRes] = await Promise.all([
        fetch(`${cleanBase}data/figures.json`),
        fetch(`${cleanBase}data/civilizations.json`).catch(() => null),
      ]);

      if (figRes.ok) {
        this.figures = await figRes.json();
      }

      if (civRes && civRes.ok) {
        const civList = await civRes.json();
        for (const civ of civList) {
          this.civilizations.set(civ.id, civ);
          if (civ.color) {
            this.civColors[civ.id] = civ.color;
          }
        }
      }

      console.log(`تم تحميل ${this.figures.length} شخصية في طبقة العلامات.`);
    } catch (err) {
      console.error('فشل في تحميل بيانات الشخصيات:', err);
    }
  }

  /**
   * Creates custom cluster icon using Eastern Arabic numerals.
   * @param {L.MarkerCluster} cluster
   * @returns {L.DivIcon}
   */
  createClusterIcon(cluster) {
    const count = cluster.getChildCount();
    const countArabic = toArabicDigits(count);

    let sizeClass = 'atlas-cluster-badge--sm';
    let iconSize = 36;

    if (count >= 10 && count < 50) {
      sizeClass = '';
      iconSize = 44;
    } else if (count >= 50) {
      sizeClass = 'atlas-cluster-badge--lg';
      iconSize = 52;
    }

    const html = `
      <div class="atlas-cluster-badge ${sizeClass}" title="${countArabic} أعلام فكرية نشطة هنا">
        <span>${countArabic}</span>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'atlas-cluster-icon',
      iconSize: [iconSize, iconSize],
      iconAnchor: [iconSize / 2, iconSize / 2],
    });
  }

  /**
   * Generates a custom DivIcon for an individual thinker.
   * @param {object} figure
   * @returns {L.DivIcon}
   */
  createFigureIcon(figure) {
    const kind = figure.kind || 'philosopher';
    const glyph = KIND_GLYPHS[kind] || '●';
    const civColor = this.civColors[figure.civilization] || '#d4af37';

    const isSelected = this.selectedFigureId === figure.id;
    const selectedClass = isSelected ? 'is-selected' : '';

    const html = `
      <div
        class="figure-marker-pin"
        style="--marker-civ-color: ${civColor};"
        role="button"
        aria-label="${figure.name_ar} (${KIND_LABELS_AR[kind] || ''})"
      >
        <span class="figure-marker-icon">${glyph}</span>
      </div>
    `;

    return L.divIcon({
      html,
      className: `atlas-figure-marker atlas-figure-marker--${kind} ${selectedClass}`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  }

  /**
   * Creates a Leaflet Marker instance for a figure.
   * @param {object} figure
   * @returns {L.Marker}
   */
  createMarker(figure) {
    const lat = figure.location?.lat ?? 0;
    const lng = figure.location?.lng ?? 0;

    const icon = this.createFigureIcon(figure);
    const marker = L.marker([lat, lng], {
      icon,
      riseOnHover: true,
      title: figure.name_ar,
    });

    // Hover tooltip (T5.2)
    const birthStr = figure.birth ? formatHistoricalYear(figure.birth.year, { approx: figure.birth.approx }) : '';
    const deathStr = figure.death ? formatHistoricalYear(figure.death.year, { approx: figure.death.approx }) : '';
    const datesText = birthStr && deathStr ? `${birthStr} – ${deathStr}` : (birthStr || deathStr);

    const civName = this.civilizations.get(figure.civilization)?.name_ar || '';
    const kindLabel = KIND_LABELS_AR[figure.kind] || 'مفكر';

    const tooltipContent = `
      <div class="tooltip-figure-content">
        <span class="tooltip-figure-name">${figure.name_ar}</span>
        <span class="tooltip-figure-dates">${datesText}</span>
        <span class="tooltip-figure-sub">${civName} · ${kindLabel}</span>
      </div>
    `;

    marker.bindTooltip(tooltipContent, {
      className: 'figure-hover-tooltip',
      direction: 'top',
      offset: [0, -14],
      opacity: 1,
    });

    // Click handler -> Select figure
    marker.on('click', () => {
      this.selectFigure(figure.id);
      if (this.options.onFigureSelect) {
        this.options.onFigureSelect(figure.id);
      }
    });

    return marker;
  }

  /**
   * Updates visible markers according to the current year and active filters.
   * @param {number} year
   * @param {object} [filters={}]
   * @param {string[]} [filters.civs=[]]
   * @param {string[]} [filters.kinds=[]]
   */
  update(year, filters = {}) {
    const activeCivs = Array.isArray(filters.civs) && filters.civs.length > 0 ? new Set(filters.civs) : null;
    const activeKinds = Array.isArray(filters.kinds) && filters.kinds.length > 0 ? new Set(filters.kinds) : null;

    const targetFigureIds = new Set();
    const markersToAdd = [];
    const markersToRemove = [];

    for (const fig of this.figures) {
      const from = fig.active?.from ?? fig.birth?.year ?? -3000;
      const to = fig.active?.to ?? fig.death?.year ?? 0;

      // Check year range
      const isActiveInYear = from <= year && year <= to;
      if (!isActiveInYear) continue;

      // Check civilization filter
      if (activeCivs && !activeCivs.has(fig.civilization)) continue;

      // Check kind filter
      if (activeKinds && !activeKinds.has(fig.kind)) continue;

      targetFigureIds.add(fig.id);

      if (!this.activeFigureIds.has(fig.id)) {
        // Need to add this figure
        let entry = this.markerMap.get(fig.id);
        if (!entry) {
          const marker = this.createMarker(fig);
          entry = { figure: fig, marker };
          this.markerMap.set(fig.id, entry);
        }
        markersToAdd.push(entry.marker);
      }
    }

    // Identify markers to remove
    for (const activeId of this.activeFigureIds) {
      if (!targetFigureIds.has(activeId)) {
        const entry = this.markerMap.get(activeId);
        if (entry) {
          markersToRemove.push(entry.marker);
        }
      }
    }

    // Batch add/remove from cluster group
    if (markersToRemove.length > 0) {
      this.clusterGroup.removeLayers(markersToRemove);
    }
    if (markersToAdd.length > 0) {
      this.clusterGroup.addLayers(markersToAdd);
    }

    this.activeFigureIds = targetFigureIds;
  }

  /**
   * Sets and highlights the selected figure marker.
   * @param {string|null} figureId
   */
  selectFigure(figureId) {
    if (this.selectedFigureId === figureId) return;

    const previousId = this.selectedFigureId;
    this.selectedFigureId = figureId;

    // Refresh icon of previously selected figure
    if (previousId && this.markerMap.has(previousId)) {
      const { figure, marker } = this.markerMap.get(previousId);
      marker.setIcon(this.createFigureIcon(figure));
    }

    // Refresh icon of newly selected figure
    if (figureId && this.markerMap.has(figureId)) {
      const { figure, marker } = this.markerMap.get(figureId);
      marker.setIcon(this.createFigureIcon(figure));
    }

    store.setState({ selectedFigure: figureId });
  }

  /**
   * Gets a figure by its unique identifier.
   * @param {string} figureId
   * @returns {object|null}
   */
  getFigure(figureId) {
    return this.figures.find((f) => f.id === figureId) || null;
  }

  /**
   * Returns count of currently active visible figures.
   * @returns {number}
   */
  getActiveCount() {
    return this.activeFigureIds.size;
  }

  /**
   * Destroys the layer and cleans up.
   */
  destroy() {
    if (this.clusterGroup) {
      this.clusterGroup.clearLayers();
      this.map.removeLayer(this.clusterGroup);
    }
    this.markerMap.clear();
    this.activeFigureIds.clear();
  }
}
