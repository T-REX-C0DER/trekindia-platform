/**
 * TrekIndia — Reusable Frontend Auth Utility
 * Automatically verifies user session status on page load and manages UI navbar
 */

(function () {
  let currentUser = null;

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
          updateNavbarUI(currentUser);
          return currentUser;
        }
      }
    } catch (err) {
      console.warn('Auth check could not reach backend:', err.message);
    }
    currentUser = null;
    updateNavbarUI(null);
    return null;
  }

  function updateNavbarUI(user) {
    const profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) return;

    if (user) {
      profileBtn.setAttribute('title', `Logged in as ${user.full_name} (${user.username})`);
      profileBtn.setAttribute('aria-label', `Profile: ${user.full_name}`);
      
      // Replace profile icon with user initial avatar or badge if authenticated
      const initial = (user.full_name || user.username || 'U').charAt(0).toUpperCase();
      profileBtn.innerHTML = `
        <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #708238, #556B2F); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
          ${initial}
        </div>
      `;

      // Setup click handler for logout popup / profile menu
      profileBtn.onclick = function (e) {
        e.preventDefault();
        showUserAccountMenu(profileBtn, user);
      };
    } else {
      profileBtn.setAttribute('title', 'Sign In / Register');
      profileBtn.setAttribute('aria-label', 'User profile');
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
      width: 220px;
      background: var(--card-bg, #ffffff);
      border: 1px solid var(--border, rgba(0,0,0,0.1));
      box-shadow: 0 12px 32px rgba(0,0,0,0.15);
      border-radius: 12px;
      padding: 12px;
      z-index: 9999;
      font-family: 'Inter', sans-serif;
      animation: fadeInDown 0.2s ease-out;
    `;

    menu.innerHTML = `
      <div style="padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(128,128,128,0.2);">
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-heading, #111); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(user.full_name)}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted, #666); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(user.email)}</div>
      </div>
      <button id="btn-logout-dropdown" style="width: 100%; padding: 8px 12px; background: rgba(220, 53, 69, 0.1); border: 1px solid rgba(220, 53, 69, 0.2); color: #dc3545; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
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

  document.addEventListener('DOMContentLoaded', checkAuthStatus);

  window.TrekIndiaAuth = {
    checkAuthStatus,
    getUser: () => currentUser
  };
})();
