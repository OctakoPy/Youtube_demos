// UIManager.js - Handles UI element management and status updates

import { UI_CONFIG, STATUS_MESSAGES } from './config.js';

export class UIManager {
  constructor() {
    this.statusText = null;
    this.statusSubtitle = null;
    this.breathingIndicator = null;
    this.chatActionBtn = null;
    this.chatActionIcon = null;
    
    this.apiKeySection = null;
    this.mainInterface = null;
    this.apiKeyInput = null;
    this.saveApiKeyBtn = null;
    
    this.startLiveChatBtn = null;
    this.stopLiveChatBtn = null;
    this.imagePreviewContainer = null;
    this.imagePreview = null;
    this.removeImageBtn = null;
    
    this.chatMessages = null;
    this.transcriptMessages = null;
    
    this.audioVisualizer = null;
    this.audioLevelFill = null;
    this.audioLevelText = null;
    this.audioWaveform = null;
    this.waveformCtx = null;
    
    this.audioLevelHistory = new Array(UI_CONFIG.AUDIO_LEVEL_HISTORY_SIZE).fill(0);
    this.currentAudioLevel = 0;
    this.animationFrameId = null;
    
    this.isLiveChatActive = false;
    
    this.initializeElements();
  }

  initializeElements() {
    // Header elements
    this.statusText = document.getElementById('statusText');
    this.statusSubtitle = document.getElementById('statusSubtitle');
    this.breathingIndicator = document.getElementById('breathingIndicator');
    this.chatActionBtn = document.getElementById('chatActionBtn');
    this.chatActionIcon = document.getElementById('chatActionIcon');
    
    // API Key elements
    this.apiKeySection = document.getElementById('apiKeySection');
    this.mainInterface = document.getElementById('mainInterface');
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    
    // Live chat elements
    this.startLiveChatBtn = document.getElementById('startLiveChatBtn');
    this.stopLiveChatBtn = document.getElementById('stopLiveChatBtn');
    this.imagePreviewContainer = document.getElementById('imagePreviewContainer');
    this.imagePreview = document.getElementById('imagePreview');
    this.removeImageBtn = document.getElementById('removeImageBtn');
    
    // Chat elements
    this.chatMessages = document.getElementById('chatMessages');
    
    // Transcript elements
    this.transcriptMessages = document.getElementById('transcriptMessages');
    
    // Audio visualization elements
    this.audioVisualizer = document.getElementById('audioVisualizer');
    this.audioLevelFill = document.getElementById('audioLevelFill');
    this.audioLevelText = document.getElementById('audioLevelText');
    this.audioWaveform = document.getElementById('audioWaveform');
    this.waveformCtx = this.audioWaveform ? this.audioWaveform.getContext('2d') : null;
  }

  updateStatus(message, isError = false, isLiveChatActive = false) {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
    
    this.updateBreathingIndicator(message, isError, isLiveChatActive);
    this.updateChatActionButton(isLiveChatActive);
    
    console.log(`[Status] ${message}`);
  }

  updateBreathingIndicator(message, isError, isRecording) {
    if (!this.breathingIndicator) return;
    
    this.breathingIndicator.className = 'breathing-indicator';
    
    if (isError) {
      this.breathingIndicator.classList.add('error');
    } else if (isRecording) {
      if (message.includes('Playing') || message.includes('thinking')) {
        this.breathingIndicator.classList.add('thinking');
      } else {
        this.breathingIndicator.classList.add('recording');
      }
    }
  }

  updateChatActionButton(isLiveChatActive) {
    if (!this.chatActionBtn || !this.chatActionIcon) return;
    
    this.chatActionBtn.className = 'chat-action-btn';
    
    if (isLiveChatActive) {
      this.chatActionIcon.className = 'fas fa-stop';
      this.chatActionBtn.classList.add('recording');
      if (this.statusSubtitle) {
        this.statusSubtitle.textContent = 'Live conversation active';
      }
    } else {
      this.chatActionIcon.className = 'fas fa-play';
      if (this.statusSubtitle) {
        this.statusSubtitle.textContent = 'Click to start live conversation with your browsing assistant';
      }
    }
  }

  showMainInterface() {
    if (this.apiKeySection) this.apiKeySection.style.display = 'none';
    if (this.mainInterface) this.mainInterface.style.display = 'block';
  }

  showApiKeySection() {
    if (this.apiKeySection) this.apiKeySection.style.display = 'block';
    if (this.mainInterface) this.mainInterface.style.display = 'none';
  }

  showAudioVisualizer() {
    if (this.audioVisualizer) {
      this.audioVisualizer.style.display = 'block';
      this.startAudioVisualization();
    }
  }

  hideAudioVisualizer() {
    if (this.audioVisualizer) {
      this.audioVisualizer.style.display = 'none';
      this.stopAudioVisualization();
    }
  }

  addChatMessage(content, isUser = false) {
    if (!this.chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'user-message' : 'assistant-message';
    messageDiv.textContent = content;
    
    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  updateAudioLevel(level) {
    this.currentAudioLevel = Math.min(100, Math.max(0, level * 100));
    
    // Update breathing indicator intensity based on audio level
    if (this.breathingIndicator) {
      const intensity = Math.max(
        UI_CONFIG.INTENSITY_MIN,
        UI_CONFIG.INTENSITY_MIN + (this.currentAudioLevel / 100) * (UI_CONFIG.INTENSITY_MAX - UI_CONFIG.INTENSITY_MIN)
      );
      this.breathingIndicator.style.transform = `scale(${intensity})`;
    }
    
    // Add to history for waveform
    this.audioLevelHistory.shift();
    this.audioLevelHistory.push(this.currentAudioLevel);
  }

  startAudioVisualization() {
    if (this.animationFrameId) return;
    
    const animate = () => {
      this.updateAudioVisualization();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  stopAudioVisualization() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.audioLevelFill) {
      this.audioLevelFill.style.width = '0%';
    }
    if (this.audioLevelText) {
      this.audioLevelText.textContent = '0%';
    }
    if (this.waveformCtx) {
      this.waveformCtx.clearRect(0, 0, this.audioWaveform.width, this.audioWaveform.height);
    }
  }

  updateAudioVisualization() {
    if (this.audioLevelFill && this.audioLevelText) {
      const smoothedLevel = this.currentAudioLevel * UI_CONFIG.AUDIO_LEVEL_SMOOTH_FACTOR;
      this.audioLevelFill.style.width = `${smoothedLevel}%`;
      this.audioLevelText.textContent = `${Math.round(smoothedLevel)}%`;
    }

    if (this.waveformCtx && this.audioWaveform) {
      const ctx = this.waveformCtx;
      const canvas = this.audioWaveform;
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const stepX = width / (this.audioLevelHistory.length - 1);
      
      for (let i = 0; i < this.audioLevelHistory.length; i++) {
        const x = i * stepX;
        const y = height - (this.audioLevelHistory[i] / 100) * height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
      
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.stroke();
    }
  }

  updateChatActionButtonState(isLiveChatActive) {
    this.isLiveChatActive = isLiveChatActive;
  }
}
