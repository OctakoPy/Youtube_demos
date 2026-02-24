/**
 * Message client for communicating with background script
 */

class MessageClient {
  /**
   * Send a message to the background script
   * @param {object} message - Message to send
   * @returns {Promise} Response from background script
   */
  static async send(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Request screenshot from background script
   * @returns {Promise} Screenshot data
   */
  static async requestScreenshot() {
    console.log('[MessageClient] Requesting screenshot...');
    const response = await this.send({ action: 'captureScreenshot' });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to capture screenshot');
    }
    
    return {
      dataUrl: response.dataUrl,
      tabUrl: response.tabUrl,
      tabId: response.tabId
    };
  }

  /**
   * Request microphone permission from background script
   * @returns {Promise} Permission result
   */
  static async requestMicrophonePermission() {
    console.log('[MessageClient] Requesting microphone permission...');
    const response = await this.send({
      action: 'requestMicrophonePermission'
    });

    return response.success;
  }

  /**
   * Toggle side panel
   * @returns {Promise} Panel state response
   */
  static async toggleSidePanel() {
    console.log('[MessageClient] Toggling side panel...');
    const response = await this.send({
      action: 'toggleSidePanel'
    });

    return response;
  }

  /**
   * Request desktop capture from background script
   * @returns {Promise} Desktop capture stream ID
   */
  static async requestDesktopCapture() {
    console.log('[MessageClient] Requesting desktop capture...');
    const response = await this.send({
      action: 'captureDesktop'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to capture desktop');
    }

    return response.streamId;
  }

  /**
   * Listen for messages from background script
   * @param {function} callback - Handler function
   */
  static listen(callback) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      callback(request, sender, sendResponse);
    });
  }
}

// Export for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessageClient };
}
