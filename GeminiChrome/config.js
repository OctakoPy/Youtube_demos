// config.js - Application constants and configuration

export const AUDIO_CONFIG = {
  TARGET_SAMPLE_RATE: 16000, // Gemini expects 16kHz PCM
  WORKLET_BUFFER_SIZE: 4096, // Samples to buffer before sending
  PLAYBACK_SAMPLE_RATE: 24000,
  CHANNEL_COUNT: 1,
  REQUEST_SAMPLE_RATE: 48000
};

export const CAPTURE_CONFIG = {
  IMAGE_SEND_INTERVAL_MS: 5000, // Send image every 5 seconds
  AUTO_SCREENSHOT_INTERVAL_MS: 3000, // Auto-capture every 3 seconds
  IMAGE_QUALITY: 0.8 // JPEG compression quality
};

export const GEMINI_CONFIG = {
  MODEL: 'gemini-2.5-flash-native-audio-preview-09-2025',
  API_VERSION: 'v1alpha',
  RESPONSE_MODALITIES: ['AUDIO']
};

export const UI_CONFIG = {
  AUDIO_LEVEL_HISTORY_SIZE: 60,
  INTENSITY_MIN: 0.7,
  INTENSITY_MAX: 1.0,
  AUDIO_LEVEL_SMOOTH_FACTOR: 0.8,
  SCROLL_THRESHOLD_PX: 50
};

export const PERMISSIONS_CONFIG = {
  MICROPHONE_TIMEOUT_MS: 5000,
  SETUP_TIMEOUT_MS: 10000,
  SETUP_TIMEOUT_ATTEMPTS: 20,
  AUDIO_TEST_INTERVAL_MS: 1000,
  AUDIO_TEST_COUNT: 5
};

export const STATUS_MESSAGES = {
  READY: 'Ready to chat',
  RECORDING: 'Listening...',
  PLAYING: 'Playing response...',
  CONNECTING: 'Connecting to Gemini...',
  CONNECTED: 'Connected! Finalizing setup...',
  ENDING: 'Ending call...',
  DISCONNECTED: 'Disconnected'
};

export const FILTERED_STATUS_MESSAGES = [
  'Playing response...',
  'Listening...',
  'Connected! Finalizing setup...',
  'Connecting to Gemini...',
  'Ready to chat',
  'Requesting microphone...',
  'Auto-screenshot started',
  'Auto-screenshot stopped',
  'Live chat stopped'
];
