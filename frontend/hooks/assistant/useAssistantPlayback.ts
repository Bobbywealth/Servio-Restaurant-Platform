import { useCallback, useEffect, useRef, useState } from 'react'

export function useAssistantPlayback({
  resolveAudioUrl,
  onPlaybackStateChange,
  onPlaybackEnded
}: {
  resolveAudioUrl: (url: string) => string
  onPlaybackStateChange: (isSpeaking: boolean, currentAudioUrl: string | null) => void
  onPlaybackEnded?: () => void
}) {
  const [talkIntensity, setTalkIntensity] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setTalkIntensity(0)

    try {
      mediaSourceRef.current?.disconnect()
      analyserRef.current?.disconnect()
    } catch {}

    mediaSourceRef.current = null
    analyserRef.current = null

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }

    onPlaybackStateChange(false, null)
  }, [onPlaybackStateChange])

  const playAudio = useCallback(
    async (audioUrl: string) => {
      stopAudio()
      const url = resolveAudioUrl(audioUrl)
      onPlaybackStateChange(true, url)

      const audio = new Audio(url)
      audio.crossOrigin = 'anonymous'
      audioRef.current = audio

      const finish = () => {
        stopAudio()
        onPlaybackEnded?.()
      }

      if (typeof window === 'undefined') {
        audio.onended = finish
        await audio.play()
        return
      }

      const AudioContextImpl = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioContextImpl) {
        audio.onended = finish
        await audio.play()
        return
      }

      if (!audioContextRef.current) audioContextRef.current = new AudioContextImpl()
      const audioContext = audioContextRef.current
      if (!audioContext) return
      if (audioContext.state === 'suspended') await audioContext.resume()

      const source = audioContext.createMediaElementSource(audio)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyser.connect(audioContext.destination)
      mediaSourceRef.current = source
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.fftSize)
      const tick = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        setTalkIntensity(Math.min(1, Math.sqrt(sum / data.length) * 6))
        rafRef.current = requestAnimationFrame(tick)
      }

      audio.onended = finish
      await audio.play()
      rafRef.current = requestAnimationFrame(tick)
    },
    [onPlaybackEnded, onPlaybackStateChange, resolveAudioUrl, stopAudio]
  )

  useEffect(
    () => () => {
      stopAudio()
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
    },
    [stopAudio]
  )

  return { playAudio, stopAudio, talkIntensity }
}
