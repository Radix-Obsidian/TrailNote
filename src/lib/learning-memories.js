/**
 * TrailNote Learning Memories
 * 
 * Cursor-style persistent knowledge that survives across sessions.
 * 
 * Features:
 * - Sidecar observer model that watches learning interactions
 * - Auto-generates "learning rules" (e.g., "User prefers scaffolded hints for CSS")
 * - User approval flow before rules are persisted
 * - Long-term memory persistence
 * 
 * This creates switching costs - the system learns the user's learning style
 * and becomes more valuable over time.
 */

import { store } from './storage.js';
import { TrailNoteGraph } from './orchestration-graph.js';
import { feedbackLoop } from './feedback-loop.js';
import { pedagogicalEngine } from './pedagogical-engine.js';

// Storage keys
const LEARNING_MEMORIES_KEY = 'learning_memories';
const PENDING_APPROVALS_KEY = 'pending_approvals';
const USER_RULES_KEY = 'user_rules';
const OBSERVATION_BUFFER_KEY = 'observation_buffer';

/**
 * Types of learning memories
 */
const MEMORY_TYPES = {
  PREFERENCE: {
    id: 'preference',
    name: 'Learning Preference',
    description: 'User\'s preferred learning style or approach',
    examples: ['prefers_scaffolded_hints', 'prefers_visual_explanations']
  },
  PATTERN: {
    id: 'pattern',
    name: 'Learning Pattern',
    description: 'Observed pattern in user\'s learning behavior',
    examples: ['struggles_with_nesting', 'quick_at_attributes']
  },
  CONTEXT: {
    id: 'context',
    name: 'Context Preference',
    description: 'Preferences based on context (time, difficulty, etc.)',
    examples: ['prefers_direct_when_frustrated', 'slower_in_evening']
  },
  INSIGHT: {
    id: 'insight',
    name: 'Learning Insight',
    description: 'Self-reported or inferred insight about learning',
    examples: ['needs_practice_on_selectors', 'learned_from_analogy']
  }
};

/**
 * Rule categories for user-approved learning rules
 */
const RULE_CATEGORIES = {
  INTERVENTION_STYLE: {
    id: 'intervention_style',
    name: 'Intervention Style',
    description: 'Preferred hint or help style',
    priority: 1
  },
  CONCEPT_APPROACH: {
    id: 'concept_approach',
    name: 'Concept Approach',
    description: 'How to approach specific concept types',
    priority: 2
  },
  TIMING: {
    id: 'timing',
    name: 'Timing Preferences',
    description: 'When and how often to intervene',
    priority: 3
  },
  DIFFICULTY: {
    id: 'difficulty',
    name: 'Difficulty Handling',
    description: 'How to handle difficult concepts',
    priority: 2
  }
};

/**
 * Learning Memory Entry
 */
class LearningMemory {
  constructor(type, data = {}) {
    this.id = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.key = data.key || '';
    this.value = data.value || {};
    this.confidence = data.confidence || 0.5;
    this.source = data.source || 'observed'; // 'observed' | 'user_reported' | 'inferred'
    this.category = data.category || null;
    this.approved = data.approved || false;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.accessCount = 0;
    this.evidence = data.evidence || []; // Supporting observations
  }
}

/**
 * Pending Approval Entry
 */
class PendingApproval {
  constructor(memory, reason = '') {
    this.id = `approval_${Date.now()}`;
    this.memory = memory;
    this.reason = reason;
    this.createdAt = Date.now();
    this.status = 'pending'; // 'pending' | 'approved' | 'rejected' | 'expired'
    this.userResponse = null;
  }
}

/**
 * Sidecar Observer
 * Watches learning interactions and suggests memories to save
 */
class SidecarObserver {
  constructor(config = {}) {
    this.config = {
      minObservations: config.minObservations || 3,
      confidenceThreshold: config.confidenceThreshold || 0.7,
      observationWindow: config.observationWindow || 100, // Keep last 100 observations
      ...config
    };
    
    this.observationBuffer = [];
    this.detectedPatterns = [];
  }

