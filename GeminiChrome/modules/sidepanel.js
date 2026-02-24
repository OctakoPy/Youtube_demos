/**
 * Gemini Live Assistant - Refactored Side Panel
 * Uses modular architecture for better organization and maintainability
 */

console.log('Gemini Live Assistant - Side panel loaded');

class GeminiLiveAssistant {
  constructor() {
    // Initialize managers
    this.apiKeyManager = new APIKeyManager();
    this.ui = new UIManager();
    this.audio = new AudioManager();
    this.capture = new CaptureManager();
    this.gemini = null;

    // State
    this.apiKey = null;
    this.isLiveChatActive = false;

    // Setup
    this.apiKeyManager.initializeElements();
    this.ui.initializeElements();
    this.setupEventListeners();
    this.loadApiKey();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // API Key events - delegate to APIKeyManager
    this.apiKeyManager.setupEventListeners(() => this.handleApiKeySaved());

    // Change API key button
    const changeKeyBtn = document.getElementById('changeApiKeyBtn');
    if (changeKeyBtn) {
      changeKeyBtn.addEventListener('click', () => this.changeApiKey());
    }

    // Live chat events
    this.ui.chatActionBtn.addEventListener('click', () => {
      if (this.isLiveChatActive) {
        this.stopLiveChat();
      } else {
        this.startLiveChat();
      }
    });

    this.ui.removeImageBtn.addEventListener('click', () => {
      this.capture.clearImage();
      this.ui.removeImage();
    });

    // Listen for close requests
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'closeSidePanel') {
        console.log('Received close request');
        window.close();
      }
      return true;
    });
  }

  /**
   * Load API key from storage
   */
  async loadApiKey() {
    try {
      this.apiKey = await this.apiKeyManager.loadApiKey();

      if (this.apiKey) {
        this.apiKeyManager.hideSetupSection();
        this.ui.showMainInterface();
        this.ui.updateStatus('Key Available • Ready to chat');
        await this.initializeGemini();
      } else {
        this.apiKeyManager.showSetupSection();
        this.ui.updateStatus('Enter your Gemini API Key');
      }
    } catch (error) {
      console.error('[loadApiKey] Error:', error);
      this.ui.updateStatus('Error loading API key', true);
    }
  }

  /**
   * Handle API key saved event
   */
  async handleApiKeySaved() {
    try {
      // Get the saved API key from the manager
      this.apiKey = this.apiKeyManager.getApiKey();
      
      if (!this.apiKey) {
        throw new Error('API key is empty after save');
      }

      console.log('[handleApiKeySaved] API key saved and ready');
      this.apiKeyManager.hideSetupSection();
      this.ui.showMainInterface();
      this.ui.updateStatus('Key Saved • Initializing...');
      await this.initializeGemini();
    } catch (error) {
      console.error('[handleApiKeySaved] Error:', error);
      this.ui.updateStatus('Error saving API key. Please try again.', true);
    }
  }

  /**
   * Allow user to change API key
   */
  changeApiKey() {
    this.apiKeyManager.showSetupSection();
    this.ui.updateStatus('Enter a new API key to update');
  }

  /**
   * Initialize Gemini API client
   */
  async initializeGemini() {
    try {
      if (!window.GoogleGenAI) {
        throw new Error('Gemini Live library not available');
      }

      this.gemini = new GeminiAPIClient(this.apiKey);
      const initialized = await this.gemini.initialize();

      if (initialized) {
        this.ui.updateStatus('Ready to chat');
        this.setupGeminiCallbacks();
      } else {
        this.ui.updateStatus('Error initializing Gemini AI', true);
      }
    } catch (error) {
      console.error('[initializeGemini] Error:', error);
      this.ui.updateStatus('Error initializing Gemini AI', true);
    }
  }

  /**
   * Setup Gemini callbacks
   */
  setupGeminiCallbacks() {
    this.gemini.on('onSetupComplete', () => {
      this.ui.updateStatus('Ready to chat');
    });

    this.gemini.on('onMessage', (message) => {
      if (message.type === 'turnComplete') {
        this.ui.finishTranscriptTurn(true);
        this.ui.finishTranscriptTurn(false);
      }
    });

    this.gemini.on('onAudioData', (audioBuffer) => {
      this.audio.enqueueAudio(audioBuffer);
      this.ui.updateStatus('Playing response...');
    });

    this.gemini.on('onTranscript', (transcriptData) => {
      this.ui.addTranscriptMessage(
        transcriptData.text,
        transcriptData.speaker === 'user',
        transcriptData.isStreaming
      );
    });

    this.gemini.on('onError', (error) => {
      console.error('[Gemini Error]', error);
      this.ui.updateStatus(`Error: ${error.message}`, true);
    });

    this.gemini.on('onClose', (event) => {
      console.log('[Gemini Close] Event:', event);
      this.handleGeminiClose(event);
    });
  }

  /**
   * Start live chat (voice + screen capture)
   */
  async startLiveChat() {
    if (this.isLiveChatActive) {
      return;
    }

    console.log('[startLiveChat] Starting...');
    this.isLiveChatActive = true;

    try {
      this.ui.updateStatus('Starting live chat...');
      this.ui.clearTranscript();

      // Initialize audio
      const audioReady = await this.audio.initialize();
      if (!audioReady) {
        throw new Error('Audio system failed to initialize');
      }

      // Setup audio callbacks
      this.audio.onAudioData((audioBlob) => {
        if (this.gemini && this.gemini.isReady()) {
          this.gemini.sendAudio(audioBlob);
        }
      });

      this.audio.onAudioLevel((level) => {
        this.ui.updateAudioLevel(level);
      });

      // Start screenshot capture
      const screenshot = await this.capture.captureScreenshot();
      this.ui.displayScreenshot(screenshot.dataUrl, screenshot.tabUrl);

      // Setup auto-capture callback
      this.capture.startAutoCapture((dataUrl, tabUrl) => {
        this.ui.displayScreenshot(dataUrl, tabUrl);

        // Send to Gemini if ready
        const imageBlob = this.capture.getCurrentImageBlob();
        if (imageBlob && this.gemini && this.gemini.isReady()) {
          this.gemini.sendImage(imageBlob);
        }
      });

      // Set system prompt
      const systemPrompt = `You are Waris, a calm and patient AI assistant helping elderly users navigate websites in English and Malay. You can see the user's screen via images and hear their voice. The user will be speaking English OR Malay. Only reply in the language THEY speak in. Default to English.

When the user asks for help finding or clicking something:
1. Look at the latest screen image to find the element they need.
2. Call highlight_element with the label of that element.
3. Speak simple, reassuring instructions: "I have highlighted the Name field in blue for you. It is the box near the top of the form."

Rules:
- Always call a function AND speak. Never only speak without acting.
- Use simple language, short sentences and Avoid technical terms.
- If you cannot find the element, say so and suggest what to look for.
- Keep responses under 30 words spoken.

Your first message should be: "Hi, what do you want to do on this website?"`;

      this.gemini.setSystemPrompt(systemPrompt);

      // Connect to Gemini and start recording
      const connected = await this.gemini.connect();
      if (!connected) {
        throw new Error('Failed to connect to Gemini');
      }

      // Wait for setup
      let attempts = 0;
      while (!this.gemini.isSetupComplete && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (!this.gemini.isSetupComplete) {
        throw new Error('Gemini setup timeout');
      }

      // Start recording
      console.log('[startLiveChat] Attempting to start audio recording...');
      const recordingStarted = await this.audio.startRecording();
      if (!recordingStarted) {
        throw new Error('Microphone permission not granted. Check the popup window for instructions to enable access.');
      }

      console.log('[startLiveChat] Audio recording started successfully');
      this.ui.showAudioVisualizer();
      this.ui.updateStatus('🎤 Live chat active - Voice + Screen sharing');
      this.ui.updateChatActionButton(true);
    } catch (error) {
      console.error('[startLiveChat] Error:', error);
      this.ui.updateStatus(`⚠️ ${error.message}`, true);
      this.stopLiveChat();
    }
  }

  /**
   * Stop live chat
   */
  stopLiveChat() {
    if (!this.isLiveChatActive) {
      return;
    }

    console.log('[stopLiveChat] Stopping...');
    this.isLiveChatActive = false;

    // Stop components
    this.audio.stopRecording();
    this.capture.stopAutoCapture();
    this.ui.hideAudioVisualizer();

    if (this.gemini) {
      this.gemini.disconnect();
    }

    this.ui.updateStatus('Live chat stopped');
    this.ui.updateChatActionButton(false);
  }

  /**
   * Handle Gemini connection close
   */
  handleGeminiClose(event) {
    console.log('[handleGeminiClose] Event code:', event.code);

    if (event.code === 1000 && !this.isLiveChatActive) {
      this.ui.updateStatus('Call ended');
    } else if (event.code !== 1000) {
      this.ui.updateStatus(`Disconnected (Code: ${event.code})`, true);
    }

    if (this.isLiveChatActive) {
      this.stopLiveChat();
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[sidepanel] Received message:', request.action);

  if (request.action === 'closeSidePanel') {
    console.log('[sidepanel] Close request received');
    window.close();
  }

  return true;
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Gemini Live Assistant');
  new GeminiLiveAssistant();
});
