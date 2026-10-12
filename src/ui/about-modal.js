/**
 * about-modal.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Comprehensive About & Attribution Modal Component (PLAN T7.2).
 * 
 * Rules (from CONTEXT.md §8 and PLAN.md T7.2):
 * - Project purpose: Interactive Arabic atlas of ancient philosophy & wisdom.
 * - Complete attributions:
 *     - Arabic Wikipedia extracts (CC BY-SA 4.0).
 *     - Wikimedia Commons portraits & licenses.
 *     - Historical borders: aourednik/historical-basemaps (GPL-3.0).
 *     - Base physical tiles: Esri World Physical Map (unlabeled).
 *     - Project open source license: GNU General Public License v3.0 (GPL-3.0).
 * - Accessible: #about-modal-close, Esc to close, focus trapped & restored.
 */

export class AboutModalComponent {
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
      throw new Error(`About modal mount container not found: ${container}`);
    }

    this.options = options;
    this.isOpen = false;
    this.previousFocusedElement = null;
    this.elements = {};

    this.init();
  }

  /**
   * Initializes modal structure and bindings.
   */
  init() {
    this.render();
    this.bindEvents();
  }

  /**
   * Renders the modal DOM.
   */
  render() {
    this.container.innerHTML = `
      <div
        id="about-modal-backdrop"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        aria-describedby="about-modal-description"
      >
        <div id="about-dialog" class="modal-dialog about-dialog glass-panel glass-panel--elevated">
          
          <!-- Header -->
          <div class="modal-header">
            <div class="about-header-titles">
              <h2 id="about-modal-title" class="modal-title">عن أطلس تاريخ الفلسفة</h2>
              <span class="about-subtitle">Philosophy Timeline Atlas</span>
            </div>
            
            <button
              type="button"
              id="about-modal-close"
              class="about-close-btn"
              aria-label="إغلاق نافذة عن المشروع (Esc)"
              title="إغلاق [Esc]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div id="about-modal-description" class="modal-body about-body">
            
            <!-- Section 1: Purpose -->
            <section class="about-section">
              <h3 class="about-section-heading">
                <span class="about-icon" aria-hidden="true">🏛️</span>
                <span>فكرة المشروع وهدفه</span>
              </h3>
              <p>
                <strong>أطلس تاريخ الفلسفة</strong> هو مبادرة معرفية وتفاعلية تهدف إلى ردم الفجوة بين الجغرافيا والتاريخ الفلسفي. يقدم الأطلس تجربة بصرية فريدة تجمع بين خرائط العالم التاريخية والخط الزمني الممتد لآلاف السنين، ليتيح للباحثين والمهتمين استكشاف كيف ومتى وأين تبلورت الأفكار والمدارس الفلسفية الأولى في مصر القديمة، وبلاد الرافدين، وفارس، والهند، والصين، واليونان.
              </p>
            </section>

            <!-- Section 2: Methodology & Data -->
            <section class="about-section">
              <h3 class="about-section-heading">
                <span class="about-icon" aria-hidden="true">🔍</span>
                <span>المنهجية وتصنيف الأعلام</span>
              </h3>
              <p>
                يتبنى الأطلس معياراً شمولياً للفكر القديم، حيث يضم الفلاسفة (Philosophers)، وحكماء أدب الحكمة والتعاليم (Sages)، والمفكرين الدينيين (Religious Thinkers). تم ربط وتوثيق كل شخصية بمُعرّف ويكي بيانات (Wikidata QID) معتمد، وتم التمييز الدقيق بين التواريخ المحققة والتأريخ التقريبي أو الشخصيات ذات الطابع شبه الأسطوري.
              </p>
            </section>

            <!-- Section 3: Sources & Attributions -->
            <section class="about-section">
              <h3 class="about-section-heading">
                <span class="about-icon" aria-hidden="true">📜</span>
                <span>المصادر وحقوق الملكية والنسبة</span>
              </h3>
              <ul class="about-sources-list">
                <li>
                  <strong>نصوص المقالات والملخصات:</strong>
                  تُستجلب ملخصات الشخصيات من 
                  <a href="https://ar.wikipedia.org" target="_blank" rel="noopener noreferrer">ويكيبيديا العربية</a>
                  بموجب رخصة المشاع الإبداعي: <em>النَسْب-الترخيص بالمثل 4.0 الدولية (CC BY-SA 4.0)</em>.
                </li>
                <li>
                  <strong>الصور والبورتريهات التاريخية:</strong>
                  مستمدة من مستودع 
                  <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">ويكيميديا كومنز (Wikimedia Commons)</a>،
                  وتخضع كل صورة لرخصة استخدامها المحددة في بطاقة الشخصية.
                </li>
                <li>
                  <strong>الحدود السياسية التاريخية:</strong>
                  مبنية على بيانات مشروع 
                  <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener noreferrer">historical-basemaps</a>
                  المفتوح، والمرخص بموجب رخصة <em>جنو العمومية GNU GPL-3.0</em>.
                </li>
                <li>
                  <strong>خريطة الأساس التضاريسية:</strong>
                  خريطة العالم الفيزيائية المجردة من &copy; Esri World Physical Map، وقد اختيرت عمداً لخلوها من التسميات الحديثة لتفادي المفارقات التاريخية.
                </li>
              </ul>
            </section>

            <!-- Section 4: License -->
            <section class="about-section about-section--license">
              <h3 class="about-section-heading">
                <span class="about-icon" aria-hidden="true">⚖️</span>
                <span>رخصة المشروع</span>
              </h3>
              <p>
                هذا الأطلس مشروع حر ومفتوح المصدر بالكامل، ومنشور بموجب رخصة 
                <strong>جنو العمومية الإصدار 3 (GNU General Public License v3.0 - GPL-3.0)</strong>.
              </p>
            </section>

          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button
              type="button"
              id="about-modal-close-action"
              class="btn btn--primary"
            >
              <span>تم، العودة إلى الخريطة</span>
            </button>
          </div>

        </div>
      </div>
    `;

    this.elements = {
      backdrop: this.container.querySelector('#about-modal-backdrop'),
      closeBtn: this.container.querySelector('#about-modal-close'),
      closeActionBtn: this.container.querySelector('#about-modal-close-action'),
      dialog: this.container.querySelector('#about-dialog'),
    };
  }

  /**
   * Binds interaction events.
   */
  bindEvents() {
    const { backdrop, closeBtn, closeActionBtn } = this.elements;

    const handleClose = () => {
      this.hide();
      if (this.options.onClose) {
        this.options.onClose();
      }
    };

    closeBtn.addEventListener('click', handleClose);
    closeActionBtn.addEventListener('click', handleClose);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        handleClose();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        handleClose();
      }
    });
  }

  /**
   * Shows the about modal.
   */
  show() {
    this.isOpen = true;
    this.previousFocusedElement = document.activeElement;
    this.elements.backdrop.classList.add('is-open');

    requestAnimationFrame(() => {
      this.elements.closeBtn.focus();
    });
  }

  /**
   * Hides the about modal.
   */
  hide() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.elements.backdrop.classList.remove('is-open');

    if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
      this.previousFocusedElement.focus();
      this.previousFocusedElement = null;
    }
  }
}
