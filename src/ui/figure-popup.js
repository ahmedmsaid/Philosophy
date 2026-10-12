/**
 * figure-popup.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * On-map compact Leaflet popup anchored directly to thinker markers.
 * 
 * Rules (from CONTEXT §4.2, §6.3, §6.4, §6.6 and PLAN T8.4, T8.5, T8.6):
 * - Opens on marker click or keyboard activation.
 * - Shows thumbnail (if any), Arabic name, English name, dates, place, civilization chip, kind chip, badges.
 * - Button #figure-popup-more ("المزيد") opens the full figure card / bottom sheet.
 * - Button #figure-popup-close closes the popup.
 * - Synchronizes with state store (selectedFigure) and URL hash (#...&figure=socrates).
 * - Keyboard accessible: Esc closes, role="dialog", aria-label in Arabic, focus restored.
 * - Auto-pans map so popup is not covered by header or timeline controls.
 */

import L from 'leaflet';
import { formatHistoricalYear } from '../utils/format.js';
import { store } from '../utils/state.js';

export const KIND_LABELS_AR = {
  philosopher: 'فيلسوف',
  sage: 'حكيم / أدب الحكمة',
  'religious-thinker': 'مفكّر ديني',
};

export class FigurePopupComponent {
  /**
   * @param {L.Map} map - Leaflet map instance
   * @param {object} [options={}]
   * @param {function(object): void} [options.onMore] - Callback when "المزيد" is clicked
   * @param {function(string|null): void} [options.onClose] - Callback when popup is closed
   */
  constructor(map, options = {}) {
    this.map = map;
    this.options = options;
    this.currentFigure = null;
    this.currentMarker = null;
    this.popup = null;
    this.previousFocusedElement = null;

    this.init();
  }

