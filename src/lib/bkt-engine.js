/**
 * TrailNote Bayesian Knowledge Tracing (BKT) Engine
 * 
 * This is the "One" - the mastery quantification layer that provides
 * the quantitative foundation for all pedagogical decisions.
 * 
 * BKT is the proven standard from 30+ years of ITS research.
 * 
 * Core parameters:
 * - P(L0) probMastery: Initial probability of knowing the skill
 * - P(T) probTransit: Probability of learning per interaction
 * - P(S) probSlip: Probability of careless error (knows but answers wrong)
 * - P(G) probGuess: Probability of correct guess (doesn't know but answers right)
 * 
 * Based on OATutor implementation and Corbett & Anderson (1995)
 */

import { store } from './storage.js';
import { TrailNoteGraph } from './orchestration-graph.js';

// Storage keys
const BKT_PARAMS_KEY = 'bkt_parameters';
const BKT_MASTERY_KEY = 'bkt_mastery';
const BKT_HISTORY_KEY = 'bkt_history';
const KC_MAPPING_KEY = 'knowledge_components';

/**
 * Default BKT parameters for different concept types
 * These are empirically determined starting points that will be refined
 */
const DEFAULT_BKT_PARAMS = {
  // HTML/CSS concepts tend to have lower initial mastery but higher transit
  html_element: { probMastery: 0.15, probTransit: 0.12, probSlip: 0.08, probGuess: 0.20 },
  css_property: { probMastery: 0.12, probTransit: 0.10, probSlip: 0.10, probGuess: 0.25 },
  
  // Structural concepts have higher slip (easy to make mistakes)
  nesting: { probMastery: 0.10, probTransit: 0.15, probSlip: 0.15, probGuess: 0.15 },
  semantics: { probMastery: 0.08, probTransit: 0.12, probSlip: 0.12, probGuess: 0.18 },
  
  // Attribute concepts have higher guess (multiple choice helps)
  attributes: { probMastery: 0.18, probTransit: 0.08, probSlip: 0.06, probGuess: 0.30 },
  
  // Default fallback
  default: { probMastery: 0.15, probTransit: 0.10, probSlip: 0.10, probGuess: 0.20 }
};

/**
 * Knowledge Component (KC) structure
 * A KC represents a discrete skill or concept that can be learned
 */
class KnowledgeComponent {
  constructor(id, params = {}) {
    this.id = id;
    this.params = {
      probMastery: params.probMastery ?? DEFAULT_BKT_PARAMS.default.probMastery,
      probTransit: params.probTransit ?? DEFAULT_BKT_PARAMS.default.probTransit,
      probSlip: params.probSlip ?? DEFAULT_BKT_PARAMS.default.probSlip,
      probGuess: params.probGuess ?? DEFAULT_BKT_PARAMS.default.probGuess
    };
    this.category = params.category || 'default';
    this.description = params.description || '';
    this.relatedConcepts = params.relatedConcepts || [];
    this.prerequisiteKCs = params.prerequisiteKCs || [];
    
    // Learning analytics
    this.totalObservations = 0;
    this.correctObservations = 0;
    this.lastUpdated = Date.now();
  }

  /**
   * Validate BKT parameters are within acceptable ranges
   */
  validate() {
    const { probMastery, probTransit, probSlip, probGuess } = this.params;
    
    if (probMastery < 0 || probMastery > 1) return false;
    if (probTransit < 0 || probTransit > 1) return false;
    if (probSlip < 0 || probSlip > 0.5) return false; // Slip should be low
    if (probGuess < 0 || probGuess > 0.5) return false; // Guess should be low
    
    return true;
  }
}

/**
 * BKT Engine - Core mastery estimation and update logic
 */
export class BKTEngine {
  constructor(config = {}) {
    this.config = {
      masteryThreshold: config.masteryThreshold || 0.95,  // Consider mastered above this
      minObservations: config.minObservations || 3,        // Min observations for reliable estimate
      decayRate: config.decayRate || 0.001,                // Daily decay for forgetting
      ...config
    };
    
    this.kcs = new Map();  // Knowledge Components
    this.mastery = new Map();  // Per-user per-KC mastery estimates
    this.history = [];     // Observation history for parameter estimation
  }

