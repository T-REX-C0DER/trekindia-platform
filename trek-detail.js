/**
 * TrekIndia — Trek Detail JavaScript
 * Fetches trek by slug from /api/treks/slug/:slug and populates page.
 * Fetches matching trekking companies from /api/treks/slug/:slug/companies.
 * Handles global light/dark theme toggle tied to localStorage.
 */

'use strict';

/* ─── 1. THEME SYSTEM ────────────────────────────────────────
   Mirrors the homepage theme logic. Reads from / writes to
   localStorage key 'trekindia-theme'. Applies 'dark' class
   on <body> immediately on load to avoid FOUC.
   ─────────────────────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('trekindia-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (!saved && prefersDark);
  document.body.classList.toggle('dark', isDark);
})();

/* ─── 2. BRAND LOGO ──────────────────────────────────────────
   Apply correct logo src (mirrors main.js BrandLogoSystem)
   ─────────────────────────────────────────────────────────── */
function applyBrandLogos() {
  document.querySelectorAll('.brand-icon-img.light-icon').forEach(img => {
    img.src = 'whitebg_logo_processed.png';
  });
  document.querySelectorAll('.brand-icon-img.dark-icon').forEach(img => {
    img.src = 'darkbg_logo_processed.png';
  });
}

/* ─── 3. THEME TOGGLE ────────────────────────────────────────
   Uses the same localStorage key as the homepage so theme
   state is shared across all pages.
   ─────────────────────────────────────────────────────────── */
function initThemeToggle() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('trekindia-theme', isDark ? 'dark' : 'light');
  });
}

