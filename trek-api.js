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
  getGear(params)           { return this.get('/gear', params); },
  getGearCategories()       { return this.get('/gear/categories'); },
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
          <h3 style="font-size:20px;font-weight:700;margin-bottom:8px;color:var(--text);">No treks found</h3>
          <p style="color:var(--text-secondary);font-size:14px;">Try adjusting your filters or search terms.</p>
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
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary);">
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
   ESSENTIAL TREK GEAR MARKETPLACE (DYNAMIC & DATABASE-DRIVEN)
   ============================================= */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCategoryPlaceholderIcon(category = '') {
  const cat = (category || '').toLowerCase();
  if (cat.includes('shoe') || cat.includes('boot') || cat.includes('footwear')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3l3 4h8a4 4 0 0 0 4-4v-1a2 2 0 0 0-2-2h-3l-2-4H7L3 11v3z"/><path d="M8 18v2"/><path d="M12 18v2"/><path d="M16 18v2"/></svg>`;
  }
  if (cat.includes('pack') || cat.includes('bag') || cat.includes('rucksack')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="14" rx="3"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/><path d="M4 13h16"/><path d="M9 13v5"/><path d="M15 13v5"/></svg>`;
  }
  if (cat.includes('tent') || cat.includes('camp')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21 12 4 5 21"/><path d="M12 4v17"/><path d="m9 16 3-3 3 3"/><path d="M2 21h20"/></svg>`;
  }
  if (cat.includes('jacket') || cat.includes('cloth') || cat.includes('rain') || cat.includes('layer')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/><path d="M12 2v20"/></svg>`;
  }
  if (cat.includes('pole')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 14-14"/><path d="m15 3 6 6"/><path d="m14 8 2 2"/><path d="m10 12 2 2"/><path d="M3 21l3-1-2-2z"/></svg>`;
  }
  if (cat.includes('lamp') || cat.includes('light') || cat.includes('torch')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><circle cx="12" cy="12" r="5"/></svg>`;
  }
  if (cat.includes('sleep') || cat.includes('mat')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/><path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2"/><path d="M7 7h10"/><path d="M7 11h10"/><path d="M7 15h6"/></svg>`;
  }
  if (cat.includes('cook') || cat.includes('food') || cat.includes('stove')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
  }
  if (cat.includes('safe') || cat.includes('aid') || cat.includes('first')) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`;
  }
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08 9 11l4 5"/></svg>`;
}

