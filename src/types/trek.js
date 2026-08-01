/**
 * @file trek.js
 * @description TypeScript-style JSDoc type definitions for TrekIndia's Trek data model.
 * These types enforce a consistent data shape across all states.
 * Add new fields here when the schema grows — no UI code changes needed.
 */

/**
 * @typedef {'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult'} DifficultyLevel
 */

/**
 * @typedef {'Weekend Trek' | 'Family Friendly' | 'Monsoon Special' | 'Winter Trek'
 *  | 'Permit Required' | 'Camping' | 'Featured' | 'Popular' | 'Offbeat'
 *  | 'Forest Trail' | 'Waterfall Trek' | 'Historical Fort' | 'Sunrise Trek'
 *  | 'Snow Trek' | 'High Altitude' | 'Pilgrimage'} TrekTag
 */

/**
 * @typedef {Object} TrekCoordinates
 * @property {number} lat - Latitude
 * @property {number} lng - Longitude
 */

/**
 * @typedef {Object} Trek
 * @property {string}           id               - Unique numeric ID string (e.g. "MH001")
 * @property {string}           slug             - URL-safe identifier (e.g. "kalsubai")
 * @property {string}           name             - Full display name (e.g. "Kalsubai Peak")
 * @property {string}           state            - Human-readable state name (e.g. "Maharashtra")
 * @property {string}           stateSlug        - URL-safe state key (e.g. "maharashtra")
 * @property {string}           district         - District within the state
 * @property {string}           region           - Broader region (e.g. "Sahyadri", "Himalayan")
 * @property {DifficultyLevel}  difficulty       - Trek difficulty level
 * @property {number}           rating           - Star rating out of 5 (e.g. 4.7)
 * @property {number}           reviewCount      - Number of reviews
 * @property {string}           duration         - Human-readable duration (e.g. "2 Days")
 * @property {string}           distance         - Total trek distance (e.g. "14 km")
 * @property {string}           highestElevation - Peak elevation (e.g. "1646 m")
 * @property {string}           bestSeason       - Short season descriptor (e.g. "Oct – Mar")
 * @property {string}           bestMonths       - Verbose months (e.g. "October to March")
 * @property {string}           shortDescription - 1–2 sentence teaser for the card
 * @property {string}           description      - Full multi-paragraph description
 * @property {boolean}          featured         - Show "Featured" badge
 * @property {boolean}          popular          - Show "Popular" badge
 * @property {TrekTag[]}        tags             - Additional tag chips on the card
 * @property {TrekCoordinates}  coordinates      - GPS coordinates
 * @property {string}           [coverImage]     - Optional explicit image URL override.
 *                                                 If absent, resolved via getTrekCover().
 */

export {};
