import { useCallback, useEffect, useRef, useState } from 'react'
import { WakeWordService, getDefaultWakeWordConfig, isWakeWordSupported } from '../../lib/WakeWordService'

export function useWakeWord({
  onWakeWordDetected,
  onError
}: {
  onWakeWordDetected: (detectedPhrase: string) => Promise<void> | void
  onError: (message: string) => void
}) {
  const [wakeWordSupported, setWakeWordSupported] = useState(false)
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false)
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false)
  const serviceRef = useRef<WakeWordService | null>(null)

  const initialize = useCallback(async () => {
    if (!wakeWordSupported) return false
    if (serviceRef.current?.getState().isInitialized) return true

    serviceRef.current = new WakeWordService({
      ...getDefaultWakeWordConfig(),
      onWakeWordDetected,
      onError: (error: Error) => onError(error.message),
      onListeningStateChange: (isListening: boolean) => setIsListeningForWakeWord(isListening)
    } as any)

    return serviceRef.current.initialize()
  }, [onError, onWakeWordDetected, wakeWordSupported])

  const toggleWakeWordListening = useCallback(async () => {
    if (!serviceRef.current?.getState().isInitialized) {
      const initialized = await initialize()
      if (!initialized) return
    }

    if (isListeningForWakeWord) {
      await serviceRef.current?.stopListening()
      setWakeWordEnabled(false)
      return
    }

    const started = await serviceRef.current?.startListening()
    if (started) setWakeWordEnabled(true)
  }, [initialize, isListeningForWakeWord])

  useEffect(() => {
    setWakeWordSupported(isWakeWordSupported())
  }, [])

  useEffect(
    () => () => {
      serviceRef.current?.cleanup()
      serviceRef.current = null
    },
    []
  )

  return {
    wakeWordSupported,
    wakeWordEnabled,
    isListeningForWakeWord,
    initializeWakeWordService: initialize,
    toggleWakeWordListening
  }
}
