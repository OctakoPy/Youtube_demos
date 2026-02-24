// background.js
console.log("Gemini Live Assistant - Background script loaded.");

// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated.");
  // Set the side panel to open when the toolbar icon is clicked.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting side panel behavior:", error));
});

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request.action, request);
  
  if (request.action === "toggleSidePanel") {
    // Handle proper toggle functionality - open if closed, close if open
    if (sender.tab && sender.tab.id) {
      handleSidePanelToggle(sender.tab.id, sendResponse);
    } else {
      console.error("ToggleSidePanel request received without tab ID.");
      sendResponse({ status: "Error: No tab ID." });
    }
    return true; // Keep message channel open for async response
  }
  
  else if (request.action === "captureTab") {
    // Handle tab capture request from side panel (active tab)
    handleTabCapture(sender, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  else if (request.action === "captureThisTab") {
    // Handle capture of the tab where side panel is open (guaranteed invocation context)
    handleThisTabCapture(sender, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  else if (request.action === "captureScreenshot") {
    // Handle simple screenshot capture using captureVisibleTab
    handleScreenshotCapture(sender, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  else if (request.action === "requestMicrophonePermission") {
    // Handle microphone permission request via popup window
    handleMicrophonePermissionRequest(sender, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  else if (request.type === "MICROPHONE_PERMISSION_RESULT") {
    // Handle result from permission.html popup
    handleMicrophonePermissionResult(request, sender, sendResponse);
    return true;
  }
  
  else if (request.action === "microphonePermissionResult") {
    // Handle result from microphone permission iframe (legacy)
    handleMicrophonePermissionResult(request, sender, sendResponse);
    return true;
  }
  
  else if (request.action === "captureDesktop") {
    // Handle desktop capture request from side panel
    handleDesktopCapture(sender, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  else if (request.action === "getStoredData") {
    // Handle storage get request from side panel
    handleGetStoredData(request, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  else if (request.action === "setStoredData") {
    // Handle storage set request from side panel
    handleSetStoredData(request, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  return true; // Keep the message channel open for asynchronous response
});

// Store side panel state per tab
const sidePanelState = new Map();

// Handle side panel toggle functionality
async function handleSidePanelToggle(tabId, sendResponse) {
  try {
    console.log(`[handleSidePanelToggle] Toggling side panel for tab ${tabId}`);
    
    // Get current state
    const currentState = sidePanelState.get(tabId) || false;
    const newState = !currentState;
    
    if (newState) {
      // Opening the side panel
      await chrome.sidePanel.open({ tabId: tabId });
      console.log(`[handleSidePanelToggle] Side panel opened for tab ${tabId}`);
      sidePanelState.set(tabId, true);
      
      sendResponse({ 
        status: "Side panel opened", 
        isOpen: true,
        action: "opened"
      });
    } else {
      // Closing the side panel - Chrome doesn't have a direct close API
      // The best we can do is disable the side panel and notify the content script
      // to update its UI state
      console.log(`[handleSidePanelToggle] Attempting to close side panel for tab ${tabId}`);
      
      // We'll track the state as closed, but the panel might remain visually open
      // This is a Chrome API limitation
      sidePanelState.set(tabId, false);
      
      // Send a message to the side panel to close itself if possible
      try {
        await chrome.runtime.sendMessage({
          action: "closeSidePanel",
          tabId: tabId
        });
      } catch (e) {
        console.log("[handleSidePanelToggle] Could not send close message to side panel (may not be open)");
      }
      
      sendResponse({ 
        status: "Side panel close requested", 
        isOpen: false,
        action: "close_requested",
        note: "Chrome API limitation: side panel may remain visually open. Click the X button to fully close."
      });
    }
    
  } catch (error) {
    console.error("[handleSidePanelToggle] Error:", error);
    sendResponse({ 
      status: "Error toggling side panel", 
      error: error.message,
      isOpen: false
    });
  }
}

// Track when tabs are closed to clean up state
chrome.tabs.onRemoved.addListener((tabId) => {
  sidePanelState.delete(tabId);
  console.log(`[cleanup] Removed side panel state for closed tab ${tabId}`);
});

// Handle tab capture
async function handleTabCapture(sender, sendResponse) {
  try {
    console.log("[handleTabCapture] Starting tab capture...");
    console.log("[handleTabCapture] Sender details:", {
      tab: sender.tab ? {id: sender.tab.id, url: sender.tab.url} : 'NO_TAB',
      origin: sender.origin,
      url: sender.url
    });
    
    // Verify we have proper invocation context
    if (!sender.tab) {
      throw new Error("Tab capture request did not originate from a tab context. Side panel must be open.");
    }
    
    // Get the active tab (could be different from sender.tab)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }
    
    const activeTab = tabs[0];
    console.log(`[handleTabCapture] Active tab: ${activeTab.id}, URL: ${activeTab.url}`);
    console.log(`[handleTabCapture] Sender tab: ${sender.tab.id}, URL: ${sender.tab.url}`);
    
    // Check if the tab URL is capturable
    if (!isTabCapturable(activeTab.url)) {
      const errorMsg = getTabNotCapturableMessage(activeTab.url);
      throw new Error(errorMsg);
    }
    
    // For tab capture, we typically want to capture the active tab
    // But the invocation context must come from sender.tab (where side panel is open)
    console.log(`[handleTabCapture] Attempting to capture tab ${activeTab.id} with invocation context from tab ${sender.tab.id}`);
    
    // Start tab capture
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: activeTab.id
    });
    
    if (!streamId) {
      throw new Error("Failed to get media stream ID for tab capture. Extension may not have been properly invoked for the target tab.");
    }
    
    console.log(`[handleTabCapture] Success! Stream ID: ${streamId}`);
    sendResponse({
      success: true,
      streamId: streamId,
      tabId: activeTab.id
    });
    
  } catch (error) {
    console.error("[handleTabCapture] Error:", error);
    // Provide more helpful error messages
    let errorMessage = error.message || "Failed to capture tab";
    
    if (errorMessage.includes("Extension has not been invoked")) {
      errorMessage = "Extension not properly invoked for tab capture. Try clicking the extension icon on the tab you want to capture, then try again.";
    }
    
    sendResponse({
      success: false,
      error: errorMessage
    });
  }
}

// Check if a tab URL can be captured
function isTabCapturable(url) {
  if (!url) return false;
  
  // Chrome internal pages cannot be captured
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
    return "Cannot capture this tab - no URL detected";
  }
  
  if (url.startsWith('chrome://')) {
    return "Cannot capture Chrome internal pages. Please navigate to a regular website (like google.com) and try again.";
  }
  
  if (url.startsWith('chrome-extension://')) {
    return "Cannot capture extension pages. Please navigate to a regular website and try again.";
  }
  
  if (url.startsWith('about:') || url.startsWith('edge://') || url.startsWith('moz-extension://')) {
    return "Cannot capture browser internal pages. Please navigate to a regular website and try again.";
  }
  
  return "This tab cannot be captured. Please navigate to a regular website and try again.";
}

// Handle desktop capture
async function handleDesktopCapture(sender, sendResponse) {
  try {
    console.log("[handleDesktopCapture] Starting desktop capture...");
    console.log("[handleDesktopCapture] Sender details:", {
      tab: sender.tab ? {id: sender.tab.id, url: sender.tab.url} : 'NO_TAB',
      origin: sender.origin,
      url: sender.url
    });
    
    // Ensure sender.tab exists, which it should if message is from side panel
    if (!sender.tab) {
      throw new Error("Desktop capture request did not originate from a tab context (e.g., side panel).");
    }
    
    console.log(`[handleDesktopCapture] Requesting media for tab ID: ${sender.tab.id}, URL: ${sender.tab.url}`);

    // Request desktop capture
    // The 'sender.tab' provides the necessary window context for the picker UI.
    const streamId = await new Promise((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window', 'tab'], // User can choose what to share
        sender.tab,                 // The tab that initiated the request (your side panel's tab)
        (streamId) => {
          if (chrome.runtime.lastError) {
            // Log the full error for more details
            console.error("[handleDesktopCapture] chrome.runtime.lastError:", chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message || "Error in chooseDesktopMedia"));
          } else if (!streamId) {
            // This happens if the user cancels the picker dialog
            console.log("[handleDesktopCapture] User cancelled desktop capture.");
            reject(new Error("User cancelled desktop capture"));
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
    console.error("[handleDesktopCapture] Catch block error:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to capture desktop"
    });
  }
}

// Handle storage operations for side panel
async function handleGetStoredData(request, sendResponse) {
  try {
    console.log(`[handleGetStoredData] Getting key: ${request.key}`);
    
    const result = await chrome.storage.local.get([request.key]);
    const value = result[request.key];
    
    console.log(`[handleGetStoredData] Success! Key: ${request.key}, Has value: ${!!value}`);
    sendResponse({
      success: true,
      value: value || null
    });
    
  } catch (error) {
    console.error("[handleGetStoredData] Error:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to get stored data"
    });
  }
}

async function handleSetStoredData(request, sendResponse) {
  try {
    console.log(`[handleSetStoredData] Setting key: ${request.key}`);
    
    const dataToStore = {};
    dataToStore[request.key] = request.value;
    
    await chrome.storage.local.set(dataToStore);
    
    console.log(`[handleSetStoredData] Success! Key: ${request.key} saved`);
    sendResponse({
      success: true
    });
    
  } catch (error) {
    console.error("[handleSetStoredData] Error:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to set stored data"
    });
  }
}

// Handle capture of the tab where side panel is open (guaranteed invocation context)
async function handleThisTabCapture(sender, sendResponse) {
  try {
    console.log("[handleThisTabCapture] Starting capture of sender tab...");
    console.log("[handleThisTabCapture] Full sender object:", sender);
    console.log("[handleThisTabCapture] Sender details:", {
      tab: sender.tab ? {id: sender.tab.id, url: sender.tab.url} : 'NO_TAB',
      origin: sender.origin,
      url: sender.url,
      frameId: sender.frameId,
      documentId: sender.documentId
    });
    
    // Verify we have proper invocation context
    if (!sender.tab) {
      throw new Error("This tab capture request did not originate from a tab context. Side panel must be open.");
    }
    
    const targetTab = sender.tab;
    console.log(`[handleThisTabCapture] Capturing sender tab: ${targetTab.id}, URL: ${targetTab.url}`);
    
    // Check if this tab URL is capturable
    if (!isTabCapturable(targetTab.url)) {
      const errorMsg = getTabNotCapturableMessage(targetTab.url);
      throw new Error(errorMsg);
    }
    
    // Capture the tab where the side panel is open - this should have guaranteed invocation context
    console.log(`[handleThisTabCapture] Attempting to capture sender tab ${targetTab.id} (guaranteed invocation context)`);
    
    // Start tab capture
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: targetTab.id
    });
    
    if (!streamId) {
      throw new Error("Failed to get media stream ID for this tab capture. This should not happen with guaranteed invocation context.");
    }
    
    console.log(`[handleThisTabCapture] Success! Stream ID: ${streamId}`);
    sendResponse({
      success: true,
      streamId: streamId,
      tabId: targetTab.id
    });
    
  } catch (error) {
    console.error("[handleThisTabCapture] Error:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to capture this tab"
    });
  }
}

// Handle simple screenshot capture using captureVisibleTab
async function handleScreenshotCapture(sender, sendResponse) {
  try {
    console.log("[handleScreenshotCapture] Starting screenshot capture...");
    console.log("[handleScreenshotCapture] Sender details:", sender);
    
    // Try multiple strategies to find a suitable tab
    let activeTab = null;
    
    // Strategy 1: Get the active tab in current window
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        activeTab = tabs[0];
        console.log(`[handleScreenshotCapture] Found active tab: ${activeTab.id}, URL: ${activeTab.url}`);
      }
    } catch (e) {
      console.log("[handleScreenshotCapture] Failed to get active tab in current window:", e.message);
    }
    
    // Strategy 2: If no active tab, try to get the most recently active tab
    if (!activeTab) {
      try {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        // Find the most recently accessed tab that's not a chrome:// page
        const regularTabs = allTabs.filter(tab => isTabCapturable(tab.url));
        if (regularTabs.length > 0) {
          // Sort by lastAccessed (most recent first) and take the first one
          regularTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
          activeTab = regularTabs[0];
          console.log(`[handleScreenshotCapture] Using most recent regular tab: ${activeTab.id}, URL: ${activeTab.url}`);
        }
      } catch (e) {
        console.log("[handleScreenshotCapture] Failed to get recent tabs:", e.message);
      }
    }
    
    // Strategy 3: If still no tab, get any capturable tab from any window
    if (!activeTab) {
      try {
        const allTabs = await chrome.tabs.query({});
        const capturableTabs = allTabs.filter(tab => isTabCapturable(tab.url));
        if (capturableTabs.length > 0) {
          activeTab = capturableTabs[0];
          console.log(`[handleScreenshotCapture] Using any capturable tab: ${activeTab.id}, URL: ${activeTab.url}`);
        }
      } catch (e) {
        console.log("[handleScreenshotCapture] Failed to get any tabs:", e.message);
      }
    }
    
    if (!activeTab) {
      throw new Error("No suitable tab found for screenshot capture");
    }
    
    // Check if the tab URL is capturable
    if (!isTabCapturable(activeTab.url)) {
      const errorMsg = getTabNotCapturableMessage(activeTab.url);
      throw new Error(errorMsg);
    }
    
    // Try to ensure we have permission by injecting a simple script first
    // This grants activeTab permission for the target tab
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          // Simple function to grant activeTab permission
          console.log("Extension permission granted for screenshot");
        }
      });
      console.log("[handleScreenshotCapture] Permission granted via script injection");
    } catch (scriptError) {
      console.log("[handleScreenshotCapture] Script injection failed (may still work with host_permissions):", scriptError.message);
    }
    
    // Capture visible tab as image
    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: 'png',
      quality: 90
    });
    
    if (!dataUrl) {
      throw new Error("Failed to capture screenshot");
    }
    
    console.log(`[handleScreenshotCapture] Success! Screenshot captured, size: ${dataUrl.length} chars`);
    sendResponse({
      success: true,
      dataUrl: dataUrl,
      tabId: activeTab.id,
      tabUrl: activeTab.url
    });
    
  } catch (error) {
    console.error("[handleScreenshotCapture] Error:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to capture screenshot"
    });
  }
}

