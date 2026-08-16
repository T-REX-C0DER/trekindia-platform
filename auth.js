/* ==========================================================================
   TREKINDIA — INTERACTIVE AUTHENTICATION APPLICATION ENGINE
   Features: 7-Screen Routing, Dynamic Tab Sliding Indicator, Full Canvas Particles,
   Cursor-Tracking Aurora Glow Orb, Password Strength Calculator, 6-Digit OTP,
   3D Card Parallax Tilt & Theme Toggle
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. STATE & ROUTING ENGINE ──────────────────────────────────────────
  const views = document.querySelectorAll('.auth-view');
  const tabsNav = document.getElementById('auth-tabs-nav');
  const tabButtons = document.querySelectorAll('.auth-tab-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  // Dynamic headlines per view
  const heroContentMap = {
    'login': {
      badge: 'EXPLORE THE HIMALAYAS',
      headline: 'Welcome Back, Explorer.',
      subheading: 'Continue discovering India\'s most breathtaking trekking experiences, high-altitude passes, and alpine wilderness.'
    },
    'signup': {
      badge: 'JOIN THE ADVENTURE',
      headline: 'Begin Your Ascent.',
      subheading: 'Create an explorer account to unlock exclusive high-altitude trails, expedition planning & expert guides.'
    },
    'forgot-password': {
      badge: 'ACCOUNT RECOVERY',
      headline: 'Recover Your Key.',
      subheading: 'Enter your registered email and we\'ll dispatch a secure password reset link to your inbox.'
    },
    'email-sent': {
      badge: 'INBOX VERIFICATION',
      headline: 'Check Your Inbox.',
      subheading: 'A secure password reset link has been dispatched. Please check your inbox and spam folder.'
    },
    'reset-password': {
      badge: 'SECURITY RESET',
      headline: 'Set New Password.',
      subheading: 'Choose a strong, unique password to safeguard your TrekIndia explorer profile.'
    },
    'verify-email': {
      badge: 'IDENTITY CONFIRMATION',
      headline: 'Verify Your Email.',
      subheading: 'Enter the 6-digit verification code sent to your email address to complete registration.'
    },
    'success': {
      badge: 'JOURNEY READY',
      headline: 'Password Updated!',
      subheading: 'Your credentials have been updated successfully. Your next Himalayan adventure awaits.'
    }
  };

  function navigateToView(viewId) {
    if (!viewId) viewId = 'login';

    // Hide all views
    views.forEach(v => v.classList.remove('active'));

    // Show target view
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
      targetView.classList.add('active');
    } else {
      const fallback = document.getElementById('view-login');
      if (fallback) fallback.classList.add('active');
      viewId = 'login';
    }

    // Toggle Tab Bar Visibility (Only visible for login & signup)
    if (tabsNav) {
      if (viewId === 'login' || viewId === 'signup') {
        tabsNav.style.display = 'flex';
        tabsNav.setAttribute('data-active-tab', viewId);
        
        tabButtons.forEach(btn => {
          if (btn.getAttribute('data-tab') === viewId) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      } else {
        tabsNav.style.display = 'none';
      }
    }

    // Sync URL hash without triggering page jump
    if (window.location.hash !== `#${viewId}`) {
      history.pushState(null, null, `#${viewId}`);
    }

    // Update Hero Content dynamically
    updateHeroText(viewId);
  }

  // Check for Community Redirect Notice
  function checkCommunityNotice() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    const message = params.get('message');
    if (redirect === '/community' || message === 'community_required') {
      const cardHeader = document.querySelector('.card-hero-header');
      if (cardHeader && !document.getElementById('community-auth-banner')) {
        const banner = document.createElement('div');
        banner.id = 'community-auth-banner';
        banner.style.cssText = 'background: rgba(40, 93, 42, 0.18); border: 1px solid rgba(72, 187, 120, 0.4); color: #72D572; padding: 14px 18px; border-radius: 14px; font-size: 0.88rem; margin: 12px 0 18px; line-height: 1.5; text-align: left; display: flex; align-items: flex-start; gap: 10px; backdrop-filter: blur(8px);';
        banner.innerHTML = `
          <span style="font-size: 1.25rem; line-height: 1;">🏔️</span>
          <div>
            <strong style="display: block; font-size: 0.92rem; color: #fff; margin-bottom: 2px;">Join the TrekIndia Community</strong>
            <span>Sign in or register to connect with trekkers, share high-altitude expeditions, and access private routes.</span>
          </div>
        `;
        cardHeader.appendChild(banner);
      }
    }
  }
  checkCommunityNotice();

  function updateHeroText(viewId) {
    const config = heroContentMap[viewId] || heroContentMap['login'];
    const badgeEl = document.querySelector('.hero-badge-text');
    const headlineEl = document.querySelector('.hero-headline');
    const subheadingEl = document.querySelector('.hero-subheading');

    if (badgeEl) badgeEl.textContent = config.badge;
    if (headlineEl) headlineEl.textContent = config.headline;
    if (subheadingEl) subheadingEl.textContent = config.subheading;
  }

  // Handle URL Hash on initial load & hashchange
  function handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      navigateToView(hash);
    } else {
      navigateToView('login');
    }
  }

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();

  // Intercept data-navigate links & buttons
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-navigate]');
    if (link) {
      e.preventDefault();
      const targetView = link.getAttribute('data-navigate');
      navigateToView(targetView);
    }
  });

  // ─── 2. DARK / LIGHT THEME TOGGLE ──────────────────────────────────────
  const BrandLogoSystem = {
    lightAssetSrc: 'whitebg_logo_processed.png',
    darkAssetSrc: 'darkbg_logo_processed.png',

    init() {
      this.applyProcessedImages();
    },

    applyProcessedImages() {
      document.querySelectorAll('.brand-icon-img.light-icon').forEach(img => {
        img.src = this.lightAssetSrc;
        img.classList.add('transparent-loaded');
      });
      document.querySelectorAll('.brand-icon-img.dark-icon').forEach(img => {
        img.src = this.darkAssetSrc;
        img.classList.add('transparent-loaded');
      });
    }
  };

  BrandLogoSystem.init();

  const savedTheme = localStorage.getItem('trekindia_theme') || 'light';
  setTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('trekindia_theme', theme);
    
    if (themeIcon) {
      if (theme === 'dark') {
        themeIcon.setAttribute('data-lucide', 'sun');
      } else {
        themeIcon.setAttribute('data-lucide', 'moon');
      }
      if (window.lucide) lucide.createIcons();
    }
  }

  // ─── 3. PASSWORD VISIBILITY TOGGLE ────────────────────────────────────
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling.tagName === 'INPUT' 
        ? btn.previousElementSibling 
        : btn.closest('.input-floating-wrapper').querySelector('input');
      
      if (!input) return;

      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');

      const icon = btn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide) lucide.createIcons();
      }
    });
  });

  // ─── 4. REAL-TIME PASSWORD STRENGTH CALCULATOR ────────────────────────
  function setupPasswordValidator(inputId, barId, textId, checklistContainerId) {
    const input = document.getElementById(inputId);
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    const container = document.getElementById(checklistContainerId);

    if (!input) return;

    const reqLength = container ? container.querySelector('[data-rule="length"]') : null;
    const reqUpper = container ? container.querySelector('[data-rule="uppercase"]') : null;
    const reqLower = container ? container.querySelector('[data-rule="lowercase"]') : null;
    const reqNumber = container ? container.querySelector('[data-rule="number"]') : null;
    const reqSpecial = container ? container.querySelector('[data-rule="special"]') : null;

    input.addEventListener('input', () => {
      const val = input.value;

      // Rules evaluation
      const isLength = val.length >= 8;
      const isUpper = /[A-Z]/.test(val);
      const isLower = /[a-z]/.test(val);
      const isNumber = /[0-9]/.test(val);
      const isSpecial = /[^A-Za-z0-9]/.test(val);

      // Update checklist icons
      toggleRule(reqLength, isLength);
      toggleRule(reqUpper, isUpper);
      toggleRule(reqLower, isLower);
      toggleRule(reqNumber, isNumber);
      toggleRule(reqSpecial, isSpecial);

      // Score calculation
      const score = [isLength, isUpper, isLower, isNumber, isSpecial].filter(Boolean).length;

      if (!bar || !text) return;

      bar.className = 'strength-bar-fill';
      text.className = 'strength-badge';

      if (val.length === 0) {
        bar.style.width = '0%';
        text.textContent = 'None';
      } else if (score <= 2) {
        bar.classList.add('weak');
        text.classList.add('weak');
        text.textContent = 'Weak';
      } else if (score === 3 || score === 4) {
        bar.classList.add('fair');
        text.classList.add('fair');
        text.textContent = 'Fair';
      } else if (score === 5) {
        bar.classList.add('strong');
        text.classList.add('strong');
        text.textContent = 'Strong';
      }
    });
  }

  function toggleRule(element, isMet) {
    if (!element) return;
    if (isMet) {
      element.classList.add('met');
      const icon = element.querySelector('.requirement-icon');
      if (icon) icon.innerHTML = '✓';
    } else {
      element.classList.remove('met');
      const icon = element.querySelector('.requirement-icon');
      if (icon) icon.innerHTML = '';
    }
  }

  setupPasswordValidator('signup-password', 'signup-strength-bar', 'signup-strength-text', 'signup-checklist');
  setupPasswordValidator('reset-password-input', 'reset-strength-bar', 'reset-strength-text', 'reset-checklist');

  // ─── 5. 6-DIGIT OTP INPUT CODE BOXES ───────────────────────────────────
  const otpBoxes = document.querySelectorAll('.otp-box');
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value.length >= 1) {
        box.value = value.charAt(value.length - 1);
        if (idx < otpBoxes.length - 1) {
          otpBoxes[idx + 1].focus();
        }
      }
      checkOtpComplete();
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        otpBoxes[idx - 1].focus();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasted)) {
        pasted.split('').forEach((char, i) => {
          if (otpBoxes[i]) otpBoxes[i].value = char;
        });
        otpBoxes[otpBoxes.length - 1].focus();
        checkOtpComplete();
      }
    });
  });

  function checkOtpComplete() {
    const code = Array.from(otpBoxes).map(b => b.value).join('');
    const btn = document.getElementById('btn-verify-otp');
    if (btn) {
      btn.disabled = code.length !== 6;
    }
  }

  // OTP Countdown Timer
  let otpTimerSeconds = 59;
  const timerDisplay = document.getElementById('resend-timer-display');
  const resendBtn = document.getElementById('btn-resend-otp');

  if (timerDisplay && resendBtn) {
    const countdown = setInterval(() => {
      if (otpTimerSeconds > 0) {
        otpTimerSeconds--;
        timerDisplay.textContent = `0:${otpTimerSeconds < 10 ? '0' : ''}${otpTimerSeconds}`;
      } else {
        clearInterval(countdown);
        timerDisplay.textContent = '';
        resendBtn.disabled = false;
      }
    }, 1000);

    resendBtn.addEventListener('click', () => {
      otpTimerSeconds = 59;
      resendBtn.disabled = true;
      alert('Verification code resent to your email!');
    });
  }

  // ─── 6. BUTTON RIPPLE EFFECT & FORM SUBMISSIONS ────────────────────────
  document.querySelectorAll('.btn-cta-primary').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const circle = document.createElement('span');
      const diameter = Math.max(btn.clientWidth, btn.clientHeight);
      const radius = diameter / 2;
      const rect = btn.getBoundingClientRect();

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.classList.add('ripple-effect');

      const ripple = btn.querySelector('.ripple-effect');
      if (ripple) ripple.remove();

      btn.appendChild(circle);
    });
  });

  function showFormError(form, message) {
    let errorBox = form.querySelector('.auth-error-banner');
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.className = 'auth-error-banner';
      errorBox.style.cssText = 'background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: #ef4444; padding: 12px 16px; border-radius: 12px; font-size: 0.85rem; margin-bottom: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(10px);';
      form.insertBefore(errorBox, form.firstChild);
    }
    errorBox.innerHTML = `<span style="font-size: 1.1rem; line-height: 1;">⚠️</span> <span>${message}</span>`;
    errorBox.style.display = 'flex';
  }

  function clearFormError(form) {
    const errorBox = form.querySelector('.auth-error-banner');
    if (errorBox) {
      errorBox.style.display = 'none';
      errorBox.innerHTML = '';
    }
  }

  // Real Login Handler
  const loginForm = document.getElementById('form-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormError(loginForm);

      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        showFormError(loginForm, 'Please enter both your email address and password.');
        return;
      }

      const submitBtn = loginForm.querySelector('.btn-cta-primary');
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || 'index.html';
          window.location.href = redirectUrl;
        } else {
          showFormError(loginForm, data.message || 'Invalid email or password.');
        }
      } catch (err) {
        showFormError(loginForm, 'Network error. Unable to reach server. Please check your connection.');
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
      }
    });
  }

  // Real Signup Handler
  const signupForm = document.getElementById('form-signup');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormError(signupForm);

      const firstNameEl = document.getElementById('signup-firstname');
      const lastNameEl = document.getElementById('signup-lastname');
      const usernameEl = document.getElementById('signup-username');
      const emailEl = document.getElementById('signup-email');
      const passwordEl = document.getElementById('signup-password');

      const firstName = firstNameEl ? firstNameEl.value.trim() : '';
      const lastName = lastNameEl ? lastNameEl.value.trim() : '';
      const fullName = `${firstName} ${lastName}`.trim();
      const username = usernameEl ? usernameEl.value.trim() : '';
      const email = emailEl ? emailEl.value.trim() : '';
      const password = passwordEl ? passwordEl.value : '';

      if (!fullName || !username || !email || !password) {
        showFormError(signupForm, 'Please fill in all required fields.');
        return;
      }

      const submitBtn = signupForm.querySelector('.btn-cta-primary');
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            full_name: fullName,
            username,
            email,
            password,
            confirm_password: password
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || 'index.html';
          window.location.href = redirectUrl;
        } else {
          showFormError(signupForm, data.message || 'Registration failed.');
        }
      } catch (err) {
        showFormError(signupForm, 'Network error. Unable to reach server. Please check your connection.');
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
      }
    });
  }

  // Simulated handlers for non-auth forms (Forgot Password / Password Reset)
  ['form-forgot', 'form-reset'].forEach((formId) => {
    const form = document.getElementById(formId);
    if (!form) return;
    const nextViewMap = { 'form-forgot': 'email-sent', 'form-reset': 'success' };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.btn-cta-primary');
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;

        setTimeout(() => {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
          if (nextViewMap[formId]) {
            navigateToView(nextViewMap[formId]);
          }
        }, 1000);
      }
    });
  });

  // Verify OTP button simulation
  const verifyBtn = document.getElementById('btn-verify-otp');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', () => {
      verifyBtn.classList.add('is-loading');
      verifyBtn.disabled = true;
      setTimeout(() => {
        verifyBtn.classList.remove('is-loading');
        verifyBtn.disabled = false;
        navigateToView('success');
      }, 1000);
    });
  }

  // ─── 7. ANIMATED PARTICLES CANVAS FOR AURORA STARS & SNOW DUST ─────────
  const canvas = document.getElementById('particles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    const particleCount = 70;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = Math.random() * 2 + 0.5;
        this.opacity = Math.random() * 0.7 + 0.2;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = -Math.random() * 0.45 - 0.15; // Upward ambient drift
        // Color variation between emerald glow and white stars
        this.isEmerald = Math.random() > 0.65;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.y < 0 || this.x < 0 || this.x > canvas.width) {
          this.reset();
          this.y = canvas.height;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        if (this.isEmerald) {
          ctx.fillStyle = `rgba(52, 211, 153, ${this.opacity})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        }
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animateParticles);
    }

    animateParticles();
  }

  // ─── 8. CURSOR FOLLOW GLOW ORB & 3D CARD PARALLAX ──────────────────────
  const cursorOrb = document.getElementById('cursor-glow-orb');
  const authCard = document.getElementById('auth-glass-card');
  const bgImage = document.querySelector('.bg-mountain-image');

  document.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;

    // Position cursor glow orb smoothly
    if (cursorOrb) {
      cursorOrb.style.left = `${clientX}px`;
      cursorOrb.style.top = `${clientY}px`;
    }

    // Subtle 3D card tilt & shadow shift
    if (authCard) {
      const xPercent = (clientX / window.innerWidth - 0.5);
      const yPercent = (clientY / window.innerHeight - 0.5);

      const rotateX = yPercent * -6;
      const rotateY = xPercent * 6;
      authCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      if (bgImage) {
        bgImage.style.transform = `scale(1.06) translate(${xPercent * -18}px, ${yPercent * -18}px)`;
      }
    }
  });

  document.addEventListener('mouseleave', () => {
    if (authCard) {
      authCard.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    }
    if (bgImage) {
      bgImage.style.transform = `scale(1.04) translate(0px, 0px)`;
    }
  });
});
