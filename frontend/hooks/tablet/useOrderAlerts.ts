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
  if (!audioUnlocked) return;

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

export function useOrderAlerts(receivedOrders: Array<{ created_at?: string | null }>) {
  const receivedOrdersCount = receivedOrders.length;
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const storedSound = safeLocalStorage.getItem('servio_sound_enabled');
    return storedSound === null ? true : storedSound === 'true';
  });
  const alarmIntervalRef = useRef<number | null>(null);
  const hasSeenInitialCountRef = useRef(false);
  const previousReceivedOrdersCountRef = useRef(0);

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
    if (typeof window === 'undefined') return;

    // Check if there's a genuinely NEW order (created within last 5 seconds)
    // This prevents sounds from playing on page load or when existing orders change status
    const hasNewIncomingOrder = receivedOrders.some(order => {
      const createdAtStr = order.created_at;
      if (!createdAtStr) return false;
      const createdAt = new Date(createdAtStr).getTime();
      const now = Date.now();
      return (now - createdAt) < 5000; // Order created in last 5 seconds
    });

    const hasNewReceivedOrders = receivedOrdersCount > previousReceivedOrdersCountRef.current;

    if (!hasSeenInitialCountRef.current) {
      hasSeenInitialCountRef.current = true;
      previousReceivedOrdersCountRef.current = receivedOrdersCount;

      if (!soundEnabled || receivedOrdersCount === 0) {
        stopAlarmTone();
        return;
      }

      return;
    }

    previousReceivedOrdersCountRef.current = receivedOrdersCount;

    // Only play sound if there's a genuinely NEW incoming order (not just status changes)
    if (soundEnabled && hasNewIncomingOrder) {
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
  }, [receivedOrdersCount, soundEnabled, receivedOrders]);

  const toggleSound = () => {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    safeLocalStorage.setItem('servio_sound_enabled', nextValue ? 'true' : 'false');
  };

  return { soundEnabled, toggleSound };
}
