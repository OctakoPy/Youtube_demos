// TranscriptManager.js - Handles transcript UI and state management

import { UI_CONFIG, FILTERED_STATUS_MESSAGES } from './config.js';

export class TranscriptManager {
  constructor(transcriptElement) {
    this.transcriptMessages = transcriptElement;
    this.currentInputTranscript = null;
    this.currentOutputTranscript = null;
    this.currentInputAccumulated = '';
    this.currentOutputAccumulated = '';
  }

  addMessage(text, isUser = false, isStreaming = false) {
    if (!this.transcriptMessages) return;
    
    this.removeInfoMessage();
    
    if (isStreaming) {
      this.addStreamingMessage(text, isUser);
    } else {
      this.addNonStreamingMessage(text, isUser);
    }
    
    this.scrollToBottom();
    console.log(`[Transcript] ${isUser ? 'User' : 'AI'}: ${text}`);
  }

  addStreamingMessage(text, isUser) {
    const currentTranscriptRef = isUser ? 'currentInputTranscript' : 'currentOutputTranscript';
    const currentAccumulatedRef = isUser ? 'currentInputAccumulated' : 'currentOutputAccumulated';
    
    if (!this[currentTranscriptRef]) {
      // Create new transcript box for this conversation turn
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
      // Accumulate new words
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

  addNonStreamingMessage(text, isUser) {
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

  addSystemMessage(text) {
    if (!this.transcriptMessages) return;
    
    this.removeInfoMessage();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'transcript-system';
    messageDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${text}`;
    
    this.transcriptMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  finishTurn(isUser = false) {
    const currentTranscriptRef = isUser ? 'currentInputTranscript' : 'currentOutputTranscript';
    const currentAccumulatedRef = isUser ? 'currentInputAccumulated' : 'currentOutputAccumulated';
    this[currentTranscriptRef] = null;
    this[currentAccumulatedRef] = '';
  }

  shouldShowInTranscript(message) {
    return !FILTERED_STATUS_MESSAGES.some(filter => message.includes(filter));
  }

  clear() {
    if (!this.transcriptMessages) return;
    
    this.transcriptMessages.innerHTML = `
      <div class="transcript-info">
        <i class="fas fa-info-circle"></i>
        <span>Real-time transcription of your voice and AI responses will appear here during live chat.</span>
      </div>
    `;
  }

  removeInfoMessage() {
    const infoMsg = this.transcriptMessages?.querySelector('.transcript-info');
    if (infoMsg) {
      infoMsg.remove();
    }
  }

  scrollToBottom() {
    if (!this.transcriptMessages) return;
    
    requestAnimationFrame(() => {
      const isNearBottom = 
        this.transcriptMessages.scrollTop + this.transcriptMessages.clientHeight >= 
        this.transcriptMessages.scrollHeight - UI_CONFIG.SCROLL_THRESHOLD_PX;
      
      if (isNearBottom || this.transcriptMessages.children.length <= 2) {
        this.transcriptMessages.scrollTop = this.transcriptMessages.scrollHeight;
      }
    });
  }
}
