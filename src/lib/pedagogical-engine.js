/**
 * TrailNote Pedagogical Engine
 * 
 * The intelligence layer that builds a proprietary understanding of:
 * 1. Which conceptual gaps cause which observable struggles
 * 2. Which intervention patterns resolve which misconception types
 * 3. How learning velocity varies by concept and user pattern
 * 
 * This creates the "moat" - the misconception graph and intervention
 * effectiveness data that competitors cannot replicate.
 */

import { store } from './storage.js';
import { BKTEngine, bktEngine } from './bkt-engine.js';
import { TrailNoteGraph } from './orchestration-graph.js';

// Storage keys
const MISCONCEPTION_GRAPH_KEY = 'misconception_graph';
const INTERVENTION_EFFECTIVENESS_KEY = 'intervention_effectiveness';
const PEDAGOGICAL_PATTERNS_KEY = 'pedagogical_patterns';
const AGGREGATE_PATTERNS_KEY = 'aggregate_patterns';

/**
 * Misconception types for HTML/CSS learning
 * Based on common learner errors in freeCodeCamp curriculum
 */
const MISCONCEPTION_TYPES = {
  // Structural misconceptions
  NESTING_ORDER: {
    id: 'nesting_order',
    name: 'Nesting Order Confusion',
    description: 'Incorrect parent-child relationships between elements',
    indicators: ['wrong_container', 'missing_wrapper', 'extra_wrapper'],
    relatedConcepts: ['html-nesting', 'dom-structure']
  },
  ELEMENT_SELECTION: {
    id: 'element_selection',
    name: 'Wrong Element Selection',
    description: 'Using incorrect semantic element for the task',
    indicators: ['wrong_tag', 'non_semantic', 'deprecated_tag'],
    relatedConcepts: ['html-semantics', 'html5-elements']
  },
  
  // Attribute misconceptions
  ATTRIBUTE_SYNTAX: {
    id: 'attribute_syntax',
    name: 'Attribute Syntax Error',
    description: 'Incorrect attribute name, value, or placement',
    indicators: ['missing_quote', 'wrong_attr_name', 'invalid_value'],
    relatedConcepts: ['html-attributes', 'attribute-values']
  },
  HREF_TARGET: {
    id: 'href_target',
    name: 'Link Target Confusion',
    description: 'Incorrect href value or target attribute usage',
    indicators: ['wrong_url', 'missing_href', 'target_confusion'],
    relatedConcepts: ['anchor-links', 'external-links']
  },
  
  // CSS misconceptions
  SELECTOR_SPECIFICITY: {
    id: 'selector_specificity',
    name: 'CSS Specificity Misunderstanding',
    description: 'Not understanding which selector takes precedence',
    indicators: ['override_fail', 'cascading_confusion'],
    relatedConcepts: ['css-specificity', 'css-cascade']
  },
  PROPERTY_VALUE: {
    id: 'property_value',
    name: 'CSS Property Value Error',
    description: 'Incorrect value for CSS property',
    indicators: ['invalid_unit', 'wrong_value_type', 'missing_unit'],
    relatedConcepts: ['css-units', 'css-properties']
  },
  
  // Conceptual misconceptions
  SEMANTIC_PURPOSE: {
    id: 'semantic_purpose',
    name: 'Semantic Purpose Misunderstanding',
    description: 'Not understanding why semantic elements matter',
    indicators: ['div_everything', 'accessibility_ignore'],
    relatedConcepts: ['html-semantics', 'accessibility']
  },
  
  // JavaScript misconceptions (Udemy, Codecademy, Scrimba)
  JS_SCOPE_CLOSURE: {
    id: 'js_scope_closure',
    name: 'Scope & Closure Confusion',
    description: 'Not understanding variable scoping or closures',
    indicators: ['reference_error', 'undefined_variable', 'stale_closure'],
    relatedConcepts: ['js-basics', 'js-functions', 'cc-js-intro']
  },
  JS_ASYNC_FLOW: {
    id: 'js_async_flow',
    name: 'Async Flow Misunderstanding',
    description: 'Expecting synchronous behavior from async operations',
    indicators: ['promise_unhandled', 'callback_timing', 'race_condition'],
    relatedConcepts: ['js-async', 'web-javascript']
  },
  JS_TYPE_COERCION: {
    id: 'js_type_coercion',
    name: 'Type Coercion Error',
    description: 'Unexpected results from implicit type conversion',
    indicators: ['equality_confusion', 'nan_result', 'string_concat'],
    relatedConcepts: ['js-basics', 'cc-js-intro']
  },

  // Python misconceptions (Udemy, Codecademy, Coursera)
  PY_INDENTATION: {
    id: 'py_indentation',
    name: 'Python Indentation Error',
    description: 'Incorrect indentation causing syntax or logic errors',
    indicators: ['indent_error', 'unexpected_indent', 'wrong_block'],
    relatedConcepts: ['python-basics', 'cc-python-intro']
  },
  PY_MUTABILITY: {
    id: 'py_mutability',
    name: 'Mutability Confusion',
    description: 'Not understanding mutable vs immutable types',
    indicators: ['list_aliasing', 'default_mutable_arg', 'unexpected_mutation'],
    relatedConcepts: ['python-basics', 'cc-python-intermediate']
  },

  // Algorithm misconceptions (LeetCode, HackerRank)
  ALGO_COMPLEXITY: {
    id: 'algo_complexity',
    name: 'Time/Space Complexity Error',
    description: 'Solution exceeds time or space limits',
    indicators: ['tle', 'mle', 'brute_force', 'nested_loops'],
    relatedConcepts: ['lc-dynamic-programming', 'lc-arrays-strings']
  },
  ALGO_EDGE_CASE: {
    id: 'algo_edge_case',
    name: 'Missing Edge Case',
    description: 'Solution fails on boundary or special inputs',
    indicators: ['empty_input', 'single_element', 'overflow', 'negative'],
    relatedConcepts: ['lc-arrays-strings', 'lc-binary-search']
  },
  ALGO_DATA_STRUCTURE: {
    id: 'algo_data_structure',
    name: 'Wrong Data Structure Choice',
    description: 'Using suboptimal data structure for the problem',
    indicators: ['linear_lookup', 'missing_set', 'wrong_container'],
    relatedConcepts: ['lc-hash-maps', 'lc-stacks-queues', 'lc-trees']
  },

  // Default fallback
  UNKNOWN: {
    id: 'unknown',
    name: 'Unidentified Misconception',
    description: 'Pattern not yet classified',
    indicators: [],
    relatedConcepts: []
  }
};

