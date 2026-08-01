/**
 * @file TrekGrid.js
 * @description Trek Grid — orchestrates FilterBar + TrekCard rendering.
 *
 * Handles:
 *  - Filter/search/sort via FilterBar events
 *  - Pagination (12 cards per page)
 *  - IntersectionObserver-based card entrance animations
 *  - "No results" empty state
 *
 * Usage:
 *   import { createTrekGrid } from './TrekGrid.js';
 *   const grid = createTrekGrid({ treks: maharashtrasTreks });
 *   document.getElementById('treks-section').appendChild(grid);
 */

import { createFilterBar }  from './FilterBar.js';
import { createTrekCard }   from './TrekCard.js';
import {
  filterBySearch,
  filterByDifficulty,
  filterByTags,
  sortTreks,
} from '../utils/formatters.js';

const PAGE_SIZE = 12;

// SVG for empty state
const SVG_COMPASS = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
</svg>`;

/**
 * @param {{ treks: import('../types/trek.js').Trek[], pageSize?: number }} opts
 * @returns {HTMLElement}
 */
export function createTrekGrid({ treks = [], pageSize = PAGE_SIZE } = {}) {
  let currentPage     = 1;
  let filteredTreks   = [...treks];

  // ─── Wrapper element ───────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.className = 'trek-grid-wrapper';

  // ─── Filter Bar ────────────────────────────────────────────────────────────
  const { el: filterBarEl, setCount } = createFilterBar({
    totalCount: treks.length,
    onchange: (state) => {
      currentPage = 1;
      applyFilters(state);
    },
  });
  wrapper.appendChild(filterBarEl);

  // ─── Grid container ────────────────────────────────────────────────────────
  const gridEl = document.createElement('div');
  gridEl.className = 'trek-grid';
  gridEl.setAttribute('role', 'list');
  gridEl.setAttribute('aria-label', 'Trek cards grid');
  wrapper.appendChild(gridEl);

  // ─── Pagination ────────────────────────────────────────────────────────────
  const paginationEl = document.createElement('div');
  paginationEl.className = 'trek-pagination';
  paginationEl.setAttribute('role', 'navigation');
  paginationEl.setAttribute('aria-label', 'Pagination');
  wrapper.appendChild(paginationEl);

  // ─── IntersectionObserver for card entrance animations ─────────────────────
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('trek-card--visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );

  // ─── Render logic ──────────────────────────────────────────────────────────

  function applyFilters(state) {
    let result = [...treks];
    result = filterBySearch(result, state.search || '');
    result = filterByDifficulty(result, state.difficulty || 'All');
    result = filterByTags(result, state.tags || []);
    result = sortTreks(result, state.sort || 'rating');
    filteredTreks = result;
    setCount(result.length, treks.length);
    renderPage();
  }

  function renderPage() {
    const totalPages = Math.ceil(filteredTreks.length / pageSize) || 1;
    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const end   = start + pageSize;
    const pageItems = filteredTreks.slice(start, end);

    // Render cards
    if (pageItems.length === 0) {
      renderEmptyState();
    } else {
      const fragment = document.createDocumentFragment();
      pageItems.forEach((trek, i) => {
        const card = createTrekCard(trek);
        card.setAttribute('role', 'listitem');
        // Stagger animation delay
        card.style.setProperty('--card-delay', `${(i % pageSize) * 0.04}s`);
        fragment.appendChild(card);
      });
      gridEl.innerHTML = '';
      gridEl.appendChild(fragment);

      // Observe all cards for entrance animation
      gridEl.querySelectorAll('.trek-card').forEach(card => observer.observe(card));
    }

    // Render pagination
    renderPagination(totalPages);

    // Scroll to top of grid smoothly
    gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderEmptyState() {
    gridEl.innerHTML = `
      <div class="trek-grid__empty" role="status" aria-live="polite">
        <span class="empty-icon" aria-hidden="true">${SVG_COMPASS}</span>
        <h3>No treks found</h3>
        <p>Try adjusting your search or filters to discover more trails.</p>
        <button class="empty-reset-btn" id="empty-reset">Clear all filters</button>
      </div>
    `;
    gridEl.querySelector('#empty-reset')?.addEventListener('click', () => {
      // Trigger clear via filter bar
      filterBarEl.querySelector('#filter-clear-all')?.click();
    });
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    let html = '';

    // Prev button
    html += `
      <button class="trek-page-btn trek-page-btn--nav ${currentPage === 1 ? 'trek-page-btn--disabled' : ''}"
        data-action="prev" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''}>
        ‹ Prev
      </button>`;

    // Page number buttons
    const pages = getPageNumbers(currentPage, totalPages);
    pages.forEach(p => {
      if (p === '…') {
        html += `<span class="trek-page-ellipsis" aria-hidden="true">…</span>`;
      } else {
        html += `
          <button class="trek-page-btn ${p === currentPage ? 'trek-page-btn--active' : ''}"
            data-action="goto" data-page="${p}"
            aria-label="Go to page ${p}" ${p === currentPage ? 'aria-current="page"' : ''}>
            ${p}
          </button>`;
      }
    });

    // Next button
    html += `
      <button class="trek-page-btn trek-page-btn--nav ${currentPage === totalPages ? 'trek-page-btn--disabled' : ''}"
        data-action="next" aria-label="Next page" ${currentPage === totalPages ? 'disabled' : ''}>
        Next ›
      </button>`;

    paginationEl.innerHTML = html;

    // Wire pagination clicks
    paginationEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.trek-page-btn');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      if (action === 'prev')   currentPage = Math.max(1, currentPage - 1);
      else if (action === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else if (action === 'goto') currentPage = parseInt(btn.dataset.page, 10);
      renderPage();
    }, { once: false });
  }

  /** Smart page number range (e.g. [1, '…', 4, 5, 6, '…', 10]) */
  function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3)  pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  // ─── Initial render ────────────────────────────────────────────────────────
  applyFilters({ search: '', difficulty: 'All', sort: 'rating', tags: [] });

  return wrapper;
}
