import type { ReactNode } from 'react';
export function CustomerActionsPanel({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-5 hidden xl:flex">{children}</section>;
}
