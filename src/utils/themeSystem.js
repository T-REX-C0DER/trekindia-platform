/**
 * @file themeSystem.js
 * @description Dynamic state theme system for TrekIndia.
 * Defines color tokens, hero gradients, badge styling, and accent tones for every state destination.
 */

/**
 * @typedef {Object} StateTheme
 * @property {string} name
 * @property {string} primary
 * @property {string} primaryHover
 * @property {string} secondary
 * @property {string} accent
 * @property {string} bgGradient
 * @property {string} heroOverlay
 * @property {string} badgeBg
 * @property {string} badgeBorder
 * @property {string} badgeText
 * @property {string} buttonBg
 * @property {string} buttonHover
 * @property {string} chipActiveBg
 * @property {string} chipActiveText
 */

/** @type {Record<string, StateTheme>} */
export const STATE_THEMES = {
  maharashtra: {
    name: 'Maharashtra',
    primary: '#d97706',
    primaryHover: '#b45309',
    secondary: '#b45309',
    accent: '#f59e0b',
    bgGradient: 'linear-gradient(180deg, rgba(217, 119, 6, 0.15) 0%, rgba(15, 20, 16, 0) 100%)',
    heroOverlay: 'linear-gradient(180deg, rgba(15, 20, 16, 0.6) 0%, rgba(15, 20, 16, 0.95) 100%)',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
    badgeBorder: 'rgba(217, 119, 6, 0.3)',
    badgeText: '#f59e0b',
    buttonBg: '#d97706',
    buttonHover: '#b45309',
    chipActiveBg: '#d97706',
    chipActiveText: '#ffffff',
  },
  karnataka: {
    name: 'Karnataka',
    primary: '#15803d',       // Deep Forest Green
    primaryHover: '#166534',  // Dark Forest Green
    secondary: '#047857',     // Emerald / Moss
    accent: '#10b981',        // Bright Emerald Accent
    bgGradient: 'linear-gradient(180deg, rgba(21, 128, 61, 0.18) 0%, rgba(11, 22, 16, 0) 100%)',
    heroOverlay: 'linear-gradient(180deg, rgba(8, 26, 16, 0.65) 0%, rgba(8, 26, 16, 0.96) 100%)',
    badgeBg: 'rgba(34, 197, 94, 0.15)',
    badgeBorder: 'rgba(34, 197, 94, 0.35)',
    badgeText: '#4ade80',
    buttonBg: '#15803d',
    buttonHover: '#166534',
    chipActiveBg: '#15803d',
    chipActiveText: '#ffffff',
  },
  himachal: {
    name: 'Himachal Pradesh',
    primary: '#0284c7',
    primaryHover: '#0369a1',
    secondary: '#0891b2',
    accent: '#38bdf8',
    bgGradient: 'linear-gradient(180deg, rgba(2, 132, 199, 0.18) 0%, rgba(15, 23, 42, 0) 100%)',
    heroOverlay: 'linear-gradient(180deg, rgba(15, 23, 42, 0.65) 0%, rgba(15, 23, 42, 0.95) 100%)',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.35)',
    badgeText: '#38bdf8',
    buttonBg: '#0284c7',
    buttonHover: '#0369a1',
    chipActiveBg: '#0284c7',
    chipActiveText: '#ffffff',
  },
  uttarakhand: {
    name: 'Uttarakhand',
    primary: '#059669',
    primaryHover: '#047857',
    secondary: '#0d9488',
    accent: '#34d399',
    bgGradient: 'linear-gradient(180deg, rgba(5, 150, 105, 0.18) 0%, rgba(15, 23, 42, 0) 100%)',
    heroOverlay: 'linear-gradient(180deg, rgba(6, 30, 24, 0.65) 0%, rgba(6, 30, 24, 0.95) 100%)',
    badgeBg: 'rgba(52, 211, 153, 0.15)',
    badgeBorder: 'rgba(52, 211, 153, 0.35)',
    badgeText: '#34d399',
    buttonBg: '#059669',
    buttonHover: '#047857',
    chipActiveBg: '#059669',
    chipActiveText: '#ffffff',
  },
  ladakh: {
    name: 'Ladakh',
    primary: '#d97706',
    primaryHover: '#b45309',
    secondary: '#eab308',
    accent: '#fbbf24',
    bgGradient: 'linear-gradient(180deg, rgba(217, 119, 6, 0.18) 0%, rgba(24, 18, 12, 0) 100%)',
    heroOverlay: 'linear-gradient(180deg, rgba(24, 18, 12, 0.65) 0%, rgba(24, 18, 12, 0.95) 100%)',
    badgeBg: 'rgba(251, 191, 36, 0.15)',
    badgeBorder: 'rgba(251, 191, 36, 0.35)',
    badgeText: '#fbbf24',
    buttonBg: '#d97706',
    buttonHover: '#b45309',
    chipActiveBg: '#d97706',
    chipActiveText: '#ffffff',
  },
  kerala: {
    name: 'Kerala',
    primary: '#16a34a',
    primaryHover: '#15803d',
    secondary: '#059669',
    accent: '#4ade80',
    bgGradient: 'linear-gradient(180deg, rgba(22, 163, 74, 0.18) 0%, rgba(12, 24, 16, 0) 100%)',
    heroOverlay: 'linear-gradient(180deg, rgba(12, 24, 16, 0.65) 0%, rgba(12, 24, 16, 0.95) 100%)',
    badgeBg: 'rgba(74, 222, 128, 0.15)',
    badgeBorder: 'rgba(74, 222, 128, 0.35)',
    badgeText: '#4ade80',
    buttonBg: '#16a34a',
    buttonHover: '#15803d',
    chipActiveBg: '#16a34a',
    chipActiveText: '#ffffff',
  },
  goa: {
    name: 'Goa',
    primary: '#0284c7',
    primaryHover: '#0369a1',
    secondary: '#06b6d4',
    accent: '#38bdf8',
    bgGradient: 'linear-gradient(180deg, rgba(2, 132, 199, 0.18) 0%, rgba(15, 23, 42, 0) 100%)',
    heroOverlay: 'linear-gradient(180deg, rgba(15, 23, 42, 0.65) 0%, rgba(15, 23, 42, 0.95) 100%)',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.35)',
    badgeText: '#38bdf8',
    buttonBg: '#0284c7',
    buttonHover: '#0369a1',
    chipActiveBg: '#0284c7',
    chipActiveText: '#ffffff',
  },
};

