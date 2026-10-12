/**
 * search.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Comprehensive Arabic Search Component with Normalized Matching,
 * Autocomplete Dropdown, Keyboard Navigation, and Instant Jump.
 * 
 * Rules (from PLAN.md T5.5):
 * - Arabic search box (#search-input) with clear button (#search-clear-btn).
 * - Arabic normalization (removes tashkeel, standardizes alef, teh marbuta, etc.).
 * - Searches across name_ar, name_en, places, traditions, and tags.
 * - Selecting a result jumps the timeline to the figure's active year, flies the map,
 *   and opens the figure card.
 */

import { searchFigures } from '../utils/arabic-search.js';
import { formatHistoricalYear } from '../utils/format.js';
import { store } from '../utils/state.js';
import { setMapView } from '../map/map.js';
import { KIND_LABELS_AR, KIND_GLYPHS } from '../map/markers.js';

export class SearchComponent {
  /**
   * @param {HTMLElement|string} container - Mount container element or selector
   * @param {object} [options={}]
   * @param {function(object): void} [options.onSelect]
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error(`Search container not found: ${container}`);
    }

    this.options = options;
    this.figures = [];
    this.searchResults = [];
    this.focusedIndex = -1;
    this.isOpen = false;
    this.elements = {};

    this.init();
  }

  /**
   * Initializes and renders the search DOM.
   */
  init() {
    this.render();
    this.bindEvents();
  }

  /**
   * Sets the searchable figures collection.
   * @param {Array<object>} figures
   */
  setFigures(figures = []) {
    this.figures = figures;
  }

  /**
   * Renders the search input and autocomplete dropdown.
   */
  render() {
    this.container.innerHTML = `
      <div class="search-container" role="search">
        <div class="search-input-wrapper">
          <svg class="search-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            id="search-input"
            class="search-input"
            placeholder="ابحث عن فيلسوف أو حكيم أو مدينة..."
            autocomplete="off"
            spellcheck="false"
            aria-label="البحث عن فيلسوف أو مفكر أو حضارة"
            aria-autocomplete="list"
            aria-controls="search-dropdown-list"
          />
          <button
            type="button"
            id="search-clear-btn"
            class="search-clear-btn"
            aria-label="مسح حقل البحث"
            title="مسح"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Autocomplete Dropdown List -->
        <div
          id="search-dropdown-list"
          class="search-dropdown"
          role="listbox"
          aria-label="نتائج البحث"
        ></div>
      </div>
    `;

    this.elements = {
      input: this.container.querySelector('#search-input'),
      clearBtn: this.container.querySelector('#search-clear-btn'),
      dropdown: this.container.querySelector('#search-dropdown-list'),
    };
  }

