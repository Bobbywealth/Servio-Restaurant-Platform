import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { PrintReceipt } from '../../../components/PrintReceipt';
import { api } from '../../../lib/api';
import type { ReceiptOrder, ReceiptPaperWidth, ReceiptRestaurant } from '../../../utils/receiptGenerator';
import { generateReceiptHtml } from '../../../utils/receiptGenerator';

export default function TabletPrintPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [restaurant, setRestaurant] = useState<ReceiptRestaurant | null>(null);
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>('80mm');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedPaper = window.localStorage.getItem('servio_thermal_paper_width');
    setPaperWidth(storedPaper === '58mm' ? '58mm' : '80mm');
  }, []);

  useEffect(() => {
    if (!orderId || typeof orderId !== 'string') return;
    const load = async () => {
      try {
        setLoading(true);
        if (orderId === 'test') {
          setOrder({
            id: 'test-order',
            status: 'received',
            customer_name: 'Test Guest',
            channel: 'tablet',
            created_at: new Date().toISOString(),
            items: [
              { name: 'Test Curry Chicken', quantity: 1, price: 12.99 },
              { name: 'Test Naan', quantity: 2, price: 2.5 }
            ],
            total_amount: 17.99
          });
          setRestaurant({ name: 'Servio Test Kitchen', phone: '(000) 000-0000' });
          return;
        }

        const [orderRes, restaurantRes] = await Promise.all([
          api.get(`/api/orders/${encodeURIComponent(orderId)}`),
          api.get('/api/restaurant/profile')
        ]);

        setOrder(orderRes.data?.data || null);
        setRestaurant(restaurantRes.data?.data || null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  const receiptHtml = useMemo(() => {
    if (!order) return '';
    return generateReceiptHtml({ restaurant, order, paperWidth });
  }, [order, restaurant, paperWidth]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <Head>
        <title>Print Receipt • Servio</title>
      </Head>

      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Print Receipt</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-black text-white rounded-xl font-black"
              disabled={loading || !order}
            >
              Print
            </button>
            <button
              onClick={() => router.push('/tablet/orders')}
              className="px-4 py-2 bg-slate-200 rounded-xl font-black"
            >
              Back
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-6 shadow">Loading...</div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow">
            <PrintReceipt receiptHtml={receiptHtml} copies={1} paperWidth={paperWidth} />
          </div>
        )}
      </div>
    </div>
  );
}
