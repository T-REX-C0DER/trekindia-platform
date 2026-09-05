/* =============================================
   TREKINDIA — PREMIUM INTERACTIONS
   Smooth animations, counter, AI planner
   ============================================= */

'use strict';

// ─── 1. NAVBAR ─────────────────────────────────
const navbar = document.getElementById('navbar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const themeToggleBtn = document.getElementById('themeToggleBtn');

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const shouldShrink = scrolled > 90;
  navbar.classList.toggle('scrolled', shouldShrink);
  navbar.style.transform = shouldShrink ? 'translateY(0)' : 'translateY(0)';
}, { passive: true });

const savedTheme = localStorage.getItem('trekindia-theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.body.classList.add('dark');
}

/* ─── TREKINDIA BRAND LOGO SYSTEM ─────────────────────────── */
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BrandLogoSystem.init());
} else {
  BrandLogoSystem.init();
}

themeToggleBtn?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('trekindia-theme', isDark ? 'dark' : 'light');
});

mobileMenuBtn.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  mobileMenuBtn.setAttribute('aria-expanded', isOpen);
  mobileMenu.setAttribute('aria-hidden', !isOpen);
  // Animate hamburger
  const spans = mobileMenuBtn.querySelectorAll('span');
  if (isOpen) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  }
});

// Close mobile menu when clicking a link
document.querySelectorAll('.mobile-nav-link, .mobile-cta').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
    const spans = mobileMenuBtn.querySelectorAll('span');
    spans.forEach(s => s.style.transform = s.style.opacity = '');
  });
});

// ─── 2. SEARCH MODAL ───────────────────────────
const searchBtn = document.getElementById('searchBtn');
const searchModal = document.getElementById('searchModal');
const searchCloseBtn = document.getElementById('searchCloseBtn');
const modalBackdrop = document.getElementById('modalBackdrop');
const searchInput = document.getElementById('searchInput');

function openSearch() {
  searchModal.classList.add('open');
  modalBackdrop.classList.add('open');
  searchModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => searchInput.focus(), 100);
  document.body.style.overflow = 'hidden';
}

function closeSearch() {
  searchModal.classList.remove('open');
  modalBackdrop.classList.remove('open');
  searchModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

searchBtn.addEventListener('click', openSearch);
searchCloseBtn.addEventListener('click', closeSearch);
modalBackdrop.addEventListener('click', closeSearch);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSearch();
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }
});

// Search chip clicks
document.querySelectorAll('.search-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    searchInput.value = chip.textContent;
    searchInput.focus();
  });
});

