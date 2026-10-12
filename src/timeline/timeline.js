/**
 * timeline.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Comprehensive Interactive Historical Timeline Component.
 * 
 * Rules (from CONTEXT.md §4.1, §5, §6.2, §6.3 and PLAN.md T4.1-T4.5):
 * - Range: -3000 -> -1 (BCE) with no year 0.
 * - Direction: Old on the right -> new on the left (RTL reading direction).
 * - Century ticks every 100 years, major labels in Eastern Arabic numerals (٣٠٠٠ ق.م, ...).
 * - Era bands: Colored bands matching civilizations; clicking jumps to era start & flies map.
 * - Controls: Play/Pause (#timeline-play-btn), Speed (#timeline-speed-select), Step Back/Forward.
 * - Keyboard navigation: Left Arrow (newer), Right Arrow (older), Space (play/pause).
 * - Figure density strip showing active thinkers and intellectual peaks.
 */

import {
  MIN_TIMELINE_YEAR,
  MAX_TIMELINE_YEAR,
  ERAS,
  yearToPercent,
  generateCenturyTicks,
  getActiveEras,
} from './era-data.js';
import { formatHistoricalYear } from '../utils/format.js';
import { store, stepYear } from '../utils/state.js';
import { setMapView } from '../map/map.js';
import { loadFiguresData, renderDensityStrip } from './density-strip.js';

export class TimelineComponent {
  /**
   * @param {HTMLElement|string} container - Mount container element or selector
   * @param {object} [options={}]
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error(`Timeline container not found: ${container}`);
    }

    this.options = options;
    this.isPlaying = false;
    this.playbackIntervalId = null;
    this.speedMultiplier = 1; // 1x, 2x, 5x, 10x
    this.centuryTicks = generateCenturyTicks(MIN_TIMELINE_YEAR, MAX_TIMELINE_YEAR);

    this.elements = {};
    this.figures = [];
    this.unsubscribeStore = null;

    this.init();
  }

  /**
   * Initializes and renders the timeline component.
   */
  async init() {
    this.render();
    this.bindEvents();
    this.bindKeyboard();

    // Subscribe to central store
    this.unsubscribeStore = store.subscribe((state, changedKeys) => {
      if (changedKeys.includes('year')) {
        this.updateYearUI(state.year);
      }
    });

    // Initial sync with current state
    const currentYear = store.getState().year;
    this.updateYearUI(currentYear);

    // Load figures asynchronously for the density strip
    this.loadAndRenderDensity();
  }