  /**
   * Record an observation for pattern detection
   */
  observe(event) {
    const observation = {
      type: event.type, // 'hint_request' | 'outcome' | 'struggle' | 'preference_signal'
      conceptId: event.conceptId,
      misconceptionType: event.misconceptionType,
      interventionStyle: event.interventionStyle,
      outcome: event.outcome,
      timeToOutcome: event.timeToOutcome,
      struggleLevel: event.struggleLevel,
      timestamp: Date.now(),
      metadata: event.metadata || {}
    };
    
    this.observationBuffer.push(observation);
    
    // Trim buffer
    if (this.observationBuffer.length > this.config.observationWindow) {
      this.observationBuffer = this.observationBuffer.slice(-this.config.observationWindow);
    }
    
    // Check for patterns
    return this._checkForPatterns(observation);
  }

  /**
   * Check if observation reveals a pattern
   */
  _checkForPatterns(observation) {
    const suggestions = [];
    
    // Pattern 1: Consistent intervention style preference
    const stylePreference = this._detectStylePreference();
    if (stylePreference) {
      suggestions.push(stylePreference);
    }
    
    // Pattern 2: Concept-specific struggles
    const conceptStruggle = this._detectConceptStruggle(observation);
    if (conceptStruggle) {
      suggestions.push(conceptStruggle);
    }
    
    // Pattern 3: Time-based patterns
    const timePattern = this._detectTimePattern();
    if (timePattern) {
      suggestions.push(timePattern);
    }
    
    // Pattern 4: Misconception-specific patterns
    const misconceptionPattern = this._detectMisconceptionPattern(observation);
    if (misconceptionPattern) {
      suggestions.push(misconceptionPattern);
    }
    
    return suggestions;
  }

  /**
   * Detect consistent intervention style preference
   */
  _detectStylePreference() {
    const hintRequests = this.observationBuffer.filter(o => o.type === 'hint_request');
    
    if (hintRequests.length < this.config.minObservations) return null;
    
    // Count style usage
    const styleCounts = {};
    const styleSuccesses = {};
    
    for (const obs of hintRequests) {
      if (obs.interventionStyle) {
        styleCounts[obs.interventionStyle] = (styleCounts[obs.interventionStyle] || 0) + 1;
        
        // Check if this style led to success
        const subsequentOutcome = this.observationBuffer.find(o => 
          o.type === 'outcome' && 
          o.conceptId === obs.conceptId && 
          o.timestamp > obs.timestamp &&
          o.timestamp < obs.timestamp + 300000 // Within 5 minutes
        );
        
        if (subsequentOutcome?.outcome === 'passed') {
          styleSuccesses[obs.interventionStyle] = (styleSuccesses[obs.interventionStyle] || 0) + 1;
        }
      }
    }
    
    // Find dominant style with good success rate
    let dominantStyle = null;
    let maxCount = 0;
    
    for (const [style, count] of Object.entries(styleCounts)) {
      if (count > maxCount && count >= this.config.minObservations) {
        const successRate = styleSuccesses[style] ? styleSuccesses[style] / count : 0;
        if (successRate > 0.5) {
          dominantStyle = style;
          maxCount = count;
        }
      }
    }
    
    if (dominantStyle) {
      const confidence = Math.min(1, maxCount / 10);
      
      if (confidence >= this.config.confidenceThreshold) {
        return {
          type: MEMORY_TYPES.PREFERENCE.id,
          key: 'preferred_intervention_style',
          value: { style: dominantStyle },
          confidence,
          source: 'observed',
          category: RULE_CATEGORIES.INTERVENTION_STYLE.id,
          evidence: hintRequests.filter(o => o.interventionStyle === dominantStyle).slice(-5)
        };
      }
    }
    
    return null;
  }

  /**
   * Detect concept-specific struggle patterns
   */
  _detectConceptStruggle(observation) {
    if (observation.type !== 'outcome') return null;
    
    const conceptObservations = this.observationBuffer.filter(o => o.conceptId === observation.conceptId);
    
    if (conceptObservations.length < this.config.minObservations) return null;
    
    const struggles = conceptObservations.filter(o => o.struggleLevel && o.struggleLevel !== 'none');
    const failures = conceptObservations.filter(o => o.outcome === 'failed');
    
    const struggleRate = struggles.length / conceptObservations.length;
    const failureRate = failures.length / conceptObservations.filter(o => o.outcome).length;
    
    if (struggleRate > 0.6 || failureRate > 0.4) {
      return {
        type: MEMORY_TYPES.PATTERN.id,
        key: `struggles_with_${observation.conceptId}`,
        value: {
          conceptId: observation.conceptId,
          struggleRate,
          failureRate,
          suggestedApproach: failureRate > 0.4 ? 'scaffolded' : 'analogical'
        },
        confidence: Math.min(1, conceptObservations.length / 10),
        source: 'observed',
        category: RULE_CATEGORIES.CONCEPT_APPROACH.id,
        evidence: conceptObservations.slice(-5)
      };
    }
    
    return null;
  }

