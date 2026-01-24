import Head from 'next/head';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Bluetooth, CheckCircle2, Printer, XCircle, Loader2 } from 'lucide-react';
import { TabletSidebar } from '../../components/tablet/TabletSidebar';

type PrintMode = 'bluetooth' | 'system' | 'bridge' | 'rawbt';
type PrintResult = { status: 'success' | 'error'; message?: string } | null;
type BluetoothConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface SavedPrinter {
  name: string;
  id: string;
}

export default function TabletSettings() {
  const router = useRouter();
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('system');
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [lastPrintResult, setLastPrintResult] = useState<PrintResult>(null);
  const [bleSupported, setBleSupported] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothConnectionStatus>('disconnected');
  const [savedPrinter, setSavedPrinter] = useState<SavedPrinter | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Store the connected device reference
  const connectedDeviceRef = useRef<any>(null);
  const gattServerRef = useRef<any>(null);

  useEffect(() => {
    const storedAuto = window.localStorage.getItem('servio_auto_print_enabled');
    setAutoPrintEnabled(storedAuto === 'true');

    const storedMode = window.localStorage.getItem('servio_print_mode');
    if (storedMode === 'bluetooth' || storedMode === 'system' || storedMode === 'bridge' || storedMode === 'rawbt') {
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

    // Load saved printer info
    const storedPrinter = window.localStorage.getItem('servio_bluetooth_printer');
    if (storedPrinter) {
      try {
        setSavedPrinter(JSON.parse(storedPrinter));
      } catch {
        // ignore
      }
    }

    setBleSupported(Boolean((navigator as any).bluetooth));
  }, []);

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

  const handlePairBluetooth = async () => {
    if (!bleSupported) return;

    setBluetoothStatus('connecting');
    setConnectionError(null);

    try {
      // Request a Bluetooth device - this opens the browser's device picker
      const device = await (navigator as any).bluetooth.requestDevice({
        // For thermal printers, we typically look for Serial Port Profile
        // but acceptAllDevices is more flexible for different printer types
        acceptAllDevices: true,
        optionalServices: ['battery_service', '49535343-fe7d-4ae5-8fa9-9fafd205e455'] // Common printer service UUIDs
      });

      if (!device) {
        setBluetoothStatus('disconnected');
        return;
      }

      // Save the device info immediately so user can see what they selected
      const printerInfo: SavedPrinter = {
        name: device.name || 'Unknown Printer',
        id: device.id
      };
      setSavedPrinter(printerInfo);
      window.localStorage.setItem('servio_bluetooth_printer', JSON.stringify(printerInfo));

      // Store the device reference
      connectedDeviceRef.current = device;

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothStatus('disconnected');
        gattServerRef.current = null;
      });

      // Try to connect to GATT server
      try {
        const server = await device.gatt?.connect();
        if (server) {
          gattServerRef.current = server;
          setBluetoothStatus('connected');
        } else {
          // Device paired but GATT not available (common for Classic BT printers)
          setBluetoothStatus('connected');
          setConnectionError('Printer paired. Note: For ESC/POS printing, you may need to use System Print or Print Bridge mode.');
        }
      } catch (gattError: any) {
        // GATT connection failed - printer might be Classic Bluetooth, not BLE
        setBluetoothStatus('connected'); // Still mark as "connected" since device was selected
        setConnectionError(`Printer saved: "${printerInfo.name}". GATT connection not available - this printer may use Classic Bluetooth. Use System Print for best results.`);
      }
    } catch (err: any) {
      setBluetoothStatus('error');
      if (err.name === 'NotFoundError') {
        setConnectionError('No device selected. Please try again and select a printer.');
      } else if (err.name === 'SecurityError') {
        setConnectionError('Bluetooth access denied. Please allow Bluetooth permissions.');
      } else {
        setConnectionError(err.message || 'Failed to connect to printer');
      }
    }
  };

  const handleDisconnect = () => {
    if (gattServerRef.current?.connected) {
      gattServerRef.current.disconnect();
    }
    connectedDeviceRef.current = null;
    gattServerRef.current = null;
    setSavedPrinter(null);
    setBluetoothStatus('disconnected');
    setConnectionError(null);
    window.localStorage.removeItem('servio_bluetooth_printer');
  };

  return (
    <div className="tablet-theme min-h-screen bg-[var(--tablet-bg)] text-[var(--tablet-text)] font-sans">
      <Head>
        <title>Tablet Settings • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="no-print flex min-h-screen flex-col lg:flex-row">
        <TabletSidebar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Settings</h1>
                <p className="text-[var(--tablet-muted)] mt-2">Configure printing and device preferences.</p>
              </div>
              <button
                onClick={() => router.push('/tablet/orders')}
                className="rounded-full border border-[var(--tablet-border)] p-2 text-[var(--tablet-text)] hover:bg-[var(--tablet-surface)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>

            <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-6">
              <h2 className="text-lg font-black mb-4">Auto-Print</h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-bold">Auto-Print</div>
                  <div className="text-sm text-[var(--tablet-muted)]">Default OFF. Ask before printing.</div>
                </div>
                <button
                  onClick={() => saveAutoPrint(!autoPrintEnabled)}
                  className={`px-4 py-2 rounded-xl font-black uppercase tracking-widest ${
                    autoPrintEnabled
                      ? 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)]'
                      : 'bg-[var(--tablet-border)] text-[var(--tablet-text)]'
                  }`}
                >
                  {autoPrintEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </section>

            <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-6 space-y-4">
              <h2 className="text-lg font-black">Print Mode</h2>
              <div className="grid gap-3">
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:bg-[var(--tablet-bg)] cursor-pointer has-[:checked]:border-[var(--tablet-accent)] has-[:checked]:bg-[var(--tablet-accent)]/15">
                  <input type="radio" checked={printMode === 'rawbt'} onChange={() => savePrintMode('rawbt')} className="w-5 h-5" />
                  <div>
                    <span className="font-bold block">RawBT Auto-Print (Recommended)</span>
                    <span className="text-sm text-[var(--tablet-muted)]">Prints directly to Bluetooth printer - no dialogs!</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:bg-[var(--tablet-bg)] cursor-pointer has-[:checked]:border-[var(--tablet-accent)] has-[:checked]:bg-[var(--tablet-accent)]/15">
                  <input type="radio" checked={printMode === 'system'} onChange={() => savePrintMode('system')} className="w-5 h-5" />
                  <div>
                    <span className="font-bold block">System Print Dialog</span>
                    <span className="text-sm text-[var(--tablet-muted)]">Uses Android print dialog - requires selecting printer each time</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:bg-[var(--tablet-bg)] cursor-pointer has-[:checked]:border-[var(--tablet-accent)] has-[:checked]:bg-[var(--tablet-accent)]/15">
                  <input type="radio" checked={printMode === 'bluetooth'} onChange={() => savePrintMode('bluetooth')} className="w-5 h-5" />
                  <div>
                    <span className="font-bold block">WebBluetooth ESC/POS</span>
                    <span className="text-sm text-[var(--tablet-muted)]">For BLE printers only (most thermal printers won't work)</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:bg-[var(--tablet-bg)] cursor-pointer has-[:checked]:border-[var(--tablet-accent)] has-[:checked]:bg-[var(--tablet-accent)]/15">
                  <input type="radio" checked={printMode === 'bridge'} onChange={() => savePrintMode('bridge')} className="w-5 h-5" />
                  <div>
                    <span className="font-bold block">Print Bridge (LAN/USB)</span>
                    <span className="text-sm text-[var(--tablet-muted)]">For network or USB connected printers via bridge service</span>
                  </div>
                </label>
              </div>
              {printMode === 'rawbt' && (
                <div className="text-sm text-[var(--tablet-info)] bg-[var(--tablet-bg)] border border-[var(--tablet-border)] p-3 rounded-xl">
                  <strong>Requires RawBT app:</strong> Install "RawBT Printer" from the Play Store, then select your Bluetooth printer in RawBT's settings.
                  <a
                    href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-2 text-[var(--tablet-accent)] underline"
                  >
                    Download RawBT from Play Store →
                  </a>
                </div>
              )}
              {printMode === 'bluetooth' && bluetoothHelp ? (
                <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                  {bluetoothHelp}
                </div>
              ) : null}
            </section>

            <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-6 space-y-4">
              <h2 className="text-lg font-black">Paper Width</h2>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => savePaperWidth('80mm')}
                  className={`px-4 py-2 rounded-xl font-black ${
                    paperWidth === '80mm' ? 'bg-[var(--tablet-text)] text-[var(--tablet-bg)]' : 'bg-[var(--tablet-border)]'
                  }`}
                >
                  80mm
                </button>
                <button
                  onClick={() => savePaperWidth('58mm')}
                  className={`px-4 py-2 rounded-xl font-black ${
                    paperWidth === '58mm' ? 'bg-[var(--tablet-text)] text-[var(--tablet-bg)]' : 'bg-[var(--tablet-border)]'
                  }`}
                >
                  58mm
                </button>
              </div>
            </section>

            <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-6 space-y-4">
              <h2 className="text-lg font-black">Printer Status</h2>

              {savedPrinter && printMode === 'bluetooth' && (
                <div className="bg-[var(--tablet-bg)] border border-[var(--tablet-border)] rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        bluetoothStatus === 'connected'
                          ? 'bg-emerald-500/20'
                          : bluetoothStatus === 'connecting'
                            ? 'bg-[var(--tablet-accent)]/20'
                            : 'bg-[var(--tablet-border)]'
                      }`}>
                        <Printer className={`h-5 w-5 ${
                          bluetoothStatus === 'connected'
                            ? 'text-emerald-200'
                            : bluetoothStatus === 'connecting'
                              ? 'text-[var(--tablet-accent)]'
                              : 'text-[var(--tablet-muted)]'
                        }`} />
                      </div>
                      <div>
                        <div className="font-bold text-[var(--tablet-text)]">{savedPrinter.name}</div>
                        <div className="text-xs text-[var(--tablet-muted)]">ID: {savedPrinter.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {bluetoothStatus === 'connected' && (
                        <span className="flex items-center gap-1 text-emerald-200 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Connected
                        </span>
                      )}
                      {bluetoothStatus === 'connecting' && (
                        <span className="flex items-center gap-1 text-[var(--tablet-accent)] text-sm font-medium">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Connecting...
                        </span>
                      )}
                      {bluetoothStatus === 'disconnected' && (
                        <span className="flex items-center gap-1 text-[var(--tablet-muted)] text-sm font-medium">
                          Saved
                        </span>
                      )}
                      <button
                        onClick={handleDisconnect}
                        className="p-2 rounded-lg hover:bg-[var(--tablet-border)] text-[var(--tablet-muted)] hover:text-rose-200 transition-colors"
                        title="Remove printer"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {connectionError && (
                <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                  {connectionError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">Connection</div>
                  <div className="text-sm text-[var(--tablet-muted)]">
                    {printMode === 'bluetooth'
                      ? (savedPrinter
                          ? `Using: ${savedPrinter.name}`
                          : 'No printer paired')
                      : printMode === 'system'
                        ? 'Uses system print dialog'
                        : printMode === 'rawbt'
                          ? 'Auto-prints via RawBT app'
                          : 'Uses Print Bridge service'}
                  </div>
                </div>
                {printMode === 'bluetooth' && (
                  <button
                    className={`px-4 py-2 rounded-xl font-black flex items-center gap-2 transition-colors ${
                      bluetoothStatus === 'connecting'
                        ? 'bg-[var(--tablet-accent)]/70 text-[var(--tablet-accent-contrast)] cursor-wait'
                        : 'bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] hover:opacity-90'
                    }`}
                    onClick={handlePairBluetooth}
                    disabled={!bleSupported || bluetoothStatus === 'connecting'}
                  >
                    {bluetoothStatus === 'connecting' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bluetooth className="h-4 w-4" />
                    )}
                    {savedPrinter ? 'Change Printer' : 'Pair Printer'}
                  </button>
                )}
              </div>

              <div>
                <div className="font-bold">Last Print Result</div>
                {lastPrintResult ? (
                  <div className={`text-sm ${lastPrintResult.status === 'success' ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {lastPrintResult.status === 'success' ? 'Success' : lastPrintResult.message || 'Error'}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--tablet-muted)]">No prints yet</div>
                )}
              </div>
            </section>

            <section className="bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.3)] p-6 space-y-4">
              <h2 className="text-lg font-black">Test Print</h2>
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 rounded-xl bg-[var(--tablet-text)] text-[var(--tablet-bg)] font-black flex items-center gap-2"
                  onClick={() => router.push('/tablet/print/test')}
                >
                  <Printer className="h-4 w-4" />
                  Test Print
                </button>
                {printMode === 'bridge' && (
                  <div className="text-sm text-[var(--tablet-muted)]">Use Print Bridge service for reliable LAN/USB printing.</div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
