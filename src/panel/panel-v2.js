/**
 * TrailNote Agent Builder Panel v3.0
 * Main controller for the Agent Builder UI
 * Pivoted from learning/note-taking to AI agent creation platform
 */

import { store, notesApi } from '../lib/storage.js';
import { initChat } from './v2/chat.js';
import { initAgentDesigner, renderAgentGallery } from './v2/agent-designer.js';
import { agentBuilder } from '../lib/agent-builder.js';
import { hub as intelligenceHub } from '../lib/intelligence-hub.js';
import { bktEngine } from '../lib/bkt-engine.js';
import { learningVelocity } from '../lib/learning-velocity.js';

// Tone label map (defined locally, not exported from tutor.js)
const toneLabelMap = {
  nudge: 'Nudge mode',
  study: 'Study mode',
  exam: 'Exam mode'
};

// Global state
let currentContext = null;
let currentTone = 'nudge';
let chat = null;
let lastConceptId = null;   // Tracks the concept for the most recent hint (for BKT wiring)
let lastHintRequestTime = null; // Tracks when the last hint was requested (for velocity)

// Import outcome tracker once it's loaded
let outcomeTracker;
if (typeof window !== 'undefined') {
  import('../lib/outcome-tracker.js').then(module => {
    outcomeTracker = module.default;
    console.log('[HintHopper] Outcome tracker loaded');
  }).catch(err => {
    console.error('[HintHopper] Failed to load outcome tracker:', err);
  });
}

// Import mastery view module
let masteryView;
if (typeof window !== 'undefined') {
  import('./v2/mastery-view.js').then(module => {
    masteryView = module.default;
    console.log('[HintHopper] Mastery view module loaded');
    // Initialize mastery view if we're already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initMasteryView();
    }
  }).catch(err => {
    console.error('[HintHopper] Failed to load mastery view:', err);
  });
}

// Import knowledge graph view (renamed from mastery view)
let knowledgeGraphView;
if (typeof window !== 'undefined') {
  import('./v2/mastery-view.js').then(module => {
    knowledgeGraphView = module.default;
    console.log('[TrailNote] Knowledge graph view loaded');
  }).catch(err => {
    console.error('[TrailNote] Failed to load knowledge graph view:', err);
  });
}

// Import analytics view module
let analyticsView;
if (typeof window !== 'undefined') {
  import('./v2/analytics-view.js').then(module => {
    analyticsView = module.default;
    console.log('[HintHopper] Analytics view loaded');
    // Initialize analytics if we're already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initAnalyticsView();
    }
  }).catch(err => {
    console.error('[HintHopper] Failed to load analytics view:', err);
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[TrailNote] Initializing Agent Builder...');
  await initSettings();
  await initNavigation();
  await initChatInterface();
  await initAgentBuilder();
  await initAgentMemory();
  await initKnowledgeGraph();
  await initAgentActivity();
  requestContextRefresh();

  // Initialize BKT engine (non-blocking)
  bktEngine.init().catch(e => console.warn('[TrailNote] BKT init error:', e));

  // Initialize Learning Velocity and show review pill if concepts are due
  learningVelocity.init().then(async () => {
    await updateReviewDuePill();
  }).catch(e => console.warn('[TrailNote] LearningVelocity init error:', e));

  // Initialize Intelligence Hub (non-blocking)
  intelligenceHub.init().then(() => {
    console.log('[TrailNote] Intelligence Hub ready');
    renderIntelligenceStatus();
    // Listen for pending memory approvals
    intelligenceHub.on('pending_approvals', ({ count }) => {
      showPendingApprovalsNotification(count);
    });
    intelligenceHub.on('velocity_blockers', ({ blockers }) => {
      if (blockers.length > 0 && blockers[0].severity > 0.7) {
        showNotification(`Velocity blocker: ${blockers[0].description}`, 'warning');
      }
    });
  }).catch(e => console.warn('[TrailNote] Intelligence Hub init error (non-critical):', e));
});

// === Settings Management ===
async function initSettings() {
  console.log('[HintHopper] Initializing settings');
  // Load saved settings
  const llmProvider = await store.get('llmProvider', 'openai');
  const apiKey = await store.get('apiKey', '');
  const groqApiKey = await store.get('groqApiKey', '');
  const ollamaUrl = await store.get('ollamaUrl', 'http://localhost:11434');
  const hintMode = await store.get('hintMode', 'strict');
  const tutorTone = await store.get('tutorTone', 'nudge');
  const model = await store.get('model', 'gpt-4o-mini');
  const groqModel = await store.get('groqModel', 'llama-3.1-8b-instant');
  const ollamaModel = await store.get('ollamaModel', 'llama2');
  const debugMode = await store.get('debugMode', false);
  const mockLLM = await store.get('mockLLM', false);
  const improveBunji = await store.get('improve_bunji_enabled', false);
  
  console.log('[HintHopper] Settings loaded:', { llmProvider, hintMode, tutorTone });
  
  // Set form values
  const providerSelect = document.getElementById('llmProvider');
  const apiKeyInput = document.getElementById('apiKey');
  const groqApiKeyInput = document.getElementById('groqApiKey');
  const ollamaUrlInput = document.getElementById('ollamaUrl');
  const hintModeSelect = document.getElementById('hintMode');
  const bunjiToneSelect = document.getElementById('bunjiTone');
  const modelSelect = document.getElementById('modelSelect');
  const groqModelSelect = document.getElementById('groqModel');
  const ollamaModelSelect = document.getElementById('ollamaModel');
  const debugModeCheckbox = document.getElementById('debugMode');
  const mockLLMCheckbox = document.getElementById('mockLLM');
  const improveBunjiCheckbox = document.getElementById('improveBunji');
  
  // Check if elements exist before setting values
  if (providerSelect) providerSelect.value = llmProvider;
  if (apiKeyInput) apiKeyInput.value = apiKey;
  if (groqApiKeyInput) groqApiKeyInput.value = groqApiKey;
  if (ollamaUrlInput) ollamaUrlInput.value = ollamaUrl;
  if (hintModeSelect) hintModeSelect.value = hintMode;
  if (bunjiToneSelect) bunjiToneSelect.value = tutorTone;
  if (modelSelect) modelSelect.value = model;
  if (groqModelSelect) groqModelSelect.value = groqModel;
  if (ollamaModelSelect && ollamaModel) ollamaModelSelect.value = ollamaModel;
  if (debugModeCheckbox) debugModeCheckbox.checked = debugMode;
  if (mockLLMCheckbox) mockLLMCheckbox.checked = mockLLM;
  if (improveBunjiCheckbox) improveBunjiCheckbox.checked = improveBunji;
  
  currentTone = bunjiTone;
  
  // Show/hide provider settings
  toggleProviderSettings(llmProvider);
  
  // Event listeners
  if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
      console.log('[HintHopper] Provider changed to:', e.target.value);
      toggleProviderSettings(e.target.value);
    });
  } else {
    console.warn('[HintHopper] Provider select element not found!');
  }
  
  const saveButton = document.getElementById('savePrefs');
  if (saveButton) {
    saveButton.addEventListener('click', saveSettings);
  } else {
    console.warn('[HintHopper] Save preferences button not found!');
  }
  
  // Privacy details link
  const privacyDetailsLink = document.getElementById('privacyDetailsLink');
  if (privacyDetailsLink) {
    privacyDetailsLink.addEventListener('click', (e) => {
      e.preventDefault();
      showPrivacyDetailsModal();
    });
  }
  
  // Ollama model refresh
  const refreshButton = document.getElementById('refreshOllamaModels');
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshOllamaModels);
  }
}

