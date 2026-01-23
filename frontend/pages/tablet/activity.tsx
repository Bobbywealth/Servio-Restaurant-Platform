import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { TabletShell } from '../../components/Layout/TabletShell';
import { useUser } from '../../contexts/UserContext';

export default function TabletActivityPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const next = router.asPath || '/tablet/activity';
      router.replace(`/tablet/login?next=${encodeURIComponent(next)}`);
    }
  }, [isLoading, user, router]);

  return (
    <TabletShell title="Activity">
      <div className="no-print space-y-4">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="text-2xl font-semibold text-slate-900">Activity</div>
          <div className="mt-1 text-slate-600">
            This screen is ready for a clean activity feed (order events, printer events, staff actions).
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-900">Go to Orders</div>
            <div className="text-sm text-slate-600">Back to the live order feed.</div>
          </div>
          <button className="btn-primary rounded-2xl px-5 py-3" onClick={() => router.push('/tablet/orders')}>
            Open
          </button>
        </div>
      </div>
    </TabletShell>
  );
}

