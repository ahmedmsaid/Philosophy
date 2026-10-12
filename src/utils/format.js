/**
 * format.js - Formatting utilities for Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * 
 * Rules (from CONTEXT.md §4.1, §6.3):
 * 1. Years are integers: negative = BCE (ق.م), positive = CE (م).
 * 2. No year 0: -1 = 1 BCE, 1 = 1 CE.
 * 3. Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) everywhere in the UI.
 * 4. Years never get a thousands separator (٣٠٠٠ ق.م, not ٣٬٠٠٠).
 */

const ARABIC_DIGITS_MAP = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

const arabicYearFormatter = new Intl.NumberFormat('ar-EG', {
  useGrouping: false,
});

/**
 * Converts Western digits (0-9) to Eastern Arabic digits (٠-٩).
 * @param {number|string} value
 * @returns {string}
 */
export function toArabicDigits(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.replace(/[0-9]/g, (digit) => ARABIC_DIGITS_MAP[Number(digit)]);
}

/**
 * Formats a historical year integer into Eastern Arabic format.
 * Examples:
 *   -470 -> "٤٧٠ ق.م"
 *   3000 -> "٣٠٠٠ م"
 *   -1   -> "١ ق.م"
 * 
 * @param {number} year - Historical year integer (no year 0)
 * @param {object} [options]
 * @param {boolean} [options.approx=false] - If true, prefixes with "حوالي "
 * @param {boolean} [options.includeEra=true] - If false, returns only numerals
 * @returns {string}
 */
export function formatHistoricalYear(year, { approx = false, includeEra = true } = {}) {
  if (typeof year !== 'number' || Number.isNaN(year)) {
    return '';
  }

  const isBCE = year < 0;
  const absYear = Math.abs(year);
  const formattedNumber = arabicYearFormatter.format(absYear);

  let result = formattedNumber;

  if (includeEra) {
    const eraSuffix = isBCE ? 'ق.م' : 'م';
    result = `${formattedNumber} ${eraSuffix}`;
  }

  if (approx) {
    result = `حوالي ${result}`;
  }

  return result;
}

/**
 * Formats an active/lifespan range.
 * Example: { from: -470, to: -399 } -> "٤٧٠ ق.م – ٣٩٩ ق.م"
 * @param {number} fromYear
 * @param {number} toYear
 * @returns {string}
 */
export function formatYearRange(fromYear, toYear) {
  const fromStr = formatHistoricalYear(fromYear);
  const toStr = formatHistoricalYear(toYear);
  return `${fromStr} – ${toStr}`;
}
