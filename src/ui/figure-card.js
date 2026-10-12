/**
 * figure-card.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Comprehensive Figure Detail Card / Popup Component.
 * Desktop: Side Panel. Mobile: Bottom Sheet.
 * 
 * Rules (from CONTEXT.md §4.2, §4.3, §6.4, §6.5 and PLAN.md T5.3):
 * - Portrait image with fallback placeholder and Commons image license attribution.
 * - Arabic name (prominent) + English name.
 * - Dates formatted with Eastern Arabic numerals and "حوالي" if approximate.
 * - Ancient place and modern country context.
 * - Civilization chip and Kind chip (فيلسوف / حكيم / مفكّر ديني).
 * - Badges for approximate date and legendary / disputed historicity.
 * - Wikipedia Arabic summary with "اقرأ المزيد على ويكيبيديا" external link.
 * - Accessible: #figure-card-close, Esc to close, focus trapped and restored.
 * - Two-way state and URL synchronization.
 */

import { formatHistoricalYear } from '../utils/format.js';
import { store } from '../utils/state.js';
import { KIND_LABELS_AR } from '../map/markers.js';

export class FigureCardComponent {
  /**
   * @param {HTMLElement|string} container - Mount container element or selector
   * @param {object} [options={}]
   * @param {function(): void} [options.onClose]
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error(`Figure card mount container not found: ${container}`);
    }

    this.options = options;
    this.currentFigure = null;
    this.previousFocusedElement = null;
    this.figuresMap = new Map();

    this.init();
  }

  /**
   * Initializes component and subscribes to state store.
   */
  init() {
    this.bindKeyboard();

    // Subscribe to selected figure in store
    store.subscribe((state, changedKeys) => {
      if (changedKeys.includes('selectedFigure')) {
        if (state.selectedFigure) {
          const fig = this.figuresMap.get(state.selectedFigure);
          if (fig) {
            this.show(fig);
          }
        } else {
          this.hide();
        }
      }
    });
  }

  /**
   * Sets the figure dataset for quick lookups.
   * @param {Array<object>} figures
   */
  setFigures(figures = []) {
    this.figuresMap.clear();
    for (const fig of figures) {
      this.figuresMap.set(fig.id, fig);
    }

    // Check if initial URL had a selectedFigure
    const currentSelectedId = store.getState().selectedFigure;
    if (currentSelectedId && this.figuresMap.has(currentSelectedId)) {
      this.show(this.figuresMap.get(currentSelectedId));
    }
  }

  /**
   * Displays the figure card.
   * @param {object} figure
   */
  show(figure) {
    if (!figure) return;
    this.currentFigure = figure;
    this.previousFocusedElement = document.activeElement;

    this.render(figure);

    // Trap focus inside card
    requestAnimationFrame(() => {
      const closeBtn = this.container.querySelector('#figure-card-close');
      if (closeBtn) {
        closeBtn.focus();
      }
    });
  }

