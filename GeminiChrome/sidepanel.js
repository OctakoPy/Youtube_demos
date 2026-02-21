// sidepanel.js - Main orchestrator for Gemini Live Assistant
// Coordinates managers for audio, screen, transcript, and Gemini session

import { STATUS_MESSAGES } from './config.js';
import { UIManager } from './UIManager.js';
import { TranscriptManager } from './TranscriptManager.js';
import { AudioManager } from './AudioManager.js';
import { ScreenCaptureManager } from './ScreenCaptureManager.js';
import { GeminiSessionManager } from './GeminiSessionManager.js';

console.log('Gemini Live Assistant - Side panel script loaded.');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Side panel received message:', request.action, request);
  
  if (request.action === 'closeSidePanel') {
    console.log('Side panel received close request');
    window.close();
    return true;
  }
  
  return true;
});

class GeminiLiveAssistant {
  constructor() {
    // State
    this.apiKey = 'AIzaSyCo_1TA0QImAMXq4YR4PjGBd1QUc3H7Hg8';
    this.genAI = null;
    this.isLiveChatActive = false;
    
    // Managers
    this.ui = new UIManager();
    this.transcript = new TranscriptManager(document.getElementById('transcriptMessages'));
    this.audio = new AudioManager(
      (level) => this.handleAudioLevel(level),
      (msg, isError = false) => this.updateStatus(msg, isError)
    );
    this.screenCapture = new ScreenCaptureManager(
      document.getElementById('imagePreview'),
      document.getElementById('imagePreviewContainer'),
      document.getElementById('removeImageBtn'),
      (msg, isError = false) => this.updateStatus(msg, isError)
    );
    this.geminiSession = null;
    
    // Initialize
    this.setupEventListeners();
    this.ui.showMainInterface();
    this.initializeGeminiAI();
  }

