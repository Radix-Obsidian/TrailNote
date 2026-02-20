/**
 * TrailNote Platform Registry
 * 
 * Detects the active learning platform from the current URL and returns
 * the appropriate adapter. Used by content.js to route context extraction
 * to the correct platform-specific logic.
 * 
 * NOTE: This file is designed to work in content script context (no ES module imports).
 * Adapters are loaded inline since MV3 content scripts don't support dynamic import().
 */

const PLATFORM_CONFIGS = [
  {
    id: 'freecodecamp',
    displayName: 'freeCodeCamp',
    icon: '🔥',
    domains: ['freecodecamp.org'],
    contentType: 'code',
    hasCodeEditor: true,
    hasTests: true
  },
  {
    id: 'udemy',
    displayName: 'Udemy',
    icon: '🎓',
    domains: ['udemy.com'],
    contentType: 'mixed',
    hasCodeEditor: false,
    hasTests: true
  },
  {
    id: 'codecademy',
    displayName: 'Codecademy',
    icon: '💻',
    domains: ['codecademy.com'],
    contentType: 'code',
    hasCodeEditor: true,
    hasTests: true
  },
  {
    id: 'scrimba',
    displayName: 'Scrimba',
    icon: '🎬',
    domains: ['scrimba.com'],
    contentType: 'mixed',
    hasCodeEditor: true,
    hasTests: false
  },
  {
    id: 'coursera',
    displayName: 'Coursera',
    icon: '📘',
    domains: ['coursera.org'],
    contentType: 'mixed',
    hasCodeEditor: false,
    hasTests: true
  },
  {
    id: 'khan-academy',
    displayName: 'Khan Academy',
    icon: '🏫',
    domains: ['khanacademy.org'],
    contentType: 'mixed',
    hasCodeEditor: true,
    hasTests: false
  },
  {
    id: 'leetcode',
    displayName: 'LeetCode',
    icon: '🧩',
    domains: ['leetcode.com'],
    contentType: 'code',
    hasCodeEditor: true,
    hasTests: true
  },
  {
    id: 'hackerrank',
    displayName: 'HackerRank',
    icon: '⚡',
    domains: ['hackerrank.com'],
    contentType: 'code',
    hasCodeEditor: true,
    hasTests: true
  }
];

/**
 * Detect which platform the current URL belongs to
 * @param {string} url - Full page URL
 * @returns {Object|null} Platform config or null if unrecognized
 */
function detectPlatform(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const config of PLATFORM_CONFIGS) {
    for (const domain of config.domains) {
      if (lower.includes(domain)) {
        return config;
      }
    }
  }
  return null;
}

/**
 * Get all supported platform domain patterns (for manifest or URL matching)
 * @returns {string[]}
 */
function getAllDomainPatterns() {
  const patterns = [];
  for (const config of PLATFORM_CONFIGS) {
    for (const domain of config.domains) {
      patterns.push(`*://*.${domain}/*`);
      patterns.push(`*://${domain}/*`);
    }
  }
  return patterns;
}

/**
 * Get all supported platforms for settings UI
 * @returns {Array<{id: string, displayName: string, icon: string}>}
 */
function getAllPlatforms() {
  return PLATFORM_CONFIGS.map(c => ({ id: c.id, displayName: c.displayName, icon: c.icon }));
}

// Export for both content script (global) and ES module contexts
if (typeof window !== 'undefined') {
  window.__trailNotePlatformRegistry = { detectPlatform, getAllDomainPatterns, getAllPlatforms, PLATFORM_CONFIGS };
}

// For ES module imports (panel-v2.js, tutor.js, etc.)
export { detectPlatform, getAllDomainPatterns, getAllPlatforms, PLATFORM_CONFIGS };
