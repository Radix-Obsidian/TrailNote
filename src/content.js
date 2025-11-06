// Content script that sends context to panel via background
// Handles SPA navigation with mutation observer

// Import context grabber - note: MV3 doesn't support ES modules in content scripts by default
// For now, we inline or use a simple approach
function grabContextFromDom() {
  console.log('[HintHopper] === Starting context capture ===');
  
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
      console.log(`[HintHopper] Title found via "${selector}": "${title}"`);
      break;
    }
  }
  
  if (!title) {
    title = document.title;
    console.log(`[HintHopper] Title fallback to document.title: "${title}"`);
  }

  title = (title || '').trim();
  if (!title) {
    title = 'freeCodeCamp Challenge';
    console.log('[HintHopper] Title fallback to default label');
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
      console.log(`[HintHopper] Found ${nodes.length} elements via "${selector}"`);
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
        console.log(`[HintHopper] Filtered out placeholder: "${test.substring(0, 50)}..."`);
        return false;
      }
      
      // Keep tests that look like actual test output
      // Updated pattern to also catch freeCodeCamp's instruction patterns
      const looksLikeTest = /test|fail|error|should|hint|sorry|expected|wrap|add|create|element|attribute/i.test(test) || 
                            test.length > 20;
      
      return looksLikeTest;
    });
  
  // Remove duplicates
  const uniqueTests = [...new Set(tests)];
  
  // Look for specific rule patterns in the document if no tests were found
  if (uniqueTests.length === 0 && document.body) {
    const docText = document.body.innerText || '';
    const rulesApi = (typeof window !== 'undefined' && window.trailNoteRules) ? window.trailNoteRules : null;
    const ruleHint = rulesApi?.ruleHintsFromDom ? rulesApi.ruleHintsFromDom() : '';
    
    if (ruleHint) {
      console.log(`[HintHopper] Found rule hint: "${ruleHint}"`);
      // If we have a rule hint but no tests, create a synthetic test from the hint
      uniqueTests.push(ruleHint);
    }
  }
  
  console.log(`[HintHopper] Tests captured (after filtering): ${uniqueTests.length}`, uniqueTests);

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
      console.log('[HintHopper] Monaco API error:', e);
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
      console.log('[HintHopper] Iframe check error:', e);
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

  console.log(`[HintHopper] Code capture - Method: ${captureMethod}, Code length: ${userCode.length}`);
  if (userCode.length > 0) {
    console.log(`[HintHopper] Code preview: ${userCode.substring(0, 100)}...`);
  }
  
  const rulesApi = (typeof window !== 'undefined' && window.trailNoteRules) ? window.trailNoteRules : null;
  const instruction = rulesApi?.instructionFromDom ? rulesApi.instructionFromDom() : '';
  const ruleHints = rulesApi?.ruleHintsFromDom ? rulesApi.ruleHintsFromDom() : '';
  const codeExcerpt = rulesApi?.codeExcerptFromText ? rulesApi.codeExcerptFromText(userCode) : (userCode || '').slice(0, 400);
  
  // If we got rule hints but no tests, make the rule hint a synthetic test
  if (uniqueTests.length === 0 && ruleHints) {
    console.log(`[HintHopper] Adding rule hint as synthetic test: "${ruleHints}"`);
    uniqueTests.push(ruleHints);
  }

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
  
  console.log('[HintHopper] === Final context object ===');
  console.log('[HintHopper] Title:', context.title);
  console.log('[HintHopper] URL:', context.url);
  console.log('[HintHopper] Code length:', context.userCode.length);
  console.log('[HintHopper] Tests count:', context.tests.length);
  console.log('[HintHopper] Instruction length:', (instruction||'').length);
  console.log('[HintHopper] Rule hints:', ruleHints);
  console.log('[HintHopper] Full context:', context);
  console.log('[HintHopper] ==============================');
  
  return context;
}

// send context update to background
const IGNORABLE_RUNTIME_ERRORS = /(Extension context invalidated|Receiving end does not exist)/i;

