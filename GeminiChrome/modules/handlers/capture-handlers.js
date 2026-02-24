/**
 * Screenshot and Tab Capture Handlers for background script
 */

// Check if a tab URL can be captured
function isTabCapturable(url) {
  if (!url) return false;

  const nonCapturablePatterns = [
    /^chrome:\/\//,
    /^chrome-extension:\/\//,
    /^chrome-search:\/\//,
    /^chrome-devtools:\/\//,
    /^about:/,
    /^moz-extension:\/\//,
    /^edge:\/\//
  ];

  return !nonCapturablePatterns.some(pattern => pattern.test(url));
}

// Get user-friendly error message for non-capturable tabs
function getTabNotCapturableMessage(url) {
  if (!url) {
    return 'Cannot capture this tab - no URL detected';
  }

  if (url.startsWith('chrome://')) {
    return 'Cannot capture Chrome internal pages. Please navigate to a regular website (like google.com) and try again.';
  }

  if (url.startsWith('chrome-extension://')) {
    return 'Cannot capture extension pages. Please navigate to a regular website and try again.';
  }

  if (url.startsWith('about:') || url.startsWith('edge://') || url.startsWith('moz-extension://')) {
    return 'Cannot capture browser internal pages. Please navigate to a regular website and try again.';
  }

  return 'This tab cannot be captured. Please navigate to a regular website and try again.';
}

/**
 * Handle screenshot capture with multiple fallback strategies
 */
async function handleScreenshotCapture(sender, sendResponse) {
  try {
    console.log('[handleScreenshotCapture] Starting...');

    let activeTab = null;

    // Strategy 1: Get the active tab in current window
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        activeTab = tabs[0];
        console.log(`[handleScreenshotCapture] Found active tab: ${activeTab.id}`);
      }
    } catch (e) {
      console.log('[handleScreenshotCapture] Failed to get active tab:', e.message);
    }

    // Strategy 2: Find most recently active capturable tab
    if (!activeTab) {
      try {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        const regularTabs = allTabs.filter(tab => isTabCapturable(tab.url));
        if (regularTabs.length > 0) {
          regularTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
          activeTab = regularTabs[0];
          console.log(`[handleScreenshotCapture] Using recent tab: ${activeTab.id}`);
        }
      } catch (e) {
        console.log('[handleScreenshotCapture] Failed to get recent tabs:', e.message);
      }
    }

    // Strategy 3: Get any capturable tab
    if (!activeTab) {
      try {
        const allTabs = await chrome.tabs.query({});
        const capturableTabs = allTabs.filter(tab => isTabCapturable(tab.url));
        if (capturableTabs.length > 0) {
          activeTab = capturableTabs[0];
          console.log(`[handleScreenshotCapture] Using any capturable tab: ${activeTab.id}`);
        }
      } catch (e) {
        console.log('[handleScreenshotCapture] Failed to get any tabs:', e.message);
      }
    }

    if (!activeTab) {
      throw new Error('No suitable tab found for screenshot capture');
    }

    // Check if URL is capturable
    if (!isTabCapturable(activeTab.url)) {
      const errorMsg = getTabNotCapturableMessage(activeTab.url);
      throw new Error(errorMsg);
    }

    // Grant permission via script injection
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          console.log('Extension permission granted for screenshot');
        }
      });
      console.log('[handleScreenshotCapture] Permission granted');
    } catch (scriptError) {
      console.log('[handleScreenshotCapture] Script injection failed:', scriptError.message);
    }

    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: 'png',
      quality: 90
    });

    if (!dataUrl) {
      throw new Error('Failed to capture screenshot');
    }

    console.log(`[handleScreenshotCapture] Success! Size: ${dataUrl.length}`);
    sendResponse({
      success: true,
      dataUrl: dataUrl,
      tabId: activeTab.id,
      tabUrl: activeTab.url
    });
  } catch (error) {
    console.error('[handleScreenshotCapture] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to capture screenshot'
    });
  }
}

/**
 * Handle tab media stream capture
 */
async function handleTabCapture(sender, sendResponse) {
  try {
    console.log('[handleTabCapture] Starting...');

    if (!sender.tab) {
      throw new Error('Tab capture request did not originate from a tab context.');
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const activeTab = tabs[0];

    if (!isTabCapturable(activeTab.url)) {
      const errorMsg = getTabNotCapturableMessage(activeTab.url);
      throw new Error(errorMsg);
    }

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: activeTab.id
    });

    if (!streamId) {
      throw new Error('Failed to get media stream ID for tab capture.');
    }

    console.log(`[handleTabCapture] Success! Stream ID: ${streamId}`);
    sendResponse({
      success: true,
      streamId: streamId,
      tabId: activeTab.id
    });
  } catch (error) {
    console.error('[handleTabCapture] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to capture tab'
    });
  }
}

/**
 * Handle desktop capture
 */
async function handleDesktopCapture(sender, sendResponse) {
  try {
    console.log('[handleDesktopCapture] Starting...');

    if (!sender.tab) {
      throw new Error('Desktop capture request did not originate from a tab context.');
    }

    const streamId = await new Promise((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window', 'tab'],
        sender.tab,
        (streamId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!streamId) {
            reject(new Error('User cancelled desktop capture'));
          } else {
            resolve(streamId);
          }
        }
      );
    });

    console.log(`[handleDesktopCapture] Success! Stream ID: ${streamId}`);
    sendResponse({
      success: true,
      streamId: streamId
    });
  } catch (error) {
    console.error('[handleDesktopCapture] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to capture desktop'
    });
  }
}

// Export handlers for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleScreenshotCapture,
    handleTabCapture,
    handleDesktopCapture,
    isTabCapturable,
    getTabNotCapturableMessage
  };
}
