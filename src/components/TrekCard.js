/**
 * @file TrekCard.js
 * @description Reusable Trek Card component.
 *
 * Pure function: receives a Trek object, returns a populated HTMLElement.
 * No hardcoded data. State-agnostic. Works for every Indian state and Nepal.
 *
 * Usage:
 *   import { createTrekCard } from './TrekCard.js';
 *   container.appendChild(createTrekCard(trek, { bookmarked: true }));
 */

import { getTrekCover, attachFallback } from '../utils/imageResolver.js';
import { formatRating, getDifficultyMeta, getTagMeta } from '../utils/formatters.js';
import { toggleBookmark, isBookmarked } from '../utils/bookmarks.js';

// ─── SVG Icons ──────────────────────────────────────────────────────────────

const SVG_BOOKMARK_EMPTY = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>`;

const SVG_BOOKMARK_FILLED = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="currentColor" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>`;

const SVG_CLOCK = `
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>`;

const SVG_DISTANCE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 3h6l3 3 3-3h6"/><path d="M3 21h6l3-3 3 3h6"/><line x1="3" y1="12" x2="21" y2="12"/>
  </svg>`;

const SVG_ELEVATION = `
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="3 20 9 4 15 13 19 9 21 20"/>
  </svg>`;

const SVG_STAR = `
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
    fill="#f59e0b" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;

const SVG_ARROW = `
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>`;

// ─── Trek Card Factory ────────────────────────────────────────────────────────

/**
 * Creates a fully-rendered Trek Card DOM element.
 *
 * @param {import('../types/trek.js').Trek} trek
 * @param {{ bookmarked?: boolean }} [opts]
 * @returns {HTMLElement}
 */
