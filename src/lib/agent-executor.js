/**
 * Agent Executor - The Perception-Reasoning-Action Loop
 * Orchestrates agent execution without requiring any coding knowledge
 * 
 * This is the "brain" that runs agents:
 * 1. PERCEPTION: Understand the current state and context
 * 2. REASONING: Decide what to do next
 * 3. ACTION: Execute the chosen action
 * 4. REPEAT until goal is achieved
 */

import { store } from './storage.js';
import { nlu } from './nlu.js';
import { conceptGraph } from './concept-graph.js';
import { getAction, validateActionParams } from './action-definitions.js';

// Execution states
const EXECUTION_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Store key for agent state
const AGENT_STATE_KEY = 'agent_executor_state';

/**
 * Agent Executor - Manages the execution of agents
 */
export class AgentExecutor {
  constructor() {
    this.state = EXECUTION_STATE.IDLE;
    this.currentAgent = null;
    this.currentActionIndex = 0;
    this.context = {};
    this.results = [];
    this.errors = [];
    this.startTime = null;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  /**
   * Execute an agent from start to finish
   * @param {Object} agent - The agent configuration to execute
   * @param {Object} initialContext - Starting context (user input, current state)
   * @param {Object} callbacks - Optional callbacks for progress, completion, errors
   * @returns {Object} Execution results
   */
  async execute(agent, initialContext = {}, callbacks = {}) {
    // Set callbacks
    this.onProgress = callbacks.onProgress || null;
    this.onComplete = callbacks.onComplete || null;
    this.onError = callbacks.onError || null;
    
    // Initialize execution
    this.state = EXECUTION_STATE.RUNNING;
    this.currentAgent = agent;
    this.currentActionIndex = 0;
    this.context = { ...initialContext };
    this.results = [];
    this.errors = [];
    this.startTime = Date.now();
    
    // Save initial state
    await this._saveState();
    
    try {
      // Report progress
      this._reportProgress('starting', `Starting ${agent.name}...`);
      
      // Validate agent has actions
      if (!agent.actions || agent.actions.length === 0) {
        throw new Error('Agent has no actions to execute');
      }
      
      // Execute each action in sequence
      for (let i = 0; i < agent.actions.length; i++) {
        // Check if we should stop
        if (this.state === EXECUTION_STATE.PAUSED) {
          await this._saveState();
          return this._createResult('paused');
        }
        
        if (this.state === EXECUTION_STATE.FAILED) {
          return this._createResult('failed');
        }
        
        // Check timeout
        if (agent.behavior?.maxExecutionTime) {
          const elapsed = Date.now() - this.startTime;
          if (elapsed > agent.behavior.maxExecutionTime) {
            throw new Error('Agent execution timed out');
          }
        }
        
        this.currentActionIndex = i;
        const actionConfig = agent.actions[i];
        
        // Report progress
        this._reportProgress('action', actionConfig.description || `Executing action ${i + 1}...`);
        
        // Execute the action
        const actionResult = await this._executeAction(actionConfig, i);
        
        // Store result for reference by subsequent actions
        this.results.push(actionResult);
        
        // Update context with result
        this.context[`action_${i}`] = actionResult;
        this.context.previous = actionResult;
        
        // Save state after each action
        await this._saveState();
      }
      
      // Execution complete
      this.state = EXECUTION_STATE.COMPLETED;
      await this._saveState();
      
      // Report completion
      this._reportProgress('complete', 'Agent execution complete!');
      
      // Call completion callback
      if (this.onComplete) {
        this.onComplete(this._createResult('completed'));
      }
      
      return this._createResult('completed');
      
    } catch (error) {
      // Handle execution error
      this.state = EXECUTION_STATE.FAILED;
      this.errors.push({
        actionIndex: this.currentActionIndex,
        error: error.message,
        timestamp: Date.now()
      });
      
      await this._saveState();
      
      // Report error
      this._reportProgress('error', `Error: ${error.message}`);
      
      // Call error callback
      if (this.onError) {
        this.onError(error, this._createResult('failed'));
      }
      
      // Retry if configured
      if (agent.behavior?.retryOnFailure && this.errors.length < (agent.behavior.retryCount || 2)) {
        return this._retry(agent);
      }
      
      return this._createResult('failed');
    }
  }

  /**
   * Execute a single action
   * @private
   */
  async _executeAction(actionConfig, index) {
    const { actionId, params } = actionConfig;
    
    // Get the action definition
    const action = getAction(actionId);
    if (!action) {
      throw new Error(`Unknown action: ${actionId}`);
    }
    
    // Resolve parameter references (e.g., ${previous.found_items})
    const resolvedParams = this._resolveParams(params);
    
    // Validate parameters
    const validation = validateActionParams(actionId, resolvedParams);
    if (!validation.valid) {
      console.warn(`Action ${actionId} validation warnings:`, validation.errors);
    }
    
    // Execute the action
    try {
      const result = await action.execute(resolvedParams, this.context);
      
      return {
        actionId,
        index,
        params: resolvedParams,
        result,
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Action ${actionId} failed: ${error.message}`);
    }
  }

  /**
   * Resolve parameter references
   * Handles ${previous.field}, ${context.field}, ${userInput.field}
   * @private
   */
  _resolveParams(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }
    
    const resolved = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Check for reference patterns
        resolved[key] = this._resolveReference(value);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively resolve nested objects
        resolved[key] = this._resolveParams(value);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  /**
   * Resolve a single reference string
   * @private
   */
  _resolveReference(value) {
    // Match ${...} pattern
    const referencePattern = /\$\{([^}]+)\}/g;
    
    return value.replace(referencePattern, (match, path) => {
      const parts = path.split('.');
      let current = this.context;
      
      for (const part of parts) {
        if (current === null || current === undefined) {
          return match; // Keep original if not found
        }
        current = current[part];
      }
      
      // Handle different types
      if (current === null || current === undefined) {
        return '';
      } else if (typeof current === 'object') {
        if (Array.isArray(current)) {
          return current;
        }
        return JSON.stringify(current);
      }
      
      return String(current);
    });
  }

  /**
   * Retry failed execution
   * @private
   */
  async _retry(agent) {
    console.log(`[AgentExecutor] Retrying agent execution (attempt ${this.errors.length + 1})...`);
    
    // Reset to failed action
    this.state = EXECUTION_STATE.RUNNING;
    this.currentActionIndex = Math.max(0, this.currentActionIndex - 1);
    
    // Remove failed result
    if (this.results.length > this.currentActionIndex) {
      this.results.pop();
    }
    
    // Continue execution from failed action
    try {
      for (let i = this.currentActionIndex; i < agent.actions.length; i++) {
        this.currentActionIndex = i;
        const actionConfig = agent.actions[i];
        
        this._reportProgress('action', `Retrying: ${actionConfig.description || `Action ${i + 1}`}`);
        
        const actionResult = await this._executeAction(actionConfig, i);
        this.results.push(actionResult);
        this.context[`action_${i}`] = actionResult;
        this.context.previous = actionResult;
        
        await this._saveState();
      }
      
      this.state = EXECUTION_STATE.COMPLETED;
      await this._saveState();
      
      if (this.onComplete) {
        this.onComplete(this._createResult('completed'));
      }
      
      return this._createResult('completed');
      
    } catch (error) {
      this.errors.push({
        actionIndex: this.currentActionIndex,
        error: error.message,
        timestamp: Date.now(),
        isRetry: true
      });
      
      this.state = EXECUTION_STATE.FAILED;
      await this._saveState();
      
      if (this.onError) {
        this.onError(error, this._createResult('failed'));
      }
      
      return this._createResult('failed');
    }
  }

  /**
   * Pause execution
   */
  async pause() {
    if (this.state === EXECUTION_STATE.RUNNING) {
      this.state = EXECUTION_STATE.PAUSED;
      await this._saveState();
      this._reportProgress('paused', 'Execution paused');
    }
  }

  /**
   * Resume paused execution
   */
  async resume() {
    if (this.state === EXECUTION_STATE.PAUSED) {
      this.state = EXECUTION_STATE.RUNNING;
      await this._saveState();
      
      // Continue from where we left off
      if (this.currentAgent) {
        return this.execute(this.currentAgent, this.context, {
          onProgress: this.onProgress,
          onComplete: this.onComplete,
          onError: this.onError
        });
      }
    }
  }

  /**
   * Stop execution completely
   */
  async stop() {
    this.state = EXECUTION_STATE.IDLE;
    this.currentAgent = null;
    this.currentActionIndex = 0;
    this.results = [];
    this.errors = [];
    await this._saveState();
    this._reportProgress('stopped', 'Execution stopped');
  }

  /**
   * Get current execution state
   */
  getState() {
    return {
      state: this.state,
      agentId: this.currentAgent?.id,
      actionIndex: this.currentActionIndex,
      totalActions: this.currentAgent?.actions?.length || 0,
      resultsCount: this.results.length,
      errorsCount: this.errors.length,
      elapsed: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Report progress to callback
   * @private
   */
  _reportProgress(type, message) {
    if (this.onProgress) {
      this.onProgress({
        type,
        message,
        state: this.getState(),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Create execution result object
   * @private
   */
  _createResult(status) {
    return {
      status,
      agentId: this.currentAgent?.id,
      agentName: this.currentAgent?.name,
      actionsExecuted: this.results.length,
      totalActions: this.currentAgent?.actions?.length || 0,
      results: this.results,
      errors: this.errors,
      context: this.context,
      elapsed: this.startTime ? Date.now() - this.startTime : 0,
      completedAt: Date.now()
    };
  }

  /**
   * Save executor state to storage
   * @private
   */
  async _saveState() {
    const state = {
      state: this.state,
      agentId: this.currentAgent?.id,
      actionIndex: this.currentActionIndex,
      context: this.context,
      results: this.results,
      errors: this.errors,
      startTime: this.startTime,
      savedAt: Date.now()
    };
    
    await store.set(AGENT_STATE_KEY, state);
  }

  /**
   * Load executor state from storage
   */
  async loadState() {
    const state = await store.get(AGENT_STATE_KEY, null);
    
    if (state) {
      this.state = state.state;
      this.currentActionIndex = state.actionIndex;
      this.context = state.context || {};
      this.results = state.results || [];
      this.errors = state.errors || [];
      this.startTime = state.startTime;
    }
    
    return state;
  }

  /**
   * Clear saved state
   */
  async clearState() {
    await store.set(AGENT_STATE_KEY, null);
    this.state = EXECUTION_STATE.IDLE;
    this.currentAgent = null;
    this.currentActionIndex = 0;
    this.context = {};
    this.results = [];
    this.errors = [];
    this.startTime = null;
  }
}

// Export singleton instance
export const agentExecutor = new AgentExecutor();

export default agentExecutor;