  /**
   * Initialize the BKT engine with stored data
   */
  async init() {
    // Load stored KCs
    const storedKCs = await store.get(KC_MAPPING_KEY, {});
    for (const [id, kcData] of Object.entries(storedKCs)) {
      this.kcs.set(id, new KnowledgeComponent(id, kcData));
    }
    
    // Load stored mastery estimates
    const storedMastery = await store.get(BKT_MASTERY_KEY, {});
    for (const [key, value] of Object.entries(storedMastery)) {
      this.mastery.set(key, value);
    }
    
    // Load history
    this.history = await store.get(BKT_HISTORY_KEY, []);
    
    console.log(`[BKTEngine] Initialized with ${this.kcs.size} KCs, ${this.mastery.size} mastery estimates`);
  }

  /**
   * Register a Knowledge Component
   * @param {string} kcId - Unique KC identifier
   * @param {Object} params - BKT parameters and metadata
   */
  async registerKC(kcId, params = {}) {
    const kc = new KnowledgeComponent(kcId, params);
    
    if (!kc.validate()) {
      console.warn(`[BKTEngine] Invalid parameters for KC: ${kcId}, using defaults`);
      kc.params = { ...DEFAULT_BKT_PARAMS.default };
    }
    
    this.kcs.set(kcId, kc);
    await this._persistKCs();
    
    return kc;
  }

  /**
   * Get or create KC for a concept
   * @param {string} conceptId - Concept identifier
   * @param {string} category - Concept category for default params
   * @returns {KnowledgeComponent}
   */
  async getOrCreateKC(conceptId, category = 'default') {
    if (this.kcs.has(conceptId)) {
      return this.kcs.get(conceptId);
    }
    
    const defaultParams = DEFAULT_BKT_PARAMS[category] || DEFAULT_BKT_PARAMS.default;
    return this.registerKC(conceptId, { ...defaultParams, category });
  }

  /**
   * Get current mastery estimate for a KC
   * @param {string} kcId - KC identifier
   * @param {string} userId - User identifier (optional, for multi-user)
   * @returns {number} Mastery probability P(L)
   */
  getMastery(kcId, userId = 'default') {
    const key = `${userId}:${kcId}`;
    
    if (!this.mastery.has(key)) {
      // Initialize with P(L0)
      const kc = this.kcs.get(kcId);
      const initialMastery = kc ? kc.params.probMastery : DEFAULT_BKT_PARAMS.default.probMastery;
      this.mastery.set(key, {
        probability: initialMastery,
        observations: 0,
        lastUpdated: Date.now()
      });
    }
    
    const masteryData = this.mastery.get(key);
    
    // Apply time decay (forgetting)
    const daysSinceUpdate = (Date.now() - masteryData.lastUpdated) / (1000 * 60 * 60 * 24);
    const decayedMastery = masteryData.probability * Math.exp(-this.config.decayRate * daysSinceUpdate);
    
    return Math.max(0.05, decayedMastery); // Floor at 5%
  }

  /**
   * Core BKT update equation
   * Update mastery estimate based on observation
   * 
   * @param {string} kcId - KC identifier
   * @param {boolean} correct - Whether the response was correct
   * @param {string} userId - User identifier
   * @returns {Object} Updated mastery data
   */
  async updateMastery(kcId, correct, userId = 'default') {
    const kc = await this.getOrCreateKC(kcId);
    const { probTransit, probSlip, probGuess } = kc.params;
    
    const key = `${userId}:${kcId}`;
    let currentMastery = this.getMastery(kcId, userId);
    
    // BKT update equations (Corbett & Anderson, 1995)
    // P(L|correct) = P(L) * (1 - P(S)) / [P(L) * (1 - P(S)) + (1 - P(L)) * P(G)]
    // P(L|incorrect) = P(L) * P(S) / [P(L) * P(S) + (1 - P(L)) * (1 - P(G))]
    
    let newMastery;
    
    if (correct) {
      // Correct response
      const numerator = currentMastery * (1 - probSlip);
      const denominator = numerator + (1 - currentMastery) * probGuess;
      newMastery = numerator / denominator;
    } else {
      // Incorrect response
      const numerator = currentMastery * probSlip;
      const denominator = numerator + (1 - currentMastery) * (1 - probGuess);
      newMastery = numerator / denominator;
    }
    
    // Apply learning (transit probability)
    // P(L_new) = P(L|observation) + (1 - P(L|observation)) * P(T)
    newMastery = newMastery + (1 - newMastery) * probTransit;
    
    // Clamp to valid range
    newMastery = Math.min(0.99, Math.max(0.01, newMastery));
    
    // Update mastery data
    const masteryData = this.mastery.get(key) || {
      probability: kc.params.probMastery,
      observations: 0,
      lastUpdated: Date.now()
    };
    
    masteryData.probability = newMastery;
    masteryData.observations++;
    masteryData.lastUpdated = Date.now();
    
    this.mastery.set(key, masteryData);
    
    // Update KC statistics
    kc.totalObservations++;
    if (correct) kc.correctObservations++;
    kc.lastUpdated = Date.now();
    
    // Record observation for parameter estimation
    this.history.push({
      kcId,
      userId,
      correct,
      masteryBefore: currentMastery,
      masteryAfter: newMastery,
      timestamp: Date.now()
    });
    
    // Persist
    await this._persistMastery();
    await this._persistKCs();
    await this._persistHistory();
    
    return {
      kcId,
      masteryBefore: currentMastery,
      masteryAfter: newMastery,
      isMastered: newMastery >= this.config.masteryThreshold,
      observations: masteryData.observations
    };
  }

