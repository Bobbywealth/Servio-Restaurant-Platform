// Voice Integration Service for Kitchen Assistant
// Handles speech-to-text and text-to-speech for the AI Kitchen Assistant

/* eslint-disable @typescript-eslint/no-explicit-any */

// Voice provider types
export type SpeechToTextProvider = 'deepgram' | 'whisper';
export type TextToSpeechProvider = 'elevenlabs' | 'polly';

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration?: number;
}

export interface SpeechSynthesisOptions {
  provider?: TextToSpeechProvider;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface SpeechSynthesisResult {
  audioUrl?: string;
  audioBase64?: string;
  duration?: number;
}

class VoiceKitchenService {
  private deepgramApiKey: string | undefined;
  private openaiApiKey: string | undefined;
  private elevenlabsApiKey: string | undefined;
  private elevenlabsVoiceId: string;

  constructor() {
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.elevenlabsVoiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default voice
  }

  // Speech-to-Text: Transcribe audio buffer
  async transcribeAudio(
    audioBuffer: Buffer,
    provider: SpeechToTextProvider = 'deepgram'
  ): Promise<TranscriptionResult> {
    switch (provider) {
      case 'deepgram':
        return this.transcribeWithDeepgram(audioBuffer);
      case 'whisper':
        return this.transcribeWithWhisper(audioBuffer);
      default:
        throw new Error(`Unknown speech-to-text provider: ${provider}`);
    }
  }

  // Deepgram transcription
  private async transcribeWithDeepgram(audioBuffer: Buffer): Promise<TranscriptionResult> {
    if (!this.deepgramApiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const response = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.deepgramApiKey}`,
        'Content-Type': 'audio/wav'
      },
      body: audioBuffer as any
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deepgram transcription failed: ${error}`);
    }

    const data = await response.json() as any;
    
    return {
      text: data.results.channels[0].alternatives[0].transcript,
      confidence: data.results.channels[0].alternatives[0].confidence,
      duration: data.metadata?.duration
    };
  }

  // OpenAI Whisper transcription
  private async transcribeWithWhisper(audioBuffer: Buffer): Promise<TranscriptionResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = new FormData();
    const blob = new Blob([audioBuffer]);
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: formData as any
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper transcription failed: ${error}`);
    }

    const data = await response.json() as any;
    
    return {
      text: data.text
    };
  }

  // Text-to-Speech: Convert text to audio
  async synthesizeSpeech(
    text: string,
    options: SpeechSynthesisOptions = {}
  ): Promise<SpeechSynthesisResult> {
    const provider = options.provider || 'elevenlabs';
    
    switch (provider) {
      case 'elevenlabs':
        return this.synthesizeWithElevenLabs(text, options);
      case 'polly':
        return this.synthesizeWithPolly(text, options);
      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }
  }

  // ElevenLabs text-to-speech
  private async synthesizeWithElevenLabs(
    text: string,
    options: SpeechSynthesisOptions
  ): Promise<SpeechSynthesisResult> {
    if (!this.elevenlabsApiKey) {
      // Fallback: return text for display (no audio)
      console.warn('ElevenLabs API key not configured, returning text only');
      return { audioBase64: undefined };
    }

    const voiceId = options.voiceId || this.elevenlabsVoiceId;
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.elevenlabsApiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs synthesis failed: ${error}`);
    }

    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer();
    // Convert ArrayBuffer to base64 string
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = Buffer.from(binary, 'binary').toString('base64') as unknown as string;
    
    return {
      audioBase64: base64,
      duration: base64.length / 16000 // Rough estimate
    };
  }

  // AWS Polly text-to-speech (fallback)
  private async synthesizeWithPolly(
    text: string,
    _options: SpeechSynthesisOptions
  ): Promise<SpeechSynthesisResult> {
    // AWS Polly would require AWS SDK setup
    // This is a placeholder for the implementation
    console.warn('AWS Polly TTS not implemented yet');
    
    return {
      audioBase64: undefined
    };
  }

  // Get available voices for TTS
  async getAvailableVoices(_provider: TextToSpeechProvider = 'elevenlabs'): Promise<any[]> {
    if (!this.elevenlabsApiKey) {
      return [];
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'Accept': 'application/json',
        'xi-api-key': this.elevenlabsApiKey
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get voices: ${error}`);
    }

    const data = await response.json() as any;
    return data.voices;
  }

  // Process voice command end-to-end
  async processVoiceCommand(
    audioBuffer: Buffer,
    responseText: string
  ): Promise<{ command: TranscriptionResult; response: SpeechSynthesisResult }> {
    // Transcribe the audio
    const transcription = await this.transcribeAudio(audioBuffer);
    
    // Synthesize the response
    const speech = await this.synthesizeSpeech(responseText);
    
    return {
      command: transcription,
      response: speech
    };
  }

  // Check if voice services are configured
  isConfigured(): {
    stt: boolean;
    tts: boolean;
    providers: string[];
  } {
    const providers: string[] = [];
    let stt = false;
    let tts = false;

    if (this.deepgramApiKey || this.openaiApiKey) {
      stt = true;
      if (this.deepgramApiKey) providers.push('deepgram');
      if (this.openaiApiKey) providers.push('whisper');
    }

    if (this.elevenlabsApiKey) {
      tts = true;
      providers.push('elevenlabs');
    }

    return { stt, tts, providers };
  }
}

export default new VoiceKitchenService();
