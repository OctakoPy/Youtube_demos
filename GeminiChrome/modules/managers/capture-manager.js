/**
 * Capture Manager - Handles screenshot and screen capture operations
 */

class CaptureManager {
  constructor() {
    this.isAutoCapturing = false;
    this.autoScreenshotInterval = null;
    this.autoScreenshotIntervalMs = 3000; // 3 seconds
    this.currentImageBase64 = null;
    this.currentImageMimeType = null;
    this.onScreenshotCallback = null;
  }

  /**
   * Request screenshot from background script
   * @returns {Promise}
   */
  async captureScreenshot() {
    console.log('[CaptureManager] Requesting screenshot...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureScreenshot'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to capture screenshot');
      }

      this.updateCurrentImage(response.dataUrl);
      return {
        dataUrl: response.dataUrl,
        tabUrl: response.tabUrl,
        tabId: response.tabId
      };
    } catch (error) {
      console.error('[CaptureManager] Error:', error);
      throw error;
    }
  }

  /**
   * Capture screenshot silently (used for auto-capture)
   * @returns {Promise}
   */
  async captureScreenshotSilent() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureScreenshot'
      });

      if (!response.success) {
        console.warn('[CaptureManager] Silent capture failed:', response.error);
        return null;
      }

      this.updateCurrentImage(response.dataUrl);

      if (this.onScreenshotCallback) {
        this.onScreenshotCallback(response.dataUrl, response.tabUrl);
      }

      return response;
    } catch (error) {
      console.warn('[CaptureManager] Silent capture error:', error.message);
      return null;
    }
  }

  /**
   * Start auto-capture at regular intervals
   * @typedef {function} onScreenshot
   * @param {onScreenshot} callback - Called when screenshot is captured
   */
  startAutoCapture(callback) {
    if (this.isAutoCapturing) {
      console.log('[CaptureManager] Auto-capture already running');
      return;
    }

    console.log('[CaptureManager] Starting auto-capture every', this.autoScreenshotIntervalMs, 'ms');
    this.isAutoCapturing = true;
    this.onScreenshotCallback = callback;

    // Capture immediately
    this.captureScreenshotSilent();

    // Set up interval
    this.autoScreenshotInterval = setInterval(() => {
      this.captureScreenshotSilent();
    }, this.autoScreenshotIntervalMs);
  }

  /**
   * Stop auto-capture
   */
  stopAutoCapture() {
    if (!this.isAutoCapturing) {
      console.log('[CaptureManager] Auto-capture not running');
      return;
    }

    console.log('[CaptureManager] Stopping auto-capture');
    this.isAutoCapturing = false;

    if (this.autoScreenshotInterval) {
      clearInterval(this.autoScreenshotInterval);
      this.autoScreenshotInterval = null;
    }

    this.onScreenshotCallback = null;
  }

  /**
   * Update current image data (for sending to API)
   * @param {string} dataUrl
   */
  updateCurrentImage(dataUrl) {
    this.currentImageBase64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
    this.currentImageMimeType = 'image/png';
  }

  /**
   * Get current image as media blob
   * @returns {object}
   */
  getCurrentImageBlob() {
    if (!this.currentImageBase64 || !this.currentImageMimeType) {
      return null;
    }

    return {
      data: this.currentImageBase64,
      mimeType: this.currentImageMimeType
    };
  }

  /**
   * Clear current image
   */
  clearImage() {
    this.currentImageBase64 = null;
    this.currentImageMimeType = null;
  }

  /**
   * Set auto-capture interval
   * @param {number} intervalMs
   */
  setAutoCapturInterval(intervalMs) {
    this.autoScreenshotIntervalMs = intervalMs;
  }
}

// Export for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CaptureManager };
}