  /**
   * Renders the complete timeline DOM structure.
   */
  render() {
    this.container.innerHTML = `
      <section class="timeline-panel glass-panel glass-panel--elevated" aria-label="لوحة التحكم في الخط الزمني التاريخي">
        
        <!-- 1. Top Bar: Controls, Large Year Display, Era Badges -->
        <div class="timeline-topbar">
          
          <!-- Playback & Step Controls (Grouped on the start/right side) -->
          <div class="timeline-controls" role="group" aria-label="أزرار تشغيل الخط الزمني">
            
            <!-- Step Back / Older (moves rightward in RTL) -->
            <button
              type="button"
              id="timeline-step-back"
              class="btn-icon btn-icon--secondary"
              aria-label="ترجيع إلى الوراء نحو أزمنة أقدم (السهم الأيمن)"
              title="ترجيع (أقدم) [→]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
            </button>

            <!-- Play / Pause Button -->
            <button
              type="button"
              id="timeline-play-btn"
              class="btn-icon btn-icon--primary timeline-play-button"
              aria-label="تشغيل الحركة الزمنية التلقائية"
              title="تشغيل / إيقاف مؤقت [مسافة]"
            >
              <svg class="icon-play" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
              </svg>
              <svg class="icon-pause" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>

            <!-- Step Forward / Newer (moves leftward in RTL) -->
            <button
              type="button"
              id="timeline-step-forward"
              class="btn-icon btn-icon--secondary"
              aria-label="تقديم إلى الأمام نحو أزمنة أحدث (السهم الأيسر)"
              title="تقديم (أحدث) [←]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                <line x1="5" y1="19" x2="5" y2="5"></line>
              </svg>
            </button>

            <!-- Speed Selector -->
            <div class="timeline-speed-wrapper">
              <label for="timeline-speed-select" class="sr-only">سرعة التحرك الزمني</label>
              <select id="timeline-speed-select" class="timeline-speed-select" title="سرعة التشغيل">
                <option value="1">١×</option>
                <option value="2">٢×</option>
                <option value="5">٥×</option>
                <option value="10">١٠×</option>
              </select>
            </div>
          </div>

          <!-- Large Current Year & Active Era Display (Center) -->
          <div class="timeline-year-center">
            <div id="timeline-year-display" class="timeline-year-display" aria-live="polite">
              ٣٠٠٠ ق.م
            </div>
            <div id="timeline-era-badge" class="timeline-era-badge">
              <span class="era-badge-dot"></span>
              <span id="timeline-era-name" class="era-badge-text">مصر القديمة</span>
            </div>
          </div>

          <!-- Quick Civilization Jump Selector / Era Shortcuts (End/Left side) -->
          <div class="timeline-shortcuts" id="timeline-shortcuts" aria-label="اختصارات الانتقال للحقب">
            ${ERAS.slice(0, 5).map((era) => `
              <button
                type="button"
                class="timeline-shortcut-chip"
                data-era-id="${era.id}"
                style="--chip-color: ${era.color};"
                title="${era.description} (${formatHistoricalYear(era.from)})"
              >
                ${era.name_ar}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 2. Era Bands Ribbon (Segmented colored horizontal bar) -->
        <div class="timeline-era-ribbon-container">
          <div class="timeline-era-ribbon" id="timeline-era-ribbon" role="region" aria-label="أشرطة الحقب والحضارات التاريخية">
            ${ERAS.map((era) => {
              const startPct = yearToPercent(era.from);
              const endPct = yearToPercent(era.to);
              const widthPct = Math.max(1.5, endPct - startPct);
              return `
                <div
                  class="era-ribbon-band"
                  data-era-id="${era.id}"
                  style="--era-start: ${startPct}%; --era-width: ${widthPct}%; --era-color: ${era.color};"
                  title="${era.name_ar} (${formatHistoricalYear(era.from)} – ${formatHistoricalYear(era.to)})"
                  role="button"
                  tabindex="0"
                  aria-label="الانتقال إلى ${era.name_ar} (${formatHistoricalYear(era.from)})"
                >
                  <span class="era-ribbon-label">${era.name_ar}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3. Interactive Slider Track, Century Ticks, and Scrubber -->
        <div class="timeline-track-wrapper">
          
          <!-- Density strip mount point -->
          <div id="timeline-density-container" class="timeline-density-container"></div>

          <!-- Custom Track Background with century marks -->
          <div class="timeline-custom-track">
            
            <!-- Progress Fill (glowing gold trail from right (old) to current handle position) -->
            <div id="timeline-progress-fill" class="timeline-progress-fill"></div>

            <!-- Century Ticks & Labels -->
            <div class="timeline-ticks-layer" aria-hidden="true">
              ${this.centuryTicks.map((tick) => `
                <div
                  class="timeline-tick ${tick.isMajor ? 'timeline-tick--major' : 'timeline-tick--minor'}"
                  style="--tick-pos: ${tick.percent}%;"
                >
                  ${tick.isMajor ? `
                    <span class="timeline-tick-label">
                      ${formatHistoricalYear(tick.year, { includeEra: tick.year === MIN_TIMELINE_YEAR || tick.year === -500 || tick.year === -1 })}
                    </span>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Standard Accessible Range Slider Input (dir="rtl") -->
          <input
            type="range"
            id="timeline-slider"
            class="timeline-slider"
            min="${MIN_TIMELINE_YEAR}"
            max="${MAX_TIMELINE_YEAR}"
            step="1"
            value="${MIN_TIMELINE_YEAR}"
            dir="rtl"
            aria-label="شريط تمرير الخط الزمني التاريخي (من ٣٠٠٠ ق.م إلى ١ ق.م)"
          />
        </div>

      </section>
    `;

    // Cache elements
    this.elements = {
      slider: this.container.querySelector('#timeline-slider'),
      yearDisplay: this.container.querySelector('#timeline-year-display'),
      eraName: this.container.querySelector('#timeline-era-name'),
      eraBadge: this.container.querySelector('#timeline-era-badge'),
      playBtn: this.container.querySelector('#timeline-play-btn'),
      iconPlay: this.container.querySelector('.icon-play'),
      iconPause: this.container.querySelector('.icon-pause'),
      stepBack: this.container.querySelector('#timeline-step-back'),
      stepForward: this.container.querySelector('#timeline-step-forward'),
      speedSelect: this.container.querySelector('#timeline-speed-select'),
      progressFill: this.container.querySelector('#timeline-progress-fill'),
      densityContainer: this.container.querySelector('#timeline-density-container'),
      eraRibbon: this.container.querySelector('#timeline-era-ribbon'),
    };
  }

  /**
   * Loads figures and renders the density strip.
   */
  async loadAndRenderDensity() {
    this.figures = await loadFiguresData();
    if (this.elements.densityContainer && this.figures.length > 0) {
      renderDensityStrip(this.elements.densityContainer, this.figures, {
        onJumpToYear: (targetYear, figureId) => {
          let sanitized = targetYear === 0 ? -1 : targetYear;
          sanitized = Math.max(MIN_TIMELINE_YEAR, Math.min(MAX_TIMELINE_YEAR, sanitized));
          if (this.elements.slider) {
            this.elements.slider.value = sanitized;
          }

          if (figureId) {
            const fig = this.figures.find((f) => f.id === figureId);
            const state = store.getState();
            let nextCivs = state.civs;
            if (fig && Array.isArray(state.civs) && state.civs.length > 0 && !state.civs.includes(fig.civilization)) {
              nextCivs = [...state.civs, fig.civilization];
            }
            let nextKinds = state.kinds;
            if (fig && Array.isArray(state.kinds) && state.kinds.length > 0 && !state.kinds.includes(fig.kind)) {
              nextKinds = [...state.kinds, fig.kind];
            }
            store.setState({
              year: sanitized,
              civs: nextCivs,
              kinds: nextKinds,
              selectedFigure: figureId,
            });
          } else {
            store.setState({ year: sanitized });
          }
        },
      });
    }
  }

  /**
   * Binds UI events.
   */
  bindEvents() {
    const { slider, playBtn, stepBack, stepForward, speedSelect } = this.elements;

    // Range slider scrubbing (input = instant feedback while dragging)
    slider.addEventListener('input', (e) => {
      const year = parseInt(e.target.value, 10);
      this.setYear(year, { syncSlider: false });
    });

    // Play / Pause toggle
    playBtn.addEventListener('click', () => {
      this.togglePlay();
    });

    // Step Back (towards older dates: -25 years)
    stepBack.addEventListener('click', () => {
      const current = store.getState().year;
      const next = stepYear(current, -25, MIN_TIMELINE_YEAR, MAX_TIMELINE_YEAR);
      this.setYear(next);
    });

    // Step Forward (towards newer dates: +25 years)
    stepForward.addEventListener('click', () => {
      const current = store.getState().year;
      const next = stepYear(current, 25, MIN_TIMELINE_YEAR, MAX_TIMELINE_YEAR);
      this.setYear(next);
    });

    // Speed selector change
    speedSelect.addEventListener('change', (e) => {
      this.speedMultiplier = parseFloat(e.target.value) || 1;
      if (this.isPlaying) {
        this.restartPlayLoop();
      }
    });

    // Era band clicks (jump to era start + fly map to civilization center)
    this.container.querySelectorAll('.era-ribbon-band, .timeline-shortcut-chip').forEach((el) => {
      const eraId = el.getAttribute('data-era-id');
      const era = ERAS.find((e) => e.id === eraId);
      if (!era) return;

      const triggerJump = () => {
        this.jumpToEra(era);
      };

      el.addEventListener('click', triggerJump);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerJump();
        }
      });
    });
  }

  /**
   * Binds global keyboard controls (Left/Right arrows, Space).
   */
  bindKeyboard() {
    this.keyHandler = (e) => {
      // Don't intercept when user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        if (document.activeElement !== this.elements.slider) {
          return;
        }
      }

      if (e.key === ' ' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'ArrowLeft') {
        // RTL Left Arrow = newer (forward in time)
        e.preventDefault();
        const current = store.getState().year;
        const delta = e.shiftKey ? 50 : 10;
        const next = stepYear(current, delta, MIN_TIMELINE_YEAR, MAX_TIMELINE_YEAR);
        this.setYear(next);
      } else if (e.key === 'ArrowRight') {
        // RTL Right Arrow = older (backward in time)
        e.preventDefault();
        const current = store.getState().year;
        const delta = e.shiftKey ? -50 : -10;
        const next = stepYear(current, delta, MIN_TIMELINE_YEAR, MAX_TIMELINE_YEAR);
        this.setYear(next);
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.setYear(MIN_TIMELINE_YEAR);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.setYear(MAX_TIMELINE_YEAR);
      }
    };

