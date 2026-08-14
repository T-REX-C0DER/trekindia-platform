/**
 * TrekIndia — Trek API Integration
 * Fetches trek data from backend REST API and renders cards + map.
 *
 * Architecture:
 *   TrekAPIClient   — fetch wrapper for all API calls
 *   TrekCardRenderer — render trek cards from API data
 *   TrekExplorer    — the main explore section with search/filter/sort/pagination
 *   StateSection    — updates state cards with live trek counts
 */

'use strict';

/* =============================================
   TREK API CLIENT
   ============================================= */
const TrekAPIClient = {
  BASE: '/api',

  async get(path, params = {}) {
    const url  = new URL(this.BASE + path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    return res.json();
  },

  getMapTreks()             { return this.get('/treks/map'); },
  getTreks(params)          { return this.get('/treks', params); },
  searchTreks(q, limit)     { return this.get('/treks/search', { q, limit }); },
  getStates()               { return this.get('/states'); },
  getStateTreks(s, params)  { return this.get(`/states/${encodeURIComponent(s)}/treks`, params); },
};

/* =============================================
   DIFFICULTY DISPLAY HELPERS
   ============================================= */
const DIFFICULTY_BADGE_CLASS = {
  'Easy':     'easy',
  'Moderate': 'moderate',
  'Difficult':'difficult',
  'Hard':     'difficult',
  'Extreme':  'difficult',
};

function diffClass(diff) {
  return DIFFICULTY_BADGE_CLASS[diff] || 'moderate';
}

function renderStars(rating) {
  if (!rating) return '<span style="color:#6b7d60;font-size:11px;">Unrated</span>';
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let h = '';
  for (let i = 0; i < 5; i++) {
    const fill = i < full ? '#F59E0B' : (i === full && half ? 'url(#hg)' : 'rgba(180,180,180,0.3)');
    h += `<svg width="11" height="11" viewBox="0 0 24 24" fill="${fill}" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
  return h;
}

/* =============================================
   TREK CARD RENDERER
   Creates a trek card article element from API data.
   Images are intentionally left blank per requirements.
   ============================================= */
const TrekCardRenderer = {
  create(trek, index = 0) {
    const el = document.createElement('article');
    el.className = 'trek-card';
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${trek.name} trek`);
    el.dataset.trekSlug = trek.slug;
    el.style.transitionDelay = `${(index % 6) * 0.07}s`;

    const elevation = trek.elevation_m ? `${trek.elevation_m.toLocaleString()} m` : (trek.highest_point_m ? `${trek.highest_point_m.toLocaleString()} m` : '—');
    const distance  = trek.distance_km ? `${trek.distance_km} km` : '—';
    const duration  = trek.duration_label || (trek.duration_hours ? `${trek.duration_hours}h` : '—');
    const season    = trek.best_time || '—';
    const rating    = trek.rating ? parseFloat(trek.rating).toFixed(1) : '—';
    const district  = trek.district || '';
    const location  = district ? `${district}, ${trek.state}` : trek.state;

    el.innerHTML = `
      <div class="trek-card-img-wrap">
        <div class="trek-card-img-placeholder" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3">
            <path d="M3 20L9 8l4 6 3-4 5 10"/>
            <circle cx="18" cy="5" r="2"/>
          </svg>
        </div>
        <div class="trek-card-overlay"></div>
        <span class="difficulty-badge ${diffClass(trek.difficulty)}">${trek.difficulty || 'Moderate'}</span>
        <button class="bookmark-btn" aria-label="Save ${trek.name}" data-trek-id="${trek.trek_id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
          </svg>
        </button>
      </div>
      <div class="trek-card-body">
        <div class="trek-meta-top">
          <span class="trek-state">${location}</span>
          <div class="trek-rating">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            ${rating}
          </div>
        </div>
        <div class="trek-key-metrics">
          <div class="metric-item">
            <span class="metric-icon">🕒</span>
            <span class="metric-value">${duration}</span>
          </div>
          <div class="metric-item">
            <span class="metric-icon">🥾</span>
            <span class="metric-value">${distance}</span>
          </div>
          <div class="metric-item">
            <span class="metric-icon">⛰️</span>
            <span class="metric-label">Summit</span>
            <span class="metric-value">${elevation}</span>
          </div>
        </div>
        <h3 class="trek-name">${trek.name}</h3>
        <div class="trek-footer">
          <span class="trek-season">Best: ${season}</span>
          <a href="/trek-detail.html?slug=${trek.slug}" class="btn-explore-sm" aria-label="View ${trek.name} details">View Details</a>
        </div>
      </div>
    `;

    // Click anywhere on card → detail page
    el.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-btn')) return;
      window.location.href = `/trek-detail.html?slug=${trek.slug}`;
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window.location.href = `/trek-detail.html?slug=${trek.slug}`;
    });

    return el;
  },
};

/* =============================================
   LOADING SKELETON
   ============================================= */
