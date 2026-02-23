import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function ApiDocsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the backend API docs
    window.location.href = '/api/docs';
  }, []);

  return (
    <>
      <Head>
        <title>API Documentation - Servio Restaurant Platform</title>
        <meta name="description" content="Servio API Documentation" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to API Documentation...</p>
        </div>
      </div>
    </>
  );
}
