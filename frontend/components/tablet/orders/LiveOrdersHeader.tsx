import clsx from 'clsx';
import { 
  Search, 
  X, 
  Filter, 
  Maximize2, 
  Minimize2, 
  MoreVertical, 
  RefreshCcw, 
  Volume2, 
  VolumeX,
  Wifi,
  WifiOff
} from 'lucide-react';

export type StatusTab = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  // Row 1 - Header
  isOnline: boolean;
  isFullscreen: boolean;
  now: number | null;
  
  // Row 2 - Status tabs
  statusTabs: StatusTab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  
  // Row 3 - Search and filters
  searchQuery: string;
  isSearchOpen: boolean;
  onSearchToggle: () => void;
  onSearchChange: (query: string) => void;
  onSearchClear: () => void;
  onSearchBlur: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  
  // Actions
  soundEnabled: boolean;
  onToggleSound: () => void;
  onFullscreenToggle: () => void;
  onRefresh: () => void;
  loading: boolean;
};

export function LiveOrdersHeader(props: Props) {
  const {
    isOnline,
    isFullscreen,
    now,
    statusTabs,
    activeTab,
    onTabChange,
    searchQuery,
    isSearchOpen,
    onSearchToggle,
    onSearchChange,
    onSearchClear,
    onSearchBlur,
    searchInputRef,
    showFilters,
    onToggleFilters,
    hasActiveFilters,
    soundEnabled,
    onToggleSound,
    onFullscreenToggle,
    onRefresh,
    loading
  } = props;

  const timeStr = now
    ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="flex flex-col gap-1.5">
      {/* Row 1: Page title, connection status, time, controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Title */}
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--tablet-muted)] leading-tight">Order Management</div>
          <div className="text-lg md:text-xl font-bold leading-tight truncate">Live Orders</div>
        </div>

        {/* Right: Status indicator + Time + Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connection status */}
          <div className={clsx(
            "flex items-center gap-1.5 rounded-md border border-[var(--tablet-border)] bg-[var(--tablet-surface-alt)] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide",
            isOnline ? "text-[var(--tablet-success)]" : "text-[var(--tablet-danger)]"
          )}>
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Clock */}
          <div className="text-base md:text-lg font-bold tabular-nums text-[var(--tablet-text)] px-1.5 py-1 rounded-md border border-[var(--tablet-border)] bg-[var(--tablet-surface-alt)]">
            {timeStr}
          </div>

          {/* Overflow actions */}
          <div className="relative">
            <details className="relative">
              <summary className="list-none cursor-pointer bg-[var(--tablet-surface-alt)] border border-[var(--tablet-border)] hover:brightness-110 p-2 rounded-lg transition touch-manipulation">
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
                  onClick={onToggleSound}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--tablet-surface-alt)] transition"
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  {soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                </button>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--tablet-surface-alt)] transition"
                >
                  <RefreshCcw className={clsx('h-4 w-4', loading && 'animate-spin')} />
                  Refresh orders
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Row 2: Status tabs with counts only */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {statusTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const tabColorClass = tab.key === 'received' 
            ? 'text-[var(--tablet-danger)]' 
            : tab.key === 'preparing' 
              ? 'text-[var(--tablet-warning)]' 
              : tab.key === 'ready' 
                ? 'text-[var(--tablet-success)]' 
                : 'text-[var(--tablet-muted)]';
          
          const activeBgClass = tab.key === 'received'
            ? 'bg-[var(--tablet-danger)]/15 border-[var(--tablet-danger)]/30'
            : tab.key === 'preparing'
              ? 'bg-[var(--tablet-warning)]/15 border-[var(--tablet-warning)]/30'
              : tab.key === 'ready'
                ? 'bg-[var(--tablet-success)]/15 border-[var(--tablet-success)]/30'
                : 'bg-[var(--tablet-accent)]/15 border-[var(--tablet-accent)]/30';

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={clsx(
                'min-h-[36px] min-w-[60px] rounded-lg border px-3 py-1.5 text-sm font-semibold transition touch-manipulation whitespace-nowrap',
                isActive
                  ? activeBgClass + ' border text-[var(--tablet-text)]'
                  : 'border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-[var(--tablet-muted)] hover:bg-[var(--tablet-surface-alt)]'
              )}
            >
              <span className={isActive ? tabColorClass : ''}>{tab.label}</span>
              {' '}
              <span className={clsx(
                'tabular-nums',
                isActive ? 'text-[var(--tablet-text)]' : 'text-[var(--tablet-muted)]'
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Row 3: Search and filter controls */}
      <div className="flex items-center gap-1.5">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          {isSearchOpen || searchQuery ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tablet-muted)]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                autoFocus
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={onSearchBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    onSearchClear();
                  }
                }}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-sm text-[var(--tablet-text)] placeholder-[var(--tablet-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)] focus:border-transparent transition-all"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={onSearchClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--tablet-border)] transition touch-manipulation"
                >
                  <X className="h-4 w-4 text-[var(--tablet-muted)]" />
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              aria-label="Open search"
              onClick={onSearchToggle}
              className="flex items-center gap-2 min-h-[36px] px-3 rounded-lg border border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-sm text-[var(--tablet-muted)] transition-all hover:bg-[var(--tablet-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--tablet-accent)]"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          type="button"
          onClick={onToggleFilters}
          className={clsx(
            'flex items-center gap-2 min-h-[36px] px-3 rounded-lg border text-sm font-semibold transition-all touch-manipulation',
            showFilters || hasActiveFilters
              ? 'border-[var(--tablet-accent)] bg-[var(--tablet-accent)]/15 text-[var(--tablet-accent)]'
              : 'border-[var(--tablet-border)] bg-[var(--tablet-surface)] text-[var(--tablet-muted)] hover:bg-[var(--tablet-surface-alt)]'
          )}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>
    </div>
  );
}