/**
 * Intervention styles with their characteristics
 */
const INTERVENTION_STYLES = {
  SOCRATIC: {
    id: 'socratic',
    name: 'Socratic Questioning',
    description: 'Questions that lead the learner to discover the answer',
    bestFor: ['conceptual-gaps', 'first-exposure', 'semantic_purpose'],
    avoidFor: ['frustration-high', 'time-pressure'],
    examplePattern: 'What do you think {element} is used for?'
  },
  DIRECT: {
    id: 'direct',
    name: 'Direct Instruction',
    description: 'Clear, actionable steps without abstraction',
    bestFor: ['syntax-errors', 'frustration-high', 'attribute_syntax'],
    avoidFor: ['deep-misconceptions', 'semantic_purpose'],
    examplePattern: 'Add {attribute}="{value}" to the {element}.'
  },
  ANALOGICAL: {
    id: 'analogical',
    name: 'Analogical Explanation',
    description: 'Connect to familiar concepts or real-world examples',
    bestFor: ['abstract-concepts', 'nesting_order', 'selector_specificity'],
    avoidFor: ['concrete-syntax', 'property_value'],
    examplePattern: 'Think of {concept} like {analogy}.'
  },
  SCAFFOLDED: {
    id: 'scaffolded',
    name: 'Scaffolded Steps',
    description: 'Break into smaller, sequential pieces',
    bestFor: ['complex-tasks', 'low-confidence', 'element_selection'],
    avoidFor: ['expert-users', 'simple-fix'],
    examplePattern: 'Step 1: {step1}. Step 2: {step2}.'
  }
};

/**
 * Misconception Graph Node
 * Represents a detected misconception pattern
 */
class MisconceptionNode {
  constructor(type, data = {}) {
    this.type = type;
    this.indicators = data.indicators || [];
    this.associatedConcepts = data.associatedConcepts || [];
    this.prerequisiteGaps = data.prerequisiteGaps || [];
    this.occurrenceCount = data.occurrenceCount || 0;
    this.resolutionRate = data.resolutionRate || 0;
    this.effectiveInterventions = data.effectiveInterventions || [];
    this.lastUpdated = Date.now();
  }
}

