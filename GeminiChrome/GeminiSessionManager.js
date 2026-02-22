// GeminiSessionManager.js - Handles Gemini Live API connection and callbacks

import { GEMINI_CONFIG, PERMISSIONS_CONFIG } from './config.js';
import { waitFor } from './utils.js';

export class GeminiSessionManager {
  constructor(
    genAI,
    onTranscript,
    onAudioResponse,
    onStatusUpdate,
    onSetupComplete,
    onTurnComplete
  ) {
    this.genAI = genAI;
    this.session = null;
    this.isSetupComplete = false;
    
    this.onTranscript = onTranscript;
    this.onAudioResponse = onAudioResponse;
    this.onStatusUpdate = onStatusUpdate;
    this.onSetupComplete = onSetupComplete;
    this.onTurnComplete = onTurnComplete;
  }

  async connect() {
    this.onStatusUpdate('Connecting to Gemini...');
    console.log('[GeminiSessionManager] Connecting...');
    this.isSetupComplete = false;
    
    try {
      if (this.session) {
        try {
          this.session.close();
        } catch (e) {
          console.warn('[GeminiSessionManager] Error closing previous session:', e);
        }
        this.session = null;
      }
      
      this.session = await this.genAI.live.connect({
        model: GEMINI_CONFIG.MODEL,
        config: {
          responseModalities: GEMINI_CONFIG.RESPONSE_MODALITIES
        },
        callbacks: {
          onopen: () => this.handleOpen(),
          onmessage: (eventMessage) => this.handleMessage(eventMessage),
          onerror: (errorEvent) => this.handleError(errorEvent),
          onclose: (closeEvent) => this.handleClose(closeEvent)
        }
      });
      
      console.log('[GeminiSessionManager] Connection initiated');
      return true;
    } catch (error) {
      console.error('[GeminiSessionManager] Error:', error);
      this.onStatusUpdate(`Connection failed: ${error.message}`, true);
      return false;
    }
  }

  handleOpen() {
    console.log('[GeminiSessionManager] Connection established');
    this.onStatusUpdate('Connected! Finalizing setup...');
  }

  handleMessage(response) {
    if (response?.setupComplete) {
      console.log('[GeminiSessionManager] Setup complete');
      this.isSetupComplete = true;
      this.onSetupComplete();
      this.onStatusUpdate('Ready to chat');
    }
    
    if (response?.serverContent) {
      // Handle input transcription (user's speech)
      if (response.serverContent.inputTranscription) {
        console.log('[TRANSCRIPT] INPUT:', JSON.stringify(response.serverContent.inputTranscription.text));
        this.onTranscript(response.serverContent.inputTranscription.text, true, true);
      }
      
      // Handle output transcription (AI's speech)
      if (response.serverContent.outputTranscription) {
        console.log('[TRANSCRIPT] OUTPUT:', JSON.stringify(response.serverContent.outputTranscription.text));
        this.onTranscript(response.serverContent.outputTranscription.text, false, true);
      }
      
      // Handle model turn (text and audio responses)
      if (response.serverContent.modelTurn?.parts) {
        response.serverContent.modelTurn.parts.forEach(part => {
          if (part.inlineData?.data) {
            console.log('[GeminiSessionManager] Received audio data:', part.inlineData.mimeType);
            this.onAudioResponse(part.inlineData.data);
          }
        });
      }
      
      // Handle turn complete
      if (response.serverContent.turnComplete) {
        console.log('[GeminiSessionManager] Turn complete');
        this.onTurnComplete();
      }
    }
  }

  handleError(errorEvent) {
    const errorMessage = errorEvent.message || errorEvent.error?.message || 'WebSocket error';
    console.error('[GeminiSessionManager] Error:', errorEvent, 'Message:', errorMessage);
    this.onStatusUpdate(`Connection error: ${errorMessage}`, true);
  }

  handleClose(closeEvent) {
    let statusMsg = 'Disconnected';
    if (!closeEvent.wasClean) {
      statusMsg = `Disconnected unexpectedly (Code: ${closeEvent.code})`;
      this.onStatusUpdate(statusMsg, true);
    } else if (closeEvent.code === 1000) {
      statusMsg = 'Call ended';
      this.onStatusUpdate(statusMsg);
    }
    
    console.warn(`[GeminiSessionManager] Closed: Code ${closeEvent.code}, Reason: ${closeEvent.reason}`);
  }

  async sendAudioData(audioMediaBlob) {
    if (this.session && this.isSetupComplete) {
      try {
        this.session.sendRealtimeInput({ media: audioMediaBlob });
      } catch (e) {
        console.error('[GeminiSessionManager] Error sending audio:', e);
      }
    } else {
      console.warn('[GeminiSessionManager] Cannot send audio - session not ready or not set up');
    }
  }

  async sendImageData(imageBlob) {
    if (this.session && this.isSetupComplete) {
      try {
        this.session.sendRealtimeInput({ media: imageBlob });
        console.log('[GeminiSessionManager] Sent image to Gemini');
      } catch (e) {
        console.error('[GeminiSessionManager] Error sending image:', e);
      }
    }
  }

  async sendTextMessage(text) {
    if (this.session && this.isSetupComplete) {
      try {
        this.session.sendRealtimeInput({ text: text });
        console.log('[GeminiSessionManager] Sent text to Gemini:', text.substring(0, 100));
      } catch (e) {
        console.error('[GeminiSessionManager] Error sending text:', e);
      }
    }
  }

  async sendSystemPrompt(systemPrompt) {
    if (this.session && this.isSetupComplete) {
      try {
        this.session.sendRealtimeInput({ text: systemPrompt });
        console.log('[GeminiSessionManager] Sent system prompt to Gemini');
      } catch (e) {
        console.error('[GeminiSessionManager] Error sending system prompt:', e);
      }
    }
  }

  close() {
    if (this.session) {
      try {
        this.session.close();
      } catch (e) {
        console.warn('[GeminiSessionManager] Error closing session:', e);
      }
      this.session = null;
    }
  }

  async waitForSetup(timeoutMs = PERMISSIONS_CONFIG.SETUP_TIMEOUT_MS) {
    return waitFor(() => this.isSetupComplete, timeoutMs, 500);
  }

  getIsSetupComplete() {
    return this.isSetupComplete;
  }

  getSession() {
    return this.session;
  }
}
