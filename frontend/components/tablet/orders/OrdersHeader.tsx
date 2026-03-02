import clsx from 'clsx';
import { Maximize2, Minimize2, MoreVertical, RefreshCcw, Volume2, VolumeX } from 'lucide-react';

type Props = {
  connectionDotClasses: string;
  connectionText?: string;
  soundEnabled: boolean;
  toggleSound: () => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  now: number | null;
  refresh: () => void;
  loading: boolean;
  activeCount: number;
  lateCount: number;
};

export function OrdersHeader(props: Props) {
  const {
    connectionDotClasses,
    connectionText,
    soundEnabled,
    toggleSound,
    isFullscreen,
    onFullscreenToggle,
    now,
    refresh,
    loading,
    activeCount,
    lateCount
  } = props;

  const timeStr = now
    ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left: Title */}
      <div className="min-w-0">
        <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--tablet-muted)] leading-tight">Order Management</div>
        <div className="flex items-center gap-2">
          <div className="text-xl md:text-2xl font-bold leading-tight truncate">Live Orders</div>
        </div>
      </div>

      {/* Right: KPI badges + controls */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface-alt)] px-2.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--tablet-muted)]">
            Active
            <span className="text-[var(--tablet-text)]">{activeCount}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface-alt)] px-2.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--tablet-muted)]">
            Late
            <span className={clsx(lateCount > 0 ? 'text-[var(--tablet-danger)]' : 'text-[var(--tablet-text)]')}>{lateCount}</span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface-alt)] px-2.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--tablet-muted)]">
            <span className={clsx('h-2.5 w-2.5 rounded-full', connectionDotClasses)} aria-hidden="true" />
            {connectionText || 'Offline'}
          </div>
        </div>

        {/* Clock */}
        <div className="text-lg md:text-xl font-bold tabular-nums text-[var(--tablet-text)] px-1">
          {timeStr}
        </div>

        {/* Overflow actions */}
        <details className="relative">
          <summary className="list-none cursor-pointer bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] hover:brightness-110 p-2 rounded-xl transition touch-manipulation">
            <MoreVertical className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 mt-2 w-44 rounded-xl border border-[var(--tablet-border)] bg-[var(--tablet-surface)] p-1 shadow-lg z-20">
            <button
              type="button"
              onClick={onFullscreenToggle}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--tablet-surface-alt)] transition"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            </button>
            <button
              type="button"
              onClick={toggleSound}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--tablet-surface-alt)] transition"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            </button>
            <button
              type="button"
              onClick={refresh}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--tablet-surface-alt)] transition"
            >
              <RefreshCcw className={clsx('h-4 w-4', loading && 'animate-spin')} />
              Refresh orders
            </button>
          </div>
        </details>

      </div>
    </div>
  );
}
