import Link from 'next/link';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { Activity, ClipboardList, Home, MessageSquare, User } from 'lucide-react';

type NavItem = {
  key: 'home' | 'orders' | 'activity' | 'messages' | 'profile';
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { key: 'home', label: 'Home', href: '/tablet', Icon: Home },
  { key: 'orders', label: 'Orders', href: '/tablet/orders', Icon: ClipboardList },
  { key: 'activity', label: 'Activity', href: '/tablet/activity', Icon: Activity },
  { key: 'messages', label: 'Messages', href: '/tablet/messages', Icon: MessageSquare },
  { key: 'profile', label: 'Profile', href: '/tablet/profile', Icon: User }
];

function normalizePath(p: string) {
  return (p || '/').split('?')[0].replace(/\/+$/, '') || '/';
}

function isActivePath(current: string, href: string) {
  const c = normalizePath(current);
  const h = normalizePath(href);
  if (h === '/tablet') {
    // Treat tablet landing as active for any tablet route unless a deeper tab matches.
    return c === '/tablet' || c === '/tablet/orders';
  }
  return c === h;
}

export function TabletBottomNav({ className }: { className?: string }) {
  const router = useRouter();
  const current = router.asPath || router.pathname || '/';

  return (
    <nav
      aria-label="Primary"
      className={clsx(
        'tablet-nav fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-inset-bottom',
        className
      )}
    >
      <div className="mx-auto max-w-6xl px-3">
        <div className="grid grid-cols-5 gap-2 py-2">
          {NAV.map((item) => {
            const active = isActivePath(current, item.href);
            const Icon = item.Icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  'tablet-pressable flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <div
                  className={clsx(
                    'flex h-10 w-12 items-center justify-center rounded-2xl transition-colors',
                    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className={clsx('mt-1 leading-none', active && 'font-semibold')}>{item.label}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

