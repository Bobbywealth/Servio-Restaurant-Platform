/**
 * MiniMax API Service
 *
 * Provides integration with MiniMax's M2.1 chat models and speech-2 TTS.
 * Cost savings vs OpenAI: ~96% on chat, ~60% on TTS
 *
 * Required environment variables:
 * - MINIMAX_API_KEY: Your MiniMax API key
 * - MINIMAX_API_BASE: API base URL (default: https://api.minimax.io/v1)
 * - MINIMAX_CHAT_MODEL: Chat model (m2.1 or m2.1-lightning)
 * - MINIMAX_TTS_VOICE: Default TTS voice
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { ensureUploadsDir } from '../utils/uploads';
import { v4 as uuidv4 } from 'uuid';

interface MiniMaxConfig {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  ttsVoice: string;
}

interface ChatMessage {
  role: string;
  content: string;
  name?: string;
}

interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MiniMaxTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

interface TTSResponse {
  audioUrl: string;
  duration?: number;
}

interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
}

const DEFAULT_VOICES: VoiceOption[] = [
  { id: 'female-jenna', name: 'Jenna', gender: 'female', description: 'Clear American female voice' },
  { id: 'male-shaun', name: 'Shaun', gender: 'male', description: 'Deep American male voice' },
  { id: 'male-shaun-2', name: 'Shaun 2', gender: 'male', description: 'Optimized male voice' },
  { id: 'female-sarah', name: 'Sarah', gender: 'female', description: 'Warm female voice' },
  { id: 'male-eric', name: 'Eric', gender: 'male', description: 'Professional male voice' },
];

export class MiniMaxService {
  private config: MiniMaxConfig;

  constructor() {
    this.config = {
      apiKey: process.env.MINIMAX_API_KEY || '',
      baseUrl: process.env.MINIMAX_API_BASE || 'https://api.minimax.io/v1',
      chatModel: process.env.MINIMAX_CHAT_MODEL || 'm2.1',
      ttsVoice: process.env.MINIMAX_TTS_VOICE || 'male-shaun-2',
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  /**
   * Get the current configuration
   */
  getConfig(): MiniMaxConfig {
    return { ...this.config };
  }

  /**
   * Chat completion with optional function calling
   */
  async chat(
    messages: ChatMessage[],
    tools?: MiniMaxTool[],
    temperature: number = 0.3
  ): Promise<ChatCompletion> {
    if (!this.isConfigured()) {
      throw new Error(' not configured');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.chatModel,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            name: m.name,
          })),
          tools: tools?.map(t => ({
            type: t.type,
            function: {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            },
          })),
          temperature,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('MiniMax API error:', { status: response.status, error: errorText });
        throw new Error(`MiniMax API error: ${response.status}`);
      }

      const data = await response.json();
      logger.info('MiniMax chat completion', {
        model: this.config.chatModel,
        duration: Date.now() - startTime,
        tokens: data.usage,
      });

      return data;
    } catch (error) {
      logger.error('MiniMax chat failed:', error);
      throw error;
    }
  }

  /**
   * Streaming chat completion
   */
  async *streamChat(
    messages: ChatMessage[],
    tools?: MiniMaxTool[],
    temperature: number = 0.3
  ): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'done' | 'error';
    content?: string;
    tool_call?: any;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('MiniMax API key not configured');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: this.config.chatModel,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            name: m.name,
          })),
          tools: tools?.map(t => ({
            type: t.type,
            function: {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            },
          })),
          temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('MiniMax streaming error:', { status: response.status, error: errorText });
        yield { type: 'error', error: `API error: ${response.status}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { type: 'done' };
              logger.info('MiniMax stream complete', { duration: Date.now() - startTime });
              return;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.choices?.[0]?.delta?.content) {
                yield { type: 'content', content: parsed.choices[0].delta.content };
              }

              if (parsed.choices?.[0]?.delta?.tool_calls) {
                yield { type: 'tool_call', tool_call: parsed.choices[0].delta.tool_calls };
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }
    } catch (error) {
      logger.error('MiniMax stream failed:', error);
      yield { type: 'error', error: String(error) };
    }
  }

  /**
   * Text-to-Speech conversion
   */
  async textToSpeech(text: string, voice?: string): Promise<TTSResponse> {
    if (!this.isConfigured()) {
      throw new Error('MiniMax API key not configured');
    }

    const startTime = Date.now();
    const selectedVoice = voice || this.config.ttsVoice;

    try {
      // MiniMax TTS API endpoint
      const response = await fetch(`${this.config.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'speech-2.6-turbo', // Cost-effective option
          voice: selectedVoice,
          input: text,
          response_format: 'mp3',
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('MiniMax TTS error:', { status: response.status, error: errorText });
        throw new Error(`MiniMax TTS error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Save to uploads directory
      const ttsDir = await ensureUploadsDir('tts');
      const fileName = `tts_${Date.now()}_${uuidv4()}.mp3`;
      const outPath = path.join(ttsDir, fileName);
      await fs.promises.writeFile(outPath, audioBuffer);

      logger.info('MiniMax TTS complete', {
        voice: selectedVoice,
        textLength: text.length,
        duration: Date.now() - startTime,
      });

      return {
        audioUrl: `/uploads/tts/${fileName}`,
        duration: audioBuffer.length / 32000, // Rough estimate based on 32kbps
      };
    } catch (error) {
      logger.error('MiniMax TTS failed:', error);
      throw error;
    }
  }

  /**
   * Get list of available TTS voices
   */
  listVoices(): VoiceOption[] {
    return DEFAULT_VOICES;
  }

  /**
   * Get specific voice by ID
   */
  getVoice(voiceId: string): VoiceOption | undefined {
    return DEFAULT_VOICES.find(v => v.id === voiceId);
  }

  /**
   * Convert OpenAI-style tools to MiniMax format
   */
  convertToolsToMiniMax(tools: any[]): MiniMaxTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Convert MiniMax response to OpenAI-compatible format for assistant service
   */
  static convertToOpenAIFormat(completion: ChatCompletion) {
    return {
      id: completion.id,
      object: completion.object,
      created: completion.created,
      model: completion.model,
      choices: completion.choices.map(choice => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        },
        finish_reason: choice.finish_reason,
      })),
      usage: completion.usage,
    };
  }
}

export default MiniMaxService;
