// Import modules
import { store, notesApi } from "../lib/storage.js";
import { tutorAnswer, fetchOllamaModels } from "../lib/tutor.js";
import { allowEvery } from "../lib/rateLimit.js";
import { tokens } from "../lib/tokens.js";

// Version marker for debugging
const EXTENSION_VERSION = '0.2.0-auto-refresh';
console.log(`[TrailNote] Panel loaded - Version: ${EXTENSION_VERSION}`);

const MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini (default)" },
  { value: "gpt-4o", label: "gpt-4o" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { value: "gpt-4.1", label: "gpt-4.1" },
  { value: "o4-mini", label: "o4-mini" },
  { value: "o4", label: "o4" }
];

const modelSelect = document.getElementById('modelSelect');
const toneSelect = document.getElementById('tutorTone');
let currentTone = 'nudge';

const toneLabelMap = {
  nudge: 'Nudge mode',
  study: 'Study mode',
  exam: 'Exam mode'
};

function populateModelSelect(selectedValue) {
  modelSelect.innerHTML = '';
  MODEL_OPTIONS.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    modelSelect.appendChild(option);
  });

  if (selectedValue && !MODEL_OPTIONS.some(opt => opt.value === selectedValue)) {
    const customOption = document.createElement('option');
    customOption.value = selectedValue;
    customOption.textContent = `Custom: ${selectedValue}`;
    modelSelect.appendChild(customOption);
  }

  const optionExists = [...modelSelect.options].some(opt => opt.value === selectedValue);
  modelSelect.value = optionExists ? selectedValue : MODEL_OPTIONS[0].value;
}

// Initialize settings from storage
(async function initSettings(){
  const provider = await store.get('llmProvider', 'openai');
  document.getElementById('llmProvider').value = provider;
  toggleProviderSettings(provider);
  
  document.getElementById('apiKey').value = (await store.get('apiKey',''));
  const storedModel = await store.get('model','gpt-4o-mini');
  populateModelSelect(storedModel);
  
  // Groq settings
  document.getElementById('groqApiKey').value = (await store.get('groqApiKey',''));
  document.getElementById('groqModel').value = (await store.get('groqModel','llama-3.1-8b-instant'));
  
  document.getElementById('ollamaUrl').value = await store.get('ollamaUrl', 'http://localhost:11434');
  const storedOllamaModel = await store.get('ollamaModel', 'llama2');
  
  // Populate Ollama models if provider is Ollama
  if (provider === 'ollama') {
    await populateOllamaModelSelect(storedOllamaModel);
  } else {
    // Still set the value even if not visible
    document.getElementById('ollamaModel').value = storedOllamaModel;
  }
  
  document.getElementById('hintMode').value = (await store.get('hintMode','strict'));
  document.getElementById('debugMode').checked = await store.get('debugMode', false);
  document.getElementById('mockLLM').checked = await store.get('mockLLM', false);
  if (toneSelect) {
    const storedTone = await store.get('tutorTone', 'nudge');
    currentTone = toneLabelMap[storedTone] ? storedTone : 'nudge';
    toneSelect.value = currentTone;
  }
  // Show/hide debug box based on debug mode
  document.getElementById('debugBox').style.display = document.getElementById('debugMode').checked ? 'block' : 'none';
})();

const OLLAMA_MODELS_BY_CATEGORY = {
  'General Chat': [
    'llama2', 'llama2:7b', 'llama2:13b', 'llama2:70b',
    'llama3', 'llama3:8b', 'llama3:70b', 'llama3.1', 'llama3.1:8b', 'llama3.1:70b', 'llama3.2', 'llama3.2:1b', 'llama3.2:3b',
    'mistral', 'mistral:7b', 'mixtral', 'mixtral:8x7b', 'mixtral:8x22b',
    'gemma', 'gemma2', 'gemma2:2b', 'gemma2:9b', 'gemma2:27b',
    'phi3', 'phi3:mini', 'phi3:medium', 'qwen2', 'qwen2:0.5b', 'qwen2:1.5b', 'qwen2:7b', 'qwen2:72b',
    'neural-chat', 'starling-lm', 'openchat', 'solar', 'solar:10.7b',
    'falcon', 'falcon:7b', 'falcon:40b', 'vicuna', 'vicuna:13b', 'vicuna:33b',
    'dolphin-mixtral', 'dolphin-llama3', 'dolphin-mistral'
  ],
  'Coding': [
    'codellama', 'codellama:7b', 'codellama:13b', 'codellama:34b',
    'deepseek-coder', 'deepseek-coder:1.3b', 'deepseek-coder:6.7b', 'deepseek-coder:33b',
    'starcoder', 'starcoder2:15b', 'wizardcoder', 'wizardcoder:7b', 'wizardcoder:13b', 'wizardcoder:34b',
    'phind-codellama', 'phind-codellama:34b', 'phind-codellama:34b-v2',
    'qwen2.5-coder', 'qwen2.5-coder:7b', 'qwen2.5-coder:32b',
    'nous-hermes-codellama', 'granite-code'
  ],
  'Vision': [
    'llava', 'llava:7b', 'llava:13b', 'llava:34b',
    'bakllava', 'bakllava:7b',
    'minicpm-v', 'minicpm-v:2.6',
    'moondream', 'moondream:1.8b'
  ],
  'Multimodal & Embeddings': [
    'nomic-embed', 'nomic-embed-text', 'nomic-embed-text:v1',
    'mxbai-embed-large', 'all-minilm'
  ],
  'Specialized': [
    'yi', 'yi:6b', 'yi:34b',
    'orca-mini', 'orca-mini:3b', 'orca-mini:7b', 'orca-mini:13b',
    'mistral-nemo', 'smollm2',
    'tinyllama', 'tinyllama:1.1b',
    'stablelm2', 'stablelm2:1.6b', 'stablelm2:12b'
  ]
};