// Handle microphone permission request via extension page
async function handleMicrophonePermissionRequest(sender, sendResponse) {
  try {
    console.log("[handleMicrophonePermissionRequest] Requesting microphone permission from extension page...");
    
    // Always open the permission popup when requested
    // Don't check storage flag - let the browser handle the actual permission state
    
    // Verify extension URL is correct
    const permUrl = chrome.runtime.getURL('permission.html');
    console.log("[handleMicrophonePermissionRequest] Permission URL:", permUrl);
    
    // Open permission.html as a focused popup window
    const permissionWindow = await chrome.windows.create({
      url: permUrl,
      type: 'popup',
      width: 700,
      height: 650,
      focused: true
    });
    
    console.log("[handleMicrophonePermissionRequest] Opened permission window:", {
      id: permissionWindow.id,
      focused: permissionWindow.focused,
      state: permissionWindow.state
    });
    
    // Store the sendResponse callback for later use
    const callbackKey = `permission_${permissionWindow.id}`;
    microphonePermissionCallbacks.set(callbackKey, sendResponse);
    
    // Also store a primary callback in case the window ID isn't passed back
    microphonePermissionCallbacks.set('primary', sendResponse);
    
    console.log("[handleMicrophonePermissionRequest] Callback stored with keys:", callbackKey, "and primary");
    
  } catch (error) {
    console.error("[handleMicrophonePermissionRequest] Error:", error);
    sendResponse({
      success: false,
      error: error.message || "Failed to request microphone permission"
    });
  }
}

