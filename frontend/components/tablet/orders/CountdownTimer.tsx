import { useEffect, useState, useCallback } from 'react';
import { Clock, AlertTriangle, Truck, MapPin } from 'lucide-react';
import clsx from 'clsx';

type TimerState = 'counting' | 'warning' | 'critical' | 'expired' | 'hidden';

interface CountdownTimerProps {
  /** Timestamp when the order was received (ISO string) */
  orderReceivedAt: string | null | undefined;
  /** Total countdown duration in seconds (default: 180 seconds = 3 minutes) */
  durationSeconds?: number;
  /** Callback when timer expires - reason tells why (e.g., 'response_timeout') */
  onExpire?: (reason?: string) => void;
  /** Whether to show the timer (false after order is accepted) */
  visible: boolean;
  /** Prep time display (when order is accepted) */
  prepTimeDisplay?: string | null;
  /** Order type for context */
  orderType?: string | null | undefined;
  /** Callback to report timer state changes for analytics */
  onTimerStateChange?: (state: TimerState) => void;
  /** Reason for expiration (for logging/display purposes) */
  expireReason?: string;
}

const WARNING_THRESHOLD_SECONDS = 60; // Last minute warning
const CRITICAL_THRESHOLD_SECONDS = 30; // Last 30 seconds critical

export function CountdownTimer({
  orderReceivedAt,
  durationSeconds = 180, // 3 minutes default
  onExpire,
  visible,
  prepTimeDisplay,
  orderType,
  onTimerStateChange,
  expireReason = 'response_timeout',
}: CountdownTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(durationSeconds);
  const [hasExpired, setHasExpired] = useState(false);

  // Calculate remaining time based on when order was received
  const calculateRemaining = useCallback(() => {
    if (!orderReceivedAt || hasExpired) return 0;
    
    const receivedTime = new Date(orderReceivedAt).getTime();
    const now = Date.now();
    const elapsedMs = now - receivedTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remaining = Math.max(0, durationSeconds - elapsedSeconds);
    
    return remaining;
  }, [orderReceivedAt, durationSeconds, hasExpired]);

  // Update countdown every second
  useEffect(() => {
    if (!visible || !orderReceivedAt || hasExpired) {
      return;
    }

    // Initial calculation
    const initialRemaining = calculateRemaining();
    setRemainingSeconds(initialRemaining);

    if (initialRemaining <= 0) {
      setHasExpired(true);
      onExpire?.('response_timeout');
      onTimerStateChange?.('expired');
      return;
    }

    // Update every second
    const interval = setInterval(() => {
      const newRemaining = calculateRemaining();
      setRemainingSeconds(newRemaining);

      if (newRemaining <= 0) {
        setHasExpired(true);
        onExpire?.('response_timeout');
        onTimerStateChange?.('expired');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, orderReceivedAt, hasExpired, calculateRemaining, onExpire, onTimerStateChange]);

  // Determine timer state for styling and reporting
  const getTimerState = useCallback((): TimerState => {
    if (!visible) return 'hidden';
    if (hasExpired || remainingSeconds <= 0) return 'expired';
    if (remainingSeconds <= CRITICAL_THRESHOLD_SECONDS) return 'critical';
    if (remainingSeconds <= WARNING_THRESHOLD_SECONDS) return 'warning';
    return 'counting';
  }, [visible, hasExpired, remainingSeconds]);

  // Report state changes
  useEffect(() => {
    const state = getTimerState();
    onTimerStateChange?.(state);
  }, [getTimerState, onTimerStateChange]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // After order is accepted, show prep time / pickup timeframe
  if (prepTimeDisplay !== undefined && prepTimeDisplay !== null) {
    return (
      <div className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold',
        'bg-[var(--tablet-success)]/15 text-[var(--tablet-success)]'
      )}>
        {orderType?.toLowerCase().includes('delivery') ? (
          <Truck className="h-3.5 w-3.5" />
        ) : (
          <MapPin className="h-3.5 w-3.5" />
        )}
        <span>Ready {prepTimeDisplay}</span>
      </div>
    );
  }

  const timerState = getTimerState();

  // Expired state
  if (timerState === 'expired') {
    return (
      <div className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold',
        'bg-[var(--tablet-danger)]/15 text-[var(--tablet-danger)] animate-pulse'
      )}>
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Expired</span>
      </div>
    );
  }

  // Config for different states
  const config = {
    counting: {
      className: 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-text)]',
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    warning: {
      className: 'bg-[var(--tablet-warning)]/20 text-[var(--tablet-warning)]',
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    critical: {
      className: 'bg-[var(--tablet-danger)]/20 text-[var(--tablet-danger)] animate-pulse',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    },
  };

  const { className, icon } = config[timerState as keyof typeof config] || config.counting;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold tabular-nums',
        'transition-colors duration-300',
        className
      )}
      role="timer"
      aria-live="polite"
      aria-label={`${formatTime(remainingSeconds)} remaining to accept order`}
    >
      {icon}
      <span>{formatTime(remainingSeconds)}</span>
    </div>
  );
}

// Hook for managing countdown state
export function useCountdownTimer(orderReceivedAt: string | null, durationSeconds = 180) {
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    if (!orderReceivedAt) {
      setRemainingSeconds(durationSeconds);
      setHasExpired(false);
      return;
    }

    const calculateRemaining = () => {
      const receivedTime = new Date(orderReceivedAt).getTime();
      const now = Date.now();
      const elapsedMs = now - receivedTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      return Math.max(0, durationSeconds - elapsedSeconds);
    };

    const initialRemaining = calculateRemaining();
    setRemainingSeconds(initialRemaining);
    setHasExpired(initialRemaining <= 0);

    if (initialRemaining <= 0) return;

    const interval = setInterval(() => {
      const newRemaining = calculateRemaining();
      setRemainingSeconds(newRemaining);

      if (newRemaining <= 0) {
        setHasExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orderReceivedAt, durationSeconds]);

  return { remainingSeconds, hasExpired };
}
