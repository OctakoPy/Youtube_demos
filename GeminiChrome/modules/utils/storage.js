/**
 * Storage management utilities for Chrome storage API
 */

class StorageManager {
  /**
   * Get value from Chrome storage
   * @param {string} key - Key to retrieve
   * @returns {Promise} Value stored at key
   */
  static async get(key) {
    try {
      // Try direct chrome.storage access first
      if (chrome?.storage?.local) {
        const result = await chrome.storage.local.get([key]);
        return result[key] || null;
      }

      // Fallback: use background script messaging
      const response = await chrome.runtime.sendMessage({
        action: 'getStoredData',
        key: key
      });

      if (response && response.success) {
        return response.value || null;
      }
      return null;
    } catch (error) {
      console.error(`[StorageManager] Error getting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set value in Chrome storage
   * @param {string} key - Key to store
   * @param {*} value - Value to store
   * @returns {Promise}
   */
  static async set(key, value) {
    try {
      // Try direct chrome.storage access first
      if (chrome?.storage?.local) {
        const data = {};
        data[key] = value;
        await chrome.storage.local.set(data);
        return;
      }

      // Fallback: use background script messaging
      const response = await chrome.runtime.sendMessage({
        action: 'setStoredData',
        key: key,
        value: value
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to save via background script');
      }
    } catch (error) {
      console.error(`[StorageManager] Error setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove value from Chrome storage
   * @param {string} key - Key to remove
   * @returns {Promise}
   */
  static async remove(key) {
    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.remove([key]);
        return;
      }

      console.warn('[StorageManager] Cannot remove via background script');
    } catch (error) {
      console.error(`[StorageManager] Error removing ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   * @returns {Promise}
   */
  static async clear() {
    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.clear();
        return;
      }

      console.warn('[StorageManager] Cannot clear via background script');
    } catch (error) {
      console.error('[StorageManager] Error clearing storage:', error);
      throw error;
    }
  }
}

// Export for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager };
}
