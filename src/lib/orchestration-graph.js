/**
 * TrailNote Orchestration Graph
 * LangGraph-inspired state machine for pedagogical intelligence
 * 
 * This is the "Zero" - the foundational layer that enables all other modules
 * to work as a cohesive, self-improving system rather than isolated features.
 * 
 * Core concepts:
 * - State: Shared object that persists across graph execution
 * - Nodes: Processing steps that modify state
 * - Edges: Connections between nodes (including conditional routing)
 * - Checkpointer: State persistence for recovery and human-in-the-loop
 */

import { store } from './storage.js';

// Storage keys
const GRAPH_STATE_KEY = 'orchestration_graph_state';
const GRAPH_CHECKPOINTS_KEY = 'orchestration_graph_checkpoints';
const GRAPH_MEMORIES_KEY = 'orchestration_graph_memories';

/**
 * Default initial state for the learning orchestration
 */
const DEFAULT_STATE = {
  // Learning context
  conceptId: null,
  challengeId: null,
  struggleLevel: 'none',      // none | gentle | active | supportive
  misconceptionType: null,     // Detected misconception category
  
  // Intervention state
  interventionStyle: null,     // socratic | direct | analogical | scaffolded
  hintGenerated: null,
  hintVersion: 1,
  previousHints: [],
  
  // Outcome tracking
  outcome: null,               // passed | failed | abandoned
  timeToOutcome: null,
  attemptsCount: 0,
  
  // Feedback loop state
  iterationCount: 0,
  maxIterations: 3,
  feedbackHistory: [],
  
  // Pedagogical insights (persisted across sessions)
  learnedPatterns: {},
  confidenceScores: {},
  userPreferences: {},
  
  // Human-in-the-loop
  requiresApproval: false,
  approvalType: null,
  pendingAction: null
};

/**
 * Memory Checkpointer for state persistence
 * Enables recovery, human-in-the-loop, and long-running workflows
 */
export class MemoryCheckpointer {
  constructor(namespace = 'default') {
    this.namespace = namespace;
  }

  /**
   * Save a checkpoint of the current state
   * @param {string} threadId - Unique identifier for this execution thread
   * @param {Object} state - Current state to checkpoint
   * @param {Object} metadata - Optional metadata (node name, timestamp, etc.)
   */
  async save(threadId, state, metadata = {}) {
    const checkpoints = await store.get(GRAPH_CHECKPOINTS_KEY, {});
    const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    checkpoints[threadId] = checkpoints[threadId] || {};
    checkpoints[threadId][checkpointId] = {
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        namespace: this.namespace
      }
    };
    
    await store.set(GRAPH_CHECKPOINTS_KEY, checkpoints);
    return checkpointId;
  }

  /**
   * Load the latest checkpoint for a thread
   * @param {string} threadId - Thread identifier
   * @returns {Object|null} Checkpointed state or null if none exists
   */
  async load(threadId) {
    const checkpoints = await store.get(GRAPH_CHECKPOINTS_KEY, {});
    
    if (!checkpoints[threadId]) return null;
    
    // Get the most recent checkpoint
    const threadCheckpoints = checkpoints[threadId];
    const checkpointIds = Object.keys(threadCheckpoints).sort((a, b) => {
      const timeA = threadCheckpoints[a].metadata.timestamp;
      const timeB = threadCheckpoints[b].metadata.timestamp;
      return timeB - timeA; // Descending order
    });
    
    if (checkpointIds.length === 0) return null;
    
    const latestCheckpoint = threadCheckpoints[checkpointIds[0]];
    return {
      checkpointId: checkpointIds[0],
      state: latestCheckpoint.state,
      metadata: latestCheckpoint.metadata
    };
  }

  /**
   * List all checkpoints for a thread
   * @param {string} threadId - Thread identifier
   * @returns {Array} Array of checkpoint info objects
   */
  async list(threadId) {
    const checkpoints = await store.get(GRAPH_CHECKPOINTS_KEY, {});
    
    if (!checkpoints[threadId]) return [];
    
    return Object.entries(checkpoints[threadId]).map(([id, data]) => ({
      checkpointId: id,
      timestamp: data.metadata.timestamp,
      nodeName: data.metadata.nodeName,
      state: data.state
    }));
  }

  /**
   * Clear checkpoints for a thread (or all threads)
   * @param {string|null} threadId - Thread to clear, or null for all
   */
  async clear(threadId = null) {
    if (threadId) {
      const checkpoints = await store.get(GRAPH_CHECKPOINTS_KEY, {});
      delete checkpoints[threadId];
      await store.set(GRAPH_CHECKPOINTS_KEY, checkpoints);
    } else {
      await store.set(GRAPH_CHECKPOINTS_KEY, {});
    }
  }
}