// Flatten all models into a single array for compatibility
const POPULAR_OLLAMA_MODELS = Object.values(OLLAMA_MODELS_BY_CATEGORY).flat();

// Helper function to extract base model name (without tag)
function getBaseModelName(modelName) {
  if (!modelName) return '';
  // Remove tag (everything after colon) for comparison
  return modelName.split(':')[0];
}

// Helper function to check if a model is installed (handles name variations)
function isModelInstalled(modelName, installedModels) {
  const baseName = getBaseModelName(modelName);
  return installedModels.some(installed => {
    const installedBase = getBaseModelName(installed);
    // Exact match or base name match
    return installed === modelName || installedBase === baseName;
  });
}

async function populateOllamaModelSelect(selectedValue) {
  const select = document.getElementById('ollamaModel');
  const statusEl = document.getElementById('ollamaModelStatus');
  const ollamaUrl = document.getElementById('ollamaUrl').value.trim() || 'http://localhost:11434';
  
  // Clear existing options
  select.innerHTML = '';
  
  // Show loading state
  statusEl.textContent = 'Detecting installed models...';
  statusEl.style.color = '#666';
  
  try {
    // Fetch installed models
    const installedModels = await fetchOllamaModels(ollamaUrl);
    
    // Create option groups for installed models
    if (installedModels.length > 0) {
      const installedGroup = document.createElement('optgroup');
      installedGroup.label = `Installed (${installedModels.length})`;
      installedModels.sort().forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        if (model === selectedValue) {
          option.selected = true;
        }
        installedGroup.appendChild(option);
      });
      select.appendChild(installedGroup);
    }
    
    // Add cloud models organized by category
    let hasCloudModels = false;
    for (const [category, models] of Object.entries(OLLAMA_MODELS_BY_CATEGORY)) {
      // Filter out models that are already installed (checking base names)
      const availableModels = models.filter(m => !isModelInstalled(m, installedModels));
      
      if (availableModels.length > 0) {
        hasCloudModels = true;
        const categoryGroup = document.createElement('optgroup');
        categoryGroup.label = `${category} (install with: ollama pull <name>)`;
        availableModels.sort().forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          if (model === selectedValue) {
            option.selected = true;
          }
          categoryGroup.appendChild(option);
        });
        select.appendChild(categoryGroup);
      }
    }
    
    // If no models found at all, add default
    if (installedModels.length === 0 && !hasCloudModels) {
      const option = document.createElement('option');
      option.value = 'llama2';
      option.textContent = 'llama2 (default - install with: ollama pull llama2)';
      if ('llama2' === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    
    // Set selected value if it exists
    if (selectedValue && [...select.options].some(opt => opt.value === selectedValue)) {
      select.value = selectedValue;
    } else if (installedModels.length > 0) {
      // Select first installed model if available
      select.value = installedModels[0];
    } else if (hasCloudModels) {
      // Select first cloud model
      const firstOption = select.querySelector('option');
      if (firstOption) {
        select.value = firstOption.value;
      }
    }
    
    // Update status
    if (installedModels.length > 0) {
      statusEl.textContent = `Found ${installedModels.length} installed model${installedModels.length > 1 ? 's' : ''}. ${hasCloudModels ? 'Cloud models available below.' : ''}`;
      statusEl.style.color = '#0a0';
    } else if (hasCloudModels) {
      statusEl.textContent = 'No installed models. Install any model with: ollama pull <name>';
      statusEl.style.color = '#f60';
    } else {
      statusEl.textContent = 'No models detected. Install with: ollama pull llama2';
      statusEl.style.color = '#f60';
    }
  } catch (error) {
    // On error, add default option
    const option = document.createElement('option');
    option.value = selectedValue || 'llama2';
    option.textContent = selectedValue || 'llama2 (default)';
    option.selected = true;
    select.appendChild(option);
    
    statusEl.textContent = `Cannot connect to Ollama. Make sure it's running at ${ollamaUrl}`;
    statusEl.style.color = '#c00';
  }
}

