/**
 * TrailNote Base Platform Adapter
 * 
 * Abstract base class that all platform adapters extend.
 * Each adapter provides platform-specific DOM selectors, context extraction,
 * concept mapping, and prompt customization.
 */

export class BasePlatformAdapter {
  constructor() {
    if (new.target === BasePlatformAdapter) {
      throw new Error('BasePlatformAdapter is abstract and cannot be instantiated directly');
    }
  }

  /** 
   * Unique platform identifier (e.g. 'freecodecamp', 'udemy')
   * @returns {string}
   */
  get id() { throw new Error('Not implemented'); }

  /**
   * Human-readable display name (e.g. 'freeCodeCamp', 'Udemy')
   * @returns {string}
   */
  get displayName() { throw new Error('Not implemented'); }

  /**
   * Emoji icon for UI display
   * @returns {string}
   */
  get icon() { return '📚'; }

  /**
   * Domain patterns used for detection (e.g. ['freecodecamp.org'])
   * @returns {string[]}
   */
  get domains() { throw new Error('Not implemented'); }

  /**
   * Whether this platform has interactive code exercises
   * @returns {boolean}
   */
  get hasCodeEditor() { return true; }

  /**
   * Whether this platform has automated tests
   * @returns {boolean}
   */
  get hasTests() { return true; }

  /**
   * Primary content type: 'code', 'video', 'quiz', 'mixed'
   * @returns {string}
   */
  get contentType() { return 'code'; }

  /**
   * Detect if the current page belongs to this platform
   * @param {string} url - Current page URL
   * @returns {boolean}
   */
  detect(url) {
    return this.domains.some(domain => url.includes(domain));
  }

  /**
   * Extract the challenge/lesson title from the DOM
   * @returns {string|null}
   */
  getTitle() {
    // Generic fallback: try common selectors
    const selectors = ['h1', '.title', 'h2', 'title'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return document.title || null;
  }

  /**
   * Extract the user's current code from the editor
   * @returns {{ code: string, method: string }}
   */
  getCode() {
    // Generic fallback: try Monaco, then textareas
    if (window.monaco) {
      try {
        const editors = window.monaco.editor.getEditors();
        if (editors && editors.length > 0) {
          return { code: editors[0].getValue() || '', method: 'monaco-api' };
        }
      } catch (_) {}
    }

    const textarea = document.querySelector('textarea[class*="editor"], textarea[class*="input"]');
    if (textarea && textarea.value) {
      return { code: textarea.value, method: 'generic-textarea' };
    }

    return { code: '', method: 'none' };
  }

  /**
   * Extract failing tests or quiz questions from the DOM
   * @returns {string[]}
   */
  getTests() {
    return [];
  }

  /**
   * Extract the challenge instruction/description
   * @returns {string}
   */
  getInstruction() {
    return '';
  }

  /**
   * Derive a concept ID from the current page context
   * @returns {string|null}
   */
  getConceptId() {
    const path = location.pathname || '';
    return path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').substring(0, 40).toLowerCase() || null;
  }

  /**
   * Detect the programming language of the current exercise
   * @returns {string}
   */
  getCodeLanguage() {
    return 'html';
  }

  /**
   * Get platform-specific additions to the LLM system prompt
   * @returns {string}
   */
  getSystemPromptAddition() {
    return `The learner is studying on ${this.displayName}.`;
  }

  /**
   * Get rule hints from the DOM (platform-specific learning rules)
   * @returns {string}
   */
  getRuleHints() {
    return '';
  }

  /**
   * Build the full unified context object for this platform
   * @returns {Object}
   */
  buildContext() {
    const { code, method } = this.getCode();
    const tests = this.getTests();
    const title = this.getTitle();
    const instruction = this.getInstruction();
    const ruleHints = this.getRuleHints();

    return {
      platform: this.id,
      platformDisplayName: this.displayName,
      platformIcon: this.icon,
      contentType: this.contentType,
      title,
      url: location.pathname,
      fullUrl: location.href,
      tests,
      failingTests: tests,
      userCode: code.trim(),
      codeLanguage: this.getCodeLanguage(),
      codeCaptureMethod: method,
      instruction,
      ruleHints,
      conceptId: this.getConceptId(),
      code_excerpt: code.slice(0, 400)
    };
  }
}

export default BasePlatformAdapter;
