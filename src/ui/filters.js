/**
 * filters.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Comprehensive Civilization & Thinker Kind Filters and Legend Component.
 * 
 * Rules (from CONTEXT.md §4.2, §6.4 and PLAN.md T5.4):
 * - Toggle civilizations on/off (egypt, mesopotamia, persia, india, china, greece).
 * - Toggle figure kinds on/off (philosopher, sage, religious-thinker).
 * - Legend with civilization colors and kind glyphs.
 * - Reactive two-way state and URL synchronization.
 * - Counter showing active filters count.
 */

import { store } from '../utils/state.js';
import { toArabicDigits } from '../utils/format.js';
import { DEFAULT_CIV_COLORS, KIND_GLYPHS, KIND_LABELS_AR } from '../map/markers.js';

export const CIVILIZATIONS_LIST = [
  { id: 'egypt', name_ar: 'مصر القديمة', color: DEFAULT_CIV_COLORS.egypt },
  { id: 'mesopotamia', name_ar: 'بلاد الرافدين', color: DEFAULT_CIV_COLORS.mesopotamia },
  { id: 'persia', name_ar: 'فارس القديمة', color: DEFAULT_CIV_COLORS.persia },
  { id: 'india', name_ar: 'الهند القديمة', color: DEFAULT_CIV_COLORS.india },
  { id: 'china', name_ar: 'الصين القديمة', color: DEFAULT_CIV_COLORS.china },
  { id: 'greece', name_ar: 'اليونان القديمة', color: DEFAULT_CIV_COLORS.greece },
];

export const KINDS_LIST = [
  { id: 'philosopher', name_ar: KIND_LABELS_AR.philosopher, glyph: KIND_GLYPHS.philosopher },
  { id: 'sage', name_ar: KIND_LABELS_AR.sage, glyph: KIND_GLYPHS.sage },
  { id: 'religious-thinker', name_ar: KIND_LABELS_AR['religious-thinker'], glyph: KIND_GLYPHS['religious-thinker'] },
];

