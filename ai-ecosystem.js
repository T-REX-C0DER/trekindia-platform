/**
 * TrekIndia — Unified AI Ecosystem Frontend Controller (ai-ecosystem.js)
 * Powers all 8 AI capabilities with real backend APIs, deterministic fallbacks & rich UX
 */

'use strict';

const AIEcosystem = {
  // ─── 1. AI PHOTO-TO-TREK DISCOVERY ──────────────────────────────────────────
  initPhotoDiscovery(containerId = 'photoDiscoveryContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="ai-card" id="photoDiscoveryCard">
        <div class="ai-header-row">
          <div>
            <h3 class="ai-title">📷 Find Treks From a Photo</h3>
            <p class="ai-subtitle">Upload or snap a mountain picture to discover visually matching TrekIndia trails.</p>
          </div>
          <span class="ai-badge">Visual Similarity AI</span>
        </div>

        <div class="ai-upload-dropzone" id="photoDropzone" role="button" tabindex="0">
          <input type="file" id="photoInput" accept="image/*" style="display:none;" />
          <span class="ai-upload-icon">🏔️</span>
          <div style="font-weight:700; font-size:1rem; margin-bottom:4px;">Click or Drag & Drop Mountain Photo</div>
          <div style="font-size:0.8rem; color:var(--text-secondary);">JPEG, PNG, WebP up to 10MB</div>
        </div>

        <div class="ai-preview-box" id="photoPreviewBox">
          <img id="photoPreviewImg" alt="Selected trail preview" />
          <button type="button" class="ai-remove-preview-btn" id="photoRemoveBtn" title="Remove photo">&times;</button>
        </div>

        <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <select id="photoStateFilter" class="explore-filter-select" style="min-width:140px;">
            <option value="">All Regions</option>
            <option value="Uttarakhand">Uttarakhand</option>
            <option value="Himachal Pradesh">Himachal Pradesh</option>
            <option value="Maharashtra">Maharashtra (Sahyadri)</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Kerala">Kerala</option>
            <option value="Sikkim">Sikkim</option>
          </select>

          <select id="photoDifficultyFilter" class="explore-filter-select" style="min-width:140px;">
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Moderate">Moderate</option>
            <option value="Difficult">Difficult</option>
          </select>

          <button type="button" class="ai-btn-primary" id="photoSearchBtn" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Search Similar Trails
          </button>
        </div>

        <div id="photoDiscoveryStatus" style="margin-top:14px; font-size:0.88rem; color:var(--text-secondary); display:none;"></div>

        <div class="photo-match-grid" id="photoMatchResults"></div>
      </div>
    `;

    const dropzone = container.querySelector('#photoDropzone');
    const fileInput = container.querySelector('#photoInput');
    const previewBox = container.querySelector('#photoPreviewBox');
    const previewImg = container.querySelector('#photoPreviewImg');
    const removeBtn = container.querySelector('#photoRemoveBtn');
    const searchBtn = container.querySelector('#photoSearchBtn');
    const statusEl = container.querySelector('#photoDiscoveryStatus');
    const resultsGrid = container.querySelector('#photoMatchResults');
    const stateFilter = container.querySelector('#photoStateFilter');
    const diffFilter = container.querySelector('#photoDifficultyFilter');

    let currentBase64 = null;
    let currentMimeType = 'image/jpeg';

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handleFile(e.target.files[0]);
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentBase64 = null;
      fileInput.value = '';
      previewBox.style.display = 'none';
      dropzone.style.display = 'block';
      searchBtn.disabled = true;
      resultsGrid.innerHTML = '';
      statusEl.style.display = 'none';
    });

    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPEG, PNG, WebP).');
        return;
      }
      currentMimeType = file.type;
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentBase64 = ev.target.result;
        previewImg.src = currentBase64;
        dropzone.style.display = 'none';
        previewBox.style.display = 'block';
        searchBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    }

    searchBtn.addEventListener('click', async () => {
      if (!currentBase64) return;
      searchBtn.disabled = true;
      searchBtn.innerHTML = `<span>⏳ Searching trails...</span>`;
      statusEl.style.display = 'block';
      statusEl.innerHTML = 'Extracting landscape features & matching against verified trails...';
      resultsGrid.innerHTML = '';

      try {
        const res = await fetch('/api/ai/photo-discovery/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: currentBase64,
            mimeType: currentMimeType,
            state: stateFilter.value || null,
            difficulty: diffFilter.value || null
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Photo search failed.');

        const isUncertain = data.destination_decision?.status === 'uncertain' ||
                            data.top_destination?.confidence_band === 'low' ||
                            (data.treks.length > 0 && data.treks[0].similarity_score < 0.45);

        if (isUncertain) {
          statusEl.innerHTML = `
            <div style="background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 10px; padding: 12px; margin-bottom: 12px; color: var(--text-primary);">
              <strong>⚠️ Unknown or Ambiguous Trail:</strong> Visual signals do not meet verified destination certainty thresholds (requires ≥45% archetype similarity and ≥3 pieces of corroborating evidence). Displaying visually closest landscapes across India below for comparison.
            </div>
          `;
        } else {
          statusEl.innerHTML = `Found <strong>${data.total_matches_found} matching trails</strong> similar to <em>${escapeHtml(data.detected_archetype || 'mountain landscape')}</em>.`;
        }

        if (data.treks.length === 0) {
          resultsGrid.innerHTML = `<div style="grid-column:1/-1; padding:20px; text-align:center; color:var(--text-secondary);">No direct visual matches found matching current filters. Try selecting 'All Regions'.</div>`;
          return;
        }

        resultsGrid.innerHTML = data.treks.map(t => {
          const score = t.similarity_score || (t.similarity_percentage ? parseInt(t.similarity_percentage, 10) / 100 : 0.5);
          let bandLabel = 'Similar Landscape';
          let bandBg = '#6B766F';
          if (score >= 0.70) {
            bandLabel = 'Strong Visual Match';
            bandBg = '#285D2A';
          } else if (score >= 0.45) {
            bandLabel = 'Possible Match';
            bandBg = '#C9652D';
          }

          return `
            <div class="photo-match-card" data-trek-id="${t.trek_id || ''}">
              <div class="photo-match-img-wrap">
                <img src="${escapeHtml(t.matched_image_url || 'Nature.jpg')}" alt="${escapeHtml(t.name)}" onerror="this.src='Nature.jpg'" />
                <div class="photo-match-score-pill" style="background:${bandBg};">${bandLabel} (${t.similarity_percentage || Math.round(score * 100) + '%'})</div>
              </div>
              <div class="photo-match-body">
                <div>
                  <div style="font-size:0.75rem; font-weight:700; color:var(--ai-accent); text-transform:uppercase;">${escapeHtml(t.state || 'India')}</div>
                  <div style="font-size:1.05rem; font-weight:700; margin:4px 0;">${escapeHtml(t.name)}</div>
                  <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">
                    ⛰️ ${t.elevation_m || t.highest_point_m || '—'}m • ${t.difficulty || 'Moderate'} • ${t.duration || 'N/A'}
                  </div>
                  ${t.evidence_sources ? `
                    <div style="font-size:0.72rem; color:var(--text-secondary); background:var(--ai-badge-bg); padding:4px 8px; border-radius:6px; margin-bottom:8px;">
                      ✓ Evidence: ${escapeHtml(t.evidence_sources)}
                    </div>
                  ` : ''}
                </div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                  <a href="trek-detail.html?slug=${encodeURIComponent(t.slug)}" class="ai-btn-secondary" style="flex:1; text-decoration:none; text-align:center;">
                    Explore Trail →
                  </a>
                  <button type="button" class="btn-feedback-report" data-trek-id="${t.trek_id || ''}" data-trek-name="${escapeHtml(t.name)}" style="background:transparent; border:1px solid var(--border-color); border-radius:8px; padding:6px 10px; font-size:0.75rem; cursor:pointer; color:var(--text-secondary);" title="Report incorrect destination">
                    Flag
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Wire feedback listeners
        resultsGrid.querySelectorAll('.btn-feedback-report').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const trekId = btn.getAttribute('data-trek-id');
            const trekName = btn.getAttribute('data-trek-name');
            const userCorrection = prompt(`Suggest correction for "${trekName}":\nIs this a different trek or destination? Enter the correct trek name or notes:`);
            if (userCorrection) {
              btn.disabled = true;
              btn.textContent = 'Submitting...';
              try {
                const fbRes = await fetch('/api/ai/visual/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    image_url: currentBase64.substring(0, 120),
                    predicted_trek_id: trekId ? parseInt(trekId, 10) : null,
                    feedback_type: 'flag_incorrect',
                    user_notes: `Correction submitted for ${trekName}: ${userCorrection}`
                  })
                });
                const fbData = await fbRes.json();
                if (fbData.success) {
                  btn.textContent = 'Reported ✓';
                  alert('Thank you! Your feedback has been recorded for review.');
                }
              } catch (err) {
                btn.textContent = 'Flag';
                btn.disabled = false;
              }
            }
          });
        });

      } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--ai-danger);">Error: ${escapeHtml(err.message)}</span>`;
      } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Search Similar Trails`;
      }
    });
  },

  // ─── 2. AI TREKVISION ───────────────────────────────────────────────────────
  initTrekVision(containerId = 'trekVisionContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="ai-card" id="trekVisionCard">
        <div class="ai-header-row">
          <div>
            <h3 class="ai-title">👁️ AI TrekVision</h3>
            <p class="ai-subtitle">Understand mountain peaks, terrain conditions, flora & fauna in your photos.</p>
          </div>
          <span class="ai-badge">Mountain Vision AI</span>
        </div>

        <div class="ai-upload-dropzone" id="visionDropzone">
          <input type="file" id="visionInput" accept="image/*" style="display:none;" />
          <span class="ai-upload-icon">📸</span>
          <div style="font-weight:700;">Snap or Upload Trail Photo</div>
          <div style="font-size:0.8rem; color:var(--text-secondary);">Identifies peaks, snow line, terrain & flora</div>
        </div>

        <div class="ai-preview-box" id="visionPreviewBox">
          <img id="visionPreviewImg" alt="Vision analysis preview" />
          <button type="button" class="ai-remove-preview-btn" id="visionRemoveBtn">&times;</button>
        </div>

        <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <label style="font-size:0.85rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="visionConsent" checked />
            Save analysis metadata to my profile
          </label>
          <button type="button" class="ai-btn-primary" id="visionAnalyzeBtn" disabled>
            Analyze Mountain View
          </button>
        </div>

        <div id="visionResultsBox" style="margin-top:16px; display:none;"></div>
      </div>
    `;

    const dropzone = container.querySelector('#visionDropzone');
    const fileInput = container.querySelector('#visionInput');
    const previewBox = container.querySelector('#visionPreviewBox');
    const previewImg = container.querySelector('#visionPreviewImg');
    const removeBtn = container.querySelector('#visionRemoveBtn');
    const analyzeBtn = container.querySelector('#visionAnalyzeBtn');
    const resultsBox = container.querySelector('#visionResultsBox');
    const consentCheck = container.querySelector('#visionConsent');

    let currentBase64 = null;
    let currentMime = 'image/jpeg';

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      currentMime = file.type;
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentBase64 = ev.target.result;
        previewImg.src = currentBase64;
        dropzone.style.display = 'none';
        previewBox.style.display = 'block';
        analyzeBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', () => {
      currentBase64 = null;
      fileInput.value = '';
      previewBox.style.display = 'none';
      dropzone.style.display = 'block';
      analyzeBtn.disabled = true;
      resultsBox.style.display = 'none';
    });

    analyzeBtn.addEventListener('click', async () => {
      if (!currentBase64) return;
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Analyzing Mountain View...';
      resultsBox.style.display = 'block';
      resultsBox.innerHTML = '<div style="padding:14px; color:var(--text-secondary);">Identifying mountain ranges, topography & safety factors...</div>';

      try {
        const res = await fetch('/api/ai/trekvision/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: currentBase64,
            mimeType: currentMime,
            consent_retained: consentCheck.checked
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Vision analysis failed.');

        const a = data.analysis;
        resultsBox.innerHTML = `
          <div style="background:var(--ai-badge-bg); border:1px solid var(--ai-border); border-radius:12px; padding:16px;">
            <div style="font-weight:700; font-size:1.05rem; margin-bottom:6px; color:var(--text-primary);">${escapeHtml(a.summary || 'Mountain Analysis')}</div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;"><strong>Zone:</strong> ${escapeHtml(a.mountain_range || 'Himalayan Ridge')} • <strong>Confidence:</strong> ${Math.round((a.confidence_score || 0.8) * 100)}%</div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.85rem; margin-bottom:14px;">
              <div>
                <strong>🏔️ Identified Features:</strong>
                <div>${(a.identified_peaks || ['Prominent Mountain Ridge']).map(p => escapeHtml(p)).join(', ')}</div>
              </div>
              <div>
                <strong>🌿 Terrain & Trail:</strong>
                <div>${escapeHtml(a.terrain?.type || 'Natural trail')} (${escapeHtml(a.terrain?.trail_condition || 'Dry to rocky')})</div>
              </div>
              <div>
                <strong>❄️ Snow & Ice:</strong>
                <div>${a.snow_and_ice?.presence ? `${a.snow_and_ice.coverage_percentage}% coverage` : 'Clear / No snowpack'}</div>
              </div>
              <div>
                <strong>🛡️ Safety Observation:</strong>
                <div>${(a.safety_observations || ['Standard trail awareness']).join('; ')}</div>
              </div>
            </div>

            ${data.suggested_treks?.length ? `
              <div style="border-top:1px solid var(--ai-border); padding-top:10px; margin-top:10px;">
                <div style="font-size:0.8rem; font-weight:700; text-transform:uppercase; color:var(--ai-accent); margin-bottom:8px;">Related TrekIndia Destinations:</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  ${data.suggested_treks.map(st => `
                    <a href="trek-detail.html?slug=${encodeURIComponent(st.slug)}" class="ai-badge" style="text-decoration:none;">
                      ${escapeHtml(st.trek_name)} (${escapeHtml(st.state_name || 'India')}) →
                    </a>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      } catch (err) {
        resultsBox.innerHTML = `<div style="color:var(--ai-danger); padding:10px;">Error: ${escapeHtml(err.message)}</div>`;
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Mountain View';
      }
    });
  },

  // ─── 3. AI ALTITUDE GUARDIAN ────────────────────────────────────────────────
  initAltitudeGuardian(containerId, trekSlugOrId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="ai-card" id="altitudeGuardianCard">
        <div class="ai-header-row">
          <div>
            <h3 class="ai-title">🛡️ AI Altitude Guardian</h3>
            <p class="ai-subtitle">Intelligent safety companion: verified AMS elevation rules & medical guidance.</p>
          </div>
          <span class="ai-badge" id="altitudeZoneBadge">Checking Altitude...</span>
        </div>

        <div class="altitude-risk-bar">
          <div class="alt-seg low active" title="Low (<2500m)"></div>
          <div class="alt-seg high" id="segHigh" title="High (2500m-3500m)"></div>
          <div class="alt-seg very-high" id="segVeryHigh" title="Very High (3500m-5500m)"></div>
          <div class="alt-seg extreme" id="segExtreme" title="Extreme (>5500m)"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-secondary); margin-bottom:12px;">
          <span>0m</span><span>2500m (AMS risk begins)</span><span>3500m (High risk)</span><span>5500m+</span>
        </div>

        <div id="guardianBrief" style="font-size:0.9rem; line-height:1.5; color:var(--text-primary); margin-bottom:14px;">
          Loading verified altitude assessment...
        </div>

        <div style="font-weight:700; font-size:0.85rem; margin-bottom:6px;">Check Your Current Symptoms (if on trail):</div>
        <div class="symptom-tag-grid" id="symptomGrid">
          <span class="symptom-chip" data-sym="headache">Headache</span>
          <span class="symptom-chip" data-sym="nausea">Nausea</span>
          <span class="symptom-chip" data-sym="fatigue">Fatigue</span>
          <span class="symptom-chip" data-sym="dizziness">Dizziness</span>
          <span class="symptom-chip" data-sym="breathlessness_at_rest">Breathless at Rest ⚠️</span>
          <span class="symptom-chip" data-sym="ataxia">Unsteady Walking (Ataxia) 🚨</span>
        </div>

        <div id="guardianEmergencyBox" style="display:none; margin-top:14px; padding:14px; border-radius:12px; background:var(--ai-danger-bg); border:1px solid var(--ai-danger);"></div>

        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:16px;">
          <div style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:8px;">Altitude Preparation Rules:</div>
          <ul id="guardianRulesList" style="margin:0; padding-left:18px; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;"></ul>
        </div>
      </div>
    `;

    const zoneBadge = container.querySelector('#altitudeZoneBadge');
    const briefEl = container.querySelector('#guardianBrief');
    const rulesList = container.querySelector('#guardianRulesList');
    const emergencyBox = container.querySelector('#guardianEmergencyBox');
    const segHigh = container.querySelector('#segHigh');
    const segVeryHigh = container.querySelector('#segVeryHigh');
    const segExtreme = container.querySelector('#segExtreme');
    const symptomChips = container.querySelectorAll('.symptom-chip');

    let activeSymptoms = [];

    async function loadAssessment() {
      try {
        const res = await fetch('/api/ai/safety/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trek_slug: typeof trekSlugOrId === 'string' ? trekSlugOrId : undefined,
            trek_id: typeof trekSlugOrId === 'number' ? trekSlugOrId : undefined,
            symptoms: activeSymptoms
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Safety assessment failed.');

        const s = data.safety_assessment;
        zoneBadge.textContent = `${s.risk_level} RISK (${data.trek.max_elevation_m}m)`;
        zoneBadge.className = `ai-badge ${s.risk_level === 'HIGH' || s.risk_level === 'CRITICAL' ? 'danger' : (s.risk_level === 'MODERATE' ? 'warning' : '')}`;

        const elev = data.trek.max_elevation_m;
        if (elev >= 2500) segHigh.classList.add('active');
        if (elev >= 3500) segVeryHigh.classList.add('active');
        if (elev >= 5500) segExtreme.classList.add('active');

        briefEl.innerHTML = `<p>${escapeHtml(s.ai_explanation)}</p>`;
        rulesList.innerHTML = s.deterministic_rules.map(r => `<li>${escapeHtml(r)}</li>`).join('');

        if (s.emergency_guidance) {
          emergencyBox.style.display = 'block';
          const eg = s.emergency_guidance;
          emergencyBox.innerHTML = `
            <div style="font-weight:800; color:var(--ai-danger); font-size:0.95rem; display:flex; align-items:center; gap:6px;">
              🚨 ${escapeHtml(eg.action_required)}
            </div>
            <div style="font-size:0.85rem; color:var(--text-primary); margin-top:6px; line-height:1.4;">
              ${escapeHtml(eg.protocol)}
            </div>
          `;
        } else {
          emergencyBox.style.display = 'none';
        }
      } catch (err) {
        briefEl.innerHTML = `<span style="color:var(--text-secondary);">Safety brief currently unavailable. Standard mountain precautions apply.</span>`;
      }
    }

    symptomChips.forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        const sym = chip.dataset.sym;
        if (chip.classList.contains('selected')) {
          activeSymptoms.push(sym);
        } else {
          activeSymptoms = activeSymptoms.filter(s => s !== sym);
        }
        loadAssessment();
      });
    });

    loadAssessment();
  },

  // ─── 4. AI TREK COST INTELLIGENCE ───────────────────────────────────────────
  initCostIntelligence(containerId, trekSlugOrId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="ai-card" id="costIntelligenceCard">
        <div class="ai-header-row">
          <div>
            <h3 class="ai-title">💰 Calculate My Trek Cost</h3>
            <p class="ai-subtitle">Transparent, itemized mountain budget with verifiable cost breakdowns.</p>
          </div>
          <span class="ai-badge">Cost Intelligence AI</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:16px;">
          <div>
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">STARTING CITY</label>
            <select id="costCity" class="explore-filter-select" style="width:100%; margin-top:4px;">
              <option value="Delhi">Delhi</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Bangalore">Bangalore</option>
              <option value="Pune">Pune</option>
              <option value="Kolkata">Kolkata</option>
              <option value="Dehradun">Dehradun / Local</option>
            </select>
          </div>

          <div>
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">GROUP SIZE</label>
            <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
              <button type="button" class="ai-btn-secondary" id="costMinusGroup" style="padding:6px 12px;">−</button>
              <span id="costGroupDisplay" style="font-weight:700; min-width:24px; text-align:center;">2</span>
              <button type="button" class="ai-btn-secondary" id="costPlusGroup" style="padding:6px 12px;">+</button>
            </div>
          </div>

          <div>
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">GEAR RENTAL</label>
            <select id="costGear" class="explore-filter-select" style="width:100%; margin-top:4px;">
              <option value="basic">Basic (Poles + Poncho)</option>
              <option value="complete">Complete (Jacket + Bag)</option>
              <option value="none">Own Gear (₹0)</option>
            </select>
          </div>
        </div>

        <div class="tier-switcher" role="tablist">
          <button type="button" class="tier-btn" data-tier="budget">🏕️ Budget Tier</button>
          <button type="button" class="tier-btn active" data-tier="standard">⭐ Standard Tier</button>
          <button type="button" class="tier-btn" data-tier="comfortable">✨ Comfortable Tier</button>
        </div>

        <div id="costLoading" style="text-align:center; padding:20px; color:var(--text-secondary); display:none;">Calculating verifiable costs...</div>

        <div id="costResultsTableWrapper"></div>

        <div id="costAiInsights" style="font-size:0.85rem; color:var(--text-secondary); margin-top:12px; line-height:1.5; padding:10px 14px; background:rgba(0,0,0,0.02); border-radius:10px;"></div>
      </div>
    `;

    const citySelect = container.querySelector('#costCity');
    const groupDisplay = container.querySelector('#costGroupDisplay');
    const minusBtn = container.querySelector('#costMinusGroup');
    const plusBtn = container.querySelector('#costPlusGroup');
    const gearSelect = container.querySelector('#costGear');
    const tierBtns = container.querySelectorAll('.tier-btn');
    const tableWrap = container.querySelector('#costResultsTableWrapper');
    const insightsEl = container.querySelector('#costAiInsights');
    const loadingEl = container.querySelector('#costLoading');

    let currentGroup = 2;
    let currentTier = 'standard';

    minusBtn.addEventListener('click', () => {
      if (currentGroup > 1) {
        currentGroup--;
        groupDisplay.textContent = currentGroup;
        fetchCostEstimate();
      }
    });

    plusBtn.addEventListener('click', () => {
      if (currentGroup < 20) {
        currentGroup++;
        groupDisplay.textContent = currentGroup;
        fetchCostEstimate();
      }
    });

    citySelect.addEventListener('change', fetchCostEstimate);
    gearSelect.addEventListener('change', fetchCostEstimate);

    tierBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tierBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTier = btn.dataset.tier;
        fetchCostEstimate();
      });
    });

    async function fetchCostEstimate() {
      loadingEl.style.display = 'block';
      try {
        const res = await fetch('/api/ai/cost/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trek_slug: typeof trekSlugOrId === 'string' ? trekSlugOrId : undefined,
            trek_id: typeof trekSlugOrId === 'number' ? trekSlugOrId : undefined,
            starting_city: citySelect.value,
            group_size: currentGroup,
            tier: currentTier,
            gear_needed: gearSelect.value
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to estimate cost.');

        const plan = data.active_plan;
        tableWrap.innerHTML = `
          <table class="cost-breakdown-table">
            <thead>
              <tr>
                <th>Expense Category</th>
                <th>Details</th>
                <th style="text-align:right;">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${plan.components.map(c => `
                <tr>
                  <td><strong>${escapeHtml(c.category)}</strong></td>
                  <td style="color:var(--text-secondary); font-size:0.82rem;">${escapeHtml(c.notes || '')}</td>
                  <td style="text-align:right; font-weight:600;">₹${c.amount_inr.toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">Estimated Group Total (${currentGroup} Trekkers)</td>
                <td style="text-align:right;">₹${plan.total_group_cost_inr.toLocaleString()}</td>
              </tr>
              <tr style="background:var(--ai-badge-bg);">
                <td colspan="2" style="color:var(--ai-accent); font-weight:700;">Cost Per Trekker</td>
                <td style="text-align:right; font-weight:800; font-size:1.15rem; color:var(--ai-accent);">₹${plan.per_person_inr.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        `;

        insightsEl.innerHTML = `<strong>💡 Budget Insights:</strong> ${escapeHtml(data.ai_insights)}`;
      } catch (err) {
        tableWrap.innerHTML = `<div style="color:var(--ai-danger); padding:10px;">Error calculating cost: ${escapeHtml(err.message)}</div>`;
      } finally {
        loadingEl.style.display = 'none';
      }
    }

    fetchCostEstimate();
  },

  // ─── 5. AI TREK NUTRITION PLANNER ───────────────────────────────────────────
  initNutritionPlanner(containerId, trekSlugOrId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="ai-card" id="nutritionPlannerCard">
        <div class="ai-header-row">
          <div>
            <h3 class="ai-title">🍽️ AI Trek Nutrition Planner</h3>
            <p class="ai-subtitle">High-energy trail rations, packing list & daily caloric breakdown.</p>
          </div>
          <span class="ai-badge">Trail Nutrition AI</span>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
          <div>
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">DIET PREFERENCE</label>
            <select id="nutritionDiet" class="explore-filter-select" style="margin-top:4px;">
              <option value="Vegetarian">Vegetarian</option>
              <option value="Non-Vegetarian">Non-Vegetarian</option>
              <option value="Vegan">Vegan</option>
              <option value="Jain">Jain (No Root Veg)</option>
            </select>
          </div>

          <div>
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">ACTIVITY LEVEL</label>
            <select id="nutritionActivity" class="explore-filter-select" style="margin-top:4px;">
              <option value="Moderate">Moderate (6-8 km/day)</option>
              <option value="Intense">Intense (10+ km / High Ascent)</option>
              <option value="Light">Light Day Hike</option>
            </select>
          </div>

          <div style="align-self:flex-end;">
            <button type="button" class="ai-btn-primary" id="nutritionGenerateBtn">
              Generate Nutrition Plan
            </button>
          </div>
        </div>

        <div id="nutritionOutput" style="display:none; margin-top:16px;"></div>
      </div>
    `;

    const dietSelect = container.querySelector('#nutritionDiet');
    const actSelect = container.querySelector('#nutritionActivity');
    const genBtn = container.querySelector('#nutritionGenerateBtn');
    const outDiv = container.querySelector('#nutritionOutput');

    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      genBtn.textContent = 'Generating Plan...';
      outDiv.style.display = 'block';
      outDiv.innerHTML = '<div style="color:var(--text-secondary);">Calculating mountain caloric target and trail rations...</div>';

      try {
        const res = await fetch('/api/ai/nutrition/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trek_slug: typeof trekSlugOrId === 'string' ? trekSlugOrId : undefined,
            trek_id: typeof trekSlugOrId === 'number' ? trekSlugOrId : undefined,
            diet_type: dietSelect.value,
            activity_intensity: actSelect.value
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Nutrition plan failed.');

        const np = data.nutrition_plan;
        outDiv.innerHTML = `
          <div style="padding:14px; background:var(--ai-badge-bg); border-radius:12px; margin-bottom:14px;">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Energy Strategy: ${escapeHtml(np.summary)}</div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">
              <strong>Daily Target:</strong> ~${np.daily_target_calories || 3200} kcal/day • <strong>Estimated Ration Cost:</strong> ₹${np.estimated_food_expense_inr} • <strong>Hydration:</strong> ${escapeHtml(np.hydration_guideline || '4L/day')}
            </div>
          </div>

          <div style="font-weight:700; font-size:0.95rem; margin-bottom:10px;">Day-by-Day Meal Strategy:</div>
          <div>
            ${(np.daily_meals || []).map(m => `
              <div class="nutrition-day-card">
                <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">Day ${m.day}: ${escapeHtml(m.stage || 'Trail Stage')}</div>
                <div class="nutrition-meal-row"><span class="meal-label">Breakfast:</span> <span>${escapeHtml(m.breakfast?.name || 'Porridge')} (${m.breakfast?.weight_g || 100}g)</span></div>
                <div class="nutrition-meal-row"><span class="meal-label">Trail Snack:</span> <span>${escapeHtml(m.trail_snack_morning?.name || 'Nuts & Dates')}</span></div>
                <div class="nutrition-meal-row"><span class="meal-label">Midday Fuel:</span> <span>${escapeHtml(m.lunch?.name || 'Khichdi')}</span></div>
                <div class="nutrition-meal-row"><span class="meal-label">Dinner:</span> <span>${escapeHtml(m.dinner?.name || 'Soup & Noodles')}</span></div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top:16px;">
            <div style="font-weight:700; font-size:0.9rem; margin-bottom:6px;">🛒 Essential Trail Grocery List:</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; font-size:0.85rem;">
              ${(np.shopping_list || []).map(cat => `
                <div style="border:1px solid var(--border); border-radius:8px; padding:10px;">
                  <strong style="color:var(--ai-accent);">${escapeHtml(cat.category)}</strong>
                  <ul style="margin:4px 0 0 16px; padding:0;">
                    ${(cat.items || []).map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } catch (err) {
        outDiv.innerHTML = `<div style="color:var(--ai-danger); padding:10px;">Error generating plan: ${escapeHtml(err.message)}</div>`;
      } finally {
        genBtn.disabled = false;
        genBtn.textContent = 'Generate Nutrition Plan';
      }
    });
  },

  // ─── 6. AI OFFLINE TREK COMPANION ───────────────────────────────────────────
  initOfflineCompanion(containerId, trekSlugOrId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="ai-card" id="offlineCompanionCard">
        <div class="ai-header-row">
          <div>
            <h3 class="ai-title">📶 AI Offline Trek Companion</h3>
            <p class="ai-subtitle">Download offline trail guides, emergency contacts, and maps for zero-connectivity zones.</p>
          </div>
          <span class="ai-badge" id="offlineStatusBadge">Offline Ready</span>
        </div>

        <div id="offlinePackageInfo" style="margin-bottom:14px; font-size:0.88rem; color:var(--text-secondary);">
          Checking local IndexedDB storage status...
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button type="button" class="ai-btn-primary" id="btnDownloadOffline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Offline Guide
          </button>
          <button type="button" class="ai-btn-secondary" id="btnRemoveOffline" style="display:none; color:var(--ai-danger); border-color:rgba(220,38,38,0.3);">
            Remove Offline Download
          </button>
        </div>

        <div id="offlineDetailsModal" style="display:none; margin-top:16px; padding:14px; background:rgba(0,0,0,0.02); border:1px solid var(--border); border-radius:12px;"></div>
      </div>
    `;

    const statusBadge = container.querySelector('#offlineStatusBadge');
    const infoEl = container.querySelector('#offlinePackageInfo');
    const downloadBtn = container.querySelector('#btnDownloadOffline');
    const removeBtn = container.querySelector('#btnRemoveOffline');
    const detailsDiv = container.querySelector('#offlineDetailsModal');

    async function checkLocalStatus() {
      if (!window.TrekIndiaOfflineStorage) return;
      try {
        const cached = await window.TrekIndiaOfflineStorage.getPackage(trekSlugOrId);
        if (cached) {
          statusBadge.textContent = '✓ Saved Offline';
          statusBadge.className = 'ai-badge';
          infoEl.innerHTML = `This trail guide is cached in browser IndexedDB (Saved on ${new Date(cached.generated_at || Date.now()).toLocaleDateString()}). You can access full trail stats, safety protocols, and emergency numbers without internet.`;
          downloadBtn.innerHTML = `✓ Re-sync Offline Guide`;
          removeBtn.style.display = 'inline-flex';
          renderOfflineDetails(cached);
        } else {
          statusBadge.textContent = 'Not Cached';
          statusBadge.className = 'ai-badge warning';
          infoEl.textContent = 'No local offline copy found. Download now before entering remote mountain areas.';
          removeBtn.style.display = 'none';
          detailsDiv.style.display = 'none';
        }
      } catch (err) {
        infoEl.textContent = 'Offline storage initialized.';
      }
    }

    function renderOfflineDetails(pkg) {
      detailsDiv.style.display = 'block';
      detailsDiv.innerHTML = `
        <div style="font-weight:700; color:var(--text-primary); font-size:0.95rem; margin-bottom:6px;">📦 Local Offline Package Details:</div>
        <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
          <div><strong>Trail:</strong> ${escapeHtml(pkg.trek?.name || 'Trek')} (${escapeHtml(pkg.trek?.state || 'India')})</div>
          <div><strong>Coordinates:</strong> ${pkg.location?.latitude || '—'}, ${pkg.location?.longitude || '—'}</div>
          <div><strong>Safety Zone:</strong> ${escapeHtml(pkg.safety_guidelines?.altitude_zone || 'High Altitude')}</div>
          <div style="margin-top:8px;"><strong>Emergency Contacts Available Offline:</strong></div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
            ${(pkg.emergency_contacts || []).map(ec => `<span class="ai-badge">${escapeHtml(ec.agency)}: ${escapeHtml(ec.number)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    downloadBtn.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = 'Downloading Package...';
      try {
        const res = await fetch(`/api/offline/treks/${encodeURIComponent(trekSlugOrId)}/package`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Could not download offline package.');

        if (window.TrekIndiaOfflineStorage) {
          await window.TrekIndiaOfflineStorage.savePackage(data.package);
        }

        alert(`✅ Offline guide for ${data.package.trek.name} downloaded successfully (${data.size_formatted}).`);
        checkLocalStatus();
      } catch (err) {
        alert('Download error: ' + err.message);
      } finally {
        downloadBtn.disabled = false;
      }
    });

    removeBtn.addEventListener('click', async () => {
      if (!confirm('Remove this offline trail guide from local device storage?')) return;
      try {
        const cached = await window.TrekIndiaOfflineStorage.getPackage(trekSlugOrId);
        if (cached?.trek?.trek_id) {
          await window.TrekIndiaOfflineStorage.removePackage(cached.trek.trek_id);
          await fetch(`/api/offline/treks/${cached.trek.trek_id}/package`, { method: 'DELETE' }).catch(() => {});
        }
        checkLocalStatus();
      } catch (err) {
        console.error(err);
      }
    });

    checkLocalStatus();
  },

  // ─── 7. AI EMERGENCY SOS INTELLIGENCE ───────────────────────────────────────
  initEmergencySos(containerId, trekSlugOrId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="ai-card" style="border-color:rgba(220,38,38,0.3); background:var(--ai-danger-bg);" id="emergencySosCard">
        <div class="ai-header-row">
          <div>
            <h3 class="ai-title" style="color:var(--ai-danger);">🚨 Mountain Emergency SOS Intelligence</h3>
            <p class="ai-subtitle">Instant incident reporting, GPS coordinate dispatch & emergency first aid guidance.</p>
          </div>
          <span class="sos-live-pill"><span class="sos-live-dot"></span> SOS Active</span>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; align-items:center;">
          <div style="flex:1; min-width:180px;">
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">INCIDENT TYPE</label>
            <select id="sosTypeSelect" class="explore-filter-select" style="width:100%; margin-top:4px;">
              <option value="medical">Severe Medical / Altitude Sickness</option>
              <option value="injury">Physical Injury / Fracture / Sprain</option>
              <option value="lost_trail">Lost Trail / Disorientation</option>
              <option value="severe_weather">Severe Weather / Blizzard / Avalanche Risk</option>
              <option value="wildlife_encounter">Wildlife Threat / Animal Encounter</option>
              <option value="other">Other Trail Emergency</option>
            </select>
          </div>

          <div style="flex:2; min-width:240px;">
            <label style="font-size:0.78rem; font-weight:700; color:var(--text-secondary);">BRIEF EMERGENCY DESCRIPTION</label>
            <input type="text" id="sosDescInput" class="explore-search-input" placeholder="e.g. Inability to walk, falling rock injury, need evacuation..." style="margin-top:4px;" />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <div style="font-size:0.85rem; color:var(--text-secondary);" id="sosGpsStatus">
            📍 GPS: Acquiring current satellite coordinates...
          </div>
          <button type="button" class="ai-btn-danger" id="sosTriggerBtn">
            DISPATCH EMERGENCY SOS
          </button>
        </div>

        <div id="sosResponseBox" style="display:none; margin-top:14px; padding:16px; background:var(--card-bg, #fff); border-radius:12px; border:1px solid var(--border);"></div>

        <div style="border-top:1px solid rgba(220,38,38,0.2); padding-top:12px; margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">DIRECT PHONE DIAL:</span>
          <a href="tel:112" class="sos-phone-pill">📞 112 Universal Police</a>
          <a href="tel:108" class="sos-phone-pill">🚑 108 Ambulance</a>
          <a href="tel:1070" class="sos-phone-pill">🏔️ 1070 Disaster Control (SDRF)</a>
        </div>
      </div>
    `;

    const typeSelect = container.querySelector('#sosTypeSelect');
    const descInput = container.querySelector('#sosDescInput');
    const gpsStatusEl = container.querySelector('#sosGpsStatus');
    const triggerBtn = container.querySelector('#sosTriggerBtn');
    const responseBox = container.querySelector('#sosResponseBox');

    let currentLat = null;
    let currentLng = null;
    let currentAccuracy = null;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          currentLat = pos.coords.latitude;
          currentLng = pos.coords.longitude;
          currentAccuracy = pos.coords.accuracy;
          gpsStatusEl.innerHTML = `📍 GPS Locked: <strong>${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}</strong> (Accuracy: ±${Math.round(currentAccuracy)}m)`;
        },
        (err) => {
          gpsStatusEl.innerHTML = `📍 GPS Notice: ${err.message}. Trailhead coordinates will be triangulated from trek record.`;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    triggerBtn.addEventListener('click', async () => {
      const confirmDispatch = confirm('CONFIRM EMERGENCY SOS DISPATCH?\nThis alerts your registered emergency contacts and logs critical trail coordinates.');
      if (!confirmDispatch) return;

      triggerBtn.disabled = true;
      triggerBtn.textContent = 'DISPATCHING EMERGENCY ALERT...';

      try {
        const res = await fetch('/api/sos/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            incident_type: typeSelect.value,
            description: descInput.value,
            latitude: currentLat,
            longitude: currentLng,
            location_accuracy_m: currentAccuracy,
            trek_id: typeof trekSlugOrId === 'number' ? trekSlugOrId : undefined
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'SOS dispatch failed.');

        responseBox.style.display = 'block';
        responseBox.innerHTML = `
          <div style="font-weight:800; color:var(--ai-danger); font-size:1.05rem; margin-bottom:8px;">
            🚨 Incident Logged (#${data.incident_id})
          </div>
          <div style="font-size:0.88rem; color:var(--text-primary); margin-bottom:12px; line-height:1.4;">
            <strong>Dispatch Message:</strong> ${escapeHtml(data.dispatch_message)}
          </div>
          <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:14px;">
            <strong>Status:</strong> ${escapeHtml(data.status_notice)}
          </div>

          <div style="background:var(--ai-badge-bg); border-radius:10px; padding:12px; font-size:0.85rem;">
            <strong style="color:var(--ai-accent); display:block; margin-bottom:6px;">🩹 Immediate First Aid Actions:</strong>
            <ul style="margin:0; padding-left:16px; line-height:1.5;">
              ${(data.first_aid_guidance?.primary_actions || []).map(a => `<li>${escapeHtml(a)}</li>`).join('')}
            </ul>
          </div>
        `;
      } catch (err) {
        alert('SOS Submission Error: ' + err.message);
      } finally {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'DISPATCH EMERGENCY SOS';
      }
    });
  }
};

window.TrekIndiaAI = AIEcosystem;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

// Auto-register service worker on supported browsers
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[ServiceWorker] Active & registered with scope:', reg.scope);
    }).catch((err) => {
      console.warn('[ServiceWorker] Registration failed:', err);
    });
  });
}

