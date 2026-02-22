// content.js
console.log("Content script loaded on:", window.location.href);

function createSidePanelButton() {
    // Avoid creating multiple buttons if script is injected multiple times (e.g., on navigation)
    if (document.getElementById('yeyulab-chat-toggle')) {
        return;
    }

    const button = document.createElement('button');
    button.id = 'yeyulab-chat-toggle';
    button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    
    // Apply modern floating button styles - positioned in middle of right side
    Object.assign(button.style, {
        position: 'fixed',
        top: '50%',
        right: '24px',
        transform: 'translateY(-50%)',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: '999999',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
    });

    // Add accessibility attributes
    button.title = 'Open Yeyulab Chat';
    button.setAttribute('aria-label', 'Toggle Yeyulab Chat Assistant');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');

    // Add hover effects - maintain center positioning while scaling
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-50%) scale(1.1)';
        button.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.4), 0 6px 16px rgba(0, 0, 0, 0.2)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(-50%) scale(1)';
        button.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    // Add click effect
    button.addEventListener('mousedown', () => {
        button.style.transform = 'translateY(-50%) scale(0.95)';
    });

    button.addEventListener('mouseup', () => {
        button.style.transform = 'translateY(-50%) scale(1.1)';
    });

    // Handle click/activation
    function handleActivation(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Add ripple effect
        const ripple = document.createElement('div');
        Object.assign(ripple.style, {
            position: 'absolute',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.6)',
            transform: 'scale(0)',
            animation: 'ripple 0.6s linear',
            left: '50%',
            top: '50%',
            marginLeft: '-10px',
            marginTop: '-10px',
            width: '20px',
            height: '20px',
            pointerEvents: 'none'
        });
        
        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
        
        console.log("Modern toggle button activated. Sending message to toggle side panel.");
        
        // Disable button temporarily to prevent rapid clicks
        button.style.pointerEvents = 'none';
        setTimeout(() => {
            button.style.pointerEvents = 'auto';
        }, 500);
        
        // Check if extension context is still valid
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn("Extension context invalidated - cannot toggle side panel");
            button.style.pointerEvents = 'auto';
            return;
        }
        
        try {
            chrome.runtime.sendMessage({ action: "toggleSidePanel" }, (response) => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.error("Error sending message from content script:", chrome.runtime.lastError.message);
                    // Re-enable button on error
                    button.style.pointerEvents = 'auto';
                } else {
                    console.log("Response from background script:", response);
                    
                    // Update button appearance based on side panel state
                    if (response && typeof response.isOpen === 'boolean') {
                        updateToggleButtonState(response.isOpen);
                    }
                }
            });
        } catch (error) {
            console.warn("Failed to send message - extension context invalid");
            button.style.pointerEvents = 'auto';
        }
    }

    button.addEventListener('click', handleActivation);
    
    // Add keyboard support
    button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleActivation(e);
        }
    });

    // Add CSS animation for ripple effect and responsive design
    if (!document.getElementById('yeyulab-chat-styles')) {
        const style = document.createElement('style');
        style.id = 'yeyulab-chat-styles';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            #yeyulab-chat-toggle {
                position: relative;
                overflow: hidden;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
            
            #yeyulab-chat-toggle:active {
                transform: translateY(-50%) scale(0.95) !important;
            }
            
            /* Responsive positioning - keep centered vertically */
            @media (max-width: 768px) {
                #yeyulab-chat-toggle {
                    top: 50% !important;
                    right: 16px !important;
                    width: 56px !important;
                    height: 56px !important;
                    transform: translateY(-50%) !important;
                }
            }
            
            @media (max-width: 480px) {
                #yeyulab-chat-toggle {
                    top: 50% !important;
                    right: 12px !important;
                    width: 52px !important;
                    height: 52px !important;
                    transform: translateY(-50%) !important;
                }
                
                #yeyulab-chat-toggle svg {
                    width: 20px !important;
                    height: 20px !important;
                }
            }
            
            /* Ensure button stays above page content */
            #yeyulab-chat-toggle {
                isolation: isolate;
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(button);
    console.log("Modern Yeyulab Chat toggle button injected into page.");
}