  /**
   * Detect time-based patterns
   */
  _detectTimePattern() {
    const outcomes = this.observationBuffer.filter(o => o.type === 'outcome' && o.timeToOutcome);
    
    if (outcomes.length < this.config.minObservations * 2) return null;
    
    // Group by time of day
    const byHour = {};
    
    for (const obs of outcomes) {
      const hour = new Date(obs.timestamp).getHours();
      if (!byHour[hour]) {
        byHour[hour] = { total: 0, totalTime: 0, successes: 0 };
      }
      byHour[hour].total++;
      byHour[hour].totalTime += obs.timeToOutcome;
      if (obs.outcome === 'passed') byHour[hour].successes++;
    }
    
    // Find best and worst hours
    let bestHour = null;
    let worstHour = null;
    let bestSuccessRate = 0;
    let worstSuccessRate = 1;
    
    for (const [hour, data] of Object.entries(byHour)) {
      if (data.total < 3) continue;
      
      const successRate = data.successes / data.total;
      const avgTime = data.totalTime / data.total;
      
      if (successRate > bestSuccessRate) {
        bestSuccessRate = successRate;
        bestHour = { hour: parseInt(hour), successRate, avgTime };
      }
      
      if (successRate < worstSuccessRate) {
        worstSuccessRate = successRate;
        worstHour = { hour: parseInt(hour), successRate, avgTime };
      }
    }
    
    if (bestHour && worstHour && bestSuccessRate - worstSuccessRate > 0.3) {
      return {
        type: MEMORY_TYPES.CONTEXT.id,
        key: 'optimal_learning_time',
        value: {
          bestHour: bestHour.hour,
          bestSuccessRate: bestHour.successRate,
          worstHour: worstHour.hour,
          worstSuccessRate: worstHour.successRate
        },
        confidence: Math.min(1, outcomes.length / 20),
        source: 'observed',
        category: RULE_CATEGORIES.TIMING.id,
        evidence: outcomes.slice(-5)
      };
    }
    
    return null;
  }

  /**
   * Detect misconception-specific patterns
   */
  _detectMisconceptionPattern(observation) {
    if (!observation.misconceptionType || observation.misconceptionType === 'unknown') return null;
    
    const misconceptionObservations = this.observationBuffer.filter(
      o => o.misconceptionType === observation.misconceptionType
    );
    
    if (misconceptionObservations.length < this.config.minObservations) return null;
    
    // Find most effective intervention for this misconception
    const styleOutcomes = {};
    
    for (const obs of misconceptionObservations) {
      if (obs.interventionStyle && obs.outcome) {
        if (!styleOutcomes[obs.interventionStyle]) {
          styleOutcomes[obs.interventionStyle] = { total: 0, successes: 0 };
        }
        styleOutcomes[obs.interventionStyle].total++;
        if (obs.outcome === 'passed') {
          styleOutcomes[obs.interventionStyle].successes++;
        }
      }
    }
    
    let bestStyle = null;
    let bestSuccessRate = 0;
    
    for (const [style, data] of Object.entries(styleOutcomes)) {
      if (data.total >= 2) {
        const successRate = data.successes / data.total;
        if (successRate > bestSuccessRate) {
          bestSuccessRate = successRate;
          bestStyle = style;
        }
      }
    }
    
    if (bestStyle && bestSuccessRate > 0.6) {
      return {
        type: MEMORY_TYPES.PATTERN.id,
        key: `effective_for_${observation.misconceptionType}`,
        value: {
          misconceptionType: observation.misconceptionType,
          effectiveStyle: bestStyle,
          successRate: bestSuccessRate
        },
        confidence: Math.min(1, misconceptionObservations.length / 10),
        source: 'observed',
        category: RULE_CATEGORIES.INTERVENTION_STYLE.id,
        evidence: misconceptionObservations.slice(-5)
      };
    }
    
    return null;
  }

  /**
   * Get observation buffer
   */
  getBuffer() {
    return this.observationBuffer;
  }

  /**
   * Clear observation buffer
   */
  clearBuffer() {
    this.observationBuffer = [];
  }
}

