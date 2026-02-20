/**
 * Agent Designer UI - No-code interface for creating and running agents
 * The visual interface non-coders use to build and deploy agents
 */

import { agentBuilder } from '../../lib/agent-builder.js';
import { getAllActions, getActionsByCategory } from '../../lib/action-definitions.js';
import { getTemplate, getAllTemplates } from '../../lib/agent-templates.js';

// UI State
let currentView = 'gallery'; // 'gallery', 'designer', 'runner'
let selectedAgent = null;
let selectedTemplate = null;
let isEditing = false;

/**
 * Initialize the Agent Designer
 * @param {HTMLElement} container - The container element
 */
export async function initAgentDesigner(container) {
  if (!container) return;
  
  try {
    // Initialize the builder
    await agentBuilder.init();
    
    // Render the agent gallery
    await renderAgentGallery(container);
    
    // Setup event listeners
    setupEventListeners(container);
    
    console.log('[AgentDesigner] Initialized');
  } catch (error) {
    console.error('[AgentDesigner] Error initializing:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <div class="alert-content">
          <div class="alert-message">Error loading Agent Designer. Please try again.</div>
        </div>
      </div>
    `;
  }
}

/**
 * Render the Agent Gallery (main view)
 */
export async function renderAgentGallery(container) {
  currentView = 'gallery';
  
  const agents = await agentBuilder.getAllAgents();
  const templates = getAllTemplates();
  
  // Separate deployed agents and templates
  const deployedAgents = agents.filter(a => a.isDeployed);
  const beginnerTemplates = templates.filter(t => t.difficulty === 'beginner');
  
  container.innerHTML = `
    <div class="agent-gallery">
      <!-- Quick Start Section -->
      <div class="content-card">
        <div class="card-header">
          <h3 class="card-title">🚀 Quick Start</h3>
          <span class="card-subtitle">Deploy in 2 minutes, no coding required</span>
        </div>
        <div class="card-body">
          <div class="agent-grid">
            ${beginnerTemplates.map(template => `
              <div class="agent-card" data-template-id="${template.id}">
                <div class="agent-card-header">
                  <span class="agent-icon">${getAgentIcon(template.id)}</span>
                  <h4 class="agent-name">${template.name}</h4>
                </div>
                <p class="agent-description">${template.description}</p>
                <div class="agent-meta">
                  <span class="agent-time">⏱️ ${template.timeToDeploy}</span>
                  <span class="agent-difficulty difficulty-${template.difficulty}">${template.difficulty}</span>
                </div>
                <button class="btn-primary btn-block agent-deploy-btn" data-template-id="${template.id}">
                  Deploy Now
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <!-- My Agents Section -->
      <div class="content-card" style="margin-top: var(--space-4);">
        <div class="card-header">
          <h3 class="card-title">📦 My Agents</h3>
          <button class="btn-secondary btn-sm" id="createCustomAgent">
            <span>+</span> Create Custom
          </button>
        </div>
        <div class="card-body">
          ${deployedAgents.length > 0 ? `
            <div class="agent-list">
              ${deployedAgents.map(agent => `
                <div class="agent-list-item" data-agent-id="${agent.id}">
                  <div class="agent-list-info">
                    <span class="agent-icon-small">${getAgentIcon(agent.id)}</span>
                    <div>
                      <h4 class="agent-list-name">${agent.name}</h4>
                      <p class="agent-list-purpose">${agent.purpose || agent.description}</p>
                    </div>
                  </div>
                  <div class="agent-list-actions">
                    <button class="btn-primary btn-sm agent-run-btn" data-agent-id="${agent.id}">
                      ▶️ Run
                    </button>
                    <button class="btn-secondary btn-sm agent-edit-btn" data-agent-id="${agent.id}">
                      Edit
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <p>No custom agents yet. Deploy a Quick Start agent above, or create your own!</p>
            </div>
          `}
        </div>
      </div>
      
      <!-- More Templates Section -->
      <div class="content-card" style="margin-top: var(--space-4);">
        <div class="card-header">
          <h3 class="card-title">📚 More Templates</h3>
        </div>
        <div class="card-body">
          <div class="agent-grid">
            ${templates.filter(t => t.difficulty !== 'beginner').map(template => `
              <div class="agent-card agent-card-compact" data-template-id="${template.id}">
                <div class="agent-card-header">
                  <span class="agent-icon">${getAgentIcon(template.id)}</span>
                  <h4 class="agent-name">${template.name}</h4>
                  <span class="agent-difficulty difficulty-${template.difficulty}">${template.difficulty}</span>
                </div>
                <p class="agent-description">${template.description}</p>
                <button class="btn-secondary btn-sm agent-use-template-btn" data-template-id="${template.id}">
                  Use Template
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Bind events
  bindGalleryEvents(container);
}

/**
 * Render the Agent Designer (create/edit view)
 */
export async function renderAgentDesigner(container, templateId = null, agentId = null) {
  currentView = 'designer';
  
  let agent = null;
  let template = null;
  
  if (agentId) {
    agent = await agentBuilder.getAgent(agentId);
    isEditing = true;
  } else if (templateId) {
    template = getTemplate(templateId);
    isEditing = false;
  }
  
  const actions = getActionsByCategory();
  
  container.innerHTML = `
    <div class="agent-designer">
      <div class="designer-header">
        <button class="btn-secondary btn-sm" id="backToGallery">
          ← Back
        </button>
        <h2 class="designer-title">${isEditing ? 'Edit Agent' : 'Create Agent'}</h2>
      </div>
      
      <div class="designer-content">
        <!-- Agent Info -->
        <div class="content-card">
          <div class="card-header">
            <h3 class="card-title">Basic Info</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label" for="agentName">Agent Name</label>
              <input class="form-input" id="agentName" type="text" 
                placeholder="e.g., My Research Agent" 
                value="${agent?.name || template?.name || ''}">
            </div>
            
            <div class="form-group">
              <label class="form-label" for="agentPurpose">What does this agent do?</label>
              <textarea class="form-textarea" id="agentPurpose" rows="2" 
                placeholder="Describe in plain English what your agent should accomplish...">${agent?.purpose || template?.purpose || ''}</textarea>
              <small class="form-hint">Keep it simple - one clear goal works best</small>
            </div>
          </div>
        </div>
        
        <!-- Action Builder -->
        <div class="content-card" style="margin-top: var(--space-4);">
          <div class="card-header">
            <h3 class="card-title">Agent Actions</h3>
            <span class="card-subtitle">What steps should your agent take?</span>
          </div>
          <div class="card-body">
            <div class="action-palette">
              <div class="palette-section">
                <h4 class="palette-title">📥 Input Actions</h4>
                <div class="palette-actions">
                  ${actions.input.map(a => `
                    <div class="palette-action" data-action-id="${a.id}" draggable="true">
                      <span class="action-name">${a.name}</span>
                      <span class="action-desc">${a.description}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
              
              <div class="palette-section">
                <h4 class="palette-title">⚙️ Process Actions</h4>
                <div class="palette-actions">
                  ${actions.process.map(a => `
                    <div class="palette-action" data-action-id="${a.id}" draggable="true">
                      <span class="action-name">${a.name}</span>
                      <span class="action-desc">${a.description}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
              
              <div class="palette-section">
                <h4 class="palette-title">📤 Output Actions</h4>
                <div class="palette-actions">
                  ${actions.output.map(a => `
                    <div class="palette-action" data-action-id="${a.id}" draggable="true">
                      <span class="action-name">${a.name}</span>
                      <span class="action-desc">${a.description}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            
            <div class="action-canvas">
              <h4 class="canvas-title">Agent Flow</h4>
              <div id="actionFlow" class="action-flow">
                ${(agent?.actions || template?.actions || []).map((a, i) => `
                  <div class="flow-action" data-index="${i}">
                    <span class="flow-number">${i + 1}</span>
                    <div class="flow-content">
                      <span class="flow-name">${a.actionId}</span>
                      <span class="flow-desc">${a.description || ''}</span>
                    </div>
                    <button class="flow-remove" data-index="${i}">×</button>
                  </div>
                `).join('') || '<p class="empty-flow">Drag actions here or click to add</p>'}
              </div>
              <button class="btn-secondary btn-sm" id="addActionBtn">+ Add Step</button>
            </div>
          </div>
        </div>
        
        <!-- Behavior Settings -->
        <div class="content-card" style="margin-top: var(--space-4);">
          <div class="card-header">
            <h3 class="card-title">Behavior</h3>
          </div>
          <div class="card-body">
            <div class="form-checkbox">
              <input type="checkbox" id="showProgress" ${agent?.behavior?.showProgress !== false ? 'checked' : ''}>
              <label for="showProgress">Show "thinking" indicator while running</label>
            </div>
            
            <div class="form-checkbox">
              <input type="checkbox" id="notifyComplete" ${agent?.behavior?.notifyOnComplete !== false ? 'checked' : ''}>
              <label for="notifyComplete">Notify when agent completes</label>
            </div>
            
            <div class="form-checkbox">
              <input type="checkbox" id="retryFailure" ${agent?.behavior?.retryOnFailure ? 'checked' : ''}>
              <label for="retryFailure">Retry automatically if agent fails</label>
            </div>
          </div>
        </div>
        
        <!-- Save/Deploy -->
        <div class="designer-actions">
          <button class="btn-secondary" id="saveAgent">
            💾 Save Draft
          </button>
          <button class="btn-primary" id="deployAgent">
            🚀 Deploy Agent
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Bind designer events
  bindDesignerEvents(container, agent, template);
}

/**
 * Render the Agent Runner (execution view)
 */
export async function renderAgentRunner(container, agentId, input = {}) {
  currentView = 'runner';
  
  const agent = await agentBuilder.getAgent(agentId);
  
  if (!agent) {
    container.innerHTML = `
      <div class="alert alert-error">
        <div class="alert-content">
          <div class="alert-message">Agent not found</div>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="agent-runner">
      <div class="runner-header">
        <button class="btn-secondary btn-sm" id="backToGallery">
          ← Back
        </button>
        <h2 class="runner-title">${agent.name}</h2>
        <span class="runner-status" id="runnerStatus">Ready</span>
      </div>
      
      <div class="runner-content">
        <!-- Agent Info -->
        <div class="content-card">
          <div class="card-body">
            <p class="runner-purpose">${agent.purpose || agent.description}</p>
          </div>
        </div>
        
        <!-- Input Section (if needed) -->
        <div class="content-card" style="margin-top: var(--space-4);" id="inputSection">
          <div class="card-header">
            <h3 class="card-title">Input</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label" for="agentInput">What would you like the agent to focus on?</label>
              <input class="form-input" id="agentInput" type="text" 
                placeholder="e.g., 'organize my notes about CSS layout'">
            </div>
          </div>
        </div>
        
        <!-- Progress Section -->
        <div class="content-card" style="margin-top: var(--space-4);" id="progressSection" style="display: none;">
          <div class="card-header">
            <h3 class="card-title">Agent Progress</h3>
          </div>
          <div class="card-body">
            <div class="progress-indicator">
              <div class="spinner"></div>
              <span id="progressMessage">Starting...</span>
            </div>
            
            <div class="action-progress" id="actionProgress">
              ${agent.actions.map((a, i) => `
                <div class="action-step" data-index="${i}">
                  <span class="step-number">${i + 1}</span>
                  <span class="step-name">${a.description || a.actionId}</span>
                  <span class="step-status">⏳</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        
        <!-- Results Section -->
        <div class="content-card" style="margin-top: var(--space-4);" id="resultsSection" style="display: none;">
          <div class="card-header">
            <h3 class="card-title">Results</h3>
          </div>
          <div class="card-body" id="resultsContent">
            <!-- Results will be injected here -->
          </div>
        </div>
        
        <!-- Run Button -->
        <div class="runner-actions">
          <button class="btn-primary btn-lg" id="runAgentBtn">
            ▶️ Run Agent
          </button>
          <button class="btn-secondary" id="stopAgentBtn" style="display: none;">
            ⏹️ Stop
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Bind runner events
  bindRunnerEvents(container, agent);
}

/**
 * Bind gallery event listeners
 */
function bindGalleryEvents(container) {
  // Deploy buttons
  container.querySelectorAll('.agent-deploy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const templateId = btn.dataset.templateId;
      await quickDeployAgent(templateId, container);
    });
  });
  
  // Run buttons
  container.querySelectorAll('.agent-run-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const agentId = btn.dataset.agentId;
      await renderAgentRunner(container, agentId);
    });
  });
  
  // Edit buttons
  container.querySelectorAll('.agent-edit-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const agentId = btn.dataset.agentId;
      await renderAgentDesigner(container, null, agentId);
    });
  });
  
  // Create custom button
  const createBtn = container.querySelector('#createCustomAgent');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      await renderAgentDesigner(container, 'custom_agent');
    });
  }
  
  // Use template buttons
  container.querySelectorAll('.agent-use-template-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const templateId = btn.dataset.templateId;
      await renderAgentDesigner(container, templateId);
    });
  });
}

/**
 * Bind designer event listeners
 */
function bindDesignerEvents(container, agent, template) {
  // Back button
  const backBtn = container.querySelector('#backToGallery');
  if (backBtn) {
    backBtn.addEventListener('click', async () => {
      await renderAgentGallery(container);
    });
  }
  
  // Save button
  const saveBtn = container.querySelector('#saveAgent');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await saveAgentConfig(container, agent?.id);
    });
  }
  
  // Deploy button
  const deployBtn = container.querySelector('#deployAgent');
  if (deployBtn) {
    deployBtn.addEventListener('click', async () => {
      await saveAndDeployAgent(container, agent?.id);
    });
  }
  
  // Add action button
  const addBtn = container.querySelector('#addActionBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      showActionPicker(container);
    });
  }
  
  // Palette action clicks
  container.querySelectorAll('.palette-action').forEach(action => {
    action.addEventListener('click', () => {
      addActionToFlow(container, action.dataset.actionId);
    });
  });
}

/**
 * Bind runner event listeners
 */
function bindRunnerEvents(container, agent) {
  // Back button
  const backBtn = container.querySelector('#backToGallery');
  if (backBtn) {
    backBtn.addEventListener('click', async () => {
      await renderAgentGallery(container);
    });
  }
  
  // Run button
  const runBtn = container.querySelector('#runAgentBtn');
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      await executeAgent(container, agent);
    });
  }
  
  // Stop button
  const stopBtn = container.querySelector('#stopAgentBtn');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      await stopAgent(container);
    });
  }
}

/**
 * Quick deploy an agent from template
 */
async function quickDeployAgent(templateId, container) {
  try {
    const btn = container.querySelector(`.agent-deploy-btn[data-template-id="${templateId}"]`);
    if (btn) {
      btn.textContent = 'Deploying...';
      btn.disabled = true;
    }
    
    const agent = await agentBuilder.quickDeploy(templateId);
    
    // Show success and refresh
    await renderAgentGallery(container);
    
    // Show notification
    showNotification(`${agent.name} deployed successfully!`, 'success');
    
  } catch (error) {
    console.error('[AgentDesigner] Error deploying:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

/**
 * Save agent configuration
 */
async function saveAgentConfig(container, existingId = null) {
  const name = container.querySelector('#agentName')?.value;
  const purpose = container.querySelector('#agentPurpose')?.value;
  
  if (!name) {
    showNotification('Please enter an agent name', 'error');
    return;
  }
  
  try {
    if (existingId) {
      await agentBuilder.updateAgent(existingId, { name, purpose });
    } else {
      await agentBuilder.createCustomAgent({
        name,
        purpose,
        actions: [{ actionId: 'read_memory', description: 'Read notes' }] // Default
      });
    }
    
    showNotification('Agent saved!', 'success');
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  }
}

/**
 * Save and deploy agent
 */
async function saveAndDeployAgent(container, existingId = null) {
  await saveAgentConfig(container, existingId);
  // Then deploy logic...
}

/**
 * Execute an agent
 */
async function executeAgent(container, agent) {
  const inputEl = container.querySelector('#agentInput');
  const input = inputEl?.value || {};
  
  // Show progress section
  const progressSection = container.querySelector('#progressSection');
  const resultsSection = container.querySelector('#resultsSection');
  const runBtn = container.querySelector('#runAgentBtn');
  const stopBtn = container.querySelector('#stopAgentBtn');
  const statusEl = container.querySelector('#runnerStatus');
  
  if (progressSection) progressSection.style.display = 'block';
  if (runBtn) runBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  if (statusEl) statusEl.textContent = 'Running...';
  
  try {
    const result = await agentBuilder.runAgent(agent.id, { topic: input }, {
      onProgress: (progress) => {
        updateProgress(container, progress);
      },
      onComplete: (result) => {
        showResults(container, result);
        if (statusEl) statusEl.textContent = 'Completed';
        if (runBtn) runBtn.style.display = 'inline-flex';
        if (stopBtn) stopBtn.style.display = 'none';
      },
      onError: (error, result) => {
        showError(container, error);
        if (statusEl) statusEl.textContent = 'Failed';
        if (runBtn) runBtn.style.display = 'inline-flex';
        if (stopBtn) stopBtn.style.display = 'none';
      }
    });
    
  } catch (error) {
    console.error('[AgentDesigner] Error running agent:', error);
    showError(container, error);
  }
}

/**
 * Stop agent execution
 */
async function stopAgent(container) {
  // Import and call stop on executor
  const { agentExecutor } = await import('../../lib/agent-executor.js');
  await agentExecutor.stop();
  
  const statusEl = container.querySelector('#runnerStatus');
  if (statusEl) statusEl.textContent = 'Stopped';
  
  showNotification('Agent stopped', 'info');
}

/**
 * Update progress display
 */
function updateProgress(container, progress) {
  const messageEl = container.querySelector('#progressMessage');
  if (messageEl) {
    messageEl.textContent = progress.message;
  }
  
  // Update action steps
  if (progress.state) {
    const steps = container.querySelectorAll('.action-step');
    steps.forEach((step, i) => {
      if (i < progress.state.actionIndex) {
        step.querySelector('.step-status').textContent = '✅';
      } else if (i === progress.state.actionIndex) {
        step.querySelector('.step-status').textContent = '🔄';
      }
    });
  }
}

/**
 * Show results
 */
function showResults(container, result) {
  const resultsSection = container.querySelector('#resultsSection');
  const resultsContent = container.querySelector('#resultsContent');
  
  if (resultsSection) resultsSection.style.display = 'block';
  
  if (resultsContent && result.results) {
    // Find display_result action output
    const displayAction = result.results.find(r => r.actionId === 'display_result');
    
    if (displayAction?.result?.output) {
      resultsContent.innerHTML = `
        <div class="result-output">
          ${formatOutput(displayAction.result.output)}
        </div>
      `;
    } else {
      resultsContent.innerHTML = `
        <p>Agent completed ${result.actionsExecuted} actions.</p>
        <pre>${JSON.stringify(result.results, null, 2)}</pre>
      `;
    }
  }
}

/**
 * Show error
 */
function showError(container, error) {
  const resultsSection = container.querySelector('#resultsSection');
  const resultsContent = container.querySelector('#resultsContent');
  
  if (resultsSection) resultsSection.style.display = 'block';
  if (resultsContent) {
    resultsContent.innerHTML = `
      <div class="alert alert-error">
        <div class="alert-content">
          <div class="alert-title">Error</div>
          <div class="alert-message">${error.message}</div>
        </div>
      </div>
    `;
  }
}

/**
 * Format output based on type
 */
function formatOutput(output) {
  if (output.format === 'list') {
    const items = output.message.split('\n').filter(s => s.trim());
    return `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  }
  return `<p>${output.message}</p>`;
}

/**
 * Show action picker modal
 */
function showActionPicker(container) {
  // Simple implementation - could be enhanced with modal
  const flow = container.querySelector('#actionFlow');
  const currentCount = flow.querySelectorAll('.flow-action').length;
  
  // Add a default action
  addActionToFlow(container, 'read_memory');
}

/**
 * Add action to flow
 */
function addActionToFlow(container, actionId) {
  const flow = container.querySelector('#actionFlow');
  const emptyFlow = flow.querySelector('.empty-flow');
  if (emptyFlow) emptyFlow.remove();
  
  const index = flow.querySelectorAll('.flow-action').length;
  
  const actionEl = document.createElement('div');
  actionEl.className = 'flow-action';
  actionEl.dataset.index = index;
  actionEl.innerHTML = `
    <span class="flow-number">${index + 1}</span>
    <div class="flow-content">
      <span class="flow-name">${actionId}</span>
      <span class="flow-desc">Click to configure</span>
    </div>
    <button class="flow-remove" data-index="${index}">×</button>
  `;
  
  flow.appendChild(actionEl);
  
  // Bind remove
  actionEl.querySelector('.flow-remove').addEventListener('click', () => {
    actionEl.remove();
    reindexActions(flow);
  });
}

/**
 * Reindex actions after removal
 */
function reindexActions(flow) {
  const actions = flow.querySelectorAll('.flow-action');
  actions.forEach((action, i) => {
    action.dataset.index = i;
    action.querySelector('.flow-number').textContent = i + 1;
  });
}

/**
 * Setup global event listeners
 */
function setupEventListeners(container) {
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentView !== 'gallery') {
      renderAgentGallery(container);
    }
  });
}

/**
 * Get icon for agent type
 */
function getAgentIcon(agentId) {
  const icons = {
    'knowledge_curator': '📚',
    'learning_companion': '🧠',
    'note_synthesizer': '🔬',
    'knowledge_gap_finder': '🔍',
    'custom_agent': '🎨'
  };
  return icons[agentId] || '🤖';
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6b7280'};
    color: white;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

export default {
  initAgentDesigner,
  renderAgentGallery,
  renderAgentDesigner,
  renderAgentRunner
};
