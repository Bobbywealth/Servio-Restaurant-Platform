export type AssistantMode = 'idle' | 'recording' | 'processing' | 'speaking'

export interface AssistantMachineState {
  mode: AssistantMode
  alwaysListening: boolean
  inConversationWindow: boolean
}

export type AssistantMachineAction =
  | { type: 'SET_MODE'; mode: AssistantMode }
  | { type: 'START_RECORDING' }
  | { type: 'START_PROCESSING' }
  | { type: 'START_SPEAKING' }
  | { type: 'RESET_IDLE' }
  | { type: 'SET_ALWAYS_LISTENING'; enabled: boolean }
  | { type: 'SET_CONVERSATION_WINDOW'; enabled: boolean }

export const initialAssistantMachineState: AssistantMachineState = {
  mode: 'idle',
  alwaysListening: false,
  inConversationWindow: false
}

export function assistantStateReducer(
  state: AssistantMachineState,
  action: AssistantMachineAction
): AssistantMachineState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'START_RECORDING':
      return { ...state, mode: 'recording' }
    case 'START_PROCESSING':
      return { ...state, mode: 'processing' }
    case 'START_SPEAKING':
      return { ...state, mode: 'speaking' }
    case 'RESET_IDLE':
      return { ...state, mode: 'idle' }
    case 'SET_ALWAYS_LISTENING':
      return {
        ...state,
        alwaysListening: action.enabled,
        inConversationWindow: action.enabled ? state.inConversationWindow : false
      }
    case 'SET_CONVERSATION_WINDOW':
      return { ...state, inConversationWindow: action.enabled }
    default:
      return state
  }
}

export function shouldAutoRestartAfterPlayback(args: {
  alwaysListening: boolean
  mode: AssistantMode
}): boolean {
  return args.alwaysListening && args.mode === 'idle'
}

const WAKE_WORD_VARIANTS = [
  'servio',
  'sergio',
  'serveio',
  'service',
  'servile',
  'cervio',
  'serbio',
  'survio',
  'servia',
  'serve yo',
  'serve io'
]

export function shouldProcessTranscriptInAlwaysListening(
  transcript: string,
  inConversationWindow: boolean
): { shouldProcess: boolean; hasWakeWord: boolean } {
  const normalized = transcript.toLowerCase().trim()
  const hasWakeWord = WAKE_WORD_VARIANTS.some((variant) => normalized.includes(variant))

  return {
    shouldProcess: hasWakeWord || inConversationWindow,
    hasWakeWord
  }
}
