/**
 * TrekIndia — Reusable Frontend Auth Utility
 * Automatically verifies user session status on page load and manages UI navbar
 */

(function () {
  let currentUser = null;
  let authCheckPromise = null; // Store pending auth promise to avoid race conditions

  const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/adventurer/svg?seed=trekindia&backgroundColor=2d6a4f';

  async function checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.authenticated && data.user) {
          currentUser = data.user;
          try {
            localStorage.setItem('trekindia_cached_user', JSON.stringify(currentUser));
          } catch (_) {}
          updateNavbarUI(currentUser);
          return currentUser;
        }
      }
    } catch (err) {
      console.warn('Auth check could not reach backend:', err.message);
    }
    currentUser = null;
    try {
      localStorage.removeItem('trekindia_cached_user');
    } catch (_) {}
    updateNavbarUI(null);
    return null;
  }

  function updateNavbarUI(user) {
    const profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) return;

    if (user) {
      profileBtn.setAttribute('title', `Logged in as ${user.full_name || user.username} (@${user.username})`);
      profileBtn.setAttribute('aria-label', `Profile: ${user.full_name || user.username}`);
      
      const initial = (user.full_name || user.username || 'U').charAt(0).toUpperCase();

      if (user.profile_image) {
        profileBtn.innerHTML = `
          <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; border: 2px solid #285D2A; box-shadow: 0 2px 6px rgba(0,0,0,0.12); display: flex; align-items: center; justify-content: center; background: #f0f4f1;">
            <img src="${escapeHtml(user.profile_image)}" alt="${escapeHtml(user.full_name || user.username)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;background:linear-gradient(135deg, #708238, #556B2F);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;\\'>${initial}</div>';" />
          </div>
        `;
      } else {
        profileBtn.innerHTML = `
          <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #708238, #556B2F); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 2px 6px rgba(0,0,0,0.12);">
            ${initial}
          </div>
        `;
      }

      // Setup click handler for logout popup / profile menu
      profileBtn.onclick = function (e) {
        e.preventDefault();
        showUserAccountMenu(profileBtn, user);
      };
    } else {
      profileBtn.setAttribute('title', 'Sign In / Register');
      profileBtn.setAttribute('aria-label', 'User profile');
      profileBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      `;
      profileBtn.onclick = null; // Default link to auth.html
    }
  }

  function showUserAccountMenu(anchorEl, user) {
    let menu = document.getElementById('user-account-dropdown');
    if (menu) {
      menu.remove();
      return;
    }

    menu = document.createElement('div');
    menu.id = 'user-account-dropdown';
    menu.style.cssText = `
      position: absolute;
      top: 60px;
      right: 20px;
      width: 230px;
      background: var(--card-bg, #ffffff);
      border: 1px solid var(--border, rgba(0,0,0,0.1));
      box-shadow: 0 12px 32px rgba(0,0,0,0.15);
      border-radius: 14px;
      padding: 12px;
      z-index: 9999;
      font-family: 'Inter', sans-serif;
      animation: fadeInDown 0.2s ease-out;
    `;

    const avatarHtml = user.profile_image
      ? `<img src="${escapeHtml(user.profile_image)}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #285D2A;" onerror="this.src='${DEFAULT_AVATAR}'" />`
      : `<div style="width: 38px; height: 38px; border-radius: 50%; background: #285D2A; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem;">
          ${(user.full_name || user.username || 'U').charAt(0).toUpperCase()}
        </div>`;

    menu.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 10px; margin-bottom: 8px; border-bottom: 1px solid #E1E7E2;">
        ${avatarHtml}
        <div style="min-width: 0;">
          <div style="font-weight: 700; font-size: 0.9rem; color: #17231A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(user.full_name || user.username)}</div>
          <div style="font-size: 0.75rem; color: #6B766F; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">@${escapeHtml(user.username)}</div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #E1E7E2;">
        <a href="/profile#overview" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 0.85rem; font-weight: 500; color: #17231A; text-decoration: none; border-radius: 8px; transition: background 0.15s;" onmouseover="this.style.background='#F5F8F6'" onmouseout="this.style.background='transparent'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#285D2A" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Profile Dashboard
        </a>
        <a href="/profile#treks" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 0.85rem; font-weight: 500; color: #17231A; text-decoration: none; border-radius: 8px; transition: background 0.15s;" onmouseover="this.style.background='#F5F8F6'" onmouseout="this.style.background='transparent'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#285D2A" stroke-width="2"><path d="M8 3l4 8 5-5 4 15H3L8 3z"></path></svg>
          My Treks
        </a>
        <a href="/profile#saved" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 0.85rem; font-weight: 500; color: #17231A; text-decoration: none; border-radius: 8px; transition: background 0.15s;" onmouseover="this.style.background='#F5F8F6'" onmouseout="this.style.background='transparent'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#285D2A" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          Saved Treks
        </a>
        <a href="/profile#badges" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 0.85rem; font-weight: 500; color: #17231A; text-decoration: none; border-radius: 8px; transition: background 0.15s;" onmouseover="this.style.background='#F5F8F6'" onmouseout="this.style.background='transparent'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C8A65A" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
          Badges & Achievements
        </a>
        <a href="/profile#settings" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 0.85rem; font-weight: 500; color: #17231A; text-decoration: none; border-radius: 8px; transition: background 0.15s;" onmouseover="this.style.background='#F5F8F6'" onmouseout="this.style.background='transparent'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B766F" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Settings
        </a>
      </div>
      <button id="btn-logout-dropdown" style="width: 100%; padding: 8px 12px; background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.2); color: #dc3545; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s;" onmouseover="this.style.background='rgba(220, 53, 69, 0.15)'" onmouseout="this.style.background='rgba(220, 53, 69, 0.08)'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        Log Out
      </button>
    `;

    document.body.appendChild(menu);

    const logoutBtn = document.getElementById('btn-logout-dropdown');
    if (logoutBtn) {
      logoutBtn.onclick = async function () {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          });
        } catch (err) {
          console.error('Logout request failed:', err);
        }
        menu.remove();
        window.location.reload();
      };
    }

    // Close on outside click
    function onOutsideClick(e) {
      if (!menu.contains(e.target) && !anchorEl.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', onOutsideClick);
      }
    }
    setTimeout(() => document.addEventListener('click', onOutsideClick), 10);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  function updateCurrentUser(updatedUser) {
    if (!updatedUser) return;
    currentUser = { ...(currentUser || {}), ...updatedUser };
    try {
      localStorage.setItem('trekindia_cached_user', JSON.stringify(currentUser));
    } catch (_) {}
    updateNavbarUI(currentUser);
    window.dispatchEvent(new CustomEvent('trekindia:user-updated', { detail: currentUser }));
  }

  function initCommunityLinkGuards() {
    document.addEventListener('click', (e) => {
      const commLink = e.target.closest('a[href="/community"], a[href="community.html"], a[href="#community"]');
      if (!commLink) return;

      // If already on /community, allow normal browser navigation
      if (window.location.pathname === '/community' || window.location.pathname.endsWith('community.html')) {
        return;
      }

      // Intercept click to await auth resolution
      e.preventDefault();

      const resolveAndNavigate = async () => {
        try {
          if (authCheckPromise) {
            await authCheckPromise;
          }
        } catch (_) {}

        if (!currentUser) {
          window.location.href = 'auth.html?redirect=/community&message=community_required';
        } else {
          window.location.href = '/community';
        }
      };

      resolveAndNavigate();
    });
  }

  // Cross-tab and in-page user update listeners
  window.addEventListener('storage', (e) => {
    if (e.key === 'trekindia_cached_user') {
      try {
        const u = JSON.parse(e.newValue);
        if (u) {
          currentUser = u;
          updateNavbarUI(currentUser);
          window.dispatchEvent(new CustomEvent('trekindia:user-updated', { detail: currentUser }));
        }
      } catch (_) {}
    }
  });

  window.addEventListener('trekindia:user-updated', (e) => {
    if (e.detail) {
      currentUser = { ...(currentUser || {}), ...e.detail };
      updateNavbarUI(currentUser);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    authCheckPromise = checkAuthStatus();
    initCommunityLinkGuards();
  });

  window.TrekIndiaAuth = {
    checkAuthStatus,
    getUser: () => currentUser,
    updateCurrentUser,
    getAvatarUrl: (user) => (user && user.profile_image) ? user.profile_image : DEFAULT_AVATAR
  };
})();
