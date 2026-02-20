// Content script that sends context to panel via background
// Handles SPA navigation with mutation observer
// Uses platform adapters loaded from all-adapters.js for multi-platform support

function grabContextFromDom() {
  console.log('[TrailNote] === Starting context capture ===');

  // Use platform adapter system if available
  if (window.__trailNoteAdapters) {
    const ctx = window.__trailNoteAdapters.buildContext();
    if (ctx) {
      console.log(`[TrailNote] Context captured via ${ctx.platformDisplayName} adapter:`, {
        title: ctx.title, tests: ctx.tests?.length, codeLen: ctx.userCode?.length, lang: ctx.codeLanguage
      });
      return ctx;
    }
    console.warn('[TrailNote] Platform detected but adapter returned null context');
  }

  // Fallback: generic context extraction for unsupported platforms
  console.log('[TrailNote] No platform adapter matched — using generic fallback');
  const title = document.querySelector('h1')?.textContent?.trim() || document.title || 'Unknown Page';
  let userCode = '';
  if (window.monaco) {
    try { userCode = window.monaco.editor.getEditors()[0]?.getValue() || ''; } catch (_) {}
  }
  if (!userCode) {
    const ta = document.querySelector('textarea[class*="editor"], textarea[class*="code"]');
    if (ta) userCode = ta.value || '';
  }

  return {
    platform: 'unknown',
    platformDisplayName: 'Unknown Platform',
    platformIcon: '📚',
    contentType: 'mixed',
    title,
    url: location.pathname,
    fullUrl: location.href,
    tests: [],
    failingTests: [],
    userCode: userCode.trim(),
    codeLanguage: 'javascript',
    codeCaptureMethod: 'generic-fallback',
    instruction: '',
    ruleHints: '',
    conceptId: null,
    code_excerpt: userCode.slice(0, 400),
    systemPromptAddition: ''
  };
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

