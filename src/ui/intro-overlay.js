/**
 * intro-overlay.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Landing & Introduction Overlay Component (PLAN T7.1).
 * 
 * Features:
 * - Evocative welcome screen introducing the atlas.
 * - Primary action "ابدأ الرحلة" (#intro-start-btn) jumping to -3000 BCE over Ancient Egypt.
 * - Secondary action "استكشاف حر" (#intro-explore-btn) closing the overlay.
 * - Esc to close, accessible dialog role, focus trapping & restoration.
 * - Shown automatically on initial visit when no deep link hash is present.
 */

import { store } from '../utils/state.js';

export const INTRO_STORAGE_KEY = 'atlas_intro_dismissed';

export class IntroOverlayComponent {
  /**
   * @param {HTMLElement|string} container - Mount container element or selector
   * @param {object} [options={}]
   * @param {function(): void} [options.onStart]
   * @param {function(): void} [options.onClose]
   */
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error(`Intro overlay mount container not found: ${container}`);
    }

    this.options = options;
    this.isOpen = false;
    this.previousFocusedElement = null;
    this.elements = {};

    this.init();
  }

  /**
   * Initializes overlay markup and listeners.
   */
  init() {
    this.render();
    this.bindEvents();
  }

  /**
   * Renders the intro overlay DOM.
   */
  render() {
    this.container.innerHTML = `
      <div
        id="intro-overlay-backdrop"
        class="modal-backdrop intro-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        aria-describedby="intro-desc"
      >
        <div class="modal-dialog intro-dialog glass-panel glass-panel--elevated">
          
          <!-- Close button -->
          <button
            type="button"
            id="intro-close-btn"
            class="intro-close-btn"
            aria-label="إغلاق نافذة المقدمة والبدء في التصفح (Esc)"
            title="إغلاق [Esc]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Header / Hero Branding -->
          <div class="intro-hero">
            <div class="intro-symbol-badge" aria-hidden="true">
              <span>🏛️</span>
            </div>
            <h2 id="intro-title" class="intro-title">أطلس تاريخ الفلسفة</h2>
            <p id="intro-desc" class="intro-desc">
              رحلة بصرية تفاعلية عبر خرائط العالم القديم والخط الزمني لاستكشاف فجر الفلسفة وأعلام الحكمة والفكر الإنساني منذ عام ٣٠٠٠ قبل الميلاد.
            </p>
          </div>

          <!-- Feature Cards Grid -->
          <div class="intro-features-grid" role="list">
            
            <div class="intro-feature-card" role="listitem">
              <div class="intro-feature-icon" aria-hidden="true">🗺️</div>
              <div class="intro-feature-content">
                <h3 class="intro-feature-heading">خرائط وحدود تاريخية</h3>
                <p class="intro-feature-text">حدود سياسية موثقة للكيانات والحضارات القديمة تتغير بدقة وفق كل حقبة دون تشويه بأسماء معاصرة.</p>
              </div>
            </div>

            <div class="intro-feature-card" role="listitem">
              <div class="intro-feature-icon" aria-hidden="true">⏳</div>
              <div class="intro-feature-content">
                <h3 class="intro-feature-heading">خط زمني بالاتجاه العربي</h3>
                <p class="intro-feature-text">تحكم سلس من اليمين (الأقدم) إلى اليسار (الأحدث)، مع تشغيل تلقائي وتحديد لمراكز الثقل الفكري.</p>
              </div>
            </div>

            <div class="intro-feature-card" role="listitem">
              <div class="intro-feature-icon" aria-hidden="true">📜</div>
              <div class="intro-feature-content">
                <h3 class="intro-feature-heading">أعلام الفلسفة والحكمة</h3>
                <p class="intro-feature-text">توثيق شامل للفلاسفة وحكماء أدب الحكمة والمفكرين الدينيين مع ملخصات موثقة من ويكيبيديا العربية.</p>
              </div>
            </div>

          </div>

          <!-- Actions -->
          <div class="intro-actions">
            <!-- Start Journey: -3000 over Egypt -->
            <button
              type="button"
              id="intro-start-btn"
              class="btn btn--primary btn-start-journey"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>ابدأ الرحلة من مصر القديمة (٣٠٠٠ ق.م)</span>
            </button>

            <!-- Free explore -->
            <button
              type="button"
              id="intro-explore-btn"
              class="btn btn--secondary"
            >
              <span>استكشاف حر للأطلس</span>
            </button>
          </div>

        </div>
      </div>
    `;

    this.elements = {
      backdrop: this.container.querySelector('#intro-overlay-backdrop'),
      closeBtn: this.container.querySelector('#intro-close-btn'),
      startBtn: this.container.querySelector('#intro-start-btn'),
      exploreBtn: this.container.querySelector('#intro-explore-btn'),
    };
  }

  /**
   * Binds interaction events.
   */
  bindEvents() {
    const { backdrop, closeBtn, startBtn, exploreBtn } = this.elements;

    // Start Journey button: jumps to -3000 BCE over Egypt
    startBtn.addEventListener('click', () => {
      this.hide();
      this.startJourney();
      if (this.options.onStart) {
        this.options.onStart();
      }
    });

    // Free explore button: closes overlay without altering state
    exploreBtn.addEventListener('click', () => {
      this.hide();
      if (this.options.onClose) {
        this.options.onClose();
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => {
      this.hide();
      if (this.options.onClose) {
        this.options.onClose();
      }
    });

    // Backdrop click outside dialog closes overlay
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.hide();
      }
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.hide();
      }
    });
  }

  /**
   * Begins guided journey: year -3000, centered on ancient Egypt.
   */
  startJourney() {
    try {
      localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    } catch {
      // Storage unavailable or disabled
    }

    // Set timeline year to -3000 and center map over Egypt [26.8, 30.8], zoom 6
    store.setState({
      year: -3000,
      selectedFigure: null,
      center: [26.8, 30.8],
      zoom: 6,
    });
  }

  /**
   * Displays the intro overlay.
   */
  show() {
    this.isOpen = true;
    this.previousFocusedElement = document.activeElement;
    this.elements.backdrop.classList.add('is-open');

    // Focus primary start button
    requestAnimationFrame(() => {
      this.elements.startBtn.focus();
    });
  }

  /**
   * Hides the intro overlay and remembers preference.
   */
  hide() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.elements.backdrop.classList.remove('is-open');

    try {
      localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }

    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      this.previousFocusedElement.focus();
      this.previousFocusedElement = null;
    }
  }

  /**
   * Checks whether the intro should be auto-displayed on initial site load.
   * Auto-shows if not previously dismissed and no deep link hash is present.
   * @returns {boolean}
   */
  shouldAutoShow() {
    try {
      const alreadyDismissed = localStorage.getItem(INTRO_STORAGE_KEY);
      if (alreadyDismissed) {
        return false;
      }
    } catch {
      // Storage error
    }

    // Check if the current URL has explicit figure selection or non-default year
    const hash = window.location.hash;
    if (hash && (hash.includes('figure=') || hash.includes('year='))) {
      return false;
    }

    return true;
  }
}