function toggleProviderSettings(provider) {
  document.getElementById('openaiSettings').style.display = provider === 'openai' ? 'block' : 'none';
  document.getElementById('groqSettings').style.display = provider === 'groq' ? 'block' : 'none';
  document.getElementById('ollamaSettings').style.display = provider === 'ollama' ? 'block' : 'none';
}

async function saveSettings() {
  console.log('[HintHopper] Saving settings...');
  const provider = document.getElementById('llmProvider')?.value || 'openai';
  
  // Save provider settings
  await store.set('llmProvider', provider);
  await store.set('apiKey', document.getElementById('apiKey')?.value || '');
  await store.set('groqApiKey', document.getElementById('groqApiKey')?.value || '');
  await store.set('ollamaUrl', document.getElementById('ollamaUrl')?.value || 'http://localhost:11434');
  
  // Save model selections
  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) {
    console.log('[HintHopper] Saving OpenAI model:', modelSelect.value);
    await store.set('model', modelSelect.value);
  }
  
  const groqModelSelect = document.getElementById('groqModel');
  if (groqModelSelect) {
    console.log('[HintHopper] Saving Groq model:', groqModelSelect.value);
    await store.set('groqModel', groqModelSelect.value);
  }
  
  const ollamaModelSelect = document.getElementById('ollamaModel');
  if (ollamaModelSelect) {
    console.log('[HintHopper] Saving Ollama model:', ollamaModelSelect.value);
    await store.set('ollamaModel', ollamaModelSelect.value);
  }
  
  // Save hint and tone settings
  const hintMode = document.getElementById('hintMode')?.value || 'strict';
  const bunjiTone = document.getElementById('bunjiTone')?.value || 'nudge';
  await store.set('hintMode', hintMode);
  await store.set('bunjiTone', bunjiTone);
  currentTone = bunjiTone;
  
  // Save checkbox settings
  const debugMode = document.getElementById('debugMode')?.checked || false;
  const mockLLM = document.getElementById('mockLLM')?.checked || false;
  const improveBunji = document.getElementById('improveBunji')?.checked || false;
  await store.set('debugMode', debugMode);
  await store.set('mockLLM', mockLLM);
  await store.set('improve_bunji_enabled', improveBunji);
  
  // If outcome tracking was toggled, update the outcome tracker
  if (typeof outcomeTracker !== 'undefined') {
    outcomeTracker.setEnabled(improveBunji);
  }
  
  // Show success feedback
  const btn = document.getElementById('savePrefs');
  if (!btn) {
    console.warn('[HintHopper] Save button not found when showing success feedback');
    return;
  }
  
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span>✓</span> Saved!';
  btn.classList.add('btn-success');
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.classList.remove('btn-success');
  }, 2000);
  
  console.log('[HintHopper] Settings saved successfully');
}

async function refreshOllamaModels() {
  const url = document.getElementById('ollamaUrl').value;
  const statusEl = document.getElementById('ollamaModelStatus');
  const btn = document.getElementById('refreshOllamaModels');
  
  btn.disabled = true;
  btn.textContent = 'Loading...';
  
  try {
    const response = await fetch(`${url}/api/tags`);
    const data = await response.json();
    const models = data.models || [];
    
    const select = document.getElementById('ollamaModel');
    select.innerHTML = models.map(m => 
      `<option value="${m.name}">${m.name}</option>`
    ).join('');
    
    statusEl.textContent = `Found ${models.length} model(s)`;
    statusEl.style.color = 'var(--color-success)';
  } catch (error) {
    statusEl.textContent = 'Failed to connect. Check URL and CORS settings.';
    statusEl.style.color = 'var(--color-error)';
  }
  
  btn.disabled = false;
  btn.textContent = 'Refresh';
}

// === Navigation ===
async function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  const views = {
    'agent-designer': document.getElementById('agent-designerView'),
    'agent-memory': document.getElementById('agent-memoryView'),
    'knowledge-graph': document.getElementById('knowledge-graphView'),
    'analytics': document.getElementById('analyticsView'),
    'settings': document.getElementById('settingsView')
  };
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      
      // Update active nav item
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      // Show corresponding view
      Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
      if (views[view]) views[view].style.display = 'block';
      
      // Special actions per view
      if (view === 'agent-memory') {
        renderMemoryList();
      } else if (view === 'knowledge-graph') {
        initKnowledgeGraphView();
      } else if (view === 'analytics') {
        initAgentActivityView();
      }
    });
  });
  
  // Assistant panel toggle
  document.getElementById('assistantToggle')?.addEventListener('click', toggleAssistant);
  document.getElementById('closeAssistant')?.addEventListener('click', toggleAssistant);
  
  // Mobile navigation
  const mobileToggle = document.getElementById('mobileNavToggle');
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('mobileOverlay');
  
  mobileToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  });
  
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
  
  // Update memory count
  updateMemoryCount();
}

function toggleAssistant() {
  const assistant = document.getElementById('appAssistant');
  assistant.classList.toggle('collapsed');
}

async function updateMemoryCount() {
  const notes = await notesApi.list();
  const badge = document.getElementById('memoryCount');
  if (badge) {
    badge.textContent = notes.length;
    badge.style.display = notes.length > 0 ? 'inline-flex' : 'none';
  }
}

// === Chat Interface ===
async function initChatInterface() {
  const container = document.getElementById('chatContainer');
  chat = initChat(container, {
    autoShow: false,
    persistMessages: true
  });
}

// === Agent Builder Integration ===
async function initAgentBuilder() {
  console.log('[TrailNote] Initializing Agent Builder...');
  
  // Initialize agent builder service
  await agentBuilder.init();
  
  // Render the agent gallery
  const container = document.getElementById('agentDesignerContent');
  if (container) {
    await initAgentDesigner(container);
  }
}

async function initAgentMemory() {
  console.log('[TrailNote] Initializing Agent Memory...');
  // Memory list will be rendered when view is shown
}

async function initKnowledgeGraph() {
  console.log('[TrailNote] Initializing Knowledge Graph...');
  // Will use existing mastery-view.js logic
}

async function initAgentActivity() {
  console.log('[TrailNote] Initializing Agent Activity...');
  // Will use existing analytics-view.js logic
}

async function renderMemoryList() {
  const listEl = document.getElementById('memoryList');
  if (!listEl) return;
  
  const notes = await notesApi.list();
  
  if (notes.length === 0) {
    listEl.innerHTML = '<li class="list-item">No memories yet. Run an agent to create memories.</li>';
    return;
  }
  
  listEl.innerHTML = notes.map(note => `
    <li class="list-item">
      <div class="list-item-content">
        <strong>${escapeHTML(note.problem || note.insight || 'Memory')}</strong>
        <small>${new Date(note.createdAt).toLocaleDateString()}</small>
      </div>
    </li>
  `).join('');
}

async function initKnowledgeGraphView() {
  const container = document.getElementById('knowledgeGraphContent');
  if (container && knowledgeGraphView) {
    knowledgeGraphView.init(container);
  }
}

