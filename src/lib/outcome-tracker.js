// HintHopper Outcome Tracker
// Privacy-first analytics for tracking learning outcomes
// Requires explicit user opt-in

import { store } from './storage.js';
import { createHash } from './utils.js';

// Outcome tracking constants
const OUTCOME_STORE_KEY = 'outcome_metrics';
const OUTCOME_CONSENT_KEY = 'improve_bunji_enabled';
const SESSION_START_KEY = 'session_start_time';

// Default outcome metrics object structure
const DEFAULT_OUTCOMES = {
  hints: [],        // Array of hint outcome objects
  sessions: [],     // Array of session summaries
  concepts: {},     // Concept mastery tracking
  optIn: false,     // User consent status
  lastSync: null,   // Last server sync timestamp (future use)
};

// Core tracking functionality
export const outcomeTracker = {
  // Check if user has opted in to outcome tracking
  async isEnabled() {
    return await store.get(OUTCOME_CONSENT_KEY, false);
  },
  
  // Enable or disable outcome tracking
  async setEnabled(enabled) {
    console.log(`[HintHopper] Outcome tracking ${enabled ? 'enabled' : 'disabled'}`);
    return await store.set(OUTCOME_CONSENT_KEY, !!enabled);
  },
  
  // Start a learning session
  async startSession() {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return;
    
    // Record session start time
    const timestamp = Date.now();
    await store.set(SESSION_START_KEY, timestamp);
    
    // Add session to metrics
    const outcomes = await this._getOutcomes();
    outcomes.sessions.push({
      startTime: timestamp,
      endTime: null,
      hintsUsed: 0,
      conceptsViewed: [],
      challengeCompleted: false,
    });
    
    await this._saveOutcomes(outcomes);
    console.log('[HintHopper] New learning session started');
  },
  
  // End current learning session
  async endSession(completed = false) {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return;
    
    const outcomes = await this._getOutcomes();
    const startTime = await store.get(SESSION_START_KEY, null);
    if (!startTime) return;
    
    // Update the most recent session
    if (outcomes.sessions.length > 0) {
      const currentSession = outcomes.sessions[outcomes.sessions.length - 1];
      currentSession.endTime = Date.now();
      currentSession.challengeCompleted = completed;
      
      await this._saveOutcomes(outcomes);
      console.log('[HintHopper] Learning session ended');
    }
  },
  
  // Track a hint was provided
  async trackHintDelivered(mode, context, hintObj) {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return;
    
    // Create a fingerprint for the failing test
    const testFingerprint = this._createTestFingerprint(context);
    const conceptKey = this._extractConceptKey(hintObj, context);
    const hintVersion = hintObj?.version || '1.0';
    
    // Create hint record
    const hintRecord = {
      timestamp: Date.now(),
      testFingerprint,
      conceptKey,
      hintVersion,
      hintMode: mode,
      sessionId: await store.get(SESSION_START_KEY, null),
      timeToPass: null,
      wasPassed: false,
    };
    
    // Save to outcome storage
    const outcomes = await this._getOutcomes();
    outcomes.hints.push(hintRecord);
    
    // Update current session
    if (outcomes.sessions.length > 0) {
      const currentSession = outcomes.sessions[outcomes.sessions.length - 1];
      currentSession.hintsUsed++;
      
      if (conceptKey && !currentSession.conceptsViewed.includes(conceptKey)) {
        currentSession.conceptsViewed.push(conceptKey);
      }
    }
    
    await this._saveOutcomes(outcomes);
    console.log('[HintHopper] Hint delivery tracked:', {testFingerprint, conceptKey, mode});
    
    // Return the hint ID so it can be referenced when checking for a pass
    return hintRecord.timestamp;
  },
  
  // Track a test was passed after hint
  async trackTestPass(hintId) {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return;
    
    const outcomes = await this._getOutcomes();
    const hintIndex = outcomes.hints.findIndex(h => h.timestamp === hintId);
    
    if (hintIndex >= 0) {
      const hint = outcomes.hints[hintIndex];
      const now = Date.now();
      const timeToPass = Math.round((now - hint.timestamp) / (1000 * 60)); // minutes
      
      // Update hint with pass data
      hint.timeToPass = timeToPass;
      hint.wasPassed = true;
      hint.passTimestamp = now;
      hint.passedWithin10m = timeToPass <= 10;
      
      // Update concept mastery
      if (hint.conceptKey) {
        if (!outcomes.concepts[hint.conceptKey]) {
          outcomes.concepts[hint.conceptKey] = {
            lastPassed: now,
            passTimes: [],
            avgTimeToPass: 0
          };
        }
        
        const concept = outcomes.concepts[hint.conceptKey];
        concept.lastPassed = now;
        concept.passTimes.push(timeToPass);
        // Calculate average
        concept.avgTimeToPass = concept.passTimes.reduce((a, b) => a + b, 0) / concept.passTimes.length;
      }
      
      await this._saveOutcomes(outcomes);
      console.log('[HintHopper] Test pass tracked:', {
        hintId, 
        timeToPass, 
        conceptKey: hint.conceptKey,
        passedWithin10m: hint.passedWithin10m
      });
    }
  },
  
  // Get effectiveness statistics for a concept
  async getConceptStats(conceptKey) {
    if (!conceptKey) return null;
    
    const conceptStats = await this.getAllConceptStats();
    return conceptStats[conceptKey] || null;
  },
  
  // Get overall outcome statistics across all concepts
  async getOverallStats() {
    const outcomes = await this._getOutcomes();
    
    let totalHints = 0;
    let passedHints = 0;
    let passedWithin10Min = 0;
    let totalTimeToPass = 0;
    let timeToPassCount = 0;
    
    // Calculate overall statistics
    for (const hint of outcomes.hints) {
      totalHints++;
      
      if (hint.wasPassed) {
        passedHints++;
        
        // Calculate time to pass
        if (hint.passTimestamp && hint.timestamp) {
          const timeToPass = Math.round((hint.passTimestamp - hint.timestamp) / (60 * 1000)); // minutes
          totalTimeToPass += timeToPass;
          timeToPassCount++;
          
          if (timeToPass <= 10) {
            passedWithin10Min++;
          }
        }
      }
    }
    
    // Calculate aggregate metrics
    const passRate = totalHints > 0 ? passedHints / totalHints : 0;
    const passWithin10Rate = totalHints > 0 ? passedWithin10Min / totalHints : 0;
    const avgTimeToPass = timeToPassCount > 0 ? totalTimeToPass / timeToPassCount : null;
    
    // Get session count and first session date
    const sessionCount = outcomes.sessions.length;
    const sessionDates = outcomes.sessions.map(s => s.startTime);
    const firstSessionDate = sessionDates.length > 0 ? Math.min(...sessionDates) : null;
    
    return {
      totalHints,
      passedHints,
      passedWithin10Min,
      passRate,
      passWithin10Rate,
      avgTimeToPass,
      sessionCount,
      firstSessionDate,
      daysSinceStart: firstSessionDate ? Math.floor((Date.now() - firstSessionDate) / (24 * 60 * 60 * 1000)) : 0
    };
  },
  
  /**
   * Get statistics for all concepts
   * @return {Object} Map of concept keys to their statistics
   */
  async getAllConceptStats() {
    const outcomes = await this._getOutcomes();
    
    // If no consent, return empty stats
    if (!outcomes.optIn) {
      return {};
    }
    
    // Group hints by concept
    const conceptMap = {};
    
    for (const hint of outcomes.hints) {
      const conceptKey = hint.conceptKey || 'unknown';
      
      if (!conceptMap[conceptKey]) {
        conceptMap[conceptKey] = {
          hints: [],
          totalHints: 0,
          passedHints: 0,
          passedWithin10Min: 0,
          timeToPassSum: 0,
          timeToPassCount: 0
        };
      }
      
      conceptMap[conceptKey].hints.push(hint);
      conceptMap[conceptKey].totalHints++;
      
      if (hint.wasPassed) {
        conceptMap[conceptKey].passedHints++;
        
        // Calculate time to pass
        if (hint.passTimestamp && hint.timestamp) {
          const timeToPass = (hint.passTimestamp - hint.timestamp) / (60 * 1000); // minutes
          conceptMap[conceptKey].timeToPassSum += timeToPass;
          conceptMap[conceptKey].timeToPassCount++;
          
          if (timeToPass <= 10) {
            conceptMap[conceptKey].passedWithin10Min++;
          }
        }
      }
    }
    
    // Calculate stats for each concept
    const conceptStats = {};
    
    for (const [conceptKey, data] of Object.entries(conceptMap)) {
      const passRate = data.totalHints > 0 ? data.passedHints / data.totalHints : 0;
      const passWithin10Rate = data.totalHints > 0 ? data.passedWithin10Min / data.totalHints : 0;
      const avgTimeToPass = data.timeToPassCount > 0 ? data.timeToPassSum / data.timeToPassCount : null;
      
      conceptStats[conceptKey] = {
        totalHints: data.totalHints,
        passedHints: data.passedHints,
        passedWithin10Min: data.passedWithin10Min,
        passRate,
        passWithin10Rate,
        avgTimeToPass
      };
    }
    
    return conceptStats;
  },
  
  // Private: Get current outcome metrics
  async _getOutcomes() {
    const outcomes = await store.get(OUTCOME_STORE_KEY, DEFAULT_OUTCOMES);
    outcomes.optIn = await this.isEnabled();
    return outcomes;
  },
  
  // Private: Save outcome metrics
  async _saveOutcomes(outcomes) {
    return await store.set(OUTCOME_STORE_KEY, outcomes);
  },
  
  // Private: Create a fingerprint for a failing test
  _createTestFingerprint(context) {
    // Use only the first failing test for fingerprinting
    const test = (context.tests && context.tests.length > 0) ? context.tests[0] : '';
    // Keep it simple for now - hash the test text
    return createHash(test);
  },
  
  // Private: Extract concept key from hint or context
  _extractConceptKey(hintObj, context) {
    // Try to get concept from hint object
    if (hintObj && hintObj.concept_key) {
      return hintObj.concept_key;
    }
    
    // Try to get from context
    if (context && context.conceptId) {
      return context.conceptId;
    }
    
    // Create from first test
    if (context && context.tests && context.tests.length > 0) {
      return createHash(context.tests[0]).substr(0, 8);
    }
    
    return 'unknown-concept';
  },
  
  // Get privacy receipt for current session
  async getPrivacyReceipt() {
    const isEnabled = await this.isEnabled();
    const sessionStart = await store.get(SESSION_START_KEY, null);
    
    return {
      trackingEnabled: isEnabled,
      sessionStarted: sessionStart ? new Date(sessionStart).toISOString() : null,
      dataCollected: isEnabled ? [
        'Anonymous test fingerprints (never the full test)',
        'Concept identifiers',
        'Time between hint and pass/fail',
        'Session durations',
      ] : [],
      notCollected: [
        'Your code',
        'Your personal information',
        'Your browsing history'
      ]
    };
  },
  
  // Clear all collected outcome data
  async clearAllData() {
    await store.set(OUTCOME_STORE_KEY, DEFAULT_OUTCOMES);
    console.log('[HintHopper] All outcome data cleared');
    return true;
  }
};

// Export for global use
export default outcomeTracker;
