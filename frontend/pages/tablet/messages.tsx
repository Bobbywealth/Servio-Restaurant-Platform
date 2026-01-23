import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { TabletShell } from '../../components/Layout/TabletShell';
import { useUser } from '../../contexts/UserContext';

export default function TabletMessagesPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const next = router.asPath || '/tablet/messages';
      router.replace(`/tablet/login?next=${encodeURIComponent(next)}`);
    }
  }, [isLoading, user, router]);

  return (
    <TabletShell title="Messages">
      <div className="no-print space-y-4">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="text-2xl font-semibold text-slate-900">Messages</div>
          <div className="mt-1 text-slate-600">Placeholder for staff/customer messaging (SMS, internal notes, alerts).</div>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-semibold text-slate-700">Coming next</div>
          <ul className="mt-2 list-disc pl-5 text-slate-600 space-y-1">
            <li>Order-specific notes</li>
            <li>Notification history</li>
            <li>Quick reply templates</li>
          </ul>
        </div>
      </div>
    </TabletShell>
  );
}

