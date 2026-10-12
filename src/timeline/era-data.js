/**
 * era-data.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Era definitions, civilization mappings, coordinates, and timeline geometry calculations.
 * 
 * Rules (from CONTEXT.md §5 and PLAN.md T4.2):
 * - Eras have fixed ids and approximate display year bands.
 * - Clicking a band jumps to its start and flies the map to that civilization.
 * - Timeline geometry: -3000 on the right, newer dates on the left (RTL).
 */

export const MIN_TIMELINE_YEAR = -3000;
export const MAX_TIMELINE_YEAR = -1; // End of BCE for MVP (-1 is 1 BCE)

/**
 * Era band definitions matching CONTEXT.md §5 and civilizations.json.
 */
export const ERAS = [
  {
    id: 'ancient-egypt',
    name_ar: 'مصر القديمة',
    from: -3000,
    to: -332,
    civilization: 'egypt',
    color: '#C9A227',
    center: [26.8, 30.8],
    zoom: 6,
    description: 'أدب الحكمة والتعاليم الأخلاقية في وادي النيل',
  },
  {
    id: 'mesopotamia',
    name_ar: 'بلاد الرافدين',
    from: -3000,
    to: -539,
    civilization: 'mesopotamia',
    color: '#C86432',
    center: [33.3, 44.4],
    zoom: 6,
    description: 'شرائع حمورابي ومراثي وحكم سومر وبابل',
  },
  {
    id: 'ancient-persia',
    name_ar: 'فارس القديمة',
    from: -1500,
    to: -330,
    civilization: 'persia',
    color: '#2A7B9B',
    center: [32.0, 53.0],
    zoom: 5,
    description: 'الفكر الزرادشتي وفلسفة ثنائية النور والظلمة',
  },
  {
    id: 'ancient-india',
    name_ar: 'الهند القديمة',
    from: -1500,
    to: -200,
    civilization: 'india',
    color: '#D97706',
    center: [25.0, 82.0],
    zoom: 5,
    description: 'الأوبانيشاد، البوذية، الجاينية، وفلسفات الأستيكا',
  },
  {
    id: 'ancient-china',
    name_ar: 'الصين القديمة',
    from: -1000,
    to: -221,
    civilization: 'china',
    color: '#B83A4B',
    center: [34.5, 110.0],
    zoom: 5,
    description: 'مائة مدرسة فكرية: الكونفوشيوسية، الطاوية، والشرعوية',
  },
  {
    id: 'presocratic',
    name_ar: 'ما قبل سقراط',
    from: -624,
    to: -400,
    civilization: 'greece',
    color: '#3D5A80',
    center: [38.0, 24.0],
    zoom: 6,
    description: 'البحث الأيوني الطبيعي عن أصل الكون والعقل',
  },
  {
    id: 'classical-greek',
    name_ar: 'الفلسفة اليونانية الكلاسيكية',
    from: -470,
    to: -322,
    civilization: 'greece',
    color: '#4F729E',
    center: [37.97, 23.72],
    zoom: 6.5,
    description: 'سقراط، أفلاطون، وأرسطو: تأسيس الفلسفة الأخلاقية والميتافيزيقية',
  },
  {
    id: 'hellenistic',
    name_ar: 'الفلسفة الهلنستية',
    from: -323,
    to: -31,
    civilization: 'greece',
    color: '#5B84B1',
    center: [31.2, 29.9],
    zoom: 5.5,
    description: 'الرواقية، الأبيقورية، والشكوكية من أثينا إلى الإسكندرية',
  },
];

/**
 * Calculates normalized percentage position [0, 100] for a year in the timeline.
 * In RTL layout:
 *   -3000 (oldest) = 0% from inline-start (right side)
 *   -1 (newest)    = 100% from inline-start (left side)
 * 
 * @param {number} year
 * @param {number} [minYear=MIN_TIMELINE_YEAR]
 * @param {number} [maxYear=MAX_TIMELINE_YEAR]
 * @returns {number} Percentage between 0 and 100
 */
export function yearToPercent(year, minYear = MIN_TIMELINE_YEAR, maxYear = MAX_TIMELINE_YEAR) {
  const span = maxYear - minYear;
  if (span <= 0) return 0;
  const clamped = Math.max(minYear, Math.min(maxYear, year));
  return ((clamped - minYear) / span) * 100;
}

/**
 * Inverse of yearToPercent: converts a percent [0, 100] from inline-start to a year integer.
 * @param {number} percent
 * @param {number} [minYear=MIN_TIMELINE_YEAR]
 * @param {number} [maxYear=MAX_TIMELINE_YEAR]
 * @returns {number}
 */
export function percentToYear(percent, minYear = MIN_TIMELINE_YEAR, maxYear = MAX_TIMELINE_YEAR) {
  const clamped = Math.max(0, Math.min(100, percent));
  const span = maxYear - minYear;
  let year = Math.round(minYear + (clamped / 100) * span);
  if (year === 0) year = -1;
  return year;
}

/**
 * Finds all active eras for a given year.
 * @param {number} year
 * @returns {object[]}
 */
export function getActiveEras(year) {
  return ERAS.filter((era) => year >= era.from && year <= era.to);
}

/**
 * Generates century tick marks across the timeline range.
 * Returns array of { year, isMajor, percent }
 * Major ticks every 500 years (-3000, -2500, -2000, -1500, -1000, -500, -1).
 * Minor ticks every 100 years.
 * @param {number} [minYear=MIN_TIMELINE_YEAR]
 * @param {number} [maxYear=MAX_TIMELINE_YEAR]
 * @returns {Array<{ year: number, isMajor: boolean, percent: number }>}
 */
export function generateCenturyTicks(minYear = MIN_TIMELINE_YEAR, maxYear = MAX_TIMELINE_YEAR) {
  const ticks = [];

  // Start from next century boundary >= minYear
  const start = Math.ceil(minYear / 100) * 100;

  for (let y = start; y <= 0; y += 100) {
    const tickYear = y === 0 ? -1 : y;
    if (tickYear < minYear || tickYear > maxYear) continue;

    const isMajor = Math.abs(tickYear) % 500 === 0 || tickYear === -1 || tickYear === minYear;
    ticks.push({
      year: tickYear,
      isMajor,
      percent: yearToPercent(tickYear, minYear, maxYear),
    });
  }

  return ticks;
}