async function initAgentActivityView() {
  const container = document.getElementById('analyticsContent');
  if (container && analyticsView) {
    analyticsView.init(container);
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function handleBunjiAction(mode) {
  console.log('[HintHopper] Handling Bunji action:', mode);
  
  if (!currentContext) {
    console.warn('[HintHopper] No context available for Bunji action')
    showNotification('Please navigate to a supported learning platform first.', 'warning');
    return;
  }

  // Derive concept ID from context for BKT tracking
  const conceptIdForAction = currentContext.challengeId ||
    (currentContext.title ? currentContext.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) : null);

  // If we already showed a hint for this concept, record a failure signal (user needed another hint)
  if (lastConceptId && lastConceptId === conceptIdForAction && lastHintRequestTime) {
    bktEngine.init().then(() => bktEngine.updateMastery(lastConceptId, false)).then(result => {
      console.log(`[TrailNote] BKT failure recorded for ${lastConceptId}: P(L) = ${result.masteryAfter.toFixed(3)}`);
    }).catch(e => console.warn('[TrailNote] BKT failure update error:', e));
  }

  // Set tracking state for this hint request
  lastConceptId = conceptIdForAction;
  lastHintRequestTime = Date.now();
  
  // Show debug info about current context
  console.log('[HintHopper] Current context:', {
    title: currentContext.title,
    url: currentContext.url,
    testsCount: currentContext.tests?.length || 0,
    codeLength: currentContext.userCode?.length || 0,
    ruleHints: currentContext.ruleHints || '',
    tone: currentTone
  });
  
  // Track action for struggle detection
  struggleDetector.trackAction(mode, currentContext);
  const struggleAnalysis = checkStruggleLevel();

  // Enrich context with struggle level for intelligence hub
  if (currentContext && struggleAnalysis) {
    currentContext.struggleLevel = struggleAnalysis.level;
    currentContext.struggleData = { struggleLevel: struggleAnalysis.level, indicators: struggleAnalysis.indicators };
  }
  
  // Show answer card
  const answerCard = document.getElementById('answerCard');
  const answerEl = document.getElementById('answer');
  
  if (!answerCard || !answerEl) {
    console.error('[HintHopper] Answer card or element not found');
    showNotification('UI error: Answer display not found', 'error');
    return;
  }
  
  answerCard.style.display = 'block';
  answerEl.innerHTML = '<div class="spinner" style="margin: var(--space-8) auto;"></div>';
  
  try {
    console.log('[HintHopper] Calling Bunji for mode:', mode);
    // Use the tutorAnswer function from tutor.js, as renaming it would require deeper code changes
    const response = await tutorAnswer(mode, currentContext, currentTone);
    console.log('[HintHopper] LLM response received:', response);
    renderBunjiAnswer(response, mode);
    
    // Notify content script of hint shown to track test passes
    if (window.__hintHopperLastHintId) {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'HINT_SHOWN',
            hintId: window.__hintHopperLastHintId
          }).catch(err => {
            console.warn('[HintHopper] Failed to notify content script of hint shown:', err);
          });
        }
      });
    }
  } catch (error) {
    console.error('[HintHopper] Error calling tutorAnswer:', error);
    let errorMessage = error.message || 'Unknown error';
    let errorDetails = '';
    
    // Special handling for common errors
    if (errorMessage.includes('API key')) {
      errorDetails = `
        <div class="alert-footer" style="margin-top: var(--space-3);">
          <button class="btn-secondary btn-sm" id="showSettingsBtn">Go to Settings</button>
        </div>
      `;
    }
    
    answerEl.innerHTML = `
      <div class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <div class="alert-content">
          <div class="alert-title">LLM Connection Error</div>
          <div class="alert-message">${escapeHTML(errorMessage)}</div>
        </div>
        ${errorDetails}
      </div>
    `;
    
    // Add event listener for settings button if present
    document.getElementById('showSettingsBtn')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-view="settings"]').click();
    });
  }
}

// Function to render Bunji's answer in the UI
async function renderBunjiAnswer(response, mode) {
  console.log('[HintHopper] Rendering Bunji answer:', response);
  const answerEl = document.getElementById('answer');
  
  if (!answerEl) {
    console.error('[HintHopper] Answer element not found');
    return;
  }
  
  let html = `<div class="badge badge-primary" style="margin-bottom: var(--space-3);">${MODE_LABELS[mode] || mode}</div>`;

  // Add BKT mastery badge if intelligence hub is ready
  if (intelligenceHub.initialized && currentContext) {
    const conceptId = currentContext.challengeId ||
      (currentContext.failingTests?.[0] ? currentContext.failingTests[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) : null);
    if (conceptId) {
      const mastery = intelligenceHub.getMastery(conceptId);
      if (mastery !== null) {
        const pct = Math.round(mastery * 100);
        const tier = mastery < 0.4 ? 'low' : mastery < 0.8 ? 'medium' : 'high';
        const label = mastery < 0.4 ? 'Learning' : mastery < 0.8 ? 'Progressing' : 'Near Mastery';
        html += `<span class="bkt-mastery-badge ${tier}">📊 ${label} • ${pct}%</span>`;
      }
    }
  }
  
  // Handle structured response object
  const conceptKey = response.concept_key;
  
  // Add outcome badge if we have statistics and this is a recognized concept
  if (conceptKey && typeof outcomeTracker !== 'undefined') {
    try {
      const stats = await outcomeTracker.getConceptStats(conceptKey);
      
      if (stats && stats.passRate !== null) {
        const passRatePercent = Math.round(stats.passWithin10Rate * 100);
        const passTimeMinutes = stats.avgTimeToPass ? Math.round(stats.avgTimeToPass) : null;
        
        if (passRatePercent > 0) {
          html += `
            <div class="outcome-badge" style="margin-bottom: var(--space-3);">
              <span class="outcome-badge-icon">📊</span>
              <span class="outcome-badge-text">${passRatePercent}% pass within 10min with this hint</span>
              ${passTimeMinutes ? `<span class="outcome-badge-count">(avg: ${passTimeMinutes}min)</span>` : ''}
            </div>
          `;
        }
      }
    } catch (error) {
      console.warn('[HintHopper] Failed to get concept stats:', error);
    }
  }
  
  // Format the response based on the structured data returned by bunjiAnswer
  if (response) {
    // Create a formatted answer from the structured response
    html += `<div style="line-height: var(--line-height-relaxed);">`;

    // Misconception chip (shown when pedagogical engine detects a pattern)
    if (response.misconception && response.misconception.name) {
      html += `<span class="misconception-tag" style="display:inline-flex; align-items:center; gap:4px; font-size:var(--font-size-xs); color:var(--color-gray-500); background:var(--color-gray-100); border:1px solid var(--color-gray-200); border-radius:12px; padding:2px 8px; margin-bottom:var(--space-3);">🔍 ${escapeHTML(response.misconception.name)}</span>`;
    }
    
    // Diagnosis
    if (response.diagnosis) {
      html += `<p><strong>Diagnosis:</strong> ${escapeHTML(response.diagnosis)}</p>`;
    }
    
    // Why it happens
    if (response.why_it_happens) {
      html += `<p><strong>Why:</strong> ${escapeHTML(response.why_it_happens)}</p>`;
    }
    
    // Steps to take
    if (Array.isArray(response.steps) && response.steps.length > 0) {
      html += `<p><strong>Steps:</strong></p><ul>`;
      response.steps.forEach(step => {
        html += `<li>${escapeHTML(step)}</li>`;
      });
      html += `</ul>`;
    }
    
    // Self-check
    if (response.self_check) {
      html += `<p><strong>Self-check:</strong> ${escapeHTML(response.self_check)}</p>`;
    }
    
    // Code glimpse (if available)
    if (response.redacted_code_glimpse) {
      html += `<p><strong>Hint:</strong> <code>${escapeHTML(response.redacted_code_glimpse)}</code></p>`;
    }
    
    html += `</div>`;
  } else {
    html += `<div class="alert alert-warning">
      <div class="alert-content">
        <div class="alert-message">No structured response received from LLM.</div>
      </div>
    </div>`;
  }
  
  // Add micro-feedback + save as note button
  html += `
    <div style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-gray-200); display: flex; align-items: center; gap: var(--space-3);">
      <button class="btn-secondary btn-sm" id="saveFromBunji">
        <span>💾</span>
        Save as Note
      </button>
      <div id="hintFeedback" style="margin-left: auto; display: flex; align-items: center; gap: var(--space-2);">
        <span style="font-size: var(--font-size-xs); color: var(--color-gray-500);">Helpful?</span>
        <button class="btn-icon hint-feedback-btn" id="hintThumbsUp" title="This hint helped" style="font-size: 16px; padding: 2px 6px; border-radius: var(--radius-sm);">👍</button>
        <button class="btn-icon hint-feedback-btn" id="hintThumbsDown" title="This hint didn't help" style="font-size: 16px; padding: 2px 6px; border-radius: var(--radius-sm);">👎</button>
      </div>
    </div>
  `;
  
  answerEl.innerHTML = html;
  
  // Attach save handler
  document.getElementById('saveFromBunji')?.addEventListener('click', () => {
    saveNoteFromBunji(response, currentContext);
  });

  // Attach micro-feedback handlers — auto-dismiss after tap
  const feedbackContainer = document.getElementById('hintFeedback');
  const thumbsUp = document.getElementById('hintThumbsUp');
  const thumbsDown = document.getElementById('hintThumbsDown');
  const conceptForFeedback = lastConceptId;

  function dismissFeedback(helpful) {
    if (!feedbackContainer) return;
    feedbackContainer.innerHTML = `<span style="font-size: var(--font-size-xs); color: var(--color-gray-400);">${helpful ? '✓ Noted!' : '✓ Got it'}</span>`;
    setTimeout(() => { if (feedbackContainer) feedbackContainer.style.display = 'none'; }, 1500);
    if (conceptForFeedback) {
      bktEngine.init()
        .then(() => bktEngine.updateMastery(conceptForFeedback, helpful))
        .then(r => console.log(`[TrailNote] Micro-feedback BKT: ${conceptForFeedback} P(L)=${r.masteryAfter.toFixed(3)}`))
        .catch(e => console.warn('[TrailNote] Micro-feedback BKT error:', e));
    }
  }

  thumbsUp?.addEventListener('click', () => dismissFeedback(true));
  thumbsDown?.addEventListener('click', () => dismissFeedback(false));

  // Auto-dismiss after 8 seconds if not tapped
  setTimeout(() => {
    if (feedbackContainer && feedbackContainer.style.display !== 'none') {
      feedbackContainer.style.display = 'none';
    }
  }, 8000);
}

