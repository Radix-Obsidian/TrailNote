/**
 * Agent Builder - No-code agent creation and management
 * The main interface for non-coders to create, customize, and deploy agents
 */

import { store } from './storage.js';
import { getTemplate, getAllTemplates, createFromTemplate, validateTemplate } from './agent-templates.js';
import { getAllActions, getActionsByCategory } from './action-definitions.js';
import { agentExecutor } from './agent-executor.js';

// Store keys
const AGENTS_KEY = 'agent_builder_agents';
const DEPLOYED_KEY = 'agent_builder_deployed';

/**
 * Agent Builder Service
 * Handles agent creation, modification, deployment, and lifecycle
 */
export const agentBuilder = {
  
  /**
   * Initialize the agent builder
   */
  async init() {
    // Ensure storage keys exist
    const agents = await store.get(AGENTS_KEY, {});
    if (!agents || Object.keys(agents).length === 0) {
      // Seed with default templates
      const templates = getAllTemplates();
      const seedAgents = {};
      
      for (const template of templates) {
        seedAgents[template.id] = {
          ...template,
          isTemplate: true,
          isDeployed: template.difficulty === 'beginner' // Auto-deploy beginner templates
        };
      }
      
      await store.set(AGENTS_KEY, seedAgents);
    }
    
    console.log('[AgentBuilder] Initialized');
    return true;
  },
  
  /**
   * Get all available agents (templates + custom)
   */
  async getAllAgents() {
    const agents = await store.get(AGENTS_KEY, {});
    return Object.values(agents);
  },
  
  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId) {
    const agents = await store.get(AGENTS_KEY, {});
    return agents[agentId] || null;
  },
  
  /**
   * Get deployed agents (ready to run)
   */
  async getDeployedAgents() {
    const agents = await this.getAllAgents();
    return agents.filter(a => a.isDeployed);
  },
  
  /**
   * Create a new agent from a template
   * @param {string} templateId - The template to use
   * @param {Object} customizations - Optional customizations
   */
  async createAgent(templateId, customizations = {}) {
    const agent = createFromTemplate(templateId, customizations);
    
    if (!agent) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // Validate
    const validation = validateTemplate(agent);
    if (!validation.valid) {
      throw new Error(`Invalid agent: ${validation.errors.join(', ')}`);
    }
    
    // Save to storage
    const agents = await store.get(AGENTS_KEY, {});
    agents[agent.id] = agent;
    await store.set(AGENTS_KEY, agents);
    
    console.log('[AgentBuilder] Created agent:', agent.id);
    return agent;
  },
  
  /**
   * Update an existing agent
   */
  async updateAgent(agentId, updates) {
    const agents = await store.get(AGENTS_KEY, {});
    
    if (!agents[agentId]) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    // Merge updates
    agents[agentId] = {
      ...agents[agentId],
      ...updates,
      modifiedAt: Date.now()
    };
    
    // Validate
    const validation = validateTemplate(agents[agentId]);
    if (!validation.valid) {
      throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`);
    }
    
    await store.set(AGENTS_KEY, agents);
    
    console.log('[AgentBuilder] Updated agent:', agentId);
    return agents[agentId];
  },
  
  /**
   * Delete an agent
   */
  async deleteAgent(agentId) {
    const agents = await store.get(AGENTS_KEY, {});
    
    if (!agents[agentId]) {
      return false;
    }
    
    // Don't delete templates
    if (agents[agentId].isTemplate) {
      throw new Error('Cannot delete template agents');
    }
    
    delete agents[agentId];
    await store.set(AGENTS_KEY, agents);
    
    console.log('[AgentBuilder] Deleted agent:', agentId);
    return true;
  },
  
  /**
   * Deploy an agent (make it runnable)
   */
  async deployAgent(agentId) {
    const agent = await this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    // Mark as deployed
    await this.updateAgent(agentId, { isDeployed: true });
    
    // Track deployment
    const deployed = await store.get(DEPLOYED_KEY, []);
    if (!deployed.includes(agentId)) {
      deployed.push(agentId);
      await store.set(DEPLOYED_KEY, deployed);
    }
    
    console.log('[AgentBuilder] Deployed agent:', agentId);
    return true;
  },
  
  /**
   * Undeploy an agent
   */
  async undeployAgent(agentId) {
    await this.updateAgent(agentId, { isDeployed: false });
    
    const deployed = await store.get(DEPLOYED_KEY, []);
    const index = deployed.indexOf(agentId);
    if (index > -1) {
      deployed.splice(index, 1);
      await store.set(DEPLOYED_KEY, deployed);
    }
    
    return true;
  },
  
  /**
   * Run an agent
   * @param {string} agentId - The agent to run
   * @param {Object} input - User input/context
   * @param {Object} callbacks - Progress callbacks
   */
  async runAgent(agentId, input = {}, callbacks = {}) {
    const agent = await this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    if (!agent.isDeployed && !agent.isTemplate) {
      throw new Error('Agent must be deployed before running');
    }
    
    // Build execution context
    const context = {
      userInput: input,
      agentId: agent.id,
      agentName: agent.name,
      startedAt: Date.now()
    };
    
    // Execute the agent
    const result = await agentExecutor.execute(agent, context, callbacks);
    
    // Track execution
    await this._trackExecution(agentId, result);
    
    return result;
  },
  
  /**
   * Get available actions for building agents
   */
  getAvailableActions() {
    return getAllActions();
  },
  
  /**
   * Get actions organized by category
   */
  getActionsByCategory() {
    return {
      input: getActionsByCategory('input'),
      process: getActionsByCategory('process'),
      output: getActionsByCategory('output')
    };
  },
  
  /**
   * Get available templates
   */
  getTemplates() {
    return getAllTemplates();
  },
  
  /**
   * Quick deploy - Create and deploy in one step
   * For the fastest path to a running agent
   */
  async quickDeploy(templateId, customName = null) {
    const customizations = customName ? { name: customName } : {};
    const agent = await this.createAgent(templateId, customizations);
    await this.deployAgent(agent.id);
    return agent;
  },
  
  /**
   * Create a custom agent from scratch
   * Guided process for non-coders
   */
  async createCustomAgent(config) {
    const { name, purpose, actions, behavior = {} } = config;
    
    // Build agent from config
    const agent = {
      id: `custom_${Date.now()}`,
      name,
      description: purpose,
      difficulty: 'custom',
      timeToDeploy: '5 minutes',
      purpose,
      actions: actions.map((a, i) => ({
        actionId: a.actionId,
        params: a.params || {},
        description: a.description || `Step ${i + 1}`
      })),
      behavior: {
        trigger: 'manual',
        requiresConfirmation: false,
        showProgress: true,
        notifyOnComplete: true,
        maxExecutionTime: 60000,
        retryOnFailure: true,
        retryCount: 2,
        ...behavior
      },
      onboarding: {
        welcomeMessage: `Hi! I'm ${name}. ${purpose}`,
        steps: actions.map(a => a.description || `Execute ${a.actionId}`),
        example: '',
        tips: []
      },
      customization: {
        canModifyActions: true,
        canAddActions: true,
        canChangeTrigger: true,
        availableParams: ['all']
      },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isCustom: true,
      isTemplate: false
    };
    
    // Validate
    const validation = validateTemplate(agent);
    if (!validation.valid) {
      throw new Error(`Invalid agent: ${validation.errors.join(', ')}`);
    }
    
    // Save
    const agents = await store.get(AGENTS_KEY, {});
    agents[agent.id] = agent;
    await store.set(AGENTS_KEY, agents);
    
    console.log('[AgentBuilder] Created custom agent:', agent.id);
    return agent;
  },
  
  /**
   * Duplicate an existing agent
   */
  async duplicateAgent(agentId, newName = null) {
    const original = await this.getAgent(agentId);
    
    if (!original) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    const duplicate = JSON.parse(JSON.stringify(original));
    duplicate.id = `copy_${Date.now()}`;
    duplicate.name = newName || `${original.name} (Copy)`;
    duplicate.createdAt = Date.now();
    duplicate.modifiedAt = Date.now();
    duplicate.isTemplate = false;
    
    const agents = await store.get(AGENTS_KEY, {});
    agents[duplicate.id] = duplicate;
    await store.set(AGENTS_KEY, agents);
    
    return duplicate;
  },
  
  /**
   * Get agent execution history
   */
  async getExecutionHistory(agentId, limit = 10) {
    const key = `agent_history_${agentId}`;
    const history = await store.get(key, []);
    return history.slice(-limit);
  },
  
  /**
   * Track agent execution
   * @private
   */
  async _trackExecution(agentId, result) {
    const key = `agent_history_${agentId}`;
    const history = await store.get(key, []);
    
    history.push({
      timestamp: Date.now(),
      status: result.status,
      actionsExecuted: result.actionsExecuted,
      elapsed: result.elapsed,
      errorCount: result.errors?.length || 0
    });
    
    // Keep last 100 executions
    if (history.length > 100) {
      history.shift();
    }
    
    await store.set(key, history);
  },
  
  /**
   * Get agent statistics
   */
  async getAgentStats(agentId) {
    const history = await this.getExecutionHistory(agentId, 100);
    
    if (history.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        averageTime: 0,
        lastRun: null
      };
    }
    
    const successful = history.filter(h => h.status === 'completed').length;
    const totalTime = history.reduce((sum, h) => sum + h.elapsed, 0);
    
    return {
      totalRuns: history.length,
      successRate: Math.round((successful / history.length) * 100),
      averageTime: Math.round(totalTime / history.length),
      lastRun: history[history.length - 1].timestamp
    };
  }
};

export default agentBuilder;
