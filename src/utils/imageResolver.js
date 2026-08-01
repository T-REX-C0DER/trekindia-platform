/**
 * @file imageResolver.js
 * @description Reusable image path resolver for all TrekIndia trek images.
 *
 * Convention:
 *   assets/treks/{stateSlug}/{trekSlug}/cover.jpg      ← primary
 *   assets/treks/{stateSlug}/{trekSlug}/gallery1.jpg   ← gallery
 *   assets/treks/{stateSlug}/{trekSlug}/gallery2.jpg
 *
 * To add a new state, simply create the folder — no code changes needed here.
 */

/**
 * Curated Unsplash fallback images indexed by difficulty/region.
 * Used when a local asset does not exist.
 * @type {Record<string, string>}
 */
const FALLBACK_IMAGES = {
  sahyadri_easy:      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80',
  sahyadri_moderate:  'https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=800&q=80',
  sahyadri_difficult: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=800&q=80',
  himalayan_easy:     'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800&q=80',
  himalayan_moderate: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  himalayan_difficult:'https://images.unsplash.com/photo-1455156218388-5e61b526818b?w=800&q=80',
  western_ghats:      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
  northeast:          'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
  default:            'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
};

/**
 * Returns the relative path to a trek's cover image.
 * Falls back gracefully if the local asset doesn't exist.
 *
 * @param {string} stateSlug  - e.g. "maharashtra", "himachal", "uttarakhand"
 * @param {string} trekSlug   - e.g. "kalsubai", "harishchandragad"
 * @param {string} [explicitUrl] - If the trek record has a coverImage field, use it directly
 * @returns {string} Image URL or relative path
 */
export function getTrekCover(stateSlug, trekSlug, explicitUrl) {
  if (explicitUrl) return explicitUrl;
  return `assets/treks/${stateSlug}/${trekSlug}/cover.jpg`;
}

/**
 * Returns a gallery image path for a trek.
 * @param {string} stateSlug
 * @param {string} trekSlug
 * @param {number} index - 1-indexed gallery image number
 * @returns {string}
 */
export function getTrekGalleryImage(stateSlug, trekSlug, index) {
  return `assets/treks/${stateSlug}/${trekSlug}/gallery${index}.jpg`;
}

/**
 * Gets a fallback image URL based on region and difficulty.
 * @param {string} region     - e.g. "Sahyadri", "Himalayan"
 * @param {string} difficulty - e.g. "Easy", "Moderate", "Difficult"
 * @returns {string}
 */
export function getFallbackImage(region, difficulty) {
  const regionKey = region.toLowerCase().replace(/\s+/g, '_');
  const diffKey   = difficulty.toLowerCase();
  const key = `${regionKey}_${diffKey}`;
  return FALLBACK_IMAGES[key] || FALLBACK_IMAGES[regionKey] || FALLBACK_IMAGES.default;
}

/**
 * Attaches an onerror handler to an <img> element so it gracefully
 * falls back to a curated Unsplash image if the local asset is missing.
 *
 * @param {HTMLImageElement} imgEl  - The image DOM element
 * @param {string} region           - Trek region
 * @param {string} difficulty       - Trek difficulty
 */
export function attachFallback(imgEl, region, difficulty) {
  imgEl.onerror = () => {
    imgEl.onerror = null; // prevent infinite loop
    imgEl.src = getFallbackImage(region, difficulty);
  };
}
