import Head from 'next/head';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Bluetooth, CheckCircle2, Printer, Settings2, XCircle, Loader2 } from 'lucide-react';

type PrintMode = 'bluetooth' | 'system' | 'bridge';
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
          
          {/* Saved Printer Info */}
          {savedPrinter && printMode === 'bluetooth' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    bluetoothStatus === 'connected' ? 'bg-green-100' : 
                    bluetoothStatus === 'connecting' ? 'bg-blue-100' : 'bg-slate-200'
                  }`}>
                    <Printer className={`h-5 w-5 ${
                      bluetoothStatus === 'connected' ? 'text-green-600' : 
                      bluetoothStatus === 'connecting' ? 'text-blue-600' : 'text-slate-500'
                    }`} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{savedPrinter.name}</div>
                    <div className="text-xs text-slate-500">ID: {savedPrinter.id.slice(0, 8)}...</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {bluetoothStatus === 'connected' && (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Connected
                    </span>
                  )}
                  {bluetoothStatus === 'connecting' && (
                    <span className="flex items-center gap-1 text-blue-600 text-sm font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </span>
                  )}
                  {bluetoothStatus === 'disconnected' && (
                    <span className="flex items-center gap-1 text-slate-500 text-sm font-medium">
                      Saved
                    </span>
                  )}
                  <button
                    onClick={handleDisconnect}
                    className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-red-600 transition-colors"
                    title="Remove printer"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Connection Error */}
          {connectionError && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              {connectionError}
            </div>
          )}

          {/* Connection Controls */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Connection</div>
              <div className="text-sm text-slate-500">
                {printMode === 'bluetooth' 
                  ? (savedPrinter 
                      ? `Using: ${savedPrinter.name}` 
                      : 'No printer paired')
                  : printMode === 'system' 
                    ? 'Uses system print dialog'
                    : 'Uses Print Bridge service'}
              </div>
            </div>
            {printMode === 'bluetooth' && (
              <button
                className={`px-4 py-2 rounded-xl font-black flex items-center gap-2 transition-colors ${
                  bluetoothStatus === 'connecting' 
                    ? 'bg-blue-400 text-white cursor-wait' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
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