/* ─── 4. MAIN INIT ───────────────────────────────────────────  */
document.addEventListener('DOMContentLoaded', async () => {
  applyBrandLogos();
  initThemeToggle();

  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug') || 'kedarkantha';

  // Load trek data
  try {
    const res = await fetch(`/api/treks/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Trek not found');
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Trek data missing');

    const trek = json.data;
    renderTrekDetails(trek);

    // Load companies concurrently (non-blocking, isolated error handling)
    loadTrekCompanies(slug);
  } catch (err) {
    console.error('Failed to load trek:', err);
    document.getElementById('trekTitle').textContent = 'Trek Not Found';
    document.getElementById('trekDescription').textContent =
      'The requested trek could not be loaded. Please return to the explore page.';

    // Still try to show companies section gracefully
    showCompaniesError();
  }
});

/* ─── 5. RENDER TREK DETAILS ─────────────────────────────── */
function renderTrekDetails(trek) {
  // Page Title
  document.title = `${trek.name} — TrekIndia`;

  // Header & Breadcrumb
  document.getElementById('breadcrumbState').textContent = trek.state;
  document.getElementById('breadcrumbName').textContent  = trek.name;
  document.getElementById('trekTitle').textContent       = trek.name;

  const locationText = trek.district ? `${trek.district}, ${trek.state}` : trek.state;
  document.getElementById('trekLocationText').textContent = locationText;

  // Badge
  const badgeEl = document.getElementById('trekDifficultyBadge');
  badgeEl.textContent = trek.difficulty || 'Moderate';
  badgeEl.className   = `detail-badge ${diffClass(trek.difficulty)}`;

  // Metrics
  document.getElementById('metricElevation').textContent = trek.elevation_m
    ? `${trek.elevation_m.toLocaleString()} m` : '—';
  document.getElementById('metricDuration').textContent = trek.duration_label
    || (trek.duration_hours ? `${trek.duration_hours}h` : '—');
  document.getElementById('metricDistance').textContent = trek.distance_km
    ? `${trek.distance_km} km` : '—';
  document.getElementById('metricRating').textContent   = trek.rating
    ? `★ ${parseFloat(trek.rating).toFixed(1)}` : 'Unrated';
  document.getElementById('metricSeason').textContent   = trek.best_time || '—';

  // Description
  const descEl = document.getElementById('trekDescription');
  if (trek.description) {
    descEl.innerHTML = `<p>${trek.description.replace(/\n/g, '</p><p>')}</p>`;
  } else if (trek.short_description) {
    descEl.textContent = trek.short_description;
  } else {
    descEl.textContent = `${trek.name} is a renowned trekking route in ${locationText}. It features spectacular mountain scenery, rich biodiversity, and rewarding trails for outdoor enthusiasts.`;
  }

  // Route Details
  document.getElementById('startingPoint').textContent  = trek.starting_point || '—';
  document.getElementById('endingPoint').textContent    = trek.ending_point   || '—';
  document.getElementById('permitRequired').textContent = trek.permit_required ? 'Yes (Permit required)' : 'No permit required';
  document.getElementById('entryFee').textContent       = trek.entry_fee ? `₹${trek.entry_fee}` : 'Free';

  // Map & Coordinates
  const lat = parseFloat(trek.latitude);
  const lng = parseFloat(trek.longitude);

  document.getElementById('latCoord').textContent    = !isNaN(lat) ? `${lat.toFixed(4)}° N` : 'N/A';
  document.getElementById('lngCoord').textContent    = !isNaN(lng) ? `${lng.toFixed(4)}° E` : 'N/A';
  document.getElementById('districtText').textContent = trek.district || '—';
  document.getElementById('stateText').textContent    = trek.state;

  if (!isNaN(lat) && !isNaN(lng) && window.L) {
    const map = L.map('detailMap', {
      center: [lat, lng],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 18,
    }).addTo(map);

    const icon = L.divIcon({
      html: `<div style="background:#9caf88;width:24px;height:24px;border-radius:50%;border:3px solid #0b0f0b;box-shadow:0 0 12px rgba(156,175,136,0.6);"></div>`,
      iconSize:   [24, 24],
      iconAnchor: [12, 12],
    });

    L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(`<strong>${trek.name}</strong><br/>${locationText}`)
      .openPopup();
  }

  // User Actions
  initUserActions(trek);
}

/* ─── 6. DIFFICULTY CLASS ────────────────────────────────── */
function diffClass(diff) {
  if (!diff) return 'moderate';
  const d = diff.toLowerCase();
  if (d.includes('easy'))  return 'easy';
  if (d.includes('diff'))  return 'difficult';
  return 'moderate';
}

/* ─── 7. USER ACTIONS ────────────────────────────────────── */
function initUserActions(trek) {
  const saveBtn     = document.getElementById('saveTrekBtn');
  const completeBtn = document.getElementById('completeTrekBtn');
  let saved     = false;
  let completed = false;

  saveBtn?.addEventListener('click', () => {
    saved = !saved;
    saveBtn.classList.toggle('active', saved);
    document.getElementById('saveBtnText').textContent = saved ? 'Saved ❤️' : 'Save Trek';
  });

  completeBtn?.addEventListener('click', () => {
    completed = !completed;
    completeBtn.classList.toggle('active', completed);
    document.getElementById('completeBtnText').textContent = completed ? 'Completed ✓' : 'Mark Completed';
  });

  // Star rating selector
  let selectedRating = 0;
  const starSpans = document.querySelectorAll('#starRatingSelect span');
  starSpans.forEach(span => {
    span.addEventListener('click', () => {
      selectedRating = parseInt(span.dataset.val);
      starSpans.forEach((s, idx) => {
        s.classList.toggle('selected', idx < selectedRating);
      });
    });
  });

  // Submit review button
  document.getElementById('submitReviewBtn')?.addEventListener('click', () => {
    const text = document.getElementById('reviewText').value.trim();
    if (!text && selectedRating === 0) {
      alert('Please add a rating or comment before submitting.');
      return;
    }
    const reviewsList = document.getElementById('reviewsList');
    const newRev      = document.createElement('div');
    newRev.style.cssText = 'background:var(--detail-card-bg);border:1px solid var(--detail-border);border-radius:12px;padding:16px;margin-top:12px;';
    newRev.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-weight:600;color:var(--detail-text);">You (Verified Trekker)</span>
        <span style="color:#F59E0B;">${'★'.repeat(selectedRating || 5)}</span>
      </div>
      <p style="font-size:14px;color:var(--detail-text-muted);line-height:1.6;">${text || 'Great trek experience!'}</p>
    `;
    reviewsList.prepend(newRev);
    document.getElementById('reviewText').value = '';
    alert('Thank you! Your review has been recorded.');
  });
}

/* ─── 8. TREKKING COMPANIES ──────────────────────────────── */

/**
 * Fetch companies for the given slug, then render cards.
 * Fully isolated — if this fails, the rest of the page is unaffected.
 */
async function loadTrekCompanies(slug) {
  const skeleton = document.getElementById('companiesSkeleton');
  const grid     = document.getElementById('companiesGrid');
  const empty    = document.getElementById('companiesEmpty');
  const error    = document.getElementById('companiesError');

  // Show skeleton while fetching
  skeleton.style.display = '';
  grid.style.display     = 'none';
  empty.style.display    = 'none';
  error.style.display    = 'none';

  try {
    const res  = await fetch(`/api/treks/slug/${encodeURIComponent(slug)}/companies`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Hide skeleton
    skeleton.style.display = 'none';

    if (!json.success || !Array.isArray(json.companies) || json.companies.length === 0) {
      empty.style.display = '';
      return;
    }

    // Render company cards
    grid.innerHTML = json.companies.map(c => buildCompanyCard(c)).join('');
    grid.style.display = '';

  } catch (err) {
    console.warn('Companies API error (non-critical):', err.message);
    showCompaniesError();
  }
}

/**
 * Build a single company card HTML string.
 * No icons — clean text only.
 */
function buildCompanyCard(company) {
  const name    = escapeHtml(company.company_name || '');
  const rawUrl  = (company.website_url || '').trim();
  const safeUrl = sanitizeUrl(rawUrl);

  // Show clean domain only (no https://, no trailing slash)
  const displayUrl = rawUrl
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');

  return `
    <div class="company-card" role="article" aria-label="${name}">
      <div class="company-name">${name}</div>
      <div class="company-tag">Trek Operator</div>
      ${displayUrl ? `<div class="company-url">${escapeHtml(displayUrl)}</div>` : ''}
      ${safeUrl ? `
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
         class="company-cta"
         aria-label="Visit ${name} website (opens in new tab)">
        Visit Website
      </a>` : ''}
    </div>
  `;
}

/** Show the error state for the companies section */
function showCompaniesError() {
  const skeleton = document.getElementById('companiesSkeleton');
  const error    = document.getElementById('companiesError');
  if (skeleton) skeleton.style.display = 'none';
  if (error)    error.style.display    = '';
}

/** Sanitize URL — only allow http/https to prevent XSS */
function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch {
    return '';
  }
}

/** Minimal HTML escaping for user-sourced strings */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
