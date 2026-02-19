import type { ReactNode } from 'react';
export function OrderDetailsPanel({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-5 hidden md:flex">{children}</section>;
}
