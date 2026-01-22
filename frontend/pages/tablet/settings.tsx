import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Printer, Volume2, VolumeX, Copy, Ruler, Power } from 'lucide-react';

type PaperWidth = '58mm' | '80mm';

function getBool(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

function getString<T extends string>(key: string, allowed: T[], fallback: T) {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key) as T | null;
  if (!v) return fallback;
  return (allowed as string[]).includes(v) ? (v as T) : fallback;
}

function getNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function setLS(key: string, value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export default function TabletSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm');
  const [printCopies, setPrintCopies] = useState<number>(2);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setMounted(true);

    // Defaults: match existing behavior on orders page
    const envAuto = (process.env.NEXT_PUBLIC_AUTO_PRINT_ENABLED || '').toLowerCase();
    const defaultAuto = envAuto === '' ? true : envAuto === 'true' || envAuto === '1' || envAuto === 'yes';
    const envPaper = (process.env.NEXT_PUBLIC_THERMAL_PAPER_WIDTH || '').toLowerCase();
    const defaultPaper: PaperWidth = envPaper === '58mm' ? '58mm' : '80mm';

    setAutoPrintEnabled(getBool('servio_auto_print_enabled', defaultAuto));
    setPaperWidth(getString<PaperWidth>('servio_thermal_paper_width', ['58mm', '80mm'], defaultPaper));
    setPrintCopies(getNumber('servio_print_copies', 2));
    setSoundEnabled(getBool('servio_kds_sound_enabled', true));
  }, []);

  const canRender = mounted;

  const copyOptions = useMemo(() => [1, 2, 3] as const, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <Head>
        <title>Tablet Settings • Servio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div className="sticky top-0 z-20 bg-black text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors"
            onClick={() => (window.location.href = '/tablet/orders')}
            title="Back to orders"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-white/60">Servio Tablet</div>
            <div className="text-2xl font-black tracking-tight">Settings</div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="rounded-3xl border-4 border-black p-6">
          <div className="flex items-center gap-3">
            <Printer className="h-7 w-7" />
            <div className="text-2xl font-black">Printing</div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <SettingRow
              icon={<Power className="h-5 w-5" />}
              title="Auto Print"
              description="Automatically print new incoming orders"
              right={
                <ToggleButton
                  value={canRender ? autoPrintEnabled : true}
                  onToggle={() => {
                    const next = !autoPrintEnabled;
                    setAutoPrintEnabled(next);
                    setLS('servio_auto_print_enabled', String(next));
                  }}
                />
              }
            />

            <SettingRow
              icon={<Ruler className="h-5 w-5" />}
              title="Paper Width"
              description="Thermal printer paper size"
              right={
                <Segmented
                  options={[
                    { id: '58mm', label: '58mm' },
                    { id: '80mm', label: '80mm' }
                  ]}
                  value={paperWidth}
                  onChange={(v) => {
                    setPaperWidth(v as PaperWidth);
                    setLS('servio_thermal_paper_width', v);
                  }}
                />
              }
            />

            <SettingRow
              icon={<Copy className="h-5 w-5" />}
              title="Copies"
              description="How many tickets to print per order"
              right={
                <div className="flex gap-2">
                  {copyOptions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={clsx(
                        'min-w-20 rounded-2xl px-5 py-3 text-lg font-black border-2 transition-colors',
                        printCopies === n ? 'bg-black text-white border-black' : 'bg-white text-black border-slate-300 hover:bg-slate-50'
                      )}
                      onClick={() => {
                        setPrintCopies(n);
                        setLS('servio_print_copies', String(n));
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
        </div>

        <div className="rounded-3xl border-4 border-black p-6">
          <div className="flex items-center gap-3">
            {soundEnabled ? <Volume2 className="h-7 w-7" /> : <VolumeX className="h-7 w-7" />}
            <div className="text-2xl font-black">Sound</div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <SettingRow
              icon={soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              title="New Order Beep"
              description="Play a short beep when a new order arrives"
              right={
                <ToggleButton
                  value={canRender ? soundEnabled : true}
                  onToggle={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    setLS('servio_kds_sound_enabled', String(next));
                  }}
                />
              }
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          These settings are saved on this device (tablet) and will persist after closing the app.
        </div>
      </div>
    </div>
  );
}

function SettingRow(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="min-w-0 flex items-start gap-3">
        <div className="mt-1 text-slate-800">{props.icon}</div>
        <div className="min-w-0">
          <div className="text-lg font-black text-slate-900">{props.title}</div>
          <div className="text-sm font-semibold text-slate-600">{props.description}</div>
        </div>
      </div>
      <div className="flex-shrink-0">{props.right}</div>
    </div>
  );
}

function ToggleButton(props: { value: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className={clsx(
        'rounded-2xl px-5 py-3 text-lg font-black border-2 transition-colors min-w-44',
        props.value ? 'bg-servio-green-600 text-white border-servio-green-700 hover:bg-servio-green-700' : 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200'
      )}
    >
      {props.value ? 'ON' : 'OFF'}
    </button>
  );
}

function Segmented(props: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex rounded-2xl border-2 border-slate-300 bg-slate-100 p-1">
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => props.onChange(o.id)}
          className={clsx(
            'rounded-xl px-5 py-3 text-lg font-black transition-colors',
            props.value === o.id ? 'bg-black text-white' : 'text-slate-900 hover:bg-slate-200'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

