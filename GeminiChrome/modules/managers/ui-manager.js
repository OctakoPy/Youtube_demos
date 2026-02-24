/**
 * UI Manager - Handles all UI-related operations in the side panel
 */

class UIManager {
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
    this.audioLevelHistory = new Array(60).fill(0);
    this.currentAudioLevel = 0;
    this.animationFrameId = null;
  }

  /**
   * Initialize all UI elements
   */
  initializeElements() {
    this.statusText = document.getElementById('statusText');
    this.statusSubtitle = document.getElementById('statusSubtitle');
    this.breathingIndicator = document.getElementById('breathingIndicator');
    this.chatActionBtn = document.getElementById('chatActionBtn');
    this.chatActionIcon = document.getElementById('chatActionIcon');

    this.apiKeySection = document.getElementById('apiKeySection');
    this.mainInterface = document.getElementById('mainInterface');
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

    this.startLiveChatBtn = document.getElementById('startLiveChatBtn');
    this.stopLiveChatBtn = document.getElementById('stopLiveChatBtn');
    this.imagePreviewContainer = document.getElementById('imagePreviewContainer');
    this.imagePreview = document.getElementById('imagePreview');
    this.removeImageBtn = document.getElementById('removeImageBtn');

    this.chatMessages = document.getElementById('chatMessages');
    this.transcriptMessages = document.getElementById('transcriptMessages');

    this.audioVisualizer = document.getElementById('audioVisualizer');
    this.audioLevelFill = document.getElementById('audioLevelFill');
    this.audioLevelText = document.getElementById('audioLevelText');
    this.audioWaveform = document.getElementById('audioWaveform');
    this.waveformCtx = this.audioWaveform ? this.audioWaveform.getContext('2d') : null;

    console.log('[UIManager] All UI elements initialized');
  }

  /**
   * Update status text
   * @param {string} message
   * @param {boolean} isError
   */
  updateStatus(message, isError = false) {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
    this.updateBreathingIndicator(message, isError);
    console.log(`[Status] ${message}`);
  }

  /**
   * Update breathing indicator
   * @param {string} message
   * @param {boolean} isError
   */
  updateBreathingIndicator(message, isError) {
    if (!this.breathingIndicator) return;

    this.breathingIndicator.className = 'breathing-indicator';

    if (isError) {
      this.breathingIndicator.classList.add('error');
    }
  }

  /**
   * Show main interface
   */
  showMainInterface() {
    if (this.apiKeySection) this.apiKeySection.style.display = 'none';
    if (this.mainInterface) this.mainInterface.style.display = 'block';
  }

  /**
   * Show API key section
   */
  showApiKeySection() {
    if (this.apiKeySection) this.apiKeySection.style.display = 'block';
    if (this.mainInterface) this.mainInterface.style.display = 'none';
  }

  /**
   * Update chat action button state
   * @param {boolean} isActive
   */
  updateChatActionButton(isActive) {
    if (!this.chatActionBtn || !this.chatActionIcon) return;

    this.chatActionBtn.className = 'chat-action-btn';

    if (isActive) {
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

  /**
   * Add message to chat
   * @param {string} content
   * @param {boolean} isUser
   */
  addChatMessage(content, isUser = false) {
    if (!this.chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'user-message' : 'assistant-message';
    messageDiv.textContent = content;

    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  /**
   * Add transcript message
   * @param {string} text
   * @param {boolean} isUser
   * @param {boolean} isStreaming
   */
  addTranscriptMessage(text, isUser = false, isStreaming = false) {
    if (!this.transcriptMessages) return;

    const infoMsg = this.transcriptMessages.querySelector('.transcript-info');
    if (infoMsg) {
      infoMsg.remove();
    }

    if (isStreaming) {
      this.addStreamingTranscriptMessage(text, isUser);
    } else {
      const messageDiv = document.createElement('div');
      messageDiv.className = `transcript-message ${isUser ? 'user' : 'ai'}`;

      const speakerDiv = document.createElement('div');
      speakerDiv.className = 'speaker';
      speakerDiv.textContent = isUser ? 'You' : 'AI';

      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      textDiv.textContent = text;

      messageDiv.appendChild(speakerDiv);
      messageDiv.appendChild(textDiv);
      this.transcriptMessages.appendChild(messageDiv);
    }

    this.scrollTranscriptToBottom();
  }

  /**
   * Add streaming transcript message
   * @param {string} text
   * @param {boolean} isUser
   */
  addStreamingTranscriptMessage(text, isUser) {
    const currentTranscriptRef = isUser ? 'currentInputTranscript' : 'currentOutputTranscript';
    const currentAccumulatedRef = isUser ? 'currentInputAccumulated' : 'currentOutputAccumulated';

    if (!this[currentTranscriptRef]) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `transcript-message ${isUser ? 'user' : 'ai'}`;

      const speakerDiv = document.createElement('div');
      speakerDiv.className = 'speaker';
      speakerDiv.textContent = isUser ? 'You' : 'AI';

      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      textDiv.textContent = text;

      messageDiv.appendChild(speakerDiv);
      messageDiv.appendChild(textDiv);

      this.transcriptMessages.appendChild(messageDiv);
      this[currentTranscriptRef] = textDiv;
      this[currentAccumulatedRef] = text;
    } else {
      if (text && text.trim()) {
        const currentText = this[currentAccumulatedRef] || '';
        if (!currentText.includes(text)) {
          this[currentAccumulatedRef] = currentText + text;
        } else if (text.length > currentText.length) {
          this[currentAccumulatedRef] = text;
        }
        this[currentTranscriptRef].textContent = this[currentAccumulatedRef];
      }
    }
  }

  /**
   * Add system message to transcript
   * @param {string} text
   */
  addTranscriptSystemMessage(text) {
    if (!this.transcriptMessages) return;

    const infoMsg = this.transcriptMessages.querySelector('.transcript-info');
    if (infoMsg) {
      infoMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'transcript-system';
    messageDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${text}`;

    this.transcriptMessages.appendChild(messageDiv);
    this.scrollTranscriptToBottom();
  }

  /**
   * Clear transcript
   */
  clearTranscript() {
    if (!this.transcriptMessages) return;

    this.transcriptMessages.innerHTML = `
      <div class="transcript-info">
        <i class="fas fa-info-circle"></i>
        <span>Real-time transcription of your voice and AI responses will appear here during live chat.</span>
      </div>
    `;
  }

  /**
   * Scroll transcript to bottom
   */
  scrollTranscriptToBottom() {
    if (!this.transcriptMessages) return;

    requestAnimationFrame(() => {
      const isNearBottom =
        this.transcriptMessages.scrollTop + this.transcriptMessages.clientHeight >=
        this.transcriptMessages.scrollHeight - 50;

      if (isNearBottom || this.transcriptMessages.children.length <= 2) {
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
      }
    });
  }

  /**
   * Display screenshot
   * @param {string} dataUrl
   * @param {string} tabUrl
   */
  displayScreenshot(dataUrl, tabUrl) {
    if (!this.imagePreview) return;

    this.imagePreview.src = dataUrl;
    if (this.imagePreviewContainer) {
      this.imagePreviewContainer.style.display = 'block';
    }

    const imageHeader = this.imagePreviewContainer?.querySelector('.image-header span');
    if (imageHeader) {
      try {
        const url = new URL(tabUrl);
        imageHeader.textContent = `Screenshot: ${url.hostname}`;
      } catch (e) {
        imageHeader.textContent = 'Screenshot';
      }
    }
  }

  /**
   * Remove image preview
   */
  removeImage() {
    if (this.imagePreviewContainer) {
      this.imagePreviewContainer.style.display = 'none';
    }
  }

  /**
   * Show audio visualizer
   */
  showAudioVisualizer() {
    if (this.audioVisualizer) {
      this.audioVisualizer.style.display = 'block';
      this.startAudioVisualization();
    }
  }

  /**
   * Hide audio visualizer
   */
  hideAudioVisualizer() {
    if (this.audioVisualizer) {
      this.audioVisualizer.style.display = 'none';
      this.stopAudioVisualization();
    }
  }

  /**
   * Start audio visualization
   */
  startAudioVisualization() {
    if (this.animationFrameId) return;

    const animate = () => {
      this.updateAudioVisualization();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Stop audio visualization
   */
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

  /**
   * Update audio level
   * @param {number} level
   */
  updateAudioLevel(level) {
    this.currentAudioLevel = Math.min(100, Math.max(0, level * 100));

    if (this.breathingIndicator) {
      const intensity = Math.max(0.7, 0.7 + (this.currentAudioLevel / 100) * 0.3);
      this.breathingIndicator.style.transform = `scale(${intensity})`;
    }

    this.audioLevelHistory.shift();
    this.audioLevelHistory.push(this.currentAudioLevel);
  }

  /**
   * Update audio visualization
   */
  updateAudioVisualization() {
    if (this.audioLevelFill && this.audioLevelText) {
      const smoothedLevel = this.currentAudioLevel * 0.8;
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

  /**
   * Finish transcript turn
   * @param {boolean} isUser
   */
  finishTranscriptTurn(isUser = false) {
    const currentTranscriptRef = isUser ? 'currentInputTranscript' : 'currentOutputTranscript';
    const currentAccumulatedRef = isUser ? 'currentInputAccumulated' : 'currentOutputAccumulated';
    this[currentTranscriptRef] = null;
    this[currentAccumulatedRef] = '';
  }
}

// Export for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIManager };
}
