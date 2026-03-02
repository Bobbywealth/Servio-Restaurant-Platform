import type { ReactNode } from 'react';

export function OrderFiltersBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-2xl border border-[var(--tablet-border)] bg-[var(--tablet-bg)]/95 p-3 backdrop-blur sm:gap-3">
      {children}
    </div>
  );
}
