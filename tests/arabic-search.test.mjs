import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, matchesFigureSearch, searchFigures } from '../src/utils/arabic-search.js';

test('normalizeArabic removes tashkeel and normalizes letter variations', () => {
  // Tashkeel removal
  assert.equal(normalizeArabic('سُقْرَاط'), 'سقراط');
  assert.equal(normalizeArabic('أَفْلَاطُون'), 'افلاطون');

  // Alef normalization (أ, إ, آ, ٱ -> ا)
  assert.equal(normalizeArabic('إبستمولوجيا'), 'ابستمولوجيا');
  assert.equal(normalizeArabic('آلهة'), 'الهه');
  assert.equal(normalizeArabic('أثينا'), 'اثينا');

  // Teh Marbuta to Heh (ة -> ه)
  assert.equal(normalizeArabic('الحكمة'), 'الحكمه');
  assert.equal(normalizeArabic('الفلسفة'), 'الفلسفه');

  // Alef Maqsura to Yeh (ى -> ي)
  assert.equal(normalizeArabic('بقايا'), 'بقايا');
  assert.equal(normalizeArabic('كبرى'), 'كبري');
});

test('matchesFigureSearch matches Arabic name, English name, and place', () => {
  const figure = {
    id: 'socrates',
    name_ar: 'سُقْرَاط',
    name_en: 'Socrates',
    location: { place_ar: 'أثينا', modern_country_ar: 'اليونان' },
    tradition_ar: 'الفلسفة الكلاسيكية',
    tags: ['ethics']
  };

  // Arabic match with diacritics in query
  assert.ok(matchesFigureSearch(figure, 'سقراط'));
  assert.ok(matchesFigureSearch(figure, 'سُقْرَاط'));

  // English match
  assert.ok(matchesFigureSearch(figure, 'socrates'));
  assert.ok(matchesFigureSearch(figure, 'Socrates'));

  // Place match
  assert.ok(matchesFigureSearch(figure, 'أثينا'));
  assert.ok(matchesFigureSearch(figure, 'اثينا'));

  // Tradition match
  assert.ok(matchesFigureSearch(figure, 'كلاسيكية'));

  // Non-matching query
  assert.ok(!matchesFigureSearch(figure, 'الصين'));
});

test('searchFigures ranks exact name match higher than partial match', () => {
  const figures = [
    { id: 'aristotle', name_ar: 'أرسطو', name_en: 'Aristotle' },
    { id: 'socrates', name_ar: 'سقراط', name_en: 'Socrates' },
    { id: 'presocratic', name_ar: 'فلاسفة ما قبل سقراط', name_en: 'Presocratics' }
  ];

  const results = searchFigures(figures, 'سقراط');
  assert.equal(results.length, 2);
  assert.equal(results[0].id, 'socrates');
  assert.equal(results[1].id, 'presocratic');
});
