import { useEffect, useRef, useState } from 'react';
import { safeLocalStorage } from '../../lib/utils';

let audioUnlocked = false;
let notificationAudio: HTMLAudioElement | null = null;
let alertAudioContext: AudioContext | null = null;
let nextBeepAt = 0;

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
      alertAudioContext = alertAudioContext ?? new AudioContext();
      const ctx = alertAudioContext;
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
    alertAudioContext = alertAudioContext ?? new AudioContext();
    const ctx = alertAudioContext;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const startAt = Math.max(ctx.currentTime + 0.01, nextBeepAt);
    nextBeepAt = startAt + 0.2;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1000;
    g.gain.value = 0.5;
    o.connect(g);
    g.connect(ctx.destination);
    o.start(startAt);
    o.stop(startAt + 0.2);
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

export function useOrderAlerts(receivedOrders: Array<{ id?: string | null; created_at?: string | null }>) {
  const receivedOrdersCount = receivedOrders.length;
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const storedSound = safeLocalStorage.getItem('servio_sound_enabled');
    return storedSound === null ? true : storedSound === 'true';
  });
  const alarmIntervalRef = useRef<number | null>(null);
  const hasSeenInitialCountRef = useRef(false);
  const previousReceivedOrdersCountRef = useRef(0);
  const previousReceivedOrderIdsRef = useRef<Set<string>>(new Set());

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

    const currentOrderIds = new Set(
      receivedOrders
        .map(order => order.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const hasNewReceivedOrders = [...currentOrderIds].some(orderId => !previousReceivedOrderIdsRef.current.has(orderId))
      || receivedOrdersCount > previousReceivedOrdersCountRef.current;

    if (!hasSeenInitialCountRef.current) {
      hasSeenInitialCountRef.current = true;
      previousReceivedOrdersCountRef.current = receivedOrdersCount;
      previousReceivedOrderIdsRef.current = currentOrderIds;

      if (!soundEnabled || receivedOrdersCount === 0) {
        stopAlarmTone();
        return;
      }

      return;
    }

    previousReceivedOrdersCountRef.current = receivedOrdersCount;
    previousReceivedOrderIdsRef.current = currentOrderIds;

    // Keep alert ringing while there are unaccepted orders; trigger immediately when new IDs appear.
    if (soundEnabled && (hasNewReceivedOrders || receivedOrdersCount > 0)) {
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
