/**
 * TrekIndia — Interactive Leaflet Map
 * Premium Explore India by State Section
 *
 * Architecture:
 * - TrekMap        : Core map init, tile layers, controls
 * - MarkerManager  : Load treks.json with inline fallback, create SVG markers, clustering
 * - PopupManager   : Glassmorphism trek popup cards
 * - SearchManager  : Floating search with live suggestions
 * - FilterManager  : Slide-in filter sidebar
 * - StateInteraction : Sidebar → map flyTo + marker highlight
 * - LocationManager: Locate Me with pulsing dot
 */

(function () {
  'use strict';

  /* =============================================
     INLINE TREK DATA FALLBACK
     Kept empty — all data comes from /api/treks/map
     ============================================= */
  const INLINE_TREKS = [];

  /* =============================================
     TILE LAYERS CONFIG
     ============================================= */
  const TILE_LAYERS = {
    standard: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '© <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)',
      maxZoom: 17,
    },
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: '© <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, HERE, Garmin',
      maxZoom: 16,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
      maxZoom: 18,
    },
  };

  /* State coordinates for flyTo */
  const STATE_COORDS = {
    'Uttarakhand':       { lat: 30.3165, lng: 78.0322, zoom: 8 },
    'Himachal Pradesh':  { lat: 31.1048, lng: 77.1734, zoom: 8 },
    'Jammu & Kashmir':   { lat: 34.0837, lng: 74.7973, zoom: 7 },
    'Maharashtra':       { lat: 19.7515, lng: 75.7139, zoom: 8 },
    'Sikkim':            { lat: 27.5330, lng: 88.5122, zoom: 9 },
    'Karnataka':         { lat: 15.3173, lng: 75.7139, zoom: 8 },
    'Kerala':            { lat: 10.8505, lng: 76.2711, zoom: 8 },
    'West Bengal':       { lat: 22.9868, lng: 87.8550, zoom: 8 },
    'Meghalaya':         { lat: 25.4670, lng: 91.3662, zoom: 9 },
    'Nagaland':          { lat: 26.1584, lng: 94.5624, zoom: 9 },
  };

  /* Difficulty color mapping */
  const DIFFICULTY_COLORS = {
    'Easy':         '#4a7c59',
    'Moderate':     '#556b2f',
    'Difficult':    '#7b5e3a',
    'Very Difficult': '#8b3a3a',
  };

  /* =============================================
     TREKMAP — Core Map Class
     ============================================= */
  class TrekMap {
    constructor() {
      this.map = null;
      this.currentLayer = null;
      this.currentStyle = 'standard';
      this.isFullscreen = false;
    }

    init() {
      const container = document.getElementById('trekMap');
      if (!container || !window.L) return;

      this.map = L.map('trekMap', {
        center: [22.5, 80.0],
        zoom: 5,
        minZoom: 4,
        maxZoom: 18,
        zoomControl: false,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      });

      // Add scale indicator
      L.control.scale({
        position: 'bottomright',
        imperial: false,
        metric: true,
      }).addTo(this.map);

      // Set default tile layer
      this.setTileLayer('standard');

      return this;
    }

    setTileLayer(style) {
      if (this.currentLayer) {
        this.map.removeLayer(this.currentLayer);
      }
      const cfg = TILE_LAYERS[style] || TILE_LAYERS.standard;
      this.currentLayer = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        subdomains: style === 'topo' ? 'abc' : 'abcd',
      }).addTo(this.map);
      this.currentStyle = style;
    }

    flyTo(lat, lng, zoom = 8) {
      this.map.flyTo([lat, lng], zoom, {
        animate: true,
        duration: 1.4,
        easeLinearity: 0.25,
      });
    }

    resetView() {
      this.map.flyTo([22.5, 80.0], 5, {
        animate: true,
        duration: 1.2,
      });
    }

    toggleFullscreen() {
      const wrap = document.getElementById('trekMap');
      const outer = document.querySelector('.map-outer');
      if (!this.isFullscreen) {
        outer.style.position = 'fixed';
        outer.style.inset = '0';
        outer.style.zIndex = '9999';
        outer.style.borderRadius = '0';
        wrap.style.borderRadius = '0';
        wrap.style.height = '100vh';
        this.isFullscreen = true;
      } else {
        outer.style.position = '';
        outer.style.inset = '';
        outer.style.zIndex = '';
        outer.style.borderRadius = '';
        wrap.style.borderRadius = '';
        wrap.style.height = '';
        this.isFullscreen = false;
      }
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  }

  /* =============================================
     MARKERMANAGER — Markers & Clustering
     ============================================= */
  class MarkerManager {
    constructor(trekMap) {
      this.trekMap = trekMap;
      this.allTreks = [];
      this.markerMap = new Map(); // slug → marker
      this.clusterGroup = null;
      this.activeMarker = null;
      this.activeFilters = {};
    }

    async loadTreks() {
      try {
        const apiUrl = window.TREKINDIA_MAP_API_URL || '/api/treks/map';
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Failed to load trek data from API');
        const json = await res.json();
        const rawTreks = json.data || json;
        this.allTreks = rawTreks.map(t => ({
          ...t,
          lat: parseFloat(t.latitude || t.lat),
          lng: parseFloat(t.longitude || t.lng),
          name: t.name || t.trek_name,
          altitude: t.elevation_m ? `${t.elevation_m.toLocaleString()} m` : (t.altitude || '—'),
          duration: t.duration_label || (t.duration_hours ? `${t.duration_hours}h` : (t.duration || '—')),
          bestSeason: t.best_time || t.bestSeason || '—',
          district: t.district || t.district_name || '—',
          region: t.region || t.state || 'India',
          difficulty: t.difficulty || 'Moderate',
          rating: t.rating ? parseFloat(t.rating) : 4.5,
        }));
      } catch (err) {
        console.warn('TrekIndia Map: API fetch failed, trying local treks.json', err);
        try {
          const res = await fetch('./treks.json');
          if (res.ok) {
            this.allTreks = await res.json();
          } else {
            this.allTreks = INLINE_TREKS;
          }
        } catch (e) {
          this.allTreks = INLINE_TREKS;
        }
      }
      this.renderMarkers(this.allTreks);
      return this.allTreks;
    }

    createSVGMarkerIcon(trek) {
      const color = DIFFICULTY_COLORS[trek.difficulty] || '#556b2f';
      const diffClass = trek.difficulty.toLowerCase().replace(/\s+/g, '-');
      const svg = `
        <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" class="trek-marker-svg">
          <defs>
            <filter id="shadow-${trek.slug}" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.45)"/>
            </filter>
          </defs>
          <path d="M18 2C10.28 2 4 8.28 4 16c0 10 14 26 14 26s14-16 14-26C32 8.28 25.72 2 18 2z"
            fill="${color}" filter="url(#shadow-${trek.slug})"/>
          <path d="M18 2C10.28 2 4 8.28 4 16c0 10 14 26 14 26s14-16 14-26C32 8.28 25.72 2 18 2z"
            fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
          <circle cx="18" cy="16" r="8" fill="rgba(255,255,255,0.15)" class="marker-inner"/>
          <path d="M12 22l6-10 6 10H12z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
          <path d="M15 22l3-5 3 5" fill="rgba(255,255,255,0.5)"/>
          <path d="M18 12l-2 3.5h4L18 12z" fill="rgba(255,255,255,0.95)"/>
        </svg>`;

      return L.divIcon({
        html: `<div class="trek-marker-icon trek-marker-${diffClass}" data-slug="${trek.slug}">${svg}</div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -46],
        className: '',
      });
    }

    renderMarkers(treks) {
      const map = this.trekMap.map;

      if (this.clusterGroup) {
        map.removeLayer(this.clusterGroup);
      }

      this.clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 10,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const size = count > 20 ? 'large' : '';
          return L.divIcon({
            html: `<div class="trek-cluster ${size ? 'trek-cluster-' + size : ''}">
                    <div class="trek-cluster-inner">${count}</div>
                   </div>`,
            iconSize: count > 20 ? [50, 50] : [40, 40],
            className: '',
          });
        },
      });

      this.markerMap.clear();

      treks.forEach((trek, idx) => {
        if (!trek.lat || !trek.lng) return;

        const icon = this.createSVGMarkerIcon(trek);
        const marker = L.marker([trek.lat, trek.lng], { icon });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (this.activeMarker && this.activeMarker !== marker) {
            this._deactivateMarker(this.activeMarker);
          }
          this._activateMarker(marker, trek);
          window.trekPopup && window.trekPopup.show(trek, marker);
        });

        marker.on('mouseover', () => {
          const el = marker.getElement();
          if (el) {
            const iconEl = el.querySelector('.trek-marker-icon');
            if (iconEl) iconEl.classList.add('hovered');
          }
        });

        marker.on('mouseout', () => {
          const el = marker.getElement();
          if (el && this.activeMarker !== marker) {
            const iconEl = el.querySelector('.trek-marker-icon');
            if (iconEl) iconEl.classList.remove('hovered');
          }
        });

        this.markerMap.set(trek.slug, marker);
        this.clusterGroup.addLayer(marker);
      });

      this.clusterGroup.addTo(map);
    }

    _activateMarker(marker, trek) {
      this.activeMarker = marker;
      const el = marker.getElement();
      if (el) {
        const iconEl = el.querySelector('.trek-marker-icon');
        if (iconEl) {
          iconEl.classList.add('selected', 'bounce');
          setTimeout(() => iconEl.classList.remove('bounce'), 700);
        }
      }
    }

    _deactivateMarker(marker) {
      const el = marker.getElement();
      if (el) {
        const iconEl = el.querySelector('.trek-marker-icon');
        if (iconEl) iconEl.classList.remove('selected', 'hovered');
      }
    }

    filterByState(stateName) {
      const filtered = stateName
        ? this.allTreks.filter(t => t.state === stateName)
        : this.allTreks;
      this.renderMarkers(filtered);
      this.updateCount(filtered.length);
    }

    filterByAll(filters) {
      let filtered = [...this.allTreks];

      if (filters.state) {
        filtered = filtered.filter(t => t.state === filters.state);
      }
      if (filters.difficulty && filters.difficulty.length) {
        filtered = filtered.filter(t => filters.difficulty.includes(t.difficulty));
      }
      if (filters.maxAltitude) {
        filtered = filtered.filter(t => {
          const alt = parseInt(t.altitude);
          return alt <= filters.maxAltitude;
        });
      }
      if (filters.region) {
        filtered = filtered.filter(t => t.region === filters.region);
      }

      this.renderMarkers(filtered);
      this.updateCount(filtered.length);
    }

    glowStateMarkers(stateName) {
      this.markerMap.forEach((marker, slug) => {
        const trek = this.allTreks.find(t => t.slug === slug);
        const el = marker.getElement();
        if (!el) return;
        const iconEl = el.querySelector('.trek-marker-icon');
        if (!iconEl) return;
        if (trek && trek.state === stateName) {
          iconEl.classList.add('hovered');
        } else {
          iconEl.classList.remove('hovered');
        }
      });
    }

    clearGlow() {
      this.markerMap.forEach((marker) => {
        const el = marker.getElement();
        if (!el) return;
        const iconEl = el.querySelector('.trek-marker-icon');
        if (iconEl && !iconEl.classList.contains('selected')) {
          iconEl.classList.remove('hovered');
        }
      });
    }

    updateCount(count) {
      const badge = document.getElementById('mapTrekCount');
      if (badge) {
        badge.innerHTML = `<span>${count}</span> Treks Shown`;
      }
    }

    getAllTreks() { return this.allTreks; }
  }

  /* =============================================
     POPUPMANAGER — Glassmorphism Popup Cards
     ============================================= */
  class PopupManager {
    constructor(trekMap) {
      this.trekMap = trekMap;
      this.currentPopup = null;
    }

    show(trek, marker) {
      if (this.currentPopup) {
        this.trekMap.map.closePopup(this.currentPopup);
      }

      const stars = this._renderStars(trek.rating);
      const diffClass = trek.difficulty.toLowerCase().replace(/\s+/g, '-');
      const badgeClass = `badge-${diffClass}`;

      const imgHtml = trek.heroImage ? `<img class="popup-image" src="${trek.heroImage}" alt="${trek.name}" loading="lazy"/>` : `
        <div class="popup-image-placeholder" style="width:100%;height:140px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));border-radius:12px 12px 0 0;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.35;color:var(--color-primary-light, #9caf88);">
            <path d="M3 20L9 8l4 6 3-4 5 10"/>
            <circle cx="18" cy="5" r="2"/>
          </svg>
        </div>`;

      const content = `
        <div class="trek-popup-card">
          <div class="popup-image-wrap">
            ${imgHtml}
            <span class="popup-difficulty-badge ${badgeClass}">${trek.difficulty}</span>
            <span class="popup-region-badge">${trek.state}</span>
          </div>
          <div class="popup-body">
            <h4 class="popup-name">${trek.name}</h4>
            <div class="popup-rating">
              <div class="popup-stars">${stars}</div>
              <span class="popup-rating-num">${trek.rating}</span>
              <span class="popup-rating-state">· ${trek.state}</span>
            </div>
            <div class="popup-metrics">
              <div class="popup-metric">
                <div class="popup-metric-label">Altitude</div>
                <div class="popup-metric-value">⛰ ${trek.altitude}</div>
              </div>
              <div class="popup-metric">
                <div class="popup-metric-label">Duration</div>
                <div class="popup-metric-value">🕒 ${trek.duration}</div>
              </div>
              <div class="popup-metric">
                <div class="popup-metric-label">District</div>
                <div class="popup-metric-value">${trek.district}</div>
              </div>
              <div class="popup-metric">
                <div class="popup-metric-label">Difficulty</div>
                <div class="popup-metric-value">${trek.difficulty}</div>
              </div>
            </div>
            <div class="popup-season">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              Best: ${trek.bestSeason}
            </div>
            <a href="/trek-detail.html?slug=${trek.slug}" class="popup-view-btn" data-slug="${trek.slug}">View Trek Details →</a>
          </div>
        </div>`;

      this.currentPopup = L.popup({
        closeButton: false,
        className: 'trek-popup-leaflet',
        maxWidth: 290,
        autoPan: true,
        autoPanPadding: [30, 30],
      })
        .setLatLng([trek.lat, trek.lng])
        .setContent(content)
        .openOn(this.trekMap.map);
    }

    _renderStars(rating) {
      const fullStars = Math.floor(rating);
      const hasHalf = rating % 1 >= 0.5;
      let html = '';
      for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
          html += `<svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        } else if (i === fullStars && hasHalf) {
          html += `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="none"><defs><linearGradient id="hg"><stop offset="50%" stop-color="#F59E0B"/><stop offset="50%" stop-color="rgba(255,255,255,0.15)"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#hg)"/></svg>`;
        } else {
          html += `<svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        }
      }
      return html;
    }
  }

  /* =============================================
     SEARCHMANAGER — Floating Search Bar
     ============================================= */
  class SearchManager {
    constructor(trekMap, markerManager) {
      this.trekMap = trekMap;
      this.markerManager = markerManager;
      this.debounceTimer = null;
      this.activeIndex = -1;
    }

    init() {
      const input = document.getElementById('mapSearchInput');
      const clearBtn = document.getElementById('mapSearchClear');
      const suggestionsEl = document.getElementById('mapSearchSuggestions');
      if (!input) return;

      input.addEventListener('input', () => {
        clearTimeout(this.debounceTimer);
        const val = input.value.trim();
        clearBtn && (clearBtn.classList.toggle('visible', val.length > 0));
        this.debounceTimer = setTimeout(() => this._showSuggestions(val), 150);
      });

      input.addEventListener('keydown', (e) => {
        const items = suggestionsEl ? suggestionsEl.querySelectorAll('.search-suggestion-item') : [];
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
          this._highlightItem(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.activeIndex = Math.max(this.activeIndex - 1, -1);
          this._highlightItem(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.activeIndex >= 0 && items[this.activeIndex]) {
            items[this.activeIndex].click();
          }
        } else if (e.key === 'Escape') {
          this._closeSuggestions();
        }
      });

      clearBtn && clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.remove('visible');
        this._closeSuggestions();
        input.focus();
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.map-search-bar')) {
          this._closeSuggestions();
        }
      });
    }

    _showSuggestions(query) {
      const suggestionsEl = document.getElementById('mapSearchSuggestions');
      if (!suggestionsEl) return;

      if (!query) {
        this._closeSuggestions();
        return;
      }

      const treks = this.markerManager.getAllTreks();
      const lower = query.toLowerCase();
      const results = treks.filter(t =>
        t.name.toLowerCase().includes(lower) ||
        t.state.toLowerCase().includes(lower) ||
        t.region.toLowerCase().includes(lower) ||
        t.district.toLowerCase().includes(lower)
      ).slice(0, 6);

      if (!results.length) {
        suggestionsEl.innerHTML = `
          <div class="search-suggestion-item" style="justify-content:center;color:#6b7d60;font-size:13px;">
            No treks found for "${query}"
          </div>`;
        suggestionsEl.classList.add('open');
        return;
      }

      suggestionsEl.innerHTML = results.map((trek, i) => `
        <div class="search-suggestion-item" data-index="${i}" data-lat="${trek.lat}" data-lng="${trek.lng}" data-slug="${trek.slug}">
          <div class="suggestion-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 20L9 8l4 6 3-4 5 10"/>
            </svg>
          </div>
          <div>
            <div class="suggestion-name">${trek.name}</div>
            <div class="suggestion-meta">${trek.state} · ${trek.difficulty} · ${trek.altitude}</div>
          </div>
        </div>`).join('');

      suggestionsEl.classList.add('open');
      this.activeIndex = -1;

      suggestionsEl.querySelectorAll('.search-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const lat = parseFloat(item.dataset.lat);
          const lng = parseFloat(item.dataset.lng);
          const slug = item.dataset.slug;
          if (lat && lng) {
            this.trekMap.flyTo(lat, lng, 12);
            setTimeout(() => {
              const marker = this.markerManager.markerMap.get(slug);
              if (marker) marker.fire('click');
            }, 1500);
          }
          const input = document.getElementById('mapSearchInput');
          if (input) input.value = item.querySelector('.suggestion-name').textContent;
          this._closeSuggestions();
        });
      });
    }

    _closeSuggestions() {
      const suggestionsEl = document.getElementById('mapSearchSuggestions');
      if (suggestionsEl) suggestionsEl.classList.remove('open');
      this.activeIndex = -1;
    }

    _highlightItem(items) {
      items.forEach((item, i) => {
        item.classList.toggle('active', i === this.activeIndex);
      });
    }
  }

  /* =============================================
     FILTERMANAGER — Slide-in Filter Panel
     ============================================= */
  class FilterManager {
    constructor(markerManager) {
      this.markerManager = markerManager;
      this.activeFilters = {
        difficulty: [],
        state: null,
        maxAltitude: 6500,
        region: null,
      };
      this.activeCount = 0;
    }

    init() {
      const filterBtn = document.getElementById('mapFilterBtn');
      const sidebar = document.getElementById('mapFilterSidebar');
      const closeBtn = document.getElementById('filterSidebarClose');
      const applyBtn = document.getElementById('filterApplyBtn');
      const clearBtn = document.getElementById('filterClearBtn');
      const altRange = document.getElementById('filterAltitude');

      if (!filterBtn || !sidebar) return;

      // Prevent Leaflet map dragging/zooming when scrolling/clicking inside filter sidebar
      if (window.L && L.DomEvent) {
        L.DomEvent.disableClickPropagation(sidebar);
        L.DomEvent.disableScrollPropagation(sidebar);
      }

      const openSidebar = () => {
        sidebar.classList.add('open');
        sidebar.setAttribute('aria-hidden', 'false');
        filterBtn.classList.add('active');
        filterBtn.setAttribute('aria-expanded', 'true');
      };

      const closeSidebar = () => {
        sidebar.classList.remove('open');
        sidebar.setAttribute('aria-hidden', 'true');
        filterBtn.classList.remove('active');
        filterBtn.setAttribute('aria-expanded', 'false');
      };

      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });

      closeBtn && closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSidebar();
      });

      document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !filterBtn.contains(e.target)) {
          closeSidebar();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
          closeSidebar();
        }
      });

      document.querySelectorAll('.filter-chip[data-difficulty]').forEach(chip => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('active');
          const val = chip.dataset.difficulty;
          if (chip.classList.contains('active')) {
            if (!this.activeFilters.difficulty.includes(val)) {
              this.activeFilters.difficulty.push(val);
            }
          } else {
            this.activeFilters.difficulty = this.activeFilters.difficulty.filter(d => d !== val);
          }
          this._updateBadge();
        });
      });

      document.querySelectorAll('.filter-toggle-row').forEach(row => {
        const toggle = row.querySelector('.filter-toggle');
        if (!toggle) return;
        row.addEventListener('click', () => {
          toggle.classList.toggle('on');
        });
      });

      if (altRange) {
        altRange.addEventListener('input', () => {
          const val = altRange.value;
          this.activeFilters.maxAltitude = parseInt(val);
          const label = document.getElementById('altRangeVal');
          if (label) label.textContent = `${parseInt(val).toLocaleString()} m`;
          const pct = ((val - altRange.min) / (altRange.max - altRange.min)) * 100;
          altRange.style.setProperty('--val', pct + '%');
        });
      }

      applyBtn && applyBtn.addEventListener('click', () => {
        this.markerManager.filterByAll(this.activeFilters);
        closeSidebar();
      });

      clearBtn && clearBtn.addEventListener('click', () => {
        this.activeFilters = { difficulty: [], state: null, maxAltitude: 6500, region: null };
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.filter-toggle').forEach(t => t.classList.remove('on'));
        if (altRange) {
          altRange.value = 6500;
          altRange.style.setProperty('--val', '100%');
          const label = document.getElementById('altRangeVal');
          if (label) label.textContent = '6,500 m';
        }
        this._updateBadge();
        this.markerManager.filterByAll(this.activeFilters);
      });
    }

    _updateBadge() {
      this.activeCount =
        (this.activeFilters.difficulty ? this.activeFilters.difficulty.length : 0) +
        (this.activeFilters.state ? 1 : 0) +
        (this.activeFilters.maxAltitude < 6500 ? 1 : 0);
      const badge = document.getElementById('filterBadge');
      if (badge) {
        badge.textContent = this.activeCount;
        badge.classList.toggle('visible', this.activeCount > 0);
      }
    }
  }

  /* =============================================
     STATEINTERACTION — Sidebar → Map
     ============================================= */
  class StateInteraction {
    constructor(trekMap, markerManager) {
      this.trekMap = trekMap;
      this.markerManager = markerManager;
      this.activeState = null;
    }

    init() {
      const stateItems = document.querySelectorAll('.state-item[data-state]');

      stateItems.forEach(item => {
        const stateName = item.dataset.state;

        item.addEventListener('mouseenter', () => {
          this.markerManager.glowStateMarkers(stateName);
          item.classList.add('marker-glow');
        });

        item.addEventListener('mouseleave', () => {
          if (this.activeState !== stateName) {
            this.markerManager.clearGlow();
            item.classList.remove('marker-glow');
          }
        });

        item.addEventListener('click', (e) => {
          e.preventDefault();

          if (this.activeState === stateName) {
            this.activeState = null;
            document.querySelectorAll('.state-item').forEach(i => i.classList.remove('active'));
            this.markerManager.filterByState(null);
            this.trekMap.resetView();
            return;
          }

          this.activeState = stateName;
          document.querySelectorAll('.state-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');

          const coords = STATE_COORDS[stateName];
          if (coords) {
            this.trekMap.flyTo(coords.lat, coords.lng, coords.zoom);
          }

          this.markerManager.filterByState(stateName);
          this.markerManager.glowStateMarkers(stateName);
        });
      });
    }
  }

  /* =============================================
     LOCATIONMANAGER — Locate Me Feature
     ============================================= */
  class LocationManager {
    constructor(trekMap, markerManager) {
      this.trekMap = trekMap;
      this.markerManager = markerManager;
      this.locationMarker = null;
    }

    init() {
      const btn = document.getElementById('mapLocateBtn');
      if (!btn) return;

      btn.addEventListener('click', () => {
        btn.style.color = '#9caf88';

        if (!navigator.geolocation) {
          alert('Geolocation is not supported by your browser.');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;

            if (this.locationMarker) {
              this.trekMap.map.removeLayer(this.locationMarker);
            }

            const pulseIcon = L.divIcon({
              html: `<div class="user-location-marker">
                       <div class="user-location-pulse"></div>
                       <div class="user-location-dot"></div>
                     </div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              className: '',
            });

            this.locationMarker = L.marker([lat, lng], { icon: pulseIcon })
              .addTo(this.trekMap.map)
              .bindPopup(`
                <div style="background:rgba(12,18,10,0.95);border:1px solid rgba(156,175,136,0.2);border-radius:12px;padding:14px;color:#e8f0e4;font-family:'Manrope',sans-serif;min-width:180px;">
                  <div style="font-size:13px;font-weight:700;margin-bottom:6px;">📍 Your Location</div>
                  <div style="font-size:12px;color:#9caf88;">${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>
                  <div style="font-size:12px;color:#6b7d60;margin-top:4px;">Showing nearest treks</div>
                </div>`, {
                closeButton: false,
                className: 'trek-popup-leaflet',
              })
              .openPopup();

            this.trekMap.map.flyTo([lat, lng], 9, { animate: true, duration: 1.5 });
          },
          (err) => {
            console.warn('Geolocation error:', err.message);
          }
        );
      });
    }
  }

  /* =============================================
     STYLE SWITCHER
     ============================================= */
  class StyleSwitcher {
    constructor(trekMap) {
      this.trekMap = trekMap;
    }

    init() {
      document.querySelectorAll('.map-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const style = btn.dataset.style;
          if (!style) return;
          document.querySelectorAll('.map-style-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.trekMap.setTileLayer(style);
        });
      });
    }
  }

  /* =============================================
     MAP CONTROLS
     ============================================= */
  function initMapControls(trekMap) {
    // Zoom In
    const zoomInBtn = document.getElementById('mapZoomInBtn');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => trekMap.map.zoomIn());
    }

    // Zoom Out
    const zoomOutBtn = document.getElementById('mapZoomOutBtn');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => trekMap.map.zoomOut());
    }

    // Reset View
    const resetBtn = document.getElementById('mapResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        trekMap.resetView();
        document.querySelectorAll('.state-item').forEach(i => i.classList.remove('active'));
      });
    }

    // Fullscreen
    const fsBtn = document.getElementById('mapFullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => trekMap.toggleFullscreen());
    }
  }

  /* =============================================
     LOADING OVERLAY
     ============================================= */
  function hideLoadingOverlay() {
    const overlay = document.getElementById('mapLoadingOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 600);
    }
  }

  /* =============================================
     MAIN INIT — DOM Ready
     ============================================= */
  async function initTrekMap() {
    if (!window.L) {
      console.warn('TrekIndia Map: Leaflet.js not loaded');
      return;
    }

    const trekMap = new TrekMap();
    trekMap.init();

    const markerManager = new MarkerManager(trekMap);
    const treks = await markerManager.loadTreks();

    markerManager.updateCount(treks.length);
    setTimeout(hideLoadingOverlay, 600);

    const popupManager = new PopupManager(trekMap);
    window.trekPopup = popupManager;

    const searchManager = new SearchManager(trekMap, markerManager);
    searchManager.init();

    const filterManager = new FilterManager(markerManager);
    filterManager.init();

    const stateInteraction = new StateInteraction(trekMap, markerManager);
    stateInteraction.init();

    const locationManager = new LocationManager(trekMap, markerManager);
    locationManager.init();

    const styleSwitcher = new StyleSwitcher(trekMap);
    styleSwitcher.init();

    initMapControls(trekMap);

    trekMap.map.on('click', (e) => {
      if (e.originalEvent.target.classList.contains('leaflet-container') ||
          e.originalEvent.target.tagName === 'CANVAS') {
        trekMap.map.closePopup();
      }
    });

    window.trekMapInstance = { trekMap, markerManager, searchManager, filterManager };
  }

  function waitForLeaflet(retries = 25) {
    if (window.L) {
      initTrekMap();
    } else if (retries > 0) {
      setTimeout(() => waitForLeaflet(retries - 1), 150);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForLeaflet());
  } else {
    waitForLeaflet();
  }
})();
