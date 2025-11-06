// Content script that sends context to panel via background
// Handles SPA navigation with mutation observer

// Import context grabber - note: MV3 doesn't support ES modules in content scripts by default
// For now, we inline or use a simple approach
function grabContextFromDom() {
  console.log('[TrailNote] === Starting context capture ===');
  
  // Try multiple title selectors
  let title = null;
  const titleSelectors = [
    'h1',
    '.title',
    '.challenge-title',
    '[class*="title"]',
    '[data-test*="challenge-title"]',
    '[class*="Challenge"]',
    'h2'
  ];
  
  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent && el.textContent.trim().length > 0) {
      title = el.textContent.trim();
      console.log(`[TrailNote] Title found via "${selector}": "${title}"`);
      break;
    }
  }
  
  if (!title) {
    title = document.title;
    console.log(`[TrailNote] Title fallback to document.title: "${title}"`);
  }

  title = (title || '').trim();
  if (!title) {
    title = 'freeCodeCamp Challenge';
    console.log('[TrailNote] Title fallback to default label');
  }

  // Try multiple test result selectors - focus on actual test results
  const testSelectors = [
    '[class*="test"]',
    '[data-testid*="test"]',
    'li[class*="fail"]',
    'li[class*="error"]',
    'li[class*="pass"]',
    '[class*="console"]',
    '[class*="output"]',
    '[class*="test-output"]',
    '[class*="test-result"]',
    '[id*="test"]',
    'pre',
    'code[class*="test"]'
  ];
  
  // Patterns to filter out placeholder/irrelevant text
  const placeholderPatterns = [
    /\/\*\*[\s\S]*?Your test output will go here[\s\S]*?\*\//i,
    /\/\*\*[\s\S]*?test output[\s\S]*?\*\//i,
    /^\/\**\s*$/,
    /^[\s\*\/]*$/,
    /^Your test output will go here$/i,
    /^test output will go here$/i,
    /^\s*\/\/\s*running tests\s*$/i,
    /^\s*\/\/\s*tests completed\s*$/i,
    /^\/\*\s*\*\/\s*$/,
    /^\s*$/ // Empty or whitespace only
  ];
  
  const testNodes = [];
  for (const selector of testSelectors) {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length > 0) {
      console.log(`[TrailNote] Found ${nodes.length} elements via "${selector}"`);
      testNodes.push(...Array.from(nodes));
    }
  }

  // Also look for test text patterns in the entire document
  // freeCodeCamp often shows test output in specific formats
  const allText = document.body.innerText || '';
  const testPatterns = [
    /Test Failed[^\n]*/gi,
    /There should be[^\n]*/gi,
    /The \w+ should[^\n]*/gi,
    /Your \w+ should[^\n]*/gi,
    /Hint[^\n]*/gi,
    /Sorry[^\n]*Keep trying[^\n]*/gi
  ];
  
  testPatterns.forEach(pattern => {
    const matches = allText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const trimmed = match.trim();
        if (trimmed.length > 10 && trimmed.length < 500) {
          testNodes.push({ textContent: trimmed });
        }
      });
    }
  });

  // Filter out placeholder text and keep all valid tests
  const tests = testNodes
    .map(n => n.textContent.trim())
    .filter(test => {
      // Remove empty strings
      if (!test || test.length < 3) return false;
      
      // Filter out placeholder patterns
      const isPlaceholder = placeholderPatterns.some(pattern => pattern.test(test));
      if (isPlaceholder) {
        console.log(`[TrailNote] Filtered out placeholder: "${test.substring(0, 50)}..."`);
        return false;
      }
      
      // Keep tests that look like actual test output
      const looksLikeTest = /test|failed|error|should|hint|sorry/i.test(test) || test.length > 20;
      
      return looksLikeTest;
    });
  
  // Remove duplicates
  const uniqueTests = [...new Set(tests)];
  
  console.log(`[TrailNote] Tests captured (after filtering): ${uniqueTests.length}`, uniqueTests);

  // Capture user's code from editor
  let userCode = '';
  let captureMethod = 'none';
  
  // Try multiple approaches to find the editor content
  // 1. Monaco editor API (most reliable)
  if (!userCode && window.monaco) {
    try {
      const editors = window.monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        userCode = editors[0].getValue() || '';
        captureMethod = 'monaco-api';
      }
    } catch (e) {
      console.log('[TrailNote] Monaco API error:', e);
    }
  }
  
  // 2. Check iframes for Monaco editor (freeCodeCamp may use iframes)
  if (!userCode) {
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const iframeMonaco = iframeDoc.querySelector('.monaco-editor textarea');
            if (iframeMonaco && iframeMonaco.value) {
              userCode = iframeMonaco.value;
              captureMethod = 'iframe-textarea';
              break;
            }
            
            // Try Monaco API in iframe
            if (iframe.contentWindow?.monaco) {
              const editors = iframe.contentWindow.monaco.editor.getEditors();
              if (editors && editors.length > 0) {
                userCode = editors[0].getValue() || '';
                captureMethod = 'iframe-monaco-api';
                break;
              }
            }
          }
        } catch (e) {
          // Cross-origin iframe, skip
        }
      }
    } catch (e) {
      console.log('[TrailNote] Iframe check error:', e);
    }
  }
  
  // 3. Monaco editor textarea (most common)
  if (!userCode) {
    const monacoTextarea = document.querySelector('.monaco-editor textarea, textarea.inputarea');
    if (monacoTextarea) {
      userCode = monacoTextarea.value || '';
      captureMethod = 'monaco-textarea';
    }
  }
  
  // 4. freeCodeCamp-specific selectors
  if (!userCode) {
    const fccSelectors = [
      '#editor textarea',
      '[data-cy="editor"] textarea',
      '.editor-container textarea',
      '.code-editor textarea',
      'div[role="code"] textarea',
      '[class*="Editor"] textarea'
    ];
    
    for (const selector of fccSelectors) {
      const textarea = document.querySelector(selector);
      if (textarea && textarea.value) {
        userCode = textarea.value;
        captureMethod = `fcc-${selector}`;
        break;
      }
    }
  }
  
  // 5. Direct textarea selectors (fallback)
  if (!userCode) {
    const editorTextarea = document.querySelector('textarea[class*="input"], textarea[class*="editor"]');
    if (editorTextarea) {
      userCode = editorTextarea.value || '';
      captureMethod = 'generic-textarea';
    }
  }
  
  // 6. Code editor container (monaco editor visible content - less reliable)
  if (!userCode) {
    const editorContainer = document.querySelector(
      '.monaco-editor .view-lines, [class*="monaco-editor"], [class*="code-editor"], [data-cy="code-editor"]'
    );
    if (editorContainer) {
      // Try to get text from view-lines (Monaco's visible lines)
      const viewLines = editorContainer.querySelectorAll('.view-line');
      if (viewLines.length > 0) {
        const lines = Array.from(viewLines).map(line => {
          // Get text content, removing line numbers and decorations
          return line.textContent || '';
        });
        userCode = lines.join('\n');
        captureMethod = 'monaco-view-lines';
      }
    }
  }

  console.log(`[TrailNote] Code capture - Method: ${captureMethod}, Code length: ${userCode.length}`);
  if (userCode.length > 0) {
    console.log(`[TrailNote] Code preview: ${userCode.substring(0, 100)}...`);
  }
  
  const rulesApi = (typeof window !== 'undefined' && window.trailNoteRules) ? window.trailNoteRules : null;
  const instruction = rulesApi?.instructionFromDom ? rulesApi.instructionFromDom() : '';
  const ruleHints = rulesApi?.ruleHintsFromDom ? rulesApi.ruleHintsFromDom() : '';
  const codeExcerpt = rulesApi?.codeExcerptFromText ? rulesApi.codeExcerptFromText(userCode) : (userCode || '').slice(0, 400);

  const url = location.pathname;
  const context = {
    title,
    url,
    tests: uniqueTests, // Use deduplicated tests
    userCode: userCode.trim(),
    instruction,
    ruleHints,
    code_excerpt: codeExcerpt
  };
  
  console.log('[TrailNote] === Final context object ===');
  console.log('[TrailNote] Title:', context.title);
  console.log('[TrailNote] URL:', context.url);
  console.log('[TrailNote] Code length:', context.userCode.length);
  console.log('[TrailNote] Tests count:', context.tests.length);
  console.log('[TrailNote] Instruction length:', (instruction||'').length);
  console.log('[TrailNote] Rule hints:', ruleHints);
  console.log('[TrailNote] Full context:', context);
  console.log('[TrailNote] ==============================');
  
  return context;
}