/**
 * Intervention Effectiveness Record
 * Tracks how well an intervention style works for a misconception type
 */
class InterventionRecord {
  constructor(misconceptionType, interventionStyle) {
    this.misconceptionType = misconceptionType;
    this.interventionStyle = interventionStyle;
    this.totalUses = 0;
    this.successes = 0;
    this.avgTimeToResolution = 0;
    this.userSatisfaction = []; // Optional feedback scores
    this.lastUsed = null;
  }

  get successRate() {
    return this.totalUses > 0 ? this.successes / this.totalUses : 0;
  }

  recordOutcome(success, timeToResolution = null, satisfaction = null) {
    this.totalUses++;
    if (success) {
      this.successes++;
      if (timeToResolution !== null) {
        // Running average
        this.avgTimeToResolution = 
          (this.avgTimeToResolution * (this.successes - 1) + timeToResolution) / this.successes;
      }
    }
    if (satisfaction !== null) {
      this.userSatisfaction.push(satisfaction);
    }
    this.lastUsed = Date.now();
  }
}

/**
 * Pedagogical Engine
 * Core intelligence layer for misconception detection and intervention mapping
 */
export class PedagogicalEngine {
  constructor(config = {}) {
    this.config = {
      minSamplesForPattern: config.minSamplesForPattern || 5,
      confidenceThreshold: config.confidenceThreshold || 0.7,
      enableAggregateLearning: config.enableAggregateLearning ?? true,
      ...config
    };
    
    // Core data structures
    this.misconceptionGraph = new Map();  // misconceptionType → MisconceptionNode
    this.interventionEffectiveness = new Map(); // "type:style" → InterventionRecord
    this.userPatterns = new Map(); // userId → personal patterns
    this.aggregatePatterns = new Map(); // Cross-user patterns (privacy-preserving)
    
    // Initialize with known misconception types
    this._initializeKnownTypes();
  }

  /**
   * Initialize the engine with stored data
   */
  async init() {
    // Load misconception graph
    const storedGraph = await store.get(MISCONCEPTION_GRAPH_KEY, {});
    for (const [type, data] of Object.entries(storedGraph)) {
      this.misconceptionGraph.set(type, new MisconceptionNode(type, data));
    }
    
    // Load intervention effectiveness
    const storedEffectiveness = await store.get(INTERVENTION_EFFECTIVENESS_KEY, {});
    for (const [key, data] of Object.entries(storedEffectiveness)) {
      const [type, style] = key.split(':');
      const record = new InterventionRecord(type, style);
      Object.assign(record, data);
      this.interventionEffectiveness.set(key, record);
    }
    
    // Load aggregate patterns
    const storedAggregate = await store.get(AGGREGATE_PATTERNS_KEY, {});
    for (const [key, data] of Object.entries(storedAggregate)) {
      this.aggregatePatterns.set(key, data);
    }
    
    console.log(`[PedagogicalEngine] Initialized with ${this.misconceptionGraph.size} misconception types`);
  }

  /**
   * Initialize known misconception types
   */
  _initializeKnownTypes() {
    for (const [key, type] of Object.entries(MISCONCEPTION_TYPES)) {
      if (!this.misconceptionGraph.has(type.id)) {
        this.misconceptionGraph.set(type.id, new MisconceptionNode(type.id, {
          indicators: type.indicators,
          associatedConcepts: type.relatedConcepts
        }));
      }
    }
  }

  /**
   * Analyze struggle pattern to detect misconception type
   * @param {Object} struggleData - Data from struggle detector
   * @param {string} conceptId - Current concept being learned
   * @param {Object} context - Additional context (code, tests, etc.)
   * @returns {Object} Detected misconception with confidence
   */
  async analyzeMisconception(struggleData, conceptId, context = {}) {
    const { struggleLevel, actions, timeSpent, testFailures } = struggleData;
    
    // Extract indicators from struggle data
    const indicators = this._extractIndicators(struggleData, context);
    
    // Match indicators to misconception types
    const matches = [];
    
    for (const [typeId, node] of this.misconceptionGraph) {
      const matchScore = this._calculateMatchScore(indicators, node.indicators, conceptId, node.associatedConcepts);
      
      if (matchScore > 0.3) { // Minimum threshold
        matches.push({
          type: typeId,
          confidence: matchScore,
          node,
          matchedIndicators: indicators.filter(i => node.indicators.includes(i))
        });
      }
    }
    
    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    const bestMatch = matches[0] || {
      type: 'unknown',
      confidence: 0,
      node: this.misconceptionGraph.get('unknown'),
      matchedIndicators: []
    };
    
    // Update misconception graph
    await this._recordMisconceptionDetection(bestMatch.type, conceptId, indicators);
    
    return {
      misconceptionType: bestMatch.type,
      confidence: bestMatch.confidence,
      indicators: bestMatch.matchedIndicators,
      alternativeTypes: matches.slice(1, 3).map(m => ({ type: m.type, confidence: m.confidence })),
      recommendedInterventions: await this._getInterventionRecommendations(bestMatch.type)
    };
  }

