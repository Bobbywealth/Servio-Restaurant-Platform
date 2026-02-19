import { test, expect } from '@playwright/test'
import {
  assistantStateReducer,
  initialAssistantMachineState,
  shouldAutoRestartAfterPlayback,
  shouldProcessTranscriptInAlwaysListening
} from '../lib/assistant/stateMachine'

test.describe('assistant state machine', () => {
  test('keeps voice mode mutually exclusive', async () => {
    let state = initialAssistantMachineState
    state = assistantStateReducer(state, { type: 'START_RECORDING' })
    expect(state.mode).toBe('recording')

    state = assistantStateReducer(state, { type: 'START_PROCESSING' })
    expect(state.mode).toBe('processing')

    state = assistantStateReducer(state, { type: 'START_SPEAKING' })
    expect(state.mode).toBe('speaking')
  })

  test('playback end auto-restart gate is strict', async () => {
    expect(shouldAutoRestartAfterPlayback({ alwaysListening: true, mode: 'idle' })).toBeTruthy()
    expect(shouldAutoRestartAfterPlayback({ alwaysListening: true, mode: 'speaking' })).toBeFalsy()
    expect(shouldAutoRestartAfterPlayback({ alwaysListening: false, mode: 'idle' })).toBeFalsy()
  })


  test('disabling always-listening clears conversation window', async () => {
    let state = assistantStateReducer(initialAssistantMachineState, { type: 'SET_CONVERSATION_WINDOW', enabled: true })
    state = assistantStateReducer(state, { type: 'SET_ALWAYS_LISTENING', enabled: false })
    expect(state.inConversationWindow).toBeFalsy()
  })

  test('wake-word gate respects conversation window', async () => {
    expect(shouldProcessTranscriptInAlwaysListening('what is the weather', false)).toEqual({
      shouldProcess: false,
      hasWakeWord: false
    })
    expect(shouldProcessTranscriptInAlwaysListening('Servio check inventory', false)).toEqual({
      shouldProcess: true,
      hasWakeWord: true
    })
    expect(shouldProcessTranscriptInAlwaysListening('continue please', true).shouldProcess).toBeTruthy()
  })
})
