/**
 * TrailNote Feedback Loop
 * 
 * Closes the data loop - feeds outcomes back into system improvement.
 * This is the self-improvement cycle that makes the system get smarter with usage.
 * 
 * Flow:
 * Outcome → Update Misconception Graph
 * Outcome → Refine Intervention Effectiveness
 * Outcome → Adjust Struggle Thresholds
 * Outcome → Update Concept Difficulty Ratings
 * Outcome → Trigger Adaptive Learning Recalculation
 */

import { store } from './storage.js';
import { BKTEngine, bktEngine } from './bkt-engine.js';
import { PedagogicalEngine, pedagogicalEngine } from './pedagogical-engine.js';
import { TrailNoteGraph } from './orchestration-graph.js';

// Storage keys
const FEEDBACK_HISTORY_KEY = 'feedback_history';
const STRUGGLE_THRESHOLDS_KEY = 'struggle_thresholds';
const CONCEPT_DIFFICULTY_KEY = 'concept_difficulty';
const SYSTEM_IMPROVEMENTS_KEY = 'system_improvements';

/**
 * Default struggle thresholds
 * These are dynamically adjusted based on outcomes
 */
const DEFAULT_STRUGGLE_THRESHOLDS = {
  // Clicks on explain button before "gentle" struggle
  gentle: {
    explainClicks: 2,
    nudgeClicks: 2,
    testAttempts: 2,
    timeOnTest: 60 // seconds
  },
  // Thresholds for "active" struggle
  active: {
    explainClicks: 4,
    nudgeClicks: 4,
    testAttempts: 4,
    timeOnTest: 120
  },
  // Thresholds for "supportive" struggle
  supportive: {
    explainClicks: 6,
    nudgeClicks: 6,
    testAttempts: 6,
    timeOnTest: 180
  }
};

/**
 * Feedback Loop Engine
 * Processes outcomes and updates all dependent systems
 */
export class FeedbackLoop {
  constructor(config = {}) {
    this.config = {
      minSamplesForAdjustment: config.minSamplesForAdjustment || 10,
      adjustmentRate: config.adjustmentRate || 0.1, // How much to adjust per update
      decayRate: config.decayRate || 0.05,          // How quickly old data loses weight
      enableAutoAdjustment: config.enableAutoAdjustment ?? true,
      ...config
    };
    
    // Thresholds (concept-specific overrides)
    this.struggleThresholds = new Map();
    
    // Concept difficulty ratings (learned from outcomes)
    this.conceptDifficulty = new Map();
    
    // Feedback history for analysis
    this.feedbackHistory = [];
    
    // Pending improvements
    this.pendingImprovements = [];
  }

  /**
   * Initialize the feedback loop
   */
  async init() {
    // Load struggle thresholds
    const storedThresholds = await store.get(STRUGGLE_THRESHOLDS_KEY, {});
    for (const [conceptId, thresholds] of Object.entries(storedThresholds)) {
      this.struggleThresholds.set(conceptId, thresholds);
    }
    
    // Load concept difficulty
    const storedDifficulty = await store.get(CONCEPT_DIFFICULTY_KEY, {});
    for (const [conceptId, data] of Object.entries(storedDifficulty)) {
      this.conceptDifficulty.set(conceptId, data);
    }
    
    // Load feedback history
    this.feedbackHistory = await store.get(FEEDBACK_HISTORY_KEY, []);
    
    console.log(`[FeedbackLoop] Initialized with ${this.struggleThresholds.size} custom thresholds`);
  }

