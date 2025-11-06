// Lightweight DOM-derived hints for TrailNote content scripts
// Injected before content.js so functions are available globally.
(function () {
  function textFromSelectors(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) {
        const txt = el.textContent.trim();
        if (txt.length) {
          return txt.replace(/\s+/g, " ");
        }
      }
    }
    return "";
  }

  function checkAnchorInFirstParagraph() {
    const firstP = document.querySelector('main p, #site-content p, .challenge-instructions p, p');
    if (!firstP) return "";
    const anchor = firstP.querySelector('a');
    if (anchor) {
      return "The first <p> already contains an <a>. Focus on its attributes.";
    }
    return "No <a> found inside the first <p>. Wrap the first paragraph text in an anchor.";
  }

  function ruleHintsFromDom() {
    try {
      const hints = [];
      const anchorHint = checkAnchorInFirstParagraph();
      if (anchorHint) hints.push(anchorHint);
      return hints.join(" ");
    } catch (_e) {
      return "";
    }
  }

  function instructionFromDom() {
    const selectors = [
      '[data-test="challenge-text"]',
      '[data-testid="challenge-text"]',
      '.challenge-instructions',
      '#challenge-description',
      '.instructions',
      '.challenge__content'
    ];
    const raw = textFromSelectors(selectors);
    return raw ? raw.slice(0, 800) : "";
  }

  function codeExcerptFromText(codeText) {
    if (!codeText) return "";
    const trimmed = codeText.trim();
    if (!trimmed) return "";
    const limit = 400;
    return trimmed.length > limit ? trimmed.slice(0, limit) + "\u2026" : trimmed;
  }

  const api = {
    ruleHintsFromDom,
    instructionFromDom,
    codeExcerptFromText
  };

  if (typeof window !== "undefined") {
    window.trailNoteRules = api;
  }
  if (typeof self !== "undefined") {
    self.trailNoteRules = api;
  }
})();


