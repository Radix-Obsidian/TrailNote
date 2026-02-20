/**
 * TrailNote Learning Velocity
 * 
 * Predictive analytics for learning speed optimization.
 * 
 * Features:
 * - Time-to-mastery estimation
 * - Forgetting curve integration (FSRS4Anki patterns)
 * - Optimal review scheduling
 * - Proactive intervention triggers
 * 
 * Based on:
 * - FSRS4Anki spaced repetition algorithm
 * - Ebbinghaus forgetting curve
 * - Learning velocity research from learning@scale
 */

import { store } from './storage.js';
import { BKTEngine, bktEngine } from './bkt-engine.js';
import { feedbackLoop } from './feedback-loop.js';
import { TrailNoteGraph } from './orchestration-graph.js';

// Storage keys
const VELOCITY_PROFILES_KEY = 'velocity_profiles';
const FORGETTING_CURVES_KEY = 'forgetting_curves';
const REVIEW_SCHEDULE_KEY = 'review_schedule';
const VELOCITY_HISTORY_KEY = 'velocity_history';

/**
 * FSRS4Anki-inspired parameters for forgetting curve
 */
const FSRS_PARAMS = {
  // Default parameters (will be personalized)
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.86, 0.38, 0.65, 0.14],
  
  // Stability bounds
  minStability: 0.1,  // days
  maxStability: 365,  // days
  
  // Difficulty bounds
  minDifficulty: 1,
  maxDifficulty: 10,
  
  // Retention target
  targetRetention: 0.9
};

/**
 * Velocity factors and their weights
 */
const VELOCITY_FACTORS = {
  conceptIntrinsic: {
    weight: 0.30,
    description: 'How hard is this concept inherently?'
  },
  userHistory: {
    weight: 0.25,
    description: 'How has this user learned before?'
  },
  prerequisiteMastery: {
    weight: 0.25,
    description: 'How well do they know prerequisites?'
  },
  timeOfDay: {
    weight: 0.10,
    description: 'When is user learning?'
  },
  sessionLength: {
    weight: 0.05,
    description: 'How long has user been at it?'
  },
  recentPerformance: {
    weight: 0.05,
    description: 'Recent success rate'
  }
};

/**
 * Learning Velocity Profile
 * Tracks user's learning speed patterns
 */
class VelocityProfile {
  constructor(userId = 'default') {
    this.userId = userId;
    this.averageTimeToMastery = null;     // minutes
    this.conceptVelocity = new Map();      // conceptId → velocity data
    this.timeOfDayVelocity = new Map();    // hour → avg velocity
    this.sessionVelocity = [];             // session length → velocity
    this.totalConceptsLearned = 0;
    this.totalLearningTime = 0;            // minutes
    this.lastUpdated = Date.now();
  }

  /**
   * Get overall learning velocity (concepts per hour)
   */
  get overallVelocity() {
    if (this.totalLearningTime === 0 || this.totalConceptsLearned === 0) {
      return null;
    }
    return this.totalConceptsLearned / (this.totalLearningTime / 60);
  }
}

/**
 * Forgetting Curve Model
 * Based on FSRS4Anki algorithm
 */
class ForgettingCurve {
  constructor(conceptId) {
    this.conceptId = conceptId;
    this.stability = 1;        // Memory stability (days)
    this.difficulty = 5;       // Concept difficulty (1-10)
    this.retrievability = 1;   // Current recall probability
    this.lastReview = null;
    this.nextReview = null;
    this.reviewHistory = [];
  }

  /**
   * Calculate retrievability at a given time
   * R(t) = (1 + t/(9*stability))^-1
   */
  getRetrievability(daysSinceReview) {
    if (daysSinceReview === 0) return 1;
    return Math.pow(1 + daysSinceReview / (9 * this.stability), -1);
  }

  /**
   * Calculate optimal next review interval
   * Based on target retention
   */
  getNextInterval(targetRetention = FSRS_PARAMS.targetRetention) {
    // Solve for t where R(t) = targetRetention
    // t = stability * 9 * (R^-1 - 1)
    return this.stability * 9 * (Math.pow(targetRetention, -1) - 1);
  }