// === Notes Integration ===
async function initNotes() {
  const noteProblem = document.getElementById('noteProblem');
  const noteInsight = document.getElementById('noteInsight');
  const noteSelfCheck = document.getElementById('noteSelfCheck');
  const noteBody = document.getElementById('noteBody');
  const noteTags = document.getElementById('noteTags');
  const insightCounter = document.getElementById('insightCounter');
  const bodyCounter = document.getElementById('bodyCounter');
  const qualityNudge = document.getElementById('qualityNudge');
  
  // Character counters
  noteInsight?.addEventListener('input', (e) => {
    const len = e.target.value.length;
    insightCounter.textContent = `${len}/120 chars`;
    insightCounter.style.color = len > 120 ? 'var(--color-warning)' : 'var(--color-gray-500)';
  });
  
  noteBody?.addEventListener('input', (e) => {
    const len = e.target.value.length;
    bodyCounter.textContent = `${len} chars`;
    bodyCounter.style.color = len > 280 ? 'var(--color-warning)' : 'var(--color-gray-500)';
    qualityNudge.style.display = len > 280 ? 'flex' : 'none';
  });
  
  // Save note
  document.getElementById('saveNote')?.addEventListener('click', async () => {
    const problem = noteProblem.value.trim();
    const insight = noteInsight.value.trim();
    const selfCheck = noteSelfCheck.value.trim();
    const body = noteBody.value.trim();
    const tagString = noteTags.value.trim();
    
    if (!insight && !body) {
      showNotification('Please add at least an insight or note body', 'error');
      return;
    }
    
    // Extract conceptId from tags if available
    const tags = tagString.split(/\s+/).filter(t => t.startsWith('#'));
    let conceptKey = null;
    
    // Try to find a concept tag
    for (const tag of tags) {
      const tagName = tag.substring(1); // Remove the # symbol
      // Check if this tag corresponds to a known concept
      try {
        const conceptGraphModule = await import('../lib/concept-graph.js');
        const concept = await conceptGraphModule.default.getConcept(tagName);
        if (concept) {
          conceptKey = tagName;
          break;
        }
      } catch (error) {
        console.warn('[HintHopper] Error checking concept tag:', error);
      }
    }
    
    // If no concept found, try to create one from the problem
    if (!conceptKey && problem) {
      conceptKey = typeof conceptIdFrom === 'function' ? 
        conceptIdFrom(problem) : 
        problem.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 30);
    }
    
    // Record this as a successful concept interaction
    if (conceptKey) {
      try {
        const conceptGraphModule = await import('../lib/concept-graph.js');
        // Track the concept as passed since user is creating a note about it
        await conceptGraphModule.default.trackConceptPassed(conceptKey);
        console.log(`[HintHopper] Tracked concept mastery for: ${conceptKey}`);
      } catch (error) {
        console.warn('[HintHopper] Failed to track concept mastery:', error);
      }
    }
    
    const note = {
      id: crypto.randomUUID(),
      title: currentContext?.title || (currentContext?.platformDisplayName || 'Learning Platform'),
      url: currentContext?.url || location.href,
      createdAt: Date.now(),
      body: body,
      tags: tags,
      fields: {
        problem,
        insight,
        selfCheck,
        conceptKey // Store the concept key in the note itself
      }
    };
    
    await notesApi.save(note);
    renderList();
    document.querySelector('.nav-item[data-view="notes-list"]').click();
    
    showNotification('Note saved successfully!', 'success');
    
    // Show flashcard creation option
    setTimeout(() => {
      const flashcardPrompt = document.createElement('div');
      flashcardPrompt.className = 'alert alert-info';
      flashcardPrompt.style.position = 'fixed';
      flashcardPrompt.style.bottom = '20px';
      flashcardPrompt.style.right = '20px';
      flashcardPrompt.style.maxWidth = '300px';
      flashcardPrompt.style.zIndex = '1000';
      flashcardPrompt.style.boxShadow = 'var(--shadow-lg)';
      
      flashcardPrompt.innerHTML = `
        <div class="alert-content">
          <div class="alert-title">Create a Flashcard?</div>
          <div class="alert-message">Turn this note into a flashcard for spaced repetition review.</div>
          <div style="margin-top: var(--space-3); display: flex; gap: var(--space-2);">
            <button class="btn-secondary btn-sm" id="cancelFlashcardPrompt">No Thanks</button>
            <button class="btn-primary btn-sm" id="createFlashcardFromNote">Create Flashcard</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(flashcardPrompt);
      
      // Add event listeners
      document.getElementById('cancelFlashcardPrompt').addEventListener('click', () => {
        flashcardPrompt.remove();
      });
      
      document.getElementById('createFlashcardFromNote').addEventListener('click', () => {
        flashcardPrompt.remove();
        if (flashcardManager && flashcardManager.showFlashcardCreationForm) {
          flashcardManager.showFlashcardCreationForm(note);
        } else {
          showNotification('Flashcard creation not available yet', 'warning');
        }
      });
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (document.body.contains(flashcardPrompt)) {
          flashcardPrompt.remove();
        }
      }, 10000);
    }, 1000);
    updateNotesCount();
  });
  
  // Search
  document.getElementById('noteSearch')?.addEventListener('input', (e) => {
    renderList(e.target.value);
  });
  
  // Export
  document.getElementById('exportMd')?.addEventListener('click', exportNotes);
  
  // Initial render
  renderList();
}

async function renderList(filter = '') {
  const notes = await notesApi.list();
  const filtered = filter ? notes.filter(n => {
    const searchText = `${n.body} ${n.fields?.insight || ''} ${n.tags.join(' ')}`.toLowerCase();
    return searchText.includes(filter.toLowerCase());
  }) : notes;
  
  const noteList = document.getElementById('noteList');
  
  if (filtered.length === 0) {
    noteList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">No notes yet</div>
        <div class="empty-state-description">Start taking notes to remember what you learn!</div>
      </div>
    `;
    return;
  }
  
  noteList.innerHTML = filtered.map(n => {
    const insight = n.fields?.insight || n.body || '';
    const problem = n.fields?.problem || '';
    const selfCheck = n.fields?.selfCheck || '';
    const conceptId = n.conceptId || '';
    
    return `
      <li class="list-item">
        <div style="margin-bottom: var(--space-2);">
          <strong>${escapeHTML(problem || n.title)}</strong>
          ${conceptId ? `<span class="badge badge-primary" style="margin-left: var(--space-2);">#${conceptId}</span>` : ''}
        </div>
        <div style="margin-bottom: var(--space-2); color: var(--color-gray-700);">
          ${escapeHTML(insight)}
        </div>
        ${selfCheck ? `
          <div style="font-size: var(--font-size-sm); color: var(--color-gray-600);">
            <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer;">
              <input type="checkbox" class="self-check-box" data-note-id="${n.id}">
              ${escapeHTML(selfCheck)}
            </label>
          </div>
        ` : ''}
        <div style="margin-top: var(--space-2); display: flex; gap: var(--space-2); flex-wrap: wrap;">
          ${n.tags.map(t => `<span class="badge badge-gray">${escapeHTML(t)}</span>`).join('')}
        </div>
      </li>
    `;
  }).join('');
}

async function saveNoteFromBunji(bunjiObj, context) {
  console.log('[HintHopper] Saving note from Bunji response:', bunjiObj);
  
  // Pre-fill note form and switch to notes view
  const problem = context.tests?.[0] || context.failingTests?.[0] || '';
  
  // Build a concise insight from the diagnosis and why_it_happens
  let insight = '';
  if (bunjiObj.diagnosis) {
    insight = bunjiObj.diagnosis;
  }
  if (insight.length < 60 && bunjiObj.why_it_happens) {
    insight += insight ? '. ' + bunjiObj.why_it_happens : bunjiObj.why_it_happens;
  }
  insight = insight.substring(0, 120);
  
  // Use self-check directly
  const selfCheck = bunjiObj.self_check || '';
  
  // Get concept key (either from response or generate from problem)
  let conceptKey = bunjiObj.concept_key;
  if (!conceptKey) {
    if (typeof conceptIdFrom === 'function') {
      conceptKey = conceptIdFrom(problem);
    } else {
      // Fall back to simple concept ID if utility not available
      conceptKey = problem.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30);
    }
  }
  
  // Track concept interaction in the concept graph if available
  if (conceptKey && typeof window !== 'undefined') {
    try {
      // Import the concept graph dynamically to avoid dependency cycles
      const conceptGraphModule = await import('../lib/concept-graph.js');
      if (conceptGraphModule.default) {
        // Track the concept as viewed
        await conceptGraphModule.default.trackConceptViewed(conceptKey);
        console.log(`[HintHopper] Tracked concept view for: ${conceptKey}`);
      }
    } catch (error) {
      console.warn('[HintHopper] Failed to track concept mastery:', error);
    }
  }
  
  // Generate tags from concept key and problem
  const problemTag = conceptIdFrom(problem);
  const tags = new Set([`#${problemTag}`]);
  
  // Add the concept tag if different from problem tag
  if (conceptKey && conceptKey !== problemTag) {
    tags.add(`#${conceptKey}`);
  }
  
  // Add tags from rule hints if available
  if (context.ruleHints) {
    const hintTag = conceptIdFrom(context.ruleHints);
    if (hintTag && hintTag !== problemTag && hintTag !== conceptKey) {
      tags.add(`#${hintTag}`);
    }
  }
  
  const noteProblemEl = document.getElementById('noteProblem');
  const noteInsightEl = document.getElementById('noteInsight');
  const noteSelfCheckEl = document.getElementById('noteSelfCheck');
  const noteTagsEl = document.getElementById('noteTags');
  
  if (noteProblemEl) noteProblemEl.value = problem;
  if (noteInsightEl) noteInsightEl.value = insight;
  if (noteSelfCheckEl) noteSelfCheckEl.value = selfCheck;
  if (noteTagsEl) noteTagsEl.value = Array.from(tags).join(' ');
  
  // Switch to notes view
  const notesNav = document.querySelector('.nav-item[data-view="notes"]');
  if (notesNav) {
    notesNav.click();
    if (noteInsightEl) noteInsightEl.focus();
    showNotification('Hopped to your notes! Add more details and save.', 'info');
  } else {
    console.warn('[HintHopper] Notes navigation tab not found');
    showNotification('Could not switch to notes view. Please navigate there manually.', 'warning');
  }
}

async function exportNotes() {
  const notes = await notesApi.list();
  const md = notes.map(n => {
    const insight = n.fields?.insight || n.body || '';
    const problem = n.fields?.problem || '';
    const selfCheck = n.fields?.selfCheck || '';
    
    return `## ${problem || n.title}\n\n${insight}\n\n${selfCheck ? `**Self-check:** ${selfCheck}\n\n` : ''}${n.tags.join(' ')}\n\n---\n`;
  }).join('\n');
  
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trailnote-export-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// === Review Due Pill ===
async function updateReviewDuePill() {
  try {
    const due = await learningVelocity.getConceptsDueForReview();
    const pill = document.getElementById('reviewDuePill');
    const countEl = document.getElementById('reviewDueCount');
    if (!pill || !countEl) return;
    if (due.length > 0) {
      countEl.textContent = due.length;
      pill.style.display = 'inline-flex';
      pill.onclick = () => {
        const kgNav = document.querySelector('.nav-item[data-view="knowledge-graph"]');
        if (kgNav) kgNav.click();
      };
    } else {
      pill.style.display = 'none';
    }
  } catch (e) {
    console.warn('[TrailNote] Review pill update error:', e);
  }
}

// === Struggle Detection ===
async function initStruggleDetection() {
  // Check struggle level every 30 seconds
  setInterval(checkStruggleLevel, 30000);
}

function checkStruggleLevel() {
  const analysis = struggleDetector.analyzeStruggleLevel();
  
  if (analysis.shouldShowChat && chat) {
    // Show assistant panel
    document.getElementById('appAssistant').classList.remove('collapsed');
    
    // Show struggle banner in chat
    chat.showStruggleBanner(analysis);
  }

  return analysis;
}

// === Context Management ===
function requestContextRefresh() {
  console.log('[HintHopper] Requesting context refresh...');
  document.getElementById('contextPreview').innerHTML = `
    <div style="color: var(--color-gray-500); text-align: center; padding: var(--space-4);">
      <div class="spinner" style="margin-bottom: var(--space-3);"></div>
      <div>Refreshing context...</div>
    </div>
  `;
  
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      showNoContextHelp('No active tab detected.');
      return;
    }
    
    const url = tab.url || '';
    console.log('[HintHopper] Active tab URL:', url);
    
    // Check if the URL matches any supported platform
    const SUPPORTED_DOMAINS = ['freecodecamp.org', 'udemy.com', 'codecademy.com', 'scrimba.com', 'coursera.org', 'khanacademy.org', 'leetcode.com', 'hackerrank.com'];
    const isSupportedPlatform = SUPPORTED_DOMAINS.some(d => url.includes(d));
    if (!isSupportedPlatform) {
      showNoContextHelp('Open a supported learning platform to enable context (freeCodeCamp, Udemy, Codecademy, LeetCode, etc.).');
      return;
    }

    // 1) Ask background for the latest cached context first
    chrome.runtime.sendMessage({ type: 'CONTEXT_GET' }, (resp) => {
      const err1 = chrome.runtime.lastError; // safe to read
      if (err1) {
        console.log('[HintHopper] Error in CONTEXT_GET:', err1.message);
      }
      
      const ctx = resp?.ctx;
      console.log('[HintHopper] Initial context from background:', ctx);
      
      if (ctx && (ctx.title || (ctx.tests && ctx.tests.length) || (ctx.userCode && ctx.userCode.length))) {
        renderContext(ctx);
        return;
      }

      // 2) If not available, ping the content script to capture now, then retry get
      console.log('[HintHopper] Sending FORCE_REFRESH to content script...');
      chrome.tabs.sendMessage(tab.id, { type: 'FORCE_REFRESH' }, () => {
        const err2 = chrome.runtime.lastError;
        if (err2) {
          console.log('[HintHopper] FORCE_REFRESH error:', err2.message);
          // If we can't reach the content script, show a more helpful error
          if (/Receiving end does not exist/i.test(err2.message || '')) {
            showNoContextHelp('HintHopper content script not detected. Try refreshing the page.');
            return;
          }
        }
        
        // Retry background get shortly after
        console.log('[HintHopper] Waiting for content script to capture context...');
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'CONTEXT_GET' }, (resp2) => {
            const ctx2 = resp2?.ctx;
            console.log('[HintHopper] Follow-up context from background:', ctx2);
            
            if (ctx2 && (ctx2.title || (ctx2.tests && ctx2.tests.length) || (ctx2.userCode && ctx2.userCode.length))) {
              renderContext(ctx2);
            } else {
              showNoContextHelp('HintHopper is waiting for the page. Click into the editor or run the tests, then refresh context.');
            }
          });
        }, 1000); // Increased timeout to give content script more time
      });
    });
  });
}