/**
 * Learning Memories Manager
 * Main interface for managing persistent learning knowledge
 */
export class LearningMemories {
  constructor(config = {}) {
    this.config = {
      autoApproveThreshold: config.autoApproveThreshold || 0.9, // Auto-approve if confidence >= 90%
      approvalTimeout: config.approvalTimeout || 7 * 24 * 60 * 60 * 1000, // 7 days
      maxMemories: config.maxMemories || 100,
      ...config
    };
    
    this.memories = new Map();
    this.pendingApprovals = [];
    this.userRules = new Map();
    this.observer = new SidecarObserver(config.observerConfig);
  }

  /**
   * Initialize learning memories
   */
  async init() {
    // Load stored memories
    const storedMemories = await store.get(LEARNING_MEMORIES_KEY, {});
    for (const [id, data] of Object.entries(storedMemories)) {
      const memory = new LearningMemory(data.type, data);
      memory.id = id; // Preserve original ID
      this.memories.set(id, memory);
    }
    
    // Load pending approvals
    const storedApprovals = await store.get(PENDING_APPROVALS_KEY, []);
    this.pendingApprovals = storedApprovals
      .filter(a => a.status === 'pending')
      .map(a => {
        const memory = new LearningMemory(a.memory.type, a.memory);
        const approval = new PendingApproval(memory, a.reason);
        approval.id = a.id;
        approval.status = a.status;
        approval.createdAt = a.createdAt;
        return approval;
      });
    
    // Load user rules
    const storedRules = await store.get(USER_RULES_KEY, {});
    for (const [key, rule] of Object.entries(storedRules)) {
      this.userRules.set(key, rule);
    }
    
    // Load observation buffer
    const storedBuffer = await store.get(OBSERVATION_BUFFER_KEY, []);
    this.observer.observationBuffer = storedBuffer;
    
    console.log(`[LearningMemories] Initialized with ${this.memories.size} memories, ${this.pendingApprovals.length} pending approvals`);
  }

  /**
   * Record an observation and check for new memories
   */
  async observe(event) {
    // Add to observation buffer and check for patterns
    const suggestions = this.observer.observe(event);
    
    // Process suggestions
    for (const suggestion of suggestions) {
      await this._processSuggestion(suggestion);
    }
    
    // Persist observation buffer
    await store.set(OBSERVATION_BUFFER_KEY, this.observer.getBuffer());
    
    return suggestions;
  }

  /**
   * Process a memory suggestion
   */
  async _processSuggestion(suggestion) {
    // Check if similar memory already exists
    const existingMemory = this._findSimilarMemory(suggestion.key);
    
    if (existingMemory) {
      // Update existing memory with new evidence
      existingMemory.evidence.push(...(suggestion.evidence || []));
      existingMemory.confidence = Math.min(1, existingMemory.confidence + 0.1);
      existingMemory.lastAccessed = Date.now();
      return existingMemory;
    }
    
    // Create new memory
    const memory = new LearningMemory(suggestion.type, suggestion);
    
    // Check if auto-approve
    if (memory.confidence >= this.config.autoApproveThreshold) {
      memory.approved = true;
      this.memories.set(memory.id, memory);
      await this._applyMemoryAsRule(memory);
    } else {
      // Add to pending approvals
      const approval = new PendingApproval(memory, `Detected pattern: ${suggestion.key}`);
      this.pendingApprovals.push(approval);
    }
    
    await this._persistAll();
    return memory;
  }

  /**
   * Find similar existing memory
   */
  _findSimilarMemory(key) {
    for (const memory of this.memories.values()) {
      if (memory.key === key) {
        return memory;
      }
    }
    return null;
  }

  /**
   * Apply an approved memory as a user rule
   */
  async _applyMemoryAsRule(memory) {
    const ruleKey = memory.category ? `${memory.category}:${memory.key}` : memory.key;
    
    this.userRules.set(ruleKey, {
      key: memory.key,
      value: memory.value,
      category: memory.category,
      confidence: memory.confidence,
      source: memory.source,
      appliedAt: Date.now()
    });
    
    await store.set(USER_RULES_KEY, Object.fromEntries(this.userRules));
  }