  /**
   * Update stability after a review
   * Simplified FSRS formula
   */
  updateStability(success, rating = 3) {
    // Rating: 1=again, 2=hard, 3=good, 4=easy
    
    if (success) {
      // Stability increases on successful recall
      const factor = 1 + (rating - 3) * 0.1; // Adjust by rating
      this.stability = Math.min(
        FSRS_PARAMS.maxStability,
        this.stability * (1.3 + factor * 0.2)
      );
    } else {
      // Stability decreases on failed recall
      this.stability = Math.max(
        FSRS_PARAMS.minStability,
        this.stability * 0.5
      );
    }
    
    this.lastReview = Date.now();
    this.nextReview = Date.now() + this.getNextInterval() * 24 * 60 * 60 * 1000;
  }
}

/**
 * Learning Velocity Engine
 */
export class LearningVelocity {
  constructor(config = {}) {
    this.config = {
      targetRetention: config.targetRetention || 0.9,
      minObservationsForEstimate: config.minObservationsForEstimate || 3,
      velocityDecayRate: config.velocityDecayRate || 0.1,
      ...config
    };
    
    this.profiles = new Map();         // userId → VelocityProfile
    this.forgettingCurves = new Map(); // conceptId → ForgettingCurve
    this.reviewSchedule = new Map();   // conceptId → next review time
    this.history = [];                 // Velocity history for analysis
  }

  /**
   * Initialize the velocity engine
   */
  async init() {
    // Load profiles
    const storedProfiles = await store.get(VELOCITY_PROFILES_KEY, {});
    for (const [userId, data] of Object.entries(storedProfiles)) {
      const profile = new VelocityProfile(userId);
      Object.assign(profile, data);
      if (data.conceptVelocity) {
        profile.conceptVelocity = new Map(Object.entries(data.conceptVelocity));
      }
      if (data.timeOfDayVelocity) {
        profile.timeOfDayVelocity = new Map(Object.entries(data.timeOfDayVelocity));
      }
      this.profiles.set(userId, profile);
    }
    
    // Load forgetting curves
    const storedCurves = await store.get(FORGETTING_CURVES_KEY, {});
    for (const [conceptId, data] of Object.entries(storedCurves)) {
      const curve = new ForgettingCurve(conceptId);
      Object.assign(curve, data);
      this.forgettingCurves.set(conceptId, curve);
    }
    
    // Load review schedule
    const storedSchedule = await store.get(REVIEW_SCHEDULE_KEY, {});
    for (const [conceptId, time] of Object.entries(storedSchedule)) {
      this.reviewSchedule.set(conceptId, time);
    }
    
    // Load history
    this.history = await store.get(VELOCITY_HISTORY_KEY, []);
    
    console.log(`[LearningVelocity] Initialized with ${this.profiles.size} profiles, ${this.forgettingCurves.size} curves`);
  }

