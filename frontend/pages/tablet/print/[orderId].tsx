import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { PrintReceipt } from '../../../components/PrintReceipt';
import { api } from '../../../lib/api';
import { safeLocalStorage } from '../../../lib/utils';
import type { ReceiptOrder, ReceiptPaperWidth, ReceiptRestaurant } from '../../../utils/receiptGenerator';
import { generateReceiptHtml, generateStandaloneReceiptHtml } from '../../../utils/receiptGenerator';
import { printViaRawBT } from '../../../utils/escpos';

type PrintMode = 'bluetooth' | 'system' | 'bridge' | 'rawbt';

export default function TabletPrintPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [restaurant, setRestaurant] = useState<ReceiptRestaurant | null>(null);
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>('80mm');
  const [printMode, setPrintMode] = useState<PrintMode>('system');
  const [loading, setLoading] = useState(true);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [headerText, setHeaderText] = useState<string>('');
  const [footerText, setFooterText] = useState<string>('');
  const [fontSize, setFontSize] = useState<string>('medium');

  useEffect(() => {
    const storedPaper = safeLocalStorage.getItem('servio_thermal_paper_width');
    setPaperWidth(storedPaper === '58mm' ? '58mm' : '80mm');

    const storedMode = safeLocalStorage.getItem('servio_print_mode');
    if (storedMode === 'bluetooth' || storedMode === 'system' || storedMode === 'bridge' || storedMode === 'rawbt') {
      setPrintMode(storedMode);
    }

    const storedFontSize = safeLocalStorage.getItem('servio_font_size');
    if (storedFontSize === 'small' || storedFontSize === 'medium' || storedFontSize === 'large' || storedFontSize === 'xlarge') {
      setFontSize(storedFontSize);
    }
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

        // Load printer settings for header/footer text
        const settings = restaurantRes.data?.data?.settings || {};
        setHeaderText(settings.printer_receipt_header_text || '');
        setFooterText(settings.printer_receipt_footer_text || '');
        setFontSize(settings.printer_font_size || 'medium');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  const receiptHtml = useMemo(() => {
    if (!order) return '';
    return generateReceiptHtml({ restaurant, order, paperWidth, headerText, footerText, fontSize });
  }, [order, restaurant, paperWidth, headerText, footerText, fontSize]);

  const handlePrint = () => {
    if (!order) return;

    if (printMode === 'rawbt') {
      // RawBT auto-print mode - send full HTML receipt so logo and styling are preserved
      const standaloneHtml = generateStandaloneReceiptHtml({
        restaurant, order, paperWidth, headerText, footerText, fontSize
      });
      const success = printViaRawBT(standaloneHtml);
      
      if (success) {
        setPrintStatus('Sent to RawBT!');
        safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
      } else {
        setPrintStatus('RawBT not available. Is the app installed?');
        safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'error', message: 'RawBT not available' }));
      }
      
      setTimeout(() => setPrintStatus(null), 3000);
      return;
    }

    // System print mode
    window.print();
    safeLocalStorage.setItem('servio_last_print_result', JSON.stringify({ status: 'success' }));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <Head>
        <title>Print Receipt • Servio</title>
      </Head>

      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Print Receipt</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Mode: {printMode === 'rawbt' ? 'RawBT Auto' : 'System Dialog'}
            </span>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-black text-white rounded-xl font-black"
              disabled={loading || !order}
            >
              {printMode === 'rawbt' ? 'Print (Auto)' : 'Print'}
            </button>
            <button
              onClick={() => router.push('/tablet/orders')}
              className="px-4 py-2 bg-slate-200 rounded-xl font-black"
            >
              Back
            </button>
          </div>
        </div>

        {printStatus && (
          <div className={`p-3 rounded-xl text-center font-bold ${
            printStatus.includes('Sent') ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {printStatus}
          </div>
        )}

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
