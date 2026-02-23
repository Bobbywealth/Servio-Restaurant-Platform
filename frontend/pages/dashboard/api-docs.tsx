import { useEffect } from 'react';
import Head from 'next/head';

export default function ApiDocsRedirect() {
  useEffect(() => {
    const backendBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3002';
    const normalizedBackendUrl = backendBaseUrl.replace(/\/$/, '');

    // Redirect directly to backend Swagger UI so this route never collides
    // with Next.js /pages/api routes.
    window.location.href = `${normalizedBackendUrl}/api/docs`;
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
