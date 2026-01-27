import Head from 'next/head';
import Link from 'next/link';
import AssistantPanel from '../../components/Assistant/AssistantPanel';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';
import { Smartphone, Mic } from 'lucide-react';

export default function TabletAssistantPage() {
  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>AI Assistant • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold">AI Assistant</h1>
              <p className="text-[var(--tablet-muted)] mt-2">
                Ask questions, run quick actions, or get help with orders and menu updates.
              </p>
            </div>

            {/* Mobile Voice Chat Link */}
            <Link
              href="/mobile/voice-chat"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-xl font-medium shadow-lg hover:shadow-violet-500/30 transition-all hover:scale-105"
            >
              <Smartphone className="w-4 h-4" />
              Mobile Voice Chat
            </Link>
          </div>
          <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-4 sm:p-6">
            <AssistantPanel showHeader={false} className="max-w-none" />
          </div>
        </main>
      </div>
    </div>
  );
}
