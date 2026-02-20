/**
 * TrailNote Platform Concept Router
 * 
 * Unified entry point for loading platform-specific concept taxonomies.
 * Used by concept-graph.js to extend CORE_CONCEPTS based on the active platform.
 */

import FCC_CONCEPTS from './fcc-concepts.js';
import UDEMY_CONCEPTS from './udemy-concepts.js';
import CODECADEMY_CONCEPTS from './codecademy-concepts.js';
import LEETCODE_CONCEPTS from './leetcode-concepts.js';

const PLATFORM_CONCEPT_MAP = {
  'freecodecamp': FCC_CONCEPTS,
  'udemy': UDEMY_CONCEPTS,
  'codecademy': CODECADEMY_CONCEPTS,
  'leetcode': LEETCODE_CONCEPTS,
  // Scrimba, Coursera, Khan Academy, HackerRank use generic concepts for now
  // They can be extended with dedicated taxonomy files later
};

/**
 * Get concepts for a specific platform
 * @param {string} platformId - Platform identifier (e.g. 'freecodecamp', 'udemy')
 * @returns {Object} Concept taxonomy map
 */
export function getConceptsForPlatform(platformId) {
  return PLATFORM_CONCEPT_MAP[platformId] || {};
}

/**
 * Get all concepts across all platforms (merged)
 * @returns {Object} Combined concept taxonomy
 */
export function getAllPlatformConcepts() {
  const merged = {};
  for (const concepts of Object.values(PLATFORM_CONCEPT_MAP)) {
    Object.assign(merged, concepts);
  }
  return merged;
}

/**
 * Check if a platform has a dedicated concept taxonomy
 * @param {string} platformId
 * @returns {boolean}
 */
export function hasDedicatedTaxonomy(platformId) {
  return platformId in PLATFORM_CONCEPT_MAP;
}

export { FCC_CONCEPTS, UDEMY_CONCEPTS, CODECADEMY_CONCEPTS, LEETCODE_CONCEPTS };
export default { getConceptsForPlatform, getAllPlatformConcepts, hasDedicatedTaxonomy };
