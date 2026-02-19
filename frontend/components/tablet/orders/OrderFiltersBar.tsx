import type { ReactNode } from 'react';
export function OrderFiltersBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{children}</div>;
}
