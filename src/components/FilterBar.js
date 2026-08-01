/**
 * @file FilterBar.js
 * @description Search, filter, and sort controls for the Trek Grid.
 *
 * Creates a full-featured filter bar DOM element.
 * Fires a `trek:filter-change` CustomEvent upward whenever any control changes.
 *
 * Usage:
 *   import { createFilterBar } from './FilterBar.js';
 *   const { el, getState } = createFilterBar({ totalCount: 45 });
 *   container.appendChild(el);
 */

// ─── Difficulty options ───────────────────────────────────────────────────────
const DIFFICULTY_OPTIONS = ['All', 'Easy', 'Moderate', 'Difficult', 'Very Difficult'];

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'rating',    label: 'Top Rated' },
  { value: 'name',     label: 'A – Z' },
  { value: 'duration', label: 'Shortest First' },
  { value: 'elevation',label: 'Highest Peak' },
];

// ─── Quick-filter tag options ─────────────────────────────────────────────────
const QUICK_TAGS = [
  { value: 'Featured',       label: '⭐ Featured' },
  { value: 'Popular',        label: '🔥 Popular' },
  { value: 'Weekend Trek',   label: '⚡ Weekend' },
  { value: 'Family Friendly',label: '👨‍👩‍👧 Family' },
  { value: 'Camping',        label: '⛺ Camping' },
  { value: 'Offbeat',        label: '🗺️ Offbeat' },
  { value: 'Monsoon Special',label: '🌧️ Monsoon' },
  { value: 'Historical Fort',label: '🏰 Fort Trek' },
  { value: 'Waterfall Trek', label: '💧 Waterfall' },
  { value: 'Pilgrimage',     label: '🙏 Pilgrimage' },
];

// SVG icons
const SVG_SEARCH = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
</svg>`;

const SVG_CLOSE = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
</svg>`;

const SVG_FILTER = `
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
</svg>`;

const SVG_SORT = `
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/>
  <line x1="21" y1="14" x2="9" y2="14"/><line x1="21" y1="18" x2="9" y2="18"/>
</svg>`;

/**
 * @typedef {Object} FilterState
 * @property {string}   search     - Search query string
 * @property {string}   difficulty - "All" or specific level
 * @property {string}   sort       - Sort key
 * @property {string[]} tags       - Active tag filters
 */

/**
 * Creates the filter bar.
 *
 * @param {{ totalCount?: number, onchange?: (state: FilterState) => void }} opts
 * @returns {{ el: HTMLElement, getState: () => FilterState, setCount: (n: number) => void }}
 */
