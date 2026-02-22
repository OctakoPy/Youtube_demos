// CSSInjector.js - Handles CSS injection and website simplification for elderly users

export class CSSInjector {
  constructor() {
    this.injectedStyles = new Map(); // Track injected styles by ID
    this.hiddenElements = new Set(); // Track hidden elements
  }

  /**
   * Inject CSS into the active tab
   */
  async injectCSS(tabId, cssRules) {
    try {
      await chrome.tabs.insertCSS(tabId, {
        code: cssRules,
        runAt: 'document_start'
      });
      return true;
    } catch (error) {
      console.error('[CSSInjector] Error injecting CSS:', error);
      return false;
    }
  }

  /**
   * Create CSS to enlarge and highlight important elements
   */
  createEnlargementCSS(selectors) {
    return `
      ${selectors.map(selector => `
        ${selector} {
          font-size: 18px !important;
          padding: 12px !important;
          min-height: 44px !important;
          border: 3px solid #4CAF50 !important;
          background-color: #f0f8f0 !important;
        }
      `).join('\n')}
    `;
  }

  /**
   * Create CSS to hide distracting elements
   */
  createHiddenCSS(selectors) {
    return `
      ${selectors.map(selector => `
        ${selector} {
          display: none !important;
          visibility: hidden !important;
        }
      `).join('\n')}
    `;
  }

  /**
   * Create high contrast CSS for better visibility
   */
  createHighContrastCSS() {
    return `
      body {
        background-color: #ffffff !important;
        color: #000000 !important;
      }
      
      button, a, [role="button"] {
        background-color: #0066cc !important;
        color: #ffffff !important;
        font-size: 16px !important;
        padding: 12px 20px !important;
        border: 2px solid #003366 !important;
        border-radius: 4px !important;
        cursor: pointer !important;
      }
      
      button:hover, a:hover, [role="button"]:hover {
        background-color: #0052a3 !important;
        text-decoration: none !important;
      }
      
      input, textarea, select {
        font-size: 16px !important;
        padding: 10px !important;
        border: 2px solid #cccccc !important;
        background-color: #ffffff !important;
        color: #000000 !important;
      }
      
      input:focus, textarea:focus, select:focus {
        border-color: #0066cc !important;
        outline: none !important;
        box-shadow: 0 0 5px #0066cc !important;
      }
      
      label {
        font-size: 16px !important;
        font-weight: bold !important;
        color: #000000 !important;
      }
      
      h1, h2, h3, h4, h5, h6 {
        color: #000000 !important;
        font-size: 20px !important;
        margin: 15px 0 10px 0 !important;
      }
    `;
  }

  /**
   * Create CSS to increase text size across the page
   */
  createTextSizeCSS(multiplier = 1.5) {
    return `
      body {
        font-size: ${16 * multiplier}px !important;
        line-height: 1.8 !important;
      }
      
      h1 { font-size: ${32 * multiplier}px !important; }
      h2 { font-size: ${28 * multiplier}px !important; }
      h3 { font-size: ${24 * multiplier}px !important; }
      h4 { font-size: ${20 * multiplier}px !important; }
      h5 { font-size: ${18 * multiplier}px !important; }
      h6 { font-size: ${16 * multiplier}px !important; }
      
      p { font-size: ${16 * multiplier}px !important; }
      
      button, a {
        font-size: ${16 * multiplier}px !important;
      }
    `;
  }

  /**
   * Create CSS to simplify the layout (remove sidebars, comments, etc.)
   */
  createSimplifiedLayoutCSS() {
    return `
      /* Hide common distraction elements */
      .sidebar, .ad, .advertisement, .comments-section, .social-share,
      [class*="sidebar"], [class*="ad"], [class*="comment"], [class*="social"],
      aside, .right-sidebar, .left-sidebar {
        display: none !important;
      }
      
      /* Simplify main content area */
      main, article, .main-content, [role="main"] {
        max-width: 800px !important;
        margin: 0 auto !important;
        padding: 20px !important;
      }
      
      /* Remove animations and transitions */
      * {
        animation: none !important;
        transition: none !important;
      }
    `;
  }

  /**
   * Send CSS to content script for injection
   */
  async sendCSSToTab(tabId, cssCode, description = '') {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'injectCSS',
        css: cssCode,
        description: description
      });
      return true;
    } catch (error) {
      console.error('[CSSInjector] Error sending CSS to tab:', error);
      return false;
    }
  }

  /**
   * Simplify website for elderly users
   */
  async simplifyWebsite(tabId, options = {}) {
    const {
      hideAds = true,
      hideSidebars = true,
      enlargeText = true,
      highContrast = true,
      simplifyLayout = true
    } = options;

    let combinedCSS = '';

    if (simplifyLayout) {
      combinedCSS += this.createSimplifiedLayoutCSS();
    }
    
    if (enlargeText) {
      combinedCSS += this.createTextSizeCSS(1.5);
    }
    
    if (highContrast) {
      combinedCSS += this.createHighContrastCSS();
    }

    if (hideAds) {
      const adSelectors = [
        '.advertisement', '.ad', '[class*="ad-"]', '[id*="ad-"]',
        '.sidebar-ad', '.floating-ad'
      ];
      combinedCSS += this.createHiddenCSS(adSelectors);
    }

    if (hideSidebars) {
      const sidebarSelectors = [
        '.sidebar', '.right-sidebar', '.left-sidebar', 'aside',
        '[class*="sidebar"]'
      ];
      combinedCSS += this.createHiddenCSS(sidebarSelectors);
    }

    return await this.sendCSSToTab(tabId, combinedCSS, 'Simplified for elderly users');
  }

  /**
   * Highlight specific elements for user attention
   */
  async highlightElements(tabId, selectors, color = '#FFD700') {
    const css = `
      ${selectors.map(selector => `
        ${selector} {
          border: 4px solid ${color} !important;
          box-shadow: 0 0 10px ${color} !important;
          background-color: rgba(255, 215, 0, 0.1) !important;
        }
      `).join('\n')}
    `;
    
    return await this.sendCSSToTab(tabId, css, 'Highlighted elements');
  }

  /**
   * Remove previous CSS modifications
   */
  async resetWebsite(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'resetCSS'
      });
      this.injectedStyles.clear();
      this.hiddenElements.clear();
      return true;
    } catch (error) {
      console.error('[CSSInjector] Error resetting website:', error);
      return false;
    }
  }
}
