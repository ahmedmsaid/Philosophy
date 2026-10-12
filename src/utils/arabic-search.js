/**
 * arabic-search.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Utilities for normalizing Arabic text, removing diacritics,
 * and performing flexible fuzzy/prefix searches on historical figures.
 */

/**
 * Arabic diacritics (tashkeel) regex pattern.
 * Covers: fatha, damma, kasra, fathatan, dammatan, kasratan, sukun, shadda, tatweel.
 */
const TASHKEEL_REGEX = /[\u064B-\u0652\u0640\u0670]/g;

/**
 * Normalizes Arabic text for flexible search comparison:
 * - Removes diacritics / vocalization (tashkeel)
 * - Normalizes Alef forms (أ, إ, آ, ٱ -> ا)
 * - Normalizes Teh Marbuta (ة -> ه)
 * - Normalizes Alef Maqsura (ى -> ي)
 * - Trims and converts to lower case
 * 
 * @param {string} text
 * @returns {string}
 */
export function normalizeArabic(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(TASHKEEL_REGEX, '')
    // Normalize Alef variants
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Teh Marbuta to Heh
    .replace(/ة/g, 'ه')
    // Normalize Alef Maqsura to Yeh
    .replace(/ى/g, 'ي')
    // Normalize Persian/Urdu Yeh and Kaf if any
    .replace(/ي/g, 'ي')
    .replace(/ك/g, 'ك')
    .trim()
    .toLowerCase();
}

/**
 * Checks if a search query matches a figure across multiple fields:
 * - name_ar, name_en
 * - place_ar, modern_country_ar
 * - tradition_ar, kind, tags
 * 
 * @param {object} figure
 * @param {string} query
 * @returns {boolean}
 */
export function matchesFigureSearch(figure, query) {
  if (!figure) return false;
  const cleanQuery = normalizeArabic(query);
  if (!cleanQuery) return true;

  // Split query into individual words for multi-word search
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);

  const searchableFields = [
    figure.name_ar,
    figure.name_en,
    figure.location?.place_ar,
    figure.location?.modern_country_ar,
    figure.tradition_ar,
    figure.kind,
    ...(Array.isArray(figure.tags) ? figure.tags : []),
  ]
    .filter(Boolean)
    .map((val) => normalizeArabic(String(val)));

  const combinedHaystack = searchableFields.join(' ');

  // Every token in query must match somewhere in haystack
  return tokens.every((token) => combinedHaystack.includes(token));
}

/**
 * Filters and ranks figure search results based on match relevance.
 * Exact name matches appear first, followed by name prefix, followed by location/tradition.
 * 
 * @param {Array<object>} figures
 * @param {string} query
 * @param {number} [limit=10]
 * @returns {Array<object>}
 */
export function searchFigures(figures, query, limit = 10) {
  if (!Array.isArray(figures)) return [];
  const cleanQuery = normalizeArabic(query);
  if (!cleanQuery) return [];

  const matched = [];

  for (const fig of figures) {
    if (!matchesFigureSearch(fig, cleanQuery)) continue;

    // Calculate score (lower score = higher relevance)
    const normNameAr = normalizeArabic(fig.name_ar || '');
    const normNameEn = normalizeArabic(fig.name_en || '');
    let score = 10;

    if (normNameAr === cleanQuery || normNameEn === cleanQuery) {
      score = 1; // exact match
    } else if (normNameAr.startsWith(cleanQuery) || normNameEn.startsWith(cleanQuery)) {
      score = 2; // prefix name match
    } else if (normNameAr.includes(cleanQuery) || normNameEn.includes(cleanQuery)) {
      score = 3; // partial name match
    } else if (normalizeArabic(fig.tradition_ar || '').includes(cleanQuery)) {
      score = 4; // tradition match
    } else if (normalizeArabic(fig.location?.place_ar || '').includes(cleanQuery)) {
      score = 5; // place match
    }

    matched.push({ figure: fig, score });
  }

  matched.sort((a, b) => a.score - b.score);
  return matched.slice(0, limit).map((item) => item.figure);
}