  /**
   * Process an outcome through the feedback loop
   * This is the main entry point - called when a learning event completes
   * 
   * @param {Object} outcomeData - Complete outcome information
   * @returns {Object} Feedback processing results
   */
  async processOutcome(outcomeData) {
    const {
      hintId,
      conceptId,
      misconceptionType,
      interventionStyle,
      outcome,           // 'passed' | 'failed' | 'abandoned'
      timeToOutcome,     // seconds
      struggleData,      // From struggle detector
      attemptsCount,
      userId = 'default'
    } = outcomeData;
    
    const startTime = Date.now();
    const results = {
      hintId,
      conceptId,
      outcome,
      updates: {}
    };
    
    // Record in history
    const historyEntry = {
      hintId,
      conceptId,
      misconceptionType,
      interventionStyle,
      outcome,
      timeToOutcome,
      struggleLevel: struggleData?.struggleLevel,
      attemptsCount,
      userId,
      timestamp: startTime
    };
    this.feedbackHistory.push(historyEntry);
    
    // 1. Update BKT mastery
    if (conceptId) {
      const masteryUpdate = await bktEngine.updateMastery(
        conceptId,
        outcome === 'passed',
        userId
      );
      results.updates.mastery = masteryUpdate;
    }
    
    // 2. Update misconception graph
    if (misconceptionType && interventionStyle) {
      const interventionUpdate = await pedagogicalEngine.recordInterventionOutcome(
        misconceptionType,
        interventionStyle,
        outcome === 'passed',
        timeToOutcome,
        userId
      );
      results.updates.intervention = interventionUpdate;
    }
    
    // 3. Adjust struggle thresholds (if enabled)
    if (this.config.enableAutoAdjustment && struggleData && conceptId) {
      const thresholdAdjustment = await this._adjustStruggleThresholds(
        conceptId,
        struggleData,
        outcome,
        timeToOutcome
      );
      results.updates.thresholds = thresholdAdjustment;
    }
    
    // 4. Update concept difficulty
    if (conceptId) {
      const difficultyUpdate = await this._updateConceptDifficulty(
        conceptId,
        outcome,
        timeToOutcome,
        attemptsCount
      );
      results.updates.difficulty = difficultyUpdate;
    }
    
    // 5. Detect patterns and suggest improvements
    const patterns = await this._detectPatterns(conceptId, misconceptionType);
    if (patterns.length > 0) {
      results.updates.patterns = patterns;
      this.pendingImprovements.push(...patterns);
    }
    
    // Persist
    await this._persistAll();
    
    results.processingTime = Date.now() - startTime;
    
    return results;
  }

  /**
   * Adjust struggle thresholds based on outcomes
   * If users pass quickly after few interactions, lower thresholds
   * If users struggle extensively but still fail, raise thresholds
   */
  async _adjustStruggleThresholds(conceptId, struggleData, outcome, timeToOutcome) {
    const currentThresholds = this.struggleThresholds.get(conceptId) || 
      { ...DEFAULT_STRUGGLE_THRESHOLDS };
    
    // Get historical data for this concept
    const conceptHistory = this.feedbackHistory.filter(h => h.conceptId === conceptId);
    
    if (conceptHistory.length < this.config.minSamplesForAdjustment) {
      return { adjusted: false, reason: 'insufficient_data' };
    }
    
    // Calculate optimal thresholds based on successful outcomes
    const successfulOutcomes = conceptHistory.filter(h => h.outcome === 'passed');
    
    if (successfulOutcomes.length < 5) {
      return { adjusted: false, reason: 'insufficient_successes' };
    }
    
    // Calculate average struggle indicators for successful outcomes
    const avgExplainClicks = successfulOutcomes.reduce((sum, h) => 
      sum + (h.struggleData?.actions?.explainClicks || 0), 0) / successfulOutcomes.length;
    
    const avgTestAttempts = successfulOutcomes.reduce((sum, h) => 
      sum + (h.struggleData?.actions?.testAttempts || 0), 0) / successfulOutcomes.length;
    
    const avgTimeToOutcome = successfulOutcomes.reduce((sum, h) => 
      sum + (h.timeToOutcome || 0), 0) / successfulOutcomes.length;
    
    // Adjust thresholds towards successful patterns
    const adjustment = this.config.adjustmentRate;
    const newThresholds = { ...currentThresholds };
    
    // Gentle threshold should be slightly below average successful struggle
    newThresholds.gentle = {
      explainClicks: Math.round(
        currentThresholds.gentle.explainClicks * (1 - adjustment) + 
        avgExplainClicks * adjustment
      ),
      nudgeClicks: Math.round(
        currentThresholds.gentle.nudgeClicks * (1 - adjustment) + 
        avgExplainClicks * adjustment
      ),
      testAttempts: Math.round(
        currentThresholds.gentle.testAttempts * (1 - adjustment) + 
        avgTestAttempts * adjustment
      ),
      timeOnTest: Math.round(
        currentThresholds.gentle.timeOnTest * (1 - adjustment) + 
        avgTimeToOutcome * adjustment
      )
    };
    
    // Active threshold should be at average successful struggle
    newThresholds.active = {
      explainClicks: Math.round(avgExplainClicks * 1.5),
      nudgeClicks: Math.round(avgExplainClicks * 1.5),
      testAttempts: Math.round(avgTestAttempts * 1.5),
      timeOnTest: Math.round(avgTimeToOutcome * 1.5)
    };
    
    // Supportive threshold should be higher
    newThresholds.supportive = {
      explainClicks: Math.round(avgExplainClicks * 2),
      nudgeClicks: Math.round(avgExplainClicks * 2),
      testAttempts: Math.round(avgTestAttempts * 2),
      timeOnTest: Math.round(avgTimeToOutcome * 2)
    };
    
    this.struggleThresholds.set(conceptId, newThresholds);
    
    return {
      adjusted: true,
      previousThresholds: currentThresholds,
      newThresholds,
      basedOn: successfulOutcomes.length
    };
  }

