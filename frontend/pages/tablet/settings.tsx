import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Bluetooth, CheckCircle2, Printer, Settings2 } from 'lucide-react';
import { api } from '../../lib/api';

type PrintMode = 'bluetooth' | 'system' | 'bridge';
type PrintResult = { status: 'success' | 'error'; message?: string } | null;

export default function TabletSettings() {
  const router = useRouter();
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('system');
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [lastPrintResult, setLastPrintResult] = useState<PrintResult>(null);
  const [bleSupported, setBleSupported] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<'connected' | 'not_connected'>('not_connected');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [receivedCount, setReceivedCount] = useState(0);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const storedAuto = window.localStorage.getItem('servio_auto_print_enabled');
    setAutoPrintEnabled(storedAuto === 'true');

    const storedMode = window.localStorage.getItem('servio_print_mode');
    if (storedMode === 'bluetooth' || storedMode === 'system' || storedMode === 'bridge') {
      setPrintMode(storedMode);
    }

    const storedPaper = window.localStorage.getItem('servio_thermal_paper_width');
    setPaperWidth(storedPaper === '58mm' ? '58mm' : '80mm');

    const storedResult = window.localStorage.getItem('servio_last_print_result');
    if (storedResult) {
      try {
        setLastPrintResult(JSON.parse(storedResult));
      } catch {
        // ignore
      }
    }

    const storedSound = window.localStorage.getItem('servio_sound_enabled');
    setSoundEnabled(storedSound === null ? true : storedSound === 'true');

    setBleSupported(Boolean((navigator as any).bluetooth));
  }, []);

  useEffect(() => {
    const audio = new Audio('/sounds/new-order.mp3');
    audio.loop = true;
    audio.volume = 1;
    alertAudioRef.current = audio;
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        if (!window.localStorage.getItem('servio_access_token')) return;
        const resp = await api.get('/api/orders?limit=20&offset=0');
        const orders = resp.data?.data?.orders || [];
        const count = orders.filter((o: any) => (o?.status || '').toLowerCase() === 'received').length;
        setReceivedCount(count);
      } catch {
        // ignore
      }
    };
    poll();
    const t = window.setInterval(poll, 10000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const audio = alertAudioRef.current;
    if (!audio) return;
    if (receivedCount > 0 && soundEnabled) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [receivedCount, soundEnabled]);

  const bluetoothHelp = useMemo(() => {
    if (!bleSupported) {
      return 'This printer appears to be Classic Bluetooth. WebBluetooth requires BLE. Use System Print or Print Bridge.';
    }
    return null;
  }, [bleSupported]);

  const saveAutoPrint = (next: boolean) => {
    setAutoPrintEnabled(next);
    window.localStorage.setItem('servio_auto_print_enabled', String(next));
  };

  const savePrintMode = (next: PrintMode) => {
    setPrintMode(next);
    window.localStorage.setItem('servio_print_mode', next);
  };

  const savePaperWidth = (next: '80mm' | '58mm') => {
    setPaperWidth(next);
    window.localStorage.setItem('servio_thermal_paper_width', next);
  };

  const saveSoundEnabled = (next: boolean) => {
    setSoundEnabled(next);
    window.localStorage.setItem('servio_sound_enabled', String(next));
  };

  const handlePairBluetooth = async () => {
    if (!bleSupported) return;
    try {
      await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true
      });
      setBluetoothStatus('connected');
    } catch (err) {
      setBluetoothStatus('not_connected');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Head>
        <title>Tablet Settings • Servio</title>
      </Head>

      <div className="sticky top-0 z-10 bg-black text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/tablet/orders')}
            className="bg-white/10 hover:bg-white/20 rounded-full p-2"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="text-xl font-black uppercase tracking-widest">Settings</div>
        </div>
        <Settings2 className="h-6 w-6 text-white/70" />
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {receivedCount > 0 && (
          <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div className="font-black uppercase tracking-widest">
              New order received ({receivedCount})
            </div>
            <button
              className="bg-white text-blue-700 font-black px-4 py-2 rounded-xl"
              onClick={() => router.push('/tablet/orders')}
            >
              View Orders
            </button>
          </div>
        )}
        <section className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-black mb-4">Auto-Print</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Auto-Print</div>
              <div className="text-sm text-slate-500">Default OFF. Ask before printing.</div>
            </div>
            <button
              onClick={() => saveAutoPrint(!autoPrintEnabled)}
              className={`px-4 py-2 rounded-xl font-black uppercase tracking-widest ${
                autoPrintEnabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {autoPrintEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-black mb-4">Order Sound</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">New order alert</div>
              <div className="text-sm text-slate-500">Loops until accepted.</div>
            </div>
            <button
              onClick={() => saveSoundEnabled(!soundEnabled)}
              className={`px-4 py-2 rounded-xl font-black uppercase tracking-widest ${
                soundEnabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {soundEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <div className="mt-4">
            <button
              className="px-4 py-2 rounded-xl bg-black text-white font-black flex items-center gap-2"
              onClick={() => {
                const audio = new Audio('/sounds/new-order.mp3');
                audio.volume = 1;
                audio.play().catch(() => {});
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Test Sound
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-black">Print Mode</h2>
          <div className="grid gap-3">
            <label className="flex items-center gap-3">
              <input type="radio" checked={printMode === 'bluetooth'} onChange={() => savePrintMode('bluetooth')} />
              <span className="font-bold">Bluetooth ESC/POS (Rongta)</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" checked={printMode === 'system'} onChange={() => savePrintMode('system')} />
              <span className="font-bold">System Print dialog</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="radio" checked={printMode === 'bridge'} onChange={() => savePrintMode('bridge')} />
              <span className="font-bold">Print Bridge (LAN/USB)</span>
            </label>
          </div>
          {printMode === 'bluetooth' && bluetoothHelp ? (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              {bluetoothHelp}
            </div>
          ) : null}
        </section>

        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-black">Paper Width</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => savePaperWidth('80mm')}
              className={`px-4 py-2 rounded-xl font-black ${paperWidth === '80mm' ? 'bg-black text-white' : 'bg-slate-200'}`}
            >
              80mm
            </button>
            <button
              onClick={() => savePaperWidth('58mm')}
              className={`px-4 py-2 rounded-xl font-black ${paperWidth === '58mm' ? 'bg-black text-white' : 'bg-slate-200'}`}
            >
              58mm
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-black">Printer Status</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Connection</div>
              <div className="text-sm text-slate-500">
                {printMode === 'bluetooth' ? (bluetoothStatus === 'connected' ? 'Connected' : 'Not connected') : 'N/A'}
              </div>
            </div>
            {printMode === 'bluetooth' && (
              <button
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black flex items-center gap-2"
                onClick={handlePairBluetooth}
                disabled={!bleSupported}
              >
                <Bluetooth className="h-4 w-4" />
                Pair/Connect
              </button>
            )}
          </div>
          <div>
            <div className="font-bold">Last Print Result</div>
            {lastPrintResult ? (
              <div className={`text-sm ${lastPrintResult.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {lastPrintResult.status === 'success' ? 'Success' : lastPrintResult.message || 'Error'}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No prints yet</div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-black">Test Print</h2>
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded-xl bg-black text-white font-black flex items-center gap-2"
              onClick={() => router.push('/tablet/print/test')}
            >
              <Printer className="h-4 w-4" />
              Test Print
            </button>
            {printMode === 'bridge' && (
              <div className="text-sm text-slate-500">Use Print Bridge service for reliable LAN/USB printing.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
