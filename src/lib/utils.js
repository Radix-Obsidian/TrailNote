// HintHopper Utility Functions

/**
 * Creates a simple hash for anonymizing data
 * This is a basic implementation - for production, use a more robust algorithm
 * @param {string} text - Text to hash
 * @return {string} - Hashed string
 */
export function createHash(text) {
  if (!text) return 'empty';
  
  // Simple FNV-1a hash implementation
  let hash = 0x811c9dc5; // FNV offset basis
  const prime = 0x01000193; // FNV prime
  
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, prime);
  }
  
  // Convert to hex string and take first 16 chars
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Sanitizes text to remove sensitive information
 * @param {string} text - Text to sanitize
 * @return {string} - Sanitized text
 */
export function sanitizeText(text) {
  if (!text) return '';
  
  // Remove potential personal identifiers (emails, etc)
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/https?:\/\/[^\s]+/g, '[URL]');
}

/**
 * Creates a short concept ID from text
 * @param {string} text - Text to convert to concept ID
 * @return {string} - Concept ID
 */
export function conceptIdFrom(text) {
  if (!text) return 'unknown';
  
  // Extract key phrases and normalize
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
    
  // For very long texts, take the first 3 words
  if (normalized.length > 30) {
    const words = normalized.split('-');
    return words.slice(0, 3).join('-');
  }
  
  return normalized;
}

/**
 * Generate a unique ID
 * @return {string} - Unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Format time duration in a human-readable form
 * @param {number} minutes - Time in minutes
 * @return {string} - Formatted time string
 */
export function formatDuration(minutes) {
  if (minutes < 1) {
    return 'less than a minute';
  } else if (minutes === 1) {
    return '1 minute';
  } else if (minutes < 60) {
    return `${minutes} minutes`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
  }
}

export default {
  createHash,
  sanitizeText,
  conceptIdFrom,
  generateId,
  formatDuration
};
