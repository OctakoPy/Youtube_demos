/**
 * Side Panel Handlers for background script
 */

// Store side panel state per tab
const sidePanelState = new Map();

/**
 * Handle side panel toggle
 */
async function handleSidePanelToggle(tabId, sendResponse) {
  try {
    console.log(`[handleSidePanelToggle] Toggling for tab ${tabId}`);

    const currentState = sidePanelState.get(tabId) || false;
    const newState = !currentState;

    if (newState) {
      await chrome.sidePanel.open({ tabId: tabId });
      console.log(`[handleSidePanelToggle] Opened for tab ${tabId}`);
      sidePanelState.set(tabId, true);

      sendResponse({
        status: 'Side panel opened',
        isOpen: true,
        action: 'opened'
      });
    } else {
      console.log(`[handleSidePanelToggle] Closing for tab ${tabId}`);

      sidePanelState.set(tabId, false);

      try {
        await chrome.runtime.sendMessage({
          action: 'closeSidePanel',
          tabId: tabId
        });
      } catch (e) {
        console.log('[handleSidePanelToggle] Could not send close message');
      }

      sendResponse({
        status: 'Side panel close requested',
        isOpen: false,
        action: 'close_requested',
        note: 'Chrome API limitation: side panel may remain visually open'
      });
    }
  } catch (error) {
    console.error('[handleSidePanelToggle] Error:', error);
    sendResponse({
      status: 'Error toggling side panel',
      error: error.message,
      isOpen: false
    });
  }
}

/**
 * Cleanup side panel state when tab closes
 */
function cleanupSidePanelState(tabId) {
  sidePanelState.delete(tabId);
  console.log(`[cleanupSidePanelState] Removed state for tab ${tabId}`);
}

/**
 * Get side panel state for tab
 */
function getSidePanelState(tabId) {
  return sidePanelState.get(tabId) || false;
}

/**
 * Set side panel state for tab
 */
function setSidePanelState(tabId, state) {
  sidePanelState.set(tabId, state);
  console.log(`[setSidePanelState] Set state for tab ${tabId}: ${state}`);
}

// Export handlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleSidePanelToggle,
    cleanupSidePanelState,
    getSidePanelState,
    setSidePanelState,
    sidePanelState
  };
}