  /**
   * Extract misconception indicators from struggle data
   */
  _extractIndicators(struggleData, context) {
    const indicators = [];
    const { actions, testFailures, userCode } = context;
    
    // From test failures
    if (testFailures && testFailures.length > 0) {
      for (const failure of testFailures) {
        const failureText = failure.toLowerCase();
        
        // Check for specific patterns
        if (failureText.includes('inside') || failureText.includes('within')) {
          indicators.push('wrong_container');
        }
        if (failureText.includes('anchor') && failureText.includes('paragraph')) {
          indicators.push('nesting_order');
        }
        if (failureText.includes('href')) {
          indicators.push('missing_href', 'wrong_url');
        }
        if (failureText.includes('alt')) {
          indicators.push('missing_attr', 'accessibility_ignore');
        }
      }
    }
    
    // From user code patterns
    if (userCode) {
      const codeLower = userCode.toLowerCase();
      
      if (codeLower.includes('<div>') && !codeLower.includes('<section>') && !codeLower.includes('<article>')) {
        indicators.push('div_everything');
      }
      if (codeLower.match(/<a[^>]*>/) && !codeLower.match(/href\s*=/)) {
        indicators.push('missing_href');
      }
      if (codeLower.match(/<img[^>]*>/) && !codeLower.match(/alt\s*=/)) {
        indicators.push('accessibility_ignore');
      }
    }
    
    // From action patterns
    if (actions) {
      if (actions.explainClicks > 3) {
        indicators.push('conceptual_confusion');
      }
      if (actions.testAttempts > 5) {
        indicators.push('trial_and_error');
      }
    }
    
    return [...new Set(indicators)]; // Deduplicate
  }

  /**
   * Calculate match score between indicators and misconception type
   */
  _calculateMatchScore(detectedIndicators, typeIndicators, conceptId, associatedConcepts) {
    if (detectedIndicators.length === 0 || typeIndicators.length === 0) {
      return 0;
    }
    
    // Jaccard similarity for indicator overlap
    const intersection = detectedIndicators.filter(i => typeIndicators.includes(i));
    const union = [...new Set([...detectedIndicators, ...typeIndicators])];
    const indicatorScore = intersection.length / union.length;
    
    // Concept relevance boost
    let conceptBoost = 0;
    if (conceptId && associatedConcepts.includes(conceptId)) {
      conceptBoost = 0.3;
    }
    
    return Math.min(1, indicatorScore + conceptBoost);
  }

  /**
   * Get intervention recommendations for a misconception type
   */
  async _getInterventionRecommendations(misconceptionType) {
    const recommendations = [];
    
    // Check stored effectiveness data
    for (const [key, record] of this.interventionEffectiveness) {
      if (key.startsWith(`${misconceptionType}:`)) {
        recommendations.push({
          style: record.interventionStyle,
          successRate: record.successRate,
          sampleSize: record.totalUses,
          avgTime: record.avgTimeToResolution
        });
      }
    }
    
    // If no data, use default recommendations from INTERVENTION_STYLES
    if (recommendations.length === 0) {
      const typeInfo = Object.values(MISCONCEPTION_TYPES).find(t => t.id === misconceptionType);
      
      for (const [styleKey, style] of Object.entries(INTERVENTION_STYLES)) {
        if (style.bestFor.some(b => misconceptionType.includes(b) || typeInfo?.indicators?.includes(b))) {
          recommendations.push({
            style: style.id,
            successRate: null, // No data yet
            sampleSize: 0,
            isDefault: true
          });
        }
      }
    }
    
    // Sort by success rate
    recommendations.sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
    
    return recommendations;
  }

