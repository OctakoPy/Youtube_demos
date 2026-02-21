// ScreenCaptureManager.js - Handles screenshot capture and periodic auto-capture

import { CAPTURE_CONFIG } from './config.js';
import { getHostnameFromUrl } from './utils.js';

export class ScreenCaptureManager {
  constructor(imagePreview, imagePreviewContainer, removeImageBtn, onStatusUpdate) {
    this.imagePreview = imagePreview;
    this.imagePreviewContainer = imagePreviewContainer;
    this.removeImageBtn = removeImageBtn;
    this.onStatusUpdate = onStatusUpdate;
    
    this.isAutoCapturing = false;
    this.autoScreenshotInterval = null;
    this.currentImageBase64 = null;
    this.currentImageMimeType = null;
  }

  async captureScreenshot() {
    console.log('[ScreenCaptureManager] Capturing screenshot...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureScreenshot'
      });
      
      if (response && response.success && response.dataUrl) {
        this.displayScreenshot(response.dataUrl, response.tabUrl);
        return {
          success: true,
          dataUrl: response.dataUrl,
          tabUrl: response.tabUrl
        };
      } else {
        throw new Error(response.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('[ScreenCaptureManager] Capture error:', error);
      throw error;
    }
  }

  displayScreenshot(dataUrl, tabUrl) {
    this.imagePreview.src = dataUrl;
    this.imagePreviewContainer.style.display = 'block';
    
    // Convert dataUrl to base64 for Gemini
    this.currentImageBase64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
    this.currentImageMimeType = 'image/png';
    
    // Update the image header
    const imageHeader = this.imagePreviewContainer.querySelector('.image-header span');
    if (imageHeader) {
      const hostname = getHostnameFromUrl(tabUrl);
      imageHeader.textContent = `Screenshot: ${hostname}`;
    }
  }

  startAutoCapture() {
    if (this.isAutoCapturing) {
      return;
    }
    
    console.log('[ScreenCaptureManager] Starting auto-screenshot every', CAPTURE_CONFIG.AUTO_SCREENSHOT_INTERVAL_MS, 'ms');
    this.isAutoCapturing = true;
    
    this.onStatusUpdate(`Auto-screenshot started (every ${CAPTURE_CONFIG.AUTO_SCREENSHOT_INTERVAL_MS / 1000}s)`);
    
    this.autoScreenshotInterval = setInterval(() => {
      this.captureScreenshotSilent();
    }, CAPTURE_CONFIG.AUTO_SCREENSHOT_INTERVAL_MS);
  }

  stopAutoCapture() {
    if (!this.isAutoCapturing) {
      return;
    }
    
    console.log('[ScreenCaptureManager] Stopping auto-screenshot');
    this.isAutoCapturing = false;
    
    if (this.autoScreenshotInterval) {
      clearInterval(this.autoScreenshotInterval);
      this.autoScreenshotInterval = null;
    }
    
    this.onStatusUpdate('Auto-screenshot stopped');
  }

  async captureScreenshotSilent() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureScreenshot'
      });
      
      if (response && response.success && response.dataUrl) {
        this.displayScreenshot(response.dataUrl, response.tabUrl);
        console.log('[ScreenCaptureManager] Screenshot captured silently');
      } else {
        console.warn('[ScreenCaptureManager] Failed to capture:', response?.error);
      }
    } catch (error) {
      console.warn('[ScreenCaptureManager] Capture failed, continuing auto-capture:', error.message);
    }
  }

  removeImage() {
    this.currentImageBase64 = null;
    this.currentImageMimeType = null;
    this.imagePreviewContainer.style.display = 'none';
  }

  getCurrentImageBlob() {
    if (!this.currentImageBase64 || !this.currentImageMimeType) {
      return null;
    }
    
    return {
      data: this.currentImageBase64,
      mimeType: this.currentImageMimeType
    };
  }

  cleanup() {
    this.stopAutoCapture();
    this.removeImage();
  }
}
