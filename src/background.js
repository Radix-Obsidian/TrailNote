// Store context per tab for better reliability
const contextByTab = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const type = msg?.type;
  const tabId = sender?.tab?.id;

  if (type === 'CONTEXT_UPDATE') {
    const ctx = msg.ctx;
    if (tabId) {
      contextByTab.set(tabId, ctx);
    }
    // Also keep global for backward compatibility
    contextByTab.set('global', ctx);
    
    // Broadcast to all panels
    chrome.runtime.sendMessage({ type: 'CONTEXT_PUSH', ctx }).catch(() => {
      // Ignore errors if no panel is listening
    });
    
    if (sendResponse) sendResponse({ success: true });
    return true; // Keep channel open for async response
  }

  if (type === 'CONTEXT_GET' || type === 'CONTEXT_REQUEST') {
    let ctx = null;
    if (tabId && contextByTab.has(tabId)) {
      ctx = contextByTab.get(tabId);
    } else if (contextByTab.has('global')) {
      ctx = contextByTab.get('global');
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
  
  return false;
});

// Clean up context when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  contextByTab.delete(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("TrailNote installed - Version 0.2.0 (auto-refresh enabled)");
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

