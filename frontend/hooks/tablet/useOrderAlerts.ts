import { useEffect, useRef, useState } from 'react';
import { safeLocalStorage } from '../../lib/utils';

let audioUnlocked = false;
let notificationAudio: HTMLAudioElement | null = null;

function initAudio() {
  if (typeof window === 'undefined') return;
  try {
    notificationAudio = new Audio('/sounds/order-alert.mp3');
    notificationAudio.preload = 'auto';
    notificationAudio.volume = 1.0;
  } catch {}
}

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ctx.resume?.();
    }
    notificationAudio?.load();
  } catch {}
}

function beep() {
  try {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1000;
    g.gain.value = 0.5;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    window.setTimeout(() => {
      o.stop();
      ctx.close?.().catch(() => {});
    }, 200);
  } catch {}
}

function playAlarmTone() {
  if (notificationAudio) {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {
      beep();
      window.setTimeout(() => beep(), 300);
      window.setTimeout(() => beep(), 600);
    });
    return;
  }
  beep();
  window.setTimeout(() => beep(), 300);
  window.setTimeout(() => beep(), 600);
}

function stopAlarmTone() {
  if (!notificationAudio) return;
  try {
    notificationAudio.pause();
    notificationAudio.currentTime = 0;
  } catch {}
}

export function useOrderAlerts(receivedOrdersCount: number) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const alarmIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    initAudio();
    const handleInteraction = () => {
      unlockAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  useEffect(() => {
    const storedSound = safeLocalStorage.getItem('servio_sound_enabled');
    if (storedSound !== null) {
      setSoundEnabled(storedSound === 'true');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (receivedOrdersCount > 0 && soundEnabled) {
      if (alarmIntervalRef.current === null) {
        playAlarmTone();
        alarmIntervalRef.current = window.setInterval(playAlarmTone, 2500);
      }
    } else {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      stopAlarmTone();
    }

    return () => {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      stopAlarmTone();
    };
  }, [receivedOrdersCount, soundEnabled]);

  const toggleSound = () => {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    safeLocalStorage.setItem('servio_sound_enabled', nextValue ? 'true' : 'false');
  };

  return { soundEnabled, toggleSound };
}