  /**
   * Estimate time to mastery for a concept
   * @param {string} conceptId - Concept to estimate
   * @param {string} userId - User identifier
   * @returns {Object} Time estimate with confidence
   */
  async estimateTimeToMastery(conceptId, userId = 'default') {
    const profile = this._getProfile(userId);
    const factors = {};
    
    // Factor 1: Concept intrinsic difficulty
    const conceptDifficulty = feedbackLoop.getConceptDifficulty(conceptId);
    factors.conceptIntrinsic = {
      value: conceptDifficulty,
      weight: VELOCITY_FACTORS.conceptIntrinsic.weight,
      contribution: conceptDifficulty * VELOCITY_FACTORS.conceptIntrinsic.weight
    };
    
    // Factor 2: User history with similar concepts
    const categoryVelocity = this._getCategoryVelocity(conceptId, profile);
    factors.userHistory = {
      value: categoryVelocity || 0.5,
      weight: VELOCITY_FACTORS.userHistory.weight,
      contribution: (categoryVelocity || 0.5) * VELOCITY_FACTORS.userHistory.weight
    };
    
    // Factor 3: Prerequisite mastery
    const prereqMastery = await this._getPrerequisiteMastery(conceptId, userId);
    factors.prerequisiteMastery = {
      value: prereqMastery,
      weight: VELOCITY_FACTORS.prerequisiteMastery.weight,
      contribution: prereqMastery * VELOCITY_FACTORS.prerequisiteMastery.weight
    };
    
    // Factor 4: Time of day
    const currentHour = new Date().getHours();
    const timeVelocity = profile.timeOfDayVelocity.get(currentHour.toString()) || 1;
    factors.timeOfDay = {
      value: timeVelocity,
      weight: VELOCITY_FACTORS.timeOfDay.weight,
      contribution: timeVelocity * VELOCITY_FACTORS.timeOfDay.weight
    };
    
    // Factor 5: Session length (fatigue factor)
    const sessionLength = this._estimateSessionLength(profile);
    const fatigueFactor = Math.max(0.5, 1 - sessionLength * 0.01);
    factors.sessionLength = {
      value: fatigueFactor,
      weight: VELOCITY_FACTORS.sessionLength.weight,
      contribution: fatigueFactor * VELOCITY_FACTORS.sessionLength.weight
    };
    
    // Factor 6: Recent performance
    const recentPerf = this._getRecentPerformance(profile);
    factors.recentPerformance = {
      value: recentPerf,
      weight: VELOCITY_FACTORS.recentPerformance.weight,
      contribution: recentPerf * VELOCITY_FACTORS.recentPerformance.weight
    };
    
    // Calculate weighted estimate
    const totalContribution = Object.values(factors).reduce((sum, f) => sum + f.contribution, 0);
    const totalWeight = Object.values(VELOCITY_FACTORS).reduce((sum, f) => sum + f.weight, 0);
    
    // Base time estimate (minutes) - medium difficulty concept
    const baseTime = 15; // 15 minutes for average concept
    
    // Adjust by factors (lower contribution = faster learning)
    const adjustedTime = baseTime * (1 + totalContribution / totalWeight);
    
    // Apply user's overall velocity
    const userVelocity = profile.overallVelocity || 1;
    const finalEstimate = adjustedTime / userVelocity;
    
    // Calculate confidence based on data availability
    const confidence = this._calculateEstimateConfidence(profile, conceptId);
    
    return {
      conceptId,
      estimatedMinutes: Math.round(finalEstimate),
      confidence,
      factors,
      breakdown: {
        baseTime,
        difficultyAdjustment: adjustedTime / baseTime,
        velocityAdjustment: 1 / userVelocity
      }
    };
  }

