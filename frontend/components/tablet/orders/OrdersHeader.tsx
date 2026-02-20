import clsx from 'clsx';
import { Maximize2, Minimize2, RefreshCcw, Volume2, VolumeX } from 'lucide-react';

type Props = {
  connectionClasses: string;
  connectionLabel: string;
  cachedAt: string | null;
  soundEnabled: boolean;
  toggleSound: () => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  now: number | null;
  refresh: () => void;
  loading: boolean;
};

export function OrdersHeader(props: Props) {
  const {
    connectionClasses,
    connectionLabel,
    cachedAt,
    soundEnabled,
    toggleSound,
    isFullscreen,
    onFullscreenToggle,
    now,
    refresh,
    loading
  } = props;

  const timeStr = now
    ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left: Title */}
      <div className="min-w-0">
        <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--tablet-muted)] leading-tight">Order Management</div>
        <div className="text-xl md:text-2xl font-bold leading-tight truncate">Live Orders</div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Connection badge */}
        <div className={clsx('px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide border rounded-full', connectionClasses)}>
          {connectionLabel}
        </div>

        {/* Cached time - hidden on small screens */}
        {cachedAt && (
          <div className="text-[0.65rem] text-[var(--tablet-muted)] font-medium hidden lg:block">
            {new Date(cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className={clsx(
            'p-2 rounded-xl transition touch-manipulation',
            soundEnabled
              ? 'bg-[var(--tablet-success)]/20 text-[var(--tablet-success)] border border-[var(--tablet-success)]/30'
              : 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-muted)] border border-[var(--tablet-border)]'
          )}
          aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={onFullscreenToggle}
          className="bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] hover:brightness-110 p-2 rounded-xl transition touch-manipulation"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {/* Clock */}
        <div className="text-lg md:text-xl font-bold tabular-nums text-[var(--tablet-text)] px-1">
          {timeStr}
        </div>

        {/* Refresh */}
        <button
          onClick={refresh}
          className="bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] hover:brightness-110 p-2 rounded-xl transition touch-manipulation"
          aria-label="Refresh"
        >
          <RefreshCcw className={clsx('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
