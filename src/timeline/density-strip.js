/**
 * density-strip.js - Philosophy Timeline Atlas (أطلس تاريخ الفلسفة)
 * Renders figure density indicators and active thinker markers along the timeline.
 * 
 * Rules (from PLAN.md T4.5):
 * - Small marks on the timeline showing where figures exist.
 * - Helps users easily discover active thinkers and "busy" intellectual eras.
 * - Clicking a mark jumps the timeline to that thinker's active period.
 */

import { yearToPercent } from './era-data.js';
import { formatHistoricalYear } from '../utils/format.js';

/**
 * Fetches figures from public/data/figures.json.
 * @returns {Promise<Array<object>>}
 */
export async function loadFiguresData() {
  try {
    const baseUrl = (import.meta.env && import.meta.env.BASE_URL) || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const res = await fetch(`${cleanBase}data/figures.json`);
    if (!res.ok) {
      console.warn('Failed to load figures for density strip: HTTP', res.status);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn('Error loading figures for density strip:', err);
    return [];
  }
}

/**
 * Creates and renders the figure density strip element.
 * @param {HTMLElement} container - The container to append the density strip into.
 * @param {Array<object>} figures - Figures dataset.
 * @param {object} options
 * @param {function(year: number, figureId?: string): void} options.onJumpToYear - Callback when user clicks a figure mark
 * @returns {HTMLElement} The created density strip element
 */
export function renderDensityStrip(container, figures = [], { onJumpToYear } = {}) {
  const strip = document.createElement('div');
  strip.className = 'timeline-density-strip';
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'مؤشرات كثافة الفلاسفة والمفكرين عبر التاريخ');

  if (!Array.isArray(figures) || figures.length === 0) {
    return strip;
  }

  // Map kind to Arabic label
  const KIND_LABELS = {
    philosopher: 'فيلسوف',
    sage: 'حكيم / أدب الحكمة',
    'religious-thinker': 'مفكّر ديني',
  };

  figures.forEach((fig) => {
    const fromYear = fig.active?.from ?? fig.birth?.year;
    const toYear = fig.active?.to ?? fig.death?.year ?? fromYear;

    if (typeof fromYear !== 'number') return;

    // Midpoint or start percent
    const midYear = Math.round((fromYear + toYear) / 2);
    const percent = yearToPercent(midYear);

    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = `density-mark density-mark--${fig.kind || 'philosopher'}`;
    mark.style.setProperty('--mark-pos', `${percent}%`);
    mark.id = `density-mark-${fig.id}`;

    const kindLabel = KIND_LABELS[fig.kind] || 'مفكر';
    const datesFormatted = `${formatHistoricalYear(fromYear)} – ${formatHistoricalYear(toYear)}`;
    const tooltipText = `${fig.name_ar} (${kindLabel}) • ${datesFormatted}`;

    mark.setAttribute('aria-label', tooltipText);
    mark.setAttribute('data-tooltip', tooltipText);
    mark.title = tooltipText;

    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onJumpToYear) {
        onJumpToYear(midYear, fig.id);
      }
    });

    strip.appendChild(mark);
  });

  container.appendChild(strip);
  return strip;
}