  /**
   * Identify velocity blockers - what's slowing learning
   */
  async identifyVelocityBlockers(conceptId, userId = 'default') {
    const blockers = [];
    const profile = this._getProfile(userId);
    
    // Check prerequisite gaps
    const prereqMastery = await this._getPrerequisiteMastery(conceptId, userId);
    if (prereqMastery < 0.7) {
      blockers.push({
        type: 'prerequisite_gap',
        severity: 1 - prereqMastery,
        description: 'Missing prerequisite knowledge',
        recommendation: 'Review prerequisite concepts before continuing'
      });
    }
    
    // Check concept difficulty
    const difficulty = feedbackLoop.getConceptDifficulty(conceptId);
    if (difficulty > 0.7) {
      blockers.push({
        type: 'high_difficulty',
        severity: difficulty,
        description: 'Concept is inherently difficult',
        recommendation: 'Allow extra time and use scaffolded approach'
      });
    }
    
    // Check time of day
    const currentHour = new Date().getHours();
    const timeVelocity = profile.timeOfDayVelocity.get(currentHour.toString()) || 1;
    if (timeVelocity < 0.8) {
      blockers.push({
        type: 'suboptimal_time',
        severity: 1 - timeVelocity,
        description: 'Learning at a less productive time',
        recommendation: 'Consider scheduling complex concepts for peak hours'
      });
    }
    
    // Check session fatigue
    const sessionLength = this._estimateSessionLength(profile);
    if (sessionLength > 30) {
      blockers.push({
        type: 'session_fatigue',
        severity: Math.min(1, sessionLength / 60),
        description: 'Extended session may cause fatigue',
        recommendation: 'Consider taking a break'
      });
    }
    
    // Check recent struggles
    const recentPerf = this._getRecentPerformance(profile);
    if (recentPerf < 0.5) {
      blockers.push({
        type: 'recent_struggles',
        severity: 1 - recentPerf,
        description: 'Recent performance below average',
        recommendation: 'Review recent concepts or try different approach'
      });
    }
    
    return blockers.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Suggest optimal learning conditions
   */
  async suggestOptimalConditions(userId = 'default') {
    const profile = this._getProfile(userId);
    const suggestions = [];
    
    // Find best time of day
    let bestHour = null;
    let bestVelocity = 0;
    
    for (const [hour, velocity] of profile.timeOfDayVelocity) {
      if (velocity > bestVelocity) {
        bestVelocity = velocity;
        bestHour = parseInt(hour);
      }
    }
    
    if (bestHour !== null) {
      suggestions.push({
        type: 'optimal_time',
        value: bestHour,
        description: `Best learning time: ${bestHour}:00 - ${bestHour + 1}:00`,
        impact: `~${Math.round((bestVelocity - 1) * 100)}% faster learning`
      });
    }
    
    // Suggest session length
    const avgSessionLength = profile.sessionVelocity.length > 0
      ? profile.sessionVelocity.reduce((a, b) => a + b.length, 0) / profile.sessionVelocity.length
      : 20;
    
    suggestions.push({
      type: 'session_length',
      value: Math.min(45, avgSessionLength),
      description: `Optimal session length: ~${Math.round(avgSessionLength)} minutes`,
      impact: 'Maximizes retention while avoiding fatigue'
    });
    
    // Suggest concepts to review
    const dueForReview = await this.getConceptsDueForReview(userId);
    if (dueForReview.length > 0) {
      suggestions.push({
        type: 'review_due',
        value: dueForReview.slice(0, 3),
        description: `${dueForReview.length} concepts due for review`,
        impact: 'Prevents forgetting and reinforces learning'
      });
    }
    
    return suggestions;
  }

  /**
   * Track velocity progress and update profile
   */
  async trackVelocityProgress(conceptId, actualTime, success, userId = 'default') {
    const profile = this._getProfile(userId);
    
    // Update concept velocity
    let conceptVel = profile.conceptVelocity.get(conceptId) || {
      attempts: 0,
      totalTime: 0,
      successes: 0
    };
    
    conceptVel.attempts++;
    conceptVel.totalTime += actualTime;
    if (success) conceptVel.successes++;
    
    profile.conceptVelocity.set(conceptId, conceptVel);
    
    // Update time of day velocity
    const hour = new Date().getHours().toString();
    let timeVel = profile.timeOfDayVelocity.get(hour) || {
      sessions: 0,
      avgVelocity: 1
    };
    
    // Velocity = concepts learned per hour
    const sessionVelocity = success ? 60 / actualTime : 0;
    timeVel.avgVelocity = (timeVel.avgVelocity * timeVel.sessions + sessionVelocity) / (timeVel.sessions + 1);
    timeVel.sessions++;
    
    profile.timeOfDayVelocity.set(hour, timeVel);
    
    // Update overall stats
    if (success) {
      profile.totalConceptsLearned++;
      profile.totalLearningTime += actualTime;
    }
    
    profile.lastUpdated = Date.now();
    
    // Update forgetting curve
    const curve = this._getForgettingCurve(conceptId);
    curve.updateStability(success);
    curve.reviewHistory.push({
      timestamp: Date.now(),
      success,
      timeToReview: actualTime
    });
    
    // Update review schedule
    this.reviewSchedule.set(conceptId, curve.nextReview);
    
    // Record in history
    this.history.push({
      conceptId,
      userId,
      actualTime,
      success,
      timestamp: Date.now()
    });
    
    // Persist
    await this._persistAll();
    
    return {
      conceptVelocity: conceptVel.successes / conceptVel.attempts,
      timeOfDayVelocity: timeVel.avgVelocity,
      overallVelocity: profile.overallVelocity
    };
  }

  /**
   * Get concepts due for review
   */
  async getConceptsDueForReview(userId = 'default') {
    const now = Date.now();
    const due = [];
    
    for (const [conceptId, nextReview] of this.reviewSchedule) {
      if (nextReview <= now) {
        const curve = this.forgettingCurves.get(conceptId);
        due.push({
          conceptId,
          retrievability: curve ? curve.getRetrievability(
            (now - curve.lastReview) / (24 * 60 * 60 * 1000)
          ) : 0.5,
          daysOverdue: Math.round((now - nextReview) / (24 * 60 * 60 * 1000))
        });
      }
    }
    
    // Sort by retrievability (lowest first = most urgent)
    due.sort((a, b) => a.retrievability - b.retrievability);
    
    return due;
  }

  /**
   * Predict success probability for a concept
   */
  async predictSuccessProbability(conceptId, userId = 'default') {
    // Get BKT mastery
    const mastery = bktEngine.getMastery(conceptId, userId);
    
    // Get retrievability (if reviewed before)
    const curve = this.forgettingCurves.get(conceptId);
    let retrievability = 1;
    
    if (curve && curve.lastReview) {
      const daysSinceReview = (Date.now() - curve.lastReview) / (24 * 60 * 60 * 1000);
      retrievability = curve.getRetrievability(daysSinceReview);
    }
    
    // Combine factors
    const successProb = mastery * retrievability;
    
    return {
      probability: successProb,
      mastery,
      retrievability,
      recommendation: successProb < 0.5 ? 'Review recommended' : 'Ready to proceed'
    };
  }

  /**
   * Get velocity statistics
   */
  getStatistics(userId = 'default') {
    const profile = this._getProfile(userId);
    
    return {
      totalConceptsLearned: profile.totalConceptsLearned,
      totalLearningTime: profile.totalLearningTime,
      overallVelocity: profile.overallVelocity,
      averageTimePerConcept: profile.totalConceptsLearned > 0
        ? profile.totalLearningTime / profile.totalConceptsLearned
        : null,
      conceptsTracked: profile.conceptVelocity.size,
      reviewQueueSize: this.reviewSchedule.size,
      dueForReview: Array.from(this.reviewSchedule.values()).filter(t => t <= Date.now()).length
    };
  }

  // Helper methods
  _getProfile(userId) {
    if (!this.profiles.has(userId)) {
      this.profiles.set(userId, new VelocityProfile(userId));
    }
    return this.profiles.get(userId);
  }

  _getForgettingCurve(conceptId) {
    if (!this.forgettingCurves.has(conceptId)) {
      this.forgettingCurves.set(conceptId, new ForgettingCurve(conceptId));
    }
    return this.forgettingCurves.get(conceptId);
  }

  _getCategoryVelocity(conceptId, profile) {
    // Get velocity for concepts in same category
    // Simplified: use overall average
    const velocities = Array.from(profile.conceptVelocity.values())
      .map(v => v.successes / v.attempts);
    
    if (velocities.length === 0) return null;
    return velocities.reduce((a, b) => a + b, 0) / velocities.length;
  }

  async _getPrerequisiteMastery(conceptId, userId) {
    // Get prerequisite concepts from concept graph
    // For now, use BKT to check mastery
    const mastery = bktEngine.getMastery(conceptId, userId);
    return mastery;
  }

  _estimateSessionLength(profile) {
    // Estimate current session length in minutes
    const recentHistory = this.history
      .filter(h => h.userId === profile.userId && Date.now() - h.timestamp < 60 * 60 * 1000)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (recentHistory.length === 0) return 0;
    
    const firstEvent = recentHistory[recentHistory.length - 1].timestamp;
    return (Date.now() - firstEvent) / (60 * 1000);
  }

  _getRecentPerformance(profile) {
    const recentHistory = this.history
      .filter(h => h.userId === profile.userId && Date.now() - h.timestamp < 24 * 60 * 60 * 1000);
    
    if (recentHistory.length === 0) return 1;
    
    const successes = recentHistory.filter(h => h.success).length;
    return successes / recentHistory.length;
  }

  _calculateEstimateConfidence(profile, conceptId) {
    let confidence = 0.5; // Base confidence
    
    // Increase with more user history
    if (profile.totalConceptsLearned >= 5) confidence += 0.1;
    if (profile.totalConceptsLearned >= 10) confidence += 0.1;
    if (profile.totalConceptsLearned >= 20) confidence += 0.1;
    
    // Increase with concept-specific data
    if (profile.conceptVelocity.has(conceptId)) {
      const data = profile.conceptVelocity.get(conceptId);
      if (data.attempts >= 3) confidence += 0.1;
    }
    
    // Increase with time-of-day data
    if (profile.timeOfDayVelocity.size >= 3) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  // Persistence helpers
  async _persistProfiles() {
    const data = {};
    for (const [userId, profile] of this.profiles) {
      data[userId] = {
        userId: profile.userId,
        averageTimeToMastery: profile.averageTimeToMastery,
        conceptVelocity: Object.fromEntries(profile.conceptVelocity),
        timeOfDayVelocity: Object.fromEntries(profile.timeOfDayVelocity),
        sessionVelocity: profile.sessionVelocity,
        totalConceptsLearned: profile.totalConceptsLearned,
        totalLearningTime: profile.totalLearningTime,
        lastUpdated: profile.lastUpdated
      };
    }
    await store.set(VELOCITY_PROFILES_KEY, data);
  }

  async _persistCurves() {
    const data = {};
    for (const [conceptId, curve] of this.forgettingCurves) {
      data[conceptId] = {
        conceptId: curve.conceptId,
        stability: curve.stability,
        difficulty: curve.difficulty,
        retrievability: curve.retrievability,
        lastReview: curve.lastReview,
        nextReview: curve.nextReview,
        reviewHistory: curve.reviewHistory.slice(-10) // Keep last 10
      };
    }
    await store.set(FORGETTING_CURVES_KEY, data);
  }

  async _persistSchedule() {
    await store.set(REVIEW_SCHEDULE_KEY, Object.fromEntries(this.reviewSchedule));
  }

  async _persistHistory() {
    await store.set(VELOCITY_HISTORY_KEY, this.history.slice(-500));
  }

  async _persistAll() {
    await Promise.all([
      this._persistProfiles(),
      this._persistCurves(),
      this._persistSchedule(),
      this._persistHistory()
    ]);
  }
}

/**
 * Velocity Nodes for Orchestration Graph
 */
export const createVelocityNodes = (learningVelocity) => {
  return {
    /**
     * Estimate time to mastery
     */
    estimate_mastery_time: async (state) => {
      if (!state.conceptId) return state;
      
      const estimate = await learningVelocity.estimateTimeToMastery(
        state.conceptId,
        state.userId || 'default'
      );
      
      return {
        ...state,
        estimatedTimeToMastery: estimate.estimatedMinutes,
        masteryEstimateConfidence: estimate.confidence,
        velocityFactors: estimate.factors
      };
    },

    /**
     * Identify velocity blockers
     */
    identify_blockers: async (state) => {
      if (!state.conceptId) return state;
      
      const blockers = await learningVelocity.identifyVelocityBlockers(
        state.conceptId,
        state.userId || 'default'
      );
      
      return {
        ...state,
        velocityBlockers: blockers,
        hasVelocityBlockers: blockers.length > 0
      };
    },

    /**
     * Track velocity progress
     */
    track_velocity: async (state) => {
      if (!state.conceptId || !state.outcome) return state;
      
      const result = await learningVelocity.trackVelocityProgress(
        state.conceptId,
        state.timeToOutcome || 0,
        state.outcome === 'passed',
        state.userId || 'default'
      );
      
      return {
        ...state,
        velocityUpdate: result
      };
    },

    /**
     * Check if review is due
     */
    check_review_due: async (state) => {
      const due = await learningVelocity.getConceptsDueForReview(state.userId || 'default');
      
      const currentConceptDue = due.find(d => d.conceptId === state.conceptId);
      
      return {
        ...state,
        conceptsDueForReview: due,
        currentConceptNeedsReview: !!currentConceptDue,
        reviewRetrievability: currentConceptDue?.retrievability
      };
    },

    /**
     * Predict success probability
     */
    predict_success: async (state) => {
      if (!state.conceptId) return state;
      
      const prediction = await learningVelocity.predictSuccessProbability(
        state.conceptId,
        state.userId || 'default'
      );
      
      return {
        ...state,
        predictedSuccessProb: prediction.probability,
        masteryLevel: prediction.mastery,
        retrievability: prediction.retrievability,
        reviewRecommended: prediction.recommendation === 'Review recommended'
      };
    }
  };
};

// Export singleton instance
export const learningVelocity = new LearningVelocity();

export default LearningVelocity;
