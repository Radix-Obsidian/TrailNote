// Context management for TrailNote extension
// Manages conversation history and context for tutoring sessions

import { saveData, loadData } from './storage.js';
import { estimateTokens, truncateToTokenLimit } from './tokens.js';

const CONTEXT_KEY = 'trailnote_context';
const MAX_CONTEXT_TOKENS = 4000; // Adjust based on API limits

/**
 * Get current conversation context
 * @returns {Promise<Array>} - Array of conversation messages
 */
export async function getContext() {
  try {
    const context = await loadData(CONTEXT_KEY);
    return context || [];
  } catch (error) {
    console.error('Error getting context:', error);
    return [];
  }
}

/**
 * Add message to context
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 * @returns {Promise<void>}
 */
export async function addToContext(role, content) {
  try {
    const context = await getContext();
    context.push({ role, content, timestamp: Date.now() });
    
    // Trim context if it exceeds token limit
    const trimmedContext = await trimContext(context);
    
    await saveData(CONTEXT_KEY, trimmedContext);
  } catch (error) {
    console.error('Error adding to context:', error);
    throw error;
  }
}

/**
 * Clear conversation context
 * @returns {Promise<void>}
 */
export async function clearContext() {
  try {
    await saveData(CONTEXT_KEY, []);
  } catch (error) {
    console.error('Error clearing context:', error);
    throw error;
  }
}

/**
 * Trim context to fit within token limits
 * @param {Array} context - Current context array
 * @returns {Promise<Array>} - Trimmed context
 */
async function trimContext(context) {
  // Calculate total tokens
  let totalTokens = context.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content);
  }, 0);
  
  // Remove oldest messages if over limit
  while (totalTokens > MAX_CONTEXT_TOKENS && context.length > 0) {
    const removed = context.shift();
    totalTokens -= estimateTokens(removed.content);
  }
  
  // If still too long, truncate the first message
  if (totalTokens > MAX_CONTEXT_TOKENS && context.length > 0) {
    const firstMessage = context[0];
    firstMessage.content = truncateToTokenLimit(
      firstMessage.content,
      MAX_CONTEXT_TOKENS - (totalTokens - estimateTokens(firstMessage.content))
    );
  }
  
  return context;
}

