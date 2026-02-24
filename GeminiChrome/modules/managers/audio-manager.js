/**
 * Audio Manager - Handles all audio-related operations
 */

const TARGET_SAMPLE_RATE = 16000;
const WORKLET_BUFFER_SIZE = 4096;

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.micStream = null;
    this.micSourceNode = null;
    this.audioWorkletNode = null;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.isRecording = false;
    this.onAudioDataCallback = null;
    this.onAudioLevelCallback = null;
  }

  /**
   * Initialize the audio context and worklet
   * @returns {Promise<boolean>}
   */
  async initialize() {
    console.log('[AudioManager] Initializing...');

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log(`[AudioManager] AudioContext created. Sample Rate: ${this.audioContext.sampleRate}`);
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('[AudioManager] AudioContext resumed');
      }

      await this.loadAudioWorklet();
      return true;
    } catch (error) {
      console.error('[AudioManager] Error initializing:', error);
      return false;
    }
  }

  /**
   * Load audio worklet
   * @returns {Promise}
   */
  async loadAudioWorklet() {
    try {
      console.log('[AudioManager] Loading AudioWorklet...');

      const workletURL = chrome.runtime.getURL('audio-processor.js');
      await this.audioContext.audioWorklet.addModule(workletURL);

      console.log('[AudioManager] AudioWorklet loaded successfully');
    } catch (error) {
      if (error.name === 'InvalidStateError' && error.message.includes('already exists')) {
        console.log('[AudioManager] AudioWorklet already loaded');
        return;
      }
      throw error;
    }
  }

  /**
   * Check if microphone permission has been granted
   * @returns {Promise<boolean>}
   */
  async checkMicrophonePermission() {
    try {
      // Try a quick getUserMedia to see if permission is already granted
      // Don't return the stream, just check if it succeeds
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      return error.name !== 'NotAllowedError';
    }
  }

  /**
   * Start recording from microphone
   * @returns {Promise<boolean>}
   */
  async startRecording() {
    console.log('[AudioManager] Starting recording...');

    try {
      if (!this.audioContext) {
        await this.initialize();
      }

      // Try to get microphone stream from the side panel context
      try {
        console.log('[AudioManager] Attempting to get microphone from side panel context...');
        console.log('[AudioManager] Calling getUserMedia with audio constraints');
        
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 48000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        console.log('[AudioManager] Microphone obtained directly from side panel');
      } catch (initialError) {
        // Browser permission denied
        console.error('[AudioManager] getUserMedia failed:', initialError.name, initialError.message);
        
        if (initialError.name === 'NotAllowedError') {
          console.warn('[AudioManager] Permission not granted. Showing permission popup...');
          
          // Show permission popup to let user know what's needed
          // The popup is just a notification - actual permission comes from browser dialog
          chrome.runtime.sendMessage(
            { action: 'requestMicrophonePermission' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('[AudioManager] Error opening popup:', chrome.runtime.lastError);
              } else {
                console.log('[AudioManager] Permission popup opened');
              }
            }
          );
          
          // Return false to indicate permission was not granted
          return false;
        } else {
          // Other error (no hardware, blocked, etc)
          throw initialError;
        }
      }

      // If we get here, we have the microphone stream
      console.log('[AudioManager] Microphone stream created successfully');
      return await this.setupAudioProcessing();
      
    } catch (error) {
      console.error('[AudioManager] Error starting recording:', error);
      throw error;
    }
  }
  
  /**
   * Setup audio processing after microphone is obtained
   */
  async setupAudioProcessing() {
    console.log('[AudioManager] Setting up audio processing...');
    
    if (!this.micStream) {
      throw new Error('Microphone stream not available');
    }

    console.log('[AudioManager] Microphone stream created');

    this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
    this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
      processorOptions: {
        targetSampleRate: TARGET_SAMPLE_RATE,
        bufferSize: WORKLET_BUFFER_SIZE
      }
    });

    // Handle audio data from worklet
    this.audioWorkletNode.port.onmessage = (event) => {
      if (event.data.debug) {
        console.log(`[AudioWorklet] ${event.data.debug}`);
        return;
      }

      if (event.data.error) {
        console.error(`[AudioWorklet] Error: ${event.data.error}`);
        return;
      }

      if (event.data.audioData) {
        this.handleAudioData(event.data.audioData);
      }
    };

    // Connect audio graph
    this.micSourceNode.connect(this.audioWorkletNode);

    // Create muted output to ensure worklet runs
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0;
    this.audioWorkletNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    this.isRecording = true;
    console.log('[AudioManager] Recording started');
    return true;
  }

  /**
   * Request microphone permission via background script (legacy - not used anymore)
   * @returns {Promise<boolean>}
   */
  async requestMicrophonePermission() {
    return new Promise((resolve) => {
      console.log('[AudioManager] Sending permission request to background script...');
      
      const timeout = setTimeout(() => {
        console.warn('[AudioManager] Permission request timed out');
        resolve(false);
      }, 30000);
      
      chrome.runtime.sendMessage(
        { action: 'requestMicrophonePermission' },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error('[AudioManager] Error requesting permission:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          
          console.log('[AudioManager] Permission request response:', response);
          resolve(response && response.success === true);
        }
      );
    });
  }

  /**
   * Stop recording
   */
  stopRecording() {
    console.log('[AudioManager] Stopping recording...');

    this.isRecording = false;
    this.cleanupAudioNodes();
    console.log('[AudioManager] Recording stopped');
  }

  /**
   * Handle audio data from worklet
   * @param {ArrayBuffer} audioArrayBuffer
   */
  handleAudioData(audioArrayBuffer) {
    if (!this.isRecording || !this.onAudioDataCallback) {
      return;
    }

    if (audioArrayBuffer.byteLength === 0) {
      console.log('[AudioManager] Received empty audio buffer');
      return;
    }

    // Calculate audio level
    const int16Array = new Int16Array(audioArrayBuffer);
    let sum = 0;
    for (let i = 0; i < int16Array.length; i++) {
      sum += Math.abs(int16Array[i]);
    }
    const audioLevel = sum / int16Array.length / 32768;
    console.log(`[AudioManager] Audio level: ${(audioLevel * 100).toFixed(1)}%`);

    if (this.onAudioLevelCallback) {
      this.onAudioLevelCallback(audioLevel);
    }

    // Convert to base64 and send
    const base64Audio = this.arrayBufferToBase64(audioArrayBuffer);
    this.onAudioDataCallback({
      data: base64Audio,
      mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`
    });
  }

  /**
   * Enqueue audio for playback
   * @param {ArrayBuffer} audioArrayBuffer
   */
  enqueueAudio(audioArrayBuffer) {
    this.audioQueue.push(audioArrayBuffer);
    if (!this.isPlayingAudio) {
      this.playNextInQueue();
    }
  }

  /**
   * Play next audio in queue
   */
  async playNextInQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      return;
    }

    this.isPlayingAudio = true;
    const audioArrayBuffer = this.audioQueue.shift();

    if (audioArrayBuffer.byteLength < 2) {
      console.warn('[AudioManager] Audio buffer too short');
      this.isPlayingAudio = false;
      this.playNextInQueue();
      return;
    }

    try {
      const PLAYBACK_SAMPLE_RATE = 24000;
      const int16Array = new Int16Array(audioArrayBuffer);
      const float32Array = new Float32Array(int16Array.length);

      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32Array.length,
        PLAYBACK_SAMPLE_RATE
      );
      audioBuffer.copyToChannel(float32Array, 0);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      source.onended = () => {
        this.playNextInQueue();
      };
    } catch (error) {
      console.error('[AudioManager] Playback error:', error);
      this.isPlayingAudio = false;
      this.playNextInQueue();
    }
  }

  /**
   * Clear audio queue and stop playback
   */
  clearQueue() {
    this.audioQueue = [];
    this.isPlayingAudio = false;
    console.log('[AudioManager] Audio queue cleared');
  }

  /**
   * Cleanup audio nodes
   */
  cleanupAudioNodes() {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.onmessage = null;
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    console.log('[AudioManager] Audio cleanup complete');
  }

  /**
   * Convert ArrayBuffer to Base64
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Register callback for audio data
   * @param {function} callback
   */
  onAudioData(callback) {
    this.onAudioDataCallback = callback;
  }

  /**
   * Register callback for audio level
   * @param {function} callback
   */
  onAudioLevel(callback) {
    this.onAudioLevelCallback = callback;
  }
}

// Export for both module and non-module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioManager };
}