function toggleProviderSettings(provider) {
  const openaiDiv = document.getElementById('openaiSettings');
  const groqDiv = document.getElementById('groqSettings');
  const ollamaDiv = document.getElementById('ollamaSettings');
  
  // Hide all first
  openaiDiv.style.display = 'none';
  groqDiv.style.display = 'none';
  ollamaDiv.style.display = 'none';
  
  // Show the selected provider
  if (provider === 'ollama') {
    ollamaDiv.style.display = 'block';
    // Refresh models when switching to Ollama
    const storedModel = document.getElementById('ollamaModel').value || 'llama2';
    populateOllamaModelSelect(storedModel);
  } else if (provider === 'groq') {
    groqDiv.style.display = 'block';
  } else {
    openaiDiv.style.display = 'block';
  }
}

document.getElementById('llmProvider').addEventListener('change', (e) => {
  toggleProviderSettings(e.target.value);
});

// Refresh Ollama models button
document.getElementById('refreshOllamaModels').addEventListener('click', async () => {
  const currentValue = document.getElementById('ollamaModel').value;
  await populateOllamaModelSelect(currentValue);
});

// CORS Help Modal Functions
function detectPlatform() {
  const userAgent = navigator.userAgent || navigator.platform || '';
  if (userAgent.includes('Win')) return 'windows';
  if (userAgent.includes('Mac')) return 'macos';
  if (userAgent.includes('Linux')) return 'linux';
  return 'unknown';
}

function getCORSInstructions(platform) {
  const instructions = {
    windows: {
      title: 'Quick Fix for Windows',
      intro: 'Ollama needs permission to talk to TrailNote. Just follow these 3 simple steps:',
      steps: [
        'Search for "PowerShell" in your Start menu and open it',
        'Click the "Copy" button below, then right-click in PowerShell and paste:',
        { code: '$env:OLLAMA_ORIGINS="chrome-extension://*"; ollama serve', copyable: true },
        'Press Enter. You should see Ollama start running. Come back here and click "Test Connection" below!'
      ],
      tip: 'Note: You\'ll need to do this again if you restart your computer. That\'s normal!'
    },
    macos: {
      title: 'Quick Fix for Mac',
      intro: 'Ollama needs permission to talk to TrailNote. Just follow these 3 simple steps:',
      steps: [
        'Open Terminal (press Cmd+Space, type "Terminal", hit Enter)',
        'Click the "Copy" button below, then paste into Terminal:',
        { code: 'OLLAMA_ORIGINS=chrome-extension://* ollama serve', copyable: true },
        'Press Enter. You should see Ollama start running. Come back here and click "Test Connection" below!'
      ],
      tip: 'Note: You\'ll need to do this again if you restart your computer. That\'s normal!'
    },
    linux: {
      title: 'Quick Fix for Linux',
      intro: 'Ollama needs permission to talk to TrailNote. Just follow these 3 simple steps:',
      steps: [
        'Open your Terminal app',
        'Click the "Copy" button below, then paste into Terminal:',
        { code: 'OLLAMA_ORIGINS=chrome-extension://* ollama serve', copyable: true },
        'Press Enter. You should see Ollama start running. Come back here and click "Test Connection" below!'
      ],
      tip: 'Note: You\'ll need to do this again if you restart your computer. That\'s normal!'
    },
    unknown: {
      title: 'Quick Fix',
      intro: 'Ollama needs permission to talk to TrailNote. Copy and paste this command in your terminal:',
      steps: [
        { code: 'OLLAMA_ORIGINS=chrome-extension://* ollama serve', copyable: true },
        'Press Enter, then click "Test Connection" below.'
      ],
      tip: 'This works immediately but you\'ll need to repeat it if you restart.'
    }
  };
  
  return instructions[platform] || instructions.unknown;
}

function showCORSHelpModal() {
  const modal = document.getElementById('corsHelpModal');
  const instructionsDiv = document.getElementById('corsPlatformInstructions');
  const platform = detectPlatform();
  const instructions = getCORSInstructions(platform);
  
  let html = `<h3 style="margin-top:0; color:#333;">${instructions.title}</h3>`;
  
  if (instructions.intro) {
    html += `<p style="color:#555; font-size:14px; line-height:1.6; margin-bottom:20px;">${instructions.intro}</p>`;
  }
  
  html += '<ol style="line-height:1.8; padding-left:20px; counter-reset:item; list-style:none;">';
  
  let stepNumber = 1;
  instructions.steps.forEach(step => {
    if (typeof step === 'string') {
      html += `<li style="margin-bottom:16px; counter-increment:item; position:relative; padding-left:0;">`;
      html += `<span style="font-weight:600; color:#0066cc; font-size:16px; margin-right:8px;">${stepNumber}.</span>`;
      html += `<span style="font-size:14px; color:#333;">${step}</span>`;
      html += `</li>`;
      stepNumber++;
    } else if (step.code) {
      html += `<div style="background:#f8f9fa; border:2px solid #e0e0e0; padding:16px; border-radius:8px; font-family:monospace; font-size:13px; margin:12px 0 12px 28px; position:relative;">`;
      html += `<code style="white-space:pre-wrap; word-break:break-all; color:#1e1e1e; display:block;">${step.code}</code>`;
      html += `<button onclick="navigator.clipboard.writeText('${step.code.replace(/'/g, "\\'")}'); this.textContent='✓ Copied!'; this.style.background='#10b981'; setTimeout(()=>{this.textContent='Copy'; this.style.background='#0066cc';}, 2000);" style="position:absolute; top:12px; right:12px; padding:6px 12px; background:#0066cc; color:white; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; font-family:system-ui;">Copy</button>`;
      html += `</div>`;
    }
  });
  
  html += '</ol>';
  
  if (instructions.tip) {
    html += `<div style="background:#fffbeb; border-left:4px solid:#fbbf24; padding:12px 16px; border-radius:6px; margin-top:20px;">`;
    html += `<p style="margin:0; font-size:13px; color:#92400e;"><strong>💡 Tip:</strong> ${instructions.tip}</p>`;
    html += `</div>`;
  }
  
  instructionsDiv.innerHTML = html;
  modal.style.display = 'flex';
}