/**
 * Long-term Memory Store for cross-session knowledge
 * Cursor-style persistent memories that survive across sessions
 */
export class LongTermMemoryStore {
  constructor(namespace = 'trailnote') {
    this.namespace = namespace;
  }

  /**
   * Store a memory (learning rule, pattern, preference)
   * @param {string} key - Memory key
   * @param {Object} value - Memory value
   * @param {Object} metadata - Optional metadata
   */
  async put(key, value, metadata = {}) {
    const memories = await store.get(GRAPH_MEMORIES_KEY, {});
    const namespacedKey = `${this.namespace}:${key}`;
    
    memories[namespacedKey] = {
      value,
      metadata: {
        ...metadata,
        createdAt: memories[namespacedKey]?.metadata?.createdAt || Date.now(),
        updatedAt: Date.now(),
        accessCount: (memories[namespacedKey]?.metadata?.accessCount || 0) + 1
      }
    };
    
    await store.set(GRAPH_MEMORIES_KEY, memories);
  }

  /**
   * Retrieve a memory
   * @param {string} key - Memory key
   * @returns {Object|null} Memory value or null
   */
  async get(key) {
    const memories = await store.get(GRAPH_MEMORIES_KEY, {});
    const namespacedKey = `${this.namespace}:${key}`;
    
    if (!memories[namespacedKey]) return null;
    
    // Update access count
    memories[namespacedKey].metadata.accessCount++;
    memories[namespacedKey].metadata.lastAccessed = Date.now();
    await store.set(GRAPH_MEMORIES_KEY, memories);
    
    return memories[namespacedKey].value;
  }

  /**
   * Search memories by pattern
   * @param {Object} query - Search query (namespace, type, etc.)
   * @returns {Array} Matching memories
   */
  async search(query = {}) {
    const memories = await store.get(GRAPH_MEMORIES_KEY, {});
    const results = [];
    
    for (const [key, data] of Object.entries(memories)) {
      // Filter by namespace
      if (query.namespace && !key.startsWith(query.namespace)) continue;
      
      // Filter by type
      if (query.type && data.metadata.type !== query.type) continue;
      
      // Filter by recency
      if (query.since && data.metadata.updatedAt < query.since) continue;
      
      results.push({
        key,
        value: data.value,
        metadata: data.metadata
      });
    }
    
    // Sort by relevance (access count + recency)
    results.sort((a, b) => {
      const scoreA = a.metadata.accessCount * 0.3 + (Date.now() - a.metadata.updatedAt) * -0.00001;
      const scoreB = b.metadata.accessCount * 0.3 + (Date.now() - b.metadata.updatedAt) * -0.00001;
      return scoreB - scoreA;
    });
    
    if (query.limit) {
      return results.slice(0, query.limit);
    }
    
    return results;
  }

  /**
   * Delete a memory
   * @param {string} key - Memory key to delete
   */
  async delete(key) {
    const memories = await store.get(GRAPH_MEMORIES_KEY, {});
    const namespacedKey = `${this.namespace}:${key}`;
    delete memories[namespacedKey];
    await store.set(GRAPH_MEMORIES_KEY, memories);
  }
}

/**
 * TrailNote Orchestration Graph
 * The core state machine that coordinates all pedagogical intelligence modules
 */