    window.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Jumps the timeline to the start of an era and centers the map.
   * @param {object} era
   */
  jumpToEra(era) {
    if (!era) return;
    const targetYear = era.focusYear ?? era.from;
    this.setYear(targetYear);
    if (era.center && era.zoom) {
      setMapView(era.center, era.zoom);
    }
  }

  /**
   * Updates state with new year and synchronizes borders and store.
   * @param {number} year
   * @param {object} [options]
   * @param {boolean} [options.syncSlider=true]
   */
  setYear(year, { syncSlider = true } = {}) {
    let sanitized = year;
    if (sanitized === 0) sanitized = -1;
    sanitized = Math.max(MIN_TIMELINE_YEAR, Math.min(MAX_TIMELINE_YEAR, sanitized));

    store.setState({ year: sanitized });

    if (syncSlider && this.elements.slider) {
      this.elements.slider.value = sanitized;
    }
  }

  /**
   * Updates visual components when year changes.
   * @param {number} year
   */
  updateYearUI(year) {
    const { yearDisplay, eraName, eraBadge, progressFill, slider } = this.elements;
    if (!yearDisplay) return;

    // 1. Large formatted year with micro-animation tween
    if (this.lastDisplayedYear !== undefined && this.lastDisplayedYear !== year) {
      yearDisplay.classList.remove('is-tweening');
      void yearDisplay.offsetWidth; // trigger reflow
      yearDisplay.classList.add('is-tweening');
      if (this.yearTweenTimeout) clearTimeout(this.yearTweenTimeout);
      this.yearTweenTimeout = setTimeout(() => {
        yearDisplay.classList.remove('is-tweening');
      }, 120);
    }
    this.lastDisplayedYear = year;
    yearDisplay.textContent = formatHistoricalYear(year);

    // 2. Active Eras badge
    const activeEras = getActiveEras(year);
    if (activeEras.length > 0) {
      const primaryEra = activeEras[activeEras.length - 1];
      eraName.textContent = primaryEra.name_ar;
      eraBadge.style.setProperty('--era-active-color', primaryEra.color);
      eraBadge.style.display = 'inline-flex';
    } else {
      eraName.textContent = 'العالم القديم';
      eraBadge.style.setProperty('--era-active-color', '#d4af37');
    }

    // 3. Highlight corresponding era band
    if (this.container) {
      this.container.querySelectorAll('.era-ribbon-band').forEach((band) => {
        const id = band.getAttribute('data-era-id');
        const isActive = activeEras.some((e) => e.id === id);
        band.classList.toggle('is-active', isActive);
      });
    }

    // 4. Progress bar fill percentage
    const pct = yearToPercent(year);
    if (progressFill) {
      progressFill.style.width = `${pct}%`;
    }

    // 5. Sync slider range input value if not focused
    if (slider && document.activeElement !== slider) {
      slider.value = year;
    }
  }