  init() {
    this.popup = L.popup({
      className: 'atlas-figure-popup-wrapper',
      closeButton: false,
      autoPan: true,
      autoPanPaddingTopLeft: [40, 100],
      autoPanPaddingBottomRight: [40, 140],
      offset: [0, -20],
      maxWidth: 320,
      closeOnClick: false,
    });

    // Listen to popup close events from Leaflet
    this.popup.on('remove', () => {
      if (this.isOpening) return;
      if (this.currentFigure) {
        const closedId = this.currentFigure.id;
        this.currentFigure = null;
        this.currentMarker = null;

        if (this.options.onClose) {
          this.options.onClose(closedId);
        }
      }
    });

    // Global Esc handler
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        const activeCard = document.getElementById('figure-card');
        // Only close popup if the full card is not currently displayed
        if (!activeCard) {
          e.preventDefault();
          this.close();
        }
      }
    });
  }

  /**
   * Checks if popup is currently open.
   * @returns {boolean}
   */
  isOpen() {
    return Boolean(this.currentFigure && this.popup && this.popup.isOpen());
  }

  /**
   * Returns currently open figure or null.
   * @returns {object|null}
   */
  getCurrentFigure() {
    return this.currentFigure;
  }

  /**
   * Formats historical dates string for popup.
   * @param {object} figure
   * @returns {string}
   */
  formatDates(figure) {
    const birthYear = figure.birth?.year;
    const deathYear = figure.death?.year;

    const birthStr = typeof birthYear === 'number'
      ? formatHistoricalYear(birthYear, { approx: figure.birth?.approx })
      : null;
    const deathStr = typeof deathYear === 'number'
      ? formatHistoricalYear(deathYear, { approx: figure.death?.approx })
      : null;

    if (birthStr && deathStr) {
      return `${birthStr} – ${deathStr}`;
    }
    return birthStr || deathStr || 'تاريخ غير محدد بدقة';
  }

  /**
   * Generates HTML content string for the popup.
   * @param {object} figure
   * @returns {string}
   */
  createPopupContent(figure) {
    const kind = figure.kind || 'philosopher';
    const kindLabel = KIND_LABELS_AR[kind] || 'مفكر';
    const civClass = `chip--${figure.civilization || 'greece'}`;
    const civName = figure.civilization_name_ar || figure.civilization;
    const datesFormatted = this.formatDates(figure);

    const hasApproxDate = Boolean(figure.birth?.approx || figure.death?.approx);
    const isLegendary = Boolean(figure.legendary);

    const portraitUrl = figure.image?.thumb_url || figure.image?.url;
    const initialLetter = figure.name_ar ? figure.name_ar.charAt(0) : 'ف';

    const placeDisplay = figure.location?.place_ar || '';
    const countryDisplay = figure.location?.modern_country_ar
      ? `(${figure.location.modern_country_ar})`
      : '';

    return `
      <article
        class="figure-popup glass-panel"
        role="dialog"
        aria-label="${figure.name_ar}"
        tabindex="-1"
      >
        <!-- Close Button (Required ID: figure-popup-close) -->
        <button
          type="button"
          id="figure-popup-close"
          class="figure-popup__close"
          aria-label="إغلاق النافذة المنبثقة (Esc)"
          title="إغلاق [Esc]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Header: Portrait Thumbnail + Title Group -->
        <header class="figure-popup__header">
          <div class="figure-popup__portrait">
            ${portraitUrl ? `
              <img
                src="${portraitUrl}"
                alt="${figure.name_ar}"
                loading="eager"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              />
              <div class="figure-popup__portrait-placeholder" style="display: none;">
                ${initialLetter}
              </div>
            ` : `
              <div class="figure-popup__portrait-placeholder">
                ${initialLetter}
              </div>
            `}
          </div>

          <div class="figure-popup__titles">
            <h3 class="figure-popup__name-ar">${figure.name_ar}</h3>
            ${figure.name_en ? `<span class="figure-popup__name-en" lang="en">${figure.name_en}</span>` : ''}
            <div class="figure-popup__dates">${datesFormatted}</div>
          </div>
        </header>

        <!-- Place Context Row -->
        <div class="figure-popup__place-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${placeDisplay} ${countryDisplay}</span>
        </div>

        <!-- Chips & Badges -->
        <div class="figure-popup__chips">
          <span class="chip ${civClass}">
            <span class="chip-dot"></span>
            <span>${civName}</span>
          </span>

          <span class="kind-chip kind-chip--${kind}">
            <span class="kind-icon"></span>
            <span>${kindLabel}</span>
          </span>

          ${hasApproxDate ? `
            <span class="badge badge--approx" title="تاريخ الميلاد أو الوفاة تقريبي">
              تأريخ تقريبي
            </span>
          ` : ''}

          ${isLegendary ? `
            <span class="badge badge--legendary" title="تختلف المراجع التاريخية حول حقيقة الشخصية أو تفاصيل سيرتها">
              شخصية شبه أسطورية
            </span>
          ` : ''}
        </div>

        <!-- Actions: More button (Required ID: figure-popup-more) -->
        <footer class="figure-popup__actions">
          <button
            type="button"
            id="figure-popup-more"
            class="figure-popup__more-btn"
            aria-label="عرض التفاصيل الكاملة عن ${figure.name_ar}"
          >
            <span>المزيد</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </footer>
      </article>
    `;
  }

  /**
   * Opens popup anchored to figure marker or coordinates.
   * @param {object} figure
   * @param {L.Marker} [marker]
   * @param {L.LatLng|[number, number]} [latlng]
   */
  open(figure, marker = null, latlng = null) {
    this.isOpening = true;
    this.currentFigure = figure;
    this.currentMarker = marker;
    this.previousFocusedElement = document.activeElement;

    let finalLatLng = null;
    if (marker && typeof marker.getLatLng === 'function') {
      finalLatLng = marker.getLatLng();
    } else if (latlng) {
      finalLatLng = latlng;
    } else if (figure.location && typeof figure.location.lat === 'number' && typeof figure.location.lng === 'number') {
      finalLatLng = [figure.location.lat, figure.location.lng];
    }

    if (!finalLatLng) {
      this.isOpening = false;
      console.warn(`[FigurePopup] لا يمكن فتح النافذة المنبثقة للشخصية "${figure.id}" لعدم توفر إحداثيات صالحة.`);
      return;
    }

    const latVal = Array.isArray(finalLatLng) ? finalLatLng[0] : finalLatLng.lat;
    const lngVal = Array.isArray(finalLatLng) ? finalLatLng[1] : finalLatLng.lng;
    if (typeof latVal !== 'number' || typeof lngVal !== 'number') {
      this.isOpening = false;
      console.warn(`[FigurePopup] لا يمكن فتح النافذة المنبثقة للشخصية "${figure.id}" لعدم توفر إحداثيات صالحة.`);
      return;
    }

    const contentHtml = this.createPopupContent(figure);
    this.popup.setLatLng(finalLatLng).setContent(contentHtml);
    this.popup.openOn(this.map);

    // Bind popup actions after DOM insertion
    requestAnimationFrame(() => {
      this.isOpening = false;
      this.bindPopupEvents(figure);
    });
  }

  /**
   * Attaches event listeners inside the popup DOM.
   * @param {object} figure
   */
  bindPopupEvents(figure) {
    const popupEl = this.popup.getElement();
    if (!popupEl) return;

    const closeBtn = popupEl.querySelector('#figure-popup-close');
    const moreBtn = popupEl.querySelector('#figure-popup-more');

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.options.onMore) {
          this.options.onMore(figure);
        }
      });
      // Set accessible initial focus to more button
      moreBtn.focus();
    }
  }

  /**
   * Closes the active popup.
   */
  close() {
    if (this.map && this.popup) {
      this.map.closePopup(this.popup);
    }
    this.currentFigure = null;
    this.currentMarker = null;

    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      this.previousFocusedElement.focus();
      this.previousFocusedElement = null;
    }
  }
}