// ─── 3. ANIMATED COUNTERS ──────────────────────
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Easing: easeOutExpo
    const eased = 1 - Math.pow(2, -10 * progress);
    const current = Math.round(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ─── 4. INTERSECTION OBSERVER ──────────────────
// Reveal animations for sections
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

// Counter observer for hero stats
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.stat-number[data-target]').forEach(el => {
        if (!el.dataset.animated) {
          el.dataset.animated = 'true';
          animateCounter(el);
        }
      });
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.addEventListener('DOMContentLoaded', () => {
  // Add reveal class to all section children & observe all reveal elements
  const revealTargets = document.querySelectorAll(
    '.reveal, .trek-card, .state-item, .feature-item, .company-card, .testimonial-card, .journal-card, .gallery-card, .quote-card, .category-card, .gear-card, .fitness-card, .fitness-timeline-card, .alpine-card, .timeline-stage, .nutrition-card, .water-card, .clothing-panel, .prep-block, .feature-showcase-card'
  );

  revealTargets.forEach((el) => {
    if (!el.classList.contains('reveal')) {
      el.classList.add('reveal');
    }
    if (el.parentElement && !el.style.transitionDelay) {
      const siblings = Array.from(el.parentElement.children);
      const idx = siblings.indexOf(el);
      el.style.transitionDelay = `${(idx % 4) * 0.08}s`;
    }
    revealObserver.observe(el);
  });

  // Counter animation
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) counterObserver.observe(heroStats);

  // ─── 5. PARALLAX HERO ─────────────────────────
  const heroImg = document.getElementById('heroImg');
  if (heroImg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      heroImg.style.transform = `scale(1) translateY(${scrolled * 0.25}px)`;
    }, { passive: true });
  }

  // ─── 6. MAP TOOLTIP ───────────────────────────
  const mapPaths = document.querySelectorAll('.state-path, g[data-state]');
  const mapTooltip = document.getElementById('mapTooltip');
  const statesList = document.getElementById('statesList');
  const stateItems = statesList?.querySelectorAll('.state-item');
  let tooltipTimeout;

  function highlightState(stateName, isActive) {
    const mapPath = document.getElementById(`map-${stateName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`);
    const listItem = statesList?.querySelector(`.state-item[data-state="${stateName}"]`);
    mapPath?.classList.toggle('state-active', isActive);
    listItem?.classList.toggle('active', isActive);
  }

  mapPaths.forEach(path => {
    const stateName = path.dataset.state;
    if (!stateName) return;

    path.addEventListener('mouseenter', e => {
      clearTimeout(tooltipTimeout);
      highlightState(stateName, true);

      if (mapTooltip) {
        const treks = path.dataset.treks || '0';
        const region = path.dataset.region || 'N/A';

        const stateEl = mapTooltip.querySelector('.tooltip-state');
        const treksEl = mapTooltip.querySelector('.tooltip-treks');
        const infoEl = mapTooltip.querySelector('.tooltip-info');

        if (stateEl) stateEl.textContent = stateName;
        if (treksEl) treksEl.textContent = `${treks} Treks`;
        if (infoEl) infoEl.innerHTML = `<span>🏔️ ${region} Region</span>`;

        mapTooltip.classList.add('visible');
      }
    });

    path.addEventListener('mousemove', e => {
      if (!mapTooltip) return;
      const mapContainer = document.querySelector('.map-container');
      if (!mapContainer) return;
      const mapRect = mapContainer.getBoundingClientRect();
      const x = e.clientX - mapRect.left + 16;
      const y = e.clientY - mapRect.top - 10;
      mapTooltip.style.left = Math.min(Math.max(10, x), mapRect.width - mapTooltip.offsetWidth - 10) + 'px';
      mapTooltip.style.top = y + 'px';
    });

    path.addEventListener('mouseleave', () => {
      highlightState(stateName, false);
      if (mapTooltip) {
        tooltipTimeout = setTimeout(() => {
          mapTooltip.classList.remove('visible');
        }, 200);
      }
    });

    path.addEventListener('click', e => {
      e.preventDefault();
      const trekSec = document.getElementById('treks');
      if (trekSec) trekSec.scrollIntoView({ behavior: 'smooth' });
    });
  });

  stateItems?.forEach(item => {
    const stateName = item.dataset.state;
    item.addEventListener('mouseenter', () => highlightState(stateName, true));
    item.addEventListener('mouseleave', () => highlightState(stateName, false));
  });

  // ─── 7. AI TREK PLANNER ───────────────────────
  const generateBtn = document.getElementById('generateTrekBtn');
  const aiStatus = document.getElementById('aiStatus');
  const aiResultBody = document.getElementById('aiResultBody');
  const aiLoadingBar = document.getElementById('aiLoadingBar');
  const aiResultCard = document.getElementById('aiResultCard');
  const stepCards = Array.from(document.querySelectorAll('.ai-step-card'));
  const stepPills = Array.from(document.querySelectorAll('.ai-step-pill'));
  const aiProgressFill = document.getElementById('aiProgressFill');
  const aiBackBtn = document.getElementById('aiBackBtn');
  const aiNextBtn = document.getElementById('aiNextBtn');
  let currentStep = 0;

  function updateStepper() {
    stepCards.forEach((card, index) => card.classList.toggle('active', index === currentStep));
    stepPills.forEach((pill, index) => pill.classList.toggle('active', index === currentStep));
    const progress = ((currentStep + 1) / stepCards.length) * 100;
    aiProgressFill.style.width = `${progress}%`;
    aiBackBtn.disabled = currentStep === 0;
    aiBackBtn.style.opacity = currentStep === 0 ? '0.5' : '1';
    aiNextBtn.textContent = currentStep === stepCards.length - 1 ? 'Generate' : 'Next';
  }

  updateStepper();

  aiBackBtn?.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep -= 1;
      updateStepper();
    }
  });

  aiNextBtn?.addEventListener('click', () => {
    if (currentStep < stepCards.length - 1) {
      currentStep += 1;
      updateStepper();
    } else {
      generateBtn.click();
    }
  });

  const trekRecommendations = {
    'First Timer': {
      'Easy': {
        'Uttarakhand': '"I recommend the <strong>Chopta-Tungnath Trek</strong> — a short 4km trail to Asia\'s highest Shiva temple at 3,680m. Perfect for beginners, no acclimatization needed, and the Himalayas feel close enough to touch."',
        'Himachal Pradesh': '"For your first adventure, try <strong>Prashar Lake Trek</strong> — a 7km trail through dense forest to a pristine alpine lake at 2,730m. Stunning, manageable, unforgettable."',
        'default': '"Start with <strong>Kedarkantha Trek</strong> in Uttarakhand — India\'s most loved beginner trek. 5 days, 12km, panoramic snow views from 3,810m. Your perfect first Himalayan adventure."'
      },
      'default': '"For your first mountain experience, <strong>Triund Trek</strong> in Himachal Pradesh is ideal — a 9km trail with spectacular views of the Dhauladhar range. Friendly community, scenic camping, 2,850m altitude."'
    },
    'Intermediate': {
      'Moderate': {
        'Uttarakhand': '"<strong>Roopkund Trek</strong> is calling you — a 8-day, 54km odyssey through alpine meadows, frozen lakes, and the mysterious skeleton lake at 5,029m. Best done May–June."',
        'Himachal Pradesh': '"Try the <strong>Hampta Pass Trek</strong> — 5 days, 35km, crossing a dramatic 4,270m pass from lush green Kullu to the stark lunar landscape of Lahaul. Utterly cinematic."',
        'default': '"The <strong>Valley of Flowers National Park</strong> is perfect for you — a UNESCO site at 3,600m bursting with 300+ species of wildflowers. 6 days, gentle, magical, and life-changing."'
      },
      'default': '"<strong>Kashmir Great Lakes</strong> is your next chapter — 7 days, 70km, seven pristine alpine lakes in a single trek. India\'s most beautiful trek, hands down."'
    },
    'Advanced': {
      'Difficult': {
        'default': '"<strong>Pin Parvati Pass</strong> is your ultimate challenge — 12 days, 92km, 5,319m altitude. One of India\'s most demanding crossings. The kind of trek that remakes you completely."'
      },
      'default': '"<strong>Chadar Trek</strong> on the frozen Zanskar River is your calling — 9 days walking on ice at -25°C through one of India\'s last great wildernesses. February only. Supremely raw."'
    },
    'Expert': {
      'default': '"The <strong>Auden\'s Col Expedition</strong> awaits you — a technical mountaineering route at 5,490m in the Garhwal Himalaya. 14 days, requires ice axe, crampons, and nerves of steel."'
    },
    'default': '"Based on your preferences, I recommend <strong>Valley of Flowers</strong> in Uttarakhand — a gentle 6-day UNESCO trail at 3,600m. Countless wildflowers, mountain silence, and the purest air on earth."'
  };

  function getRecommendation(experience, difficulty, state) {
    const expRec = trekRecommendations[experience] || trekRecommendations['default'];
    if (typeof expRec === 'string') return expRec;
    const diffRec = expRec[difficulty] || expRec['default'];
    if (typeof diffRec === 'string') return diffRec;
    return diffRec[state] || diffRec['default'] || trekRecommendations['default'];
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const experience = document.getElementById('aiExperience').value;
      const difficulty = document.getElementById('aiDifficulty').value;
      const state = document.getElementById('aiState').value;
      const duration = document.getElementById('aiDuration').value;
      const fitness = document.getElementById('aiFitness')?.value || 'Moderate';

      // Loading state
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      aiStatus.textContent = 'Searching...';
      aiResultCard.classList.add('loading');
      aiLoadingBar.style.animation = 'generating 1.5s ease-in-out infinite';
      aiLoadingBar.style.width = '';

      await delay(600);
      aiStatus.textContent = 'Analyzing Weather...';
      await delay(600);
      aiStatus.textContent = 'Finding Best Match...';
      await delay(700);

      // Recommendation
      const recommendation = getRecommendation(experience, difficulty, state);
      const tags = [state === 'Any Region' ? 'Uttarakhand' : state, duration, `${difficulty} • ${fitness}`];

      aiResultBody.innerHTML = `
        <p class="ai-result-text">${recommendation}</p>
        <div class="ai-tags">
          ${tags.map(t => `<span class="ai-tag">${t}</span>`).join('')}
        </div>
        <div class="ai-action-row">
          <button class="ai-action-btn" type="button">Save</button>
          <button class="ai-action-btn" type="button">Share</button>
          <button class="ai-action-btn" type="button">Compare</button>
        </div>
      `;

      // Complete
      aiLoadingBar.style.animation = '';
      aiLoadingBar.style.width = '100%';
      aiLoadingBar.style.transition = 'width 0.5s ease';
      aiStatus.textContent = 'Ready to assist';
      aiResultCard.classList.remove('loading');

      generateBtn.disabled = false;
      generateBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 1 0 10 10"/></svg> Generate My Trek`;

      // Scroll to result on mobile
      if (window.innerWidth < 1200) {
        document.getElementById('aiResultCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── 8. NEWSLETTER ────────────────────────────
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('newsletterEmail').value;
      const btn = document.getElementById('newsletterSubmitBtn');
      if (!email) return;

      btn.textContent = '✓ Joined!';
      btn.style.background = 'rgba(255,255,255,0.9)';
      btn.style.color = 'var(--forest)';
      btn.disabled = true;

      setTimeout(() => {
        btn.textContent = 'Join Community';
        btn.style.background = '';
        btn.style.color = '';
        btn.disabled = false;
        newsletterForm.reset();
      }, 3000);
    });
  }

  // ─── 9. BOOKMARK BUTTONS ──────────────────────
  document.querySelectorAll('.bookmark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isBookmarked = btn.classList.toggle('bookmarked');
      const svg = btn.querySelector('svg path');
      if (isBookmarked) {
        btn.style.color = 'var(--forest)';
        svg.setAttribute('fill', 'var(--forest)');
      } else {
        btn.style.color = '';
        svg.setAttribute('fill', 'none');
      }
      // Micro-animation
      btn.style.transform = 'scale(1.3)';
      setTimeout(() => btn.style.transform = '', 200);
    });
  });

  // ─── 10. CARD RIPPLE EFFECT ───────────────────
  function addRipple(el) {
    el.addEventListener('click', function(e) {
      const rect = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: rgba(85,107,47,0.08);
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0);
        animation: rippleEffect 0.6s ease-out forwards;
        left: ${e.clientX - rect.left}px;
        top: ${e.clientY - rect.top}px;
        pointer-events: none;
        z-index: 0;
      `;
      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  // Add ripple keyframes dynamically
  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `
    @keyframes rippleEffect {
      to { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }
    @keyframes generating {
      0%, 100% { width: 30%; }
      50% { width: 90%; }
    }
  `;
  document.head.appendChild(rippleStyle);

  document.querySelectorAll('.state-item, .company-card').forEach(addRipple);

  // ─── 11. SMOOTH ACTIVE NAV ON SCROLL ──────────
  const sections = document.querySelectorAll('section[id], footer[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => sectionObserver.observe(s));

  // Add active nav style
  const activeNavStyle = document.createElement('style');
  activeNavStyle.textContent = `.nav-link.active { color: var(--forest); background: rgba(85,107,47,0.08); }`;
  document.head.appendChild(activeNavStyle);

  // ─── 12. TREK CARD KEYBOARD NAVIGATION ─────────
  document.querySelectorAll('.trek-card').forEach(card => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.querySelector('.btn-explore-sm')?.click();
      }
    });
  });

  // ─── 13. PARALLAX FOR SECTION IMAGES ──────────
  const parallaxImages = document.querySelectorAll('.why-img-main, .journal-img');
  const parallaxObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const handler = () => {
          const rect = img.getBoundingClientRect();
          const scrollFraction = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
          const translateY = (scrollFraction - 0.5) * 40;
          img.querySelector('img')?.style && (img.querySelector('img').style.transform = `translateY(${translateY}px)`);
        };
        window.addEventListener('scroll', handler, { passive: true });
        img._scrollHandler = handler;
      } else if (entry.target._scrollHandler) {
        window.removeEventListener('scroll', entry.target._scrollHandler);
      }
    });
  }, { threshold: 0 });
  parallaxImages.forEach(img => parallaxObserver.observe(img));

  // ─── 14. LOADING SKELETON FALLBACK ────────────
  document.querySelectorAll('img').forEach(img => {
    if (!img.complete) {
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.4s ease';
      img.addEventListener('load', () => {
        img.style.opacity = '1';
      });
      img.addEventListener('error', () => {
        // Fallback gradient on broken images
        const parent = img.parentElement;
        if (parent) {
          parent.style.background = 'linear-gradient(135deg, #E8EDD8, #D4DEC0)';
          img.style.display = 'none';
        }
      });
    }
  });

  console.log(
    '%c🏔 TrekIndia%c — India\'s Premium Trekking Discovery Platform',
    'font-size: 18px; font-weight: bold; color: #556B2F;',
    'font-size: 13px; color: #707070;'
  );
});

/* ══════════════════════════════════════════════════════════
   TREKINDIA v2.0 — NEW FEATURES JAVASCRIPT
   All code is additive. Zero modifications to existing JS.
   ══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── A. MOBILE NAV SUB-MENUS ──────────────────────────────
  document.querySelectorAll('.mobile-nav-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isOpen = toggle.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      const subId = toggle.id === 'mobilePrep' ? 'mobilePrepSub' : 'mobileGearSub';
      const sub = document.getElementById(subId);
      if (sub) sub.classList.toggle('open', isOpen);
    });
  });

  // Close mobile sub-menus when clicking their links
  document.querySelectorAll('.mobile-nav-sub-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-sub').forEach(s => s.classList.remove('open'));
      document.querySelectorAll('.mobile-nav-toggle').forEach(t => {
        t.classList.remove('open');
        t.setAttribute('aria-expanded', 'false');
      });
    });
  });

  // ─── B. GEAR MARKETPLACE ──────────────────────────────────
  // Managed dynamically by GearMarketplace in trek-api.js (database-driven)


  // ─── C. PHYSICAL READINESS DASHBOARD ──────────────────────

  // SVG Ring animation using IntersectionObserver
  const fitnessRingFill = document.getElementById('enduranceRing');
  if (fitnessRingFill) {
    const percent = parseInt(fitnessRingFill.dataset.percent, 10) || 75;
    const circumference = 2 * Math.PI * 50; // r=50
    fitnessRingFill.style.strokeDasharray = circumference;
    fitnessRingFill.style.strokeDashoffset = circumference;

    const ringObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const offset = circumference - (percent / 100) * circumference;
          fitnessRingFill.style.strokeDashoffset = offset;
          ringObserver.disconnect();
        }
      });
    }, { threshold: 0.5 });

    ringObserver.observe(fitnessRingFill);
  }

  // Progress bar animations
  const fitnessBars = document.querySelectorAll('.fitness-bar-fill');
  if (fitnessBars.length) {
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const targetWidth = bar.dataset.width || '0';
          bar.style.width = targetWidth + '%';
          barObserver.unobserve(bar);
        }
      });
    }, { threshold: 0.4 });

    fitnessBars.forEach(bar => barObserver.observe(bar));
  }

  // Generate plan button
  const generatePlanBtn = document.getElementById('generatePlanBtn');
  if (generatePlanBtn) {
    generatePlanBtn.addEventListener('click', () => {
      generatePlanBtn.textContent = '⏳ Generating...';
      generatePlanBtn.disabled = true;
      // Future: call fitness API
      setTimeout(() => {
        generatePlanBtn.textContent = '✓ Plan Sent to Email!';
        setTimeout(() => {
          generatePlanBtn.textContent = 'Generate Personalized Plan';
          generatePlanBtn.disabled = false;
        }, 2500);
      }, 1800);
    });
  }

  // ─── D. SMART PACKING CHECKLIST ENGINE ─────────────────────────────────

  const CHECKLIST_STORAGE_KEY = 'trekindia_smart_checklist_v2';
  const checklistContainer = document.getElementById('checklistContainer');
  const checklistProgressFill = document.getElementById('checklistProgressFill');
  const checklistProgressLabel = document.getElementById('checklistProgressLabel');
  const checklistPresetPills = document.getElementById('checklistPresetPills');
  const btnAddChecklistItem = document.getElementById('btnAddChecklistItem');
  const customItemModal = document.getElementById('customItemModal');
  const btnCloseCustomItemModal = document.getElementById('btnCloseCustomItemModal');
  const btnCancelCustomItem = document.getElementById('btnCancelCustomItem');
  const formCustomItem = document.getElementById('formCustomItem');
  const customItemId = document.getElementById('customItemId');
  const customItemName = document.getElementById('customItemName');
  const customItemCategory = document.getElementById('customItemCategory');
  const customItemQty = document.getElementById('customItemQty');
  const customItemModalTitle = document.getElementById('customItemModalTitle');
  const saveChecklistBtn = document.getElementById('saveChecklistBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');

  // Base checklist catalog
  const BASE_CHECKLIST = [
    { id: 'item1', name: 'Waterproof Shell Jacket', category: 'CLOTHING', checked: false, isCustom: false },
    { id: 'item2', name: 'Headlamp with Spare Batteries', category: 'GEAR', checked: true, isCustom: false },
    { id: 'item3', name: 'Thermal Inner Layers (Top & Bottom)', category: 'CLOTHING', checked: false, isCustom: false },
    { id: 'item4', name: '2L Hydration Bladder / Bottles', category: 'UTILITY', checked: false, isCustom: false },
    { id: 'item5', name: 'Trekking Poles (Collapsible)', category: 'GEAR', checked: false, isCustom: false },
    { id: 'item6', name: 'First Aid Kit & Blister Care', category: 'UTILITY', checked: false, isCustom: false },
    { id: 'item7', name: 'Trail Snacks & Energy Bars', category: 'FOOD', checked: false, isCustom: false },
    { id: 'item8', name: 'Trekking Socks (3 pairs minimum)', category: 'CLOTHING', checked: false, isCustom: false },
    { id: 'item9', name: 'Sunscreen SPF 50+ & Lip Balm', category: 'ACCESSORIES', checked: false, isCustom: false },
    { id: 'item10', name: 'Offline GPX Map & Emergency Whistle', category: 'UTILITY', checked: false, isCustom: false }
  ];

  // Smart preset additions
  const PRESET_EXTRAS = {
    himalayan: [
      { id: 'extra_him_1', name: 'Down Jacket (-10°C Rated)', category: 'CLOTHING', checked: false, isCustom: false },
      { id: 'extra_him_2', name: 'Pulse Oximeter & Diamox (Altitude Meds)', category: 'UTILITY', checked: false, isCustom: false },
      { id: 'extra_him_3', name: 'Category 3/4 UV Glacier Sunglasses', category: 'ACCESSORIES', checked: false, isCustom: false },
      { id: 'extra_him_4', name: 'Fleece Mid-layer Jacket', category: 'CLOTHING', checked: false, isCustom: false }
    ],
    monsoon: [
      { id: 'extra_mon_1', name: 'Waterproof Backpack Rain Cover (Heavy Duty)', category: 'GEAR', checked: false, isCustom: false },
      { id: 'extra_mon_2', name: 'Quick-dry Trekking Pants (Synthetic)', category: 'CLOTHING', checked: false, isCustom: false },
      { id: 'extra_mon_3', name: 'Waterproof Dry Bags for Electronics', category: 'UTILITY', checked: false, isCustom: false },
      { id: 'extra_mon_4', name: 'Anti-Leech Socks / Salt Kit', category: 'ACCESSORIES', checked: false, isCustom: false }
    ],
    winter: [
      { id: 'extra_win_1', name: 'Insulated Snow Boots with Grip', category: 'GEAR', checked: false, isCustom: false },
      { id: 'extra_win_2', name: 'Waterproof Ski Gloves + Liner Gloves', category: 'CLOTHING', checked: false, isCustom: false },
      { id: 'extra_win_3', name: 'Microspikes / Crampons for Ice', category: 'GEAR', checked: false, isCustom: false },
      { id: 'extra_win_4', name: 'Vacuum Insulated Hot Flask (Thermos)', category: 'UTILITY', checked: false, isCustom: false }
    ],
    day_hike: [
      { id: 'extra_day_1', name: '20L Compact Daypack', category: 'GEAR', checked: false, isCustom: false },
      { id: 'extra_day_2', name: 'Electrolyte Energy Hydration Powders', category: 'FOOD', checked: false, isCustom: false },
      { id: 'extra_day_3', name: 'UV Protection Sun Hat & Buff', category: 'ACCESSORIES', checked: false, isCustom: false }
    ]
  };

  let currentPreset = 'all';
  let checklistItems = [...BASE_CHECKLIST];

  function getCombinedChecklist() {
    let items = [...checklistItems];
    if (currentPreset !== 'all' && PRESET_EXTRAS[currentPreset]) {
      const extras = PRESET_EXTRAS[currentPreset];
      extras.forEach(extra => {
        if (!items.some(i => i.id === extra.id)) {
          items.push({ ...extra });
        }
      });
    }
    return items;
  }

  function renderChecklistUI() {
    if (!checklistContainer) return;
    const items = getCombinedChecklist();

    checklistContainer.innerHTML = items.map(item => {
      const isChecked = Boolean(item.checked);
      const customBadge = item.isCustom ? `<span class="checklist-custom-tag">Custom</span>` : '';
      const actionButtons = item.isCustom ? `
        <div class="checklist-item-actions">
          <button type="button" class="checklist-item-action-btn edit" data-id="${item.id}" title="Edit Item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="checklist-item-action-btn delete" data-id="${item.id}" title="Delete Item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      ` : '';

      return `
        <label class="checklist-item" role="listitem" data-id="${item.id}">
          <input type="checkbox" class="checklist-checkbox" id="${item.id}" ${isChecked ? 'checked' : ''} />
          <span class="checklist-item-name">${escapeHtml(item.name)}${item.qty ? ` <small style="color:var(--text-secondary); font-weight:normal;">(${escapeHtml(item.qty)})</small>` : ''}</span>
          ${customBadge}
          <span class="checklist-category-tag">${escapeHtml(item.category || 'GEAR')}</span>
          ${actionButtons}
        </label>
      `;
    }).join('');

    // Attach custom item actions
    checklistContainer.querySelectorAll('.checklist-item-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openEditCustomItemModal(id);
      });
    });

    checklistContainer.querySelectorAll('.checklist-item-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        deleteCustomItem(id);
      });
    });

    updateChecklistProgress();
  }

  function updateChecklistProgress() {
    if (!checklistContainer) return;
    const all = checklistContainer.querySelectorAll('.checklist-checkbox');
    const checked = checklistContainer.querySelectorAll('.checklist-checkbox:checked');
    const total = all.length;
    const count = checked.length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    if (checklistProgressFill) checklistProgressFill.style.width = pct + '%';
    if (checklistProgressLabel) {
      checklistProgressLabel.textContent = `${count} of ${total} packed`;
    }
  }

  function syncCheckboxStates() {
    if (!checklistContainer) return;
    const checkedMap = {};
    checklistContainer.querySelectorAll('.checklist-checkbox').forEach(cb => {
      checkedMap[cb.id] = cb.checked;
    });

    checklistItems.forEach(i => {
      if (i.id in checkedMap) {
        i.checked = checkedMap[i.id];
      }
    });

    // Save locally
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklistItems));
    } catch (_) {}
  }

  async function loadChecklist() {
    let loadedFromBackend = false;
    try {
      const res = await fetch('/api/profile/checklist', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          checklistItems = data.items;
          loadedFromBackend = true;
        }
      }
    } catch (_) {}

    if (!loadedFromBackend) {
      try {
        const saved = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY));
        if (Array.isArray(saved) && saved.length > 0) {
          checklistItems = saved;
        }
      } catch (_) {}
    }

    renderChecklistUI();
  }

  async function saveChecklistToStorageAndBackend() {
    syncCheckboxStates();
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklistItems));
    } catch (_) {}

    try {
      await fetch('/api/profile/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: checklistItems })
      });
    } catch (_) {}
  }

  function openAddCustomItemModal() {
    if (!customItemModal) return;
    customItemModalTitle.textContent = 'Add Custom Item';
    customItemId.value = '';
    customItemName.value = '';
    customItemCategory.value = 'GEAR';
    customItemQty.value = '';
    customItemModal.style.display = 'flex';
    customItemName.focus();
  }

  function openEditCustomItemModal(id) {
    const item = checklistItems.find(i => i.id === id);
    if (!item || !customItemModal) return;

    customItemModalTitle.textContent = 'Edit Custom Item';
    customItemId.value = item.id;
    customItemName.value = item.name;
    customItemCategory.value = item.category || 'GEAR';
    customItemQty.value = item.qty || '';
    customItemModal.style.display = 'flex';
    customItemName.focus();
  }

  function closeCustomItemModal() {
    if (customItemModal) customItemModal.style.display = 'none';
  }

  function deleteCustomItem(id) {
    if (!confirm('Are you sure you want to remove this item from your checklist?')) return;
    checklistItems = checklistItems.filter(i => i.id !== id);
    saveChecklistToStorageAndBackend();
    renderChecklistUI();
  }

  // Event Listeners for Packing Checklist
  if (checklistContainer) {
    checklistContainer.addEventListener('change', (e) => {
      if (e.target.classList.contains('checklist-checkbox')) {
        syncCheckboxStates();
        updateChecklistProgress();
      }
    });
  }

  if (checklistPresetPills) {
    checklistPresetPills.querySelectorAll('.checklist-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        checklistPresetPills.querySelectorAll('.checklist-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPreset = btn.getAttribute('data-preset') || 'all';
        renderChecklistUI();
      });
    });
  }

  if (btnAddChecklistItem) {
    btnAddChecklistItem.addEventListener('click', openAddCustomItemModal);
  }

  if (btnCloseCustomItemModal) {
    btnCloseCustomItemModal.addEventListener('click', closeCustomItemModal);
  }

  if (btnCancelCustomItem) {
    btnCancelCustomItem.addEventListener('click', closeCustomItemModal);
  }

  if (formCustomItem) {
    formCustomItem.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = customItemId.value.trim();
      const name = customItemName.value.trim();
      const category = customItemCategory.value.trim();
      const qty = customItemQty.value.trim();

      if (!name) return;

      if (id) {
        // Edit existing
        const idx = checklistItems.findIndex(i => i.id === id);
        if (idx !== -1) {
          checklistItems[idx].name = name;
          checklistItems[idx].category = category;
          checklistItems[idx].qty = qty;
        }
      } else {
        // Add new
        const newId = `custom_${Date.now()}`;
        checklistItems.push({
          id: newId,
          name,
          category,
          qty,
          checked: false,
          isCustom: true
        });
      }

      closeCustomItemModal();
      saveChecklistToStorageAndBackend();
      renderChecklistUI();
    });
  }

  if (saveChecklistBtn) {
    saveChecklistBtn.addEventListener('click', async () => {
      await saveChecklistToStorageAndBackend();
      saveChecklistBtn.textContent = '✓ Saved!';
      setTimeout(() => {
        saveChecklistBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Save List
        `;
      }, 2000);
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      syncCheckboxStates();
      const items = getCombinedChecklist();
      const total = items.length;
      const packed = items.filter(i => i.checked).length;
      const categories = {};

      items.forEach(i => {
        const cat = i.category || 'GEAR';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(i);
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to export your checklist as a printable PDF.');
        return;
      }

      const categorySectionsHtml = Object.keys(categories).map(cat => {
        const catItems = categories[cat];
        return `
          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 14px; text-transform: uppercase; color: #285D2A; border-bottom: 2px solid #E1E7E2; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 0.05em;">
              ${cat} (${catItems.length})
            </h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              ${catItems.map(item => `
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #17231A; padding: 4px 0;">
                  <span style="font-size: 16px; color: ${item.checked ? '#285D2A' : '#999'};">${item.checked ? '☑' : '☐'}</span>
                  <span style="${item.checked ? 'text-decoration: line-through; color: #6B766F;' : ''}">${escapeHtml(item.name)}${item.qty ? ` <small>(${escapeHtml(item.qty)})</small>` : ''}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>TrekIndia Smart Packing Checklist</title>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; color: #17231A; max-width: 800px; margin: auto; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #285D2A; padding-bottom: 16px; margin-bottom: 24px;">
            <div>
              <h1 style="margin: 0; color: #285D2A; font-size: 24px;">TrekIndia Explorer Checklist</h1>
              <div style="font-size: 13px; color: #6B766F; margin-top: 4px;">Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 700; color: #285D2A;">${packed} of ${total} Packed (${Math.round((packed / total) * 100)}%)</div>
              <div style="font-size: 12px; color: #6B766F;">Trail-Ready Status</div>
            </div>
          </div>
          ${categorySectionsHtml}
          <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #E1E7E2; font-size: 11px; color: #6B766F; text-align: center;">
            TrekIndia Platform · Designed for Safe & Sustainable Mountain Expeditions · trekindia.com
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    });
  }

  // Load checklist on init
  if (checklistContainer) {
    loadChecklist();
  }

  // ─── E. WATER PLANNER ─────────────────────────────────────

  const waterDistance = document.getElementById('waterDistance');
  const waterTemp = document.getElementById('waterTemp');
  const waterDistanceVal = document.getElementById('waterDistanceVal');
  const waterTempVal = document.getElementById('waterTempVal');
  const waterResult = document.getElementById('waterResult');
  const waterTip = document.getElementById('waterTip');

  const waterTips = [
    'Tip: Sip small amounts frequently rather than drinking a lot at once.',
    'Tip: Start hydrating 24 hours before your trek day.',
    'Tip: Add electrolyte tablets to prevent sodium depletion.',
    'Tip: Monitor urine color — pale yellow means well hydrated.',
    'Tip: Drink before you feel thirsty at high altitude.',
  ];

  function calculateWater() {
    if (!waterDistance || !waterTemp) return;
    const dist = parseInt(waterDistance.value, 10);
    const temp = parseInt(waterTemp.value, 10);
    // Base: 0.5L per 5km + temperature factor + altitude base of 1L
    const base = 1.0;
    const distFactor = dist * 0.12;
    const tempFactor = temp > 20 ? (temp - 20) * 0.05 : 0;
    const total = Math.max(1.5, (base + distFactor + tempFactor)).toFixed(1);

    if (waterDistanceVal) waterDistanceVal.textContent = `${dist} km`;
    if (waterTempVal) waterTempVal.textContent = `${temp}°C`;
    if (waterResult) {
      waterResult.style.transform = 'scale(1.08)';
      waterResult.textContent = `${total} Liters`;
      setTimeout(() => { waterResult.style.transform = ''; }, 300);
    }
    if (waterTip) {
      waterTip.textContent = waterTips[Math.floor(Math.random() * waterTips.length)];
    }
  }

  waterDistance?.addEventListener('input', calculateWater);
  waterTemp?.addEventListener('input', calculateWater);
  // Init on load
  calculateWater();

  // ─── F. CLOTHING GUIDE TABS ───────────────────────────────

  const clothingData = {
    winter: {
      label: 'Himalayan Winter',
      icon: '❄️',
      layers: [
        'Thermal Base Layer (Moisture Wicking)',
        'Mid-Weight Fleece Jacket',
        'Heavy Down Puffer (700+ Fill)',
        'Windbreaker Outer Shell',
        'Balaclava & Thermal Gloves',
        'Insulated Trekking Boots',
      ]
    },
    summer: {
      label: 'Alpine Summer',
      icon: '☀️',
      layers: [
        'Moisture-Wicking T-Shirt (Merino Wool)',
        'Light Softshell Jacket',
        'Windproof Outer Layer',
        'UV-Protection Cap & Sunglasses',
        'Lightweight Trekking Pants',
        'Ventilated Trail Shoes',
      ]
    },
    monsoon: {
      label: 'Monsoon Season',
      icon: '🌧️',
      layers: [
        'Quick-Dry Base Layer',
        'Waterproof Rain Jacket (Taped Seams)',
        'Waterproof Over-Pants',
        'Waterproof Backpack Cover',
        'Anti-Leech Gaiters',
        'Waterproof Trekking Boots',
      ]
    },
    snow: {
      label: 'Snow Trekking',
      icon: '🏔️',
      layers: [
        'Heavy Thermal Base Set (Top + Bottom)',
        'Insulated Mid-Layer Jacket',
        'Hardshell Outer Shell (Gore-Tex)',
        'Down Pants for Camp',
        'Crampon-Compatible Boots',
        'Mountaineering Gloves (3-Layer)',
      ]
    }
  };

  const clothingPanel = document.getElementById('clothingPanel');

  function renderClothingPanel(season) {
    if (!clothingPanel) return;
    const data = clothingData[season] || clothingData.winter;
    clothingPanel.innerHTML = `
      <div class="clothing-season-name">
        <span>${data.label}</span>
        <span class="clothing-season-icon">${data.icon}</span>
      </div>
      <ul class="clothing-layer-list" aria-label="Clothing layers for ${data.label}">
        ${data.layers.map(l => `<li class="clothing-layer-item">${l}</li>`).join('')}
      </ul>
    `;
    clothingPanel.style.opacity = '0';
    clothingPanel.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      clothingPanel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      clothingPanel.style.opacity = '1';
      clothingPanel.style.transform = 'translateY(0)';
    });
  }

  // Init clothing panel
  renderClothingPanel('winter');

  document.querySelectorAll('.clothing-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.clothing-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      renderClothingPanel(tab.dataset.season);
    });
  });

});