export class TrailNoteGraph {
  constructor(config = {}) {
    this.config = {
      maxIterations: config.maxIterations || 3,
      debug: config.debug || false,
      ...config
    };
    
    this.nodes = new Map();
    this.edges = new Map();
    this.checkpointer = new MemoryCheckpointer(config.namespace || 'trailnote');
    this.memoryStore = new LongTermMemoryStore(config.namespace || 'trailnote');
    
    // Execution state
    this.currentThreadId = null;
    this.isInterrupted = false;
    this.interruptResolver = null;
    
    // Initialize built-in nodes
    this._initializeBuiltInNodes();
  }

  /**
   * Initialize the built-in processing nodes
   */
  _initializeBuiltInNodes() {
    // Entry node - initializes state
    this.addNode('START', async (state) => {
      return {
        ...state,
        iterationCount: 0,
        startTime: Date.now()
      };
    });
    
    // Exit node - finalizes state
    this.addNode('END', async (state) => {
      return {
        ...state,
        endTime: Date.now(),
        totalDuration: Date.now() - (state.startTime || Date.now())
      };
    });
    
    // Escalate node - for when max iterations reached
    this.addNode('ESCALATE', async (state) => {
      console.warn('[TrailNoteGraph] Escalating - max iterations reached', state);
      return {
        ...state,
        escalated: true,
        escalationReason: 'max_iterations_reached'
      };
    });
  }

  /**
   * Add a processing node to the graph
   * @param {string} name - Node name
   * @param {Function} handler - Async function that processes state
   */
  addNode(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Node handler must be a function, got: ${typeof handler}`);
    }
    
    this.nodes.set(name, handler);
    
    if (this.config.debug) {
      console.log(`[TrailNoteGraph] Added node: ${name}`);
    }
  }

  /**
   * Add a simple edge between two nodes
   * @param {string} fromNode - Source node
   * @param {string} toNode - Target node
   */
  addEdge(fromNode, toNode) {
    this.edges.set(fromNode, { type: 'simple', target: toNode });
    
    if (this.config.debug) {
      console.log(`[TrailNoteGraph] Added edge: ${fromNode} → ${toNode}`);
    }
  }

  /**
   * Add conditional edges (the "brains" of the graph)
   * @param {string} fromNode - Source node
   * @param {Function} conditionFn - Function that determines routing
   * @param {Object} edgeMap - Map of condition results to target nodes
   */
  addConditionalEdges(fromNode, conditionFn, edgeMap) {
    if (typeof conditionFn !== 'function') {
      throw new Error('Condition must be a function');
    }
    
    this.edges.set(fromNode, {
      type: 'conditional',
      condition: conditionFn,
      map: edgeMap
    });
    
    if (this.config.debug) {
      console.log(`[TrailNoteGraph] Added conditional edges from: ${fromNode}`, edgeMap);
    }
  }

  /**
   * Execute the graph with input state
   * @param {Object} inputState - Initial state to process
   * @param {Object} options - Execution options
   * @returns {Object} Final state after graph execution
   */
  async invoke(inputState = {}, options = {}) {
    const threadId = options.threadId || `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentThreadId = threadId;
    
    // Initialize state
    let state = {
      ...DEFAULT_STATE,
      ...inputState,
      threadId
    };
    
    // Try to resume from checkpoint if specified
    if (options.resumeFrom) {
      const checkpoint = await this.checkpointer.load(threadId);
      if (checkpoint) {
        state = { ...checkpoint.state, ...inputState };
        if (this.config.debug) {
          console.log(`[TrailNoteGraph] Resumed from checkpoint: ${checkpoint.checkpointId}`);
        }
      }
    }
    
    let currentNode = options.startNode || 'START';
    let iterationCount = 0;
    const maxSteps = options.maxSteps || 100; // Safety limit
    
    if (this.config.debug) {
      console.log(`[TrailNoteGraph] Starting execution: ${threadId}`);
      console.log(`[TrailNoteGraph] Initial state:`, state);
    }
    
    while (currentNode !== 'END' && iterationCount < maxSteps) {
      // Check for interrupt
      if (this.isInterrupted) {
        await this.checkpointer.save(threadId, state, { 
          nodeName: currentNode, 
          interrupted: true 
        });
        
        if (this.config.debug) {
          console.log(`[TrailNoteGraph] Interrupted at: ${currentNode}`);
        }
        
        // Wait for resume
        await new Promise(resolve => {
          this.interruptResolver = resolve;
        });
      }
      
      // Get node handler
      const handler = this.nodes.get(currentNode);
      
      if (!handler) {
        console.error(`[TrailNoteGraph] Unknown node: ${currentNode}`);
        state.error = `Unknown node: ${currentNode}`;
        currentNode = 'END';
        continue;
      }
      
      try {
        // Execute node
        if (this.config.debug) {
          console.log(`[TrailNoteGraph] Executing node: ${currentNode}`);
        }
        
        state = await handler(state);
        state.lastNode = currentNode;
        
        // Save checkpoint after each node
        await this.checkpointer.save(threadId, state, { nodeName: currentNode });
        
        // Determine next node
        const edge = this.edges.get(currentNode);
        
        if (!edge) {
          // No edge defined, end execution
          if (this.config.debug) {
            console.log(`[TrailNoteGraph] No edge from: ${currentNode}, ending`);
          }
          currentNode = 'END';
        } else if (edge.type === 'simple') {
          currentNode = edge.target;
        } else if (edge.type === 'conditional') {
          const route = await edge.condition(state);
          currentNode = edge.map[route] || 'END';
          
          if (this.config.debug) {
            console.log(`[TrailNoteGraph] Routed to: ${currentNode} (route: ${route})`);
          }
        }
        
        iterationCount++;
        
      } catch (error) {
        console.error(`[TrailNoteGraph] Error in node ${currentNode}:`, error);
        state.error = error.message;
        state.errorNode = currentNode;
        
        // Route to error handler if defined
        if (this.nodes.has('ERROR')) {
          currentNode = 'ERROR';
        } else {
          currentNode = 'END';
        }
      }
    }
    
    // Final checkpoint
    await this.checkpointer.save(threadId, state, { nodeName: 'END', final: true });
    
    if (this.config.debug) {
      console.log(`[TrailNoteGraph] Execution complete: ${threadId}`);
      console.log(`[TrailNoteGraph] Final state:`, state);
    }
    
    return state;
  }