export function createTrekCard(trek, opts = {}) {
  const bookmarked = opts.bookmarked !== undefined ? opts.bookmarked : isBookmarked(trek.id);
  const diffMeta   = getDifficultyMeta(trek.difficulty);

  // Resolve image
  const imgSrc = getTrekCover(trek.stateSlug, trek.slug, trek.coverImage);

  // Build tag chips (limit to 3 for card display)
  const displayTags = [];
  if (trek.featured) displayTags.push('Featured');
  if (trek.popular)  displayTags.push('Popular');
  (trek.tags || []).forEach(t => {
    if (t !== 'Featured' && t !== 'Popular') displayTags.push(t);
  });
  const visibleTags = displayTags.slice(0, 3);

  // Build tag HTML
  const tagsHtml = visibleTags.map(tag => {
    const meta = getTagMeta(tag);
    const isFeatured = tag === 'Featured';
    const isPopular  = tag === 'Popular';
    const cls = isFeatured ? 'trek-tag trek-tag--featured' :
                isPopular  ? 'trek-tag trek-tag--popular' : 'trek-tag';
    return `<span class="${cls}">${meta.icon} ${meta.label}</span>`;
  }).join('');

  // Card HTML template
  const card = document.createElement('article');
  card.className = 'trek-card';
  card.setAttribute('data-trek-id', trek.id);
  card.setAttribute('data-state', trek.stateSlug);
  card.setAttribute('data-slug', trek.slug);
  card.setAttribute('data-difficulty', trek.difficulty);
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${trek.name} trek card`);

  card.innerHTML = `
    <div class="trek-card__image-wrap">
      <img
        class="trek-card__image"
        src="${imgSrc}"
        alt="${trek.name} — ${trek.state} trek cover photo"
        loading="lazy"
        decoding="async"
        data-region="${trek.region}"
        data-difficulty="${trek.difficulty}"
      />
      <div class="trek-card__image-overlay"></div>

      <!-- Bookmark button -->
      <button
        class="trek-card__bookmark ${bookmarked ? 'trek-card__bookmark--active' : ''}"
        aria-label="${bookmarked ? 'Remove from favourites' : 'Save to favourites'}"
        aria-pressed="${bookmarked}"
        data-trek-id="${trek.id}"
        id="bookmark-${trek.id}"
      >
        <span class="bookmark-icon bookmark-icon--empty">${SVG_BOOKMARK_EMPTY}</span>
        <span class="bookmark-icon bookmark-icon--filled">${SVG_BOOKMARK_FILLED}</span>
      </button>

      <!-- Difficulty badge -->
      <span class="trek-card__difficulty-badge ${diffMeta.cls}" aria-label="Difficulty: ${trek.difficulty}">
        ${trek.difficulty}
      </span>

      <!-- Tag chips -->
      ${visibleTags.length ? `<div class="trek-card__tags">${tagsHtml}</div>` : ''}
    </div>

    <div class="trek-card__body">
      <!-- Meta row: State + Rating -->
      <div class="trek-card__meta-row">
        <span class="trek-card__state">${trek.state.toUpperCase()}</span>
        <span class="trek-card__rating" aria-label="Rating ${trek.rating} out of 5">
          ${SVG_STAR}
          <span>${formatRating(trek.rating)}</span>
        </span>
      </div>

      <!-- Stats row -->
      <div class="trek-card__stats" role="list">
        <div class="trek-card__stat" role="listitem">
          <span class="stat-icon" aria-hidden="true">${SVG_CLOCK}</span>
          <div class="stat-info">
            <span class="stat-value">${trek.duration}</span>
          </div>
        </div>
        <div class="trek-card__stat-divider" aria-hidden="true"></div>
        <div class="trek-card__stat" role="listitem">
          <span class="stat-icon" aria-hidden="true">${SVG_DISTANCE}</span>
          <div class="stat-info">
            <span class="stat-value">${trek.distance}</span>
          </div>
        </div>
        <div class="trek-card__stat-divider" aria-hidden="true"></div>
        <div class="trek-card__stat" role="listitem">
          <span class="stat-icon" aria-hidden="true">${SVG_ELEVATION}</span>
          <div class="stat-info">
            <span class="stat-label">SUMMIT</span>
            <span class="stat-value">${trek.highestElevation}</span>
          </div>
        </div>
      </div>

      <!-- Trek name -->
      <h3 class="trek-card__name">${trek.name}</h3>

      <!-- Best season + CTA -->
      <div class="trek-card__footer">
        <p class="trek-card__season">
          <span class="season-label">Best:</span> ${trek.bestSeason}
        </p>
        <a
          href="trek.html?state=${trek.stateSlug}&slug=${trek.slug}"
          class="trek-card__cta"
          aria-label="View details for ${trek.name}"
          id="view-${trek.id}"
        >
          View Details ${SVG_ARROW}
        </a>
      </div>
    </div>
  `;

  // Attach image fallback
  const imgEl = card.querySelector('.trek-card__image');
  attachFallback(imgEl, trek.region, trek.difficulty);

  // Attach bookmark interaction
  const bookmarkBtn = card.querySelector('.trek-card__bookmark');
  bookmarkBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const nowBookmarked = toggleBookmark(trek.id);
    bookmarkBtn.classList.toggle('trek-card__bookmark--active', nowBookmarked);
    bookmarkBtn.setAttribute('aria-pressed', String(nowBookmarked));
    bookmarkBtn.setAttribute('aria-label', nowBookmarked ? 'Remove from favourites' : 'Save to favourites');
    // Trigger bounce animation
    bookmarkBtn.classList.remove('trek-card__bookmark--bounce');
    void bookmarkBtn.offsetWidth; // reflow
    bookmarkBtn.classList.add('trek-card__bookmark--bounce');
    bookmarkBtn.addEventListener('animationend', () => {
      bookmarkBtn.classList.remove('trek-card__bookmark--bounce');
    }, { once: true });
    // Dispatch custom event for parent grid to react if needed
    card.dispatchEvent(new CustomEvent('trek:bookmark', {
      bubbles: true,
      detail: { trekId: trek.id, bookmarked: nowBookmarked }
    }));
  });

  return card;
}

/**
 * Renders an array of trek cards into a container element.
 * Previous children are cleared first.
 *
 * @param {HTMLElement} container
 * @param {import('../types/trek.js').Trek[]} treks
 */
export function renderTrekCards(container, treks) {
  // Use document fragment for performance
  const fragment = document.createDocumentFragment();
  treks.forEach(trek => fragment.appendChild(createTrekCard(trek)));
  container.innerHTML = '';
  container.appendChild(fragment);
}
