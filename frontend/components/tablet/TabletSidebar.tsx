import { useRouter } from 'next/router';
import clsx from 'clsx';
import { Archive, BookOpen, Clock, Home, Info, Settings2, UtensilsCrossed } from 'lucide-react';
import { OFFICIAL_SERVIO_LOGO } from '../../lib/branding';

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

type TabletSidebarProps = {
  statusDotClassName?: string;
};

const navItems: NavItem[] = [
  { label: 'Orders', href: '/tablet/orders', icon: Archive },
  { label: 'History', href: '/tablet/history', icon: Clock },
  { label: 'Menu', href: '/tablet/menu', icon: UtensilsCrossed },
  { label: 'Info', href: '/tablet/info', icon: Info },
  { label: 'Settings', href: '/tablet/settings', icon: Settings2 },
];

export function TabletSidebar({ statusDotClassName }: TabletSidebarProps) {
  const router = useRouter();

  return (
    <aside className="w-full md:w-12 lg:w-12 bg-[var(--tablet-sidebar)] border-b md:border-b-0 md:border-r lg:border-b-0 lg:border-r border-[var(--tablet-sidebar-border)] flex md:flex-col items-center justify-between md:justify-start py-3 md:py-3 px-3 md:px-0 gap-3 md:gap-4 shrink-0 z-50">
      <button
        type="button"
        onClick={() => router.push('/tablet')}
        className="relative w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--tablet-surface-alt)] hover:brightness-110 transition-colors touch-manipulation z-10"
        aria-label="Servio home"
      >
        <img src={OFFICIAL_SERVIO_LOGO} alt="Servio Logo" className="h-9 w-9 object-contain" />
        {statusDotClassName ? (
          <span className={clsx('absolute top-1.5 right-1.5 h-2 w-2 rounded-full', statusDotClassName)} />
        ) : null}
      </button>
      <nav className="flex-1 md:flex-none md:flex-col items-center justify-center gap-3 text-[var(--tablet-muted)] overflow-x-auto md:overflow-visible px-2 md:px-0 scrollbar-hide">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = router.pathname === href;
          return (
            <button
              key={label}
              type="button"
              onClick={() => router.push(href)}
              className={clsx(
                'relative h-12 w-12 rounded-2xl flex items-center justify-center transition touch-manipulation z-10',
                isActive
                  ? 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-accent)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  : 'hover:bg-[var(--tablet-card)] text-[var(--tablet-muted)]'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute top-1/2 left-1 h-6 w-1 -translate-y-1/2 rounded-full bg-[var(--tablet-accent)]" />
              )}
              <Icon className="h-6 w-6" />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