  /**
   * Record a misconception detection for learning
   */
  async _recordMisconceptionDetection(type, conceptId, indicators) {
    const node = this.misconceptionGraph.get(type);
    if (!node) return;
    
    node.occurrenceCount++;
    if (!node.associatedConcepts.includes(conceptId)) {
      node.associatedConcepts.push(conceptId);
    }
    for (const indicator of indicators) {
      if (!node.indicators.includes(indicator)) {
        node.indicators.push(indicator);
      }
    }
    node.lastUpdated = Date.now();
    
    await this._persistMisconceptionGraph();
  }

  /**
   * Record intervention outcome for effectiveness tracking
   * @param {string} misconceptionType - Detected misconception
   * @param {string} interventionStyle - Style used
   * @param {boolean} success - Whether the intervention worked
   * @param {number} timeToResolution - Time in seconds (optional)
   * @param {string} userId - User identifier (for per-user patterns)
   */
  async recordInterventionOutcome(misconceptionType, interventionStyle, success, timeToResolution = null, userId = 'default') {
    const key = `${misconceptionType}:${interventionStyle}`;
    
    // Get or create record
    let record = this.interventionEffectiveness.get(key);
    if (!record) {
      record = new InterventionRecord(misconceptionType, interventionStyle);
      this.interventionEffectiveness.set(key, record);
    }
    
    // Record outcome
    record.recordOutcome(success, timeToResolution);
    
    // Update misconception node
    const node = this.misconceptionGraph.get(misconceptionType);
    if (node && success) {
      if (!node.effectiveInterventions.includes(interventionStyle)) {
        node.effectiveInterventions.push(interventionStyle);
      }
      node.resolutionRate = (node.resolutionRate * (node.occurrenceCount - 1) + 1) / node.occurrenceCount;
    }
    
    // Update per-user patterns
    if (userId !== 'default') {
      await this._updateUserPattern(userId, misconceptionType, interventionStyle, success);
    }
    
    // Update aggregate patterns (privacy-preserving)
    if (this.config.enableAggregateLearning) {
      await this._updateAggregatePatterns(misconceptionType, interventionStyle, success, timeToResolution);
    }
    
    await this._persistAll();
    
    return {
      successRate: record.successRate,
      totalSamples: record.totalUses
    };
  }

  /**
   * Update per-user pattern data
   */
  async _updateUserPattern(userId, misconceptionType, interventionStyle, success) {
    const key = `${userId}:patterns`;
    let patterns = this.userPatterns.get(key) || {
      misconceptionHistory: {},
      preferredStyles: {},
      learningVelocity: {}
    };
    
    // Update misconception history
    if (!patterns.misconceptionHistory[misconceptionType]) {
      patterns.misconceptionHistory[misconceptionType] = { count: 0, resolved: 0 };
    }
    patterns.misconceptionHistory[misconceptionType].count++;
    if (success) {
      patterns.misconceptionHistory[misconceptionType].resolved++;
    }
    
    // Update preferred styles
    if (!patterns.preferredStyles[interventionStyle]) {
      patterns.preferredStyles[interventionStyle] = { uses: 0, successes: 0 };
    }
    patterns.preferredStyles[interventionStyle].uses++;
    if (success) {
      patterns.preferredStyles[interventionStyle].successes++;
    }
    
    this.userPatterns.set(key, patterns);
  }

  /**
   * Update aggregate patterns (privacy-preserving)
   * Only stores statistical aggregates, no user-identifiable data
   */
  async _updateAggregatePatterns(misconceptionType, interventionStyle, success, timeToResolution) {
    const key = `aggregate:${misconceptionType}:${interventionStyle}`;
    
    let aggregate = this.aggregatePatterns.get(key) || {
      totalObservations: 0,
      successCount: 0,
      totalTime: 0,
      avgTime: null
    };
    
    aggregate.totalObservations++;
    if (success) {
      aggregate.successCount++;
      if (timeToResolution !== null) {
        aggregate.totalTime += timeToResolution;
        aggregate.avgTime = aggregate.totalTime / aggregate.successCount;
      }
    }
    
    this.aggregatePatterns.set(key, aggregate);
  }