function renderContext(ctx) {
  currentContext = ctx || null;
  
  // Track context change for struggle detection
  if (ctx) {
    struggleDetector.trackAction('context_change', ctx);
    if (chat) chat.updateContext(ctx);

    // Load platform-specific concepts if needed
    if (ctx.platform && ctx.platform !== 'unknown') {
      import('../lib/concept-graph.js').then(mod => {
        mod.default.loadPlatformConcepts(ctx.platform);
      }).catch(() => {});
    }
  }
  
  const preview = document.getElementById('contextPreview');
  
  if (!ctx) {
    preview.innerHTML = `
      <div style="color: var(--color-gray-400); text-align: center; padding: var(--space-8);">
        Open a lesson on a supported platform, then click into the editor or run the tests — TrailNote will pull the context automatically.
      </div>
    `;
    return;
  }
  
  let html = '';

  // Show platform badge if available
  if (ctx.platform && ctx.platform !== 'unknown') {
    html += `<div style="margin-bottom: var(--space-2);"><span class="badge badge-info" style="font-size: 11px;">${ctx.platformIcon || '📚'} ${escapeHTML(ctx.platformDisplayName || ctx.platform)}</span></div>`;
  }

  if (ctx.title) html += `<div style="font-weight: 600; margin-bottom: var(--space-2);">📝 ${escapeHTML(ctx.title)}</div>`;
  
  // Handle URL
  if (ctx.url) html += `<div style="margin-bottom: var(--space-3); font-size: var(--font-size-sm); color: var(--color-gray-600);">${escapeHTML(ctx.url)}</div>`;
  
  // Handle tests - check both tests and failingTests properties
  const testsToShow = ctx.failingTests || ctx.tests || [];
  if (testsToShow.length > 0) {
    html += `<div style="margin-top: var(--space-3);"><strong>Tests:</strong></div>`;
    testsToShow.forEach(test => {
      html += `<div style="padding: var(--space-2); background: var(--color-error-light); border-left: 3px solid var(--color-error); margin-top: var(--space-2); border-radius: var(--radius-sm);">${escapeHTML(test)}</div>`;
    });
  }
  
  // Handle rule hints if available
  if (ctx.ruleHints) {
    html += `<div style="margin-top: var(--space-3);"><strong>Hint:</strong></div>`;
    html += `<div style="padding: var(--space-2); background: var(--color-warning-light); border-left: 3px solid var(--color-warning); margin-top: var(--space-2); border-radius: var(--radius-sm);">${escapeHTML(ctx.ruleHints)}</div>`;
  }
  
  // Add code preview if available (truncated)
  if (ctx.userCode) {
    const codePreview = ctx.userCode.length > 100 ? ctx.userCode.substring(0, 100) + '...' : ctx.userCode;
    html += `<div style="margin-top: var(--space-3);"><strong>Code Preview:</strong></div>`;
    html += `<div style="padding: var(--space-2); background: var(--color-gray-100); font-family: var(--font-family-mono); font-size: var(--font-size-xs); overflow-x: auto; margin-top: var(--space-2); border-radius: var(--radius-sm);">${escapeHTML(codePreview)}</div>`;
  }
  
  preview.innerHTML = html;
  
  // Store failing tests in the right property for saving notes later
  if (!ctx.failingTests && ctx.tests) {
    ctx.failingTests = ctx.tests;
  }
  
  console.log('[HintHopper] Context rendered:', ctx);
  
  // Check for resurfaceable notes
  checkForResurfaceableNotes(ctx);
}

