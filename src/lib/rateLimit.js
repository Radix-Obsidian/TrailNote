// Rate limiting utilities for TrailNote extension
// Prevents excessive API calls

import { saveData, loadData } from './storage.js';

const RATE_LIMIT_KEY = 'trailnote_rate_limit';
const DEFAULT_LIMIT = 60; // requests per hour
const DEFAULT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if request is within rate limit
 * @param {number} limit - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<boolean>} - True if within limit
 */
export async function checkRateLimit(limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW) {
  try {
    const rateLimitData = await loadData(RATE_LIMIT_KEY) || { requests: [], limit, windowMs };
    
    const now = Date.now();
    
    // Remove requests outside the time window
    rateLimitData.requests = rateLimitData.requests.filter(
      timestamp => now - timestamp < windowMs
    );
    
    // Check if we're at the limit
    if (rateLimitData.requests.length >= limit) {
      return false;
    }
    
    // Add current request
    rateLimitData.requests.push(now);
    await saveData(RATE_LIMIT_KEY, rateLimitData);
    
    return true;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Allow request on error to avoid blocking user
    return true;
  }
}

/**
 * Get remaining requests in current window
 * @param {number} limit - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<number>} - Number of remaining requests
 */
export async function getRemainingRequests(limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW) {
  try {
    const rateLimitData = await loadData(RATE_LIMIT_KEY) || { requests: [], limit, windowMs };
    
    const now = Date.now();
    
    // Remove requests outside the time window
    rateLimitData.requests = rateLimitData.requests.filter(
      timestamp => now - timestamp < windowMs
    );
    
    return Math.max(0, limit - rateLimitData.requests.length);
  } catch (error) {
    console.error('Error getting remaining requests:', error);
    return limit;
  }
}

/**
 * Reset rate limit data
 * @returns {Promise<void>}
 */
export async function resetRateLimit() {
  try {
    await saveData(RATE_LIMIT_KEY, { requests: [], limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW });
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    throw error;
  }
}

