import Head from 'next/head';
import AssistantPanel from '../../components/Assistant/AssistantPanel';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';

export default function TabletAssistantPage() {
  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>AI Assistant • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
      </Head>
      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-semibold">Assistant</h1>
            <p className="text-sm text-[var(--tablet-muted)] mt-1">
              Tablet view is simplified for faster service.
            </p>
          </div>
          <div className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-4 sm:p-6">
            <AssistantPanel showHeader={false} className="max-w-none" defaultMinimized />
          </div>
        </main>
      </div>
    </div>
  );
}

