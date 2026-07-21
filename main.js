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
  // Add reveal class to all section children
  const revealTargets = document.querySelectorAll(
    '.trek-card, .state-item, .feature-item, .company-card, .testimonial-card, .journal-card, .gallery-card, .quote-card, .category-card'
  );

  revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    // Stagger by column/position within parent
    const siblings = Array.from(el.parentElement.children);
    const idx = siblings.indexOf(el);
    el.style.transitionDelay = `${idx * 0.08}s`;
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
      heroImg.style.transform = `scale(1) translateY(${scrolled * 0.3}px)`;
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

      const treks = path.dataset.treks || '0';
      const region = path.dataset.region || 'N/A';

      mapTooltip.querySelector('.tooltip-state').textContent = stateName;
      mapTooltip.querySelector('.tooltip-treks').textContent = `${treks} Treks`;
      mapTooltip.querySelector('.tooltip-info').innerHTML = `<span>🏔 ${region}</span>`;

      mapTooltip.classList.add('visible');
    });

    path.addEventListener('mousemove', e => {
      const mapRect = document.querySelector('.map-container').getBoundingClientRect();
      const x = e.clientX - mapRect.left + 16;
      const y = e.clientY - mapRect.top - 10;
      mapTooltip.style.left = Math.min(x, mapRect.width - mapTooltip.offsetWidth - 10) + 'px';
      mapTooltip.style.top = y + 'px';
    });

    path.addEventListener('mouseleave', () => {
      highlightState(stateName, false);
      tooltipTimeout = setTimeout(() => {
        mapTooltip.classList.remove('visible');
      }, 200);
    });

    path.addEventListener('click', e => {
      e.preventDefault();
      window.location.href = `/states/${stateName.toLowerCase().replace(/ /g, '-')}`;
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
