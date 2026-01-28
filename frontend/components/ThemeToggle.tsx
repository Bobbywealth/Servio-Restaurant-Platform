'use client';

import { ThemeProvider } from './ThemeProvider';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

export function DarkModeToggle() {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--tablet-surface)] border border-[var(--tablet-border)]">
      <div className="text-sm font-semibold text-[var(--tablet-text)]">Theme</div>
      <div className="flex gap-1">
        <button
          onClick={() => document.documentElement.classList.toggle('dark')}
          className="p-2 rounded-md transition-all bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]"
          title="Toggle dark mode"
        >
          <Sun className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function ReducedMotionToggle() {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--tablet-surface)] border border-[var(--tablet-border)]">
      <div className="text-sm font-semibold text-[var(--tablet-text)]">Motion</div>
      <div className="flex gap-1">
        <button
          onClick={() => {
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            document.documentElement.style.setProperty(
              '--tw-animate-duration',
              reduced ? '0.01ms' : undefined
            );
          }}
          className="p-2 rounded-md transition-all bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]"
          title="Toggle reduced motion"
        >
          <Sun className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