function hideCORSHelpModal() {
  document.getElementById('corsHelpModal').style.display = 'none';
}

async function testOllamaConnection() {
  const ollamaUrl = document.getElementById('ollamaUrl').value.trim() || 'http://localhost:11434';
  const statusEl = document.getElementById('ollamaModelStatus');
  const testButton = document.getElementById('corsHelpTest');
  
  testButton.disabled = true;
  testButton.textContent = 'Testing...';
  statusEl.textContent = 'Testing connection...';
  statusEl.style.color = '#666';
  
  try {
    // Test by trying to fetch models
    const models = await fetchOllamaModels(ollamaUrl);
    // Connection successful (even if no models installed)
    statusEl.textContent = '✓ Connection successful! Ollama is working.';
    statusEl.style.color = '#0a0';
    hideCORSHelpModal();
    // Refresh model list
    const currentValue = document.getElementById('ollamaModel').value || 'llama2';
    await populateOllamaModelSelect(currentValue);
  } catch (error) {
    statusEl.textContent = '✗ Connection failed. Make sure Ollama is running with CORS enabled.';
    statusEl.style.color = '#c00';
  } finally {
    testButton.disabled = false;
    testButton.textContent = "I've restarted Ollama - Test Connection";
  }
}

// CORS Help Modal Event Listeners
document.getElementById('corsHelpClose').addEventListener('click', hideCORSHelpModal);
document.getElementById('corsHelpTest').addEventListener('click', testOllamaConnection);

// Close modal when clicking outside
document.getElementById('corsHelpModal').addEventListener('click', (e) => {
  if (e.target.id === 'corsHelpModal') {
    hideCORSHelpModal();
  }
});

// Export function for use in error handling
window.showCORSHelpModal = showCORSHelpModal;

// Ollama Cloud Sign-in
async function checkOllamaCloudStatus() {
  // Check if user is signed in to Ollama Cloud
  // This would require checking Ollama CLI or API
  // For now, we'll just show the sign-in button
  const statusEl = document.getElementById('ollamaCloudStatus');
  const signinButton = document.getElementById('ollamaCloudSignin');
  
  // Check stored status
  const cloudSignedIn = await store.get('ollamaCloudSignedIn', false);
  if (cloudSignedIn) {
    signinButton.textContent = 'Signed in to Ollama Cloud';
    signinButton.style.background = '#0a0';
    signinButton.disabled = true;
    statusEl.textContent = '✓ Connected to Ollama Cloud. You can use cloud models.';
    statusEl.style.color = '#0a0';
  } else {
    signinButton.textContent = 'Sign in to Ollama Cloud';
    signinButton.style.background = '#0066cc';
    signinButton.disabled = false;
    statusEl.textContent = '';
  }
}

function handleOllamaCloudSignin() {
  // Open Ollama Cloud sign-in page
  window.open('https://ollama.com/signin', '_blank');
  
  // Show instructions
  const statusEl = document.getElementById('ollamaCloudStatus');
  statusEl.innerHTML = `
    <div style="background:#fff3cd; border:1px solid #ffc107; padding:12px; border-radius:6px; margin-top:8px;">
      <strong>Next Steps:</strong>
      <ol style="margin:8px 0 0 0; padding-left:20px; font-size:12px; line-height:1.6;">
        <li>Sign in to Ollama Cloud in the new tab</li>
        <li>After signing in, open a terminal and run: <code>ollama signin</code></li>
        <li>This links your local Ollama to your cloud account</li>
        <li>Return here and click "I've signed in" below</li>
      </ol>
      <button id="ollamaCloudConfirm" style="margin-top:8px; padding:6px 12px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
        I've signed in - Update Status
      </button>
    </div>
  `;
  
  // Add confirm button handler
  setTimeout(() => {
    const confirmBtn = document.getElementById('ollamaCloudConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        await store.set('ollamaCloudSignedIn', true);
        await checkOllamaCloudStatus();
        statusEl.innerHTML = '<span style="color:#0a0;">✓ Status updated. You can now use Ollama Cloud models.</span>';
      });
    }
  }, 100);
}

// Detect if using Ollama Cloud vs local
function isOllamaCloud(url) {
  return url && (url.includes('ollama.com') || url.includes('api.ollama.com'));
}

