/**
 * TrailNote Platform Adapters (Content Script Bundle)
 * 
 * All platform-specific context extraction logic in one file.
 * Loaded as a content script before content.js.
 * MV3 content scripts don't support ES modules, so this is plain JS.
 * 
 * Each adapter provides: getTitle, getCode, getTests, getInstruction,
 * getConceptId, getCodeLanguage, getSystemPromptAddition
 */

(function() {
  'use strict';

  // === Platform Detection ===
  const PLATFORMS = [
    { id: 'freecodecamp', domains: ['freecodecamp.org'], displayName: 'freeCodeCamp', icon: '🔥', contentType: 'code' },
    { id: 'udemy',        domains: ['udemy.com'],        displayName: 'Udemy',        icon: '🎓', contentType: 'mixed' },
    { id: 'codecademy',   domains: ['codecademy.com'],   displayName: 'Codecademy',   icon: '💻', contentType: 'code' },
    { id: 'scrimba',      domains: ['scrimba.com'],      displayName: 'Scrimba',      icon: '🎬', contentType: 'mixed' },
    { id: 'coursera',     domains: ['coursera.org'],     displayName: 'Coursera',     icon: '📘', contentType: 'mixed' },
    { id: 'khan-academy', domains: ['khanacademy.org'],  displayName: 'Khan Academy', icon: '🏫', contentType: 'mixed' },
    { id: 'leetcode',     domains: ['leetcode.com'],     displayName: 'LeetCode',     icon: '🧩', contentType: 'code' },
    { id: 'hackerrank',   domains: ['hackerrank.com'],   displayName: 'HackerRank',   icon: '⚡', contentType: 'code' },
  ];

  function detectPlatform(url) {
    const lower = (url || '').toLowerCase();
    for (const p of PLATFORMS) {
      if (p.domains.some(d => lower.includes(d))) return p;
    }
    return null;
  }

  // === Helpers ===
  function textOf(sel) {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : '';
  }

  function allTextOf(sel) {
    return Array.from(document.querySelectorAll(sel))
      .map(el => el.textContent.trim())
      .filter(t => t.length > 3);
  }

  function uniqueArray(arr) { return [...new Set(arr)]; }

  function slugify(text, maxLen) {
    return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, maxLen || 40);
  }

  // Try Monaco editor API
  function tryMonaco() {
    if (window.monaco) {
      try {
        const editors = window.monaco.editor.getEditors();
        if (editors && editors.length > 0) return { code: editors[0].getValue() || '', method: 'monaco-api' };
      } catch (_) {}
    }
    // Monaco textarea fallback
    const ta = document.querySelector('.monaco-editor textarea, textarea.inputarea');
    if (ta && ta.value) return { code: ta.value, method: 'monaco-textarea' };
    return null;
  }

  // Try ACE editor
  function tryAce() {
    if (window.ace) {
      try {
        const editor = window.ace.edit(document.querySelector('.ace_editor'));
        if (editor) return { code: editor.getValue() || '', method: 'ace-api' };
      } catch (_) {}
    }
    const aceEl = document.querySelector('.ace_editor');
    if (aceEl && aceEl.env && aceEl.env.editor) {
      try { return { code: aceEl.env.editor.getValue(), method: 'ace-env' }; } catch (_) {}
    }
    return null;
  }

  // Try CodeMirror
  function tryCodeMirror() {
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      try { return { code: cmEl.CodeMirror.getValue(), method: 'codemirror-api' }; } catch (_) {}
    }
    // CM6
    const cm6 = document.querySelector('.cm-editor .cm-content');
    if (cm6) return { code: cm6.textContent || '', method: 'codemirror6-dom' };
    return null;
  }

  // Generic textarea fallback
  function tryTextarea() {
    const selectors = [
      'textarea[class*="editor"]', 'textarea[class*="code"]', 'textarea[class*="input"]',
      '#editor textarea', '[data-cy="editor"] textarea', '.editor-container textarea'
    ];
    for (const sel of selectors) {
      const ta = document.querySelector(sel);
      if (ta && ta.value) return { code: ta.value, method: 'textarea:' + sel };
    }
    return null;
  }

  // Try iframes for code editors
  function tryIframes() {
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          // Monaco in iframe
          if (iframe.contentWindow?.monaco) {
            const eds = iframe.contentWindow.monaco.editor.getEditors();
            if (eds && eds.length > 0) return { code: eds[0].getValue() || '', method: 'iframe-monaco' };
          }
          // Textarea in iframe
          const ta = doc.querySelector('.monaco-editor textarea, textarea');
          if (ta && ta.value) return { code: ta.value, method: 'iframe-textarea' };
          // ACE in iframe
          const aceEl = doc.querySelector('.ace_editor');
          if (aceEl?.env?.editor) return { code: aceEl.env.editor.getValue(), method: 'iframe-ace' };
          // CodeMirror in iframe
          const cmEl = doc.querySelector('.CodeMirror');
          if (cmEl?.CodeMirror) return { code: cmEl.CodeMirror.getValue(), method: 'iframe-cm' };
        } catch (_) { /* cross-origin, skip */ }
      }
    } catch (_) {}
    return null;
  }

  // Monaco visible lines fallback
  function tryMonacoViewLines() {
    const container = document.querySelector('.monaco-editor .view-lines');
    if (container) {
      const lines = Array.from(container.querySelectorAll('.view-line')).map(l => l.textContent || '');
      if (lines.length > 0) return { code: lines.join('\n'), method: 'monaco-view-lines' };
    }
    return null;
  }

  function getCodeGeneric() {
    return tryMonaco() || tryAce() || tryCodeMirror() || tryIframes() || tryTextarea() || tryMonacoViewLines() || { code: '', method: 'none' };
  }

  // =====================================================================
  // === freeCodeCamp Adapter ===
  // =====================================================================
  const fccAdapter = {
    getTitle() {
      const sels = ['h1', '.title', '.challenge-title', '[class*="title"]', '[data-test*="challenge-title"]', '[class*="Challenge"]', 'h2'];
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) return el.textContent.trim();
      }
      return document.title || 'freeCodeCamp Challenge';
    },

    getCode() {
      // FCC-specific selectors first
      const fccSels = ['#editor textarea', '[data-cy="editor"] textarea', '.editor-container textarea',
                       '.code-editor textarea', 'div[role="code"] textarea', '[class*="Editor"] textarea'];
      const result = tryMonaco() || tryIframes();
      if (result && result.code) return result;
      for (const sel of fccSels) {
        const ta = document.querySelector(sel);
        if (ta && ta.value) return { code: ta.value, method: 'fcc:' + sel };
      }
      return tryTextarea() || tryMonacoViewLines() || { code: '', method: 'none' };
    },

    getTests() {
      const testSels = ['[class*="test"]', '[data-testid*="test"]', 'li[class*="fail"]', 'li[class*="error"]',
                        'li[class*="pass"]', '[class*="console"]', '[class*="output"]', '[class*="test-output"]',
                        '[class*="test-result"]', '[id*="test"]', 'pre', 'code[class*="test"]'];
      const placeholders = [/Your test output will go here/i, /\/\*\*[\s\S]*?test output[\s\S]*?\*\//i,
                            /^\s*\/\/\s*running tests\s*$/i, /^\s*\/\/\s*tests completed\s*$/i, /^\s*$/];
      const nodes = [];
      for (const sel of testSels) {
        document.querySelectorAll(sel).forEach(n => nodes.push(n));
      }
      // Pattern-based extraction from body text
      const allText = document.body.innerText || '';
      const patterns = [/Test Failed[^\n]*/gi, /There should be[^\n]*/gi, /The \w+ should[^\n]*/gi,
                        /Your \w+ should[^\n]*/gi, /Hint[^\n]*/gi, /Sorry[^\n]*Keep trying[^\n]*/gi];
      for (const pat of patterns) {
        const matches = allText.match(pat);
        if (matches) matches.forEach(m => { if (m.trim().length > 10 && m.trim().length < 500) nodes.push({ textContent: m.trim() }); });
      }
      const tests = nodes.map(n => n.textContent.trim())
        .filter(t => t && t.length >= 3 && !placeholders.some(p => p.test(t)))
        .filter(t => /test|fail|error|should|hint|sorry|expected|wrap|add|create|element|attribute/i.test(t) || t.length > 20);
      return uniqueArray(tests);
    },

    getInstruction() {
      const rulesApi = window.trailNoteRules;
      return rulesApi?.instructionFromDom ? rulesApi.instructionFromDom() : '';
    },

    getRuleHints() {
      const rulesApi = window.trailNoteRules;
      return rulesApi?.ruleHintsFromDom ? rulesApi.ruleHintsFromDom() : '';
    },

    getConceptId() {
      const path = location.pathname || '';
      const match = path.match(/\/learn\/([^/]+)\/([^/]+)/);
      if (match) return slugify(match[1] + '-' + match[2], 40);
      return slugify(path, 40);
    },

    getCodeLanguage() {
      const url = location.pathname || '';
      if (url.includes('javascript') || url.includes('/js/')) return 'javascript';
      if (url.includes('python')) return 'python';
      if (url.includes('css')) return 'css';
      return 'html';
    },

    getSystemPromptAddition() {
      return 'The learner is on freeCodeCamp, a free coding curriculum with interactive challenges. Focus on the specific test requirements.';
    }
  };

  // =====================================================================
  // === Udemy Adapter ===
  // =====================================================================
  const udemyAdapter = {
    getTitle() {
      // Lecture title
      const lectureTitle = textOf('[data-purpose="lecture-title"], .ud-heading-xl, [class*="lecture-title"], h1[class*="udlite-heading"]');
      if (lectureTitle) return lectureTitle;
      // Course title
      const courseTitle = textOf('[data-purpose="course-title"], h1.clp-lead__title, .ud-heading-xxl');
      if (courseTitle) return courseTitle;
      return document.title.replace(/ \| Udemy$/i, '').trim() || 'Udemy Lecture';
    },

    getCode() {
      // Udemy coding exercises
      return tryMonaco() || tryAce() || tryCodeMirror() || tryIframes() || tryTextarea() || { code: '', method: 'none' };
    },

    getTests() {
      const tests = [];
      // Quiz questions
      document.querySelectorAll('[data-purpose="quiz-question"], .ud-quiz-question, [class*="quiz-question"], [class*="assessment-question"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 5) tests.push(t);
      });
      // Coding exercise output
      document.querySelectorAll('[data-purpose="output-pane"], [class*="output"], [class*="test-result"], [class*="console"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 5 && !tests.includes(t)) tests.push(t);
      });
      return uniqueArray(tests);
    },

    getInstruction() {
      // Lecture description / exercise instructions
      return textOf('[data-purpose="lecture-description"], [class*="exercise-instruction"], [class*="coding-exercise-description"]');
    },

    getRuleHints() { return ''; },

    getConceptId() {
      const path = location.pathname || '';
      const match = path.match(/\/course\/([^/]+)\/learn\/lecture\/(\d+)/);
      if (match) return slugify('udemy-' + match[1] + '-' + match[2], 40);
      return slugify('udemy-' + path, 40);
    },

    getCodeLanguage() {
      const title = (document.title || '').toLowerCase();
      const body = (document.body?.innerText || '').substring(0, 2000).toLowerCase();
      if (title.includes('python') || body.includes('python')) return 'python';
      if (title.includes('javascript') || body.includes('javascript')) return 'javascript';
      if (title.includes('react') || body.includes('react')) return 'jsx';
      if (title.includes('java') || body.includes('java ')) return 'java';
      if (title.includes('c++') || body.includes('c++')) return 'cpp';
      return 'javascript';
    },

    getSystemPromptAddition() {
      return 'The learner is on Udemy, a video-based course platform. They may be working through a lecture, coding exercise, or quiz. Help them understand the concepts being taught.';
    }
  };

  // =====================================================================
  // === Codecademy Adapter ===
  // =====================================================================
  const codecademyAdapter = {
    getTitle() {
      const title = textOf('.lesson-header__title, [class*="exerciseTitle"], .gamut-1tk3mbm, h1[class*="Title"], [data-testid="exercise-title"]');
      if (title) return title;
      return document.title.replace(/ \| Codecademy$/i, '').trim() || 'Codecademy Exercise';
    },

    getCode() {
      // Codecademy uses Monaco and ACE at different times
      return tryMonaco() || tryAce() || tryIframes() || tryTextarea() || { code: '', method: 'none' };
    },

    getTests() {
      const tests = [];
      // Checkpoint results
      document.querySelectorAll('[class*="checkpoint"], [class*="test-result"], [class*="error-message"], [data-testid*="checkpoint"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 5) tests.push(t);
      });
      // Instructions that contain "should" or test-like language
      document.querySelectorAll('.gamut-yj8jvy, [class*="instruction"], [class*="narrative"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 10 && /should|must|create|add|set|define|make|write/i.test(t)) tests.push(t);
      });
      // Console output
      const consoleOutput = textOf('[class*="terminal"], [class*="console-output"], [class*="output"]');
      if (consoleOutput && /error|fail|exception/i.test(consoleOutput)) tests.push(consoleOutput);
      return uniqueArray(tests);
    },

    getInstruction() {
      return textOf('[class*="narrative"], .gamut-yj8jvy, [data-testid="exercise-narrative"], [class*="exercise-description"]');
    },

    getRuleHints() {
      return textOf('[class*="hint"], [data-testid="hint"]');
    },

    getConceptId() {
      const path = location.pathname || '';
      const match = path.match(/\/courses\/([^/]+)\/lessons\/([^/]+)/);
      if (match) return slugify('cc-' + match[1] + '-' + match[2], 40);
      const pathMatch = path.match(/\/paths\/([^/]+)/);
      if (pathMatch) return slugify('cc-path-' + pathMatch[1], 40);
      return slugify('cc-' + path, 40);
    },

    getCodeLanguage() {
      const path = (location.pathname || '').toLowerCase();
      const title = (document.title || '').toLowerCase();
      if (path.includes('python') || title.includes('python')) return 'python';
      if (path.includes('javascript') || title.includes('javascript')) return 'javascript';
      if (path.includes('html') || title.includes('html')) return 'html';
      if (path.includes('css') || title.includes('css')) return 'css';
      if (path.includes('ruby') || title.includes('ruby')) return 'ruby';
      if (path.includes('sql') || title.includes('sql')) return 'sql';
      if (path.includes('java') || title.includes('java')) return 'java';
      return 'javascript';
    },

    getSystemPromptAddition() {
      return 'The learner is on Codecademy, an interactive coding platform with step-by-step exercises and checkpoints. Guide them through the current exercise step.';
    }
  };

  // =====================================================================
  // === Scrimba Adapter ===
  // =====================================================================
  const scrimbaAdapter = {
    getTitle() {
      const title = textOf('[class*="scrim-title"], .title, h1, [class*="lesson-title"]');
      if (title) return title;
      return document.title.replace(/ - Scrimba$/i, '').trim() || 'Scrimba Lesson';
    },

    getCode() {
      // Scrimba uses CodeMirror in its player
      return tryCodeMirror() || tryMonaco() || tryIframes() || tryTextarea() || { code: '', method: 'none' };
    },

    getTests() {
      const tests = [];
      // Scrimba challenges / task descriptions
      document.querySelectorAll('[class*="challenge"], [class*="task"], [class*="instruction"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 10) tests.push(t);
      });
      // Console output
      const output = textOf('[class*="console"], [class*="output"], [class*="result"]');
      if (output && output.length > 5) tests.push(output);
      return uniqueArray(tests);
    },

    getInstruction() {
      return textOf('[class*="task-description"], [class*="challenge-description"], [class*="lesson-description"]');
    },

    getRuleHints() { return ''; },

    getConceptId() {
      const path = location.pathname || '';
      return slugify('scrimba-' + path, 40);
    },

    getCodeLanguage() {
      const title = (document.title || '').toLowerCase();
      if (title.includes('react') || title.includes('jsx')) return 'jsx';
      if (title.includes('css')) return 'css';
      if (title.includes('python')) return 'python';
      return 'javascript';
    },

    getSystemPromptAddition() {
      return 'The learner is on Scrimba, an interactive screencast platform where they can pause and edit the instructor\'s code. Help them understand and modify the code in context.';
    }
  };

  // =====================================================================
  // === Coursera Adapter ===
  // =====================================================================
  const courseraAdapter = {
    getTitle() {
      const title = textOf('[data-testid="item-name"], h1[class*="title"], .rc-ItemPageHeader h1, [class*="lesson-name"]');
      if (title) return title;
      return document.title.replace(/ \| Coursera$/i, '').trim() || 'Coursera Lesson';
    },

    getCode() {
      // Coursera labs use Jupyter-style or Monaco
      return tryMonaco() || tryCodeMirror() || tryIframes() || tryTextarea() || { code: '', method: 'none' };
    },

    getTests() {
      const tests = [];
      // Quiz questions
      document.querySelectorAll('.rc-FormPart, [class*="quiz-question"], [class*="QuizQuestion"], [data-testid*="question"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 10) tests.push(t);
      });
      // Graded assignment feedback
      document.querySelectorAll('[class*="feedback"], [class*="grading"], [class*="submission-result"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 5) tests.push(t);
      });
      return uniqueArray(tests);
    },

    getInstruction() {
      return textOf('.rc-ExpandableText, [class*="item-page-content"], [class*="reading-content"], [class*="lecture-description"]');
    },

    getRuleHints() { return ''; },

    getConceptId() {
      const path = location.pathname || '';
      const match = path.match(/\/learn\/([^/]+)\/([^/]+)\/([^/]+)/);
      if (match) return slugify('coursera-' + match[1] + '-' + match[3], 40);
      return slugify('coursera-' + path, 40);
    },

    getCodeLanguage() {
      const title = (document.title || '').toLowerCase();
      if (title.includes('python')) return 'python';
      if (title.includes('javascript')) return 'javascript';
      if (title.includes('machine learning') || title.includes('data science')) return 'python';
      if (title.includes('java')) return 'java';
      return 'python'; // Most Coursera coding is Python
    },

    getSystemPromptAddition() {
      return 'The learner is on Coursera, a university-style online course platform. They may be working through lectures, quizzes, or programming assignments. Provide academic-quality explanations.';
    }
  };

  // =====================================================================
  // === Khan Academy Adapter ===
  // =====================================================================
  const khanAdapter = {
    getTitle() {
      const title = textOf('[data-test-id="exercise-title"], .exerciseTitle, h1');
      if (title) return title;
      return document.title.replace(/ \| Khan Academy$/i, '').trim() || 'Khan Academy Exercise';
    },

    getCode() {
      // Khan Academy uses ACE and custom editors
      return tryAce() || tryCodeMirror() || tryIframes() || tryTextarea() || { code: '', method: 'none' };
    },

    getTests() {
      const tests = [];
      document.querySelectorAll('[class*="task"], [class*="hint"], [class*="output"], [class*="error"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 5) tests.push(t);
      });
      return uniqueArray(tests);
    },

    getInstruction() {
      return textOf('[class*="exercise-description"], [class*="tutorial-content"], [data-test-id="exercise-content"]');
    },

    getRuleHints() { return ''; },

    getConceptId() {
      const path = location.pathname || '';
      return slugify('khan-' + path, 40);
    },

    getCodeLanguage() {
      const title = (document.title || '').toLowerCase();
      if (title.includes('sql')) return 'sql';
      if (title.includes('python')) return 'python';
      if (title.includes('html') || title.includes('css')) return 'html';
      return 'javascript';
    },

    getSystemPromptAddition() {
      return 'The learner is on Khan Academy, an educational platform with interactive exercises. Provide clear, step-by-step explanations suitable for self-paced learning.';
    }
  };

  // =====================================================================
  // === LeetCode Adapter ===
  // =====================================================================
  const leetcodeAdapter = {
    getTitle() {
      const title = textOf('[data-cy="question-title"], h4[class*="title"], [class*="css-v3d350"]');
      if (title) return title;
      return document.title.replace(/ - LeetCode$/i, '').trim() || 'LeetCode Problem';
    },

    getCode() {
      return tryMonaco() || tryCodeMirror() || tryIframes() || tryTextarea() || { code: '', method: 'none' };
    },

    getTests() {
      const tests = [];
      // Test case inputs/outputs
      document.querySelectorAll('[data-cy*="testcase"], [class*="testcase"], [class*="result"], [class*="output"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 3) tests.push(t);
      });
      // Problem constraints
      document.querySelectorAll('[class*="constraint"], pre').forEach(el => {
        const t = el.textContent.trim();
        if (t.includes('Input') || t.includes('Output') || t.includes('Example')) tests.push(t);
      });
      return uniqueArray(tests);
    },

    getInstruction() {
      return textOf('[class*="question-content"], [data-cy="question-content"], [class*="content__u3I1"]');
    },

    getRuleHints() { return ''; },

    getConceptId() {
      const path = location.pathname || '';
      const match = path.match(/\/problems\/([^/]+)/);
      if (match) return slugify('lc-' + match[1], 40);
      return slugify('lc-' + path, 40);
    },

    getCodeLanguage() {
      // Try to detect from language selector
      const langSel = textOf('[class*="language-selector"], [data-cy="lang-select"], button[class*="lang"]');
      if (langSel) {
        const l = langSel.toLowerCase();
        if (l.includes('python')) return 'python';
        if (l.includes('java') && !l.includes('javascript')) return 'java';
        if (l.includes('javascript') || l.includes('js')) return 'javascript';
        if (l.includes('c++') || l.includes('cpp')) return 'cpp';
        if (l.includes('typescript')) return 'typescript';
        if (l.includes('go')) return 'go';
        if (l.includes('rust')) return 'rust';
      }
      return 'javascript';
    },

    getSystemPromptAddition() {
      return 'The learner is on LeetCode, a competitive programming and interview preparation platform. Focus on algorithm design, time/space complexity, and edge cases. Never give the full solution.';
    }
  };

  // =====================================================================
  // === HackerRank Adapter ===
  // =====================================================================
  const hackerrankAdapter = {
    getTitle() {
      const title = textOf('.challenge-name, h2.hr-heading, [class*="challenge-title"]');
      if (title) return title;
      return document.title.replace(/ \| HackerRank$/i, '').trim() || 'HackerRank Challenge';
    },

    getCode() {
      return tryMonaco() || tryAce() || tryCodeMirror() || tryIframes() || tryTextarea() || { code: '', method: 'none' };
    },

    getTests() {
      const tests = [];
      document.querySelectorAll('[class*="test-case"], [class*="sample-input"], [class*="sample-output"], [class*="expected-output"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 3) tests.push(t);
      });
      document.querySelectorAll('.challenge-body-html pre, .challenge-sample pre').forEach(el => {
        tests.push(el.textContent.trim());
      });
      return uniqueArray(tests.filter(t => t.length > 2));
    },

    getInstruction() {
      return textOf('.challenge-body-html, [class*="challenge-description"], .problem-statement');
    },

    getRuleHints() { return ''; },

    getConceptId() {
      const path = location.pathname || '';
      const match = path.match(/\/challenges\/([^/]+)/);
      if (match) return slugify('hr-' + match[1], 40);
      return slugify('hr-' + path, 40);
    },

    getCodeLanguage() {
      const langEl = textOf('[class*="select-language"], .hr-language-selector, [id*="language"]');
      if (langEl) {
        const l = langEl.toLowerCase();
        if (l.includes('python')) return 'python';
        if (l.includes('java') && !l.includes('javascript')) return 'java';
        if (l.includes('javascript')) return 'javascript';
        if (l.includes('c++')) return 'cpp';
      }
      return 'javascript';
    },

    getSystemPromptAddition() {
      return 'The learner is on HackerRank, a skills assessment and coding practice platform. Help them understand the problem constraints and guide toward an efficient solution without giving it away.';
    }
  };

  // =====================================================================
  // === Adapter Registry ===
  // =====================================================================
  const ADAPTERS = {
    'freecodecamp': fccAdapter,
    'udemy': udemyAdapter,
    'codecademy': codecademyAdapter,
    'scrimba': scrimbaAdapter,
    'coursera': courseraAdapter,
    'khan-academy': khanAdapter,
    'leetcode': leetcodeAdapter,
    'hackerrank': hackerrankAdapter
  };

  /**
   * Get the adapter for the current page
   * @returns {{ platform: Object, adapter: Object } | null}
   */
  function getActiveAdapter() {
    const platform = detectPlatform(location.href);
    if (!platform) return null;
    const adapter = ADAPTERS[platform.id];
    if (!adapter) return null;
    return { platform, adapter };
  }

  /**
   * Build unified context using the detected platform adapter
   * @returns {Object} Unified context object
   */
  function buildContext() {
    const active = getActiveAdapter();
    if (!active) {
      console.log('[TrailNote] No supported platform detected at', location.href);
      return null;
    }

    const { platform, adapter } = active;
    const { code, method } = adapter.getCode();
    const tests = adapter.getTests();
    const title = adapter.getTitle();
    const instruction = adapter.getInstruction();
    const ruleHints = adapter.getRuleHints();

    // Add rule hints as synthetic test if no tests found
    if (tests.length === 0 && ruleHints) {
      tests.push(ruleHints);
    }

    const ctx = {
      platform: platform.id,
      platformDisplayName: platform.displayName,
      platformIcon: platform.icon,
      contentType: platform.contentType,
      title,
      url: location.pathname,
      fullUrl: location.href,
      tests: tests,
      failingTests: tests,
      userCode: (code || '').trim(),
      codeLanguage: adapter.getCodeLanguage(),
      codeCaptureMethod: method,
      instruction,
      ruleHints,
      conceptId: adapter.getConceptId(),
      code_excerpt: (code || '').slice(0, 400),
      systemPromptAddition: adapter.getSystemPromptAddition()
    };

    console.log(`[TrailNote] Context built for ${platform.displayName}:`, {
      title: ctx.title, tests: ctx.tests.length, codeLen: ctx.userCode.length, lang: ctx.codeLanguage, method
    });

    return ctx;
  }

  // Expose to global scope for content.js
  window.__trailNoteAdapters = {
    detectPlatform,
    getActiveAdapter,
    buildContext,
    PLATFORMS,
    ADAPTERS
  };

  console.log('[TrailNote] Platform adapters loaded. Supported:', PLATFORMS.map(p => p.displayName).join(', '));
})();
