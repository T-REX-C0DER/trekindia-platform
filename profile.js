/**
 * TrekIndia — Premium Dynamic User Profile Controller (profile.js)
 */

(function () {
  let currentUserProfile = null;
  let currentView = 'overview';
  let myTreksDifficulty = 'All';
  let myTreksSort = 'recent';

  // DOM Cache
  const DOM = {
    // Navigation
    sidebarLinks: document.querySelectorAll('.sidebar-link'),
    mobileNavLinks: document.querySelectorAll('.mobile-nav-link'),
    viewSections: document.querySelectorAll('.view-section'),
    
    // Sidebar User Area
    sidebarUserName: document.getElementById('sidebarUserName'),
    sidebarAvatarContainer: document.getElementById('sidebarAvatarContainer'),
    sidebarAvatarInitial: document.getElementById('sidebarAvatarInitial'),
    
    // Hero Elements
    heroFullName: document.getElementById('heroFullName'),
    heroUsername: document.getElementById('heroUsername'),
    heroBio: document.getElementById('heroBio'),
    heroLocation: document.getElementById('heroLocation'),
    heroMemberSince: document.getElementById('heroMemberSince'),
    heroAvatarContainer: document.getElementById('heroAvatarContainer'),
    heroAvatarInitial: document.getElementById('heroAvatarInitial'),
    btnEditProfile: document.getElementById('btnEditProfile'),
    btnShareProfile: document.getElementById('btnShareProfile'),
    
    // Statistics
    statTreksCompleted: document.getElementById('statTreksCompleted'),
    statDistanceKm: document.getElementById('statDistanceKm'),
    statHighestSummitM: document.getElementById('statHighestSummitM'),
    statStatesExplored: document.getElementById('statStatesExplored'),
    statDaysOnTrail: document.getElementById('statDaysOnTrail'),
    
    // Journey
    journeyFavDifficulty: document.getElementById('journeyFavDifficulty'),
    journeyFavDifficultySub: document.getElementById('journeyFavDifficultySub'),
    journeyFavSeason: document.getElementById('journeyFavSeason'),
    journeyFavSeasonSub: document.getElementById('journeyFavSeasonSub'),
    
    // Grids & Containers
    highlightsTrekGrid: document.getElementById('highlightsTrekGrid'),
    overviewTimeline: document.getElementById('overviewTimeline'),
    myTreksGrid: document.getElementById('myTreksGrid'),
    savedTreksGrid: document.getElementById('savedTreksGrid'),
    wishlistGrid: document.getElementById('wishlistGrid'),
    badgesGrid: document.getElementById('badgesGrid'),
    reviewsGrid: document.getElementById('reviewsGrid'),
    fullActivityTimeline: document.getElementById('fullActivityTimeline'),
    myTreksCompletedCount: document.getElementById('myTreksCompletedCount'),
    myTreksTotalDistance: document.getElementById('myTreksTotalDistance'),
    
    // Filters & Controls
    treksFilterPills: document.getElementById('treksFilterPills'),
    treksSortSelect: document.getElementById('treksSortSelect'),
    
    // Settings
    settingEmail: document.getElementById('settingEmail'),
    settingUsername: document.getElementById('settingUsername'),
    formAccountDetails: document.getElementById('formAccountDetails'),
    btnOpenDeleteModal: document.getElementById('btnOpenDeleteModal'),
    
    // Modals
    editProfileModal: document.getElementById('editProfileModal'),
    btnCloseEditModal: document.getElementById('btnCloseEditModal'),
    btnCancelEditModal: document.getElementById('btnCancelEditModal'),
    formEditProfile: document.getElementById('formEditProfile'),
    editAvatarUrl: document.getElementById('editAvatarUrl'),
    editFullName: document.getElementById('editFullName'),
    editUsername: document.getElementById('editUsername'),
    editLocation: document.getElementById('editLocation'),
    editWebsite: document.getElementById('editWebsite'),
    editBio: document.getElementById('editBio'),
    bioCharCount: document.getElementById('bioCharCount'),
    
    shareProfileModal: document.getElementById('shareProfileModal'),
    btnCloseShareModal: document.getElementById('btnCloseShareModal'),
    shareProfileUrlInput: document.getElementById('shareProfileUrlInput'),
    btnCopyShareUrl: document.getElementById('btnCopyShareUrl'),
    
    deleteAccountModal: document.getElementById('deleteAccountModal'),
    btnCloseDeleteModal: document.getElementById('btnCloseDeleteModal'),
    btnCancelDeleteModal: document.getElementById('btnCancelDeleteModal'),
    formConfirmDelete: document.getElementById('formConfirmDelete'),
    deleteConfirmPassword: document.getElementById('deleteConfirmPassword'),
    
    toastContainer: document.getElementById('toast-container')
  };

  // 1. Initialize Application
  async function init() {
    setupEventListeners();
    handleHashNavigation();

    // Verify session
    try {
      const user = await window.TrekIndiaAuth.checkAuthStatus();
      if (!user) {
        window.location.href = 'auth.html';
        return;
      }
      
      // Load Profile Data
      await loadProfileData();
    } catch (err) {
      console.error('Session verification error:', err);
      window.location.href = 'auth.html';
    }
  }

  // 2. Load Profile Data
  async function loadProfileData() {
    try {
      showSkeletons();

      const response = await fetch('/api/profile', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = 'auth.html';
          return;
        }
        throw new Error('Failed to load profile data.');
      }

      const data = await response.json();
      if (data.success) {
        currentUserProfile = data;
        renderProfileHeader(data.user);
        renderStats(data.stats);
        renderJourney(data.journey);
        populateSettingsForm(data.user);

        // Load active view data
        loadViewData(currentView);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      showToast('Error loading profile data. Please try again.');
    }
  }

  // 3. Render Profile Header & Sidebar User Area
  function renderProfileHeader(user) {
    const fullName = user.full_name || user.username || 'Trekker';
    const initial = fullName.charAt(0).toUpperCase();

    DOM.sidebarUserName.textContent = fullName;
    DOM.heroFullName.textContent = fullName;
    DOM.heroUsername.textContent = `@${user.username}`;
    DOM.heroBio.textContent = user.bio || 'Chasing trails, summits & sunsets across India.';
    DOM.heroLocation.textContent = user.location || 'India';
    
    const joinedYear = user.created_at ? new Date(user.created_at).getFullYear() : 2026;
    DOM.heroMemberSince.textContent = `Member since ${joinedYear}`;

    // Render Avatars
    if (user.profile_image) {
      DOM.sidebarAvatarContainer.innerHTML = `<img src="${escapeHtml(user.profile_image)}" class="sidebar-avatar-img" alt="${escapeHtml(fullName)}" />`;
      DOM.heroAvatarContainer.innerHTML = `<img src="${escapeHtml(user.profile_image)}" class="hero-avatar-img" alt="${escapeHtml(fullName)}" />`;
    } else {
      DOM.sidebarAvatarContainer.innerHTML = `<div class="sidebar-avatar-initial">${initial}</div>`;
      DOM.heroAvatarContainer.innerHTML = `<div class="hero-avatar-initial">${initial}</div>`;
    }
  }

  // 4. Render 5 Key Statistics
  function renderStats(stats) {
    DOM.statTreksCompleted.textContent = stats.treksCompleted || 0;
    DOM.statDistanceKm.textContent = stats.totalDistanceKm || 0;
    DOM.statHighestSummitM.textContent = (stats.highestSummitM || 0).toLocaleString();
    DOM.statStatesExplored.textContent = stats.statesExplored || 0;
    DOM.statDaysOnTrail.textContent = stats.daysOnTrail || 0;

    DOM.myTreksCompletedCount.textContent = `${stats.treksCompleted || 0} Completed Treks`;
    DOM.myTreksTotalDistance.textContent = `${stats.totalDistanceKm || 0} km Total Distance`;
  }

  // 5. Render Trekking Journey
  function renderJourney(journey) {
    DOM.journeyFavDifficulty.textContent = journey.favoriteDifficulty || 'Moderate';
    DOM.journeyFavDifficultySub.textContent = `${journey.favoriteDifficultyCount || 0} treks completed`;

    DOM.journeyFavSeason.textContent = journey.favoriteSeason || 'Monsoon';
    DOM.journeyFavSeasonSub.textContent = `${journey.favoriteSeasonCount || 0} treks completed`;
  }

  // 6. View Data Router
  async function loadViewData(viewName) {
    switch (viewName) {
      case 'overview':
        await Promise.all([loadHighlights(), loadOverviewActivity()]);
        break;
      case 'treks':
        await loadMyTreks();
        break;
      case 'saved':
        await loadSavedTreks();
        break;
      case 'wishlist':
        await loadWishlist();
        break;
      case 'badges':
        await loadBadges();
        break;
      case 'reviews':
        await loadReviews();
        break;
      case 'activity':
        await loadFullActivity();
        break;
    }
  }

  // 7. Load Trekking Highlights (Overview)
  async function loadHighlights() {
    try {
      const res = await fetch('/api/profile/treks?status=completed&sort=recent', { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.treks && data.treks.length > 0) {
        const top3 = data.treks.slice(0, 3);
        DOM.highlightsTrekGrid.innerHTML = top3.map(t => renderTrekCardHtml(t, true)).join('');
      } else {
        DOM.highlightsTrekGrid.innerHTML = `
          <div class="empty-state-card" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🥾</div>
            <div class="empty-state-title">Your first trail is waiting.</div>
            <div class="empty-state-text">Explore India's summits and log your completed treks.</div>
            <a href="index.html#treks" class="btn-primary-sm">Explore Treks</a>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading highlights:', err);
    }
  }

  // 8. Load Overview Activity
  async function loadOverviewActivity() {
    try {
      const res = await fetch('/api/profile/activity?limit=5', { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.activities && data.activities.length > 0) {
        DOM.overviewTimeline.innerHTML = data.activities.map(a => renderTimelineItemHtml(a)).join('');
      } else {
        DOM.overviewTimeline.innerHTML = `
          <div style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 20px;">
            No recent activity recorded yet.
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading activity:', err);
    }
  }

  // 9. Load Dedicated My Treks
  async function loadMyTreks() {
    try {
      DOM.myTreksGrid.innerHTML = renderSkeletonCardsHtml(3);

      const url = `/api/profile/treks?status=completed&difficulty=${encodeURIComponent(myTreksDifficulty)}&sort=${encodeURIComponent(myTreksSort)}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.treks && data.treks.length > 0) {
        DOM.myTreksGrid.innerHTML = data.treks.map(t => renderTrekCardHtml(t, true)).join('');
      } else {
        DOM.myTreksGrid.innerHTML = `
          <div class="empty-state-card" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🏔️</div>
            <div class="empty-state-title">No completed treks found</div>
            <div class="empty-state-text">You haven't logged any ${myTreksDifficulty !== 'All' ? myTreksDifficulty : ''} treks yet.</div>
            <a href="index.html#treks" class="btn-primary-sm">Explore Treks</a>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading my treks:', err);
    }
  }

  // 10. Load Saved Treks
  async function loadSavedTreks() {
    try {
      DOM.savedTreksGrid.innerHTML = renderSkeletonCardsHtml(3);

      const res = await fetch('/api/profile/treks?status=saved', { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.treks && data.treks.length > 0) {
        DOM.savedTreksGrid.innerHTML = data.treks.map(t => renderTrekCardHtml(t, false, 'saved')).join('');
      } else {
        DOM.savedTreksGrid.innerHTML = `
          <div class="empty-state-card" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🔖</div>
            <div class="empty-state-title">No saved trails yet.</div>
            <div class="empty-state-text">Bookmark trails you want to explore later.</div>
            <a href="index.html#treks" class="btn-primary-sm">Explore Treks</a>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading saved treks:', err);
    }
  }

  // 11. Load Wishlist
  async function loadWishlist() {
    try {
      DOM.wishlistGrid.innerHTML = renderSkeletonCardsHtml(3);

      const res = await fetch('/api/profile/treks?status=wishlist', { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.treks && data.treks.length > 0) {
        DOM.wishlistGrid.innerHTML = data.treks.map(t => renderTrekCardHtml(t, false, 'wishlist')).join('');
      } else {
        DOM.wishlistGrid.innerHTML = `
          <div class="empty-state-card" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">✨</div>
            <div class="empty-state-title">Your next adventure is waiting.</div>
            <div class="empty-state-text">Start building your trekking wishlist today.</div>
            <a href="index.html#treks" class="btn-primary-sm">Explore Treks</a>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading wishlist:', err);
    }
  }

  // 12. Load Badges Grid
  async function loadBadges() {
    try {
      const res = await fetch('/api/profile/badges', { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.badges) {
        DOM.badgesGrid.innerHTML = data.badges.map(b => renderBadgeCardHtml(b)).join('');
      }
    } catch (err) {
      console.error('Error loading badges:', err);
    }
  }

  // 13. Load Reviews
  async function loadReviews() {
    try {
      const res = await fetch('/api/profile/reviews', { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.reviews && data.reviews.length > 0) {
        DOM.reviewsGrid.innerHTML = data.reviews.map(r => renderReviewCardHtml(r)).join('');
      } else {
        DOM.reviewsGrid.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-title">Your trail stories will appear here.</div>
            <div class="empty-state-text">Share your thoughts on trails you've conquered.</div>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading reviews:', err);
    }
  }

  // 14. Load Full Activity Timeline
  async function loadFullActivity() {
    try {
      const res = await fetch('/api/profile/activity?limit=30', { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.activities && data.activities.length > 0) {
        DOM.fullActivityTimeline.innerHTML = data.activities.map(a => renderTimelineItemHtml(a)).join('');
      } else {
        DOM.fullActivityTimeline.innerHTML = `
          <div style="font-size: 0.9rem; color: var(--text-secondary); text-align: center; padding: 30px;">
            No activity recorded yet.
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading full activity:', err);
    }
  }

  // 15. HTML Component Generators
  function renderTrekCardHtml(t, isCompleted = false, actionType = 'completed') {
    const imgUrl = t.image_url || 'hero_himalayas_1784286730612.png';
    const elev = t.elevation_m ? `${t.elevation_m.toLocaleString()} m` : '—';
    const dist = t.distance_km ? `${t.distance_km} km` : '—';

    let actionBtnHtml = '';
    if (actionType === 'saved' || actionType === 'wishlist') {
      actionBtnHtml = `
        <button onclick="removeTrekStatus(${t.trek_id})" style="margin-top: 8px; font-size: 0.75rem; color: #dc3545; font-weight: 600; text-align: right;">
          Remove from ${actionType}
        </button>
      `;
    }

    return `
      <div class="trek-card">
        <div class="trek-card-media">
          <img src="${escapeHtml(imgUrl)}" class="trek-card-img" alt="${escapeHtml(t.name)}" onerror="this.src='hero_himalayas_1784286730612.png'" />
          ${isCompleted ? `
            <div class="trek-badge-overlay">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Completed
            </div>
          ` : ''}
        </div>
        <div class="trek-card-content">
          <a href="trek-detail.html?slug=${t.slug || t.trek_id}" class="trek-title">${escapeHtml(t.name)}</a>
          <div class="trek-location">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${escapeHtml([t.district, t.state].filter(Boolean).join(', '))}
          </div>
          <div class="trek-stats-footer">
            <div class="trek-stat-col">
              <span class="trek-stat-lbl">Elevation</span>
              <span class="trek-stat-val">${elev}</span>
            </div>
            <div class="trek-stat-col">
              <span class="trek-stat-lbl">Distance</span>
              <span class="trek-stat-val">${dist}</span>
            </div>
            <div class="trek-stat-col">
              <span class="trek-stat-lbl">Difficulty</span>
              <span class="trek-stat-val">${escapeHtml(t.difficulty || 'Moderate')}</span>
            </div>
          </div>
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }

  function renderBadgeCardHtml(b) {
    const lockedClass = b.unlocked ? '' : 'locked';
    const formattedDate = b.earned_at ? new Date(b.earned_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    const statusText = b.unlocked ? `Unlocked · ${formattedDate}` : `${b.current_value} / ${b.requirement_value}`;

    return `
      <div class="badge-card ${lockedClass}">
        <span class="badge-rarity-tag rarity-${b.rarity}">${b.rarity}</span>
        <div class="badge-icon-wrap">
          ${getBadgeSvgIcon(b.icon)}
        </div>
        <div class="badge-title">${escapeHtml(b.name)}</div>
        <div class="badge-desc">${escapeHtml(b.description)}</div>
        <div class="badge-status">${statusText}</div>
        ${!b.unlocked ? `
          <div class="badge-progress-bar">
            <div class="badge-progress-fill" style="width: ${b.progress_pct}%"></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderTimelineItemHtml(a) {
    const timeAgo = formatTimeAgo(a.created_at);
    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">${escapeHtml(a.title)}</div>
          <div class="timeline-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }

  function renderReviewCardHtml(r) {
    const stars = '★'.repeat(Math.round(r.rating)) + '☆'.repeat(5 - Math.round(r.rating));
    const formattedDate = new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const imgUrl = r.image_url || 'hero_himalayas_1784286730612.png';

    return `
      <div class="review-card">
        <div class="review-trek-media">
          <img src="${escapeHtml(imgUrl)}" class="review-trek-img" alt="${escapeHtml(r.trek_name)}" onerror="this.src='hero_himalayas_1784286730612.png'" />
        </div>
        <div class="review-body">
          <div class="review-header">
            <div class="review-trek-name">${escapeHtml(r.trek_name)}</div>
            <div class="review-stars">${stars}</div>
          </div>
          <div class="review-text">"${escapeHtml(r.review_text)}"</div>
          <div class="review-date">${formattedDate}</div>
        </div>
      </div>
    `;
  }

  function renderSkeletonCardsHtml(count = 3) {
    return Array(count).fill(0).map(() => `
      <div class="trek-card skeleton" style="height: 260px;"></div>
    `).join('');
  }

  function showSkeletons() {
    DOM.highlightsTrekGrid.innerHTML = renderSkeletonCardsHtml(3);
    DOM.myTreksGrid.innerHTML = renderSkeletonCardsHtml(3);
    DOM.savedTreksGrid.innerHTML = renderSkeletonCardsHtml(3);
    DOM.wishlistGrid.innerHTML = renderSkeletonCardsHtml(3);
  }

  // 16. Event Listeners & Modals
  function setupEventListeners() {
    // Navigation link clicks
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = el.getAttribute('data-view');
        switchView(targetView);
      });
    });

    // Edit Profile Modal Trigger
    DOM.btnEditProfile.addEventListener('click', () => {
      if (!currentUserProfile) return;
      const u = currentUserProfile.user;
      DOM.editAvatarUrl.value = u.profile_image || '';
      DOM.editFullName.value = u.full_name || '';
      DOM.editUsername.value = u.username || '';
      DOM.editLocation.value = u.location || '';
      DOM.editWebsite.value = u.website || '';
      DOM.editBio.value = u.bio || '';
      DOM.bioCharCount.textContent = (u.bio || '').length;

      DOM.editProfileModal.classList.add('active');
    });

    DOM.btnCloseEditModal.addEventListener('click', () => DOM.editProfileModal.classList.remove('active'));
    DOM.btnCancelEditModal.addEventListener('click', () => DOM.editProfileModal.classList.remove('active'));

    // Character counter for bio
    DOM.editBio.addEventListener('input', () => {
      DOM.bioCharCount.textContent = DOM.editBio.value.length;
    });

    // Form Edit Profile Submit
    DOM.formEditProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          profile_image: DOM.editAvatarUrl.value.trim() || null,
          full_name: DOM.editFullName.value.trim(),
          username: DOM.editUsername.value.trim(),
          location: DOM.editLocation.value.trim(),
          website: DOM.editWebsite.value.trim(),
          bio: DOM.editBio.value.trim()
        };

        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          showToast('Profile updated successfully.');
          DOM.editProfileModal.classList.remove('active');
          await loadProfileData();
        } else {
          showToast(data.message || 'Failed to update profile.');
        }
      } catch (err) {
        console.error(err);
        showToast('Error saving profile changes.');
      }
    });

    // Share Profile Modal Trigger
    DOM.btnShareProfile.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}/profile`;
      DOM.shareProfileUrlInput.value = shareUrl;
      DOM.shareProfileModal.classList.add('active');
    });

    DOM.btnCloseShareModal.addEventListener('click', () => DOM.shareProfileModal.classList.remove('active'));
    
    DOM.btnCopyShareUrl.addEventListener('click', () => {
      DOM.shareProfileUrlInput.select();
      navigator.clipboard.writeText(DOM.shareProfileUrlInput.value);
      showToast('Profile link copied to clipboard.');
      DOM.shareProfileModal.classList.remove('active');
    });

    // Delete Account Modal
    DOM.btnOpenDeleteModal.addEventListener('click', () => DOM.deleteAccountModal.classList.add('active'));
    DOM.btnCloseDeleteModal.addEventListener('click', () => DOM.deleteAccountModal.classList.remove('active'));
    DOM.btnCancelDeleteModal.addEventListener('click', () => DOM.deleteAccountModal.classList.remove('active'));

    DOM.formConfirmDelete.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const password = DOM.deleteConfirmPassword.value;
        const res = await fetch('/api/profile/account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ password })
        });

        const data = await res.json();
        if (data.success) {
          alert('Your account has been deleted.');
          window.location.href = 'index.html';
        } else {
          showToast(data.message || 'Incorrect password.');
        }
      } catch (err) {
        console.error(err);
        showToast('Error deleting account.');
      }
    });

    // Filters & Sorting in My Treks
    DOM.treksFilterPills.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-pill')) {
        document.querySelectorAll('#treksFilterPills .filter-pill').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        myTreksDifficulty = e.target.getAttribute('data-difficulty');
        loadMyTreks();
      }
    });

    DOM.treksSortSelect.addEventListener('change', (e) => {
      myTreksSort = e.target.value;
      loadMyTreks();
    });

    // Window Hash Change
    window.addEventListener('hashchange', handleHashNavigation);
  }

  // 17. Handle Hash Navigation
  function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '') || 'overview';
    switchView(hash);
  }

  // 18. Switch Active View
  function switchView(viewName) {
    currentView = viewName;
    window.location.hash = viewName;

    DOM.sidebarLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-view') === viewName);
    });

    DOM.mobileNavLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-view') === viewName);
    });

    DOM.viewSections.forEach(section => {
      section.classList.toggle('active', section.id === `view-${viewName}`);
    });

    if (currentUserProfile) {
      loadViewData(viewName);
    }
  }

  // 19. Populate Settings Form
  function populateSettingsForm(user) {
    DOM.settingEmail.value = user.email || '';
    DOM.settingUsername.value = user.username || '';
  }

  // Global helper to remove saved/wishlist trek
  window.removeTrekStatus = async function (trekId) {
    try {
      const res = await fetch(`/api/profile/treks/${trekId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'none' })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Trek removed.');
        await loadProfileData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper Toast Generator
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#285D2A" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <span>${escapeHtml(message)}</span>
    `;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // SVG Helper
  function getBadgeSvgIcon(iconName) {
    switch (iconName) {
      case 'footprints':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16v1a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1"></path><path d="M14 16v1a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1"></path><circle cx="6" cy="10" r="2"></circle><circle cx="16" cy="10" r="2"></circle></svg>`;
      case 'compass':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`;
      case 'snowflake':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line><path d="M20 16l-4-4 4-4"></path><path d="M4 8l4 4-4 4"></path><path d="M16 4l-4 4-4-4"></path><path d="M8 20l4-4 4 4"></path></svg>`;
      case 'mountain':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3l4 8 5-5 4 15H3L8 3z"></path></svg>`;
      case 'flag':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
      case 'gem':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 12L2 9z"></path><path d="M11 3v18"></path></svg>`;
      case 'map-pin':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
      case 'zap':
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
      case 'shield':
      default:
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // DOM Loaded Event Listener
  document.addEventListener('DOMContentLoaded', init);
})();
