import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Head>
        <title>Servio Dashboard</title>
      </Head>
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-soft border border-slate-200 p-6">
          <div className="text-sm font-semibold text-slate-500">Servio</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Jump into the new Marketing Center.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/marketing"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Open Marketing Center
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

