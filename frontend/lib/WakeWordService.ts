// Web Speech API based wake word detection - Free and works great for "Hey Servio"

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onnomatch: (event: SpeechRecognitionEvent) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onsoundend: () => void;
  onsoundstart: () => void;
  onspeechend: () => void;
  onspeechstart: () => void;
  onstart: () => void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
export interface WakeWordConfig {
  wakeWords: string[]; // Array of wake words/phrases to detect
  onWakeWordDetected: (detectedPhrase: string) => void;
  onError?: (error: Error) => void;
  onListeningStateChange?: (isListening: boolean) => void;
  onPartialResult?: (transcript: string) => void;
  language?: string; // Language for speech recognition
  continuous?: boolean; // Keep listening after detection
}

export class WakeWordService {
  private recognition: SpeechRecognition | null = null;
  private isInitialized = false;
  private isListening = false;
  private shouldBeListening = false; // Track if we want to be listening
  private config: WakeWordConfig;
  private restartTimeout: NodeJS.Timeout | null = null;
  private lastRestartTime = 0;

  constructor(config: WakeWordConfig) {
    this.config = {
      language: 'en-US',
      continuous: true,
      ...config,
      wakeWords: config.wakeWords || ['hey servio', 'servio']
    };
  }

  async initialize(): Promise<boolean> {
    console.log('Initializing WakeWordService...');
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        console.error('WakeWordService requires browser environment');
        throw new Error('WakeWordService requires browser environment');
      }

      // Check if SpeechRecognition is supported
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error('Speech recognition NOT supported in this browser');
        throw new Error('Speech recognition not supported in this browser');
      }

      console.log('Requesting microphone permission for wake word...');
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');

      // Initialize speech recognition
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = this.config.continuous ?? true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language || 'en-US';
      this.recognition.maxAlternatives = 1;

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log('WakeWordService initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize WakeWordService:', error);
      this.config.onError?.(error as Error);
      return false;
    }
  }

  private setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('Wake word detection started');
      this.isListening = true;
      this.config.onListeningStateChange?.(true);
    };

    this.recognition.onend = () => {
      console.log('Wake word detection ended');
      this.isListening = false;
      this.config.onListeningStateChange?.(false);

      // Auto-restart ONLY if we're supposed to be listening
      // Add debounce to prevent rapid restarts
      const now = Date.now();
      if (this.shouldBeListening && now - this.lastRestartTime > 1000) {
        this.lastRestartTime = now;
        this.restartTimeout = setTimeout(() => {
          if (this.isInitialized && this.shouldBeListening) {
            console.log('Auto-restarting wake word detection');
            this.startListening();
          }
        }, 100);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Wake word detection error:', event.error);
      
      // Don't restart on certain errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.config.onError?.(new Error('Microphone permission denied'));
        return;
      }

      // For other errors, try to restart after a delay
      if (event.error !== 'aborted') {
        setTimeout(() => {
          if (this.isInitialized) {
            this.startListening();
          }
        }, 1000);
      }
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Check interim results for immediate detection
      const currentTranscript = (finalTranscript + interimTranscript).toLowerCase();
      this.config.onPartialResult?.(currentTranscript);

      // Check for wake words in both final and interim results
      for (const wakeWord of this.config.wakeWords) {
        const lowerWakeWord = wakeWord.toLowerCase();
        if (currentTranscript.includes(lowerWakeWord)) {
          console.log(`Wake word detected: "${wakeWord}" in "${currentTranscript}"`);
          
          // Extract the command after the wake word
          const wakeWordIndex = currentTranscript.indexOf(lowerWakeWord);
          const commandStart = wakeWordIndex + lowerWakeWord.length;
          const command = currentTranscript.substring(commandStart).trim();
          
          if (command) {
            // Pass the command along with wake word detection in one go
            this.config.onWakeWordDetected(`${wakeWord}: ${command}`);
          } else {
            // Just wake word detected
            this.config.onWakeWordDetected(wakeWord);
          }
          
          // Clear recognition to prevent multiple detections of the same phrase
          if (this.recognition) {
            try {
              this.recognition.abort();
              // onend will handle restarting if needed
            } catch (e) {
              console.error('Error aborting recognition:', e);
            }
          }
          
          break; // Stop after first match
        }
      }
    };
  }

  async startListening(): Promise<boolean> {
    if (!this.isInitialized || !this.recognition) {
      console.warn('WakeWordService not initialized');
      return false;
    }

    // Check if already listening to prevent "already started" error
    if (this.isListening) {
      console.log('Already listening for wake words');
      return true;
    }

    try {
      // Clear any pending restart
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = null;
      }

      // Set flags BEFORE calling start() to prevent race conditions
      this.shouldBeListening = true;
      this.isListening = true; // Set immediately to prevent double-start
      
      this.recognition.start();
      console.log('Started listening for wake words:', this.config.wakeWords);
      return true;

    } catch (error: any) {
      // Reset flags if start() fails
      this.isListening = false;
      this.shouldBeListening = false;
      
      // If already started, that's actually okay - we're listening
      if (error?.message?.includes('already started')) {
        console.log('Recognition already active, continuing...');
        this.isListening = true;
        this.shouldBeListening = true;
        return true;
      }
      
      console.error('Failed to start wake word listening:', error);
      this.config.onError?.(error as Error);
      return false;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.recognition) return;

    try {
      // Mark that we don't want to be listening (prevents auto-restart)
      this.shouldBeListening = false;
      
      // Clear restart timeout
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = null;
      }

      // Stop recognition if it's running
      if (this.isListening) {
        this.recognition.stop();
        console.log('Stopped listening for wake words');
      }

    } catch (error) {
      console.error('Error stopping wake word listening:', error);
      this.config.onError?.(error as Error);
    }
  }

  addWakeWord(wakeWord: string): void {
    if (!this.config.wakeWords.includes(wakeWord.toLowerCase())) {
      this.config.wakeWords.push(wakeWord.toLowerCase());
      console.log(`Added wake word: "${wakeWord}"`);
    }
  }

  removeWakeWord(wakeWord: string): void {
    const index = this.config.wakeWords.indexOf(wakeWord.toLowerCase());
    if (index > -1) {
      this.config.wakeWords.splice(index, 1);
      console.log(`Removed wake word: "${wakeWord}"`);
    }
  }

  getWakeWords(): string[] {
    return [...this.config.wakeWords];
  }

  getState() {
    return {
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      wakeWords: this.config.wakeWords,
      language: this.config.language
    };
  }

  async cleanup(): Promise<void> {
    // Stop listening and prevent auto-restart
    this.shouldBeListening = false;
    await this.stopListening();
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    this.recognition = null;
    this.isInitialized = false;
    this.isListening = false;
    console.log('WakeWordService cleaned up');
  }
}

// Utility function to check if wake word detection is supported
export function isWakeWordSupported(): boolean {
  // Check if we're in the browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!(
    SpeechRecognition &&
    navigator.mediaDevices?.getUserMedia
  );
}

// Default wake word configurations
export const getDefaultWakeWordConfig = (): Partial<WakeWordConfig> => {
  return {
    wakeWords: ['hey servio', 'servio'],
    language: 'en-US',
    continuous: true
  };
};