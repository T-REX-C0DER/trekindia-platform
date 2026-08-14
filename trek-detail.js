/**
 * TrekIndia — Trek Detail JavaScript
 * Fetches trek by slug from /api/treks/slug/:slug and populates page.
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug') || 'kedarkantha';

  try {
    const res = await fetch(`/api/treks/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Trek not found');
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Trek data missing');

    const trek = json.data;
    renderTrekDetails(trek);
  } catch (err) {
    console.error('Failed to load trek:', err);
    document.getElementById('trekTitle').textContent = 'Trek Not Found';
    document.getElementById('trekDescription').textContent = 'The requested trek could not be loaded. Please return to the explore page.';
  }
});

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
  badgeEl.className = `detail-badge ${diffClass(trek.difficulty)}`;

  // Metrics
  document.getElementById('metricElevation').textContent = trek.elevation_m ? `${trek.elevation_m.toLocaleString()} m` : '—';
  document.getElementById('metricDuration').textContent  = trek.duration_label || (trek.duration_hours ? `${trek.duration_hours}h` : '—');
  document.getElementById('metricDistance').textContent  = trek.distance_km ? `${trek.distance_km} km` : '—';
  document.getElementById('metricRating').textContent    = trek.rating ? `★ ${parseFloat(trek.rating).toFixed(1)}` : 'Unrated';
  document.getElementById('metricSeason').textContent    = trek.best_time || '—';

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
  document.getElementById('startingPoint').textContent   = trek.starting_point || '—';
  document.getElementById('endingPoint').textContent     = trek.ending_point || '—';
  document.getElementById('permitRequired').textContent   = trek.permit_required ? 'Yes (Permit required)' : 'No permit required';
  document.getElementById('entryFee').textContent         = trek.entry_fee ? `₹${trek.entry_fee}` : 'Free';

  // Map & Coordinates
  const lat = parseFloat(trek.latitude);
  const lng = parseFloat(trek.longitude);

  document.getElementById('latCoord').textContent   = !isNaN(lat) ? `${lat.toFixed(4)}° N` : 'N/A';
  document.getElementById('lngCoord').textContent   = !isNaN(lng) ? `${lng.toFixed(4)}° E` : 'N/A';
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
      iconSize: [24, 24],
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

function diffClass(diff) {
  if (!diff) return 'moderate';
  const d = diff.toLowerCase();
  if (d.includes('easy')) return 'easy';
  if (d.includes('diff')) return 'difficult';
  return 'moderate';
}

function initUserActions(trek) {
  const saveBtn = document.getElementById('saveTrekBtn');
  const completeBtn = document.getElementById('completeTrekBtn');
  let saved = false;
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
    const newRev = document.createElement('div');
    newRev.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(156,175,136,0.15);border-radius:12px;padding:16px;margin-top:12px;';
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
