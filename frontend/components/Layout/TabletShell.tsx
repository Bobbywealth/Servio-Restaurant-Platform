import Head from 'next/head';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Bell, Search } from 'lucide-react';
import { TabletBottomNav } from './TabletBottomNav';

type TabletShellProps = {
  title: string;
  children: ReactNode;
  rightActions?: ReactNode;
  leftHref?: string;
  hideNav?: boolean;
  className?: string;
  contentClassName?: string;
  containerClassName?: string;
  disableContainer?: boolean;
  metaTitle?: string;
  showDefaultRightActions?: boolean;
};

export function TabletShell({
  title,
  children,
  rightActions,
  leftHref = '/tablet/profile',
  hideNav = false,
  className,
  contentClassName,
  containerClassName,
  disableContainer = false,
  metaTitle,
  showDefaultRightActions = false
}: TabletShellProps) {
  const router = useRouter();

  const headerH = 64;
  const navH = hideNav ? 0 : 64;

  return (
    <div className={clsx('min-h-mobile bg-slate-50 text-slate-900', className)}>
      <Head>
        <title>{metaTitle || `${title} • Servio`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="manifest" href="/manifest-tablet.webmanifest" />
      </Head>

      {/* Header */}
      <header className="tablet-header fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 safe-area-inset-top">
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-16 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push(leftHref)}
              className="tablet-pressable flex items-center gap-3 rounded-2xl px-2 py-2"
              aria-label="Open profile"
            >
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden ring-1 ring-slate-200">
                <img src="/images/servio_icon_tight.png" alt="Servio" className="h-8 w-8" />
              </div>
              <div className="text-left leading-tight">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Servio</div>
                <div className="text-lg font-semibold text-slate-900">{title}</div>
              </div>
            </button>

            <div className="flex items-center gap-2">
              {rightActions}
              {showDefaultRightActions && !rightActions ? (
                <>
                  <button type="button" className="btn-icon" aria-label="Search">
                    <Search className="h-5 w-5" />
                  </button>
                  <button type="button" className="btn-icon" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main
        className={clsx('mobile-scrolling', contentClassName)}
        style={{
          paddingTop: `calc(${headerH}px + env(safe-area-inset-top))`,
          paddingBottom: `calc(${navH}px + env(safe-area-inset-bottom))`
        }}
      >
        {disableContainer ? (
          children
        ) : (
          <div className={clsx('mx-auto max-w-6xl px-4 py-5', containerClassName)}>{children}</div>
        )}
      </main>

      {hideNav ? null : <TabletBottomNav />}
    </div>
  );
}