  /**
   * Select optimal intervention style for a user and misconception
   * @param {string} misconceptionType - Detected misconception
   * @param {string} userId - User identifier
   * @param {Object} context - Current context (frustration level, time pressure, etc.)
   * @returns {Object} Selected intervention style with reasoning
   */
  async selectIntervention(misconceptionType, userId = 'default', context = {}) {
    const { frustrationLevel, timePressure, userPreference } = context;
    
    // Get effectiveness data
    const effectivenessData = [];
    for (const [key, record] of this.interventionEffectiveness) {
      if (key.startsWith(`${misconceptionType}:`)) {
        effectivenessData.push({
          style: record.interventionStyle,
          successRate: record.successRate,
          sampleSize: record.totalUses,
          avgTime: record.avgTimeToResolution
        });
      }
    }
    
    // Get user preferences
    const userKey = `${userId}:patterns`;
    const userPatterns = this.userPatterns.get(userKey);
    const userPreferences = userPatterns?.preferredStyles || {};
    
    // Score each style
    const scoredStyles = [];
    
    for (const [styleKey, style] of Object.entries(INTERVENTION_STYLES)) {
      let score = 0;
      const reasons = [];
      
      // Effectiveness score
      const effectiveness = effectivenessData.find(e => e.style === style.id);
      if (effectiveness && effectiveness.sampleSize >= this.config.minSamplesForPattern) {
        score += effectiveness.successRate * 0.4;
        reasons.push(`Historical success: ${(effectiveness.successRate * 100).toFixed(0)}%`);
      }
      
      // Context fit score
      if (frustrationLevel === 'high' && style.avoidFor.includes('frustration-high')) {
        score -= 0.3;
        reasons.push('Avoid for high frustration');
      }
      if (frustrationLevel === 'high' && style.bestFor.includes('frustration-high')) {
        score += 0.2;
        reasons.push('Good for high frustration');
      }
      if (timePressure && style.avoidFor.includes('time-pressure')) {
        score -= 0.2;
      }
      
      // User preference score
      const userPref = userPreferences[style.id];
      if (userPref && userPref.uses > 0) {
        const personalSuccessRate = userPref.successes / userPref.uses;
        score += personalSuccessRate * 0.3;
        reasons.push(`Personal success: ${(personalSuccessRate * 100).toFixed(0)}%`);
      }
      
      // Default match score
      const typeInfo = MISCONCEPTION_TYPES[misconceptionType.toUpperCase()] || MISCONCEPTION_TYPES.UNKNOWN;
      if (style.bestFor.some(b => typeInfo.indicators?.includes(b) || misconceptionType.includes(b))) {
        score += 0.2;
        reasons.push('Matches misconception type');
      }
      
      scoredStyles.push({
        style: style.id,
        styleInfo: style,
        score: Math.max(0, score),
        reasons,
        effectiveness
      });
    }
    
    // Sort by score
    scoredStyles.sort((a, b) => b.score - a.score);
    
    const selected = scoredStyles[0];
    
    return {
      recommendedStyle: selected.style,
      styleInfo: selected.styleInfo,
      score: selected.score,
      reasoning: selected.reasons,
      alternatives: scoredStyles.slice(1, 3).map(s => ({
        style: s.style,
        score: s.score
      }))
    };
  }

  /**
   * Get aggregate statistics for a misconception type
   * Privacy-preserving: only returns aggregate data
   */
  getAggregateStats(misconceptionType) {
    const stats = {
      totalOccurrences: 0,
      totalResolutions: 0,
      avgResolutionTime: null,
      bestInterventions: []
    };
    
    const node = this.misconceptionGraph.get(misconceptionType);
    if (node) {
      stats.totalOccurrences = node.occurrenceCount;
      stats.resolutionRate = node.resolutionRate;
      stats.effectiveInterventions = node.effectiveInterventions;
    }
    
    // Get aggregate intervention data
    for (const [key, aggregate] of this.aggregatePatterns) {
      if (key.includes(misconceptionType)) {
        const style = key.split(':')[2];
        stats.bestInterventions.push({
          style,
          successRate: aggregate.successCount / aggregate.totalObservations,
          avgTime: aggregate.avgTime,
          sampleSize: aggregate.totalObservations
        });
      }
    }
    
    // Sort by success rate
    stats.bestInterventions.sort((a, b) => b.successRate - a.successRate);
    
    return stats;
  }

  /**
   * Export pedagogical data for analysis
   */
  async export() {
    return {
      misconceptionGraph: Object.fromEntries(this.misconceptionGraph),
      interventionEffectiveness: Object.fromEntries(this.interventionEffectiveness),
      aggregatePatterns: Object.fromEntries(this.aggregatePatterns),
      exportedAt: Date.now()
    };
  }