// Update URL input placeholder/hint based on Cloud vs local
function updateOllamaUrlHint() {
  const urlInput = document.getElementById('ollamaUrl');
  const url = urlInput.value.trim() || urlInput.placeholder;
  
  if (isOllamaCloud(url)) {
    urlInput.placeholder = 'https://api.ollama.com or https://ollama.com';
    // Show Cloud sign-in hint
    const cloudStatus = document.getElementById('ollamaCloudStatus');
    if (cloudStatus && !cloudStatus.textContent.includes('Signed in')) {
      cloudStatus.textContent = 'Using Ollama Cloud URL. Make sure you\'re signed in.';
      cloudStatus.style.color = '#f60';
    }
  } else {
    urlInput.placeholder = 'http://localhost:11434';
  }
}

// Watch for URL changes
document.getElementById('ollamaUrl').addEventListener('input', updateOllamaUrlHint);
document.getElementById('ollamaUrl').addEventListener('blur', updateOllamaUrlHint);

// Initialize Ollama Cloud status on load
checkOllamaCloudStatus();

// Ollama Cloud sign-in button
document.getElementById('ollamaCloudSignin').addEventListener('click', handleOllamaCloudSignin);

// Toggle debug box visibility
document.getElementById('debugMode').addEventListener('change', (e) => {
  document.getElementById('debugBox').style.display = e.target.checked ? 'block' : 'none';
});

toneSelect?.addEventListener('change', (e) => {
  const val = e.target.value;
  currentTone = toneLabelMap[val] ? val : 'nudge';
});

// Basic tab switching
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
    btn.classList.add('active');
  });
});
document.getElementById('status').textContent = 'ready';

// Context receiver
const ctxEl = document.getElementById('contextPreview');
let currentContext = null;

let lastContextUpdateTime = null;
let contextUpdateCount = 0;

