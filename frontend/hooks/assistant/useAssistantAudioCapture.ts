import { useCallback, useEffect, useRef, useState } from 'react'

const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

function getSupportedMimeType() {
  for (const candidate of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return null
}

export function useAssistantAudioCapture({
  onRecordingStopped,
  onAccessError
}: {
  onRecordingStopped: () => Promise<void> | void
  onAccessError: () => void
}) {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const setup = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
        })
        if (cancelled) return

        const preferred = getSupportedMimeType()
        const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream)
        mimeTypeRef.current = preferred ?? recorder.mimeType ?? null

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }

        recorder.onstop = async () => {
          await onRecordingStopped()
        }

        setMediaRecorder(recorder)
      } catch {
        onAccessError()
      }
    }

    setup()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onAccessError, onRecordingStopped])

  const startRecording = useCallback(() => {
    if (!mediaRecorder || mediaRecorder.state !== 'inactive') return false
    audioChunksRef.current = []
    mediaRecorder.start(100)
    return true
  }, [mediaRecorder])

  const stopRecording = useCallback(() => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return false
    mediaRecorder.stop()
    return true
  }, [mediaRecorder])

  const consumeAudioChunks = useCallback(() => {
    const chunks = [...audioChunksRef.current]
    audioChunksRef.current = []
    return {
      chunks,
      mimeType: mimeTypeRef.current || 'audio/webm;codecs=opus'
    }
  }, [])

  return { mediaRecorder, startRecording, stopRecording, consumeAudioChunks }
}