  // Persistence helpers
  async _persistMisconceptionGraph() {
    const data = {};
    for (const [type, node] of this.misconceptionGraph) {
      data[type] = {
        type: node.type,
        indicators: node.indicators,
        associatedConcepts: node.associatedConcepts,
        prerequisiteGaps: node.prerequisiteGaps,
        occurrenceCount: node.occurrenceCount,
        resolutionRate: node.resolutionRate,
        effectiveInterventions: node.effectiveInterventions,
        lastUpdated: node.lastUpdated
      };
    }
    await store.set(MISCONCEPTION_GRAPH_KEY, data);
  }

  async _persistInterventionEffectiveness() {
    const data = {};
    for (const [key, record] of this.interventionEffectiveness) {
      data[key] = {
        misconceptionType: record.misconceptionType,
        interventionStyle: record.interventionStyle,
        totalUses: record.totalUses,
        successes: record.successes,
        avgTimeToResolution: record.avgTimeToResolution,
        userSatisfaction: record.userSatisfaction,
        lastUsed: record.lastUsed
      };
    }
    await store.set(INTERVENTION_EFFECTIVENESS_KEY, data);
  }

  async _persistAggregatePatterns() {
    await store.set(AGGREGATE_PATTERNS_KEY, Object.fromEntries(this.aggregatePatterns));
  }

  async _persistAll() {
    await Promise.all([
      this._persistMisconceptionGraph(),
      this._persistInterventionEffectiveness(),
      this._persistAggregatePatterns()
    ]);
  }
}

/**
 * Pedagogical Engine Nodes for Orchestration Graph
 */
export const createPedagogicalNodes = (engine) => {
  return {
    /**
     * Analyze struggle to detect misconception
     */
    detect_misconception: async (state) => {
      if (!state.struggleData || state.struggleLevel === 'none') {
        return { ...state, misconceptionType: null };
      }
      
      const analysis = await engine.analyzeMisconception(
        state.struggleData,
        state.conceptId,
        state.context || {}
      );
      
      return {
        ...state,
        misconceptionType: analysis.misconceptionType,
        misconceptionConfidence: analysis.confidence,
        misconceptionIndicators: analysis.indicators,
        interventionRecommendations: analysis.recommendedInterventions
      };
    },

    /**
     * Select intervention style
     */
    select_intervention: async (state) => {
      if (!state.misconceptionType) {
        return { ...state, interventionStyle: 'direct' }; // Default
      }
      
      const selection = await engine.selectIntervention(
        state.misconceptionType,
        state.userId || 'default',
        {
          frustrationLevel: state.struggleLevel,
          timePressure: state.timePressure,
          userPreference: state.userPreferences?.preferredHintStyle
        }
      );
      
      return {
        ...state,
        interventionStyle: selection.recommendedStyle,
        interventionReasoning: selection.reasoning,
        interventionAlternatives: selection.alternatives
      };
    },

    /**
     * Record intervention outcome
     */
    record_outcome: async (state) => {
      if (!state.misconceptionType || !state.interventionStyle) {
        return state;
      }
      
      const result = await engine.recordInterventionOutcome(
        state.misconceptionType,
        state.interventionStyle,
        state.outcome === 'passed',
        state.timeToOutcome,
        state.userId || 'default'
      );
      
      return {
        ...state,
        interventionEffectiveness: result
      };
    }
  };
};

// Export singleton instance
export const pedagogicalEngine = new PedagogicalEngine();

/**
 * Convenience method for tutor.js: detect misconception from raw code + tests
 * Returns { id, name, confidence, relatedConcepts } or null
 */
pedagogicalEngine.detectMisconception = async function(userCode, tests) {
  try {
    await this.init();
    const struggleData = { struggleLevel: 'gentle', actions: {}, timeSpent: 0, testFailures: tests };
    const context = { userCode, testFailures: tests };
    const result = await this.analyzeMisconception(struggleData, null, context);
    if (!result || result.misconceptionType === 'unknown' || result.confidence < 0.3) return null;
    const typeInfo = Object.values(MISCONCEPTION_TYPES).find(t => t.id === result.misconceptionType);
    return {
      id: result.misconceptionType,
      name: typeInfo?.name || result.misconceptionType,
      confidence: result.confidence,
      relatedConcepts: typeInfo?.relatedConcepts || []
    };
  } catch (e) {
    console.warn('[PedagogicalEngine] detectMisconception error:', e);
    return null;
  }
};

export default PedagogicalEngine;