/**
 * Retrieves state theme by slug. Falls back to Maharashtra theme if not found.
 * @param {string} stateSlug
 * @returns {StateTheme}
 */
export function getStateTheme(stateSlug) {
  return STATE_THEMES[stateSlug] || STATE_THEMES['maharashtra'];
}

/**
 * Applies state theme CSS variables to document root or container element.
 * @param {string} stateSlug
 * @param {HTMLElement} [element]
 */
export function applyStateTheme(stateSlug, element = document.documentElement) {
  const theme = getStateTheme(stateSlug);
  element.setAttribute('data-state-theme', stateSlug);
  
  element.style.setProperty('--theme-primary', theme.primary);
  element.style.setProperty('--theme-primary-hover', theme.primaryHover);
  element.style.setProperty('--theme-secondary', theme.secondary);
  element.style.setProperty('--theme-accent', theme.accent);
  element.style.setProperty('--theme-bg-gradient', theme.bgGradient);
  element.style.setProperty('--theme-hero-overlay', theme.heroOverlay);
  element.style.setProperty('--theme-badge-bg', theme.badgeBg);
  element.style.setProperty('--theme-badge-border', theme.badgeBorder);
  element.style.setProperty('--theme-badge-text', theme.badgeText);
  element.style.setProperty('--theme-button-bg', theme.buttonBg);
  element.style.setProperty('--theme-button-hover', theme.buttonHover);
  element.style.setProperty('--theme-chip-active-bg', theme.chipActiveBg);
  element.style.setProperty('--theme-chip-active-text', theme.chipActiveText);
}