// Render a friendly help message in the Context Preview when content script/context is unavailable
function showNoContextHelp(msg) {
  const preview = document.getElementById('contextPreview');
  if (!preview) return;
  preview.innerHTML = `
    <div style="text-align:center; color: var(--color-gray-600); padding: var(--space-8);">
      <div style="margin-bottom: var(--space-2);">${escapeHTML(msg)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:var(--space-2);">
        <a href="https://www.freecodecamp.org/learn/" target="_blank" style="color: var(--color-primary-600); text-decoration: none; font-size: var(--font-size-sm);">🔥 freeCodeCamp</a>
        <a href="https://www.udemy.com/" target="_blank" style="color: var(--color-primary-600); text-decoration: none; font-size: var(--font-size-sm);">🎓 Udemy</a>
        <a href="https://www.codecademy.com/" target="_blank" style="color: var(--color-primary-600); text-decoration: none; font-size: var(--font-size-sm);">💻 Codecademy</a>
        <a href="https://leetcode.com/" target="_blank" style="color: var(--color-primary-600); text-decoration: none; font-size: var(--font-size-sm);">🧩 LeetCode</a>
      </div>
      <div style="margin-top: var(--space-2);">
        <button class="btn-secondary btn-sm" id="refreshContextBtn">Refresh context</button>
      </div>
    </div>
  `;
  document.getElementById('refreshContextBtn')?.addEventListener('click', requestContextRefresh);
}

// Smart resurfacing
const surfacedThisSession = new Map();

async function checkForResurfaceableNotes(ctx) {
  if (!ctx?.failingTests?.length) {
    document.getElementById('resurfaceBanner').style.display = 'none';
    return;
  }
  
  const conceptId = conceptIdFrom(ctx.failingTests[0]);
  if (!conceptId || surfacedThisSession.has(conceptId)) return;
  
  const notes = await notesApi.list();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const matchingNotes = notes.filter(n => 
    n.conceptId === conceptId && n.createdAt < oneDayAgo
  );
  
  if (matchingNotes.length > 0) {
    const banner = document.getElementById('resurfaceBanner');
    const message = document.getElementById('resurfaceMessage');
    
    message.textContent = `You saved ${matchingNotes.length} tip${matchingNotes.length > 1 ? 's' : ''} on #${conceptId}`;
    banner.style.display = 'flex';
    
    surfacedThisSession.set(conceptId, Date.now());
    
    document.getElementById('resurfaceOpen').onclick = () => {
      document.querySelector('.nav-item[data-view="notes"]').click();
      document.getElementById('noteSearch').value = `#${conceptId}`;
      renderList(`#${conceptId}`);
      banner.style.display = 'none';
    };
    
    document.getElementById('resurfaceDismiss').onclick = () => {
      banner.style.display = 'none';
    };
  }
}

