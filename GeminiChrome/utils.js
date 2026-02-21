// utils.js - Utility helper functions

/**
 * Encode ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - The buffer to encode
 * @returns {string} Base64 encoded string
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Decode Base64 string to ArrayBuffer
 * @param {string} base64 - The base64 string to decode
 * @returns {ArrayBuffer} The decoded buffer
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Extract hostname from URL
 * @param {string} urlString - The URL string
 * @returns {string} The hostname or fallback text
 */
export function getHostnameFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (e) {
    return 'Screenshot';
  }
}

/**
 * Create log prefix with timestamp
 * @param {string} component - Component name
 * @returns {string} Formatted prefix
 */
export function createLogPrefix(component) {
  return `[${component}]`;
}

/**
 * Calculate audio level from Int16Array
 * @param {Int16Array} int16Array - The audio data
 * @returns {number} Normalized level (0-1)
 */
export function calculateAudioLevel(int16Array) {
  let sum = 0;
  for (let i = 0; i < int16Array.length; i++) {
    sum += Math.abs(int16Array[i]);
  }
  return (sum / int16Array.length) / 32768; // Normalize to 0-1
}

/**
 * Wait for a condition to be true with timeout
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Timeout in ms
 * @param {number} pollInterval - Poll interval in ms
 * @returns {Promise<boolean>} True if condition was met, false if timeout
 */
export async function waitFor(condition, timeout, pollInterval = 100) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  return false;
}

/**
 * Deep clone an object (safe for simple objects)
 * @param {object} obj - Object to clone
 * @returns {object} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
