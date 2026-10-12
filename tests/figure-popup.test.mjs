import test from 'node:test';
import assert from 'node:assert/strict';

// Setup minimal browser globals for Node.js test environment if absent
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    devicePixelRatio: 1,
    screen: {},
    location: { hash: '' },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
  };
  globalThis.document = {
    createElement: () => ({ setAttribute: () => {}, style: {} }),
    documentElement: { style: {} },
    activeElement: null,
  };
}

const { FigurePopupComponent } = await import('../src/ui/figure-popup.js');

test('FigurePopupComponent renders compliant compact HTML and metadata (T8.4, T8.6)', () => {
  // Mock map object
  const mockMap = {
    openPopup: () => {},
    closePopup: () => {},
  };

  const popupComp = new FigurePopupComponent(mockMap);

  const sampleFigure = {
    id: 'socrates',
    name_ar: 'سقراط',
    name_en: 'Socrates',
    kind: 'philosopher',
    legendary: false,
    civilization: 'greece',
    civilization_name_ar: 'اليونان القديمة',
    birth: { year: -470, approx: true },
    death: { year: -399, approx: false },
    active: { from: -450, to: -399 },
    location: {
      lat: 37.9842,
      lng: 23.7281,
      place_ar: 'أثينا',
      place_wikidata: 'Q1524',
      modern_country_ar: 'اليونان',
    },
    image: {
      url: 'https://example.com/socrates.jpg',
      thumb_url: 'https://example.com/socrates-thumb.jpg',
    },
  };

  const html = popupComp.createPopupContent(sampleFigure);

  // 1. Required IDs
  assert.ok(html.includes('id="figure-popup-close"'), 'Must contain close button with id="figure-popup-close"');
  assert.ok(html.includes('id="figure-popup-more"'), 'Must contain more button with id="figure-popup-more"');

  // 2. Accessibility
  assert.ok(html.includes('role="dialog"'), 'Must have role="dialog"');
  assert.ok(html.includes('aria-label="سقراط"'), 'Must have Arabic aria-label');

  // 3. Thinker metadata
  assert.ok(html.includes('سقراط'), 'Must display Arabic name');
  assert.ok(html.includes('Socrates'), 'Must display English name');
  assert.ok(html.includes('أثينا'), 'Must display ancient place');
  assert.ok(html.includes('اليونان'), 'Must display modern country');
  assert.ok(html.includes('فيلسوف'), 'Must display kind label');
  assert.ok(html.includes('chip--greece'), 'Must contain civilization chip');
  assert.ok(html.includes('kind-chip--philosopher'), 'Must contain kind chip');

  // 4. Dates in Eastern Arabic numerals and approx circa indicator
  assert.ok(html.includes('حوالي'), 'Must show حوالي for approx date');
  assert.ok(html.includes('ق.م'), 'Must format dates with historical suffix');
  assert.ok(html.includes('تأريخ تقريبي'), 'Must display approx date badge');

  // 5. Test legendary figure badge
  const legendaryFigure = {
    ...sampleFigure,
    id: 'laozi',
    name_ar: 'لاوتزه',
    legendary: true,
  };
  const legendaryHtml = popupComp.createPopupContent(legendaryFigure);
  assert.ok(legendaryHtml.includes('شخصية شبه أسطورية'), 'Must display legendary badge for legendary: true');
});
