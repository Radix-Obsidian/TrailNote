// Context collector for freeCodeCamp pages
// Grabs lesson context from DOM with resilient selectors

/**
 * Grab context from freeCodeCamp DOM
 * Uses resilient selectors with fallbacks for challenge pages
 * @returns {Object} - { title, url, tests, userCode }
 */
export function grabContextFromDom() {
  const title =
    (document.querySelector('[data-test*="challenge-title"]')?.textContent) ||
    (document.querySelector('h1,h2')?.textContent) ||
    document.title;

  // collect visible test messages (common patterns; safe fallbacks)
  const testNodes = [
    ...document.querySelectorAll('[class*="test"], [data-testid*="test"], li[class*="fail"], li[class*="error"]')
  ].slice(0, 10);

  const tests = testNodes.map(n => n.textContent.trim()).filter(Boolean);

  // Capture user's code from editor
  let userCode = '';
  
  // Try multiple approaches to find the editor content
  // 1. Monaco editor textarea (most common)
  const monacoTextarea = document.querySelector('.monaco-editor textarea');
  if (monacoTextarea) {
    userCode = monacoTextarea.value || '';
  }
  
  // 2. Direct textarea selectors (fallback)
  if (!userCode) {
    const editorTextarea = document.querySelector('textarea[class*="input"], textarea[class*="editor"], textarea[data-cy="code-editor"]');
    if (editorTextarea) {
      userCode = editorTextarea.value || '';
    }
  }
  
  // 3. Code editor container (monaco editor content)
  if (!userCode) {
    const editorContainer = document.querySelector('[class*="monaco-editor"], [class*="code-editor"], [data-cy="code-editor"]');
    if (editorContainer) {
      // Try to get text from all text nodes
      const walker = document.createTreeWalker(
        editorContainer,
        NodeFilter.SHOW_TEXT,
        null
      );
      let textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text && text.length > 0) {
          textNodes.push(text);
        }
      }
      if (textNodes.length > 0) {
        userCode = textNodes.join('\n');
      }
    }
  }
  
  // 4. Try accessing Monaco editor API if available
  if (!userCode && window.monaco) {
    try {
      const editors = window.monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        userCode = editors[0].getValue() || '';
      }
    } catch (e) {
      // Monaco API not accessible, continue
    }
  }

  const url = location.pathname;
  return { title, url, tests, userCode: userCode.trim() };
}