// Enhanced syntax highlighter matching VS Code Light+ theme
function highlightCode(code, lang = 'html') {
  if (!code) return '';
  
  // First escape HTML to prevent XSS
  let highlighted = escapeHTML(code);
  
  if (lang === 'html') {
    // Process line by line for better accuracy
    const lines = highlighted.split('\n');
    const processedLines = lines.map(line => {
      let processed = line;
      
      // HTML comments (must come before tag processing)
      processed = processed.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="syn-comment">$1</span>');
      
      // Process tags more carefully - handle self-closing, attributes, and text content
      // Match opening/closing tags with attributes
      processed = processed.replace(/(&lt;)(\/?)([a-zA-Z][\w-]*)([^&]*?)(\/?)(&gt;)/g, (match, open, slash, tagName, attrs, selfClose, close) => {
        // Opening bracket
        let result = `<span class="syn-punct">${open}</span>`;
        
        // Closing tag slash
        if (slash) {
          result += `<span class="syn-punct">${slash}</span>`;
        }
        
        // Tag name
        result += `<span class="syn-tag">${tagName}</span>`;
        
        // Attributes
        if (attrs) {
          // Process attributes: name="value" or name='value'
          let attrProcessed = attrs.replace(/([a-zA-Z][\w-]*)(\s*=\s*)(["'])([\s\S]*?)(\3)/g, 
            '<span class="syn-attr">$1</span><span class="syn-punct">$2$3</span><span class="syn-string">$4</span><span class="syn-punct">$5</span>');
          
          // Handle attributes without values (boolean attributes)
          attrProcessed = attrProcessed.replace(/(^|\s)([a-zA-Z][\w-]+)(?=\s|$|[\/&])/g, 
            '$1<span class="syn-attr">$2</span>');
          
          result += attrProcessed;
        }
        
        // Self-closing slash
        if (selfClose) {
          result += `<span class="syn-punct">${selfClose}</span>`;
        }
        
        // Closing bracket
        result += `<span class="syn-punct">${close}</span>`;
        
        return result;
      });
      
      // Highlight text content between tags (but not inside tags)
      // This is tricky - we'll handle it by looking for text that's not part of tags
      // For now, text content stays as default color
      
      return processed;
    });
    
    highlighted = processedLines.join('\n');
    
  } else if (lang === 'css') {
    // CSS comments
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="syn-comment">$1</span>');
    // CSS selectors
    highlighted = highlighted.replace(/([.#]?[a-zA-Z][\w-]*)\s*{/g, '<span class="syn-selector">$1</span> {');
    // CSS properties
    highlighted = highlighted.replace(/([a-zA-Z-]+)\s*:/g, '<span class="syn-property">$1</span>:');
    // CSS string values
    highlighted = highlighted.replace(/(:\s*)(["'])([\s\S]*?)(\2)/g, 
      '$1<span class="syn-punct">$2</span><span class="syn-string">$3</span><span class="syn-punct">$4</span>');
  }
  
  return highlighted;
}

function renderContext(ctx) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  contextUpdateCount++;
  lastContextUpdateTime = now;
  
  console.log(`[TrailNote Panel] Context update #${contextUpdateCount} at ${timeStr}`, ctx);
  
  currentContext = ctx || null;

  if (!ctx) {
    ctxEl.textContent = "Waiting for page context...\n\nMake sure you're on a freeCodeCamp challenge page.";
    ctxEl.classList.remove('flash');
    return;
  }

  // Build HTML with syntax highlighting
  let html = '';
  
  if (ctx.title) {
    html += `<div class="ctx-section"><span class="ctx-label">📝</span> <span class="ctx-title">${escapeHTML(ctx.title)}</span></div>`;
  }
  if (ctx.url) {
    html += `<div class="ctx-section"><span class="ctx-label">🔗</span> <span class="ctx-url">${escapeHTML(ctx.url)}</span></div>`;
  }
  
  // Show full code with syntax highlighting
  if (ctx.userCode) {
    const highlightedCode = highlightCode(ctx.userCode, 'html');
    html += `<div class="ctx-section ctx-code">
      <div class="ctx-header">💻 Your Code</div>
      <div class="ctx-content"><pre class="code-block">${highlightedCode}</pre></div>
    </div>`;
  }
  
  // Show all tests without truncation
  if (ctx.tests?.length) {
    const testList = ctx.tests.map((test, idx) => 
      `<div class="test-item"><span class="test-num">${idx + 1}.</span> ${escapeHTML(test)}</div>`
    ).join('');
    html += `<div class="ctx-section ctx-tests">
      <div class="ctx-header">✅ Tests</div>
      <div class="ctx-content">${testList}</div>
    </div>`;
  }

  if (!html) {
    ctxEl.innerHTML = '<div class="ctx-empty">Context detected but empty.<br><br>Try typing in the editor or running the tests.</div>';
    ctxEl.classList.remove('flash');
    return;
  }

  // Add timestamp indicator
  html += `<div class="ctx-timestamp">⏱️ Updated: ${timeStr}</div>`;
  ctxEl.innerHTML = html;
  
  // Visual flash indicator using CSS class
  ctxEl.classList.add('flash');
  setTimeout(() => {
    ctxEl.classList.remove('flash');
  }, 500);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'CONTEXT_PUSH') {
    console.log('[TrailNote Panel] Received CONTEXT_PUSH message');
    renderContext(msg.ctx);
  }
  if (msg?.type === 'DEBUG_TUTOR') {
    const debugBox = document.getElementById('debugBox');
    if (debugBox) {
      debugBox.style.display = 'block';
      debugBox.textContent =
        `Model: ${msg.debugPayload.model}\nUsed: ${msg.debugPayload.usedTokens}\n---\n` +
        msg.debugPayload.promptPreview;
    }
  }
});

function requestInitialContext(retryCount = 0){
  const maxRetries = 5;
  
  chrome.runtime.sendMessage({ type: 'CONTEXT_GET' }, (response) => {
    if (chrome.runtime.lastError) {
      const errMsg = chrome.runtime.lastError.message || '';
      if (!errMsg.includes('Extension context invalidated') && !errMsg.includes('Receiving end')) {
        console.warn('[TrailNote] CONTEXT_GET error:', errMsg);
      }
      return;
    }
    
    if (response?.ctx) {
      console.log('[TrailNote Panel] Initial context loaded successfully');
      renderContext(response.ctx);
    } else if (retryCount < maxRetries) {
      // Retry after a short delay
      console.log(`[TrailNote Panel] No context yet, retrying... (${retryCount + 1}/${maxRetries})`);
      setTimeout(() => {
        requestInitialContext(retryCount + 1);
      }, 300);
    } else {
      console.log('[TrailNote Panel] Max retries reached, will wait for auto-refresh');
    }
  });
}

function requestContextRefresh(){
  chrome.runtime.sendMessage({ type: 'CONTEXT_REQUEST' }, (response) => {
    if (chrome.runtime.lastError) {
      const errMsg = chrome.runtime.lastError.message || '';
      if (!errMsg.includes('Extension context invalidated') && !errMsg.includes('Receiving end')) {
        console.warn('[TrailNote Panel] CONTEXT_REQUEST error:', errMsg);
      }
      return;
    }
    if (response?.ctx) {
      console.log('[TrailNote Panel] Auto-refresh: Got context from background');
      renderContext(response.ctx);
    }
  });
}

// Trigger content script to capture current page immediately
async function triggerContentScriptRefresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url?.includes('freecodecamp.org')) {
      console.log('[TrailNote Panel] Triggering content script refresh for current tab');
      chrome.tabs.sendMessage(tab.id, { type: 'FORCE_REFRESH' }, (response) => {
        // Ignore errors - content script might not be ready yet
        if (chrome.runtime.lastError) {
          console.log('[TrailNote Panel] Content script not ready yet, will use background cache');
        }
      });
    }
  } catch (e) {
    console.log('[TrailNote Panel] Could not trigger content script:', e.message);
  }
}

// Initialize with loading state
renderContext(null);

// Trigger immediate refresh and request initial context
triggerContentScriptRefresh();
requestInitialContext();

// Periodically refresh context to catch SPA navigation and ensure we always have latest
console.log('[TrailNote Panel] Starting auto-refresh interval (every 1 minute)');
setInterval(() => {
  requestContextRefresh();
}, 60000); // Check every 1 minute

// Tutor wiring
const answerEl = document.getElementById('answer');
const tokenBar = document.getElementById('tokenBar');

function escapeHTML(str) {
  return (str || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function tonePill() {
  const toneKey = toneLabelMap[currentTone] ? currentTone : 'nudge';
  const label = toneLabelMap[toneKey];
  return `<div class="tone-line"><span class="tone-pill tone-${toneKey}">${escapeHTML(label)}</span></div>`;
}

function renderError(message) {
  // Check if this is a CORS error and show help modal
  if (message && (message.includes('403') || message.includes('CORS') || message.includes('Forbidden'))) {
    answerEl.innerHTML = `<div class="box error">
      ${escapeHTML(message.split('\n')[0])}
      <br><br>
      <button onclick="window.showCORSHelpModal()" style="padding:8px 16px; background:#0066cc; color:white; border:none; border-radius:4px; cursor:pointer; margin-top:8px;">
        Get Help Fixing This
      </button>
    </div>`;
    // Auto-show modal for CORS errors
    setTimeout(() => {
      if (window.showCORSHelpModal) {
        window.showCORSHelpModal();
      }
    }, 500);
  } else {
    answerEl.innerHTML = `<div class="box error">${escapeHTML(message)}</div>`;
  }
}

function renderTutor(obj, context = null) {
  if (!obj || typeof obj !== 'object') {
    renderError('Tutor returned an empty response. Try again.');
    return;
  }

  // Use passed context or fall back to currentContext
  const ctx = context || currentContext;
  const tests = ctx?.tests || [];
  
  console.log('[TrailNote Panel] Rendering tutor with tests:', tests.length, tests);
  
  const testsMarkup = tests.length
    ? tests.map((t, idx) => `<div class="editor-line"><span class="line-num">${idx + 1}</span><span class="line-content">${escapeHTML(t)}</span></div>`).join('')
    : '<div class="editor-line"><span class="line-num"></span><span class="line-content muted">—</span></div>';

  const steps = Array.isArray(obj.steps) ? obj.steps : [];
  const stepsMarkup = steps.length
    ? steps.map((step, idx) => `<div class="editor-line"><span class="line-num">${idx + 1}</span><span class="line-content">${escapeHTML(step)}</span></div>`).join('')
    : '<div class="editor-line"><span class="line-num"></span><span class="line-content muted">—</span></div>';

  const diagnosisLines = (obj.diagnosis || '').split('\n').filter(Boolean);
  const diagnosisMarkup = diagnosisLines.length
    ? diagnosisLines.map((line, idx) => `<div class="editor-line"><span class="line-num"></span><span class="line-content">${escapeHTML(line)}</span></div>`).join('')
    : '<div class="editor-line"><span class="line-num"></span><span class="line-content muted">—</span></div>';

  const whyLines = (obj.why_it_happens || '').split('\n').filter(Boolean);
  const whyMarkup = whyLines.length
    ? whyLines.map((line, idx) => `<div class="editor-line"><span class="line-num"></span><span class="line-content">${escapeHTML(line)}</span></div>`).join('')
    : '<div class="editor-line"><span class="line-num"></span><span class="line-content muted">—</span></div>';

  const selfCheckLines = (obj.self_check || '').split('\n').filter(Boolean);
  const selfCheckMarkup = selfCheckLines.length
    ? selfCheckLines.map((line, idx) => `<div class="editor-line"><span class="line-num"></span><span class="line-content">${escapeHTML(line)}</span></div>`).join('')
    : '<div class="editor-line"><span class="line-num"></span><span class="line-content muted">—</span></div>';

  const glimpse = obj.redacted_code_glimpse ? `
      <div class="editor-section">
        <div class="editor-label">Focus area</div>
        <div class="editor-code">${escapeHTML(obj.redacted_code_glimpse)}</div>
      </div>` : '';

  answerEl.innerHTML = `
    <div class="tutor-output">
      ${tonePill()}
      <div class="editor-section">
        <div class="editor-label">What the test says</div>
        <div class="editor-code">${testsMarkup}</div>
      </div>

      <div class="editor-section">
        <div class="editor-label">Diagnosis</div>
        <div class="editor-code">${diagnosisMarkup}</div>
      </div>

      <div class="editor-section">
        <div class="editor-label">Why this happens</div>
        <div class="editor-code">${whyMarkup}</div>
      </div>

      <div class="editor-section">
        <div class="editor-label">Try this</div>
        <div class="editor-code">${stepsMarkup}</div>
      </div>

      <div class="editor-section">
        <div class="editor-label">Self-check</div>
        <div class="editor-code">${selfCheckMarkup}</div>
      </div>
      ${glimpse}
    </div>`;
}

async function refreshTokenBar(){
  const t = await tokens.get();
  tokenBar.textContent = `Session: ${t.session} • Today: ${t.today}`;
}
refreshTokenBar();

async function ask(mode){
  if (!allowEvery(4000)) { 
    answerEl.textContent = "Slow down a bit so you learn by thinking 🙂"; 
    return; 
  }
  
  // Check for mock mode - actual API key validation happens in tutorAnswer()
  const mock = await store.get('mockLLM', false);
  const provider = await store.get('llmProvider', 'openai');
  
  // If not in mock mode, tutorAnswer() will validate the appropriate API key
  // This is just a basic check to avoid unnecessary calls
  
  answerEl.innerHTML = '<div class="box muted">Thinking…</div>';
  try {
    // Ensure we have the latest context
    const contextToUse = currentContext;
    if (!contextToUse) {
      renderError("Context Preview is empty. Open a freeCodeCamp challenge, then wait a moment before asking again.");
      return;
    }
    const result = await tutorAnswer(mode, contextToUse, currentTone);
    renderTutor(result, contextToUse);
  } catch (e) {
    renderError(`Error: ${e.message}`);
  } finally {
    refreshTokenBar();
  }
}

document.getElementById('btnExplain').onclick = ()=>ask('explain');
document.getElementById('btnNudge').onclick   = ()=>ask('nudge');
document.getElementById('btnConcept').onclick = ()=>ask('concept');

// Settings
document.getElementById('savePrefs').onclick = async ()=>{
  if (toneSelect) {
    const toneVal = toneSelect.value;
    currentTone = toneLabelMap[toneVal] ? toneVal : 'nudge';
  }
  await store.set('llmProvider', document.getElementById('llmProvider').value);
  await store.set('apiKey', document.getElementById('apiKey').value.trim());
  await store.set('model',  (modelSelect.value || '').trim());
  await store.set('groqApiKey', document.getElementById('groqApiKey').value.trim());
  await store.set('groqModel', document.getElementById('groqModel').value);
  await store.set('ollamaUrl', document.getElementById('ollamaUrl').value.trim());
  await store.set('ollamaModel', document.getElementById('ollamaModel').value.trim());
  await store.set('hintMode', document.getElementById('hintMode').value);
  await store.set('debugMode', document.getElementById('debugMode').checked);
  await store.set('mockLLM', document.getElementById('mockLLM').checked);
  await store.set('tutorTone', currentTone);
  document.getElementById('status').textContent = 'settings saved';
  setTimeout(()=>document.getElementById('status').textContent='ready', 1200);
};

// Notes wiring
const noteBody = document.getElementById('noteBody');
const noteTags = document.getElementById('noteTags');
const noteList = document.getElementById('noteList');
const noteSearch = document.getElementById('noteSearch');

function parseTags(raw){
  return (raw||'')
    .split(/\s+/)
    .map(t=>t.trim())
    .filter(Boolean)
    .map(t=> t.startsWith('#') ? t : `#${t.toLowerCase()}`);
}

async function renderList(filter=''){
  const q = filter.toLowerCase();
  const arr = await notesApi.list();
  const filtered = q ? arr.filter(n =>
    (n.body.toLowerCase().includes(q) || n.tags.join(' ').toLowerCase().includes(q))
  ) : arr;

  noteList.innerHTML = '';
  filtered.forEach(n=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <label>
        <input type="checkbox" class="pick">
        <b>${n.title||'Note'}</b>
        <div class="muted">${n.tags.join(' ')}</div>
        <div>${n.body}</div>
        <div class="muted">${n.lesson?.title||''}</div>
      </label>`;
    noteList.appendChild(li);
  });
}

document.getElementById('saveNote').onclick = async ()=>{
  const tags = parseTags(noteTags.value) ;
  const auto = autoTagsFromContext(currentContext);
  const note = {
    id: crypto.randomUUID(),
    title: currentContext?.title || 'freeCodeCamp',
    body: noteBody.value.trim(),
    tags: Array.from(new Set([...tags, ...auto])),
    lesson: currentContext,
    createdAt: Date.now()
  };
  if (!note.body) return;
  await notesApi.add(note);
  noteBody.value = ''; noteTags.value = '';
  await renderList(noteSearch.value);
};

noteSearch.oninput = ()=>renderList(noteSearch.value);

function autoTagsFromContext(ctx){
  const bank = [
    {kw:/flex|justify|align|grid/i, tag:'#flexbox'},
    {kw:/a11y|accessib|aria|alt/i, tag:'#a11y'},
    {kw:/semantic|header|footer|nav|main/i, tag:'#semantic-html'},
    {kw:/color|contrast/i, tag:'#contrast'},
    {kw:/image|img|alt/i, tag:'#images'}
  ];
  const hay = JSON.stringify(ctx||{});
  return bank.filter(b=>b.kw.test(hay)).map(b=>b.tag);
}

document.getElementById('exportMd').onclick = ()=>{
  const picks = [...noteList.querySelectorAll('input.pick:checked')].map(x=>x.closest('li'));
  if (!picks.length) return;
  const lines = picks.map(li=>{
    const title = li.querySelector('b').textContent;
    const tags  = li.querySelector('.muted').textContent;
    const body  = li.querySelectorAll('div')[1].textContent;
    return `### ${title}\n${tags}\n\n${body}\n`;
  });
  const blob = new Blob([lines.join('\n')], {type:'text/markdown'});
  const url = URL.createObjectURL(blob);
  chrome.downloads ? chrome.downloads.download({ url, filename: 'notes.md' })
                   : window.open(url, '_blank');
};

renderList();

