/**
 * permission.js
 * Shows permission request popup with helpful instructions
 */

console.log("[Permission] Permission popup script loaded");

// Update UI status
function updateStatus(statusType, message) {
  const loadingStatus = document.getElementById('loadingStatus');
  const successStatus = document.getElementById('successStatus');
  const errorStatus = document.getElementById('errorStatus');
  const instructions = document.getElementById('instructions');
  const retryBtn = document.getElementById('retryBtn');
  
  console.log(`[Permission] Updating UI status to: ${statusType}`);
  
  // Hide all statuses
  if (loadingStatus) loadingStatus.style.display = 'none';
  if (successStatus) successStatus.style.display = 'none';
  if (errorStatus) errorStatus.style.display = 'none';
  if (instructions) instructions.classList.remove('show');
  if (retryBtn) retryBtn.style.display = 'none';
  
  // Show requested status
  if (statusType === 'success' && successStatus) {
    successStatus.textContent = '✓ Permission granted! You can now use voice chat.';
    successStatus.style.display = 'block';
    if (retryBtn) retryBtn.style.display = 'none';
  } else if (statusType === 'error' && errorStatus) {
    errorStatus.textContent = message || '✗ Microphone permission denied';
    errorStatus.style.display = 'block';
    if (instructions) instructions.classList.add('show');
    if (retryBtn) retryBtn.style.display = 'inline-block';
  }
}

async function attemptPermissionRequest() {
  try {
    console.log("[Permission] Attempting to get microphone access...");
    
    // The browser should show a permission dialog here
    // If it doesn't, the user has already denied it in this session
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000
      }
    });
    
    console.log("[Permission] SUCCESS! Microphone access granted");
    
    // Stop the tracks
    stream.getTracks().forEach(track => {
      console.log("[Permission] Stopping track:", track.label);
      track.stop();
    });
    
    updateStatus('success');
    
    // Send success to background
    chrome.runtime.sendMessage({
      type: 'MICROPHONE_PERMISSION_RESULT',
      success: true,
      message: 'Microphone permission granted'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Permission] Error sending success:", chrome.runtime.lastError);
      } else {
        console.log("[Permission] Success message sent");
      }
    });
    
    // Close after 2 seconds
    setTimeout(() => {
      console.log("[Permission] Closing after successful permission grant");
      window.close();
    }, 2000);
    
  } catch (error) {
    console.error("[Permission] Failed to get microphone access");
    console.error("[Permission] Error:", error.name, error.message);
    
    let errorMessage = 'Microphone access denied';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Microphone permission denied. See instructions below.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No microphone device found. Check your hardware.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Microphone is already in use by another application.';
    }
    
    updateStatus('error', errorMessage);
    
    // Send failure to background
    chrome.runtime.sendMessage({
      type: 'MICROPHONE_PERMISSION_RESULT',
      success: false,
      error: errorMessage
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Permission] Error sending failure:", chrome.runtime.lastError);
      }
    });
  }
}

// Start permission attempt when page loads
console.log("[Permission] Starting permission request...");
attemptPermissionRequest(); 