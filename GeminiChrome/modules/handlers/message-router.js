/**
 * Message Router for background script
 * Centralizes all message handling logic
 */

class MessageRouter {
  constructor() {
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }

  /**
   * Register a message handler
   * @param {string} action - The action name
   * @param {function} handler - The handler function
   */
  register(action, handler) {
    this.handlers.set(action, handler);
    console.log(`[MessageRouter] Registered handler for action: ${action}`);
  }

  /**
   * Dispatch a message to the appropriate handler
   * @param {object} request - The message request
   * @param {object} sender - The sender information
   * @param {function} sendResponse - The response callback
   * @returns {boolean} - Should keep message channel open
   */
  dispatch(request, sender, sendResponse) {
    const action = request.action;
    console.log(`[MessageRouter] Dispatching action: ${action}`);

    const handler = this.handlers.get(action);
    if (handler) {
      try {
        handler(request, sender, sendResponse);
        return true; // Keep message channel open
      } catch (error) {
        console.error(`[MessageRouter] Error in handler for ${action}:`, error);
        sendResponse({
          success: false,
          error: error.message
        });
        return true;
      }
    } else {
      console.warn(`[MessageRouter] No handler registered for action: ${action}`);
      return true;
    }
  }

  /**
   * Register default handlers
   */
  registerDefaultHandlers() {
    // These will be set up by the background script during initialization
    console.log('[MessageRouter] Initialized');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessageRouter };
}