const GearMarketplace = {
  trackEl: null,
  tabsEl: null,
  btnLeft: null,
  btnRight: null,
  currentCategory: 'all',
  cachedProducts: {},

  async init() {
    this.trackEl  = document.getElementById('gearTrack');
    this.tabsEl   = document.getElementById('gearCategoryTabs');
    this.btnLeft  = document.getElementById('gearScrollLeft');
    this.btnRight = document.getElementById('gearScrollRight');

    if (!this.trackEl) return;

    this.bindEvents();
    await this.loadCategories();
    await this.loadProducts('all');
  },

  bindEvents() {
    if (this.btnLeft) {
      this.btnLeft.addEventListener('click', () => this.scrollByDirection(-1));
    }
    if (this.btnRight) {
      this.btnRight.addEventListener('click', () => this.scrollByDirection(1));
    }

    if (this.trackEl) {
      let scrollTimer = null;
      this.trackEl.addEventListener('scroll', () => {
        if (scrollTimer) cancelAnimationFrame(scrollTimer);
        scrollTimer = requestAnimationFrame(() => this.updateScrollBtns());
      }, { passive: true });
    }

    window.addEventListener('resize', () => this.updateScrollBtns(), { passive: true });
  },

  scrollByDirection(direction) {
    if (!this.trackEl) return;
    const cardEl = this.trackEl.querySelector('.gear-card, .gear-skeleton-card');
    const cardWidth = cardEl ? cardEl.offsetWidth + 22 : 300;
    const visibleCards = Math.max(1, Math.floor(this.trackEl.clientWidth / cardWidth));
    const scrollAmount = cardWidth * Math.max(1, visibleCards >= 3 ? visibleCards - 1 : visibleCards);

    this.trackEl.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  },

  updateScrollBtns() {
    if (!this.trackEl || !this.btnLeft || !this.btnRight) return;

    const scrollLeft = this.trackEl.scrollLeft;
    const maxScroll = Math.max(0, this.trackEl.scrollWidth - this.trackEl.clientWidth);

    const isAtStart = scrollLeft <= 4;
    const isAtEnd = scrollLeft >= maxScroll - 4;
    const noScrollNeeded = maxScroll <= 2;

    this.btnLeft.disabled = isAtStart || noScrollNeeded;
    this.btnLeft.setAttribute('aria-disabled', (isAtStart || noScrollNeeded) ? 'true' : 'false');

    this.btnRight.disabled = isAtEnd || noScrollNeeded;
    this.btnRight.setAttribute('aria-disabled', (isAtEnd || noScrollNeeded) ? 'true' : 'false');
  },

  async loadCategories() {
    if (!this.tabsEl) return;

    try {
      const res = await TrekAPIClient.getGearCategories();
      if (res && res.success && Array.isArray(res.data)) {
        let html = `<button class="gear-tab active" role="tab" aria-selected="true" data-gear-filter="all">All</button>`;
        res.data.forEach(cat => {
          html += `<button class="gear-tab" role="tab" aria-selected="false" data-gear-filter="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</button>`;
        });
        this.tabsEl.innerHTML = html;

        // Attach click listeners to tabs
        this.tabsEl.querySelectorAll('.gear-tab').forEach(tab => {
          tab.addEventListener('click', () => {
            const filter = tab.dataset.gearFilter;
            this.setCategory(filter, tab);
          });
        });
      }
    } catch (err) {
      console.warn('TrekIndia: Could not load dynamic gear categories', err);
    }
  },

  async setCategory(categoryName, activeTabEl) {
    if (this.currentCategory === categoryName) return;
    this.currentCategory = categoryName;

    // Update active tab styling
    if (this.tabsEl) {
      this.tabsEl.querySelectorAll('.gear-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      if (activeTabEl) {
        activeTabEl.classList.add('active');
        activeTabEl.setAttribute('aria-selected', 'true');
      }
    }

    // Reset scroll to beginning immediately
    if (this.trackEl) {
      this.trackEl.scrollTo({ left: 0, behavior: 'smooth' });
    }

    await this.loadProducts(categoryName);
  },

  renderSkeletons(count = 4) {
    if (!this.trackEl) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="gear-skeleton-card" aria-hidden="true">
          <div class="gear-skeleton-img"></div>
          <div class="gear-skeleton-line gear-skeleton-line--short"></div>
          <div class="gear-skeleton-line gear-skeleton-line--long"></div>
          <div class="gear-skeleton-line gear-skeleton-line--med"></div>
          <div style="margin-top:auto;display:flex;flex-direction:column;gap:6px;">
            <div class="gear-skeleton-line gear-skeleton-line--long"></div>
            <div class="gear-skeleton-line gear-skeleton-line--long"></div>
          </div>
        </div>
      `;
    }
    this.trackEl.innerHTML = html;
    this.updateScrollBtns();
  },

  async loadProducts(category = 'all') {
    if (!this.trackEl) return;

    // Show skeleton
    this.renderSkeletons(4);

    try {
      const params = { limit: 40 };
      if (category && category !== 'all') {
        params.category = category;
      }

      const res = await TrekAPIClient.getGear(params);
      if (res && res.success && Array.isArray(res.data)) {
        this.renderCards(res.data);
      } else {
        this.renderEmpty();
      }
    } catch (err) {
      console.error('TrekIndia: Error loading gear products:', err);
      this.renderError();
    }
  },

  renderCards(products) {
    if (!this.trackEl) return;

    if (!products || products.length === 0) {
      this.renderEmpty();
      return;
    }

    const html = products.map((product, index) => this.createCardHtml(product, index)).join('');
    this.trackEl.innerHTML = html;

    // Attach wishlist button listeners
    this.trackEl.querySelectorAll('.gear-wishlist-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isWishlisted = btn.dataset.wishlisted === 'true';
        btn.dataset.wishlisted = !isWishlisted ? 'true' : 'false';
        btn.classList.toggle('wishlisted', !isWishlisted);
        const name = btn.dataset.productName || 'product';
        btn.setAttribute('aria-label', !isWishlisted ? `Remove ${name} from favorites` : `Add ${name} to favorites`);
      });
    });

    // Reset scroll to 0 and update scroll button states
    this.trackEl.scrollTo({ left: 0, behavior: 'instant' });
    requestAnimationFrame(() => this.updateScrollBtns());
  },

  createCardHtml(product, index = 0) {
    const hasImage = product.image_url && String(product.image_url).trim().length > 0;
    const category = product.category || 'Trek Gear';
    const name = product.product_name || 'Trek Gear';
    const brand = product.brand || '';
    const description = product.description && product.description.trim().length > 0 ? product.description : '';

    const iconSvg = getCategoryPlaceholderIcon(category);

    // Image / Placeholder Markup
    let mediaMarkup = '';
    if (hasImage) {
      mediaMarkup = `
        <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(name)}" class="gear-img" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'gear-placeholder\\'><div class=\\'gear-placeholder-icon\\'>${iconSvg.replace(/'/g, "\\'")}</div><span class=\\'gear-placeholder-tag\\'>${escapeHtml(category)}</span></div>';" />
      `;
    } else {
      mediaMarkup = `
        <div class="gear-placeholder" aria-hidden="true">
          <div class="gear-placeholder-icon">${iconSvg}</div>
          <span class="gear-placeholder-tag">${escapeHtml(category)}</span>
        </div>
      `;
    }

    // Where to Buy Store Links (Amazon, Flipkart, Official Brand)
    const storeLinks = [];

    if (product.amazon_url && String(product.amazon_url).trim().length > 0) {
      storeLinks.push(`
        <a href="${escapeHtml(product.amazon_url)}" target="_blank" rel="noopener noreferrer" class="gear-store-btn gear-store-btn--amazon" aria-label="Buy ${escapeHtml(name)} on Amazon (opens in new tab)">
          <span class="gear-store-btn-name">
            <span class="gear-store-dot" aria-hidden="true"></span>
            <span>Amazon</span>
          </span>
          <span class="gear-store-arrow" aria-hidden="true">↗</span>
        </a>
      `);
    }

    if (product.flipkart_url && String(product.flipkart_url).trim().length > 0) {
      storeLinks.push(`
        <a href="${escapeHtml(product.flipkart_url)}" target="_blank" rel="noopener noreferrer" class="gear-store-btn gear-store-btn--flipkart" aria-label="Buy ${escapeHtml(name)} on Flipkart (opens in new tab)">
          <span class="gear-store-btn-name">
            <span class="gear-store-dot" aria-hidden="true"></span>
            <span>Flipkart</span>
          </span>
          <span class="gear-store-arrow" aria-hidden="true">↗</span>
        </a>
      `);
    }

    if (product.brand_url && String(product.brand_url).trim().length > 0) {
      storeLinks.push(`
        <a href="${escapeHtml(product.brand_url)}" target="_blank" rel="noopener noreferrer" class="gear-store-btn gear-store-btn--brand" aria-label="Buy ${escapeHtml(name)} from Official Brand (opens in new tab)">
          <span class="gear-store-btn-name">
            <span class="gear-store-dot" aria-hidden="true"></span>
            <span>Official Brand</span>
          </span>
          <span class="gear-store-arrow" aria-hidden="true">↗</span>
        </a>
      `);
    }

    const storeLinksHtml = storeLinks.length > 0
      ? storeLinks.join('')
      : `<a href="https://www.google.com/search?q=${encodeURIComponent(name + ' buy online')}" target="_blank" rel="noopener noreferrer" class="gear-store-btn" aria-label="Search ${escapeHtml(name)} online (opens in new tab)"><span class="gear-store-btn-name"><span class="gear-store-dot"></span>Find Online</span><span class="gear-store-arrow" aria-hidden="true">↗</span></a>`;

    const descHtml = description
      ? `<p class="gear-card-desc">${escapeHtml(description)}</p>`
      : '';

    const brandHtml = brand
      ? `<div class="gear-card-brand">${escapeHtml(brand)}</div>`
      : '';

    return `
      <div class="gear-card" data-category="${escapeHtml(category)}" data-product-id="${product.id}" role="listitem">
        <div class="gear-card-img-wrap">
          ${mediaMarkup}
          <button class="gear-wishlist-btn" aria-label="Add ${escapeHtml(name)} to favorites" data-wishlisted="false" data-product-name="${escapeHtml(name)}" data-product-id="${product.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
        <div class="gear-card-body">
          <div class="gear-card-info">
            <div class="gear-card-category">${escapeHtml(category)}</div>
            <h3 class="gear-card-name" title="${escapeHtml(name)}">${escapeHtml(name)}</h3>
            ${brandHtml}
            ${descHtml}
          </div>
          <div class="gear-where-to-buy">
            <div class="gear-buy-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <span>WHERE TO BUY</span>
            </div>
            <div class="gear-store-links">
              ${storeLinksHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderEmpty() {
    if (!this.trackEl) return;
    this.trackEl.innerHTML = `
      <div class="gear-empty-state">
        <div class="gear-state-icon" aria-hidden="true">🎒</div>
        <div class="gear-state-title">No gear available in this category yet.</div>
        <div class="gear-state-subtitle">Explore other outdoor categories or view all gear items.</div>
      </div>
    `;
    this.updateScrollBtns();
  },

  renderError() {
    if (!this.trackEl) return;
    this.trackEl.innerHTML = `
      <div class="gear-error-state">
        <div class="gear-state-icon" aria-hidden="true">⚠️</div>
        <div class="gear-state-title">Gear couldn't be loaded right now.</div>
        <div class="gear-state-subtitle">Please check your network connection and try again.</div>
        <button class="gear-retry-btn" onclick="GearMarketplace.loadProducts(GearMarketplace.currentCategory)">Retry</button>
      </div>
    `;
    this.updateScrollBtns();
  }
};

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

  // Initialize Essential Trek Gear marketplace
  await GearMarketplace.init();
});

