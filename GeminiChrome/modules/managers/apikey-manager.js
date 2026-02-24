/**
 * API Key Manager - Handles API key storage and setup
 * Modular manager for Gemini API key management
 */

class APIKeyManager {
  constructor() {
    this.apiKey = null;
    this.apiKeyInput = null;
    this.saveApiKeyBtn = null;
    this.apiKeySection = null;
    this.mainInterface = null;
    this.onApiKeySet = null;
  }

  /**
   * Initialize UI elements
   */
  initializeElements() {
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    this.apiKeySection = document.getElementById('apiKeySection');
    this.mainInterface = document.getElementById('mainInterface');

    if (!this.apiKeyInput || !this.saveApiKeyBtn || !this.apiKeySection) {
      console.warn('[APIKeyManager] Some UI elements not found');
    }

    console.log('[APIKeyManager] Elements initialized');
  }

  /**
   * Load API key from storage
   * @returns {Promise<string|null>}
   */
  async loadApiKey() {
    try {
      console.log('[APIKeyManager] Loading API key from storage...');
      this.apiKey = await StorageManager.get('geminiApiKey');

      if (this.apiKey) {
        console.log('[APIKeyManager] API key loaded successfully');
      } else {
        console.log('[APIKeyManager] No API key found in storage');
      }

      return this.apiKey;
    } catch (error) {
      console.error('[APIKeyManager] Error loading API key:', error);
      throw error;
    }
  }

  /**
   * Save API key to storage
   * @param {string} apiKey
   * @returns {Promise<boolean>}
   */
  async saveApiKey(apiKey) {
    if (!apiKey || !apiKey.trim()) {
      console.warn('[APIKeyManager] Invalid API key provided');
      return false;
    }

    try {
      console.log('[APIKeyManager] Saving API key to storage...');
      await StorageManager.set('geminiApiKey', apiKey.trim());

      this.apiKey = apiKey.trim();
      console.log('[APIKeyManager] API key saved successfully');

      if (this.onApiKeySet) {
        this.onApiKeySet(this.apiKey);
      }

      return true;
    } catch (error) {
      console.error('[APIKeyManager] Error saving API key:', error);
      throw error;
    }
  }

  /**
   * Delete API key from storage
   * @returns {Promise<boolean>}
   */
  async deleteApiKey() {
    try {
      console.log('[APIKeyManager] Deleting API key from storage...');
      await StorageManager.remove('geminiApiKey');

      this.apiKey = null;
      console.log('[APIKeyManager] API key deleted successfully');

      return true;
    } catch (error) {
      console.error('[APIKeyManager] Error deleting API key:', error);
      throw error;
    }
  }

  /**
   * Check if API key is set
   * @returns {boolean}
   */
  hasApiKey() {
    return !!this.apiKey;
  }

  /**
   * Get current API key
   * @returns {string|null}
   */
  getApiKey() {
    return this.apiKey;
  }

  /**
   * Show API key setup section
   */
  showSetupSection() {
    if (this.apiKeySection) {
      this.apiKeySection.style.display = 'block';
    }
    if (this.mainInterface) {
      this.mainInterface.style.display = 'none';
    }
    console.log('[APIKeyManager] Setup section shown');
  }

  /**
   * Hide API key setup section
   */
  hideSetupSection() {
    if (this.apiKeySection) {
      this.apiKeySection.style.display = 'none';
    }
    if (this.mainInterface) {
      this.mainInterface.style.display = 'block';
    }
    console.log('[APIKeyManager] Setup section hidden');
  }

  /**
   * Clear input field
   */
  clearInput() {
    if (this.apiKeyInput) {
      this.apiKeyInput.value = '';
    }
  }

  /**
   * Get input value
   * @returns {string}
   */
  getInputValue() {
    return this.apiKeyInput ? this.apiKeyInput.value.trim() : '';
  }

  /**
   * Register callback for when API key is set
   * @param {function} callback
   */
  onApiKeyChanged(callback) {
    this.onApiKeySet = callback;
  }

  /**
   * Setup event listeners
   * @param {function} onSave - Called after key is saved
   */
  setupEventListeners(onSave) {
    const handleSave = async () => {
      const keyValue = this.getInputValue();
      if (!keyValue) {
        console.warn('[APIKeyManager] No key value provided');
        return;
      }
      const saved = await this.saveApiKey(keyValue);
      if (saved && onSave) {
        this.clearInput();
        onSave();
      }
    };

    if (this.saveApiKeyBtn) {
      this.saveApiKeyBtn.addEventListener('click', handleSave);
    }

    if (this.apiKeyInput) {
      this.apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSave();
        }
      });
    }

    console.log('[APIKeyManager] Event listeners setup');
  }
}

// Export for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APIKeyManager };
}
