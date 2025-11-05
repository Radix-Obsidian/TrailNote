// Token management utilities for TrailNote extension
// Handles token counting and limits for API usage

/**
 * Estimate token count for a text string
 * Rough approximation: 1 token ≈ 4 characters
 * @param {string} text - Text to count tokens for
 * @returns {number} - Estimated token count
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Check if token count exceeds limit
 * @param {string} text - Text to check
 * @param {number} maxTokens - Maximum allowed tokens
 * @returns {boolean} - True if within limit
 */
export function isWithinTokenLimit(text, maxTokens) {
  return estimateTokens(text) <= maxTokens;
}

/**
 * Truncate text to fit within token limit
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum allowed tokens
 * @returns {string} - Truncated text
 */
export function truncateToTokenLimit(text, maxTokens) {
  const maxChars = maxTokens * 4; // Approximate character limit
  if (text.length <= maxChars) {
    return text;
  }
  return text.substring(0, maxChars) + '...';
}

/**
 * Get token count for multiple strings
 * @param {string[]} texts - Array of text strings
 * @returns {number} - Total token count
 */
export function getTotalTokens(texts) {
  return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