  /**
   * Predict probability of correct response
   * P(correct) = P(L) * (1 - P(S)) + (1 - P(L)) * P(G)
   * 
   * @param {string} kcId - KC identifier
   * @param {string} userId - User identifier
   * @returns {number} Probability of correct response
   */
  predictCorrect(kcId, userId = 'default') {
    const kc = this.kcs.get(kcId);
    if (!kc) return 0.5;
    
    const mastery = this.getMastery(kcId, userId);
    const { probSlip, probGuess } = kc.params;
    
    return mastery * (1 - probSlip) + (1 - mastery) * probGuess;
  }

  /**
   * Get all KCs that need practice (below mastery threshold)
   * @param {string} userId - User identifier
   * @returns {Array} KCs sorted by mastery (lowest first)
   */
  getWeakKCs(userId = 'default') {
    const weakKCs = [];
    
    for (const [kcId, kc] of this.kcs) {
      const mastery = this.getMastery(kcId, userId);
      
      if (mastery < this.config.masteryThreshold) {
        weakKCs.push({
          kcId,
          mastery,
          category: kc.category,
          observations: kc.totalObservations
        });
      }
    }
    
    // Sort by mastery (lowest first) - OATutor's "lowest mastery first" heuristic
    weakKCs.sort((a, b) => a.mastery - b.mastery);
    
    return weakKCs;
  }

  /**
   * Get mastered KCs for a user
   * @param {string} userId - User identifier
   * @returns {Array} Mastered KCs
   */
  getMasteredKCs(userId = 'default') {
    const mastered = [];
    
    for (const [kcId, kc] of this.kcs) {
      const mastery = this.getMastery(kcId, userId);
      
      if (mastery >= this.config.masteryThreshold) {
        mastered.push({
          kcId,
          mastery,
          category: kc.category,
          observations: kc.totalObservations
        });
      }
    }
    
    // Sort by mastery (highest first)
    mastered.sort((a, b) => b.mastery - a.mastery);
    
    return mastered;
  }

  /**
   * Select next KC to practice using OATutor's heuristic
   * "Lowest mastery first" - prioritize weakest skills
   * 
   * @param {string} userId - User identifier
   * @param {Array} availableKCs - KCs to choose from (optional)
   * @returns {Object|null} Selected KC or null if all mastered
   */
  selectNextKC(userId = 'default', availableKCs = null) {
    const weakKCs = availableKCs 
      ? availableKCs.map(kcId => ({
          kcId,
          mastery: this.getMastery(kcId, userId)
        })).filter(kc => kc.mastery < this.config.masteryThreshold)
      : this.getWeakKCs(userId);
    
    if (weakKCs.length === 0) return null;
    
    // Check prerequisites
    for (const weakKC of weakKCs) {
      const kc = this.kcs.get(weakKC.kcId);
      
      if (kc && kc.prerequisiteKCs.length > 0) {
        // Check if all prerequisites are mastered
        const prereqsMet = kc.prerequisiteKCs.every(prereqId => 
          this.getMastery(prereqId, userId) >= this.config.masteryThreshold
        );
        
        if (!prereqsMet) {
          // Find the weakest prerequisite instead
          const weakPrereq = kc.prerequisiteKCs
            .map(prereqId => ({
              kcId: prereqId,
              mastery: this.getMastery(prereqId, userId)
            }))
            .filter(p => p.mastery < this.config.masteryThreshold)
            .sort((a, b) => a.mastery - b.mastery)[0];
          
          if (weakPrereq) {
            return {
              ...weakPrereq,
              reason: 'prerequisite',
              forKC: weakKC.kcId
            };
          }
        }
      }
      
      // No prerequisites or all met - return this KC
      return {
        ...weakKC,
        reason: 'lowest_mastery'
      };
    }
    
    return weakKCs[0];
  }