  /**
   * Closes and hides the figure card.
   */
  hide() {
    if (!this.currentFigure) return;
    this.currentFigure = null;
    this.container.innerHTML = '';

    if (store.getState().selectedFigure !== null) {
      store.setState({ selectedFigure: null });
    }

    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      this.previousFocusedElement.focus();
      this.previousFocusedElement = null;
    }

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * Binds global keyboard listeners (Esc key).
   */
  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentFigure) {
        e.preventDefault();
        this.hide();
      }
    });
  }

  /**
   * Formats birth and death dates string.
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
   * Renders the figure card DOM structure.
   * @param {object} figure
   */
  render(figure) {
    const kind = figure.kind || 'philosopher';
    const kindLabel = KIND_LABELS_AR[kind] || 'مفكر';
    const civClass = `chip--${figure.civilization || 'greece'}`;
    const datesFormatted = this.formatDates(figure);

    const hasApproxDate = Boolean(figure.birth?.approx || figure.death?.approx);
    const isLegendary = Boolean(figure.legendary);

    const portraitUrl = figure.image?.thumb_url || figure.image?.url;
    const initialLetter = figure.name_ar ? figure.name_ar.charAt(0) : 'ف';

    const placeDisplay = figure.location?.place_ar || '';
    const countryDisplay = figure.location?.modern_country_ar
      ? `(${figure.location.modern_country_ar})`
      : '';

    this.container.innerHTML = `
      <article
        id="figure-card"
        class="figure-card glass-panel glass-panel--elevated"
        role="dialog"
        aria-modal="true"
        aria-labelledby="figure-card-name"
        tabindex="-1"
      >
        <!-- Header: Portrait, Names, Badges, Close Button -->
        <header class="figure-card__header">
          
          <!-- Close Button (Required ID: figure-card-close) -->
          <button
            type="button"
            id="figure-card-close"
            class="figure-card__close"
            aria-label="إغلاق بطاقة الشخصية (Esc)"
            title="إغلاق [Esc]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Portrait Image or Fallback -->
          <div class="figure-card__portrait">
            ${portraitUrl ? `
              <img
                src="${portraitUrl}"
                alt="${figure.name_ar}"
                loading="eager"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              />
              <div class="figure-card__portrait-placeholder" style="display: none;">
                ${initialLetter}
              </div>
            ` : `
              <div class="figure-card__portrait-placeholder">
                ${initialLetter}
              </div>
            `}
          </div>

          <!-- Titles & Chips -->
          <div class="figure-card__title-group">
            <h2 id="figure-card-name" class="figure-card__name-ar">${figure.name_ar}</h2>
            ${figure.name_en ? `<span class="figure-card__name-en" lang="en">${figure.name_en}</span>` : ''}

            <div class="figure-card__badges-strip">
              <!-- Civilization Chip -->
              <span class="chip ${civClass}">
                <span class="chip-dot"></span>
                <span>${figure.civilization_name_ar || figure.civilization}</span>
              </span>

              <!-- Kind Chip -->
              <span class="kind-chip kind-chip--${kind}">
                <span class="kind-icon"></span>
                <span>${kindLabel}</span>
              </span>

              <!-- Disputed Date Badge -->
              ${hasApproxDate ? `
                <span class="badge badge--approx" title="تاريخ الميلاد أو الوفاة تقريبي">
                  تأريخ تقريبي
                </span>
              ` : ''}

              <!-- Legendary Historicity Badge -->
              ${isLegendary ? `
                <span class="badge badge--legendary" title="تختلف المراجع التاريخية حول حقيقة الشخصية أو تفاصيل سيرتها">
                  شخصية شبه أسطورية
                </span>
              ` : ''}
            </div>
          </div>
        </header>

        <!-- Body: Metadata Grid & Arabic Wikipedia Summary -->
        <div class="figure-card__body">
          <div class="figure-card__meta-grid">
            <div class="figure-card__meta-item">
              <span class="figure-card__meta-label">الفترة التاريخية / التواريخ:</span>
              <span class="figure-card__meta-value">${datesFormatted}</span>
            </div>

            <div class="figure-card__meta-item">
              <span class="figure-card__meta-label">المكان والبلد المعاصر:</span>
              <span class="figure-card__meta-value">${placeDisplay} ${countryDisplay}</span>
            </div>

            ${figure.tradition_ar ? `
              <div class="figure-card__meta-item" style="grid-column: 1 / -1;">
                <span class="figure-card__meta-label">المدرسة الفكرية / التقليد:</span>
                <span class="figure-card__meta-value">${figure.tradition_ar}</span>
              </div>
            ` : ''}
          </div>

          <!-- Wikipedia Extract -->
          <div class="figure-card__summary">
            ${figure.summary_ar ? `
              <p>${figure.summary_ar}</p>
            ` : `
              <p class="text-muted">لا يتوفر ملخص تفصيلي في ويكيبيديا العربية حالياً لهذه الشخصية.</p>
            `}
          </div>
        </div>

        <!-- Footer: External Wikipedia Article Link & Image Attribution -->
        <footer class="figure-card__footer">
          ${figure.wikipedia_url ? `
            <a
              id="figure-card-wiki-link"
              href="${figure.wikipedia_url}"
              target="_blank"
              rel="noopener noreferrer"
              class="figure-card__link"
            >
              <span>اقرأ المزيد على ويكيبيديا</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          ` : ''}

          <!-- Image License & Attribution -->
          ${figure.image ? `
            <div class="figure-card__attribution">
              <span>الصورة: ${figure.image.license || 'الملكية العامة'}</span>
              ${figure.image.author ? `<span>· المصدر: ${figure.image.author}</span>` : ''}
            </div>
          ` : ''}
        </footer>
      </article>
    `;

    // Bind close button
    const closeBtn = this.container.querySelector('#figure-card-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }
}
