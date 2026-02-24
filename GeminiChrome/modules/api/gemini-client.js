/**
 * Gemini API Client - Handles communication with Gemini Live API
 */

class GeminiAPIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.genAI = null;
    this.session = null;
    this.isConnected = false;
    this.isSetupComplete = false;
    this.systemPrompt = null;
    this.callbacks = {
      onSetupComplete: null,
      onMessage: null,
      onError: null,
      onClose: null,
      onAudioData: null,
      onTranscript: null
    };
  }

  /**
   * Initialize Gemini AI
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      if (!window.GoogleGenAI) {
        throw new Error('Gemini Live library not available');
      }

      if (!this.apiKey) {
        throw new Error('API key is not set. Cannot initialize Gemini without an API key.');
      }

      console.log('[GeminiAPIClient] Initializing with API key...');
      this.genAI = new window.GoogleGenAI({
        apiKey: this.apiKey,
        apiVersion: 'v1alpha'
      });

      console.log('[GeminiAPIClient] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[GeminiAPIClient] Initialization error:', error);
      return false;
    }
  }

  /**
   * Connect to Gemini Live
   * @returns {Promise<boolean>}
   */
  async connect() {
    console.log('[GeminiAPIClient] Connecting...');
    this.isSetupComplete = false;

    try {
      if (this.session) {
        try {
          this.session.close();
        } catch (e) {
          console.warn('[GeminiAPIClient] Error closing previous session:', e);
        }
        this.session = null;
      }

      const config = {
        responseModalities: ['AUDIO']
      };

      // Add system instruction if provided
      if (this.systemPrompt) {
        config.systemInstruction = this.systemPrompt;
      }

      this.session = await this.genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: config,
        callbacks: {
          onopen: () => this.handleConnectionOpen(),
          onmessage: (message) => this.handleMessage(message),
          onerror: (error) => this.handleError(error),
          onclose: (event) => this.handleClose(event)
        }
      });

      console.log('[GeminiAPIClient] Live session created with model: gemini-2.5-flash-native-audio-preview-12-2025');

      this.isConnected = true;
      console.log('[GeminiAPIClient] Connection initiated');
      return true;
    } catch (error) {
      console.error('[GeminiAPIClient] Connection error:', error);
      return false;
    }
  }

  /**
   * Handle connection open
   */
  handleConnectionOpen() {
    console.log('[GeminiAPIClient] Connection established');
    
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage({ type: 'connected' });
    }
  }

  /**
   * Handle message from Gemini
   * @param {object} message
   */
  handleMessage(message) {
    const response = message;

    // Check for setup complete
    if (!this.isSetupComplete) {
      console.log('[GeminiAPIClient] Setup completed');
      this.isSetupComplete = true;
      
      if (this.callbacks.onSetupComplete) {
        this.callbacks.onSetupComplete();
      }
    }

    // Handle server content
    if (response?.serverContent) {
      // Input transcription (user's speech)
      if (response.serverContent.inputTranscription) {
        if (this.callbacks.onTranscript) {
          this.callbacks.onTranscript({
            text: response.serverContent.inputTranscription.text,
            speaker: 'user',
            isStreaming: true
          });
        }
      }

      // Output transcription (AI's speech)
      if (response.serverContent.outputTranscription) {
        if (this.callbacks.onTranscript) {
          this.callbacks.onTranscript({
            text: response.serverContent.outputTranscription.text,
            speaker: 'ai',
            isStreaming: true
          });
        }
      }

      // Model turn (responses)
      if (response.serverContent.modelTurn?.parts) {
        response.serverContent.modelTurn.parts.forEach(part => {
          if (part.text) {
            console.log('[GeminiAPIClient] Text response:', part.text);
          }

          // Handle audio response
          if (part.inlineData?.data && typeof part.inlineData.data === 'string') {
            if (this.callbacks.onAudioData) {
              try {
                const audioArrayBuffer = this.base64ToArrayBuffer(part.inlineData.data);
                this.callbacks.onAudioData(audioArrayBuffer);
              } catch (e) {
                console.error('[GeminiAPIClient] Error decoding audio:', e);
              }
            }
          }
        });
      }

      // Turn complete
      if (response.serverContent.turnComplete) {
        console.log('[GeminiAPIClient] Turn complete');
        if (this.callbacks.onMessage) {
          this.callbacks.onMessage({ type: 'turnComplete' });
        }
      }
    }
  }

  /**
   * Handle error
   * @param {object} errorEvent
   */
  handleError(errorEvent) {
    const errorMessage = errorEvent.message || errorEvent.error?.message || 'WebSocket error';
    console.error('[GeminiAPIClient] Error:', errorMessage);

    if (this.callbacks.onError) {
      this.callbacks.onError(new Error(errorMessage));
    }
  }

  /**
   * Handle connection close
   * @param {object} closeEvent
   */
  handleClose(closeEvent) {
    console.log('[GeminiAPIClient] Connection closed:', closeEvent.code);
    this.isConnected = false;
    this.isSetupComplete = false;

    if (this.callbacks.onClose) {
      this.callbacks.onClose(closeEvent);
    }
  }

  /**
   * Send audio data to Gemini
   * @param {object} audioBlob
   */
  sendAudio(audioBlob) {
    if (!this.session || !this.isSetupComplete) {
      console.warn('[GeminiAPIClient] Cannot send audio - session not ready');
      return;
    }

    this.session.sendRealtimeInput({
      media: audioBlob
    });
  }

  /**
   * Send image data to Gemini
   * @param {object} imageBlob
   */
  sendImage(imageBlob) {
    if (!this.session || !this.isSetupComplete) {
      console.warn('[GeminiAPIClient] Cannot send image - session not ready');
      return;
    }

    this.session.sendRealtimeInput({
      media: imageBlob
    });
  }

  /**
   * Register callback
   * @param {string} callbackName
   * @param {function} callback
   */
  on(callbackName, callback) {
    if (this.callbacks.hasOwnProperty(callbackName)) {
      this.callbacks[callbackName] = callback;
    }
  }

  /**
   * Set system prompt to be sent when session connects
   * @param {string} systemPrompt
   */
  setSystemPrompt(systemPrompt) {
    this.systemPrompt = systemPrompt;
  }

  /**
   * Disconnect from Gemini
   */
  disconnect() {
    console.log('[GeminiAPIClient] Disconnecting...');

    if (this.session) {
      try {
        this.session.close();
      } catch (e) {
        console.warn('[GeminiAPIClient] Error closing session:', e);
      }
      this.session = null;
    }

    this.isConnected = false;
    this.isSetupComplete = false;
  }

  /**
   * Convert Base64 to ArrayBuffer
   * @param {string} base64
   * @returns {ArrayBuffer}
   */
  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Check if connected and setup is complete
   * @returns {boolean}
   */
  isReady() {
    return this.isConnected && this.isSetupComplete;
  }
}

// Export for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeminiAPIClient };
}
