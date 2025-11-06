// Store context per tab for better reliability
const contextByTab = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const type = msg?.type;
  const tabId = sender?.tab?.id;

  if (type === 'CONTEXT_UPDATE') {
    const ctx = msg.ctx;
    if (tabId) {
      console.log(`[HintHopper BG] Storing context for tab ${tabId}`, {
        title: ctx.title,
        testsCount: ctx.tests?.length || 0,
        codeLength: ctx.userCode?.length || 0,
        ruleHints: ctx.ruleHints || ''
      });
      contextByTab.set(tabId, ctx);
    }
    // Also keep global for backward compatibility
    contextByTab.set('global', ctx);
    
    // Broadcast to all panels
    console.log('[HintHopper BG] Broadcasting context update to panels');
    chrome.runtime.sendMessage({ type: 'CONTEXT_PUSH', ctx }).catch((error) => {
      console.log('[HintHopper BG] Error broadcasting context (expected if no panel is open):', error?.message);
      // Ignore errors if no panel is listening
    });
    
    if (sendResponse) sendResponse({ success: true });
    return true; // Keep channel open for async response
  }

  if (type === 'CONTEXT_GET' || type === 'CONTEXT_REQUEST') {
    console.log(`[HintHopper BG] Received context request from ${tabId ? 'tab ' + tabId : 'panel'}`);
    
    let ctx = null;
    if (tabId && contextByTab.has(tabId)) {
      ctx = contextByTab.get(tabId);
      console.log(`[HintHopper BG] Found context for tab ${tabId}`);
    } else if (contextByTab.has('global')) {
      ctx = contextByTab.get('global');
      console.log('[HintHopper BG] Using global context (no tab match)');
    }
    
    if (ctx) {
      console.log('[HintHopper BG] Returning context:', {
        title: ctx.title,
        testsCount: ctx.tests?.length || 0,
        codeLength: ctx.userCode?.length || 0,
        ruleHints: ctx.ruleHints || ''
      });
    } else {
      console.log('[HintHopper BG] No context available');
    }
    
    if (sendResponse) {
      sendResponse({ ctx });
    }
    return true;
  }

  // Relay DEBUG_TUTOR messages to panels
  if (type === 'DEBUG_TUTOR') {
    chrome.runtime.sendMessage({ type: 'DEBUG_TUTOR', debugPayload: msg.debugPayload }).catch(() => {});
  }
  
  // Handle test pass events
  if (type === 'TEST_PASSED' && msg.hintId) {
    console.log(`[HintHopper BG] Received test pass for hint ${msg.hintId}`);
    
    // Add any A/B testing metadata that was provided
    const payload = { 
      type: 'TEST_PASSED', 
      hintId: msg.hintId 
    };
    
    if (msg.abTesting) {
      payload.abTesting = msg.abTesting;
    }
    
    // Relay to panel to track in outcome tracker
    chrome.runtime.sendMessage(payload).catch((err) => {
      console.log('[HintHopper BG] Error relaying test pass (expected if no panel is open):', err?.message);
      // Ignore errors if no panel is listening
    });
  }
  
  return false;
});

// Clean up context when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  contextByTab.delete(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("HintHopper installed - Version 0.2.0 (auto-refresh enabled)");
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

