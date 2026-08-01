/**
 * @file index.js
 * @description Central data registry for all Indian states and Nepal.
 *
 * To add a new state:
 * 1. Create `src/data/{stateSlug}.js` with the trek array
 * 2. Import it here and add it to STATE_REGISTRY
 * 3. No UI code changes required — the components are state-agnostic
 */

import { maharashtrasTreks } from './maharashtra.js';

/**
 * Registry of all available state trek datasets.
 * Key = stateSlug, Value = Trek[]
 * @type {Record<string, import('../types/trek.js').Trek[]>}
 */
export const STATE_REGISTRY = {
  maharashtra: maharashtrasTreks,
  // himachal:    himachalTreks,       ← add when data is ready
  // uttarakhand: uttarakhandTreks,
  // ladakh:      ladakhTreks,
  // karnataka:   karnatakaTreks,
  // kerala:      keralaTreks,
  // sikkim:      sikkimTreks,
  // meghalaya:   meghalayaTreks,
  // nepal:       nepalTreks,
};

/**
 * Returns all treks for a given state slug.
 * @param {string} stateSlug
 * @returns {import('../types/trek.js').Trek[]}
 */
export function getTreksByState(stateSlug) {
  return STATE_REGISTRY[stateSlug] || [];
}

/**
 * Returns a single trek by its ID across all states.
 * @param {string} id - Trek ID (e.g. "MH001")
 * @returns {import('../types/trek.js').Trek | undefined}
 */
export function getTrekById(id) {
  return Object.values(STATE_REGISTRY)
    .flat()
    .find(t => t.id === id);
}

/**
 * Returns a single trek by state + slug.
 * @param {string} stateSlug
 * @param {string} trekSlug
 * @returns {import('../types/trek.js').Trek | undefined}
 */
export function getTrekBySlug(stateSlug, trekSlug) {
  return (STATE_REGISTRY[stateSlug] || []).find(t => t.slug === trekSlug);
}

/**
 * Returns an array of all registered state slugs.
 * @returns {string[]}
 */
export function getRegisteredStates() {
  return Object.keys(STATE_REGISTRY);
}