  /**
   * Interrupt execution for human-in-the-loop
   * @param {string} reason - Why the interrupt is needed
   * @param {Object} pendingAction - Action awaiting approval
   */
  async interrupt(reason, pendingAction = null) {
    this.isInterrupted = true;
    this.interruptReason = reason;
    this.pendingAction = pendingAction;
    
    if (this.config.debug) {
      console.log(`[TrailNoteGraph] Interrupt requested: ${reason}`);
    }
  }

  /**
   * Resume execution after interrupt
   * @param {Object} input - Human input (approval, rejection, modification)
   */
  async resume(input = {}) {
    if (!this.isInterrupted) {
      console.warn('[TrailNoteGraph] Resume called but not interrupted');
      return;
    }
    
    this.isInterrupted = false;
    this.interruptReason = null;
    this.pendingAction = null;
    
    if (this.interruptResolver) {
      this.interruptResolver(input);
      this.interruptResolver = null;
    }
    
    if (this.config.debug) {
      console.log(`[TrailNoteGraph] Resumed with input:`, input);
    }
  }

  /**
   * Get the current state of a thread
   * @param {string} threadId - Thread identifier
   * @returns {Object|null} Current state or null
   */
  async getState(threadId) {
    const checkpoint = await this.checkpointer.load(threadId);
    return checkpoint ? checkpoint.state : null;
  }

