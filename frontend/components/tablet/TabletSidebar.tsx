import { useRouter } from 'next/router';
import clsx from 'clsx';
import {
  Bot,
  Clock,
  Home,
  Info,
  Receipt,
  Settings2,
  UtensilsCrossed,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

type TabletSidebarProps = {
  statusDotClassName?: string;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/tablet', icon: Home },
  { label: 'Recent', href: '/tablet/history', icon: Clock },
  { label: 'Orders', href: '/tablet/orders', icon: Receipt },
  { label: 'Menu', href: '/tablet/menu', icon: UtensilsCrossed },
  { label: 'Assistant', href: '/tablet/assistant', icon: Bot },
  { label: 'Info', href: '/tablet/info', icon: Info },
  { label: 'Settings', href: '/tablet/settings', icon: Settings2 },
];

export function TabletSidebar({ statusDotClassName }: TabletSidebarProps) {
  const router = useRouter();

  return (
    <aside className="w-[76px] bg-[#161616] border-r border-[#202020] flex flex-col items-center py-4 gap-4">
      <button
        type="button"
        onClick={() => router.push('/tablet')}
        className="relative w-[70px] h-[70px] flex items-center justify-center rounded-xl bg-[#1f1f1f] hover:bg-[#262319] transition-colors"
        aria-label="Servio home"
      >
        <img src="/images/servio_icon_tight.png" alt="Servio" className="h-10 w-10 object-contain" />
        {statusDotClassName ? (
          <span className={clsx('absolute top-2 right-2 h-2 w-2 rounded-full', statusDotClassName)} />
        ) : null}
      </button>
      <nav className="flex flex-col items-center gap-4 mt-2 text-[#6a6a6a]">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = router.pathname === href;
          return (
            <button
              key={label}
              type="button"
              onClick={() => router.push(href)}
              className={clsx(
                'relative h-12 w-12 rounded-2xl flex items-center justify-center transition',
                isActive
                  ? 'bg-[#262319] text-[#c4a661] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  : 'hover:bg-[#202020] text-[#6a6a6a]'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && <span className="absolute left-0 h-7 w-1 rounded-full bg-[#c4a661]" />}
              <Icon className="h-6 w-6" />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