  /**
   * Estimate BKT parameters from observation history
   * Uses EM algorithm approach (simplified)
   * 
   * @param {string} kcId - KC to estimate parameters for (optional, all if null)
   * @returns {Object} Estimated parameters
   */
  async estimateParameters(kcId = null) {
    const relevantHistory = kcId 
      ? this.history.filter(h => h.kcId === kcId)
      : this.history;
    
    if (relevantHistory.length < this.config.minObservations) {
      console.log(`[BKTEngine] Not enough observations for parameter estimation`);
      return null;
    }
    
    // Group by KC
    const byKC = {};
    for (const obs of relevantHistory) {
      if (!byKC[obs.kcId]) byKC[obs.kcId] = [];
      byKC[obs.kcId].push(obs);
    }
    
    const estimates = {};
    
    for (const [id, observations] of Object.entries(byKC)) {
      if (observations.length < this.config.minObservations) continue;
      
      const kc = this.kcs.get(id);
      if (!kc) continue;
      
      // Simplified estimation based on observed patterns
      const correctCount = observations.filter(o => o.correct).length;
      const totalCount = observations.length;
      const observedCorrectRate = correctCount / totalCount;
      
      // Estimate slip from cases where mastery was high but answer was wrong
      const highMasteryIncorrect = observations.filter(o => 
        o.masteryBefore > 0.8 && !o.correct
      );
      const slipEstimate = highMasteryIncorrect.length > 0
        ? highMasteryIncorrect.length / observations.filter(o => o.masteryBefore > 0.8).length
        : kc.params.probSlip;
      
      // Estimate guess from cases where mastery was low but answer was correct
      const lowMasteryCorrect = observations.filter(o => 
        o.masteryBefore < 0.3 && o.correct
      );
      const guessEstimate = lowMasteryCorrect.length > 0
        ? lowMasteryCorrect.length / observations.filter(o => o.masteryBefore < 0.3).length
        : kc.params.probGuess;
      
      // Estimate transit from mastery gains
      const masteryGains = observations
        .filter(o => o.masteryAfter > o.masteryBefore)
        .map(o => o.masteryAfter - o.masteryBefore);
      const transitEstimate = masteryGains.length > 0
        ? masteryGains.reduce((a, b) => a + b, 0) / masteryGains.length
        : kc.params.probTransit;
      
      estimates[id] = {
        probSlip: Math.min(0.3, slipEstimate),
        probGuess: Math.min(0.4, guessEstimate),
        probTransit: Math.min(0.3, transitEstimate),
        confidence: observations.length / 50, // Higher confidence with more data
        observations: totalCount
      };
    }
    
    return estimates;
  }

  /**
   * Apply estimated parameters to KCs
   * @param {Object} estimates - Parameter estimates from estimateParameters
   * @param {number} blendFactor - How much to blend with existing (0-1)
   */
  async applyParameterEstimates(estimates, blendFactor = 0.3) {
    if (!estimates) return;
    
    for (const [kcId, newParams] of Object.entries(estimates)) {
      const kc = this.kcs.get(kcId);
      if (!kc) continue;
      
      // Blend new estimates with existing
      kc.params.probSlip = kc.params.probSlip * (1 - blendFactor) + newParams.probSlip * blendFactor;
      kc.params.probGuess = kc.params.probGuess * (1 - blendFactor) + newParams.probGuess * blendFactor;
      kc.params.probTransit = kc.params.probTransit * (1 - blendFactor) + newParams.probTransit * blendFactor;
    }
    
    await this._persistKCs();
  }