  /**
   * Toggles playback between playing and paused.
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Starts timeline animation playback.
   */
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    store.setState({ isPlaying: true }, { syncUrl: false });

    const { iconPlay, iconPause, playBtn } = this.elements;
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    playBtn.classList.add('is-active');
    playBtn.setAttribute('aria-label', 'إيقاف الحركة الزمنية المؤقت');

    // If currently at the end (-1), loop back to beginning (-3000)
    if (store.getState().year >= MAX_TIMELINE_YEAR) {
      this.setYear(MIN_TIMELINE_YEAR);
    }

    this.startPlayLoop();
  }

  /**
   * Pauses timeline playback.
   */
  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    store.setState({ isPlaying: false }, { syncUrl: false });

    if (this.playbackIntervalId) {
      clearInterval(this.playbackIntervalId);
      this.playbackIntervalId = null;
    }

    const { iconPlay, iconPause, playBtn } = this.elements;
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    playBtn.classList.remove('is-active');
    playBtn.setAttribute('aria-label', 'تشغيل الحركة الزمنية التلقائية');
  }

  /**
   * Starts the tick loop for smooth playback.
   */
  startPlayLoop() {
    if (this.playbackIntervalId) {
      clearInterval(this.playbackIntervalId);
    }

    // Step every 100ms: base step = 5 years * speedMultiplier
    const intervalMs = 120;
    const baseStep = 5 * this.speedMultiplier;

    this.playbackIntervalId = setInterval(() => {
      const current = store.getState().year;
      const next = stepYear(current, baseStep, MIN_TIMELINE_YEAR, MAX_TIMELINE_YEAR);

      if (next >= MAX_TIMELINE_YEAR) {
        this.setYear(MAX_TIMELINE_YEAR);
        this.pause();
      } else {
        this.setYear(next);
      }
    }, intervalMs);
  }

  /**
   * Restarts playback loop with updated speed.
   */
  restartPlayLoop() {
    if (this.isPlaying) {
      this.startPlayLoop();
    }
  }

  /**
   * Cleans up listeners and timers.
   */
  destroy() {
    this.pause();
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    this.container.innerHTML = '';
  }
}
