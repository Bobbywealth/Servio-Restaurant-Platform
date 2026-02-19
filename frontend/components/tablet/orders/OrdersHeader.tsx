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

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--tablet-muted)]">Order Management</div>
        <div className="text-2xl md:text-3xl font-semibold">All Orders</div>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <div className={`px-3 py-1.5 text-xs font-semibold uppercase border rounded-full ${connectionClasses}`}>{connectionLabel}</div>
        {cachedAt ? <div className="text-xs text-[var(--tablet-muted)] font-medium hidden sm:block">Cached: {new Date(cachedAt).toLocaleTimeString()}</div> : null}
        <button onClick={toggleSound} className={clsx('p-2.5 rounded-full transition touch-manipulation', soundEnabled ? 'bg-[var(--tablet-success)] text-white' : 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-muted)]')} aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
          {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
        <button onClick={onFullscreenToggle} className="bg-[var(--tablet-surface-alt)] hover:brightness-110 p-2.5 rounded-full transition shadow-[0_2px_8px_rgba(0,0,0,0.3)] touch-manipulation" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
        <div className="text-right">
          <div className="text-xl md:text-2xl font-semibold tabular-nums">{now ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
        </div>
        <button onClick={refresh} className="bg-[var(--tablet-surface-alt)] hover:brightness-110 p-3 rounded-full transition shadow-[0_2px_8px_rgba(0,0,0,0.3)] touch-manipulation" aria-label="Refresh">
          <RefreshCcw className={clsx('h-5 w-5', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
