// Storage utilities for TrailNote extension
// Uses Chrome storage API for persistent data

/**
 * Save data to Chrome storage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {Promise<void>}
 */
export async function saveData(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error('Error saving data:', error);
    throw error;
  }
}

/**
 * Load data from Chrome storage
 * @param {string} key - Storage key
 * @returns {Promise<any>} - Stored value or null if not found
 */
export async function loadData(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
}

/**
 * Remove data from Chrome storage
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
export async function removeData(key) {
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error('Error removing data:', error);
    throw error;
  }
}

/**
 * Clear all storage data
 * @returns {Promise<void>}
 */
export async function clearStorage() {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw error;
  }
}

