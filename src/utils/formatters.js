/**
 * @file formatters.js
 * @description Pure utility functions for formatting trek data for display.
 * No UI logic. No side effects. Safe to use in any context.
 */

/**
 * Formats a rating number to one decimal place with a star.
 * @param {number} rating
 * @returns {string} e.g. "4.7"
 */
export function formatRating(rating) {
  return Number(rating).toFixed(1);
}

/**
 * Maps difficulty to a short display label and CSS class.
 * @param {string} difficulty
 * @returns {{ label: string, cls: string, color: string }}
 */
export function getDifficultyMeta(difficulty) {
  const map = {
    'Easy':          { label: 'Easy',           cls: 'badge--easy',       color: '#16a34a' },
    'Moderate':      { label: 'Moderate',        cls: 'badge--moderate',   color: '#d97706' },
    'Difficult':     { label: 'Difficult',       cls: 'badge--difficult',  color: '#dc2626' },
    'Very Difficult':{ label: 'Very Difficult',  cls: 'badge--very-hard',  color: '#7c3aed' },
  };
  return map[difficulty] || { label: difficulty, cls: 'badge--moderate', color: '#d97706' };
}

/**
 * Maps tag names to display labels and icon characters.
 * @param {string} tag
 * @returns {{ label: string, icon: string }}
 */
export function getTagMeta(tag) {
  const map = {
    'Weekend Trek':     { label: 'Weekend',      icon: '⚡' },
    'Family Friendly':  { label: 'Family',       icon: '👨‍👩‍👧' },
    'Monsoon Special':  { label: 'Monsoon',      icon: '🌧️' },
    'Winter Trek':      { label: 'Winter',       icon: '❄️' },
    'Permit Required':  { label: 'Permit',       icon: '🪪' },
    'Camping':          { label: 'Camping',      icon: '⛺' },
    'Featured':         { label: 'Featured',     icon: '⭐' },
    'Popular':          { label: 'Popular',      icon: '🔥' },
    'Offbeat':          { label: 'Offbeat',      icon: '🗺️' },
    'Forest Trail':     { label: 'Forest',       icon: '🌿' },
    'Waterfall Trek':   { label: 'Waterfall',    icon: '💧' },
    'Historical Fort':  { label: 'Fort Trek',    icon: '🏰' },
    'Sunrise Trek':     { label: 'Sunrise',      icon: '🌅' },
    'Snow Trek':        { label: 'Snow',         icon: '⛄' },
    'High Altitude':    { label: 'High Alt.',    icon: '🏔️' },
    'Pilgrimage':       { label: 'Pilgrimage',   icon: '🙏' },
  };
  return map[tag] || { label: tag, icon: '🏷️' };
}

/**
 * Returns the state display name from its slug.
 * @param {string} stateSlug
 * @returns {string}
 */
export function stateSlugToName(stateSlug) {
  const map = {
    maharashtra:    'Maharashtra',
    himachal:       'Himachal Pradesh',
    uttarakhand:    'Uttarakhand',
    'jammu-kashmir':'Jammu & Kashmir',
    ladakh:         'Ladakh',
    karnataka:      'Karnataka',
    kerala:         'Kerala',
    goa:            'Goa',
    rajasthan:      'Rajasthan',
    sikkim:         'Sikkim',
    meghalaya:      'Meghalaya',
    arunachal:      'Arunachal Pradesh',
    nepal:          'Nepal',
    'west-bengal':  'West Bengal',
    nagaland:       'Nagaland',
  };
  return map[stateSlug] || stateSlug;
}

/**
 * Filters an array of treks by search query (name, district, tags).
 * @param {import('../types/trek.js').Trek[]} treks
 * @param {string} query
 * @returns {import('../types/trek.js').Trek[]}
 */
export function filterBySearch(treks, query) {
  if (!query.trim()) return treks;
  const q = query.toLowerCase();
  return treks.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.district.toLowerCase().includes(q) ||
    (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
    t.region.toLowerCase().includes(q)
  );
}

/**
 * Filters an array of treks by difficulty.
 * @param {import('../types/trek.js').Trek[]} treks
 * @param {string} difficulty - 'All' to disable filter
 * @returns {import('../types/trek.js').Trek[]}
 */
export function filterByDifficulty(treks, difficulty) {
  if (!difficulty || difficulty === 'All') return treks;
  return treks.filter(t => t.difficulty === difficulty);
}

/**
 * Filters an array of treks by tag.
 * @param {import('../types/trek.js').Trek[]} treks
 * @param {string[]} tags - Empty array = no filter
 * @returns {import('../types/trek.js').Trek[]}
 */
export function filterByTags(treks, tags) {
  if (!tags || tags.length === 0) return treks;
  return treks.filter(t =>
    tags.every(tag => {
      if (tag === 'Featured') return t.featured;
      if (tag === 'Popular')  return t.popular;
      return (t.tags || []).includes(tag);
    })
  );
}

/**
 * Sorts treks by a given sort key.
 * @param {import('../types/trek.js').Trek[]} treks
 * @param {'rating' | 'duration' | 'elevation' | 'name'} sortKey
 * @returns {import('../types/trek.js').Trek[]}
 */
export function sortTreks(treks, sortKey) {
  const sorted = [...treks];
  switch (sortKey) {
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'duration':
      return sorted.sort((a, b) => parseDays(a.duration) - parseDays(b.duration));
    case 'elevation':
      return sorted.sort((a, b) => parseMeters(b.highestElevation) - parseMeters(a.highestElevation));
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}

/** @param {string} dur e.g. "2 Days" → 2 */
function parseDays(dur) {
  const m = dur.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

/** @param {string} elev e.g. "1646 m" → 1646 */
function parseMeters(elev) {
  const m = (elev || '').match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}