  /**
   * Update concept difficulty rating based on outcomes
   */
  async _updateConceptDifficulty(conceptId, outcome, timeToOutcome, attemptsCount) {
    let difficulty = this.conceptDifficulty.get(conceptId) || {
      rating: 0.5,           // 0-1 scale, 0.5 = medium
      totalAttempts: 0,
      successfulAttempts: 0,
      avgTimeToSuccess: null,
      avgAttempts: null,
      lastUpdated: Date.now()
    };
    
    // Update statistics
    difficulty.totalAttempts++;
    if (outcome === 'passed') {
      difficulty.successfulAttempts++;
      
      // Update average time to success
      if (timeToOutcome !== null) {
        difficulty.avgTimeToSuccess = difficulty.avgTimeToSuccess === null
          ? timeToOutcome
          : (difficulty.avgTimeToSuccess * (difficulty.successfulAttempts - 1) + timeToOutcome) / 
            difficulty.successfulAttempts;
      }
    }
    
    // Update average attempts
    if (attemptsCount !== null) {
      difficulty.avgAttempts = difficulty.avgAttempts === null
        ? attemptsCount
        : (difficulty.avgAttempts * (difficulty.totalAttempts - 1) + attemptsCount) / 
          difficulty.totalAttempts;
    }
    
    // Calculate difficulty rating
    // Based on: success rate, time to success, attempts needed
    const successRate = difficulty.successfulAttempts / difficulty.totalAttempts;
    
    // Normalize factors
    const successFactor = 1 - successRate; // Lower success = higher difficulty
    const timeFactor = Math.min(1, (difficulty.avgTimeToSuccess || 60) / 300); // Normalize to 5 min
    const attemptFactor = Math.min(1, (difficulty.avgAttempts || 1) / 5); // Normalize to 5 attempts
    
    // Weighted average
    difficulty.rating = successFactor * 0.5 + timeFactor * 0.25 + attemptFactor * 0.25;
    difficulty.lastUpdated = Date.now();
    
    this.conceptDifficulty.set(conceptId, difficulty);
    
    return {
      conceptId,
      difficulty: difficulty.rating,
      successRate,
      avgTimeToSuccess: difficulty.avgTimeToSuccess,
      avgAttempts: difficulty.avgAttempts
    };
  }

  /**
   * Detect patterns in feedback history
   */
  async _detectPatterns(conceptId, misconceptionType) {
    const patterns = [];
    
    // Pattern 1: Repeated misconception across users
    if (misconceptionType && misconceptionType !== 'unknown') {
      const misconceptionOccurrences = this.feedbackHistory.filter(
        h => h.misconceptionType === misconceptionType
      );
      
      if (misconceptionOccurrences.length >= 5) {
        const successRate = misconceptionOccurrences.filter(h => h.outcome === 'passed').length / 
          misconceptionOccurrences.length;
        
        patterns.push({
          type: 'repeated_misconception',
          misconceptionType,
          occurrences: misconceptionOccurrences.length,
          successRate,
          recommendation: successRate < 0.5 
            ? 'Consider adding prerequisite content or alternative intervention style'
            : null
        });
      }
    }
    
    // Pattern 2: Concept consistently difficult
    if (conceptId) {
      const difficulty = this.conceptDifficulty.get(conceptId);
      
      if (difficulty && difficulty.rating > 0.7 && difficulty.totalAttempts >= 10) {
        patterns.push({
          type: 'difficult_concept',
          conceptId,
          difficulty: difficulty.rating,
          successRate: difficulty.successfulAttempts / difficulty.totalAttempts,
          recommendation: 'Consider breaking into smaller concepts or adding more scaffolding'
        });
      }
    }
    
    // Pattern 3: Intervention style ineffective for misconception
    if (misconceptionType) {
      const interventionData = new Map();
      
      for (const entry of this.feedbackHistory) {
        if (entry.misconceptionType === misconceptionType && entry.interventionStyle) {
          const key = entry.interventionStyle;
          if (!interventionData.has(key)) {
            interventionData.set(key, { total: 0, success: 0 });
          }
          const data = interventionData.get(key);
          data.total++;
          if (entry.outcome === 'passed') data.success++;
        }
      }
      
      for (const [style, data] of interventionData) {
        if (data.total >= 5) {
          const successRate = data.success / data.total;
          if (successRate < 0.3) {
            patterns.push({
              type: 'ineffective_intervention',
              misconceptionType,
              interventionStyle: style,
              successRate,
              sampleSize: data.total,
              recommendation: 'Try alternative intervention style'
            });
          }
        }
      }
    }
    
    return patterns;
  }

  /**
   * Get struggle thresholds for a concept
   */
  getStruggleThresholds(conceptId) {
    return this.struggleThresholds.get(conceptId) || DEFAULT_STRUGGLE_THRESHOLDS;
  }