const send = () => {
  console.log('[HintHopper] Capturing DOM context...');
  const ctx = grabContextFromDom();
  
  // Log the final context before sending
  console.log('[HintHopper] Sending context to background script:', JSON.stringify({
    title: ctx.title,
    url: ctx.url,
    testsCount: ctx.tests?.length || 0,
    codeLength: ctx.userCode?.length || 0,
    ruleHints: ctx.ruleHints || ''
  }));
  
  try {
    chrome.runtime.sendMessage({ type: "CONTEXT_UPDATE", ctx }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        if (!IGNORABLE_RUNTIME_ERRORS.test(err.message || "")) {
          console.warn('[HintHopper] CONTEXT_UPDATE message failed:', err.message);
        }
      } else {
        console.log('[HintHopper] Context successfully sent to background script');
      }
    });
  } catch (err) {
    const message = (typeof err === 'string') ? err : err?.message || '';
    if (!IGNORABLE_RUNTIME_ERRORS.test(message)) {
      console.warn('[HintHopper] CONTEXT_UPDATE send threw:', err);
    }
  }
};

// throttle sends to avoid flooding
let scheduled = false;
let lastHintId = null;

// Store test status to detect passes
let lastTestStatus = {
  failingCount: 0,
  passingCount: 0
};

// Auto-detect DOM changes and send updates
function schedule() { 
  if (!scheduled) { 
    scheduled = true; 
    setTimeout(() => { 
      scheduled = false; 
      send();
      checkForTestPasses(); 
    }, 400); 
  } 
};

// Check for test passes to track outcomes
function checkForTestPasses() {
  if (!lastHintId) return; // No hint to track against
  
  const tests = document.querySelectorAll('[class*="test"], [class*="pass"], [class*="fail"], [class*="error"]');
  let passingCount = 0;
  let failingCount = 0;
  
  tests.forEach(test => {
    const text = test.textContent?.toLowerCase() || '';
    // Check for pass/fail indicators
    if (text.includes('pass') || text.includes('success') || test.classList.contains('pass')) {
      passingCount++;
    } else if (text.includes('fail') || text.includes('error') || test.classList.contains('fail')) {
      failingCount++;
    }
  });
  
  // If there are more passing tests than before, report a pass
  if (passingCount > lastTestStatus.passingCount || failingCount < lastTestStatus.failingCount) {
    console.log('[HintHopper] Detected a test pass! Previous passing tests:', lastTestStatus.passingCount, 
               'Current:', passingCount, 'Hint ID:', lastHintId);
    
    // Report the pass to the background script
    chrome.runtime.sendMessage({
      type: 'TEST_PASSED',
      hintId: lastHintId
    }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.warn('[HintHopper] Error reporting test pass:', err.message);
      }
    });
    
    // Clear the hint ID so we don't double-count
    lastHintId = null;
  }
  
  // Update the test status
  lastTestStatus = { passingCount, failingCount };
}

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
  console.log('[HintHopper] Detected pushState navigation:', location.href);
  schedule();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  console.log('[HintHopper] Detected replaceState navigation:', location.href);
  schedule();
};

// Also listen for hashchange
window.addEventListener('hashchange', schedule);

// Periodic check for URL changes (fallback for complex SPAs)
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    console.log('[HintHopper] URL change detected:', lastUrl, '→', location.href);
    lastUrl = location.href;
    schedule();
  }
}, 1000);

console.log("HintHopper content script loaded");

// Listen for force refresh requests and other messages from panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle force refresh requests
  if (msg?.type === 'FORCE_REFRESH') {
    console.log('[HintHopper] Received FORCE_REFRESH request, capturing context immediately');
    try {
      // Give the DOM a moment to settle if there were recent changes
      setTimeout(() => {
        send();
        console.log('[HintHopper] Force refresh completed');
        if (sendResponse) {
          sendResponse({ success: true, message: 'Context refreshed successfully' });
        }
      }, 100);
    } catch (err) {
      console.error('[HintHopper] Error during force refresh:', err);
      if (sendResponse) {
        sendResponse({ success: false, error: err.message || 'Unknown error during refresh' });
      }
    }
    return true; // Keep the channel open for async response
  }
  
  // Handle test success reporting
  if (msg?.type === 'TRACK_TEST_PASS' && msg?.hintId) {
    console.log('[HintHopper] Tracking test pass for hint ID:', msg.hintId);
    chrome.runtime.sendMessage({
      type: 'TEST_PASSED',
      hintId: msg.hintId
    }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.warn('[HintHopper] Error reporting test pass:', err.message);
      }
      if (sendResponse) {
        sendResponse({ success: true });
      }
    });
    return true;
  }
  
  // Handle hint shown notification
  if (msg?.type === 'HINT_SHOWN' && msg?.hintId) {
    console.log('[HintHopper] Hint shown, setting last hint ID:', msg.hintId);
    lastHintId = msg.hintId;
    if (sendResponse) {
      sendResponse({ success: true });
    }
    return true;
  }
});