// Handle result from microphone permission popup
function handleMicrophonePermissionResult(request, sender, sendResponse) {
  console.log("[handleMicrophonePermissionResult] Received result:", request);
  
  // Try to find and call the stored callback
  if (microphonePermissionCallbacks.size > 0) {
    // First try the primary callback
    let callback = microphonePermissionCallbacks.get('primary');
    let callbackKey = 'primary';
    
    // If no primary, get the first available callback
    if (!callback) {
      const entries = microphonePermissionCallbacks.entries();
      const firstEntry = entries.next().value;
      if (firstEntry) {
        [callbackKey, callback] = firstEntry;
      }
    }
    
    if (callback) {
      console.log("[handleMicrophonePermissionResult] Calling stored callback with key:", callbackKey);
      
      // Call the original sendResponse with the result
      callback({
        success: request.success,
        message: request.message,
        error: request.error
      });
      
      // Clean up all stored callbacks
      microphonePermissionCallbacks.clear();
      console.log("[handleMicrophonePermissionResult] Callbacks cleared");
    } else {
      console.warn("[handleMicrophonePermissionResult] No callback found!");
    }
  } else {
    console.warn("[handleMicrophonePermissionResult] No pending callbacks");
  }
  
  sendResponse({ received: true });
}

// Store microphone permission callbacks
let microphonePermissionCallbacks = new Map();

