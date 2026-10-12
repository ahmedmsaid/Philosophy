/**
 * state.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Central reactive application state and two-way URL hash synchronizer.
 * 
 * Rules (from CONTEXT.md §4.1, §6.2 and PLAN.md T4.4):
 * - One central store: year, selectedFigure, filters (civilizations, kinds), map view (lat, lng, zoom).
 * - Synchronized with URL hash: #year=-470&figure=socrates&z=6&ll=37.9,23.7
 * - Years are integers, negative = BCE, positive = CE, NO year 0.
 * - Sharing or reloading the URL restores the exact state.
 */

/**
 * Validates and sanitizes a year integer.
 * Ensures year is a valid number and skips 0.
 * @param {number} year
 * @param {number} [fallback=-3000]
 * @returns {number}
 */
export function sanitizeYear(year, fallback = -3000) {
  const num = parseInt(year, 10);
  if (Number.isNaN(num) || num === 0) {
    return fallback;
  }
  return num;
}

/**
 * Advances or rewinds a year by a step amount, strictly skipping year 0.
 * @param {number} currentYear
 * @param {number} step - Positive advances towards newer dates (e.g. +10), negative towards older (e.g. -10)
 * @param {number} [minYear=-3000]
 * @param {number} [maxYear=-1]
 * @returns {number}
 */
export function stepYear(currentYear, step, minYear = -3000, maxYear = -1) {
  let next = currentYear + step;

  // Handle transition across 0 (skip 0)
  if (currentYear < 0 && next >= 0) {
    next = next === 0 ? 1 : next;
  } else if (currentYear > 0 && next <= 0) {
    next = next === 0 ? -1 : next;
  }

  // Clamp within bounds
  if (next < minYear) next = minYear;
  if (next > maxYear) next = maxYear;

  // Final sanity check for 0
  if (next === 0) {
    next = step > 0 ? 1 : -1;
  }

  return next;
}

/**
 * Parses URL hash into a structured state object.
 * Format: #year=-470&figure=socrates&z=6&ll=37.9,23.7&civs=greece,egypt&kinds=philosopher
 * @param {string} [hashString]
 * @returns {object}
 */
export function parseHashState(hashString) {
  const raw = hashString !== undefined
    ? hashString
    : (typeof window !== 'undefined' ? window.location.hash : '');

  const clean = raw.replace(/^#/, '');
  if (!clean) return {};

  const params = new URLSearchParams(clean);
  const state = {};

  // Year
  if (params.has('year')) {
    const y = parseInt(params.get('year'), 10);
    if (!Number.isNaN(y) && y !== 0) {
      state.year = y;
    }
  }

  // Selected Figure
  if (params.has('figure')) {
    const figureId = params.get('figure').trim();
    if (figureId) {
      state.selectedFigure = figureId;
    }
  }

  // Map Zoom
  if (params.has('z')) {
    const z = parseFloat(params.get('z'));
    if (!Number.isNaN(z) && z >= 2 && z <= 18) {
      state.zoom = z;
    }
  }

  // Map Center Lat/Lng: ll=37.97,23.72
  if (params.has('ll')) {
    const parts = params.get('ll').split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        state.center = [lat, lng];
      }
    }
  }

  // Filters: Civilizations
  if (params.has('civs')) {
    const civs = params.get('civs').split(',').map((s) => s.trim()).filter(Boolean);
    if (civs.length > 0) {
      state.civs = civs;
    }
  }

  // Filters: Kinds
  if (params.has('kinds')) {
    const kinds = params.get('kinds').split(',').map((s) => s.trim()).filter(Boolean);
    if (kinds.length > 0) {
      state.kinds = kinds;
    }
  }

  return state;
}

/**
 * Serializes state object into a URL hash string.
 * @param {object} state
 * @returns {string} e.g. "year=-470&figure=socrates&z=6&ll=37.97,23.73"
 */