  /**
   * Get concept difficulty rating
   */
  getConceptDifficulty(conceptId) {
    const difficulty = this.conceptDifficulty.get(conceptId);
    return difficulty ? difficulty.rating : 0.5; // Default medium
  }

  /**
   * Get all difficult concepts (for adaptive learning)
   */
  getDifficultConcepts(threshold = 0.7) {
    const difficult = [];
    
    for (const [conceptId, data] of this.conceptDifficulty) {
      if (data.rating >= threshold && data.totalAttempts >= 5) {
        difficult.push({
          conceptId,
          difficulty: data.rating,
          successRate: data.successfulAttempts / data.totalAttempts,
          avgAttempts: data.avgAttempts
        });
      }
    }
    
    return difficult.sort((a, b) => b.difficulty - a.difficulty);
  }

  /**
   * Get pending improvements
   */
  getPendingImprovements() {
    return this.pendingImprovements;
  }

  /**
   * Clear pending improvements (after they've been addressed)
   */
  clearPendingImprovements() {
    this.pendingImprovements = [];
  }

  /**
   * Get feedback statistics
   */
  getStatistics() {
    const total = this.feedbackHistory.length;
    const passed = this.feedbackHistory.filter(h => h.outcome === 'passed').length;
    const failed = this.feedbackHistory.filter(h => h.outcome === 'failed').length;
    const abandoned = this.feedbackHistory.filter(h => h.outcome === 'abandoned').length;
    
    const avgTimeToPass = passed > 0
      ? this.feedbackHistory
          .filter(h => h.outcome === 'passed' && h.timeToOutcome)
          .reduce((sum, h) => sum + h.timeToOutcome, 0) / passed
      : null;
    
    return {
      totalOutcomes: total,
      passed,
      failed,
      abandoned,
      passRate: total > 0 ? passed / total : 0,
      avgTimeToPass,
      conceptsWithCustomThresholds: this.struggleThresholds.size,
      conceptsWithDifficultyData: this.conceptDifficulty.size,
      pendingImprovements: this.pendingImprovements.length
    };
  }

  /**
   * Export feedback data
   */
  async export() {
    return {
      struggleThresholds: Object.fromEntries(this.struggleThresholds),
      conceptDifficulty: Object.fromEntries(this.conceptDifficulty),
      feedbackHistory: this.feedbackHistory.slice(-500), // Last 500 entries
      pendingImprovements: this.pendingImprovements,
      exportedAt: Date.now()
    };
  }

  // Persistence helpers
  async _persistThresholds() {
    await store.set(STRUGGLE_THRESHOLDS_KEY, Object.fromEntries(this.struggleThresholds));
  }

  async _persistDifficulty() {
    await store.set(CONCEPT_DIFFICULTY_KEY, Object.fromEntries(this.conceptDifficulty));
  }

  async _persistHistory() {
    await store.set(FEEDBACK_HISTORY_KEY, this.feedbackHistory);
  }

  async _persistAll() {
    await Promise.all([
      this._persistThresholds(),
      this._persistDifficulty(),
      this._persistHistory()
    ]);
  }
}

/**
 * Feedback Loop Nodes for Orchestration Graph
 */
export const createFeedbackNodes = (feedbackLoop) => {
  return {
    /**
     * Process outcome through feedback loop
     */
    process_feedback: async (state) => {
      if (!state.outcome) {
        return state;
      }
      
      const result = await feedbackLoop.processOutcome({
        hintId: state.hintId,
        conceptId: state.conceptId,
        misconceptionType: state.misconceptionType,
        interventionStyle: state.interventionStyle,
        outcome: state.outcome,
        timeToOutcome: state.timeToOutcome,
        struggleData: state.struggleData,
        attemptsCount: state.attemptsCount,
        userId: state.userId || 'default'
      });
      
      return {
        ...state,
        feedbackResult: result
      };
    },

    /**
     * Check for pending improvements
     */
    check_improvements: async (state) => {
      const improvements = feedbackLoop.getPendingImprovements();
      
      if (improvements.length > 0) {
        return {
          ...state,
          pendingImprovements: improvements,
          requiresApproval: improvements.some(i => i.recommendation)
        };
      }
      
      return state;
    },

    /**
     * Get updated thresholds
     */
    get_thresholds: async (state) => {
      if (!state.conceptId) return state;
      
      const thresholds = feedbackLoop.getStruggleThresholds(state.conceptId);
      const difficulty = feedbackLoop.getConceptDifficulty(state.conceptId);
      
      return {
        ...state,
        struggleThresholds: thresholds,
        conceptDifficulty: difficulty
      };
    }
  };
};

// Export singleton instance
export const feedbackLoop = new FeedbackLoop();

export default FeedbackLoop;