// Listen for window close events to handle permission popup dismissal
chrome.windows.onRemoved.addListener((windowId) => {
  console.log("[chrome.windows.onRemoved] Window closed:", windowId);
  
  // Check if this is a permission window
  const callbackKey = `permission_${windowId}`;
  const callback = microphonePermissionCallbacks.get(callbackKey);
  
  if (callback) {
    console.log("[chrome.windows.onRemoved] Permission window was closed");
    
    // The popup was closed - if permission was granted, we would have already
    // received a MICROPHONE_PERMISSION_RESULT message and called the callback
    // If we're here without having called the callback, permission was denied
    
    // Only notify if callback hasn't been called yet
    const callbackSent = microphonePermissionCallbacks.has(callbackKey);
    
    if (callbackSent) {
      console.log("[chrome.windows.onRemoved] Callback already sent, skipping");
    } else {
      console.log("[chrome.windows.onRemoved] No callback received, permission was denied");
      callback({
        success: false,
        error: 'Permission request was dismissed'
      });
      
      microphonePermissionCallbacks.delete(callbackKey);
    }
  }
});

// Handle session management for Gemini Live
let geminiSessions = new Map(); // Store sessions by tab ID

// Helper function to broadcast messages to all side panels
function broadcastToSidePanels(message) {
  // Note: Chrome doesn't have a direct way to message all side panels
  // In a real implementation, you might want to track open side panels
  // and message them individually
  console.log("[broadcastToSidePanels] Would broadcast:", message);
}

// Optional: Handle extension icon click for quick actions
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[action.onClicked] Extension icon clicked for tab:", tab.id);
  // The side panel should already open due to setPanelBehavior
  // But we could add additional logic here if needed
});

// Handle tab updates to potentially stop captures
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    console.log(`[tabs.onUpdated] Tab ${tabId} navigating to: ${changeInfo.url}`);
    // Could notify side panel about navigation if needed
  }
});

// Clean up on tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log(`[tabs.onRemoved] Tab ${tabId} removed`);
  if (geminiSessions.has(tabId)) {
    // Clean up any Gemini sessions associated with this tab
    geminiSessions.delete(tabId);
  }
});

console.log("Background script initialization complete."); 