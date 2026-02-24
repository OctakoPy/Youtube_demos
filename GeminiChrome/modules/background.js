/**
 * Gemini Live Assistant - Refactored Background Service Worker
 * Uses modular handler architecture for better organization
 */

console.log('Gemini Live Assistant - Background service worker loaded');

// Initialize message router
const messageRouter = new MessageRouter();

// Register handlers
messageRouter.register('toggleSidePanel', handleSidePanelToggle);
messageRouter.register('captureScreenshot', handleScreenshotCapture);
messageRouter.register('captureTab', handleTabCapture);
messageRouter.register('captureDesktop', handleDesktopCapture);
messageRouter.register('getStoredData', handleGetStoredData);
messageRouter.register('setStoredData', handleSetStoredData);
messageRouter.register('removeStoredData', handleRemoveStoredData);
messageRouter.register('requestMicrophonePermission', handleMicrophonePermissionRequest);
messageRouter.register('microphonePermissionResult', handleMicrophonePermissionResult);

/**
 * Listen for messages from content script and side panel
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[background] Message received:', request.action);

  // Dispatch to router
  return messageRouter.dispatch(request, sender, sendResponse);
});

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[background] Extension installed/updated');

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[background] Error setting side panel behavior:', error));
});

/**
 * Handle tab closed - cleanup state
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log(`[background] Tab ${tabId} removed`);
  cleanupSidePanelState(tabId);
});

/**
 * Handle tab updated
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    console.log(`[background] Tab ${tabId} navigating to: ${changeInfo.url}`);
  }
});

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[background] Extension icon clicked for tab:', tab.id);
});

console.log('[background] Initialization complete');
