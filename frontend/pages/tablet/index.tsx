import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../contexts/UserContext';

export default function TabletIndexPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const ordersPath = '/tablet/orders';

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(ordersPath);
    } else {
      router.replace(`/tablet/login?next=${encodeURIComponent(ordersPath)}`);
    }
  }, [isLoading, user, router, ordersPath]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <p className="text-sm text-gray-300">Loading tablet view…</p>
    </div>
  );
}
