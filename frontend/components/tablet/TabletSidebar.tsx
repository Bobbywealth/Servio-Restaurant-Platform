import { useRouter } from 'next/router';
import clsx from 'clsx';
import { Clock, Home, Info, Menu, Receipt, Settings2, Sparkles } from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

type TabletSidebarProps = {
  statusDotClassName?: string;
};

const navItems: NavItem[] = [
  { label: 'Orders', href: '/tablet/orders', icon: Receipt },
  { label: 'History', href: '/tablet/history', icon: Clock },
  { label: 'Menu', href: '/tablet/menu', icon: Menu },
  { label: 'Assistant', href: '/tablet/assistant', icon: Sparkles },
  { label: 'Info', href: '/tablet/info', icon: Info },
  { label: 'Settings', href: '/tablet/settings', icon: Settings2 },
];

export function TabletSidebar({ statusDotClassName }: TabletSidebarProps) {
  const router = useRouter();

  return (
    <aside className="w-full md:w-12 lg:w-12 bg-[var(--tablet-sidebar)] border-b md:border-b-0 md:border-r lg:border-b-0 lg:border-r border-[var(--tablet-sidebar-border)] flex md:flex-col items-center justify-between md:justify-start py-3 md:py-3 px-3 md:px-0 gap-3 md:gap-4 shrink-0">
      <button
        type="button"
        onClick={() => router.push('/tablet')}
        className="relative w-12 h-12 md:w-11 md:h-11 lg:w-11 lg:h-11 flex items-center justify-center rounded-xl bg-[var(--tablet-surface-alt)] hover:brightness-110 transition-colors touch-manipulation"
        aria-label="Servio home"
      >
        <img src="/images/servio_icon_tight.png" alt="Servio" className="h-10 w-10 md:h-8 md:w-8 lg:h-8 lg:w-8 object-contain" />
        {statusDotClassName ? (
          <span className={clsx('absolute top-1.5 right-1.5 h-2 w-2 rounded-full', statusDotClassName)} />
        ) : null}
      </button>
      <nav className="flex-1 md:flex-none md:flex-col items-center justify-center gap-2 md:gap-3 lg:gap-4 lg:mt-2 text-[var(--tablet-muted)] overflow-x-auto md:overflow-visible px-2 md:px-0 scrollbar-hide">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = router.pathname === href;
          return (
            <button
              key={label}
              type="button"
              onClick={() => router.push(href)}
              className={clsx(
                'relative h-11 w-11 md:h-12 md:w-12 lg:h-12 lg:w-12 rounded-xl md:rounded-2xl flex items-center justify-center transition touch-manipulation',
                isActive
                  ? 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-accent)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  : 'hover:bg-[var(--tablet-card)] text-[var(--tablet-muted)]'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute top-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-[var(--tablet-accent)] md:top-1/2 md:left-1 md:h-6 md:w-1 md:-translate-x-0 md:-translate-y-1/2" />
              )}
              <Icon className="h-5 w-5 md:h-5.5 md:w-5.5 lg:h-6 lg:w-6" />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