export class FiltersComponent {
  /**
   * @param {HTMLElement|string} container - Mount container element or selector
   */
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error(`Filters container not found: ${container}`);
    }

    this.isOpen = false;
    this.elements = {};

    this.init();
  }

  /**
   * Initializes and renders the filters component.
   */
  init() {
    this.render();
    this.bindEvents();

    // Subscribe to state updates
    store.subscribe((state, changedKeys) => {
      if (changedKeys.includes('civs') || changedKeys.includes('kinds')) {
        this.updateActiveChips(state);
      }
    });

    this.updateActiveChips(store.getState());
  }

  /**
   * Renders the toggle button and popover dialog.
   */
  render() {
    this.container.innerHTML = `
      <div class="filters-component-wrapper" style="position: relative;">
        <!-- Toggle Button -->
        <button
          type="button"
          id="filter-toggle-btn"
          class="filters-toggle-btn"
          aria-expanded="false"
          aria-haspopup="dialog"
          aria-controls="filters-popover"
          title="تصفية الحضارات وأنواع الأعلام ودليل الرموز"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>التصفية والرموز</span>
          <span id="filters-badge" class="filters-badge-count" style="display: none;">٠</span>
        </button>

        <!-- Popover Panel -->
        <div
          id="filters-popover"
          class="filters-popover"
          role="dialog"
          aria-modal="false"
          aria-label="خيارات التصفية ودليل الحضارات"
        >
          <!-- Section 1: Civilizations -->
          <div class="filters-section">
            <div class="filters-section-title">
              <span>الحضارات والمناطق</span>
            </div>
            <div class="filters-chip-grid" role="group" aria-label="تصفية الحضارات">
              ${CIVILIZATIONS_LIST.map((civ) => `
                <button
                  type="button"
                  class="filter-chip-btn"
                  data-filter-type="civ"
                  data-filter-id="${civ.id}"
                  aria-pressed="false"
                >
                  <span class="chip-dot" style="background: ${civ.color}; box-shadow: 0 0 6px ${civ.color};"></span>
                  <span>${civ.name_ar}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Section 2: Kinds -->
          <div class="filters-section">
            <div class="filters-section-title">
              <span>تصنيف الأعلام الفكرية (دليل الرموز)</span>
            </div>
            <div class="filters-chip-grid" role="group" aria-label="تصفية أنواع الأعلام">
              ${KINDS_LIST.map((k) => `
                <button
                  type="button"
                  class="filter-chip-btn"
                  data-filter-type="kind"
                  data-filter-id="${k.id}"
                  aria-pressed="false"
                >
                  <span style="font-size: 1.1em; line-height: 1;">${k.glyph}</span>
                  <span>${k.name_ar}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Footer: Clear Button -->
          <div class="filters-footer">
            <span id="filters-status-text">جميع الحضارات والأنواع معروضة</span>
            <button type="button" id="filters-reset-btn" class="filters-reset-btn">
              إعادة الضبط
            </button>
          </div>
        </div>
      </div>
    `;

    this.elements = {
      toggleBtn: this.container.querySelector('#filter-toggle-btn'),
      popover: this.container.querySelector('#filters-popover'),
      badge: this.container.querySelector('#filters-badge'),
      resetBtn: this.container.querySelector('#filters-reset-btn'),
      statusText: this.container.querySelector('#filters-status-text'),
    };
  }

  /**
   * Binds interaction events.
   */
  bindEvents() {
    const { toggleBtn, popover, resetBtn } = this.elements;

    // Toggle popover
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePopover();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target)) {
        this.closePopover();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closePopover();
      }
    });

    // Chip click delegation
    popover.addEventListener('click', (e) => {
      const chipBtn = e.target.closest('.filter-chip-btn');
      if (!chipBtn) return;

      const filterType = chipBtn.getAttribute('data-filter-type');
      const filterId = chipBtn.getAttribute('data-filter-id');

      if (filterType === 'civ') {
        this.toggleCivFilter(filterId);
      } else if (filterType === 'kind') {
        this.toggleKindFilter(filterId);
      }
    });

    // Reset filters
    resetBtn.addEventListener('click', () => {
      store.setState({ civs: [], kinds: [] });
    });
  }

  /**
   * Toggles civilization filter.
   * @param {string} civId
   */
  toggleCivFilter(civId) {
    const currentCivs = [...(store.getState().civs || [])];
    const index = currentCivs.indexOf(civId);

    if (index > -1) {
      currentCivs.splice(index, 1);
    } else {
      currentCivs.push(civId);
    }

    store.setState({ civs: currentCivs });
  }

  /**
   * Toggles figure kind filter.
   * @param {string} kindId
   */
  toggleKindFilter(kindId) {
    const currentKinds = [...(store.getState().kinds || [])];
    const index = currentKinds.indexOf(kindId);

    if (index > -1) {
      currentKinds.splice(index, 1);
    } else {
      currentKinds.push(kindId);
    }

    store.setState({ kinds: currentKinds });
  }

  /**
   * Updates visual active states on chips and badge counter.
   * @param {object} state
   */
  updateActiveChips(state) {
    const activeCivs = new Set(state.civs || []);
    const activeKinds = new Set(state.kinds || []);

    const totalActiveFilters = activeCivs.size + activeKinds.size;

    // Update chips
    this.container.querySelectorAll('.filter-chip-btn').forEach((chip) => {
      const type = chip.getAttribute('data-filter-type');
      const id = chip.getAttribute('data-filter-id');

      let isActive = false;
      if (type === 'civ') {
        isActive = activeCivs.has(id);
      } else if (type === 'kind') {
        isActive = activeKinds.has(id);
      }

      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
    });

    // Update Badge & Toggle button state
    const { badge, toggleBtn, statusText } = this.elements;
    if (totalActiveFilters > 0) {
      badge.textContent = toArabicDigits(totalActiveFilters);
      badge.style.display = 'inline-flex';
      toggleBtn.classList.add('has-active-filters');
      statusText.textContent = `تم تفعيل ${toArabicDigits(totalActiveFilters)} تصفية`;
    } else {
      badge.style.display = 'none';
      toggleBtn.classList.remove('has-active-filters');
      statusText.textContent = 'جميع الحضارات والأنواع معروضة';
    }
  }

  /**
   * Toggles popover visibility.
   */
  togglePopover() {
    if (this.isOpen) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  /**
   * Opens popover.
   */
  openPopover() {
    this.isOpen = true;
    this.elements.popover.classList.add('is-open');
    this.elements.toggleBtn.setAttribute('aria-expanded', 'true');
  }

  /**
   * Closes popover.
   */
  closePopover() {
    this.isOpen = false;
    this.elements.popover.classList.remove('is-open');
    this.elements.toggleBtn.setAttribute('aria-expanded', 'false');
  }
}