export function createFilterBar({ totalCount = 0, onchange } = {}) {
  /** @type {FilterState} */
  const state = {
    search:     '',
    difficulty: 'All',
    sort:       'rating',
    tags:       [],
  };

  const el = document.createElement('div');
  el.className = 'filter-bar';
  el.setAttribute('role', 'search');
  el.setAttribute('aria-label', 'Filter and search treks');

  el.innerHTML = `
    <div class="filter-bar__top">
      <!-- Search -->
      <div class="filter-bar__search-wrap">
        <span class="filter-search-icon" aria-hidden="true">${SVG_SEARCH}</span>
        <input
          type="search"
          class="filter-bar__search"
          placeholder="Search by name, district, or activity…"
          aria-label="Search treks"
          autocomplete="off"
          id="trek-search-input"
        />
        <button class="filter-search-clear" aria-label="Clear search" hidden id="search-clear-btn">
          ${SVG_CLOSE}
        </button>
      </div>

      <!-- Sort -->
      <div class="filter-bar__sort-wrap">
        <span class="filter-sort-icon" aria-hidden="true">${SVG_SORT}</span>
        <select class="filter-bar__sort" aria-label="Sort treks" id="trek-sort-select">
          ${SORT_OPTIONS.map(o =>
            `<option value="${o.value}" ${o.value === state.sort ? 'selected' : ''}>${o.label}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <!-- Difficulty chips -->
    <div class="filter-bar__difficulty" role="group" aria-label="Filter by difficulty">
      <span class="filter-group-label">${SVG_FILTER} Difficulty:</span>
      <div class="filter-chips" id="difficulty-chips">
        ${DIFFICULTY_OPTIONS.map(d => `
          <button
            class="filter-chip filter-chip--difficulty ${d === state.difficulty ? 'filter-chip--active' : ''}"
            data-difficulty="${d}"
            aria-pressed="${d === state.difficulty}"
            id="diff-chip-${d.toLowerCase().replace(/\s+/g, '-')}"
          >${d}</button>
        `).join('')}
      </div>
    </div>

    <!-- Quick-filter tag chips -->
    <div class="filter-bar__tags" role="group" aria-label="Filter by tag">
      <span class="filter-group-label">Tags:</span>
      <div class="filter-chips filter-chips--tags" id="tag-chips">
        ${QUICK_TAGS.map(t => `
          <button
            class="filter-chip filter-chip--tag"
            data-tag="${t.value}"
            aria-pressed="false"
            id="tag-chip-${t.value.toLowerCase().replace(/\s+/g, '-')}"
          >${t.label}</button>
        `).join('')}
      </div>
    </div>

    <!-- Result count & clear -->
    <div class="filter-bar__footer">
      <p class="filter-bar__count" id="filter-result-count" aria-live="polite">
        Showing <strong id="filter-count-number">${totalCount}</strong> treks
      </p>
      <button class="filter-bar__clear" id="filter-clear-all" aria-label="Clear all filters">
        Clear All
      </button>
    </div>
  `;

  // ─── Wire up interactions ─────────────────────────────────────────────────

  const searchInput = el.querySelector('#trek-search-input');
  const clearBtn    = el.querySelector('#search-clear-btn');
  const sortSelect  = el.querySelector('#trek-sort-select');
  const diffChips   = el.querySelector('#difficulty-chips');
  const tagChips    = el.querySelector('#tag-chips');
  const clearAll    = el.querySelector('#filter-clear-all');

  function emit() {
    const event = new CustomEvent('trek:filter-change', {
      bubbles: true,
      detail: { ...state },
    });
    el.dispatchEvent(event);
    onchange?.({ ...state });
  }

  // Search
  let searchTimer;
  searchInput.addEventListener('input', () => {
    state.search = searchInput.value.trim();
    clearBtn.hidden = !state.search;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(emit, 250); // debounce
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.search = '';
    clearBtn.hidden = true;
    searchInput.focus();
    emit();
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    emit();
  });

  // Difficulty chips
  diffChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip--difficulty');
    if (!chip) return;
    const diff = chip.dataset.difficulty;
    state.difficulty = diff;
    diffChips.querySelectorAll('.filter-chip--difficulty').forEach(c => {
      const isActive = c.dataset.difficulty === diff;
      c.classList.toggle('filter-chip--active', isActive);
      c.setAttribute('aria-pressed', String(isActive));
    });
    emit();
  });

  // Tag chips (multi-select)
  tagChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip--tag');
    if (!chip) return;
    const tag = chip.dataset.tag;
    const idx = state.tags.indexOf(tag);
    if (idx === -1) {
      state.tags.push(tag);
      chip.classList.add('filter-chip--active');
      chip.setAttribute('aria-pressed', 'true');
    } else {
      state.tags.splice(idx, 1);
      chip.classList.remove('filter-chip--active');
      chip.setAttribute('aria-pressed', 'false');
    }
    emit();
  });

  // Clear all
  clearAll.addEventListener('click', () => {
    state.search = '';
    state.difficulty = 'All';
    state.sort = 'rating';
    state.tags = [];

    searchInput.value = '';
    clearBtn.hidden = true;
    sortSelect.value = 'rating';
    diffChips.querySelectorAll('.filter-chip--difficulty').forEach(c => {
      const isAll = c.dataset.difficulty === 'All';
      c.classList.toggle('filter-chip--active', isAll);
      c.setAttribute('aria-pressed', String(isAll));
    });
    tagChips.querySelectorAll('.filter-chip--tag').forEach(c => {
      c.classList.remove('filter-chip--active');
      c.setAttribute('aria-pressed', 'false');
    });
    emit();
  });

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Updates the results count display.
   * @param {number} n
   * @param {number} total
   */
  function setCount(n, total) {
    const num = el.querySelector('#filter-count-number');
    if (num) num.textContent = n;
    const countEl = el.querySelector('#filter-result-count');
    if (countEl) {
      countEl.innerHTML = n === total
        ? `Showing all <strong>${n}</strong> treks`
        : `Showing <strong>${n}</strong> of <strong>${total}</strong> treks`;
    }
  }

  return { el, getState: () => ({ ...state }), setCount };
}
