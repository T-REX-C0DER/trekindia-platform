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

/* ─── 7. USER ACTIONS & COMPLETION WORKFLOW ──────────────── */
async function initUserActions(trek) {
  const saveBtn          = document.getElementById('saveTrekBtn');
  const completeBtn      = document.getElementById('completeTrekBtn');
  const saveBtnText      = document.getElementById('saveBtnText');
  const completeBtnText  = document.getElementById('completeBtnText');

  // Modals
  const completeModal       = document.getElementById('completeTrekModal');
  const btnCloseComplete    = document.getElementById('btnCloseCompleteModal');
  const btnCancelComplete   = document.getElementById('btnCancelCompleteModal');
  const formComplete        = document.getElementById('formCompleteTrek');
  const completeDateInput   = document.getElementById('completeTrekDate');
  const completeNotesInput  = document.getElementById('completeTrekNotes');
  const btnConfirmComplete  = document.getElementById('btnConfirmCompleteTrek');
  const modalTrekName       = document.getElementById('modalTrekName');
  const modalStarRating     = document.getElementById('modalStarRating');

  const uncompleteModal     = document.getElementById('uncompleteTrekModal');
  const btnCloseUncomplete  = document.getElementById('btnCloseUncompleteModal');
  const btnCancelUncomplete = document.getElementById('btnCancelUncompleteModal');
  const btnConfirmUncomplete= document.getElementById('btnConfirmUncompleteTrek');

  const celebrationModal    = document.getElementById('celebrationModal');
  const btnCloseCelebration = document.getElementById('btnCloseCelebration');
  const celebrationTrekName = document.getElementById('celebrationTrekName');
  const celebrationStatsGrid= document.getElementById('celebrationStatsGrid');
  const celebrationBadgeWrap= document.getElementById('celebrationBadgeWrap');

  if (modalTrekName) modalTrekName.textContent = trek.name;
  if (celebrationTrekName) celebrationTrekName.textContent = trek.name;

  let isSaved = false;
  let isCompleted = false;
  let selectedModalRating = 0;

  // Star rating selector in complete modal
  function renderModalStars(rating) {
    if (!modalStarRating) return;
    const starSpans = modalStarRating.querySelectorAll('span');
    starSpans.forEach((s, idx) => {
      s.classList.toggle('selected', idx < rating);
    });
  }

  if (modalStarRating) {
    const starSpans = modalStarRating.querySelectorAll('span');
    starSpans.forEach((span, index) => {
      span.addEventListener('mouseenter', () => {
        renderModalStars(index + 1);
      });
      span.addEventListener('click', () => {
        const val = parseInt(span.dataset.val, 10);
        selectedModalRating = (selectedModalRating === val ? 0 : val);
        renderModalStars(selectedModalRating);
      });
    });

    modalStarRating.addEventListener('mouseleave', () => {
      renderModalStars(selectedModalRating);
    });
  }

  // Check persisted status from backend
  async function checkUserStatus() {
    try {
      const res = await fetch(`/api/treks/slug/${encodeURIComponent(trek.slug)}/user-status`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          isSaved = !!data.saved;
          isCompleted = !!data.completed;
          if (data.personal_rating) {
            selectedModalRating = Math.round(parseFloat(data.personal_rating)) || 0;
            renderModalStars(selectedModalRating);
          }
          if (data.notes && completeNotesInput) {
            completeNotesInput.value = data.notes;
          }
          if (data.completed_at && completeDateInput) {
            completeDateInput.value = new Date(data.completed_at).toISOString().split('T')[0];
          }
          updateButtonStates();
        }
      }
    } catch (e) {
      console.warn('Could not fetch user status for trek:', e.message);
    }
  }

  function updateButtonStates() {
    if (saveBtn) {
      saveBtn.classList.toggle('active', isSaved);
      if (saveBtnText) saveBtnText.textContent = isSaved ? 'Saved ❤️' : 'Save Trek';
    }
    if (completeBtn) {
      completeBtn.classList.toggle('active', isCompleted);
      if (completeBtnText) completeBtnText.textContent = isCompleted ? '✓ Completed' : 'Mark Completed';
    }
  }

  await checkUserStatus();

  // 1. SAVE TREK HANDLER
  saveBtn?.addEventListener('click', async () => {
    const user = window.TrekIndiaAuth ? window.TrekIndiaAuth.getUser() : null;
    if (!user) {
      window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&message=auth_required`;
      return;
    }

    try {
      saveBtn.disabled = true;
      const res = await fetch(`/api/treks/slug/${encodeURIComponent(trek.slug)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ saved: !isSaved })
      });
      const data = await res.json();
      if (data.success) {
        isSaved = !!data.saved;
        updateButtonStates();
      }
    } catch (err) {
      console.error('Error saving trek:', err);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // 2. COMPLETE BUTTON CLICK
  completeBtn?.addEventListener('click', () => {
    const user = window.TrekIndiaAuth ? window.TrekIndiaAuth.getUser() : null;
    if (!user) {
      window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&message=auth_required`;
      return;
    }

    if (isCompleted) {
      // Open Uncomplete confirmation modal
      if (uncompleteModal) uncompleteModal.classList.add('active');
    } else {
      // Open Complete confirmation modal
      if (completeDateInput && !completeDateInput.value) {
        const today = new Date().toISOString().split('T')[0];
        completeDateInput.value = today;
      }
      renderModalStars(selectedModalRating);
      if (completeModal) completeModal.classList.add('active');
    }
  });

  // Modal Closers
  btnCloseComplete?.addEventListener('click', () => completeModal.classList.remove('active'));
  btnCancelComplete?.addEventListener('click', () => completeModal.classList.remove('active'));
  btnCloseUncomplete?.addEventListener('click', () => uncompleteModal.classList.remove('active'));
  btnCancelUncomplete?.addEventListener('click', () => uncompleteModal.classList.remove('active'));
  btnCloseCelebration?.addEventListener('click', () => celebrationModal.classList.remove('active'));

  // 3. SUBMIT COMPLETE FORM
  formComplete?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dateVal = completeDateInput ? completeDateInput.value : new Date().toISOString();
    const notesVal = completeNotesInput ? completeNotesInput.value.trim() : '';

    try {
      btnConfirmComplete.disabled = true;
      btnConfirmComplete.innerHTML = 'Completing...';

      const res = await fetch(`/api/treks/slug/${encodeURIComponent(trek.slug)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          completed_at: dateVal,
          notes: notesVal,
          rating: selectedModalRating || null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to mark trek as completed.');
      }

      // Success
      isCompleted = true;
      updateButtonStates();
      completeModal.classList.remove('active');

      // Populate & Show Celebration Modal with Authoritative Stats
      if (celebrationStatsGrid) {
        const st = data.stats || {};
        celebrationStatsGrid.innerHTML = `
          <div class="celebration-pill">🥾 ${st.totalDistanceKm !== undefined ? st.totalDistanceKm : (trek.distance_km || 0)} km logged</div>
          <div class="celebration-pill">🏔️ ${st.treksCompleted || 1} treks completed</div>
          <div class="celebration-pill">📍 ${st.statesExplored || 1} states explored</div>
          <div class="celebration-pill">🕒 ${st.daysOnTrail || 1} days on trail</div>
        `;
      }

      if (celebrationBadgeWrap && data.trekBadge) {
        celebrationBadgeWrap.innerHTML = `
          <div class="badge-reward-card">
            <div class="badge-reward-icon">🏅</div>
            <div style="text-align: left;">
              <div class="badge-reward-name">${escapeHtml(data.trekBadge.name)}</div>
              <div class="badge-reward-sub">${escapeHtml(data.trekBadge.description)} • <strong style="color:var(--detail-accent);">${data.trekBadge.rarity}</strong></div>
            </div>
          </div>
        `;
      }

      if (celebrationModal) celebrationModal.classList.add('active');

    } catch (err) {
      console.error(err);
      alert(err.message || 'Unable to mark trek as completed. Please try again.');
    } finally {
      if (btnConfirmComplete) {
        btnConfirmComplete.disabled = false;
        btnConfirmComplete.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Mark Trek as Completed
        `;
      }
    }
  });

  // 4. SUBMIT UNCOMPLETE ACTION
  btnConfirmUncomplete?.addEventListener('click', async () => {
    try {
      btnConfirmUncomplete.disabled = true;
      btnConfirmUncomplete.textContent = 'Removing...';

      const res = await fetch(`/api/treks/slug/${encodeURIComponent(trek.slug)}/uncomplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to remove completion.');
      }

      isCompleted = false;
      selectedModalRating = 0;
      renderModalStars(0);
      if (completeNotesInput) completeNotesInput.value = '';
      updateButtonStates();
      uncompleteModal.classList.remove('active');

    } catch (err) {
      console.error(err);
      alert(err.message || 'Error removing trek completion.');
    } finally {
      if (btnConfirmUncomplete) {
        btnConfirmUncomplete.disabled = false;
        btnConfirmUncomplete.textContent = 'Remove Completion';
      }
    }
  });

  // 5. REVIEW FORM
  let reviewRating = 0;
  const reviewContainer = document.getElementById('starRatingSelect');
  const reviewStars = reviewContainer ? reviewContainer.querySelectorAll('span') : [];

  function renderReviewStars(val) {
    reviewStars.forEach((s, idx) => {
      s.classList.toggle('selected', idx < val);
    });
  }

  reviewStars.forEach((span, index) => {
    span.addEventListener('mouseenter', () => {
      renderReviewStars(index + 1);
    });
    span.addEventListener('click', () => {
      const val = parseInt(span.dataset.val, 10);
      reviewRating = (reviewRating === val ? 0 : val);
      renderReviewStars(reviewRating);
    });
  });

  if (reviewContainer) {
    reviewContainer.addEventListener('mouseleave', () => {
      renderReviewStars(reviewRating);
    });
  }

  document.getElementById('submitReviewBtn')?.addEventListener('click', async () => {
    const user = window.TrekIndiaAuth ? window.TrekIndiaAuth.getUser() : null;
    if (!user) {
      window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&message=auth_required`;
      return;
    }

    const text = document.getElementById('reviewText').value.trim();
    if (!text || reviewRating === 0) {
      alert('Please provide both a star rating and your review text.');
      return;
    }

    try {
      const res = await fetch('/api/profile/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trek_id: trek.trek_id,
          rating: reviewRating,
          review_text: text
        })
      });
      const data = await res.json();
      if (data.success) {
        const reviewsList = document.getElementById('reviewsList');
        const newRev = document.createElement('div');
        newRev.style.cssText = 'background:var(--detail-card-bg);border:1px solid var(--detail-border);border-radius:12px;padding:16px;margin-top:12px;';
        newRev.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-weight:600;color:var(--detail-text);">${escapeHtml(user.full_name || user.username)} (Verified Trekker)</span>
            <span style="color:#F59E0B;">${'★'.repeat(reviewRating)}</span>
          </div>
          <p style="font-size:14px;color:var(--detail-text-muted);line-height:1.6;">${escapeHtml(text)}</p>
        `;
        reviewsList.prepend(newRev);
        document.getElementById('reviewText').value = '';
        reviewRating = 0;
        renderReviewStars(0);
        alert('Thank you! Your review has been recorded.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to submit review.');
    }
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
