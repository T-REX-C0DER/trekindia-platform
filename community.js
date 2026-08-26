/**
 * TrekIndia — Community Platform Application Engine
 * Complete interactive logic for authenticated feed, stories, multi-step post creation,
 * comments drawer, likes, saves, shares, trekker discovery, dual-pane messaging,
 * and theme synchronization.
 */

(function () {
  'use strict';

  // ─── STATE STORE ────────────────────────────────────────────────────────────
  const state = {
    currentUser: null,
    currentTab: 'feed',
    currentTag: null,
    currentTrekId: null,
    posts: [],
    stories: [],
    activeStoryIndex: 0,
    activeSlideIndex: 0,
    storyTimer: null,
    storyProgressInterval: null,
    conversations: [],
    activeConversationId: null,
    selectedPostForComments: null,
    replyingToCommentId: null,
    createPostData: {
      type: 'experience',
      images: [],
      caption: '',
      trek_name: '',
      trek_id: null,
      location: '',
      difficulty: 'Moderate',
      elevation_m: null,
      duration_days: null,
      distance_km: null,
      hashtags: ''
    },
    createPostStep: 1,
    availableTreks: [
      { id: 1, name: 'Kedarkantha Trek', slug: 'kedarkantha', altitude: '3,810m', difficulty: 'Easy–Moderate', duration: '6 Days', state: 'Uttarakhand', image: 'https://images.unsplash.com/photo-1626015365107-338c45028f39?w=600&q=80' },
      { id: 2, name: 'Hampta Pass', slug: 'hampta-pass', altitude: '4,287m', difficulty: 'Advanced', duration: '5 Days', state: 'Himachal Pradesh', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80' },
      { id: 3, name: 'Valley of Flowers', slug: 'valley-of-flowers', altitude: '3,858m', difficulty: 'Easy', duration: '6 Days', state: 'Uttarakhand', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=600&q=80' },
      { id: 4, name: 'Roopkund Mystery Lake', slug: 'roopkund', altitude: '5,029m', difficulty: 'Hard', duration: '8 Days', state: 'Uttarakhand', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80' },
      { id: 5, name: 'Rajmachi Fort Trek', slug: 'rajmachi-fort', altitude: '820m', difficulty: 'Moderate', duration: '2 Days', state: 'Maharashtra', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80' },
      { id: 6, name: 'Harishchandragad', slug: 'harishchandragad', altitude: '1,422m', difficulty: 'Moderate–Hard', duration: '2 Days', state: 'Maharashtra', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&q=80' },
      { id: 8, name: 'Sandakphu Phalut Peak', slug: 'sandakphu-phalut', altitude: '3,636m', difficulty: 'Hard', duration: '6 Days', state: 'West Bengal', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&q=80' },
      { id: 9, name: 'Pin Parvati Pass', slug: 'pin-parvati', altitude: '5,319m', difficulty: 'Extreme Expedition', duration: '11 Days', state: 'Himachal Pradesh', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80' }
    ]
  };

  // ─── 1. INITIALIZATION & AUTH GUARD ─────────────────────────────────────────
  async function init() {
    initTheme();
    initBrandLogos();
    initMobileMenu();

    // Check Auth Status
    const user = await checkAuthentication();
    if (!user) {
      // User is NOT logged in: Show the private community gateway and block data load
      showAuthGateway();
      return;
    }

    state.currentUser = user;
    updateUserSidebarUI(user);

    // Bind event listeners
    bindEventListeners();

    // Initialize Kafka KRaft real-time WebSocket connection
    initWebSocket();

    // Load initial data
    loadStories();
    loadPosts();
    loadConversations();
    loadNotificationsCount();
    loadUnreadCount();
  }

  async function checkAuthentication() {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          return data.user;
        }
      }
    } catch (err) {
      console.warn('Auth check error:', err);
    }
    return null;
  }

  function showAuthGateway() {
    const gateway = document.getElementById('authGateOverlay');
    if (gateway) {
      gateway.style.display = 'flex';
    }
    const container = document.getElementById('communityAppContainer');
    if (container) {
      container.style.opacity = '0.15';
      container.style.pointerEvents = 'none';
    }
  }

  function updateUserSidebarUI(user) {
    const avatarEl = document.getElementById('sidebarUserAvatar');
    const nameEl = document.getElementById('sidebarUserFullName');
    const handleEl = document.getElementById('sidebarUserHandle');
    const storyAvatarEl = document.getElementById('yourStoryAvatar');

    const initial = (user.full_name || user.username || 'U').charAt(0).toUpperCase();

    if (avatarEl) {
      if (user.profile_image) {
        avatarEl.innerHTML = `<img src="${escapeHtml(user.profile_image)}" alt="${escapeHtml(user.full_name)}" />`;
      } else {
        avatarEl.innerHTML = `<span>${initial}</span>`;
      }
    }

    if (storyAvatarEl) {
      if (user.profile_image) {
        storyAvatarEl.innerHTML = `<img src="${escapeHtml(user.profile_image)}" alt="Your Story" />`;
      } else {
        storyAvatarEl.innerHTML = `<span>${initial}</span>`;
      }
    }

    if (nameEl) nameEl.textContent = user.full_name || user.username;
    if (handleEl) handleEl.textContent = `@${user.username}`;
  }

  // ─── 2. THEME & BRAND INITIALIZATION ────────────────────────────────────────
  function initTheme() {
    const savedTheme = localStorage.getItem('trekindia-theme') || 'dark';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('trekindia-theme', isDark ? 'dark' : 'light');
        syncBrandLogos();
      });
    }
  }

  function initBrandLogos() {
    syncBrandLogos();
  }

  function syncBrandLogos() {
    const isDark = document.body.classList.contains('dark');
    const lightIcons = document.querySelectorAll('.brand-icon-img.light-icon');
    const darkIcons = document.querySelectorAll('.brand-icon-img.dark-icon');

    if (isDark) {
      lightIcons.forEach(el => el.style.display = 'none');
      darkIcons.forEach(el => el.style.display = 'block');
    } else {
      lightIcons.forEach(el => el.style.display = 'block');
      darkIcons.forEach(el => el.style.display = 'none');
    }
  }

  function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        const isOpen = mobileMenu.classList.toggle('open');
        mobileMenuBtn.setAttribute('aria-expanded', isOpen);
      });
    }
  }

  // ─── 3. STORIES LOGIC ───────────────────────────────────────────────────────
  async function loadStories() {
    try {
      const res = await fetch('/api/community/stories');
      const data = await res.json();
      if (data.success && data.stories) {
        state.stories = data.stories;
        renderStories(data.stories);
      }
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  }

  function renderStories(stories) {
    const container = document.getElementById('storiesList');
    if (!container) return;

    if (!stories || stories.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = stories.map((story, idx) => `
      <div class="story-bubble ${story.has_unseen ? 'unseen' : 'seen'}" data-story-idx="${idx}">
        <div class="story-avatar-wrap">
          <div class="story-avatar-inner">
            <img src="${escapeHtml(story.user.avatar)}" alt="${escapeHtml(story.user.full_name)}" />
          </div>
        </div>
        <span class="story-username">${escapeHtml(story.user.full_name.split(' ')[0])}</span>
      </div>
    `).join('');

    // Attach click handlers
    container.querySelectorAll('.story-bubble').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-story-idx'), 10);
        openStoryViewer(idx);
      });
    });
  }

  function openStoryViewer(storyIndex, slideIndex = 0) {
    state.activeStoryIndex = storyIndex;
    state.activeSlideIndex = slideIndex;

    const story = state.stories[storyIndex];
    if (!story) return;

    const overlay = document.getElementById('storyViewerOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    renderActiveStorySlide();
  }

  function renderActiveStorySlide() {
    const story = state.stories[state.activeStoryIndex];
    if (!story || !story.slides) return;

    const slide = story.slides[state.activeSlideIndex];
    if (!slide) return;

    // Elements
    const avatarEl = document.getElementById('storyViewerAvatar');
    const nameEl = document.getElementById('storyViewerName');
    const timeEl = document.getElementById('storyViewerTime');
    const imgEl = document.getElementById('storyViewerImage');
    const captionEl = document.getElementById('storyViewerCaption');
    const trekTagEl = document.getElementById('storyViewerTrekTag');
    const segmentsContainer = document.getElementById('storyProgressSegments');

    if (avatarEl) avatarEl.src = story.user.avatar;
    if (nameEl) nameEl.textContent = story.user.full_name;
    if (timeEl) timeEl.textContent = slide.created_at || 'Just now';
    if (imgEl) imgEl.src = slide.media_url;
    if (captionEl) captionEl.textContent = slide.caption || '';

    if (trekTagEl) {
      if (slide.trek_name) {
        trekTagEl.style.display = 'inline-flex';
        trekTagEl.innerHTML = `<span>🏔️ ${escapeHtml(slide.trek_name)}</span>`;
      } else {
        trekTagEl.style.display = 'none';
      }
    }

    // Progress segments
    if (segmentsContainer) {
      segmentsContainer.innerHTML = story.slides.map((_, sIdx) => `
        <div class="story-prog-bar ${sIdx < state.activeSlideIndex ? 'completed' : ''}" data-sidx="${sIdx}">
          <div class="story-prog-fill" id="storyProgFill-${sIdx}"></div>
        </div>
      `).join('');
    }

    startStorySlideTimer();
  }

  function startStorySlideTimer() {
    clearInterval(state.storyProgressInterval);
    clearTimeout(state.storyTimer);

    const fillEl = document.getElementById(`storyProgFill-${state.activeSlideIndex}`);
    let progress = 0;
    const duration = 5000; // 5s
    const step = 50;

    state.storyProgressInterval = setInterval(() => {
      progress += (step / duration) * 100;
      if (fillEl) fillEl.style.width = `${Math.min(progress, 100)}%`;
      if (progress >= 100) {
        clearInterval(state.storyProgressInterval);
        nextStorySlide();
      }
    }, step);
  }

  function nextStorySlide() {
    const story = state.stories[state.activeStoryIndex];
    if (state.activeSlideIndex < story.slides.length - 1) {
      state.activeSlideIndex++;
      renderActiveStorySlide();
    } else if (state.activeStoryIndex < state.stories.length - 1) {
      state.activeStoryIndex++;
      state.activeSlideIndex = 0;
      renderActiveStorySlide();
    } else {
      closeStoryViewer();
    }
  }

  function prevStorySlide() {
    if (state.activeSlideIndex > 0) {
      state.activeSlideIndex--;
      renderActiveStorySlide();
    } else if (state.activeStoryIndex > 0) {
      state.activeStoryIndex--;
      const prevStory = state.stories[state.activeStoryIndex];
      state.activeSlideIndex = prevStory.slides.length - 1;
      renderActiveStorySlide();
    }
  }

  function closeStoryViewer() {
    clearInterval(state.storyProgressInterval);
    clearTimeout(state.storyTimer);
    const overlay = document.getElementById('storyViewerOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ─── 4. POSTS & FEED LOGIC ──────────────────────────────────────────────────
  async function loadPosts() {
    showFeedSkeleton(true);
    try {
      let url = `/api/community/posts?tab=${state.currentTab}`;
      if (state.currentTag) url += `&tag=${encodeURIComponent(state.currentTag)}`;
      if (state.currentTrekId) url += `&trek_id=${state.currentTrekId}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success && data.posts) {
        state.posts = data.posts;
        renderPosts(data.posts);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      showFeedSkeleton(false);
    }
  }

  function showFeedSkeleton(show) {
    const sk = document.getElementById('feedSkeleton');
    if (sk) sk.style.display = show ? 'block' : 'none';
  }

  function renderPosts(posts) {
    const stream = document.getElementById('postsStream');
    const emptyState = document.getElementById('feedEmptyState');
    if (!stream) return;

    if (!posts || posts.length === 0) {
      stream.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    stream.innerHTML = posts.map(post => {
      // Build media markup
      let mediaMarkup = '';
      if (post.images && post.images.length === 1) {
        mediaMarkup = `
          <div class="post-media-frame" data-post-id="${post.post_id}">
            <img src="${escapeHtml(post.images[0])}" alt="Trek media" class="post-media-img" loading="lazy" />
            ${renderOverlayBadges(post)}
            <div class="double-tap-heart">❤️</div>
          </div>
        `;
      } else if (post.images && post.images.length > 1) {
        mediaMarkup = `
          <div class="post-media-grid" data-post-id="${post.post_id}">
            <div class="post-media-grid-item"><img src="${escapeHtml(post.images[0])}" alt="Photo 1" loading="lazy" /></div>
            <div class="post-media-grid-item"><img src="${escapeHtml(post.images[1])}" alt="Photo 2" loading="lazy" /></div>
            ${renderOverlayBadges(post)}
            <div class="double-tap-heart">❤️</div>
          </div>
        `;
      }

      // Hashtag list
      const hashtagMarkup = (post.hashtags || []).map(h => `
        <span class="post-hashtag-pill" data-tag="${escapeHtml(h)}">#${escapeHtml(h)}</span>
      `).join('');

      return `
        <article class="comm-post-card" id="post-${post.post_id}" data-post-id="${post.post_id}">
          <!-- Header -->
          <div class="post-header">
            <div class="post-author-wrap" data-user-id="${post.user.user_id}">
              <div class="post-author-avatar">
                <img src="${escapeHtml(post.user.avatar)}" alt="${escapeHtml(post.user.full_name)}" />
              </div>
              <div class="post-author-meta">
                <div class="post-author-name-row">
                  <span class="post-author-name">${escapeHtml(post.user.full_name)}</span>
                  ${post.user.is_verified ? '<span class="badge-verified-mini">✓</span>' : ''}
                </div>
                <div class="post-location-time">
                  <span>📍 ${escapeHtml(post.location || 'India')}</span> • <span>${escapeHtml(post.formatted_time || 'Recent')}</span>
                </div>
              </div>
            </div>
            <button class="post-menu-btn" data-post-id="${post.post_id}" title="Post Options">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </button>
          </div>

          <!-- Media -->
          ${mediaMarkup}

          <!-- Actions Bar -->
          <div class="post-actions-bar">
            <div class="post-action-group-left">
              <button class="post-action-btn btn-like-post ${post.is_liked ? 'liked' : ''}" data-post-id="${post.post_id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${post.is_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="like-count">${post.likes_count}</span>
              </button>

              <button class="post-action-btn btn-comment-post" data-post-id="${post.post_id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>${post.comments_count}</span>
              </button>

              <button class="post-action-btn btn-share-post" data-post-id="${post.post_id}" title="Share Post">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
            </div>

            <button class="post-action-btn btn-save-post ${post.is_saved ? 'saved' : ''}" data-post-id="${post.post_id}" title="Save to Bookmarks">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="${post.is_saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>

          <!-- Caption & Comments Preview -->
          <div class="post-caption-wrap">
            <p class="post-caption-text">
              <strong class="post-caption-author" data-user-id="${post.user.user_id}">${escapeHtml(post.user.full_name)}</strong>
              ${escapeHtml(post.caption)}
            </p>

            ${hashtagMarkup ? `<div class="post-hashtags">${hashtagMarkup}</div>` : ''}

            ${post.comments_count > 0 ? `
              <span class="post-comments-preview-link btn-comment-post" data-post-id="${post.post_id}">
                View all ${post.comments_count} comments
              </span>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

    attachPostCardListeners();
  }

  function renderOverlayBadges(post) {
    if (post.post_type === 'achievement' && post.achievement_badge) {
      return `
        <div class="post-stats-overlay">
          <div class="overlay-pill">🏆 ${escapeHtml(post.achievement_badge.title)}</div>
          <div class="overlay-pill">⛰️ ${escapeHtml(post.achievement_badge.elevation)}</div>
        </div>
      `;
    }

    if (post.post_type === 'route' && post.route_preview) {
      return `
        <div class="post-stats-overlay">
          <button class="overlay-pill pill-route-btn" onclick="event.stopPropagation(); window.TrekIndiaCommunity.viewRoute('${post.trek_slug}')">
            🗺️ View Route
          </button>
        </div>
      `;
    }

    if (post.route_badge) {
      return `
        <div class="post-stats-overlay">
          ${post.route_badge.difficulty ? `<div class="overlay-pill">🌲 ${escapeHtml(post.route_badge.difficulty)}</div>` : ''}
          ${post.route_badge.elevation ? `<div class="overlay-pill">⛰️ ${escapeHtml(post.route_badge.elevation)}</div>` : ''}
          ${post.route_badge.duration ? `<div class="overlay-pill">⏱️ ${escapeHtml(post.route_badge.duration)}</div>` : ''}
        </div>
      `;
    }

    return '';
  }

  function attachPostCardListeners() {
    // Like button
    document.querySelectorAll('.btn-like-post').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        toggleLike(postId, btn);
      });
    });

    // Double tap on media
    document.querySelectorAll('.post-media-frame, .post-media-grid').forEach(frame => {
      let lastTap = 0;
      frame.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTap < 300) {
          const postId = frame.getAttribute('data-post-id');
          const likeBtn = document.querySelector(`.btn-like-post[data-post-id="${postId}"]`);
          const heart = frame.querySelector('.double-tap-heart');
          if (heart) {
            heart.classList.add('animate');
            setTimeout(() => heart.classList.remove('animate'), 600);
          }
          if (likeBtn && !likeBtn.classList.contains('liked')) {
            toggleLike(postId, likeBtn);
          }
        }
        lastTap = now;
      });
    });

    // Save button
    document.querySelectorAll('.btn-save-post').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        toggleSave(postId, btn);
      });
    });

    // Comment button
    document.querySelectorAll('.btn-comment-post').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        openCommentsDrawer(postId);
      });
    });

    // Share button
    document.querySelectorAll('.btn-share-post').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        openShareModal(postId);
      });
    });

    // Author click (opens profile)
    document.querySelectorAll('.post-author-wrap, .post-caption-author').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = el.getAttribute('data-user-id');
        openTrekkerProfile(userId);
      });
    });

    // Hashtag clicks
    document.querySelectorAll('.post-hashtag-pill').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = el.getAttribute('data-tag');
        filterByTag(tag);
      });
    });

    // Post menu
    document.querySelectorAll('.post-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        showPostOptionsMenu(postId, btn);
      });
    });
  }

  async function toggleLike(postId, btn) {
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        if (data.liked) {
          btn.classList.add('liked');
        } else {
          btn.classList.remove('liked');
        }
        const countEl = btn.querySelector('.like-count');
        if (countEl) countEl.textContent = data.likes_count;

        // Update in state
        const post = state.posts.find(p => p.post_id === parseInt(postId, 10));
        if (post) {
          post.is_liked = data.liked;
          post.likes_count = data.likes_count;
        }
      }
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  }

  async function toggleSave(postId, btn) {
    try {
      const res = await fetch(`/api/community/posts/${postId}/save`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        if (data.saved) {
          btn.classList.add('saved');
          showToast('Adventures saved to your bookmarked collection! 🔖');
        } else {
          btn.classList.remove('saved');
          showToast('Removed from saved adventures.');
        }

        const post = state.posts.find(p => p.post_id === parseInt(postId, 10));
        if (post) post.is_saved = data.saved;
      }
    } catch (err) {
      console.error('Save toggle failed:', err);
    }
  }

  // ─── 5. COMMENTS DRAWER ─────────────────────────────────────────────────────
  async function openCommentsDrawer(postId) {
    state.selectedPostForComments = postId;
    state.replyingToCommentId = null;

    const overlay = document.getElementById('commentsDrawerOverlay');
    if (overlay) overlay.style.display = 'flex';

    loadComments(postId);
  }

  async function loadComments(postId) {
    const listBody = document.getElementById('commentsListBody');
    const countEl = document.getElementById('commentsHeaderCount');
    if (!listBody) return;

    listBody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--comm-text-muted);">Loading comments...</div>';

    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`);
      const data = await res.json();
      if (data.success && data.comments) {
        if (countEl) countEl.textContent = data.comments.length;
        renderComments(data.comments, postId);
      }
    } catch (err) {
      listBody.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Failed to load comments.</div>';
    }
  }

  function renderComments(comments, postId) {
    const listBody = document.getElementById('commentsListBody');
    if (!listBody) return;

    if (!comments || comments.length === 0) {
      listBody.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--comm-text-muted);">
          💬 No comments yet. Start the conversation with your trail tip!
        </div>
      `;
      return;
    }

    listBody.innerHTML = comments.map(c => `
      <div class="comment-item" id="comment-${c.comment_id}">
        <img src="${escapeHtml(c.user.avatar)}" alt="${escapeHtml(c.user.full_name)}" class="comment-avatar" />
        <div class="comment-content-wrap">
          <div class="comment-author">${escapeHtml(c.user.full_name)}</div>
          <div class="comment-text">${formatCommentText(c.content)}</div>
          <div class="comment-meta-row">
            <span>${escapeHtml(c.created_at)}</span>
            <button class="btn-comment-reply" data-comment-id="${c.comment_id}" data-author="${escapeHtml(c.user.username)}">Reply</button>
            <button class="btn-comment-like ${c.is_liked ? 'liked' : ''}" data-comment-id="${c.comment_id}">
              ❤️ <span>${c.likes_count || 0}</span>
            </button>
          </div>

          <!-- Nested Replies -->
          ${c.replies && c.replies.length > 0 ? `
            <div class="nested-replies-list" style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px; border-left: 2px solid var(--comm-border); padding-left: 10px;">
              ${c.replies.map(r => `
                <div class="comment-item reply-item" id="comment-${r.comment_id}">
                  <img src="${escapeHtml(r.user.avatar)}" alt="${escapeHtml(r.user.full_name)}" class="comment-avatar" style="width: 28px; height: 28px;" />
                  <div class="comment-content-wrap" style="padding: 6px 10px;">
                    <div class="comment-author" style="font-size: 0.82rem;">${escapeHtml(r.user.full_name)}</div>
                    <div class="comment-text" style="font-size: 0.8rem;">${formatCommentText(r.content)}</div>
                    <div class="comment-meta-row" style="font-size: 0.7rem;">
                      <span>${escapeHtml(r.created_at)}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    // Attach reply handlers
    listBody.querySelectorAll('.btn-comment-reply').forEach(btn => {
      btn.addEventListener('click', () => {
        const commentId = btn.getAttribute('data-comment-id');
        const author = btn.getAttribute('data-author');
        state.replyingToCommentId = commentId;
        const banner = document.getElementById('replyingToBanner');
        const bannerUser = document.getElementById('replyingToUsername');
        const input = document.getElementById('commentTextInput');
        if (banner && bannerUser) {
          bannerUser.textContent = `@${author}`;
          banner.style.display = 'flex';
        }
        if (input) {
          input.value = `@${author} `;
          input.focus();
        }
      });
    });

    // Attach like comment handlers
    listBody.querySelectorAll('.btn-comment-like').forEach(btn => {
      btn.addEventListener('click', async () => {
        const commentId = btn.getAttribute('data-comment-id');
        try {
          const res = await fetch(`/api/community/posts/${postId}/comments/${commentId}/like`, {
            method: 'POST',
            credentials: 'include'
          });
          const data = await res.json();
          if (data.success) {
            btn.classList.toggle('liked', data.liked);
            const countSpan = btn.querySelector('span');
            if (countSpan) countSpan.textContent = data.likes_count;
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  function formatCommentText(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/@(\w+)/g, '<strong style="color: var(--comm-forest);">@$1</strong>');
  }

  async function submitComment() {
    const input = document.getElementById('commentTextInput');
    if (!input || !input.value.trim() || !state.selectedPostForComments) return;

    const content = input.value.trim();
    input.value = '';

    try {
      const res = await fetch(`/api/community/posts/${state.selectedPostForComments}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content,
          parent_id: state.replyingToCommentId
        })
      });

      const data = await res.json();
      if (data.success) {
        state.replyingToCommentId = null;
        const banner = document.getElementById('replyingToBanner');
        if (banner) banner.style.display = 'none';

        loadComments(state.selectedPostForComments);
        showToast('Comment posted! ✨');
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  }

  // ─── 6. REALTIME WEBSOCKET & KAFKA STREAMING MESSAGING SYSTEM ─────────────
  let wsClient = null;
  let wsReconnectTimer = null;
  let wsReconnectDelay = 1000;
  let wsPingTimer = null;
  let typingTimeout = null;
  let lastTypingSentAt = 0;

  function initWebSocket() {
    if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/messages`;

    console.log(`[WebSocket Client] Connecting to ${wsUrl}...`);
    updateWsStatusUI('connecting');

    try {
      wsClient = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('[WebSocket Client] Failed to create socket:', err);
      scheduleWsReconnect();
      return;
    }

    wsClient.onopen = () => {
      console.log('✅ [WebSocket Client] Connected to TrekIndia streaming gateway.');
      updateWsStatusUI('connected');
      wsReconnectDelay = 1000; // reset backoff

      // Start ping interval
      if (wsPingTimer) clearInterval(wsPingTimer);
      wsPingTimer = setInterval(() => {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);

      // Refresh conversations to catch any missed messages while offline
      loadConversations(false);
      loadUnreadCount();
    };

    wsClient.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingWsEvent(data);
      } catch (err) {
        console.warn('[WebSocket Client] Malformed event payload:', err);
      }
    };

    wsClient.onclose = (e) => {
      console.warn(`⚠️ [WebSocket Client] Socket closed (code: ${e.code}). Reconnecting...`);
      updateWsStatusUI('disconnected');
      if (wsPingTimer) clearInterval(wsPingTimer);
      scheduleWsReconnect();
    };

    wsClient.onerror = (err) => {
      console.warn('[WebSocket Client] Socket error occurred:', err);
      updateWsStatusUI('disconnected');
      try { wsClient.close(); } catch (_) {}
    };
  }

  function scheduleWsReconnect() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(() => {
      wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 15000);
      initWebSocket();
    }, wsReconnectDelay);
  }

  function updateWsStatusUI(status) {
    const dot = document.getElementById('wsStatusDot');
    const text = document.getElementById('wsStatusText');
    const banner = document.getElementById('chatReconnectBanner');

    if (status === 'connected') {
      if (dot) {
        dot.className = 'conn-dot connected';
      }
      if (text) text.textContent = 'Live';
      if (banner) banner.style.display = 'none';
    } else if (status === 'connecting') {
      if (dot) {
        dot.className = 'conn-dot disconnected';
      }
      if (text) text.textContent = 'Connecting...';
      if (banner) banner.style.display = 'flex';
    } else {
      if (dot) {
        dot.className = 'conn-dot disconnected';
      }
      if (text) text.textContent = 'Offline';
      if (banner) banner.style.display = 'flex';
    }
  }

  function handleIncomingWsEvent(data) {
    switch (data.type) {
      case 'connection.established':
        // Initial sync of online user IDs
        if (Array.isArray(data.online_users)) {
          state.onlineUsers = new Set(data.online_users.map(String));
          updatePresenceIndicators();
        }
        break;

      case 'message.new':
        handleIncomingMessage(data.message);
        break;

      case 'message.status_update':
        handleMessageStatusUpdate(data);
        break;

      case 'message.read_receipt':
        handleReadReceipt(data);
        break;

      case 'user.presence':
        handleUserPresenceUpdate(data);
        break;

      case 'user.typing':
        handleUserTyping(data);
        break;

      case 'notification.new':
        loadNotificationsCount();
        showToast(`🔔 ${data.notification?.title || 'New notification'}`);
        break;

      default:
        break;
    }
  }

  function handleIncomingMessage(msg) {
    const convId = parseInt(msg.conversation_id, 10);
    const isActiveConv = state.activeConversationId === convId;

    // 1. If this message is for the active conversation, append immediately
    if (isActiveConv) {
      const messagesBody = document.getElementById('chatMessagesBody');
      const emptyCol = document.getElementById('emptyChatColumn');
      if (emptyCol) emptyCol.style.display = 'none';

      // Check if message already rendered (e.g. optimistic send)
      const existingMsgEl = document.querySelector(`[data-client-msg-id="${msg.client_message_id}"]`) ||
                            document.querySelector(`[data-msg-id="${msg.message_id}"]`);

      if (existingMsgEl) {
        // Update temporary optimistic bubble with server confirmation
        existingMsgEl.setAttribute('data-msg-id', msg.message_id);
        const timeEl = existingMsgEl.querySelector('.chat-msg-time');
        const statusEl = existingMsgEl.querySelector('.chat-status-icon');
        if (timeEl && msg.created_at) timeEl.textContent = msg.created_at;
        if (statusEl) {
          statusEl.className = `chat-status-icon ${msg.status || 'sent'}`;
          statusEl.innerHTML = getStatusIconHtml(msg.status || 'sent');
        }
      } else {
        // Append new message bubble
        if (messagesBody) {
          const rowEl = document.createElement('div');
          rowEl.innerHTML = renderSingleMessageRow(msg, msg.sender_id === state.currentUser?.user_id);
          const firstChild = rowEl.firstElementChild;
          if (firstChild) {
            messagesBody.appendChild(firstChild);
            messagesBody.scrollTop = messagesBody.scrollHeight;
          }
        }
      }

      // If incoming from other user while chat is open, immediately mark as read
      if (msg.sender_id !== state.currentUser?.user_id) {
        fetch(`/api/community/messages/conversations/${convId}/read`, {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
      }
    }

    // 2. Update conversation snippet and unread count in conversations store
    let conv = state.conversations.find(c => c.conversation_id === convId);
    let snippet = msg.content || (msg.message_type === 'trek_card' ? `Shared Trek: ${msg.trek_data?.name || 'Trek'}` : '📷 Photo');

    if (conv) {
      conv.last_message = snippet;
      conv.last_message_time = 'Just now';
      if (!isActiveConv && msg.sender_id !== state.currentUser?.user_id) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
    } else {
      // Reload conversations if new conversation arrived
      loadConversations(false);
    }

    renderConversationsList(state.conversations);
    loadUnreadCount();
  }

  function handleMessageStatusUpdate(data) {
    const { conversation_id, message_id, status, client_message_id } = data;
    if (state.activeConversationId !== parseInt(conversation_id, 10)) return;

    const msgEl = document.querySelector(`[data-msg-id="${message_id}"]`) ||
                  (client_message_id ? document.querySelector(`[data-client-msg-id="${client_message_id}"]`) : null);

    if (msgEl) {
      const statusIconEl = msgEl.querySelector('.chat-status-icon');
      if (statusIconEl) {
        statusIconEl.className = `chat-status-icon ${status}`;
        statusIconEl.innerHTML = getStatusIconHtml(status);
      }
    }
  }

  function handleReadReceipt(data) {
    const { conversation_id } = data;
    if (state.activeConversationId !== parseInt(conversation_id, 10)) return;

    // Mark all outgoing messages in active chat as read
    document.querySelectorAll('.chat-msg-row.self .chat-status-icon').forEach(icon => {
      icon.className = 'chat-status-icon read';
      icon.innerHTML = getStatusIconHtml('read');
    });
  }

  function handleUserPresenceUpdate(data) {
    const { user_id, status } = data;
    const uid = String(user_id);

    if (!state.onlineUsers) state.onlineUsers = new Set();
    if (status === 'online') {
      state.onlineUsers.add(uid);
    } else {
      state.onlineUsers.delete(uid);
    }

    // Update conversation list item dots
    document.querySelectorAll(`.conversation-item[data-participant-id="${uid}"] .conv-online-dot`).forEach(dot => {
      dot.style.display = status === 'online' ? 'block' : 'none';
    });

    // Update active chat header if this user is active
    const activeConv = state.conversations.find(c => c.conversation_id === state.activeConversationId);
    if (activeConv && String(activeConv.participant?.user_id) === uid) {
      const onlineDot = document.getElementById('chatHeadOnlineDot');
      const statusText = document.getElementById('chatHeadStatus');
      if (onlineDot) {
        onlineDot.className = `chat-online-indicator ${status === 'online' ? 'online' : ''}`;
      }
      if (statusText) {
        statusText.className = `chat-active-status ${status === 'online' ? 'online' : ''}`;
        statusText.textContent = status === 'online' ? '● Active now' : 'Offline';
      }
    }
  }

  function handleUserTyping(data) {
    const { conversation_id, user_id, is_typing } = data;
    if (state.activeConversationId !== parseInt(conversation_id, 10)) return;
    if (String(user_id) === String(state.currentUser?.user_id)) return;

    const typingIndicator = document.getElementById('chatTypingIndicator');
    const typingName = document.getElementById('typingName');

    if (!typingIndicator) return;

    if (is_typing) {
      const activeConv = state.conversations.find(c => c.conversation_id === state.activeConversationId);
      if (typingName) typingName.textContent = activeConv?.participant?.full_name?.split(' ')[0] || 'Trekker';
      typingIndicator.style.display = 'flex';

      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        typingIndicator.style.display = 'none';
      }, 3500);
    } else {
      typingIndicator.style.display = 'none';
    }
  }

  function updatePresenceIndicators() {
    if (!state.onlineUsers) return;
    document.querySelectorAll('.conversation-item').forEach(item => {
      const participantId = item.getAttribute('data-participant-id');
      const isOnline = participantId && state.onlineUsers.has(String(participantId));
      const dot = item.querySelector('.conv-online-dot');
      if (dot) dot.style.display = isOnline ? 'block' : 'none';
    });
  }

  function getStatusIconHtml(status) {
    if (status === 'read') {
      // Double checkmark (green/blue)
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-7.5 7.5L13 16"/></svg>`;
    } else if (status === 'delivered') {
      // Double checkmark (gray)
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-7.5 7.5L13 16"/></svg>`;
    } else {
      // Single checkmark (sent)
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
  }

  async function loadUnreadCount() {
    try {
      const res = await fetch('/api/community/messages/unread-count', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const count = data.count || 0;
        const sidebarBadge = document.getElementById('sidebarMsgBadge');
        const floatingDot = document.getElementById('floatingMsgDot');
        const tabBadge = document.getElementById('convUnreadBadgeCount');

        if (sidebarBadge) {
          sidebarBadge.textContent = count;
          sidebarBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (floatingDot) {
          floatingDot.style.display = count > 0 ? 'block' : 'none';
        }
        if (tabBadge) {
          tabBadge.textContent = count;
          tabBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
      }
    } catch (_) {}
  }

  async function loadConversations(autoSelectFirst = true) {
    try {
      const res = await fetch('/api/community/messages/conversations', {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && data.conversations) {
        state.conversations = data.conversations;
        renderConversationsList(data.conversations);

        if (autoSelectFirst && data.conversations.length > 0 && !state.activeConversationId) {
          selectConversation(data.conversations[0].conversation_id);
        } else if (data.conversations.length === 0) {
          showEmptyChatView();
        }
      }
    } catch (err) {
      console.error('[Messaging Client] Failed to load conversations:', err);
    }
  }

  function renderConversationsList(conversations) {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    if (!conversations || conversations.length === 0) {
      container.innerHTML = `
        <div style="padding: 30px 20px; text-align: center; color: var(--comm-text-muted);">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">💬</div>
          <strong style="color: var(--comm-text-primary); font-size: 0.9rem;">No Conversations Yet</strong>
          <p style="font-size: 0.78rem; margin-top: 4px;">Click the + button above to connect with fellow trekkers.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = conversations.map(conv => {
      const isOnline = conv.participant?.online_status === 'online' || (state.onlineUsers && state.onlineUsers.has(String(conv.participant?.user_id)));
      const isActive = conv.conversation_id === state.activeConversationId;

      return `
        <div class="conversation-item ${isActive ? 'active' : ''}" data-conv-id="${conv.conversation_id}" data-participant-id="${conv.participant?.user_id || ''}">
          <div class="conv-avatar-wrap">
            <img src="${escapeHtml(conv.participant?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" alt="${escapeHtml(conv.participant?.full_name || 'Trekker')}" />
            <span class="conv-online-dot" style="display: ${isOnline ? 'block' : 'none'};"></span>
          </div>
          <div class="conv-meta">
            <div class="conv-name-row">
              <span class="conv-name">${escapeHtml(conv.participant?.full_name || 'Trekker')}</span>
              <span class="conv-time">${escapeHtml(conv.last_message_time || '')}</span>
            </div>
            <div class="conv-snippet-row">
              <span class="conv-snippet">${escapeHtml(conv.last_message || 'Start conversation...')}</span>
              ${conv.unread_count > 0 ? `<span class="conv-unread-pill">${conv.unread_count}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.conversation-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.getAttribute('data-conv-id'), 10);
        selectConversation(id);
      });
    });
  }

  async function selectConversation(conversationId) {
    const convId = parseInt(conversationId, 10);
    state.activeConversationId = convId;

    // Mobile slide view
    const drawerShell = document.getElementById('messagesDrawerShell');
    if (drawerShell) drawerShell.classList.add('chat-open');

    const emptyCol = document.getElementById('emptyChatColumn');
    const activeCol = document.getElementById('activeChatColumn');
    if (emptyCol) emptyCol.style.display = 'none';
    if (activeCol) activeCol.style.display = 'flex';

    // Highlight in list
    document.querySelectorAll('.conversation-item').forEach(el => {
      const id = parseInt(el.getAttribute('data-conv-id'), 10);
      el.classList.toggle('active', id === convId);
    });

    // Clear unread pill locally
    const targetConv = state.conversations.find(c => c.conversation_id === convId);
    if (targetConv) {
      targetConv.unread_count = 0;
      renderConversationsList(state.conversations);
    }

    try {
      const res = await fetch(`/api/community/messages/conversations/${convId}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        renderActiveChat(data.conversation);
        loadUnreadCount();
      }
    } catch (err) {
      console.error('[Messaging Client] Failed to load chat:', err);
    }
  }

  function showEmptyChatView() {
    const emptyCol = document.getElementById('emptyChatColumn');
    const activeCol = document.getElementById('activeChatColumn');
    if (emptyCol) emptyCol.style.display = 'flex';
    if (activeCol) activeCol.style.display = 'none';
  }

  function renderActiveChat(conv) {
    const avatar = document.getElementById('chatHeadAvatar');
    const name = document.getElementById('chatHeadName');
    const onlineDot = document.getElementById('chatHeadOnlineDot');
    const statusText = document.getElementById('chatHeadStatus');
    const trekBadge = document.getElementById('chatHeadActiveTrek');
    const trekText = document.getElementById('chatHeadActiveTrekText');
    const messagesBody = document.getElementById('chatMessagesBody');

    const isOnline = conv.participant?.online_status === 'online' || (state.onlineUsers && state.onlineUsers.has(String(conv.participant?.user_id)));

    if (avatar) avatar.src = conv.participant?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    if (name) name.textContent = conv.participant?.full_name || 'Trekker';

    if (onlineDot) {
      onlineDot.className = `chat-online-indicator ${isOnline ? 'online' : ''}`;
    }
    if (statusText) {
      statusText.className = `chat-active-status ${isOnline ? 'online' : ''}`;
      statusText.textContent = isOnline ? '● Active now' : (conv.participant?.last_active || 'Offline');
    }

    if (trekBadge && trekText) {
      if (conv.participant?.active_trek) {
        trekBadge.style.display = 'flex';
        trekText.textContent = `Active Trek: ${conv.participant.active_trek}`;
      } else {
        trekBadge.style.display = 'none';
      }
    }

    const viewProfileBtn = document.getElementById('chatViewProfileBtn');
    if (viewProfileBtn && conv.participant?.user_id) {
      viewProfileBtn.onclick = () => openTrekkerProfile(conv.participant.user_id);
    }

    if (messagesBody) {
      if (!conv.messages || conv.messages.length === 0) {
        messagesBody.innerHTML = `
          <div style="padding: 40px 20px; text-align: center; color: var(--comm-text-muted); margin: auto;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🏔️</div>
            <strong style="color: var(--comm-text-primary); font-size: 0.95rem;">Beginning of Trail Conversation</strong>
            <p style="font-size: 0.82rem; margin-top: 4px;">Say hello or share a TrekIndia route to start planning your next hike together!</p>
          </div>
        `;
      } else {
        messagesBody.innerHTML = `
          <div class="chat-date-separator"><span>Today</span></div>
          ${conv.messages.map(msg => renderSingleMessageRow(msg, msg.is_self)).join('')}
        `;
        messagesBody.scrollTop = messagesBody.scrollHeight;
      }
    }
  }

  function renderSingleMessageRow(msg, isSelf) {
    const status = msg.status || 'sent';

    if (msg.message_type === 'trek_card' && msg.trek_data) {
      const trek = msg.trek_data;
      return `
        <div class="chat-msg-row ${isSelf ? 'self' : 'other'}" data-msg-id="${msg.message_id || ''}" data-client-msg-id="${msg.client_message_id || ''}">
          ${!isSelf ? `<img src="${escapeHtml(msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" class="chat-msg-avatar" alt="" />` : ''}
          <div class="chat-msg-content-wrap">
            <div class="chat-trek-card">
              <div class="chat-trek-card-img-wrap">
                <img src="${escapeHtml(trek.image || 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600')}" alt="${escapeHtml(trek.name)}" />
                <span class="chat-trek-diff-badge">${escapeHtml(trek.difficulty || 'MODERATE')}</span>
              </div>
              <div class="chat-trek-card-content">
                <div class="chat-trek-title">${escapeHtml(trek.name)}</div>
                <div class="chat-trek-stats-row">
                  <span>⛰️ ${escapeHtml(trek.elevation || trek.altitude || '3,800m')}</span>
                  <span>📏 ${escapeHtml(trek.distance || trek.duration || '6 Days')}</span>
                </div>
                <button class="btn-chat-view-trek" onclick="window.TrekIndiaCommunity.viewTrekDetails('${trek.slug || 'kedarkantha'}')">
                  <span>View Route Details</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
            <div class="chat-msg-footer">
              <span class="chat-msg-time">${escapeHtml(msg.created_at || 'Just now')}</span>
              ${isSelf ? `<span class="chat-status-icon ${status}">${getStatusIconHtml(status)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    if (msg.message_type === 'image' && msg.attachment_url) {
      return `
        <div class="chat-msg-row ${isSelf ? 'self' : 'other'}" data-msg-id="${msg.message_id || ''}" data-client-msg-id="${msg.client_message_id || ''}">
          ${!isSelf ? `<img src="${escapeHtml(msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" class="chat-msg-avatar" alt="" />` : ''}
          <div class="chat-msg-content-wrap">
            <div class="chat-photo-bubble">
              <img src="${escapeHtml(msg.attachment_url)}" alt="Photo Attachment" />
            </div>
            <div class="chat-msg-footer">
              <span class="chat-msg-time">${escapeHtml(msg.created_at || 'Just now')}</span>
              ${isSelf ? `<span class="chat-status-icon ${status}">${getStatusIconHtml(status)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="chat-msg-row ${isSelf ? 'self' : 'other'}" data-msg-id="${msg.message_id || ''}" data-client-msg-id="${msg.client_message_id || ''}">
        ${!isSelf ? `<img src="${escapeHtml(msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" class="chat-msg-avatar" alt="" />` : ''}
        <div class="chat-msg-content-wrap">
          <div class="chat-msg-bubble">
            ${escapeHtml(msg.content || '')}
          </div>
          <div class="chat-msg-footer">
            <span class="chat-msg-time">${escapeHtml(msg.created_at || 'Just now')}</span>
            ${isSelf ? `<span class="chat-status-icon ${status}">${getStatusIconHtml(status)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  async function sendChatMessage(customPayload = null) {
    if (!state.activeConversationId) return;

    let payload = customPayload;
    const clientMessageId = `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!payload) {
      const textInput = document.getElementById('chatTextInput');
      if (!textInput || !textInput.value.trim()) return;

      const content = textInput.value.trim();
      payload = {
        message_type: 'text',
        content,
        client_message_id: clientMessageId
      };
      textInput.value = '';
      textInput.style.height = 'auto'; // Reset auto-expanded height
    } else {
      payload.client_message_id = clientMessageId;
    }

    // Disable send button temporarily
    const sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    // Render Optimistic Message Bubble Immediately
    const messagesBody = document.getElementById('chatMessagesBody');
    if (messagesBody) {
      const optimisticMsg = {
        message_id: 'temp_' + Date.now(),
        client_message_id: clientMessageId,
        sender_id: state.currentUser?.user_id,
        avatar: state.currentUser?.profile_image,
        message_type: payload.message_type,
        content: payload.content,
        trek_data: payload.trek_data,
        attachment_url: payload.attachment_url,
        status: 'sent',
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        is_self: true
      };

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderSingleMessageRow(optimisticMsg, true);
      if (tempDiv.firstElementChild) {
        messagesBody.appendChild(tempDiv.firstElementChild);
        messagesBody.scrollTop = messagesBody.scrollHeight;
      }
    }

    try {
      const res = await fetch(`/api/community/messages/conversations/${state.activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.message) {
        // Reconcile optimistic element with confirmed server data
        const msgEl = document.querySelector(`[data-client-msg-id="${clientMessageId}"]`);
        if (msgEl) {
          msgEl.setAttribute('data-msg-id', data.message.message_id);
          const timeEl = msgEl.querySelector('.chat-msg-time');
          const statusIcon = msgEl.querySelector('.chat-status-icon');
          if (timeEl && data.message.created_at) timeEl.textContent = data.message.created_at;
          if (statusIcon) {
            statusIcon.className = 'chat-status-icon sent';
            statusIcon.innerHTML = getStatusIconHtml('sent');
          }
        }
      }
    } catch (err) {
      console.error('[Messaging Client] Failed to send message:', err);
      showToast('Unable to deliver message. Check connection.');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function emitTypingIndicator() {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN || !state.activeConversationId) return;

    const now = Date.now();
    if (now - lastTypingSentAt > 2000) {
      lastTypingSentAt = now;
      wsClient.send(JSON.stringify({
        type: 'user.typing',
        conversation_id: state.activeConversationId,
        is_typing: true
      }));
    }
  }

  async function openNewChatModal() {
    const modal = document.getElementById('newChatModalOverlay');
    const list = document.getElementById('newChatTrekkersList');
    const searchInput = document.getElementById('newChatSearchInput');

    if (!modal || !list) return;
    modal.style.display = 'flex';
    if (searchInput) searchInput.value = '';

    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--comm-text-muted);">Loading trekkers...</div>';

    try {
      const res = await fetch('/api/community/trekkers');
      const data = await res.json();
      if (data.success && data.trekkers) {
        renderNewChatTrekkers(data.trekkers);

        if (searchInput) {
          searchInput.oninput = () => {
            const q = searchInput.value.trim().toLowerCase();
            const filtered = data.trekkers.filter(t =>
              t.full_name.toLowerCase().includes(q) ||
              t.username.toLowerCase().includes(q) ||
              t.location.toLowerCase().includes(q)
            );
            renderNewChatTrekkers(filtered);
          };
        }
      }
    } catch (err) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Failed to load trekkers.</div>';
    }
  }

  function renderNewChatTrekkers(trekkers) {
    const list = document.getElementById('newChatTrekkersList');
    if (!list) return;

    if (!trekkers || trekkers.length === 0) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--comm-text-muted);">No trekkers found.</div>';
      return;
    }

    list.innerHTML = trekkers.map(t => `
      <div class="new-chat-trekker-row" data-user-id="${t.user_id}">
        <div class="new-chat-user-info">
          <img src="${escapeHtml(t.avatar)}" class="new-chat-avatar" alt="${escapeHtml(t.full_name)}" />
          <div class="new-chat-meta">
            <strong>${escapeHtml(t.full_name)} ${t.is_verified ? '<span class="badge-verified-mini">✓</span>' : ''}</strong>
            <span>@${escapeHtml(t.username)} • 📍 ${escapeHtml(t.location || 'India')}</span>
          </div>
        </div>
        <button class="btn-select-share-trek" style="padding: 6px 14px; background: var(--comm-forest); color: #fff; border: none; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
          Message
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.new-chat-trekker-row').forEach(row => {
      row.addEventListener('click', async () => {
        const targetUserId = row.getAttribute('data-user-id');
        document.getElementById('newChatModalOverlay').style.display = 'none';
        const drawer = document.getElementById('messagesDrawerOverlay');
        if (drawer) drawer.style.display = 'flex';

        try {
          const res = await fetch('/api/community/messages/conversations/direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ participant_id: targetUserId })
          });
          const d = await res.json();
          if (d.success && d.conversation_id) {
            await loadConversations(false);
            selectConversation(d.conversation_id);
          }
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  async function openShareTrekPickerModal() {
    const modal = document.getElementById('shareTrekModalOverlay');
    const list = document.getElementById('shareTrekList');
    const searchInput = document.getElementById('shareTrekSearchInput');

    if (!modal || !list) return;
    modal.style.display = 'flex';
    if (searchInput) searchInput.value = '';

    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--comm-text-muted);">Loading TrekIndia routes...</div>';

    try {
      const res = await fetch('/api/treks');
      const data = await res.json();
      const treks = data.treks || data.data || [];
      renderShareTrekList(treks);

      if (searchInput) {
        searchInput.oninput = () => {
          const q = searchInput.value.trim().toLowerCase();
          const filtered = treks.filter(t =>
            (t.name || '').toLowerCase().includes(q) ||
            (t.state || '').toLowerCase().includes(q)
          );
          renderShareTrekList(filtered);
        };
      }
    } catch (err) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Failed to load treks.</div>';
    }
  }

  function renderShareTrekList(treks) {
    const list = document.getElementById('shareTrekList');
    if (!list) return;

    if (!treks || treks.length === 0) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--comm-text-muted);">No routes matched.</div>';
      return;
    }

    list.innerHTML = treks.map(t => `
      <div class="new-chat-trekker-row" data-trek-id="${t.id}" style="gap: 12px;">
        <img src="${escapeHtml(t.image || 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=300')}" style="width: 52px; height: 52px; border-radius: 8px; object-fit: cover;" alt="" />
        <div style="flex: 1; min-width: 0;">
          <strong style="display: block; font-size: 0.92rem; color: var(--comm-text-primary);">${escapeHtml(t.name)}</strong>
          <span style="font-size: 0.78rem; color: var(--comm-text-muted);">⛰️ ${escapeHtml(t.altitude || t.elevation || '3,800m')} • ⏱️ ${escapeHtml(t.duration || '6 Days')}</span>
        </div>
        <button class="btn-select-share-trek" style="padding: 6px 14px; background: var(--comm-forest); color: #fff; border: none; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
          Share in Chat
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.new-chat-trekker-row').forEach((row, idx) => {
      row.addEventListener('click', () => {
        const trek = treks[idx];
        document.getElementById('shareTrekModalOverlay').style.display = 'none';

        sendChatMessage({
          message_type: 'trek_card',
          content: `Shared trek: ${trek.name}`,
          trek_data: {
            id: trek.id,
            name: trek.name,
            slug: trek.slug || trek.name.toLowerCase().replace(/\s+/g, '-'),
            image: trek.image,
            elevation: trek.altitude || trek.elevation || '3,800m',
            distance: trek.duration || '6 Days',
            difficulty: trek.difficulty || 'MODERATE'
          }
        });
      });
    });
  }

  function handleChatPhotoUpload(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      sendChatMessage({
        message_type: 'image',
        attachment_url: base64
      });
    };
    reader.readAsDataURL(file);
  }

  // ─── 7. CREATE POST MULTI-STEP WORKFLOW ─────────────────────────────────────
  function openCreatePostModal() {
    state.createPostStep = 1;
    updateCreatePostStepUI();

    const overlay = document.getElementById('createPostModalOverlay');
    if (overlay) overlay.style.display = 'flex';
  }

  function updateCreatePostStepUI() {
    const step = state.createPostStep;
    const titleEl = document.getElementById('createModalTitle');
    const backBtn = document.getElementById('createModalBackBtn');
    const nextBtn = document.getElementById('createModalNextBtn');
    const publishBtn = document.getElementById('createModalPublishBtn');

    // Panels
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`stepPanel${i}`);
      if (panel) panel.style.display = (i === step) ? 'block' : 'none';
      const dot = document.querySelector(`.step-dot[data-step="${i}"]`);
      if (dot) dot.classList.toggle('active', i <= step);
    }

    if (backBtn) backBtn.style.display = step > 1 ? 'inline-block' : 'none';
    if (nextBtn) nextBtn.style.display = step < 4 ? 'inline-block' : 'none';
    if (publishBtn) publishBtn.style.display = step === 4 ? 'inline-block' : 'none';

    if (titleEl) {
      const titles = [
        'Step 1: Choose Post Type',
        'Step 2: Upload Photos',
        'Step 3: Expedition Details',
        'Step 4: Live Feed Preview'
      ];
      titleEl.textContent = titles[step - 1];
    }

    if (step === 4) {
      renderLivePostPreview();
    }
  }

  function renderLivePostPreview() {
    const previewContainer = document.getElementById('postCardPreview');
    if (!previewContainer) return;

    const data = state.createPostData;
    const images = data.images.length > 0 ? data.images : ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85'];

    previewContainer.innerHTML = `
      <div class="comm-post-card" style="margin: 0; box-shadow: none; border-color: var(--comm-border);">
        <div class="post-header">
          <div class="post-author-wrap">
            <div class="post-author-avatar">
              <img src="${escapeHtml(state.currentUser?.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" />
            </div>
            <div class="post-author-meta">
              <span class="post-author-name">${escapeHtml(state.currentUser?.full_name || 'You')}</span>
              <span class="post-location-time">📍 ${escapeHtml(data.location || 'Himalayan Pass')} • Just now</span>
            </div>
          </div>
        </div>
        <div class="post-media-frame">
          <img src="${escapeHtml(images[0])}" class="post-media-img" />
          <div class="post-stats-overlay">
            <div class="overlay-pill">🌲 ${escapeHtml(data.difficulty || 'Moderate')}</div>
            ${data.elevation_m ? `<div class="overlay-pill">⛰️ ${data.elevation_m}m</div>` : ''}
            ${data.duration_days ? `<div class="overlay-pill">⏱️ ${data.duration_days} Days</div>` : ''}
          </div>
        </div>
        <div class="post-caption-wrap">
          <p class="post-caption-text">
            <strong>${escapeHtml(state.currentUser?.full_name || 'You')}</strong>
            ${escapeHtml(data.caption || 'No caption entered yet.')}
          </p>
        </div>
      </div>
    `;
  }

  async function publishNewPost() {
    const publishBtn = document.getElementById('createModalPublishBtn');
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.textContent = 'Publishing...';
    }

    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(state.createPostData)
      });

      const data = await res.json();
      if (data.success && data.post) {
        showToast('Expedition story published to TrekIndia! 🏔️');
        const modal = document.getElementById('createPostModalOverlay');
        if (modal) modal.style.display = 'none';

        // Reload feed
        loadPosts();
      }
    } catch (err) {
      console.error('Failed to publish post:', err);
    } finally {
      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.textContent = 'Publish to Community';
      }
    }
  }

  // ─── 8. TREKKERS DIRECTORY ──────────────────────────────────────────────────
  async function loadTrekkersDirectory() {
    const grid = document.getElementById('trekkersGrid');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 40px; color: var(--comm-text-muted);">Finding fellow mountain lovers...</div>';

    const search = document.getElementById('trekkerSearchInput')?.value || '';
    const loc = document.getElementById('trekkerLocationFilter')?.value || 'all';
    const exp = document.getElementById('trekkerExpFilter')?.value || 'all';
    const diff = document.getElementById('trekkerDiffFilter')?.value || 'all';

    try {
      const res = await fetch(`/api/community/trekkers?query=${encodeURIComponent(search)}&location=${loc}&experience=${exp}&difficulty=${diff}`);
      const data = await res.json();
      if (data.success && data.trekkers) {
        renderTrekkersGrid(data.trekkers);
      }
    } catch (err) {
      grid.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #ef4444;">Failed to load trekkers.</div>';
    }
  }

  function renderTrekkersGrid(trekkers) {
    const grid = document.getElementById('trekkersGrid');
    if (!grid) return;

    if (!trekkers || trekkers.length === 0) {
      grid.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 40px; color: var(--comm-text-muted);">No trekkers match your filter.</div>';
      return;
    }

    grid.innerHTML = trekkers.map(t => `
      <div class="trekker-card" data-trekker-id="${t.user_id}">
        <div class="trekker-card-top">
          <img src="${escapeHtml(t.avatar)}" alt="${escapeHtml(t.full_name)}" class="trekker-card-avatar" />
          <div class="trekker-card-meta">
            <div class="trekker-card-name">
              <span>${escapeHtml(t.full_name)}</span>
              ${t.is_verified ? '<span class="badge-verified-mini">✓</span>' : ''}
            </div>
            <div class="trekker-card-level">${escapeHtml(t.experience_level)}</div>
            <div class="trekker-card-location">📍 ${escapeHtml(t.location)}</div>
          </div>
        </div>
        <p class="trekker-card-bio">${escapeHtml(t.bio)}</p>
        <div class="trekker-card-stats">
          <div><strong>${t.treks_completed}</strong> Treks</div> •
          <div><strong>${t.highest_altitude}</strong> Max Alt</div> •
          <div><strong>${t.states_explored}</strong> States</div>
        </div>
        <div class="trekker-card-actions">
          <button class="btn-trekker-connect ${t.is_following ? 'following' : ''}" data-id="${t.user_id}">
            ${t.is_following ? 'Following' : 'Connect'}
          </button>
          <button class="btn-trekker-msg" data-id="${t.user_id}">Message</button>
        </div>
      </div>
    `).join('');

    // Attach click handlers
    grid.querySelectorAll('.btn-trekker-connect').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        try {
          const res = await fetch(`/api/community/trekkers/${id}/follow`, {
            method: 'POST',
            credentials: 'include'
          });
          const data = await res.json();
          if (data.success) {
            btn.classList.toggle('following', data.is_following);
            btn.textContent = data.is_following ? 'Following' : 'Connect';
            showToast(data.is_following ? 'Connected with trekker! 🤝' : 'Unfollowed trekker.');
          }
        } catch (err) {
          console.error(err);
        }
      });
    });

    grid.querySelectorAll('.btn-trekker-msg').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openChatWithTrekker(id);
      });
    });

    grid.querySelectorAll('.trekker-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-trekker-id');
        openTrekkerProfile(id);
      });
    });
  }

  function openChatWithTrekker(trekkerId) {
    const drawer = document.getElementById('messagesDrawerOverlay');
    if (drawer) drawer.style.display = 'flex';
    selectConversation(trekkerId);
  }

  // ─── 9. USER PROFILE MODAL ──────────────────────────────────────────────────
  async function openTrekkerProfile(identifier) {
    const modal = document.getElementById('trekkerProfileModalOverlay');
    if (!modal) return;

    modal.style.display = 'flex';

    try {
      const res = await fetch(`/api/community/trekkers/${identifier}`);
      const data = await res.json();
      if (data.success && data.profile) {
        renderProfileModal(data.profile);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }

  function renderProfileModal(profile) {
    const cover = document.getElementById('modalProfileCover');
    const avatar = document.getElementById('modalProfileAvatar');
    const name = document.getElementById('modalProfileName');
    const handle = document.getElementById('modalProfileHandle');
    const loc = document.getElementById('modalProfileLocation');
    const bio = document.getElementById('modalProfileBio');
    const treksCount = document.getElementById('modalStatTreks');
    const summits = document.getElementById('modalStatSummits');
    const followers = document.getElementById('modalStatFollowers');
    const following = document.getElementById('modalStatFollowing');
    const postsCountTab = document.getElementById('modalTabPostsCount');
    const tabContent = document.getElementById('profileModalTabContent');
    const followBtn = document.getElementById('modalFollowBtn');
    const msgBtn = document.getElementById('modalMessageBtn');

    if (cover) cover.src = profile.cover_image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200';
    if (avatar) avatar.src = profile.avatar;
    if (name) name.textContent = profile.full_name;
    if (handle) handle.textContent = `@${profile.username}`;
    if (loc) loc.textContent = `📍 ${profile.location || 'India'}`;
    if (bio) bio.textContent = profile.bio;
    if (treksCount) treksCount.textContent = profile.treks_completed;
    if (summits) summits.textContent = profile.highest_altitude;
    if (followers) followers.textContent = profile.followers_count;
    if (following) following.textContent = profile.following_count;
    if (postsCountTab) postsCountTab.textContent = profile.posts ? profile.posts.length : 0;

    if (followBtn) {
      followBtn.textContent = profile.is_following ? 'Following' : 'Follow';
      followBtn.onclick = async () => {
        const res = await fetch(`/api/community/trekkers/${profile.user_id}/follow`, { method: 'POST', credentials: 'include' });
        const d = await res.json();
        if (d.success) {
          followBtn.textContent = d.is_following ? 'Following' : 'Follow';
        }
      };
    }

    if (msgBtn) {
      msgBtn.onclick = () => {
        modal.style.display = 'none';
        openChatWithTrekker(profile.user_id);
      };
    }

    // Render Posts tab default
    if (tabContent) {
      if (profile.posts && profile.posts.length > 0) {
        tabContent.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px;">
            ${profile.posts.map(p => `
              <div style="height: 120px; border-radius: 8px; overflow: hidden; background: #000;">
                <img src="${escapeHtml(p.images[0] || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600')}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            `).join('')}
          </div>
        `;
      } else {
        tabContent.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--comm-text-muted);">No posts shared yet.</div>';
      }
    }
  }

  // ─── 10. NOTIFICATIONS CENTER & UNIVERSAL SEARCH ───────────────────────────
  async function loadNotificationsCount() {
    try {
      const res = await fetch('/api/community/notifications', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const headerDot = document.getElementById('headerNotifDot');
        const sidebarBadge = document.getElementById('sidebarNotifBadge');
        if (headerDot) headerDot.style.display = data.unread_count > 0 ? 'block' : 'none';
        if (sidebarBadge) {
          sidebarBadge.textContent = data.unread_count;
          sidebarBadge.style.display = data.unread_count > 0 ? 'inline-block' : 'none';
        }
      }
    } catch (err) {
      console.warn('Notifications load:', err);
    }
  }

  async function openNotificationsDrawer() {
    const drawer = document.getElementById('notifDrawerOverlay');
    const list = document.getElementById('notifListBody');
    if (!drawer || !list) return;

    drawer.style.display = 'flex';
    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--comm-text-muted);">Loading notifications...</div>';

    try {
      const res = await fetch('/api/community/notifications', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.notifications) {
        list.innerHTML = data.notifications.map(n => `
          <div class="notif-item ${n.is_read ? 'read' : 'unread'}" style="padding: 12px 16px; border-bottom: 1px solid var(--comm-border); display: flex; gap: 12px; align-items: flex-start;">
            <img src="${escapeHtml(n.actor?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100')}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;" />
            <div style="flex: 1;">
              <strong style="font-size: 0.88rem; color: var(--comm-text-primary);">${escapeHtml(n.title)}</strong>
              <p style="font-size: 0.82rem; color: var(--comm-text-secondary); margin: 2px 0 4px;">${escapeHtml(n.message)}</p>
              <span style="font-size: 0.72rem; color: var(--comm-text-muted);">${escapeHtml(n.time)}</span>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Failed to load.</div>';
    }
  }

  function openUniversalSearch() {
    const modal = document.getElementById('communitySearchModalOverlay');
    const input = document.getElementById('universalSearchInput');
    if (modal) {
      modal.style.display = 'flex';
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  async function performUniversalSearch(query) {
    const resultsContainer = document.getElementById('universalSearchResults');
    if (!resultsContainer) return;

    if (!query || query.trim().length < 2) {
      resultsContainer.innerHTML = '<div class="search-initial-hint">Type at least 2 characters to search across the TrekIndia community.</div>';
      return;
    }

    try {
      const res = await fetch(`/api/community/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        renderSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function renderSearchResults(data) {
    const resultsContainer = document.getElementById('universalSearchResults');
    if (!resultsContainer) return;

    let html = '';

    // Treks
    if (data.treks && data.treks.length > 0) {
      html += `<div style="margin-bottom: 14px;"><strong style="font-size: 0.8rem; text-transform: uppercase; color: var(--comm-forest);">Treks</strong>`;
      html += data.treks.map(t => `
        <div style="padding: 8px 10px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between;" onmouseover="this.style.background='var(--comm-surface-secondary)'" onmouseout="this.style.background='transparent'" onclick="window.TrekIndiaCommunity.viewTrekDetails('${t.name.toLowerCase().replace(/\\s+/g, '-')}')">
          <span>🏔️ ${escapeHtml(t.name)}</span>
          <span style="font-size: 0.8rem; color: var(--comm-text-muted);">${escapeHtml(t.altitude)} • ${escapeHtml(t.difficulty)}</span>
        </div>
      `).join('');
      html += `</div>`;
    }

    // Trekkers
    if (data.trekkers && data.trekkers.length > 0) {
      html += `<div style="margin-bottom: 14px;"><strong style="font-size: 0.8rem; text-transform: uppercase; color: var(--comm-forest);">Trekkers</strong>`;
      html += data.trekkers.map(t => `
        <div style="padding: 8px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 10px;" onmouseover="this.style.background='var(--comm-surface-secondary)'" onmouseout="this.style.background='transparent'" onclick="window.TrekIndiaCommunity.openProfile('${t.user_id}')">
          <img src="${escapeHtml(t.avatar)}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" />
          <div><strong>${escapeHtml(t.full_name)}</strong> <span style="font-size: 0.78rem; color: var(--comm-text-muted);">@${escapeHtml(t.username)}</span></div>
        </div>
      `).join('');
      html += `</div>`;
    }

    // Hashtags
    if (data.hashtags && data.hashtags.length > 0) {
      html += `<div><strong style="font-size: 0.8rem; text-transform: uppercase; color: var(--comm-forest);">Hashtags</strong><div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">`;
      html += data.hashtags.map(h => `
        <span class="post-hashtag-pill" onclick="window.TrekIndiaCommunity.filterTag('${h}')">#${escapeHtml(h)}</span>
      `).join('');
      html += `</div></div>`;
    }

    resultsContainer.innerHTML = html || '<div style="padding: 20px; text-align: center; color: var(--comm-text-muted);">No matches found for your query.</div>';
  }

  // ─── 11. BINDING GLOBAL EVENT LISTENERS ──────────────────────────────────────
  function bindEventListeners() {
    // Navigation Sidebar Tabs
    document.querySelectorAll('.comm-nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchCommunityTab(tab, btn);
      });
    });

    // Hero buttons
    document.getElementById('heroFindTrekkersBtn')?.addEventListener('click', () => {
      switchCommunityTab('trekkers', document.getElementById('sidebarFindTrekkersBtn'));
    });
    document.getElementById('heroCreatePostBtn')?.addEventListener('click', openCreatePostModal);
    document.getElementById('emptyCreateBtn')?.addEventListener('click', openCreatePostModal);
    document.getElementById('addStoryTriggerBtn')?.addEventListener('click', openCreatePostModal);

    // Messaging Drawer Controls
    const openMessagesDrawer = () => {
      const drawer = document.getElementById('messagesDrawerOverlay');
      if (drawer) drawer.style.display = 'flex';
      loadConversations(false);
      loadUnreadCount();
    };

    document.getElementById('floatingMessageBtn')?.addEventListener('click', openMessagesDrawer);
    document.getElementById('sidebarMessagesBtn')?.addEventListener('click', openMessagesDrawer);
    document.getElementById('closeMessagesDrawerBtn')?.addEventListener('click', () => {
      const drawer = document.getElementById('messagesDrawerOverlay');
      if (drawer) drawer.style.display = 'none';
    });
    document.getElementById('chatCloseBtn')?.addEventListener('click', () => {
      const drawer = document.getElementById('messagesDrawerOverlay');
      if (drawer) drawer.style.display = 'none';
    });
    document.getElementById('chatBackToListBtn')?.addEventListener('click', () => {
      const drawerShell = document.getElementById('messagesDrawerShell');
      if (drawerShell) drawerShell.classList.remove('chat-open');
    });

    // Start New Chat Prompts
    document.getElementById('btnNewChatPrompt')?.addEventListener('click', openNewChatModal);
    document.getElementById('btnEmptyStartChat')?.addEventListener('click', openNewChatModal);
    document.getElementById('closeNewChatModalBtn')?.addEventListener('click', () => {
      const modal = document.getElementById('newChatModalOverlay');
      if (modal) modal.style.display = 'none';
    });
    document.getElementById('closeShareTrekModalBtn')?.addEventListener('click', () => {
      const modal = document.getElementById('shareTrekModalOverlay');
      if (modal) modal.style.display = 'none';
    });

    // Conversation Search Filter
    document.getElementById('convSearchInput')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!state.conversations) return;
      const filtered = state.conversations.filter(c =>
        (c.participant?.full_name || '').toLowerCase().includes(q) ||
        (c.last_message || '').toLowerCase().includes(q)
      );
      renderConversationsList(filtered);
    });

    // Conversation Tabs Filter (All vs Unread)
    document.getElementById('tabAllChats')?.addEventListener('click', (e) => {
      document.querySelectorAll('.conv-tab-btn').forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderConversationsList(state.conversations);
    });
    document.getElementById('tabUnreadChats')?.addEventListener('click', (e) => {
      document.querySelectorAll('.conv-tab-btn').forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const unreadList = (state.conversations || []).filter(c => (c.unread_count || 0) > 0);
      renderConversationsList(unreadList);
    });

    // Chat Sending & Typing Indicators
    const chatInput = document.getElementById('chatTextInput');
    if (chatInput) {
      chatInput.addEventListener('input', () => {
        emitTypingIndicator();
        // Auto-expand textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
      });

      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
    }

    document.getElementById('chatSendBtn')?.addEventListener('click', () => sendChatMessage());

    // Emoji Popover Trigger
    const emojiBtn = document.getElementById('chatEmojiTrigger');
    const emojiPopover = document.getElementById('chatEmojiPopover');
    if (emojiBtn && emojiPopover) {
      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPopover.style.display = emojiPopover.style.display === 'none' ? 'block' : 'none';
      });

      emojiPopover.querySelectorAll('.emoji-item').forEach(item => {
        item.addEventListener('click', () => {
          if (chatInput) {
            chatInput.value += item.textContent;
            chatInput.focus();
          }
          emojiPopover.style.display = 'none';
        });
      });

      document.addEventListener('click', (e) => {
        if (!emojiPopover.contains(e.target) && e.target !== emojiBtn) {
          emojiPopover.style.display = 'none';
        }
      });
    }

    // Chat Attachment Menu Trigger
    const attachTrigger = document.getElementById('chatAttachTrigger');
    const attachMenu = document.getElementById('chatAttachMenu');
    if (attachTrigger && attachMenu) {
      attachTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        attachMenu.style.display = attachMenu.style.display === 'none' ? 'flex' : 'none';
      });
      document.addEventListener('click', () => {
        attachMenu.style.display = 'none';
      });
    }

    // Attach Trek Card Trigger
    document.getElementById('attachShareTrekBtn')?.addEventListener('click', () => {
      if (attachMenu) attachMenu.style.display = 'none';
      openShareTrekPickerModal();
    });

    // Attach Photo Trigger
    const photoInput = document.getElementById('chatPhotoInput');
    document.getElementById('attachSharePhotoBtn')?.addEventListener('click', () => {
      if (attachMenu) attachMenu.style.display = 'none';
      if (photoInput) photoInput.click();
    });
    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleChatPhotoUpload(e.target.files[0]);
          photoInput.value = '';
        }
      });
    }

    // Story Viewer Controls
    document.getElementById('closeStoryViewerBtn')?.addEventListener('click', closeStoryViewer);
    document.getElementById('storyZonePrev')?.addEventListener('click', prevStorySlide);
    document.getElementById('storyZoneNext')?.addEventListener('click', nextStorySlide);

    // Comments Drawer Controls
    document.getElementById('closeCommentsDrawerBtn')?.addEventListener('click', () => {
      const drawer = document.getElementById('commentsDrawerOverlay');
      if (drawer) drawer.style.display = 'none';
    });
    document.getElementById('submitCommentBtn')?.addEventListener('click', submitComment);
    document.getElementById('commentTextInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitComment();
    });
    document.getElementById('cancelReplyBtn')?.addEventListener('click', () => {
      state.replyingToCommentId = null;
      const banner = document.getElementById('replyingToBanner');
      if (banner) banner.style.display = 'none';
    });

    // Create Post Modal Controls
    document.getElementById('closeCreatePostModalBtn')?.addEventListener('click', () => {
      document.getElementById('createPostModalOverlay').style.display = 'none';
    });

    // Create Post Type Selector
    document.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.createPostData.type = card.getAttribute('data-type');
      });
    });

    // Image Dropzone
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('postImageInput');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', handleImageUpload);

      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--comm-forest)'; });
      dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
      });
    }

    // Trek Autocomplete in Post Creator
    const trekInput = document.getElementById('postTrekSearchInput');
    const treksDropdown = document.getElementById('treksDropdown');
    if (trekInput && treksDropdown) {
      trekInput.addEventListener('input', () => {
        const val = trekInput.value.trim().toLowerCase();
        if (val.length < 2) {
          treksDropdown.style.display = 'none';
          return;
        }

        const matches = state.availableTreks.filter(t => t.name.toLowerCase().includes(val));
        if (matches.length > 0) {
          treksDropdown.innerHTML = matches.map(t => `
            <div class="trek-sugg-item" data-id="${t.id}" data-name="${escapeHtml(t.name)}" data-diff="${escapeHtml(t.difficulty)}" data-alt="${escapeHtml(t.altitude)}">
              <strong>${escapeHtml(t.name)}</strong>
              <span style="font-size: 0.78rem; color: var(--comm-text-muted);">${escapeHtml(t.state)}</span>
            </div>
          `).join('');
          treksDropdown.style.display = 'block';

          treksDropdown.querySelectorAll('.trek-sugg-item').forEach(item => {
            item.addEventListener('click', () => {
              state.createPostData.trek_id = item.getAttribute('data-id');
              state.createPostData.trek_name = item.getAttribute('data-name');
              trekInput.value = '';
              treksDropdown.style.display = 'none';

              const pill = document.getElementById('selectedTrekPill');
              const pillName = document.getElementById('selectedTrekName');
              if (pill && pillName) {
                pillName.textContent = state.createPostData.trek_name;
                pill.style.display = 'inline-flex';
              }
            });
          });
        } else {
          treksDropdown.style.display = 'none';
        }
      });
    }

    document.getElementById('removeSelectedTrekBtn')?.addEventListener('click', () => {
      state.createPostData.trek_id = null;
      state.createPostData.trek_name = '';
      const pill = document.getElementById('selectedTrekPill');
      if (pill) pill.style.display = 'none';
    });

    // Create Modal Navigation
    document.getElementById('createModalNextBtn')?.addEventListener('click', () => {
      if (state.createPostStep === 3) {
        // Collect form data
        state.createPostData.caption = document.getElementById('postCaptionInput')?.value || '';
        state.createPostData.location = document.getElementById('postLocationInput')?.value || '';
        state.createPostData.difficulty = document.getElementById('postDifficultyInput')?.value || 'Moderate';
        state.createPostData.elevation_m = document.getElementById('postElevationInput')?.value || null;
        state.createPostData.duration_days = document.getElementById('postDurationInput')?.value || null;
        state.createPostData.distance_km = document.getElementById('postDistanceInput')?.value || null;
        state.createPostData.hashtags = document.getElementById('postHashtagsInput')?.value || '';
      }
      if (state.createPostStep < 4) {
        state.createPostStep++;
        updateCreatePostStepUI();
      }
    });

    document.getElementById('createModalBackBtn')?.addEventListener('click', () => {
      if (state.createPostStep > 1) {
        state.createPostStep--;
        updateCreatePostStepUI();
      }
    });

    document.getElementById('createModalPublishBtn')?.addEventListener('click', publishNewPost);
    document.getElementById('createModalDraftBtn')?.addEventListener('click', () => {
      showToast('Draft saved to your account. 📝');
      document.getElementById('createPostModalOverlay').style.display = 'none';
    });

    // Profile Modal Close
    document.getElementById('closeProfileModalBtn')?.addEventListener('click', () => {
      document.getElementById('trekkerProfileModalOverlay').style.display = 'none';
    });
    document.getElementById('openMyProfileModalBtn')?.addEventListener('click', () => {
      if (state.currentUser) openTrekkerProfile(state.currentUser.user_id);
    });

    // Search & Notifications Triggers
    document.getElementById('communitySearchTrigger')?.addEventListener('click', openUniversalSearch);
    document.getElementById('universalSearchInput')?.addEventListener('input', (e) => {
      performUniversalSearch(e.target.value);
    });
    document.getElementById('closeSearchModalBtn')?.addEventListener('click', () => {
      document.getElementById('communitySearchModalOverlay').style.display = 'none';
    });

    document.getElementById('notificationBtn')?.addEventListener('click', openNotificationsDrawer);
    document.getElementById('sidebarNotifBtn')?.addEventListener('click', openNotificationsDrawer);
    document.getElementById('closeNotifDrawerBtn')?.addEventListener('click', () => {
      document.getElementById('notifDrawerOverlay').style.display = 'none';
    });
    document.getElementById('btnMarkAllNotifsRead')?.addEventListener('click', async () => {
      await fetch('/api/community/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notification_id: 'all' })
      });
      loadNotificationsCount();
      openNotificationsDrawer();
      showToast('All notifications marked as read.');
    });

    // Filter Chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-filter');
        if (filter === 'all') {
          state.currentTag = null;
        } else {
          state.currentTag = filter;
        }
        loadPosts();
      });
    });

    // Trekker Filters in Directory
    ['trekkerSearchInput', 'trekkerLocationFilter', 'trekkerExpFilter', 'trekkerDiffFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', loadTrekkersDirectory);
      }
    });

    // Share Modal
    document.getElementById('closeShareModalBtn')?.addEventListener('click', () => {
      document.getElementById('shareModalOverlay').style.display = 'none';
    });
    document.getElementById('shareCopyLinkBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard! 🔗');
      document.getElementById('shareModalOverlay').style.display = 'none';
    });
    document.getElementById('shareToMessageBtn')?.addEventListener('click', () => {
      document.getElementById('shareModalOverlay').style.display = 'none';
      const drawer = document.getElementById('messagesDrawerOverlay');
      if (drawer) drawer.style.display = 'flex';
    });
    document.getElementById('shareNativeBtn')?.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'TrekIndia Community Post',
          text: 'Check out this epic trekking expedition on TrekIndia!',
          url: window.location.href
        }).catch(() => {});
      } else {
        showToast('Native share not supported on this browser.');
      }
    });

    // Close Share Trek Picker
    document.getElementById('closeShareTrekModalBtn')?.addEventListener('click', () => {
      document.getElementById('shareTrekModalOverlay').style.display = 'none';
    });
  }

  function handleImageUpload(e) {
    if (e.target.files) handleFiles(e.target.files);
  }

  function handleFiles(files) {
    const previewsGrid = document.getElementById('uploadPreviewsGrid');
    if (!previewsGrid) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        state.createPostData.images.push(base64);

        const thumb = document.createElement('div');
        thumb.className = 'preview-thumb-wrap';
        thumb.innerHTML = `
          <img src="${base64}" />
          <button type="button" class="btn-remove-thumb">&times;</button>
        `;
        thumb.querySelector('.btn-remove-thumb').onclick = () => {
          thumb.remove();
          state.createPostData.images = state.createPostData.images.filter(img => img !== base64);
        };
        previewsGrid.appendChild(thumb);
      };
      reader.readAsDataURL(file);
    });
  }

  function switchCommunityTab(tab, btnEl) {
    state.currentTab = tab;
    state.currentTag = null;

    document.querySelectorAll('.comm-nav-item').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const viewTitle = document.getElementById('currentViewTitle');
    const postsStream = document.getElementById('postsStream');
    const trekkersView = document.getElementById('trekkersView');
    const filterBar = document.getElementById('feedFilterBar');

    const titles = {
      'feed': 'Trail Feed',
      'explore': 'Explore Mountain Adventures',
      'trending': 'Trending Trail Stories 🔥',
      'following': 'From Trekkers You Follow',
      'my-treks': 'My Shared Expeditions',
      'saved': 'Saved Adventures 🔖',
      'trekkers': 'Find Trekkers Directory'
    };

    if (viewTitle) viewTitle.textContent = titles[tab] || 'Trail Feed';

    if (tab === 'trekkers') {
      if (postsStream) postsStream.style.display = 'none';
      if (filterBar) filterBar.style.display = 'none';
      if (trekkersView) trekkersView.style.display = 'flex';
      loadTrekkersDirectory();
    } else {
      if (trekkersView) trekkersView.style.display = 'none';
      if (postsStream) postsStream.style.display = 'flex';
      if (filterBar) filterBar.style.display = 'flex';
      loadPosts();
    }
  }

  function openShareModal(postId) {
    const modal = document.getElementById('shareModalOverlay');
    if (modal) modal.style.display = 'flex';
  }

  function openShareTrekPickerModal() {
    const modal = document.getElementById('shareTrekModalOverlay');
    const list = document.getElementById('shareTreksList');
    if (!modal || !list) return;

    modal.style.display = 'flex';

    list.innerHTML = state.availableTreks.map(t => `
      <div class="share-trek-item" style="padding: 12px 14px; border-bottom: 1px solid var(--comm-border); display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onmouseover="this.style.background='var(--comm-surface-secondary)'" onmouseout="this.style.background='transparent'">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${escapeHtml(t.image)}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
          <div>
            <strong>${escapeHtml(t.name)}</strong>
            <div style="font-size: 0.78rem; color: var(--comm-text-muted);">${escapeHtml(t.altitude)} • ${escapeHtml(t.difficulty)} • ${escapeHtml(t.duration)}</div>
          </div>
        </div>
        <button class="btn-select-share-trek" style="padding: 6px 12px; background: var(--comm-forest); color: #fff; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">Send</button>
      </div>
    `).join('');

    list.querySelectorAll('.share-trek-item').forEach((item, idx) => {
      item.addEventListener('click', () => {
        const trek = state.availableTreks[idx];
        modal.style.display = 'none';
        sendChatMessage({
          message_type: 'trek_card',
          trek_data: trek
        });
      });
    });
  }

  function showPostOptionsMenu(postId, anchorBtn) {
    let menu = document.getElementById('post-floating-menu');
    if (menu) menu.remove();

    menu = document.createElement('div');
    menu.id = 'post-floating-menu';
    menu.style.cssText = `
      position: absolute;
      top: ${anchorBtn.getBoundingClientRect().bottom + window.scrollY + 6}px;
      left: ${anchorBtn.getBoundingClientRect().right - 160}px;
      background: var(--comm-card-bg);
      border: 1px solid var(--comm-border);
      border-radius: var(--comm-radius-md);
      box-shadow: var(--comm-shadow-md);
      padding: 6px;
      z-index: 1000;
      width: 160px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;

    menu.innerHTML = `
      <button style="padding: 8px 12px; text-align: left; font-size: 0.85rem; font-weight: 600; color: var(--comm-text-primary); border-radius: 6px; cursor: pointer;" onmouseover="this.style.background='var(--comm-surface-secondary)'" onmouseout="this.style.background='transparent'" id="menuOptionCopy">🔗 Copy Link</button>
      <button style="padding: 8px 12px; text-align: left; font-size: 0.85rem; font-weight: 600; color: var(--comm-text-primary); border-radius: 6px; cursor: pointer;" onmouseover="this.style.background='var(--comm-surface-secondary)'" onmouseout="this.style.background='transparent'" id="menuOptionShare">↗️ Share</button>
      <button style="padding: 8px 12px; text-align: left; font-size: 0.85rem; font-weight: 600; color: #ef4444; border-radius: 6px; cursor: pointer;" onmouseover="this.style.background='rgba(239, 68, 68, 0.08)'" onmouseout="this.style.background='transparent'" id="menuOptionReport">⚠️ Report</button>
    `;

    document.body.appendChild(menu);

    document.getElementById('menuOptionCopy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(`${window.location.origin}/community#post-${postId}`);
      showToast('Post link copied!');
      menu.remove();
    });

    document.getElementById('menuOptionShare')?.addEventListener('click', () => {
      menu.remove();
      openShareModal(postId);
    });

    document.getElementById('menuOptionReport')?.addEventListener('click', () => {
      showToast('Thank you. Our safety team will review this report.');
      menu.remove();
    });

    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== anchorBtn) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 10);
  }

  function filterByTag(tag) {
    state.currentTag = tag;
    loadPosts();
    showToast(`Filtering by #${tag}`);
  }

  function showToast(msg) {
    const toast = document.getElementById('communityToast');
    const text = document.getElementById('toastMessage');
    if (!toast || !text) return;

    text.textContent = msg;
    toast.style.display = 'flex';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // ─── GLOBAL BRIDGE METHODS ──────────────────────────────────────────────────
  window.TrekIndiaCommunity = {
    viewRoute: (slug) => {
      window.location.href = `trek-detail.html?slug=${slug}`;
    },
    viewTrekDetails: (slug) => {
      window.location.href = `trek-detail.html?slug=${slug}`;
    },
    openProfile: (userId) => {
      openTrekkerProfile(userId);
    },
    filterTag: (tag) => {
      filterByTag(tag);
    }
  };

  // Start on load
  document.addEventListener('DOMContentLoaded', init);
})();