// Update toggle button visual state
function updateToggleButtonState(isOpen) {
    const button = document.getElementById('yeyulab-chat-toggle');
    if (!button) return;
    
    if (isOpen) {
        // Side panel is open - show close icon
        button.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        button.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
        button.title = 'Close Yeyulab Chat';
    } else {
        // Side panel is closed - show chat icon
        button.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        button.title = 'Open Yeyulab Chat';
    }
}



// Function to inject microphone permission iframe
function injectMicrophonePermissionIframe() {
    // Check if iframe already exists
    if (document.getElementById('microphonePermissionIframe')) {
        console.log('[Content] Microphone permission iframe already exists');
        return;
    }
    
    // Check if extension context is still valid
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
        console.warn('[Content] Extension context invalidated - cannot inject microphone iframe');
        return;
    }
    
    console.log('[Content] Injecting microphone permission iframe');
    
    try {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('hidden', 'hidden');
        iframe.setAttribute('id', 'microphonePermissionIframe');
        iframe.setAttribute('allow', 'microphone');
        iframe.style.display = 'none';
        iframe.src = chrome.runtime.getURL('permission.html');
        
        document.body.appendChild(iframe);
        
        console.log('[Content] Microphone permission iframe injected');
    } catch (error) {
        console.warn('[Content] Failed to inject microphone iframe');
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        console.log('[Content] Received ping from background script');
        sendResponse({ status: 'Content script is active' });
    } else if (request.action === 'injectMicrophoneIframe') {
        console.log('[Content] Received request to inject microphone iframe');
        injectMicrophonePermissionIframe();
        sendResponse({ success: true });
    }
});

// Listen for messages from the permission iframe
window.addEventListener('message', (event) => {
    if (event.data.type === 'MICROPHONE_PERMISSION_RESULT') {
        console.log('[Content] Received microphone permission result:', event.data);
        
        // Check if extension context is still valid before attempting to send message
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('[Content] Extension context invalidated - cannot send microphone permission result');
            return;
        }
        
        // Forward the result to the background script with error handling
        try {
            chrome.runtime.sendMessage({
                action: 'microphonePermissionResult',
                success: event.data.success,
                message: event.data.message,
                error: event.data.error
            }, (response) => {
                // Only log errors if callback is executed with valid context
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn('[Content] Error sending microphone permission:', chrome.runtime.lastError.message);
                }
            });
        } catch (error) {
            console.warn('[Content] Extension context invalidated, skipping microphone permission result');
        }
    }
});

// CSS Injection Management
const CSSManager = {
  injectedStyles: new Map(),
  
  injectCSS(css, id = 'injected-' + Date.now()) {
    if (this.injectedStyles.has(id)) {
      console.log('[CSSManager] CSS with ID already injected:', id);
      return id;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = id;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    
    this.injectedStyles.set(id, styleElement);
    console.log('[CSSManager] CSS injected with ID:', id);
    
    return id;
  },
  
  removeCSS(id) {
    const styleElement = this.injectedStyles.get(id);
    if (styleElement) {
      styleElement.remove();
      this.injectedStyles.delete(id);
      console.log('[CSSManager] CSS removed:', id);
      return true;
    }
    return false;
  },
  
  resetAllCSS() {
    this.injectedStyles.forEach((styleElement) => {
      styleElement.remove();
    });
    this.injectedStyles.clear();
    console.log('[CSSManager] All injected CSS removed');
  }
};

// Listen for CSS injection messages from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'injectCSS') {
    console.log('[Content] Received CSS injection request:', request.description);
    const styleId = CSSManager.injectCSS(request.css, request.id);
    sendResponse({ success: true, styleId: styleId });
  } else if (request.action === 'resetCSS') {
    console.log('[Content] Received CSS reset request');
    CSSManager.resetAllCSS();
    sendResponse({ success: true });
  } else if (request.action === 'getPageHTML') {
    console.log('[Content] Received page HTML request');
    // Get the page HTML for context
    const html = document.documentElement.outerHTML;
    const title = document.title;
    const url = window.location.href;
    sendResponse({ 
      success: true, 
      html: html.substring(0, 50000), // Limit to 50KB to avoid context overflow
      title: title,
      url: url
    });
  }
});

// Ensure the DOM is ready before trying to append the button
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createSidePanelButton);
} else {
    createSidePanelButton();
} 