  /**
   * Get pending approvals for user review
   */
  getPendingApprovals() {
    // Filter out expired approvals
    const now = Date.now();
    this.pendingApprovals = this.pendingApprovals.filter(
      a => a.status === 'pending' && (now - a.createdAt) < this.config.approvalTimeout
    );
    
    return this.pendingApprovals.map(a => ({
      id: a.id,
      memory: {
        type: a.memory.type,
        key: a.memory.key,
        value: a.memory.value,
        confidence: a.memory.confidence,
        evidence: a.memory.evidence?.slice(-3) // Last 3 evidence items
      },
      reason: a.reason,
      createdAt: a.createdAt
    }));
  }

  /**
   * Approve a pending memory
   */
  async approve(approvalId) {
    const approval = this.pendingApprovals.find(a => a.id === approvalId);
    
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    
    approval.status = 'approved';
    approval.memory.approved = true;
    
    // Add to memories
    this.memories.set(approval.memory.id, approval.memory);
    
    // Apply as rule
    await this._applyMemoryAsRule(approval.memory);
    
    // Remove from pending
    this.pendingApprovals = this.pendingApprovals.filter(a => a.id !== approvalId);
    
    await this._persistAll();
    
    return {
      approved: true,
      memory: approval.memory,
      appliedRule: this.userRules.get(approval.memory.key)
    };
  }

  /**
   * Reject a pending memory
   */
  async reject(approvalId, reason = '') {
    const approval = this.pendingApprovals.find(a => a.id === approvalId);
    
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    
    approval.status = 'rejected';
    approval.userResponse = { rejected: true, reason };
    
    // Remove from pending
    this.pendingApprovals = this.pendingApprovals.filter(a => a.id !== approvalId);
    
    await this._persistAll();
    
    return { rejected: true };
  }

  /**
   * Manually add a memory (user-reported)
   */
  async addMemory(type, key, value, category = null) {
    const memory = new LearningMemory(type, {
      key,
      value,
      category,
      confidence: 1.0, // User-reported = high confidence
      source: 'user_reported',
      approved: true
    });
    
    this.memories.set(memory.id, memory);
    await this._applyMemoryAsRule(memory);
    await this._persistAll();
    
    return memory;
  }

  /**
   * Get a memory by key
   */
  getMemory(key) {
    for (const memory of this.memories.values()) {
      if (memory.key === key && memory.approved) {
        memory.lastAccessed = Date.now();
        memory.accessCount++;
        return memory;
      }
    }
    return null;
  }

  /**
   * Get a user rule
   */
  getRule(key) {
    return this.userRules.get(key);
  }

  /**
   * Get all applicable rules for a context
   */
  getApplicableRules(context = {}) {
    const { conceptId, misconceptionType, struggleLevel, hour } = context;
    const applicable = [];
    
    for (const [ruleKey, rule] of this.userRules) {
      let relevance = 1;
      
      // Check if rule applies to current context
      if (conceptId && rule.key.includes(conceptId)) {
        relevance = 1.5;
      }
      if (misconceptionType && rule.key.includes(misconceptionType)) {
        relevance = 1.3;
      }
      if (struggleLevel && rule.value.suggestedApproach) {
        relevance = 1.2;
      }
      if (hour !== undefined && rule.key === 'optimal_learning_time') {
        relevance = 1.4;
      }
      
      if (relevance >= 1) {
        applicable.push({
          key: ruleKey,
          rule,
          relevance
        });
      }
    }
    
    // Sort by relevance
    applicable.sort((a, b) => b.relevance - a.relevance);
    
    return applicable;
  }

  /**
   * Get preferred intervention style from memories
   */
  getPreferredInterventionStyle(context = {}) {
    const preferenceMemory = this.getMemory('preferred_intervention_style');
    
    if (preferenceMemory) {
      return {
        style: preferenceMemory.value.style,
        confidence: preferenceMemory.confidence,
        source: 'memory'
      };
    }
    
    // Check concept-specific rules
    if (context.conceptId) {
      const conceptRule = this.userRules.get(`struggles_with_${context.conceptId}`);
      if (conceptRule?.value.suggestedApproach) {
        return {
          style: conceptRule.value.suggestedApproach,
          confidence: conceptRule.confidence,
          source: 'concept_rule'
        };
      }
    }
    
    // Check misconception-specific rules
    if (context.misconceptionType) {
      const mcRule = this.userRules.get(`effective_for_${context.misconceptionType}`);
      if (mcRule?.value.effectiveStyle) {
        return {
          style: mcRule.value.effectiveStyle,
          confidence: mcRule.confidence,
          source: 'misconception_rule'
        };
      }
    }
    
    return null;
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId) {
    const memory = this.memories.get(memoryId);
    
    if (memory) {
      // Remove associated rule
      const ruleKey = memory.category ? `${memory.category}:${memory.key}` : memory.key;
      this.userRules.delete(ruleKey);
      
      // Remove memory
      this.memories.delete(memoryId);
      
      await this._persistAll();
      return true;
    }
    
    return false;
  }

