import Head from 'next/head';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';

export default function TabletHistoryPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans">
      <Head>
        <title>Recent Orders • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <div className="no-print flex min-h-screen">
        <TabletSidebar />
        <main className="flex-1 px-8 py-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold">Recent &amp; History</h1>
            <p className="text-[#6a6a6a] mt-2">
              Review completed orders, refunds, and timeline events from the tablet.
            </p>
            <div className="mt-6 bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <h2 className="text-lg font-semibold mb-3">Planned tablet actions</h2>
              <ul className="space-y-2 text-sm text-[#6a6a6a]">
                <li>• Search by customer, order number, or time window.</li>
                <li>• View order timeline with status changes and staff actions.</li>
                <li>• Reprint receipts or resend pickup notifications.</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
