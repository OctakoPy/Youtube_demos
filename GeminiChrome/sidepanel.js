// sidepanel.js - Elderly-Friendly Web Assistant
// Helps elderly users navigate and accomplish tasks on websites

import { STATUS_MESSAGES } from './config.js';
import { API_CONFIG } from './config-api.js';
import { UIManager } from './UIManager.js';
import { TranscriptManager } from './TranscriptManager.js';
import { AudioManager } from './AudioManager.js';
import { ScreenCaptureManager } from './ScreenCaptureManager.js';
import { GeminiSessionManager } from './GeminiSessionManager.js';
import { TaskManager } from './TaskManager.js';
import { CSSInjector } from './CSSInjector.js';

console.log('Elderly-Friendly Web Assistant loaded');

// Prevent double initialization
if (window.ElderlyWebAssistantLoaded) {
  console.log('Elderly Web Assistant already loaded, skipping initialization');
} else {
  window.ElderlyWebAssistantLoaded = true;

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

class ElderlyWebAssistant {
  constructor() {
    // State
    this.apiKey = API_CONFIG.GEMINI_API_KEY;
    this.genAI = null;
    this.isAssistantActive = false;
    this.currentTab = null;
    this.simplifyEnabled = false;
    
    // Managers
    this.ui = new UIManager();
    this.transcript = new TranscriptManager(document.getElementById('transcriptMessages'));
    this.taskManager = new TaskManager((msg) => this.updateStatus(msg));
    this.cssInjector = new CSSInjector();
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
    this.screenshotInterval = null;
    
    // Initialize
    this.setupEventListeners();
    this.initializeUI();
    this.getCurrentTab();
    this.initializeGeminiAI();
  }

  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        this.currentTab = tabs[0];
        console.log('[getCurrentTab] Current tab:', this.currentTab.url);
      }
    } catch (error) {
      console.warn('[getCurrentTab] Error getting current tab:', error);
    }
  }

  initializeUI() {
    // Hide API section and show main interface
    document.getElementById('apiKeySection').style.display = 'none';
    document.getElementById('mainInterface').style.display = 'flex';
    this.updateStatus('Ready to help! Click "Start Listening" to begin.');
  }

  setupEventListeners() {
    // Start/Stop buttons
    document.getElementById('startBtn').addEventListener('click', () => this.startAssistant());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopAssistant());
    
    // Remove image button
    document.getElementById('removeImageBtn')?.addEventListener('click', () => {
      this.screenCapture.removeImage();
    });

    // Listen for tab updates to detect page navigation
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.currentTab && tabId === this.currentTab.id && changeInfo.status === 'complete') {
        console.log('[setupEventListeners] Page loaded:', tab.url);
        // If assistant is active, send the new page context
        if (this.isAssistantActive) {
          this.sendPageContext();
        }
      }
    });
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
      
      this.updateStatus('System ready! I can help you with any task on this website.');
      this.makeStartButtonEnabled(true);
    } catch (error) {
      console.error('Error initializing Gemini AI:', error);
      this.updateStatus('Error initializing system. Please refresh the page.', true);
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

  // Assistant Control
  async startAssistant() {
    if (this.isAssistantActive) {
      return;
    }
    
    console.log('[startAssistant] Starting assistant...');
    this.isAssistantActive = true;
    this.updateUIState(true);
    this.updateStatus('Listening... Tell me what you need help with.');
    this.transcript.clear();
    this.showTranscriptMessages();
    
    try {
      // Request microphone permission
      console.log('[startAssistant] Requesting microphone permission...');
      const hasPermission = await this.audio.requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }
      
      // Initialize audio
      console.log('[startAssistant] Initializing audio...');
      const audioReady = await this.audio.initialize();
      if (!audioReady) {
        throw new Error('Audio initialization failed');
      }
      
      // Connect to Gemini
      console.log('[startAssistant] Connecting to Gemini...');
      const connected = await this.geminiSession.connect();
      if (!connected) {
        throw new Error('Failed to connect to Gemini');
      }
      
      // Wait for setup
      console.log('[startAssistant] Waiting for Gemini setup...');
      const setupComplete = await this.geminiSession.waitForSetup();
      if (!setupComplete) {
        throw new Error('Gemini setup timeout');
      }
      
      // Simplify the website if not already done
      if (!this.simplifyEnabled && this.currentTab) {
        console.log('[startAssistant] Simplifying website...');
        await this.simplifyWebsiteForUser();
      }
      
      // Capture initial screenshot
      const screenshotResult = await this.screenCapture.captureScreenshot();
      if (!screenshotResult.success && screenshotResult.success !== undefined) {
        console.warn('[startAssistant] Screenshot capture failed, but continuing...');
      }
      
      // Start recording
      console.log('[startAssistant] Starting voice recording...');
      const recordingStarted = await this.audio.startRecording((audioMediaBlob) => {
        this.geminiSession.sendAudioData(audioMediaBlob);
      });
      
      if (!recordingStarted) {
        throw new Error('Failed to start recording');
      }
      
      this.updateStatus('I\'m listening... Go ahead and tell me what you need!');
      console.log('[startAssistant] Assistant started successfully');
    } catch (error) {
      console.error('[startAssistant] Error:', error);
      this.updateStatus(`Error: ${error.message}`, true);
      this.stopAssistant();
    }
  }

  async stopAssistant() {
    if (!this.isAssistantActive) {
      return;
    }
    
    console.log('[stopAssistant] Stopping assistant...');
    this.isAssistantActive = false;
    this.updateUIState(false);
    
    // Stop audio and Gemini
    this.screenCapture.stopAutoCapture();
    this.stopPeriodicScreenshots();
    this.audio.stopRecording();
    
    this.updateStatus('Assistant stopped. Click "Start Listening" to begin again.');
    console.log('[stopAssistant] Assistant stopped');
  }

  updateUIState(isActive) {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (isActive) {
      startBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
    } else {
      startBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
    }
  }

  makeStartButtonEnabled(enabled) {
    document.getElementById('startBtn').disabled = !enabled;
  }

  // Website Simplification
  async simplifyWebsiteForUser() {
    if (!this.currentTab) {
      console.warn('[simplifyWebsiteForUser] No current tab');
      return;
    }
    
    try {
      console.log('[simplifyWebsiteForUser] Simplifying website for user...');
      // Send CSS injection message to content script
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'injectCSS',
        css: this.generateSimplificationCSS(),
        description: 'Website simplified for elderly user'
      });
      this.simplifyEnabled = true;
      this.updateStatus('Website simplified for easier use!');
    } catch (error) {
      console.warn('[simplifyWebsiteForUser] Error:', error);
      // Don't stop the assistant if simplification fails
    }
  }

  generateSimplificationCSS() {
    return `
      /* Simplify layout */
      .sidebar, .comments-section, .social-widgets, .ads,
      [class*="sidebar"], [class*="comment"], [class*="ad"],
      aside, footer {
        display: none !important;
      }
      
      /* Enlarge text and buttons */
      body {
        font-size: 18px !important;
        line-height: 1.8 !important;
      }
      
      button, a, [role="button"], input, textarea {
        font-size: 16px !important;
        padding: 12px 16px !important;
        min-height: 44px !important;
      }
      
      h1, h2, h3 {
        font-size: 28px !important;
        margin: 20px 0 15px 0 !important;
      }
      
      /* High contrast */
      a {
        color: #0066cc !important;
        text-decoration: underline !important;
      }
      
      button {
        background-color: #0066cc !important;
        color: white !important;
        border: 2px solid #003366 !important;
        border-radius: 6px !important;
        cursor: pointer !important;
      }
      
      button:hover {
        background-color: #0052a3 !important;
      }
      
      /* Reduce animations */
      * {
        animation: none !important;
      }
    `;
  }

  // Status and Messages
  updateStatus(message, isError = false) {
    console.log('[updateStatus]', message, isError);
    const statusText = document.getElementById('statusText');
    const statusSubtitle = document.getElementById('statusSubtitle');
    
    if (statusText) {
      statusText.textContent = message;
      statusText.style.color = isError ? '#d32f2f' : '#333';
    }
    
    if (isError && statusSubtitle) {
      statusSubtitle.textContent = 'Please try again or click Stop to reset.';
    }
    
    if (this.isAssistantActive && this.transcript.shouldShowInTranscript(message)) {
      this.transcript.addSystemMessage(message);
    }
  }

  showTranscriptMessages() {
    const transcriptDiv = document.getElementById('transcriptMessages');
    if (transcriptDiv) {
      transcriptDiv.style.display = 'block';
      transcriptDiv.innerHTML = '';
    }
  }

  handleAudioLevel(level) {
    // Optionally update visualization
  }

  handleTranscript(text, isUser, isStreaming) {
    console.log('[handleTranscript]', { text, isUser, isStreaming });
    
    if (!text) return;
    
    // Add to transcript
    this.transcript.addMessage(text, isUser, isStreaming);
    
    // If this is user input (final), analyze the task
    if (isUser && !isStreaming && text.length > 5) {
      this.analyzeAndGuideTask(text);
    }
  }

  async analyzeAndGuideTask(userSaid) {
    console.log('[analyzeAndGuideTask] User said:', userSaid);
    
    // Analyze the task
    const task = this.taskManager.analyzeUserRequest(userSaid);
    
    if (task) {
      console.log('[analyzeAndGuideTask] Detected task:', task.type);
      this.updateStatus(`Great! I'll help you ${task.description}.`);
      // Could extend this to guide through steps
    } else {
      // Generic help message
      this.updateStatus('I can help you navigate this website. What would you like to do?');
    }
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
      console.error('[handleAudioResponse] Error:', error);
    }
  }

  async handleSetupComplete() {
    console.log('[handleSetupComplete] Setup complete');
    
    // Send system message to set context and role
    const systemMessage = this.generateSystemPrompt();
    await this.geminiSession.sendSystemPrompt(systemMessage);
    
    // Send initial screenshot
    const imageBlob = this.screenCapture.getCurrentImageBlob();
    if (imageBlob && this.geminiSession.getSession()) {
      this.geminiSession.sendImageData(imageBlob);
    }
    
    // Send HTML context of the current page
    await this.sendPageContext();
    
    // Start periodic screenshot sending every 3 seconds
    this.startPeriodicScreenshots();
    
    this.updateStatus('I can see your screen now. Tell me what you need help with!');
  }

  handleTurnComplete() {
    console.log('[handleTurnComplete] Turn complete');
    this.transcript.finishTurn(true);
    this.transcript.finishTurn(false);
  }

  // Generate system prompt for Gemini to understand its role
  generateSystemPrompt() {
    return `You are a helpful assistant for elderly users. Your role is to:
1. Help them navigate and use websites
2. Simplify complex tasks into easy steps
3. Read text clearly and speak in simple language
4. Be patient and encouraging
5. Remember they may use voice commands
6. Speak slowly and clearly when responding

The user will show you their screen with a screenshot. They may ask you to help them with tasks like:
- Checking email
- Online shopping
- Banking
- Searching for information
- Navigating websites

Always:
- Use short sentences
- Speak one instruction at a time
- Ask for confirmation before taking actions
- Explain what you're seeing on the screen
- Be friendly and warm in tone

Current page context will be provided so you understand what they're looking at.`;
  }

  // Send page context (HTML structure) to Gemini
  async sendPageContext() {
    if (!this.currentTab) {
      console.log('[sendPageContext] No current tab, skipping');
      return;
    }

    try {
      console.log('[sendPageContext] Requesting page HTML from content script...');
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getPageHTML'
      });

      if (response && response.html) {
        // Sanitize and summarize the HTML to avoid overly large context
        const htmlSummary = this.summarizePageHTML(response.html, response.title, response.url);
        await this.geminiSession.sendTextMessage(htmlSummary);
        console.log('[sendPageContext] Page context sent to Gemini');
      }
    } catch (error) {
      console.warn('[sendPageContext] Error getting page context:', error);
      // Don't fail if context can't be sent
    }
  }

  // Summarize HTML to extract key structure and content
  summarizePageHTML(html, pageTitle, pageUrl) {
    try {
      // Create a DOM parser to extract structure
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract key information
      const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
        .map(h => h.textContent.trim())
        .slice(0, 10);

      const buttons = Array.from(doc.querySelectorAll('button, [role="button"], input[type="button"]'))
        .map(b => b.textContent.trim() || b.value)
        .filter(b => b.length > 0 && b.length < 50)
        .slice(0, 10);

      const links = Array.from(doc.querySelectorAll('a'))
        .map(a => a.textContent.trim())
        .filter(l => l.length > 0 && l.length < 50)
        .slice(0, 15);

      const formFields = Array.from(doc.querySelectorAll('input, textarea, select'))
        .map(f => {
          const label = f.labels?.[0]?.textContent || f.placeholder || f.name || f.type;
          return label.trim();
        })
        .filter(f => f.length > 0 && f.length < 50)
        .slice(0, 10);

      return `PAGE CONTEXT:
Title: ${pageTitle || 'Unknown'}
URL: ${pageUrl || 'Unknown'}

Key headings on this page:
${headings.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Available buttons/actions:
${buttons.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Available links:
${links.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Form fields on this page:
${formFields.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Use this context to understand what this page contains and help the user navigate it.`;
    } catch (error) {
      console.warn('[summarizePageHTML] Error parsing HTML:', error);
      return `PAGE: ${pageTitle || 'Unknown'} at ${pageUrl || 'Unknown'}`;
    }
  }

  // Start sending screenshots every 3 seconds
  startPeriodicScreenshots() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
    }

    console.log('[startPeriodicScreenshots] Starting periodic screenshot sending...');
    
    this.screenshotInterval = setInterval(async () => {
      if (!this.isAssistantActive || !this.geminiSession.getIsSetupComplete()) {
        return;
      }

      try {
        const imageBlob = this.screenCapture.getCurrentImageBlob();
        if (imageBlob) {
          await this.geminiSession.sendImageData(imageBlob);
          console.log('[startPeriodicScreenshots] Screenshot sent to Gemini');
        }
      } catch (error) {
        console.warn('[startPeriodicScreenshots] Error sending screenshot:', error.message);
      }
    }, 3000); // Send every 3 seconds
  }

  // Stop sending periodic screenshots
  stopPeriodicScreenshots() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
      console.log('[stopPeriodicScreenshots] Periodic screenshots stopped');
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Elderly Web Assistant');
  new ElderlyWebAssistant();
});

} // End of double-initialization check