// send context update to background
const IGNORABLE_RUNTIME_ERRORS = /(Extension context invalidated|Receiving end does not exist)/i;

const send = () => {
  const ctx = grabContextFromDom();
  try {
    chrome.runtime.sendMessage({ type: "CONTEXT_UPDATE", ctx }, () => {
      const err = chrome.runtime.lastError;
      if (err && !IGNORABLE_RUNTIME_ERRORS.test(err.message || "")) {
        console.warn('[TrailNote] CONTEXT_UPDATE message failed:', err.message);
      }
    });
  } catch (err) {
    const message = (typeof err === 'string') ? err : err?.message || '';
    if (!IGNORABLE_RUNTIME_ERRORS.test(message)) {
      console.warn('[TrailNote] CONTEXT_UPDATE send threw:', err);
    }
  }
};

// throttle sends to avoid flooding
let scheduled = false;
const schedule = () => { 
  if (!scheduled) { 
    scheduled = true; 
    setTimeout(() => { 
      scheduled = false; 
      send(); 
    }, 400); 
  } 
};

// initial send
send();

// watch for DOM changes (SPA navigation)
const mo = new MutationObserver(schedule);
mo.observe(document.documentElement, { childList: true, subtree: true });

// watch for popstate (back/forward navigation)
window.addEventListener('popstate', schedule);

// Intercept pushState/replaceState for SPA navigation
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  console.log('[TrailNote] Detected pushState navigation:', location.href);
  schedule();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  console.log('[TrailNote] Detected replaceState navigation:', location.href);
  schedule();
};

// Also listen for hashchange
window.addEventListener('hashchange', schedule);

// Periodic check for URL changes (fallback for complex SPAs)
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    console.log('[TrailNote] URL change detected:', lastUrl, '→', location.href);
    lastUrl = location.href;
    schedule();
  }
}, 1000);

console.log("TrailNote content script loaded");

// Listen for force refresh requests from panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'FORCE_REFRESH') {
    console.log('[TrailNote] Received FORCE_REFRESH request, capturing context immediately');
    send();
    sendResponse({ success: true });
    return true;
  }
});