  /**
   * Binds event listeners for input, blur, and keyboard navigation.
   */
  bindEvents() {
    const { input, clearBtn, dropdown } = this.elements;

    // Input typing
    input.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearBtn.classList.toggle('is-visible', query.length > 0);
      this.handleSearch(query);
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('is-visible');
      this.closeDropdown();
      input.focus();
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      if (!this.isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        if (input.value.trim().length > 0) {
          this.handleSearch(input.value.trim());
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = this.focusedIndex >= 0
          ? this.searchResults[this.focusedIndex]
          : this.searchResults[0];
        if (target) {
          this.selectFigure(target);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeDropdown();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Dropdown item selection
    const handleItemSelect = (e) => {
      const itemEl = e.target.closest('.search-item');
      if (!itemEl) return;
      const figureId = itemEl.getAttribute('data-figure-id');
      const figure = this.figures.find((f) => f.id === figureId);
      if (figure) {
        this.selectFigure(figure);
      }
    };

    dropdown.addEventListener('pointerdown', handleItemSelect);
    dropdown.addEventListener('click', handleItemSelect);
  }

  /**
   * Executes search and renders dropdown items.
   * @param {string} query
   */
  handleSearch(query) {
    if (!query || query.length === 0) {
      this.closeDropdown();
      return;
    }

    this.searchResults = searchFigures(this.figures, query, 8);
    this.focusedIndex = -1;
    this.renderResults(query);
  }

  /**
   * Renders search results list.
   * @param {string} query
   */
  renderResults(query) {
    const { dropdown } = this.elements;

    if (this.searchResults.length === 0) {
      dropdown.innerHTML = `
        <div class="search-no-results">
          لا توجد نتائج تطابق "${query}". جرب البحث باسم آخر أو مدينة قديمة.
        </div>
      `;
      this.openDropdown();
      return;
    }

    dropdown.innerHTML = this.searchResults.map((fig, idx) => {
      const portraitUrl = fig.image?.thumb_url || fig.image?.url;
      const initial = fig.name_ar ? fig.name_ar.charAt(0) : 'ف';
      const kindLabel = KIND_LABELS_AR[fig.kind] || 'مفكر';
      const kindGlyph = KIND_GLYPHS[fig.kind] || '●';

      const birthYear = fig.birth?.year;
      const deathYear = fig.death?.year;
      const dates = birthYear && deathYear
        ? `${formatHistoricalYear(birthYear)} – ${formatHistoricalYear(deathYear)}`
        : '';

      const place = fig.location?.place_ar || '';

      return `
        <div
          class="search-item"
          role="option"
          id="search-item-${idx}"
          data-figure-id="${fig.id}"
          tabindex="-1"
          aria-selected="false"
        >
          <div class="search-item-avatar">
            ${portraitUrl ? `
              <img src="${portraitUrl}" alt="" loading="lazy" />
            ` : `
              <span>${initial}</span>
            `}
          </div>

          <div class="search-item-info">
            <span class="search-item-name">${fig.name_ar} ${fig.name_en ? `<small style="font-weight: normal; opacity: 0.7;">(${fig.name_en})</small>` : ''}</span>
            <div class="search-item-sub">
              <span>${kindGlyph} ${kindLabel}</span>
              ${place ? `<span>· ${place}</span>` : ''}
              ${dates ? `<span>· ${dates}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.openDropdown();
  }

  /**
   * Navigates up/down in results via keyboard.
   * @param {number} direction - 1 for down, -1 for up
   */
  navigateResults(direction) {
    if (this.searchResults.length === 0) return;

    this.focusedIndex += direction;
    if (this.focusedIndex < 0) {
      this.focusedIndex = this.searchResults.length - 1;
    } else if (this.focusedIndex >= this.searchResults.length) {
      this.focusedIndex = 0;
    }

    const items = this.elements.dropdown.querySelectorAll('.search-item');
    items.forEach((item, idx) => {
      const isFocused = idx === this.focusedIndex;
      item.classList.toggle('is-focused', isFocused);
      item.setAttribute('aria-selected', String(isFocused));
      if (isFocused) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /**
   * Selects a figure, navigates map and timeline, and opens details.
   * @param {object} figure
   */
  selectFigure(figure) {
    if (!figure) return;

    this.closeDropdown();
    this.elements.input.value = figure.name_ar;
    this.elements.clearBtn.classList.add('is-visible');

    // 1. Calculate jump year: active midpoint or birth year
    const fromYear = figure.active?.from ?? figure.birth?.year ?? -3000;
    const toYear = figure.active?.to ?? figure.death?.year ?? fromYear;
    const midYear = Math.round((fromYear + toYear) / 2);

    // 2. Fly map to figure coordinates
    if (figure.location?.lat && figure.location?.lng) {
      setMapView([figure.location.lat, figure.location.lng], 6.5);
    }

    // 3. Ensure figure's civilization and kind are enabled in filters
    const state = store.getState();
    let nextCivs = state.civs;
    if (Array.isArray(state.civs) && state.civs.length > 0 && !state.civs.includes(figure.civilization)) {
      nextCivs = [...state.civs, figure.civilization];
    }
    let nextKinds = state.kinds;
    if (Array.isArray(state.kinds) && state.kinds.length > 0 && !state.kinds.includes(figure.kind)) {
      nextKinds = [...state.kinds, figure.kind];
    }

    // 4. Set timeline year and selectedFigure in store
    store.setState({
      year: midYear,
      civs: nextCivs,
      kinds: nextKinds,
      selectedFigure: figure.id,
    });

    if (this.options.onSelect) {
      this.options.onSelect(figure);
    }
  }

  /**
   * Opens autocomplete dropdown.
   */
  openDropdown() {
    this.isOpen = true;
    this.elements.dropdown.classList.add('is-open');
  }

  /**
   * Closes autocomplete dropdown.
   */
  closeDropdown() {
    this.isOpen = false;
    this.elements.dropdown.classList.remove('is-open');
    this.focusedIndex = -1;
  }
}
