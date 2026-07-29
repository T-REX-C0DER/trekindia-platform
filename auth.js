/* ==========================================================================
   TREKINDIA — INTERACTIVE AUTHENTICATION APPLICATION ENGINE
   Features: 7-Screen Routing, Live Password Strength Calculator, 6-Digit OTP,
   Background Particles Canvas, Parallax, Micro-interactions & Theme Switching
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. STATE & ROUTING ENGINE ──────────────────────────────────────────
  const views = document.querySelectorAll('.auth-view');
  const screenSwitcher = document.getElementById('screen-switcher');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  // Hero section dynamic headlines per view
  const heroContentMap = {
    'login': {
      badge: 'EXPLORE THE HIMALAYAS',
      headline: 'Welcome Back, Explorer.',
      subheading: 'Continue discovering India\'s most breathtaking trekking experiences.'
    },
    'signup': {
      badge: 'JOIN THE ADVENTURE',
      headline: 'Begin Your Ascent.',
      subheading: 'Create an account to unlock exclusive high-altitude trails & expert guides.'
    },
    'forgot-password': {
      badge: 'ACCOUNT RECOVERY',
      headline: 'Recover Your Key.',
      subheading: 'We will send a secure link to reset your TrekIndia account password.'
    },
    'email-sent': {
      badge: 'INBOX VERIFICATION',
      headline: 'Check Your Inbox.',
      subheading: 'A password reset link has been dispatched to your email address.'
    },
    'reset-password': {
      badge: 'SECURITY RESET',
      headline: 'Set New Password.',
      subheading: 'Choose a strong, unique password to safeguard your account.'
    },
    'verify-email': {
      badge: 'IDENTITY CONFIRMATION',
      headline: 'Verify Your Email.',
      subheading: 'Enter the 6-digit code sent to your email to complete registration.'
    },
    'success': {
      badge: 'JOURNEY READY',
      headline: 'Password Updated!',
      subheading: 'Your credentials have been updated successfully. Adventure awaits.'
    }
  };

  function navigateToView(viewId) {
    if (!viewId) viewId = 'login';
    
    // Hide all views
    views.forEach(v => v.classList.remove('active'));

    // Target view
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
      targetView.classList.add('active');
    } else {
      const fallback = document.getElementById('view-login');
      if (fallback) fallback.classList.add('active');
      viewId = 'login';
    }

    // Sync select dropdown if available
    if (screenSwitcher) {
      screenSwitcher.value = viewId;
    }

    // Sync URL hash without triggering scroll jump
    if (window.location.hash !== `#${viewId}`) {
      history.pushState(null, null, `#${viewId}`);
    }

    // Update Left Panel Content dynamically
    updateHeroText(viewId);
  }

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

  // Screen Switcher Dropdown Listener
  if (screenSwitcher) {
    screenSwitcher.addEventListener('change', (e) => {
      navigateToView(e.target.value);
    });
  }

  // Intercept data-navigate links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-navigate]');
    if (link) {
      e.preventDefault();
      const targetView = link.getAttribute('data-navigate');
      navigateToView(targetView);
    }
  });

  // ─── 2. DARK / LIGHT THEME TOGGLE ──────────────────────────────────────
  /* ─── TREKINDIA BRAND LOGO SYSTEM ─────────────────────────── */
  const BrandLogoSystem = {
    lightAssetSrc: 'whitebg_logo_processed.jpg',
    darkAssetSrc: 'darkbg_logo_processed.jpg',
    processedLightDataUrl: null,
    processedDarkDataUrl: null,

    init() {
      this.preloadAndProcessAssets();
    },

    preloadAndProcessAssets() {
      this.removeWhiteBackground(this.lightAssetSrc, (dataUrl) => {
        this.processedLightDataUrl = dataUrl;
        this.applyProcessedImages();
      });

      this.removeWhiteBackground(this.darkAssetSrc, (dataUrl) => {
        this.processedDarkDataUrl = dataUrl;
        this.applyProcessedImages();
      });
    },

    removeWhiteBackground(src, callback) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          const queue = [];
          const visited = new Uint8Array(w * h);

          const isWhite = (idx) => {
            return data[idx] > 230 && data[idx + 1] > 230 && data[idx + 2] > 230;
          };

          for (let x = 0; x < w; x++) {
            let idxTop = (0 * w + x) * 4;
            let idxBot = ((h - 1) * w + x) * 4;
            if (isWhite(idxTop) && !visited[0 * w + x]) {
              queue.push(x, 0);
              visited[0 * w + x] = 1;
            }
            if (isWhite(idxBot) && !visited[(h - 1) * w + x]) {
              queue.push(x, h - 1);
              visited[(h - 1) * w + x] = 1;
            }
          }

          for (let y = 0; y < h; y++) {
            let idxLeft = (y * w + 0) * 4;
            let idxRight = (y * w + (w - 1)) * 4;
            if (isWhite(idxLeft) && !visited[y * w + 0]) {
              queue.push(0, y);
              visited[y * w + 0] = 1;
            }
            if (isWhite(idxRight) && !visited[y * w + (w - 1)]) {
              queue.push(w - 1, y);
              visited[y * w + (w - 1)] = 1;
            }
          }

          let head = 0;
          while (head < queue.length) {
            const cx = queue[head++];
            const cy = queue[head++];
            const pIdx = (cy * w + cx) * 4;
            data[pIdx + 3] = 0;

            const neighbors = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1]
            ];
            for (let i = 0; i < neighbors.length; i++) {
              const nx = neighbors[i][0];
              const ny = neighbors[i][1];
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const vIdx = ny * w + nx;
                if (!visited[vIdx]) {
                  const nIdx = (ny * w + nx) * 4;
                  if (isWhite(nIdx)) {
                    visited[vIdx] = 1;
                    queue.push(nx, ny);
                  }
                }
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          callback(canvas.toDataURL('image/png'));
        } catch (err) {
          callback(src);
        }
      };
      img.onerror = () => callback(src);
      img.src = src;
    },

    applyProcessedImages() {
      if (this.processedLightDataUrl) {
        document.querySelectorAll('.brand-icon-img.light-icon').forEach(img => {
          img.src = this.processedLightDataUrl;
          img.classList.add('transparent-loaded');
        });
      }
      if (this.processedDarkDataUrl) {
        document.querySelectorAll('.brand-icon-img.dark-icon').forEach(img => {
          img.src = this.processedDarkDataUrl;
          img.classList.add('transparent-loaded');
        });
      }
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

  // Setup validators for Signup & Reset Password forms
  setupPasswordValidator('signup-password', 'signup-strength-bar', 'signup-strength-text', 'signup-checklist');
  setupPasswordValidator('reset-password-input', 'reset-strength-bar', 'reset-strength-text', 'reset-checklist');

  // ─── 5. 6-DIGIT OTP INPUT CODE BOXES ───────────────────────────────────
  const otpBoxes = document.querySelectorAll('.otp-box');
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const value = e.target.value;
      if (value.length >= 1) {
        // Keep last typed char
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
      // Create ripple element
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

  // Simulated Form Submissions with Loading States
  const forms = [
    { id: 'form-login', nextView: null, successMsg: 'Welcome back! Redirecting to dashboard...' },
    { id: 'form-signup', nextView: 'verify-email', successMsg: 'Account created! Please verify your email.' },
    { id: 'form-forgot', nextView: 'email-sent', successMsg: 'Reset link sent!' },
    { id: 'form-reset', nextView: 'success', successMsg: 'Password updated!' },
  ];

  forms.forEach(({ id, nextView, successMsg }) => {
    const form = document.getElementById(id);
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.btn-cta-primary');
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;

        setTimeout(() => {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;

          if (nextView) {
            navigateToView(nextView);
          } else {
            alert(successMsg);
          }
        }, 1200);
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

  // ─── 7. ANIMATED PARTICLES CANVAS FOR MIST & STARS ────────────────────
  const canvas = document.getElementById('particles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    const particleCount = 45;

    function resizeCanvas() {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
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
        this.opacity = Math.random() * 0.6 + 0.2;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = -Math.random() * 0.4 - 0.1; // Gentle upwards drift
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
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
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

  // ─── 8. MOUSE PARALLAX EFFECT FOR LEFT HERO IMAGE ──────────────────────
  const heroPanel = document.querySelector('.auth-hero-panel');
  const heroBgImage = document.querySelector('.hero-bg-image');

  if (heroPanel && heroBgImage) {
    heroPanel.addEventListener('mousemove', (e) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = heroPanel.getBoundingClientRect();
      const xPercent = (clientX - left) / width - 0.5;
      const yPercent = (clientY - top) / height - 0.5;

      heroBgImage.style.transform = `scale(1.06) translate(${xPercent * -15}px, ${yPercent * -15}px)`;
    });

    heroPanel.addEventListener('mouseleave', () => {
      heroBgImage.style.transform = `scale(1.05) translate(0px, 0px)`;
    });
  }
});
