/**
 * HintHopper A/B Testing Framework
 * Allows for testing different hint variations and tracking their performance
 */

import { store } from './storage.js';

// Constants
const AB_VARIANTS_KEY = 'ab_variants';
const AB_ASSIGNMENTS_KEY = 'ab_assignments';
const AB_RESULTS_KEY = 'ab_results';

// Default variant data
const DEFAULT_VARIANTS = {
  // Maps test pattern IDs to their variant data
};

// Default assignments data
const DEFAULT_ASSIGNMENTS = {
  // Maps test fingerprints to assigned variant IDs
};

// Default results data
const DEFAULT_RESULTS = {
  // Maps variant IDs to their performance metrics
};

/**
 * The A/B testing manager for hint variations
 */
export const abTesting = {
  /**
   * Get all defined hint variants
   * @return {Object} The variants object
   */
  async getVariants() {
    return await store.get(AB_VARIANTS_KEY, DEFAULT_VARIANTS);
  },
  
  /**
   * Create or update a hint variant
   * @param {string} patternId - ID for the test pattern (e.g., "link-inside-first-p")
   * @param {string} variantId - Unique ID for this variant
   * @param {Object} variantData - Data for the variant
   */
  async saveVariant(patternId, variantId, variantData) {
    const variants = await this.getVariants();
    
    // Initialize pattern if it doesn't exist
    if (!variants[patternId]) {
      variants[patternId] = {};
    }
    
    // Save the variant
    variants[patternId][variantId] = {
      ...variantData,
      created: variantData.created || Date.now(),
      updated: Date.now()
    };
    
    await store.set(AB_VARIANTS_KEY, variants);
    return variantId;
  },
  
  /**
   * Get variants for a specific test pattern
   * @param {string} patternId - ID for the test pattern
   * @return {Object} Map of variant IDs to their data
   */
  async getVariantsForPattern(patternId) {
    const variants = await this.getVariants();
    return variants[patternId] || {};
  },
  
  /**
   * Assign a variant to a specific test instance
   * @param {string} testFingerprint - Fingerprint of the test
   * @param {string} patternId - ID of the test pattern
   * @return {Object} The assigned variant data
   */
  async assignVariant(testFingerprint, patternId) {
    // Get variants for this pattern
    const patternVariants = await this.getVariantsForPattern(patternId);
    const variantIds = Object.keys(patternVariants);
    
    // If no variants defined, return null
    if (variantIds.length === 0) {
      return null;
    }
    
    // Get existing assignments
    const assignments = await store.get(AB_ASSIGNMENTS_KEY, DEFAULT_ASSIGNMENTS);
    
    // Check if this test already has an assignment
    if (assignments[testFingerprint]) {
      const assignedId = assignments[testFingerprint];
      // Make sure the assigned variant still exists
      if (patternVariants[assignedId]) {
        return patternVariants[assignedId];
      }
    }
    
    // No existing assignment or assigned variant no longer exists
    // Perform a 50/50 split based on hash of fingerprint
    const hash = this._hashCode(testFingerprint);
    const variantIndex = Math.abs(hash) % variantIds.length;
    const selectedVariantId = variantIds[variantIndex];
    
    // Store the assignment
    assignments[testFingerprint] = selectedVariantId;
    await store.set(AB_ASSIGNMENTS_KEY, assignments);
    
    return patternVariants[selectedVariantId];
  },
  
  /**
   * Record outcome for a variant
   * @param {string} variantId - ID of the variant
   * @param {boolean} passed - Whether the test was passed
   * @param {number} timeToPass - Time to pass in minutes (optional)
   */
  async recordOutcome(variantId, passed, timeToPass = null) {
    const results = await store.get(AB_RESULTS_KEY, DEFAULT_RESULTS);
    
    // Initialize variant results if needed
    if (!results[variantId]) {
      results[variantId] = {
        total: 0,
        passed: 0,
        passWithin10m: 0,
        timeToPassSum: 0,
        lastUpdated: Date.now()
      };
    }
    
    // Update results
    const variant = results[variantId];
    variant.total++;
    
    if (passed) {
      variant.passed++;
      
      if (timeToPass !== null) {
        variant.timeToPassSum += timeToPass;
        if (timeToPass <= 10) {
          variant.passWithin10m++;
        }
      }
    }
    
    variant.lastUpdated = Date.now();
    
    await store.set(AB_RESULTS_KEY, results);
    return results[variantId];
  },
  
  /**
   * Get results for all variants
   * @return {Object} The results object
   */
  async getResults() {
    return await store.get(AB_RESULTS_KEY, DEFAULT_RESULTS);
  },
  
  /**
   * Get results for variants of a specific pattern
   * @param {string} patternId - ID of the pattern
   * @return {Object} Results for the pattern's variants
   */
  async getResultsForPattern(patternId) {
    const variants = await this.getVariantsForPattern(patternId);
    const allResults = await this.getResults();
    
    const patternResults = {};
    
    for (const variantId of Object.keys(variants)) {
      if (allResults[variantId]) {
        patternResults[variantId] = {
          ...allResults[variantId],
          data: variants[variantId]
        };
      }
    }
    
    return patternResults;
  },
  
  /**
   * Find the winning variant for a pattern
   * @param {string} patternId - ID of the pattern
   * @param {string} metric - Metric to use for comparison ('passRate' or 'passWithin10Rate')
   * @return {string|null} ID of the winning variant, or null if no clear winner
   */
  async getWinningVariant(patternId, metric = 'passWithin10Rate') {
    const results = await this.getResultsForPattern(patternId);
    
    let highestScore = -1;
    let winner = null;
    let isTie = false;
    
    for (const [variantId, data] of Object.entries(results)) {
      if (data.total < 5) {
        // Need minimum 5 data points
        continue;
      }
      
      let score;
      if (metric === 'passRate') {
        score = data.passed / data.total;
      } else if (metric === 'passWithin10Rate') {
        score = data.passWithin10m / data.total;
      } else {
        // Default to pass within 10m rate
        score = data.passWithin10m / data.total;
      }
      
      // Check if this is a winner or a tie
      if (score > highestScore) {
        highestScore = score;
        winner = variantId;
        isTie = false;
      } else if (score === highestScore) {
        isTie = true;
      }
    }
    
    // Return winner only if not a tie
    return isTie ? null : winner;
  },
  
  /**
   * Simple hash function for strings
   * @private
   * @param {string} str - String to hash
   * @return {number} Hash code
   */
  _hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash;
  }
};

// Add some initial test variants
(async function initializeDefaultVariants() {
  try {
    // Only add if there are no existing variants
    const variants = await store.get(AB_VARIANTS_KEY, DEFAULT_VARIANTS);
    if (Object.keys(variants).length === 0) {
      // Create example variants for link-inside-first-p pattern
      await abTesting.saveVariant('link-inside-first-p', 'v1-standard', {
        name: 'Standard Hint',
        prompt: 'Check if your anchor tag is correctly placed inside the first paragraph.',
        systemPrompt: 'Focus on the structural relationship between elements.',
        created: Date.now()
      });
      
      await abTesting.saveVariant('link-inside-first-p', 'v2-detailed', {
        name: 'Detailed Hint',
        prompt: 'Examine the nesting of your anchor tag. HTML requires specific parent-child relationships between elements.',
        systemPrompt: 'Provide more detailed explanation about element nesting.',
        created: Date.now()
      });
      
      console.log('[HintHopper] Initialized default A/B test variants');
    }
  } catch (err) {
    console.warn('[HintHopper] Failed to initialize default A/B test variants:', err);
  }
})();

export default abTesting;