  setupEventListeners() {
    this.ui.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
    this.ui.apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveApiKey();
      }
    });
    
    this.ui.chatActionBtn.addEventListener('click', () => {
      if (this.isLiveChatActive) {
        this.stopLiveChat();
      } else {
        this.startLiveChat();
      }
    });
    
    this.ui.startLiveChatBtn.addEventListener('click', () => this.startLiveChat());
    this.ui.stopLiveChatBtn.addEventListener('click', () => this.stopLiveChat());
    this.ui.removeImageBtn.addEventListener('click', () => this.screenCapture.removeImage());
  }

  async loadApiKey() {
    try {
      if (chrome?.storage?.local) {
        const result = await chrome.storage.local.get(['geminiApiKey']);
        if (result.geminiApiKey) {
          this.apiKey = result.geminiApiKey;
          this.ui.showMainInterface();
          this.updateStatus(STATUS_MESSAGES.READY);
        } else {
          this.updateStatus('Please enter your API key');
        }
      } else {
        const response = await chrome.runtime.sendMessage({
          action: 'getStoredData',
          key: 'geminiApiKey'
        });
        
        if (response && response.success && response.value) {
          this.apiKey = response.value;
          this.ui.showMainInterface();
          this.updateStatus(STATUS_MESSAGES.READY);
        } else {
          this.updateStatus('Please enter your API key');
        }
      }
    } catch (error) {
      console.error('Error loading API key:', error);
      this.updateStatus('Please enter your API key');
    }
  }

  async saveApiKey() {
    const apiKey = this.ui.apiKeyInput.value.trim();
    if (!apiKey) {
      this.updateStatus('Please enter a valid API key', true);
      return;
    }

    console.log('[saveApiKey] Starting to save API key...');
    this.updateStatus('Saving API key...');
    
    try {
      let saved = false;
      
      if (chrome?.storage?.local) {
        console.log('[saveApiKey] Using direct chrome.storage.local');
        await chrome.storage.local.set({ geminiApiKey: apiKey });
        saved = true;
      } else {
        console.log('[saveApiKey] Using background script messaging');
        const response = await chrome.runtime.sendMessage({
          action: 'setStoredData',
          key: 'geminiApiKey',
          value: apiKey
        });
        
        console.log('[saveApiKey] Background response:', response);
        
        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to save via background script');
        }
        saved = true;
      }
      
      if (saved) {
        console.log('[saveApiKey] API key saved successfully');
        this.apiKey = apiKey;
        this.ui.apiKeyInput.value = '';
        this.ui.showMainInterface();
        this.updateStatus('API key saved! Initializing...');
        await this.initializeGeminiAI();
      }
    } catch (error) {
      console.error('[saveApiKey] Error saving API key:', error);
      this.updateStatus('Error saving API key. Please try again.', true);
    }
  }

  async initializeGeminiAI() {
    try {
      if (!window.GoogleGenAI) {
        await this.loadGeminiLibrary();
      }
      
      this.genAI = new window.GoogleGenAI({
        apiKey: this.apiKey,
        apiVersion: 'v1alpha'
      });
      
      // Create Gemini session manager
      this.geminiSession = new GeminiSessionManager(
        this.genAI,
        (text, isUser, isStreaming) => this.handleTranscript(text, isUser, isStreaming),
        (audioData) => this.handleAudioResponse(audioData),
        (msg, isError = false) => this.updateStatus(msg, isError),
        () => this.handleSetupComplete(),
        () => this.handleTurnComplete()
      );
      
      this.updateStatus(STATUS_MESSAGES.READY);
      if (this.ui.startLiveChatBtn) {
        this.ui.startLiveChatBtn.disabled = false;
      }
      
      await this.checkMicrophonePermission();
    } catch (error) {
      console.error('Error initializing Gemini AI:', error);
      this.updateStatus('Error initializing Gemini AI', true);
    }
  }

  async loadGeminiLibrary() {
    console.log('[loadGeminiLibrary] Checking for Gemini Live library...');
    
    if (window.GoogleGenAI) {
      console.log('[loadGeminiLibrary] Gemini Live library already available');
      return Promise.resolve();
    }
    
    console.error('[loadGeminiLibrary] No Gemini Live library found');
    throw new Error('Gemini Live library not available');
  }

  async checkMicrophonePermission() {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      console.log('[checkMicrophonePermission] Current status:', permissionStatus.state);
      
      permissionStatus.onchange = () => {
        console.log('[checkMicrophonePermission] Permission changed to:', permissionStatus.state);
      };
    } catch (error) {
      console.log('[checkMicrophonePermission] Permission API not available:', error);
    }
  }

  // Live Chat Control
  async startLiveChat() {
    if (this.isLiveChatActive) {
      return;
    }
    
    console.log('[startLiveChat] Starting live screen share chat...');
    this.isLiveChatActive = true;
    this.ui.updateChatActionButtonState(true);
    
    if (this.ui.startLiveChatBtn) {
      this.ui.startLiveChatBtn.style.display = 'none';
    }
    if (this.ui.stopLiveChatBtn) {
      this.ui.stopLiveChatBtn.style.display = 'inline-flex';
    }
    
    this.updateStatus('Starting live chat...');
    this.transcript.clear();
    
    try {
      await this.startScreenshotCapture();
      await this.startVoiceRecording();
      this.ui.showAudioVisualizer();
      this.updateStatus('Live chat active - Voice + Screen sharing');
    } catch (error) {
      console.error('[startLiveChat] Error occurred:', error);
      this.updateStatus(`Error starting live chat: ${error.message}`, true);
      this.stopLiveChat();
    }
  }

  async stopLiveChat() {
    if (!this.isLiveChatActive) {
      return;
    }
    
    console.log('[stopLiveChat] Stopping live screen share chat...');
    this.isLiveChatActive = false;
    this.ui.updateChatActionButtonState(false);
    
    if (this.ui.startLiveChatBtn) {
      this.ui.startLiveChatBtn.style.display = 'inline-flex';
    }
    if (this.ui.stopLiveChatBtn) {
      this.ui.stopLiveChatBtn.style.display = 'none';
    }
    
    this.screenCapture.stopAutoCapture();
    this.audio.stopRecording();
    this.ui.hideAudioVisualizer();
    
    this.updateStatus('Live chat stopped');
  }

  async startScreenshotCapture() {
    console.log('[startScreenshotCapture] Starting screenshot capture...');
    
    try {
      const result = await this.screenCapture.captureScreenshot();
      
      if (result.success) {
        this.screenCapture.startAutoCapture();
      } else {
        throw new Error('Failed to capture initial screenshot');
      }
    } catch (error) {
      console.error('[startScreenshotCapture] Error:', error);
      throw error;
    }
  }

  async startVoiceRecording() {
    console.log('[startVoiceRecording] Starting voice recording...');
    
    try {
      if (!this.genAI) {
        throw new Error('Gemini AI not initialized');
      }
      
      console.log('[startVoiceRecording] Requesting microphone permission...');
      const hasPermission = await this.audio.requestMicrophonePermission();
      console.log('[startVoiceRecording] Microphone permission result:', hasPermission);
      
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }
      
      console.log('[startVoiceRecording] Initializing audio system...');
      const audioSystemReady = await this.audio.initialize();
      console.log('[startVoiceRecording] Audio system ready:', audioSystemReady);
      
      if (!audioSystemReady) {
        throw new Error('Audio system failed to initialize');
      }
      
      // Connect to Gemini
      const connected = await this.geminiSession.connect();
      if (!connected) {
        throw new Error('Failed to connect to Gemini');
      }
      
      // Wait for setup to complete
      console.log('[startVoiceRecording] Waiting for Gemini setup...');
      const setupComplete = await this.geminiSession.waitForSetup();
      if (!setupComplete) {
        throw new Error('Gemini setup timeout');
      }
      
      // Start recording
      console.log('[startVoiceRecording] Starting audio recording...');
      const recordingStarted = await this.audio.startRecording((audioMediaBlob) => {
        this.geminiSession.sendAudioData(audioMediaBlob);
      });
      
      if (!recordingStarted) {
        throw new Error('Failed to start recording');
      }
      
      console.log('[startVoiceRecording] Voice recording started successfully');
    } catch (error) {
      console.error('[startVoiceRecording] Error:', error);
      throw error;
    }
  }

  // Status and Transcript Handling
  updateStatus(message, isError = false) {
    this.ui.updateStatus(message, isError, this.isLiveChatActive);
    
    if (this.isLiveChatActive && this.transcript.shouldShowInTranscript(message)) {
      this.transcript.addSystemMessage(message);
    }
  }

  handleAudioLevel(level) {
    this.ui.updateAudioLevel(level);
  }

  handleTranscript(text, isUser, isStreaming) {
    this.transcript.addMessage(text, isUser, isStreaming);
  }

  handleAudioResponse(audioData) {
    try {
      const binaryString = window.atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this.audio.enqueueAudio(bytes.buffer);
    } catch (error) {
      console.error('[handleAudioResponse] Error decoding audio:', error);
    }
  }

  handleSetupComplete() {
    console.log('[handleSetupComplete] Gemini setup complete');
    
    const imageBlob = this.screenCapture.getCurrentImageBlob();
    if (imageBlob && this.geminiSession.getSession()) {
      this.geminiSession.sendImageData(imageBlob);
    }
  }

  handleTurnComplete() {
    console.log('[handleTurnComplete] Turn complete');
    this.transcript.finishTurn(true);
    this.transcript.finishTurn(false);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Gemini Live Assistant');
  new GeminiLiveAssistant();
});