// === Utilities ===
function conceptIdFrom(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 30);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.style.cssText = 'position: fixed; top: var(--space-4); right: var(--space-4); z-index: var(--z-tooltip); min-width: 300px; animation: message-appear 0.3s ease;';
  toast.innerHTML = `
    <span class="alert-icon">${type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <div class="alert-content">
      <div class="alert-message">${escapeHTML(message)}</div>
    </div>
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
    e.preventDefault();
    document.querySelector('.nav-item[data-view="notes"]').click();
    document.getElementById('noteInsight').focus();
  }
});

// Listen for context updates and events from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CONTEXT_PUSH') {
    console.log('[HintHopper] Received context update:', message.ctx);
    renderContext(message.ctx);
  }
  
  // Track test pass events in outcome tracker
  if (message.type === 'TEST_PASSED' && message.hintId) {
    console.log('[HintHopper] Received test pass event for hint:', message.hintId);
    
    // Track outcome in the outcome tracker
    if (typeof outcomeTracker !== 'undefined') {
      outcomeTracker.trackTestPass(message.hintId).then(() => {
        // Show a success notification
        showNotification('Test passed! Progress tracked.', 'success');
        console.log('[HintHopper] Test pass tracked successfully');
      }).catch(error => {
        console.warn('[HintHopper] Failed to track test pass:', error);
      });
    }

    // === BKT: Record correct outcome ===
    if (lastConceptId) {
      const conceptIdForBkt = lastConceptId;
      const timeSpent = lastHintRequestTime ? (Date.now() - lastHintRequestTime) / 1000 / 60 : 0;
      bktEngine.init().then(() => bktEngine.updateMastery(conceptIdForBkt, true)).then(result => {
        console.log(`[TrailNote] BKT updated for ${conceptIdForBkt}: P(L) = ${result.masteryAfter.toFixed(3)}`);
        if (result.isMastered) {
          showNotification(`Concept mastered: ${conceptIdForBkt}`, 'success');
        }
      }).catch(e => console.warn('[TrailNote] BKT update error:', e));
      learningVelocity.init().then(() =>
        learningVelocity.trackVelocityProgress(conceptIdForBkt, timeSpent, true)
      ).then(() => updateReviewDuePill())
       .catch(e => console.warn('[TrailNote] Velocity track error:', e));
    }

    // Notify Intelligence Hub (handled inside outcome-tracker too, but belt-and-suspenders here)
    intelligenceHub.onOutcome(message.hintId, 'passed', null, currentContext?.challengeId || null).catch(() => {});
    // Refresh intelligence status after outcome
    setTimeout(() => renderIntelligenceStatus(), 1500);
    
    // If we have A/B testing data, record the outcome
    if (message.abTesting && typeof window !== 'undefined') {
      try {
        // Import the A/B testing module dynamically
        import('../lib/ab-testing.js').then(async module => {
          if (module.default) {
            const abTesting = module.default;
            const { variantId, patternId } = message.abTesting;
            
            if (variantId && patternId) {
              // Record successful outcome for this variant
              const timeToPass = (Date.now() - message.hintId) / (1000 * 60); // Convert to minutes
              await abTesting.recordOutcome(variantId, true, timeToPass);
              console.log(`[HintHopper] A/B testing outcome recorded for ${patternId}/${variantId}`);
            }
          }
        });
      } catch (error) {
        console.warn('[HintHopper] Failed to record A/B testing outcome:', error);
      }
    }
  }
});

// Auto-refresh context every minute
setInterval(requestContextRefresh, 60000);
// Auto-refresh intelligence status every 5 minutes
setInterval(renderIntelligenceStatus, 5 * 60 * 1000);

// === Intelligence Hub UI ===
async function renderIntelligenceStatus() {
  if (!intelligenceHub.initialized) return;

  try {
    const status = await intelligenceHub.getSystemStatus();
    const el = document.getElementById('intelligenceStatus');
    if (!el) return;

    const mastery = status.mastery;
    const velocity = status.velocity;
    const pendingCount = status.pendingApprovals;
    const reviewsDue = status.reviewsDue;

    let html = '';

    if (mastery) {
      const pct = Math.round((mastery.masteryRate || 0) * 100);
      html += `<div class="intel-stat"><span class="intel-label">BKT Mastery</span><span class="intel-value">${pct}%</span></div>`;
    }
    if (velocity && velocity.overallVelocity) {
      html += `<div class="intel-stat"><span class="intel-label">Velocity</span><span class="intel-value">${velocity.overallVelocity.toFixed(1)}/hr</span></div>`;
    }
    if (reviewsDue > 0) {
      html += `<div class="intel-stat intel-alert"><span class="intel-label">Reviews Due</span><span class="intel-value">${reviewsDue}</span></div>`;
    }
    if (pendingCount > 0) {
      html += `<div class="intel-stat intel-alert" style="cursor:pointer" id="showApprovalsBtn"><span class="intel-label">Memory Rules</span><span class="intel-value">${pendingCount} pending</span></div>`;
    }

    el.innerHTML = html || '<div class="intel-stat"><span class="intel-label">Intelligence</span><span class="intel-value">Active ✓</span></div>';

    document.getElementById('showApprovalsBtn')?.addEventListener('click', showPendingApprovalsModal);
  } catch (e) {
    // non-critical
  }
}

function showPendingApprovalsNotification(count) {
  showNotification(`✨ ${count} new learning rule${count > 1 ? 's' : ''} detected — review in Memory panel`, 'info');
}

async function showPendingApprovalsModal() {
  const approvals = intelligenceHub.getPendingApprovals();
  if (approvals.length === 0) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

  const inner = document.createElement('div');
  inner.style.cssText = 'background:#fff;border-radius:12px;padding:24px;width:360px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);';

  inner.innerHTML = `
    <h3 style="margin:0 0 16px;font-size:16px;">🧠 Learning Rule Suggestions</h3>
    <p style="font-size:13px;color:#666;margin:0 0 16px;">TrailNote detected patterns in your learning. Approve to save as personal rules.</p>
    ${approvals.map(a => `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHTML(a.memory.key.replace(/_/g,' '))}</div>
        <div style="font-size:12px;color:#555;margin-bottom:8px;">${escapeHTML(JSON.stringify(a.memory.value))}</div>
        <div style="font-size:11px;color:#888;margin-bottom:10px;">Confidence: ${Math.round((a.memory.confidence||0)*100)}%</div>
        <div style="display:flex;gap:8px;">
          <button class="approve-btn btn-primary" style="font-size:12px;padding:4px 12px;border:none;border-radius:6px;background:#7c3aed;color:#fff;cursor:pointer;" data-id="${escapeHTML(a.id)}">✓ Approve</button>
          <button class="reject-btn" style="font-size:12px;padding:4px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;" data-id="${escapeHTML(a.id)}">✕ Reject</button>
        </div>
      </div>
    `).join('')}
    <button id="closeApprovalsModal" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;cursor:pointer;font-size:13px;">Close</button>
  `;

  modal.appendChild(inner);
  document.body.appendChild(modal);

  // Close
  document.getElementById('closeApprovalsModal')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Approve/reject handlers
  inner.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await intelligenceHub.approveMemory(btn.dataset.id);
      btn.closest('div[style]').innerHTML = '<div style="color:#16a34a;font-size:13px;">✓ Rule saved!</div>';
      renderIntelligenceStatus();
    });
  });

  inner.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await intelligenceHub.rejectMemory(btn.dataset.id);
      btn.closest('div[style]').innerHTML = '<div style="color:#9ca3af;font-size:13px;">Rejected</div>';
    });
  });
}

// === Mastery View Integration ===
async function initMasteryView() {
  console.log('[HintHopper] Initializing mastery view');
  const masteryContent = document.getElementById('masteryContent');
  
  if (!masteryContent) {
    console.warn('[HintHopper] Mastery content container not found');
    return;
  }
  
  // Try to render mastery view if module is loaded
  if (masteryView && masteryView.renderMasteryView) {
    try {
      await masteryView.renderMasteryView(masteryContent);
    } catch (error) {
      console.error('[HintHopper] Failed to render mastery view:', error);
      masteryContent.innerHTML = `
        <div class="alert alert-error">
          <div class="alert-content">
            <div class="alert-message">Error loading mastery data. Please try again later.</div>
          </div>
        </div>
      `;
    }
  } else {
    console.warn('[HintHopper] Mastery view module not loaded yet');
  }
}

// === Flashcards Integration ===
async function initFlashcards() {
  console.log('[HintHopper] Initializing flashcards');
  const flashcardsContent = document.getElementById('flashcardsContent');
  
  if (!flashcardsContent) {
    console.warn('[HintHopper] Flashcards content container not found');
    return;
  }
  
  // Try to initialize flashcards if module is loaded
  if (flashcardManager && flashcardManager.initFlashcards) {
    try {
      await flashcardManager.initFlashcards(flashcardsContent);
    } catch (error) {
      console.error('[HintHopper] Failed to initialize flashcards:', error);
      flashcardsContent.innerHTML = `
        <div class="alert alert-error">
          <div class="alert-content">
            <div class="alert-message">Error loading flashcards. Please try again later.</div>
          </div>
        </div>
      `;
    }
  } else {
    console.warn('[HintHopper] Flashcard manager not loaded yet');
  }
}

// === Analytics Integration ===
async function initAnalyticsView() {
  console.log('[HintHopper] Initializing analytics view');
  const analyticsContent = document.getElementById('analyticsContent');
  
  if (!analyticsContent) {
    console.warn('[HintHopper] Analytics content container not found');
    return;
  }
  
  // Try to render analytics view if module is loaded
  if (analyticsView && analyticsView.renderAnalyticsView) {
    try {
      await analyticsView.renderAnalyticsView(analyticsContent);
    } catch (error) {
      console.error('[HintHopper] Failed to render analytics view:', error);
      analyticsContent.innerHTML = `
        <div class="alert alert-error">
          <div class="alert-content">
            <div class="alert-message">Error loading analytics data. Please try again later.</div>
          </div>
        </div>
      `;
    }
  } else {
    console.warn('[HintHopper] Analytics view module not loaded yet');
  }
}

// === Adaptive Learning Integration ===
async function initAdaptiveLearning() {
  console.log('[HintHopper] Initializing adaptive learning');
  
  try {
    // Import adaptiveLearning module
    const adaptiveLearning = (await import('../lib/adaptive-learning.js')).default;
    
    // Initialize the module
    await adaptiveLearning.init();
    
    // Connect to struggle detection for real-time adaptive recommendations
    if (window.struggleDetector) {
      window.struggleDetector.addEventListener('struggle', async (event) => {
        const { conceptId, level } = event.detail;
        
        if (conceptId && level >= 2) {
          // Track this struggle in the adaptive learning system
          await adaptiveLearning.trackConceptStruggle(conceptId, level);
          
          // Get adaptive recommendations
          const recommendations = await adaptiveLearning.getAdaptiveRecommendations(conceptId);
          
          // Show recommendations to the user
          if (recommendations && recommendations.nextSteps && recommendations.nextSteps.length > 0) {
            showNotification(
              `Struggling with this concept? ${recommendations.message}`, 
              'info', 
              8000
            );
          }
        }
      });
    }
    
    console.log('[HintHopper] Adaptive learning initialized successfully');
    return true;
  } catch (error) {
    console.error('[HintHopper] Failed to initialize adaptive learning:', error);
    return false;
  }
}

// === Natural Language Understanding Integration ===
async function initNLU() {
  console.log('[HintHopper] Initializing natural language understanding');
  
  try {
    // Import NLU module
    const nlu = (await import('../lib/nlu.js')).default;
    
    // Initialize the module
    await nlu.init();
    
    console.log('[HintHopper] NLU initialized successfully');
    return true;
  } catch (error) {
    console.error('[HintHopper] Failed to initialize NLU:', error);
    return false;
  }
}

// === Modal Management ===
function showPrivacyDetailsModal() {
  const modal = document.getElementById('privacyDetailsModal');
  if (modal) {
    modal.classList.add('active');
    
    // Set up event listeners for modal closing
    const closeBtn = document.getElementById('closePrivacyModal');
    const confirmBtn = document.getElementById('confirmPrivacyDetails');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    const closeModal = () => {
      modal.classList.remove('active');
      closeBtn.removeEventListener('click', closeModal);
      confirmBtn.removeEventListener('click', closeModal);
      backdrop.removeEventListener('click', closeModal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
  }
}

// Function to show privacy receipt modal
function showPrivacyReceipt() {
  // If outcome tracker is loaded, get the privacy receipt
  if (outcomeTracker) {
    outcomeTracker.getPrivacyReceipt().then(receipt => {
      // Create a modal on-the-fly
      const modalHtml = `
        <div class="modal active" id="privacyReceiptModal">
          <div class="modal-backdrop"></div>
          <div class="modal-container">
            <div class="modal-header">
              <h3 class="modal-title">Privacy Receipt</h3>
              <button class="modal-close" id="closeReceiptModal">&times;</button>
            </div>
            <div class="modal-body">
              <div class="mb-4">
                <h4 class="mb-2">Session Information</h4>
                <p><strong>Data collection:</strong> ${receipt.trackingEnabled ? 'Enabled' : 'Disabled'}</p>
                ${receipt.sessionStarted ? `<p><strong>Session started:</strong> ${new Date(receipt.sessionStarted).toLocaleString()}</p>` : ''}
              </div>
              
              <div class="mb-4">
                <h4 class="mb-2">Data Collected This Session</h4>
                ${receipt.trackingEnabled ? `
                  <ul>
                    ${receipt.dataCollected.map(item => `<li>${item}</li>`).join('')}
                  </ul>
                ` : '<p>No data collected (opt-in disabled)</p>'}
              </div>
              
              <div class="mb-4">
                <h4 class="mb-2">Never Collected</h4>
                <ul>
                  ${receipt.notCollected.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>
              
              <div class="alert alert-info">
                <span class="alert-icon">ℹ️</span>
                <div class="alert-content">
                  <div class="alert-message">You can delete all your collected data at any time in Settings.</div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" id="deleteDataBtn">Delete My Data</button>
              <button class="btn-primary" id="closeReceiptBtn">Close</button>
            </div>
          </div>
        </div>
      `;
      
      // Append to body
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer.firstElementChild);
      
      // Set up event listeners
      const modal = document.getElementById('privacyReceiptModal');
      const closeBtn = document.getElementById('closeReceiptModal');
      const confirmBtn = document.getElementById('closeReceiptBtn');
      const deleteBtn = document.getElementById('deleteDataBtn');
      const backdrop = modal.querySelector('.modal-backdrop');
      
      const closeModal = () => {
        modal.remove();
      };
      
      const deleteData = () => {
        if (outcomeTracker) {
          outcomeTracker.clearAllData().then(() => {
            showNotification('All collected data has been deleted', 'success');
            closeModal();
          });
        }
      };
      
      closeBtn.addEventListener('click', closeModal);
      confirmBtn.addEventListener('click', closeModal);
      backdrop.addEventListener('click', closeModal);
      deleteBtn.addEventListener('click', deleteData);
    });
  } else {
    showNotification('Privacy receipt not available', 'error');
  }
}
