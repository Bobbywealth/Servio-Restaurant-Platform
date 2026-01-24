import { useRouter } from 'next/router';
import clsx from 'clsx';
import { Clock, Home, Info, Menu, Moon, Receipt, Settings2, Sparkles, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { actualTheme, toggleTheme } = useTheme();
  const themeLabel = actualTheme === 'dark' ? 'Light' : 'Dark';

  return (
    <aside className="w-full lg:w-[76px] bg-[var(--tablet-sidebar)] border-b lg:border-b-0 lg:border-r border-[var(--tablet-sidebar-border)] flex lg:flex-col items-center justify-between lg:justify-start py-3 lg:py-4 px-3 lg:px-0 gap-3 lg:gap-4">
      <button
        type="button"
        onClick={() => router.push('/tablet')}
        className="relative w-12 h-12 lg:w-[70px] lg:h-[70px] flex items-center justify-center rounded-xl bg-[var(--tablet-surface-alt)] hover:brightness-110 transition-colors"
        aria-label="Servio home"
      >
        <img src="/images/servio_icon_tight.png" alt="Servio" className="h-10 w-10 object-contain" />
        {statusDotClassName ? (
          <span className={clsx('absolute top-2 right-2 h-2 w-2 rounded-full', statusDotClassName)} />
        ) : null}
      </button>
      <nav className="flex flex-1 lg:flex-none lg:flex-col items-center justify-center gap-3 lg:gap-4 lg:mt-2 text-[var(--tablet-muted)] overflow-x-auto px-2 lg:px-0">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = router.pathname === href;
          return (
            <button
              key={label}
              type="button"
              onClick={() => router.push(href)}
              className={clsx(
                'relative h-10 w-10 lg:h-12 lg:w-12 rounded-2xl flex items-center justify-center transition',
                isActive
                  ? 'bg-[var(--tablet-surface-alt)] text-[var(--tablet-accent)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  : 'hover:bg-[var(--tablet-card)] text-[var(--tablet-muted)]'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && <span className="absolute left-0 h-7 w-1 rounded-full bg-[var(--tablet-accent)]" />}
              <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={toggleTheme}
        className="lg:mt-auto mx-3 lg:mx-0 flex items-center gap-2 rounded-full border border-[var(--tablet-border)] bg-[var(--tablet-surface-alt)] px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--tablet-text)] shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition hover:brightness-110"
        aria-label={`Switch to ${themeLabel.toLowerCase()} mode`}
      >
        {actualTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span>{themeLabel} Mode</span>
      </button>
    </aside>
  );
}