  /**
   * Get mastery summary for a user
   * @param {string} userId - User identifier
   * @returns {Object} Mastery summary
   */
  getMasterySummary(userId = 'default') {
    const weak = this.getWeakKCs(userId);
    const mastered = this.getMasteredKCs(userId);
    const total = this.kcs.size;
    
    const avgMastery = total > 0
      ? Array.from(this.kcs.keys())
          .reduce((sum, kcId) => sum + this.getMastery(kcId, userId), 0) / total
      : 0;
    
    return {
      totalKCs: total,
      mastered: mastered.length,
      weak: weak.length,
      averageMastery: avgMastery,
      masteryRate: total > 0 ? mastered.length / total : 0,
      weakestKC: weak[0] || null,
      strongestKC: mastered[0] || null
    };
  }

  /**
   * Export BKT data for analysis or backup
   */
  async export() {
    return {
      kcs: Object.fromEntries(this.kcs),
      mastery: Object.fromEntries(this.mastery),
      history: this.history.slice(-1000), // Last 1000 observations
      config: this.config,
      exportedAt: Date.now()
    };
  }

  /**
   * Import BKT data
   * @param {Object} data - Exported BKT data
   */
  async import(data) {
    if (data.kcs) {
      for (const [id, kcData] of Object.entries(data.kcs)) {
        this.kcs.set(id, new KnowledgeComponent(id, kcData));
      }
    }
    
    if (data.mastery) {
      for (const [key, value] of Object.entries(data.mastery)) {
        this.mastery.set(key, value);
      }
    }
    
    if (data.history) {
      this.history = data.history;
    }
    
    await this._persistAll();
  }

  // Persistence helpers
  async _persistKCs() {
    const kcsData = {};
    for (const [id, kc] of this.kcs) {
      kcsData[id] = {
        id: kc.id,
        params: kc.params,
        category: kc.category,
        description: kc.description,
        relatedConcepts: kc.relatedConcepts,
        prerequisiteKCs: kc.prerequisiteKCs,
        totalObservations: kc.totalObservations,
        correctObservations: kc.correctObservations,
        lastUpdated: kc.lastUpdated
      };
    }
    await store.set(KC_MAPPING_KEY, kcsData);
  }

  async _persistMastery() {
    await store.set(BKT_MASTERY_KEY, Object.fromEntries(this.mastery));
  }

  async _persistHistory() {
    await store.set(BKT_HISTORY_KEY, this.history);
  }

  async _persistAll() {
    await Promise.all([
      this._persistKCs(),
      this._persistMastery(),
      this._persistHistory()
    ]);
  }
}

/**
 * BKT Node for Orchestration Graph
 * Integrates BKT engine into the orchestration workflow
 */
export const createBKTNodes = (bktEngine) => {
  return {
    /**
     * Update mastery based on outcome
     */
    update_mastery: async (state) => {
      if (!state.conceptId || state.outcome === null) {
        return state;
      }
      
      const correct = state.outcome === 'passed';
      const result = await bktEngine.updateMastery(state.conceptId, correct);
      
      return {
        ...state,
        masteryUpdate: result,
        currentMastery: result.masteryAfter
      };
    },

    /**
     * Select next concept based on mastery
     */
    select_next_concept: async (state) => {
      const nextKC = bktEngine.selectNextKC();
      
      if (!nextKC) {
        return {
          ...state,
          allMastered: true,
          nextConcept: null
        };
      }
      
      return {
        ...state,
        nextConcept: nextKC.kcId,
        nextConceptMastery: nextKC.mastery,
        selectionReason: nextKC.reason
      };
    },

    /**
     * Check if concept is mastered
     */
    check_mastery: async (state) => {
      if (!state.conceptId) return state;
      
      const mastery = bktEngine.getMastery(state.conceptId);
      const isMastered = mastery >= bktEngine.config.masteryThreshold;
      
      return {
        ...state,
        currentMastery: mastery,
        isMastered
      };
    },

    /**
     * Predict success probability
     */
    predict_success: async (state) => {
      if (!state.conceptId) return state;
      
      const successProb = bktEngine.predictCorrect(state.conceptId);
      
      return {
        ...state,
        predictedSuccessProbability: successProb
      };
    }
  };
};

// Export singleton instance
export const bktEngine = new BKTEngine();

export default BKTEngine;
