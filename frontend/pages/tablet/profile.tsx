import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { TabletShell } from '../../components/Layout/TabletShell';
import { useUser } from '../../contexts/UserContext';

export default function TabletProfilePage() {
  const router = useRouter();
  const { user, isLoading, logout } = useUser();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const next = router.asPath || '/tablet/profile';
      router.replace(`/tablet/login?next=${encodeURIComponent(next)}`);
    }
  }, [isLoading, user, router]);

  return (
    <TabletShell title="Profile">
      <div className="no-print space-y-4">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="text-2xl font-semibold text-slate-900">{user?.name || '—'}</div>
          <div className="mt-1 text-slate-600">{user?.email || '—'}</div>
          <div className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
            Role: {user?.role || '—'}
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 flex flex-col gap-3">
          <button className="btn-primary rounded-2xl py-4" onClick={() => router.push('/tablet/settings')}>
            Settings
          </button>
          <button
            className="btn-secondary rounded-2xl py-4"
            onClick={() => {
              logout();
              router.push('/tablet/login');
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </TabletShell>
  );
}