export function serializeHashState(state) {
  const params = new URLSearchParams();

  if (typeof state.year === 'number' && state.year !== 0) {
    params.set('year', String(state.year));
  }

  if (state.selectedFigure) {
    params.set('figure', state.selectedFigure);
  }

  if (typeof state.zoom === 'number') {
    params.set('z', String(Math.round(state.zoom * 10) / 10));
  }

  if (Array.isArray(state.center) && state.center.length === 2) {
    const lat = Math.round(state.center[0] * 100) / 100;
    const lng = Math.round(state.center[1] * 100) / 100;
    params.set('ll', `${lat},${lng}`);
  }

  if (Array.isArray(state.civs) && state.civs.length > 0) {
    params.set('civs', state.civs.join(','));
  }

  if (Array.isArray(state.kinds) && state.kinds.length > 0) {
    params.set('kinds', state.kinds.join(','));
  }

  const query = params.toString();
  return query ? `#${query}` : '';
}

/**
 * Central Reactive Store for Atlas state.
 */
export class AtlasStore {
  constructor(initialState = {}) {
    const urlState = typeof window !== 'undefined' ? parseHashState() : {};

    this.state = {
      year: sanitizeYear(urlState.year ?? initialState.year ?? -3000),
      selectedFigure: urlState.selectedFigure ?? initialState.selectedFigure ?? null,
      zoom: urlState.zoom ?? initialState.zoom ?? 4.5,
      center: urlState.center ?? initialState.center ?? [29.5, 38.0],
      civs: urlState.civs ?? initialState.civs ?? [],
      kinds: urlState.kinds ?? initialState.kinds ?? [],
      isPlaying: false,
      playbackSpeed: 1, // 1x, 2x, 5x, 10x
      ...initialState,
    };

    this.listeners = new Set();
    this.urlUpdateTimer = null;
    this.suppressHashChange = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => this.handleExternalHashChange());
    }
  }

  /**
   * Subscribes a listener to state changes.
   * @param {function(state: object, changedKeys: string[]): void} listener
   * @returns {function(): void} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners of state change.
   * @param {string[]} changedKeys
   */
  notify(changedKeys) {
    for (const listener of this.listeners) {
      try {
        listener(this.state, changedKeys);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    }
  }

  /**
   * Returns current state snapshot.
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Updates state attributes and triggers subscribers and debounced URL sync.
   * @param {Partial<object>} updates
   * @param {object} [options]
   * @param {boolean} [options.syncUrl=true]
   * @param {boolean} [options.immediateUrl=false]
   */
  setState(updates, { syncUrl = true, immediateUrl = false } = {}) {
    const changedKeys = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'year') {
        const sanitized = sanitizeYear(value, this.state.year);
        if (sanitized !== this.state.year) {
          this.state.year = sanitized;
          changedKeys.push(key);
        }
      } else if (JSON.stringify(this.state[key]) !== JSON.stringify(value)) {
        this.state[key] = value;
        changedKeys.push(key);
      }
    }

    if (changedKeys.length === 0) return;

    this.notify(changedKeys);

    if (syncUrl && typeof window !== 'undefined') {
      const urlRelevantKeys = ['year', 'selectedFigure', 'zoom', 'center', 'civs', 'kinds'];
      const hasUrlChange = changedKeys.some((k) => urlRelevantKeys.includes(k));

      if (hasUrlChange) {
        if (immediateUrl) {
          this.writeUrlHash();
        } else {
          this.scheduleUrlSync();
        }
      }
    }
  }

  /**
   * Schedules a debounced URL hash update to avoid thrashing during scrubber dragging or map panning.
   */
  scheduleUrlSync() {
    if (this.urlUpdateTimer) {
      clearTimeout(this.urlUpdateTimer);
    }
    this.urlUpdateTimer = setTimeout(() => {
      this.writeUrlHash();
      this.urlUpdateTimer = null;
    }, 150);
  }

  /**
   * Writes the current state into window.location.hash using replaceState to avoid cluttering browser history.
   */
  writeUrlHash() {
    if (typeof window === 'undefined') return;

    const newHash = serializeHashState(this.state);
    if (window.location.hash !== newHash) {
      this.suppressHashChange = true;
      try {
        const newUrl = `${window.location.pathname}${window.location.search}${newHash}`;
        window.history.replaceState(null, '', newUrl);
      } finally {
        setTimeout(() => {
          this.suppressHashChange = false;
        }, 50);
      }
    }
  }

  /**
   * Handles hash changes initiated from external navigation (e.g. Back/Forward or manual edit).
   */
  handleExternalHashChange() {
    if (this.suppressHashChange) return;

    const parsed = parseHashState();
    this.setState(parsed, { syncUrl: false });
  }
}

/** Global default store singleton */
export const store = new AtlasStore();
