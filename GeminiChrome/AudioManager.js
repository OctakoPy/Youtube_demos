// AudioManager.js - Handles microphone capture, audio processing, and playback

import { 
  AUDIO_CONFIG, 
  PERMISSIONS_CONFIG 
} from './config.js';
import { 
  arrayBufferToBase64, 
  calculateAudioLevel, 
  waitFor 
} from './utils.js';

export class AudioManager {
  constructor(onAudioLevel, onStatusUpdate) {
    this.audioContext = null;
    this.micStream = null;
    this.micSourceNode = null;
    this.audioWorkletNode = null;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.isRecording = false;
    
    this.onAudioLevel = onAudioLevel;
    this.onStatusUpdate = onStatusUpdate;
  }

  async initialize() {
    console.log('[AudioManager] Initializing audio system...');
    
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log(`[AudioManager] AudioContext created. Sample Rate: ${this.audioContext.sampleRate}`);
        
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      } catch (error) {
        console.error('[AudioManager] Error creating AudioContext:', error);
        this.onStatusUpdate('Error initializing audio system', true);
        return false;
      }
    } else {
      console.log(`[AudioManager] AudioContext already exists. Sample Rate: ${this.audioContext.sampleRate}`);
      
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('[AudioManager] AudioContext resumed');
        } catch (error) {
          console.error('[AudioManager] Error resuming:', error);
          return false;
        }
      }
    }
    
    try {
      await this.addAudioWorklet();
    } catch (error) {
      console.error('[AudioManager] Error loading AudioWorklet:', error);
      this.onStatusUpdate('Error loading audio processor', true);
      return false;
    }
    
    console.log('[AudioManager] Audio system ready');
    return true;
  }

  async addAudioWorklet() {
    try {
      console.log('[AudioManager] Loading AudioWorklet module...');
      
      const workletURL = chrome.runtime.getURL('audio-processor.js');
      await this.audioContext.audioWorklet.addModule(workletURL);
      
      console.log('[AudioManager] Audio worklet added successfully');
    } catch (error) {
      if (error.name === 'InvalidStateError' && error.message.includes('already exists')) {
        console.log('[AudioManager] AudioWorklet module already loaded');
        return;
      }
      
      console.error('[AudioManager] Error:', error);
      throw error;
    }
  }

  async requestMicrophonePermission() {
    try {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        if (permissionStatus.state === 'granted') {
          console.log('[AudioManager] Microphone permission already granted');
          return true;
        }
      } catch (e) {
        console.log('[AudioManager] Permission API not available, continuing with other methods');
      }
      
      console.log('[AudioManager] Requesting microphone access via iframe...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Iframe permission request timeout')), PERMISSIONS_CONFIG.MICROPHONE_TIMEOUT_MS);
      });
      
      const responsePromise = chrome.runtime.sendMessage({
        action: 'requestMicrophonePermission'
      });
      
      const response = await Promise.race([responsePromise, timeoutPromise]);
      
      console.log('[AudioManager] Response:', response);
      
      if (response && response.success) {
        console.log('[AudioManager] Microphone permission granted via iframe');
        return true;
      } else {
        console.log('[AudioManager] Iframe method failed, trying direct permission request...');
        return await this.requestMicrophonePermissionDirect();
      }
    } catch (error) {
      console.error('[AudioManager] Error:', error);
      console.log('[AudioManager] Trying direct permission request as fallback...');
      return await this.requestMicrophonePermissionDirect();
    }
  }

  async requestMicrophonePermissionDirect() {
    try {
      console.log('[AudioManager] Requesting microphone access directly...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: AUDIO_CONFIG.TARGET_SAMPLE_RATE
        }
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      console.log('[AudioManager] Microphone permission granted directly');
      return true;
    } catch (error) {
      console.error('[AudioManager] Permission denied or error:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else {
        throw new Error(`Microphone error: ${error.message}`);
      }
    }
  }

  async startRecording(onAudioData) {
    console.log('[AudioManager] Starting recording...');
    
    if (!this.audioContext) {
      this.onStatusUpdate('Audio system not ready.', true);
      return false;
    }
    
    this.isRecording = true;
    this.onStatusUpdate('Requesting microphone...');
    
    try {
      console.log('[AudioManager] Requesting microphone access...');
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: AUDIO_CONFIG.CHANNEL_COUNT,
          sampleRate: AUDIO_CONFIG.REQUEST_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('[AudioManager] Microphone stream created:', this.micStream);
      
      this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      console.log('[AudioManager] Created MediaStreamSource node');
      
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
        processorOptions: {
          targetSampleRate: AUDIO_CONFIG.TARGET_SAMPLE_RATE,
          bufferSize: AUDIO_CONFIG.WORKLET_BUFFER_SIZE
        }
      });
      console.log('[AudioManager] Created AudioWorklet node');
      
      this.setupAudioWorkletMessaging(onAudioData);
      this.connectAudioNodes();
      
      console.log('[AudioManager] Microphone connected to AudioWorklet');
      this.onStatusUpdate('Listening...');
      
      return true;
    } catch (error) {
      console.error('[AudioManager] Error:', error);
      this.onStatusUpdate(`Microphone error: ${error.message}`, true);
      this.isRecording = false;
      this.cleanup();
      return false;
    }
  }

  setupAudioWorkletMessaging(onAudioData) {
    this.audioWorkletNode.port.onmessage = (event) => {
      if (event.data.debug) {
        console.log(`[AudioWorklet] ${event.data.debug}`);
        return;
      }
      
      if (event.data.error) {
        console.error(`[AudioWorklet] Error: ${event.data.error}`);
        return;
      }
      
      if (event.data.audioData && this.isRecording) {
        const audioArrayBuffer = event.data.audioData;
        if (audioArrayBuffer.byteLength === 0) {
          console.log('[AudioWorklet] Received empty audio buffer');
          return;
        }
        
        // Calculate and report audio level
        const int16Array = new Int16Array(audioArrayBuffer);
        const level = calculateAudioLevel(int16Array);
        console.log(`[AudioWorklet] Audio level: ${(level * 100).toFixed(1)}%`);
        this.onAudioLevel(level);
        
        // Process audio data
        const base64AudioData = arrayBufferToBase64(audioArrayBuffer);
        const audioMediaBlob = {
          data: base64AudioData,
          mimeType: `audio/pcm;rate=${AUDIO_CONFIG.TARGET_SAMPLE_RATE}`
        };
        
        onAudioData(audioMediaBlob);
      }
    };
  }

  connectAudioNodes() {
    this.micSourceNode.connect(this.audioWorkletNode);
    
    // Connect to destination for audio processing to continue
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0; // Mute to prevent feedback
    this.audioWorkletNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Add AnalyserNode for monitoring
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    this.micSourceNode.connect(analyser);
    this.testAudioSignal(analyser);
  }

  testAudioSignal(analyser) {
    setTimeout(() => {
      const tracks = this.micStream.getAudioTracks();
      tracks.forEach((track, index) => {
        console.log(`[AudioManager] Audio track ${index}:`, {
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings()
        });
      });
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      console.log(`[AudioManager] AnalyserNode audio level test: ${average.toFixed(2)}`);
      
      let testCount = 0;
      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        console.log(`[AudioManager] Audio level test ${testCount + 1}: ${avg.toFixed(2)}`);
        testCount++;
        if (testCount >= PERMISSIONS_CONFIG.AUDIO_TEST_COUNT) {
          clearInterval(testInterval);
        }
      }, PERMISSIONS_CONFIG.AUDIO_TEST_INTERVAL_MS);
    }, 1000);
  }

  stopRecording() {
    console.log('[AudioManager] Stopping recording');
    this.isRecording = false;
    this.cleanup();
  }

  cleanup() {
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

  enqueueAudio(audioArrayBuffer) {
    this.audioQueue.push(audioArrayBuffer);
    if (!this.isPlayingAudio) {
      this.playNextInQueue();
    }
  }

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
    
    if (!this.audioContext || this.audioContext.state !== 'running') {
      const ready = await this.initialize();
      if (!ready || !this.audioContext) {
        this.onStatusUpdate('Audio playback error', true);
        this.isPlayingAudio = false;
        this.audioQueue.unshift(audioArrayBuffer);
        return;
      }
    }
    
    try {
      const int16Array = new Int16Array(audioArrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, AUDIO_CONFIG.PLAYBACK_SAMPLE_RATE);
      audioBuffer.copyToChannel(float32Array, 0);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      
      this.onStatusUpdate('Playing response...');
      
      source.onended = () => {
        this.playNextInQueue();
      };
    } catch (error) {
      console.error('[AudioManager] Error:', error);
      this.onStatusUpdate(`Audio playback error: ${error.message}`, true);
      this.isPlayingAudio = false;
      this.playNextInQueue();
    }
  }

  clearQueue() {
    this.audioQueue = [];
    this.isPlayingAudio = false;
    console.log('[AudioManager] Audio queue cleared');
  }

  isRecordingActive() {
    return this.isRecording;
  }
}
