import Head from 'next/head';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';

export default function TabletAssistantPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans">
      <Head>
        <title>AI Assistant • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>
      <div className="no-print flex min-h-screen">
        <TabletSidebar />
        <main className="flex-1 px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold">AI Assistant</h1>
              <p className="text-[#6a6a6a] mt-2">
                Ask questions, run quick actions, or get help with orders and menu updates.
              </p>
            </div>
          </div>
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden">
            <iframe
              title="Servio AI Assistant"
              src="/dashboard/assistant"
              className="w-full h-[70vh] border-0"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
