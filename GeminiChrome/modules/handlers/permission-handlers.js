/**
 * Permission Handlers for background script
 */

// Store microphone permission callbacks
let microphonePermissionCallbacks = new Map();

/**
 * Handle microphone permission request
 */
async function handleMicrophonePermissionRequest(sender, sendResponse) {
  try {
    console.log('[handleMicrophonePermissionRequest] Starting...');

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const activeTab = tabs[0];
    console.log(`[handleMicrophonePermissionRequest] Active tab: ${activeTab.id}`);

    // Check if tab URL is compatible
    const isTabCapturable = !/^(chrome|chrome-extension|about|moz-extension|edge):\/\//.test(activeTab.url);
    if (!isTabCapturable) {
      throw new Error('Cannot request microphone permission on this page.');
    }

    // Try to ping content script
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'ping' });
      console.log('[handleMicrophonePermissionRequest] Content script available');
    } catch (pingError) {
      console.log('[handleMicrophonePermissionRequest] Injecting content script...');

      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (injectError) {
        throw new Error('Cannot inject content script on this page.');
      }
    }

    // Send iframe injection request to content script
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      action: 'injectMicrophoneIframe'
    });

    console.log('[handleMicrophonePermissionRequest] Response:', response);

    // Store callback for later
    microphonePermissionCallbacks.set(activeTab.id, sendResponse);
  } catch (error) {
    console.error('[handleMicrophonePermissionRequest] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to request microphone permission'
    });
  }
}

/**
 * Handle microphone permission result from iframe
 */
function handleMicrophonePermissionResult(request, sender, sendResponse) {
  console.log('[handleMicrophonePermissionResult] Received result');

  const callback = microphonePermissionCallbacks.get(sender.tab.id);
  if (callback) {
    callback({
      success: request.success,
      message: request.message,
      error: request.error
    });

    microphonePermissionCallbacks.delete(sender.tab.id);
  }

  sendResponse({ received: true });
}

// Export handlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleMicrophonePermissionRequest,
    handleMicrophonePermissionResult,
    microphonePermissionCallbacks
  };
}