  /**
   * Update state mid-execution (for human-in-the-loop modifications)
   * @param {string} threadId - Thread identifier
   * @param {Object} updates - State updates to apply
   */
  async updateState(threadId, updates) {
    const current = await this.getState(threadId);
    if (!current) {
      throw new Error(`No state found for thread: ${threadId}`);
    }
    
    const updated = { ...current, ...updates };
    await this.checkpointer.save(threadId, updated, { manualUpdate: true });
    
    return updated;
  }

  /**
   * Store a long-term memory
   * @param {string} key - Memory key
   * @param {Object} value - Memory value
   * @param {Object} metadata - Optional metadata
   */
  async remember(key, value, metadata = {}) {
    return this.memoryStore.put(key, value, metadata);
  }

  /**
   * Retrieve a long-term memory
   * @param {string} key - Memory key
   * @returns {Object|null} Memory value
   */
  async recall(key) {
    return this.memoryStore.get(key);
  }

  /**
   * Search long-term memories
   * @param {Object} query - Search query
   * @returns {Array} Matching memories
   */
  async recallSimilar(query) {
    return this.memoryStore.search(query);
  }

  /**
   * Create a subgraph (for hierarchical orchestration)
   * @param {string} name - Subgraph name
   * @param {Object} config - Subgraph configuration
   * @returns {TrailNoteGraph} New subgraph instance
   */
  createSubgraph(name, config = {}) {
    const subgraph = new TrailNoteGraph({
      ...this.config,
      ...config,
      namespace: `${this.memoryStore.namespace}:${name}`,
      parent: this
    });
    
    return subgraph;
  }

  /**
   * Get a snapshot of the graph structure
   * @returns {Object} Graph structure info
   */
  getStructure() {
    return {
      nodes: Array.from(this.nodes.keys()),
      edges: Array.from(this.edges.entries()).map(([from, edge]) => ({
        from,
        type: edge.type,
        target: edge.type === 'simple' ? edge.target : Object.values(edge.map)
      }))
    };
  }
}

/**
 * Pre-built graph configurations for common learning workflows
 */
export const LearningWorkflows = {
  /**
   * Standard hint delivery workflow
   * Struggle → Misconception Detection → Hint Generation → Outcome → Feedback
   */
  createHintWorkflow() {
    const graph = new TrailNoteGraph({ namespace: 'hint_workflow' });
    
    // Nodes are added by the integrating modules
    // This just sets up the structure
    
    graph.addConditionalEdges('START', (state) => {
      if (!state.conceptId) return 'NO_CONTEXT';
      if (state.struggleLevel === 'none') return 'NO_STRUGGLE';
      return 'ANALYZE';
    }, {
      NO_CONTEXT: 'END',
      NO_STRUGGLE: 'END',
      ANALYZE: 'struggle_analyzer'
    });
    
    return graph;
  },

  /**
   * Feedback loop workflow
   * Outcome → Analysis → Update → Propagate
   */
  createFeedbackWorkflow() {
    const graph = new TrailNoteGraph({ namespace: 'feedback_workflow' });
    
    graph.addConditionalEdges('START', (state) => {
      if (!state.outcome) return 'NO_OUTCOME';
      if (state.outcome === 'passed') return 'SUCCESS';
      return 'FAILURE';
    }, {
      NO_OUTCOME: 'END',
      SUCCESS: 'update_mastery',
      FAILURE: 'analyze_failure'
    });
    
    return graph;
  },

  /**
   * Memory consolidation workflow
   * Pattern Detection → Rule Generation → User Approval → Persistence
   */
  createMemoryWorkflow() {
    const graph = new TrailNoteGraph({ namespace: 'memory_workflow' });
    
    graph.addConditionalEdges('START', (state) => {
      if (!state.detectedPattern) return 'NO_PATTERN';
      if (state.requiresApproval && !state.userApproved) return 'AWAIT_APPROVAL';
      return 'PERSIST';
    }, {
      NO_PATTERN: 'END',
      AWAIT_APPROVAL: 'request_approval',
      PERSIST: 'save_memory'
    });
    
    return graph;
  }
};

// Export singleton instance for convenience
export const graph = new TrailNoteGraph({ debug: false });

export default TrailNoteGraph;
