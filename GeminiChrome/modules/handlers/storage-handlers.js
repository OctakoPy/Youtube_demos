/**
 * Storage Handlers for background script
 */

/**
 * Handle storage get request
 */
async function handleGetStoredData(request, sendResponse) {
  try {
    console.log(`[handleGetStoredData] Getting key: ${request.key}`);

    const result = await chrome.storage.local.get([request.key]);
    const value = result[request.key];

    console.log(`[handleGetStoredData] Success!`);
    sendResponse({
      success: true,
      value: value || null
    });
  } catch (error) {
    console.error('[handleGetStoredData] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to get stored data'
    });
  }
}

/**
 * Handle storage set request
 */
async function handleSetStoredData(request, sendResponse) {
  try {
    console.log(`[handleSetStoredData] Setting key: ${request.key}`);

    const dataToStore = {};
    dataToStore[request.key] = request.value;

    await chrome.storage.local.set(dataToStore);

    console.log(`[handleSetStoredData] Success!`);
    sendResponse({
      success: true
    });
  } catch (error) {
    console.error('[handleSetStoredData] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to set stored data'
    });
  }
}

/**
 * Handle storage remove request
 */
async function handleRemoveStoredData(request, sendResponse) {
  try {
    console.log(`[handleRemoveStoredData] Removing key: ${request.key}`);

    await chrome.storage.local.remove([request.key]);

    console.log(`[handleRemoveStoredData] Success!`);
    sendResponse({
      success: true
    });
  } catch (error) {
    console.error('[handleRemoveStoredData] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to remove stored data'
    });
  }
}

// Export handlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleGetStoredData,
    handleSetStoredData,
    handleRemoveStoredData
  };
}