function createSkeletonCards(count = 4) {
  return Array.from({ length: count }, (_, i) => {
    const el = document.createElement('article');
    el.className = 'trek-card trek-card-skeleton';
    el.innerHTML = `
      <div class="trek-card-img-wrap">
        <div class="trek-card-img-placeholder skeleton-pulse"></div>
      </div>
      <div class="trek-card-body">
        <div class="skeleton-line w-60 skeleton-pulse mb-8"></div>
        <div class="skeleton-line w-40 skeleton-pulse mb-16"></div>
        <div class="skeleton-line w-80 skeleton-pulse mb-8"></div>
        <div class="skeleton-line w-50 skeleton-pulse"></div>
      </div>
    `;
    return el;
  });
}

/* =============================================
   TREK EXPLORER — Full explore section
   ============================================= */
const TrekExplorer = {
  currentPage:    1,
  limit:          12,
  totalTreks:     0,
  totalPages:     0,
  activeFilters:  {},
  searchDebounce: null,
  isLoading:      false,
  gridEl:         null,
  paginationEl:   null,
  countEl:        null,

  async init() {
    this.gridEl       = document.getElementById('exploreTrekGrid');
    this.paginationEl = document.getElementById('explorePagination');
    this.countEl      = document.getElementById('exploreTrekCount');

    if (!this.gridEl) return;

    this.bindSearchInput();
    this.bindFilters();
    this.bindSort();
    await this.load();
  },

  bindSearchInput() {
    const input = document.getElementById('exploreSearchInput');
    if (!input) return;
    input.addEventListener('input', () => {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        const q = input.value.trim();
        if (q.length === 0) {
          delete this.activeFilters.search;
          this.currentPage = 1;
          this.load();
        } else if (q.length >= 2) {
          this.activeFilters.search = q;
          this.currentPage = 1;
          this.loadSearch(q);
        }
      }, 400);
    });
  },

  bindFilters() {
    const stateSelect = document.getElementById('exploreStateFilter');
    const diffSelect  = document.getElementById('exploreDiffFilter');
    const ratingSelect= document.getElementById('exploreRatingFilter');

    stateSelect?.addEventListener('change', () => {
      this.activeFilters.state = stateSelect.value || null;
      this.currentPage = 1;
      this.load();
    });
    diffSelect?.addEventListener('change', () => {
      this.activeFilters.difficulty = diffSelect.value || null;
      this.currentPage = 1;
      this.load();
    });
    ratingSelect?.addEventListener('change', () => {
      this.activeFilters.minRating = ratingSelect.value || null;
      this.currentPage = 1;
      this.load();
    });
  },

  bindSort() {
    const sortSelect = document.getElementById('exploreSortSelect');
    if (!sortSelect) return;
    sortSelect.addEventListener('change', () => {
      const [sort, order] = sortSelect.value.split(':');
      this.activeFilters.sort  = sort;
      this.activeFilters.order = order;
      this.currentPage = 1;
      this.load();
    });
  },

  async loadSearch(q) {
    this.setLoading(true);
    try {
      const res = await TrekAPIClient.searchTreks(q, 50);
      if (res.success) {
        this.renderCards(res.data, true);
        this.updateCount(res.count, res.count, 1);
        if (this.paginationEl) this.paginationEl.innerHTML = '';
      }
    } catch (e) {
      this.renderError('Search failed. Please try again.');
    } finally {
      this.setLoading(false);
    }
  },

  async load() {
    if (this.isLoading) return;
    this.setLoading(true);
    try {
      const params = {
        page:  this.currentPage,
        limit: this.limit,
        ...Object.fromEntries(
          Object.entries(this.activeFilters).filter(([, v]) => v !== null && v !== undefined && v !== '')
        ),
      };
      const res = await TrekAPIClient.getTreks(params);
      if (res.success) {
        this.renderCards(res.data, false);
        this.totalTreks  = res.pagination.total;
        this.totalPages  = res.pagination.totalPages;
        this.updateCount(res.data.length, res.pagination.total, res.pagination.page);
        this.renderPagination(res.pagination);

        // Sync Leaflet map if available
        this.syncMapFilters(params);
      }
    } catch (e) {
      this.renderError('Failed to load treks. Please refresh.');
    } finally {
      this.setLoading(false);
    }
  },

  syncMapFilters(params) {
    // If Leaflet map is loaded, update its markers to reflect current filters
    if (window.trekMapInstance) {
      const { markerManager } = window.trekMapInstance;
      const filters = {
        state:      params.state      || null,
        difficulty: params.difficulty ? [params.difficulty] : [],
      };
      markerManager.filterByAll(filters);
    }
  },

  renderCards(treks, animate = false) {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';
    if (!treks || treks.length === 0) {
      this.gridEl.innerHTML = `
        <div class="explore-empty-state" style="grid-column:1/-1;text-align:center;padding:60px 20px;">
          <div style="font-size:48px;margin-bottom:16px;">🏔️</div>
          <h3 style="font-size:20px;font-weight:700;margin-bottom:8px;color:var(--color-text);">No treks found</h3>
          <p style="color:var(--color-text-muted);font-size:14px;">Try adjusting your filters or search terms.</p>
        </div>`;
      return;
    }
    treks.forEach((trek, i) => {
      const card = TrekCardRenderer.create(trek, i);
      this.gridEl.appendChild(card);
      if (animate) {
        requestAnimationFrame(() => card.classList.add('visible'));
      } else {
        // Staggered reveal
        setTimeout(() => card.classList.add('visible'), i * 60);
      }
    });
  },

  renderPagination(pagination) {
    if (!this.paginationEl) return;
    const { page, totalPages } = pagination;
    if (totalPages <= 1) { this.paginationEl.innerHTML = ''; return; }

    let html = `<div class="explore-pagination" role="navigation" aria-label="Trek pages">`;

    // Prev
    html += `<button class="page-btn ${page <= 1 ? 'disabled' : ''}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>`;

    // Pages
    const range = this.pageRange(page, totalPages);
    range.forEach(p => {
      if (p === '...') {
        html += `<span class="page-ellipsis">…</span>`;
      } else {
        html += `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`;
      }
    });

    // Next
    html += `<button class="page-btn ${page >= totalPages ? 'disabled' : ''}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`;

    html += '</div>';
    this.paginationEl.innerHTML = html;

    this.paginationEl.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p && p !== this.currentPage) {
          this.currentPage = p;
          this.load();
          // Scroll to explore section
          const section = document.getElementById('explore-all');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  },

  pageRange(current, total) {
    const delta = 2;
    const range = [];
    const pages = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2)      range.unshift('...');
    if (current + delta < total - 1) range.push('...');

    range.unshift(1);
    if (total > 1) range.push(total);

    return range;
  },

  updateCount(shown, total, page) {
    if (!this.countEl) return;
    this.countEl.textContent = `Showing ${shown} of ${total.toLocaleString()} treks`;
  },

  setLoading(state) {
    this.isLoading = state;
    if (!this.gridEl) return;
    if (state) {
      this.gridEl.innerHTML = '';
      createSkeletonCards(this.limit > 12 ? 12 : this.limit).forEach(s => this.gridEl.appendChild(s));
    }
  },

  renderError(message) {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--color-text-muted);">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <p style="font-size:14px;">${message}</p>
      </div>`;
  },
};

/* =============================================
   STATE SECTION — Updates trek counts from live API
   ============================================= */
const StateSection = {
  async init() {
    try {
      const res = await TrekAPIClient.getStates();
      if (!res.success) return;

      const stateMap = new Map(res.data.map(s => [s.name.toLowerCase(), s]));

      // Update state-item elements in the map sidebar / state section
      document.querySelectorAll('.state-item[data-state]').forEach(el => {
        const key = el.dataset.state.toLowerCase();
        const s   = stateMap.get(key);
        if (!s) return;

        // Update trek count badge
        const countEl = el.querySelector('.state-trek-count');
        if (countEl) {
          countEl.textContent = `${s.trek_count} Treks`;
        }

        // Add state click to load trek explorer with state filter
        el.addEventListener('click', () => {
          const exploreSection = document.getElementById('explore-all');
          if (exploreSection) {
            const stateSelect = document.getElementById('exploreStateFilter');
            if (stateSelect) {
              stateSelect.value           = s.name;
              TrekExplorer.activeFilters.state = s.name;
              TrekExplorer.currentPage    = 1;
              TrekExplorer.load();
              exploreSection.scrollIntoView({ behavior: 'smooth' });
            }
          }
        });
      });

      // Populate the state filter dropdown in explore section
      const stateSelect = document.getElementById('exploreStateFilter');
      if (stateSelect && stateSelect.options.length <= 1) {
        res.data
          .filter(s => s.trek_count > 0)
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach(s => {
            const opt = document.createElement('option');
            opt.value       = s.name;
            opt.textContent = `${s.name} (${s.trek_count})`;
            stateSelect.appendChild(opt);
          });
      }
    } catch (e) {
      console.warn('TrekIndia: Could not load state counts', e);
    }
  },
};

/* =============================================
   HERO SEARCH — wires hero search bar to explore section
   ============================================= */
function initHeroSearch() {
  const heroInput = document.querySelector('.hero-search input');
  const heroBtn   = document.querySelector('.hero-search-btn');

  function doHeroSearch() {
    const q = heroInput?.value?.trim();
    if (!q) return;
    const exploreSection = document.getElementById('explore-all');
    if (exploreSection) {
      const exploreInput = document.getElementById('exploreSearchInput');
      if (exploreInput) {
        exploreInput.value = q;
        TrekExplorer.activeFilters.search = q;
        TrekExplorer.currentPage = 1;
        TrekExplorer.loadSearch(q);
      }
      exploreSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  heroBtn?.addEventListener('click', doHeroSearch);
  heroInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doHeroSearch(); });

  // Hero pills
  document.querySelectorAll('.hero-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      if (heroInput) heroInput.value = pill.textContent;
      doHeroSearch();
    });
  });
}

/* =============================================
   GLOBAL MAP INTEGRATION
   Override the map.js loadTreks to use the API
   ============================================= */
window.TREKINDIA_MAP_API_URL = '/api/treks/map';

/* =============================================
   BOOT
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize hero search
  initHeroSearch();

  // Initialize state counts
  await StateSection.init();

  // Initialize explore section
  await TrekExplorer.init();
});
