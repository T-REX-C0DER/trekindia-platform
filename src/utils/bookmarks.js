/**
 * @file bookmarks.js
 * @description localStorage-backed bookmark/favourite manager.
 * Works for all states — bookmark keys are prefixed with state slug.
 * No UI logic. Pure data layer.
 */

const STORAGE_KEY = 'trekindia_bookmarks';

/**
 * Loads all bookmarks from localStorage.
 * @returns {Set<string>} Set of bookmarked trek IDs (e.g. "MH001")
 */
export function loadBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Saves the bookmark set to localStorage.
 * @param {Set<string>} bookmarks
 */
export function saveBookmarks(bookmarks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded, etc.)
  }
}

/**
 * Toggles a trek's bookmark state and returns the new state.
 * @param {string} trekId
 * @returns {boolean} true if now bookmarked, false if removed
 */
export function toggleBookmark(trekId) {
  const bookmarks = loadBookmarks();
  if (bookmarks.has(trekId)) {
    bookmarks.delete(trekId);
    saveBookmarks(bookmarks);
    return false;
  } else {
    bookmarks.add(trekId);
    saveBookmarks(bookmarks);
    return true;
  }
}

/**
 * Checks if a trek is currently bookmarked.
 * @param {string} trekId
 * @returns {boolean}
 */
export function isBookmarked(trekId) {
  return loadBookmarks().has(trekId);
}

/**
 * Returns all bookmarked trek IDs as an array.
 * @returns {string[]}
 */
export function getBookmarkedIds() {
  return [...loadBookmarks()];
}