  /**
   * Get all memories
   */
  getAllMemories() {
    return Array.from(this.memories.values()).map(m => ({
      id: m.id,
      type: m.type,
      key: m.key,
      value: m.value,
      confidence: m.confidence,
      source: m.source,
      approved: m.approved,
      accessCount: m.accessCount,
      createdAt: m.createdAt
    }));
  }

  /**
   * Get memory statistics
   */
  getStatistics() {
    const byType = {};
    const bySource = {};
    
    for (const memory of this.memories.values()) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      bySource[memory.source] = (bySource[memory.source] || 0) + 1;
    }
    
    return {
      totalMemories: this.memories.size,
      approvedMemories: Array.from(this.memories.values()).filter(m => m.approved).length,
      pendingApprovals: this.pendingApprovals.length,
      userRules: this.userRules.size,
      byType,
      bySource,
      observationBufferSize: this.observer.getBuffer().length
    };
  }

  // Persistence helpers
  async _persistMemories() {
    const data = {};
    for (const [id, memory] of this.memories) {
      data[id] = {
        id: memory.id,
        type: memory.type,
        key: memory.key,
        value: memory.value,
        confidence: memory.confidence,
        source: memory.source,
        category: memory.category,
        approved: memory.approved,
        createdAt: memory.createdAt,
        lastAccessed: memory.lastAccessed,
        accessCount: memory.accessCount,
        evidence: memory.evidence
      };
    }
    await store.set(LEARNING_MEMORIES_KEY, data);
  }

  async _persistApprovals() {
    const data = this.pendingApprovals.map(a => ({
      id: a.id,
      memory: {
        id: a.memory.id,
        type: a.memory.type,
        key: a.memory.key,
        value: a.memory.value,
        confidence: a.memory.confidence,
        evidence: a.memory.evidence
      },
      reason: a.reason,
      status: a.status,
      createdAt: a.createdAt
    }));
    await store.set(PENDING_APPROVALS_KEY, data);
  }

  async _persistAll() {
    await Promise.all([
      this._persistMemories(),
      this._persistApprovals()
    ]);
  }
}

/**
 * Learning Memories Nodes for Orchestration Graph
 */
export const createMemoryNodes = (learningMemories) => {
  return {
    /**
     * Observe and detect patterns
     */
    observe_learning: async (state) => {
      if (!state.outcome && !state.struggleData) {
        return state;
      }
      
      const suggestions = await learningMemories.observe({
        type: state.outcome ? 'outcome' : 'struggle',
        conceptId: state.conceptId,
        misconceptionType: state.misconceptionType,
        interventionStyle: state.interventionStyle,
        outcome: state.outcome,
        timeToOutcome: state.timeToOutcome,
        struggleLevel: state.struggleLevel,
        metadata: {
          attemptsCount: state.attemptsCount,
          hintVersion: state.hintVersion
        }
      });
      
      return {
        ...state,
        memorySuggestions: suggestions,
        hasPendingApprovals: learningMemories.getPendingApprovals().length > 0
      };
    },

    /**
     * Get applicable rules for context
     */
    get_applicable_rules: async (state) => {
      const rules = learningMemories.getApplicableRules({
        conceptId: state.conceptId,
        misconceptionType: state.misconceptionType,
        struggleLevel: state.struggleLevel,
        hour: new Date().getHours()
      });
      
      return {
        ...state,
        applicableRules: rules
      };
    },

    /**
     * Get preferred intervention from memories
     */
    get_memory_preference: async (state) => {
      const preference = learningMemories.getPreferredInterventionStyle({
        conceptId: state.conceptId,
        misconceptionType: state.misconceptionType
      });
      
      if (preference && !state.interventionStyle) {
        return {
          ...state,
          interventionStyle: preference.style,
          interventionSource: preference.source,
          interventionConfidence: preference.confidence
        };
      }
      
      return state;
    }
  };
};

// Export singleton instance
export const learningMemories = new LearningMemories();

export default LearningMemories;
