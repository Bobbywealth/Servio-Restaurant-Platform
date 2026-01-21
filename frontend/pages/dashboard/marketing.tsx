import Head from 'next/head';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  BadgeCheck,
  CalendarClock,
  LayoutGrid,
  Mail,
  MessageSquareText,
  PhoneCall,
  Plus,
  Rocket,
  ScrollText,
  Sparkles,
  Users
} from 'lucide-react';

type Channel = 'email' | 'sms' | 'voice';
type SendMode = 'now' | 'schedule';

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  opt_in_sms: boolean;
  opt_in_email: boolean;
  created_at?: string | null;
  tags?: string[] | null;
};

type MarketingAnalytics = {
  customers?: {
    total_customers?: number;
    sms_subscribers?: number;
    email_subscribers?: number;
  };
};

function formatCompact(n: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n);
}

function toLocalDateTimeValue(d: Date) {
  const pad = (v: number) => String(v).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
}

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('token') || window.localStorage.getItem('authToken');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

function Card(props: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx('rounded-2xl border border-slate-200 bg-white shadow-soft', props.className)}>
      {props.children}
    </div>
  );
}

function Pill(props: { icon?: ReactNode; children: ReactNode; tone?: 'blue' | 'slate' | 'amber' }) {
  const tone = props.tone || 'slate';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
        tone === 'blue' && 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
        tone === 'slate' && 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
        tone === 'amber' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
      )}
    >
      {props.icon}
      {props.children}
    </span>
  );
}

function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
}) {
  const variant = props.variant || 'secondary';
  return (
    <button
      type={props.type || 'button'}
      disabled={props.disabled}
      onClick={props.onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
        variant === 'secondary' && 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50',
        variant === 'ghost' && 'bg-transparent text-slate-700 hover:bg-slate-100',
        props.className
      )}
    >
      {props.children}
    </button>
  );
}

function Segmented(props: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; icon?: ReactNode; disabled?: boolean }[];
}) {
  return (
    <div className="inline-flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200">
      {props.items.map((it) => (
        <button
          key={it.value}
          type="button"
          disabled={it.disabled}
          onClick={() => props.onChange(it.value)}
          className={clsx(
            'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
            it.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/60',
            props.value === it.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel(props: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">{props.children}</div>
      {props.hint ? <div className="text-xs text-slate-500">{props.hint}</div> : null}
    </div>
  );
}

export default function MarketingPage() {
  const [topTab, setTopTab] = useState<'new' | 'history' | 'groups' | 'templates' | 'inbox' | 'automation'>('new');
  const [channel, setChannel] = useState<Channel>('email');
  const [sendMode, setSendMode] = useState<SendMode>('now');
  const [audience, setAudience] = useState<'all' | 'email' | 'sms' | 'vip' | 'new'>('all');
  const [scheduledAt, setScheduledAt] = useState<string>(toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sender, setSender] = useState('business@marketingteam.app');
  const [status, setStatus] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analytics, setAnalytics] = useState<MarketingAnalytics | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [a, c] = await Promise.all([
          apiGet<{ success: boolean; data: MarketingAnalytics }>('/marketing/analytics?timeframe=30d'),
          apiGet<{ success: boolean; data: Customer[] }>('/marketing/customers')
        ]);
        if (!mounted) return;
        setAnalytics(a.data || null);
        setCustomers(Array.isArray(c.data) ? c.data : []);
      } catch (e) {
        if (!mounted) return;
        // If auth isn’t set up in the browser yet, keep UI usable with graceful fallback.
        setAnalytics(null);
        setCustomers([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const reachableCounts = useMemo(() => {
    const total = customers.length;
    const emailReach = customers.filter((c) => Boolean(c.opt_in_email && c.email)).length;
    const smsReach = customers.filter((c) => Boolean(c.opt_in_sms && c.phone)).length;
    return { total, emailReach, smsReach };
  }, [customers]);

  const audienceLabel = useMemo(() => {
    switch (audience) {
      case 'all':
        return 'All Customers (Leads + Clients)';
      case 'email':
        return 'Email Subscribers';
      case 'sms':
        return 'SMS Subscribers';
      case 'vip':
        return 'VIP Customers';
      case 'new':
        return 'New Customers (30 days)';
    }
  }, [audience]);

  const effectiveReach = useMemo(() => {
    // Primary: use live customer reach if available.
    if (customers.length) {
      if (channel === 'email') return reachableCounts.emailReach;
      if (channel === 'sms') return reachableCounts.smsReach;
      return 0;
    }
    // Fallback: use analytics counts if available.
    const a = analytics?.customers;
    if (a) {
      if (channel === 'email') return Number(a.email_subscribers || 0);
      if (channel === 'sms') return Number(a.sms_subscribers || 0);
    }
    return 0;
  }, [analytics, channel, customers.length, reachableCounts]);

  const scheduleText = useMemo(() => {
    if (sendMode === 'now') return 'Now (Instant)';
    try {
      const d = new Date(scheduledAt);
      return d.toLocaleString();
    } catch {
      return 'Scheduled';
    }
  }, [sendMode, scheduledAt]);

  const isEmail = channel === 'email';
  const isSms = channel === 'sms';

  useEffect(() => {
    // Keep sender contextually sensible.
    if (isSms) setSender(process.env.NEXT_PUBLIC_TWILIO_FROM || '+1 (555) 010-0200');
    if (isEmail) setSender(process.env.NEXT_PUBLIC_EMAIL_FROM || 'business@marketingteam.app');
  }, [isEmail, isSms]);

  const finalCheckText = useMemo(() => {
    const n = effectiveReach;
    if (channel === 'voice') return 'AI Voice campaigns are coming soon.';
    if (sendMode === 'now') return `You are about to send a mass ${channel === 'email' ? 'email' : 'SMS'} to ${n} people. This action cannot be reversed once started.`;
    return `This campaign will be queued to send on your schedule to ${n} people.`;
  }, [channel, effectiveReach, sendMode]);

  const canLaunch = useMemo(() => {
    if (channel === 'voice') return false;
    if (!message.trim()) return false;
    if (isEmail && !subject.trim()) return false;
    if (sendMode === 'schedule' && !scheduledAt) return false;
    return true;
  }, [channel, isEmail, message, scheduledAt, sendMode, subject]);

  async function onGenerate() {
    const base = isEmail ? 'Exciting updates from Servio' : 'Quick update from Servio';
    if (isEmail && !subject.trim()) setSubject(base);

    const snippet =
      channel === 'email'
        ? `<p>Hey there — quick note from your favorite spot.</p>
<p><strong>Today only:</strong> enjoy a limited-time special and skip the line with online ordering.</p>
<p>See you soon,<br/>Team Servio</p>`
        : `Today only: limited-time special at Servio. Order online and skip the line. Reply STOP to opt out.`;

    if (!message.trim()) setMessage(snippet);
    setStatus({ tone: 'ok', text: 'Draft generated. Tweak it to match your vibe.' });
  }

  function applyQuickTemplate(template: 'welcome') {
    if (template === 'welcome') {
      setSubject('Welcome to Servio — here’s a little something');
      setMessage(
        `<p>Welcome! We’re glad you’re here.</p>
<p>As a thank-you, enjoy <strong>10% off</strong> your next order this week.</p>
<p>Use code: <strong>WELCOME10</strong></p>`
      );
      setStatus({ tone: 'ok', text: 'Template applied.' });
    }
  }

  async function launchCampaign() {
    setStatus(null);
    setLoading(true);
    try {
      const now = new Date();
      const scheduleAtIso =
        sendMode === 'schedule'
          ? new Date(scheduledAt).toISOString()
          : now.toISOString();

      const tags =
        audience === 'vip' ? ['vip'] : audience === 'new' ? ['new'] : [];

      const nameBase =
        (isEmail ? subject : message).trim().slice(0, 48) || 'Campaign';

      const payload = {
        name: nameBase,
        type: channel === 'sms' ? 'sms' : 'email',
        message,
        subject: isEmail ? subject : undefined,
        targetCriteria: tags.length ? { tags } : {},
        scheduleAt: scheduleAtIso
      };

      await apiPost('/marketing/campaigns', payload);

      setStatus({ tone: 'ok', text: 'Campaign launched (or scheduled) successfully.' });
      setTopTab('history');
    } catch (e: any) {
      setStatus({
        tone: 'err',
        text:
          e?.message ||
          'Failed to launch campaign. Check API base URL and authentication.'
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Marketing Center • Servio</title>
      </Head>

      <div className="min-h-screen">
        <div className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50 p-6 shadow-soft">
              <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
              <div className="relative flex items-start justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                      <Rocket className="h-5 w-5" />
                    </span>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Marketing Center</h1>
                  </div>
                  <p className="mt-2 max-w-2xl text-slate-600">
                    Broadcast mass communications to your audience — beautifully, safely, and fast.
                  </p>
                </div>

                <Card className="w-full max-w-xs">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Total Reach</div>
                      <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                        {formatCompact(effectiveReach)}
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center ring-1 ring-slate-200">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="relative mt-6 flex flex-wrap items-center gap-2">
                <NavPill
                  active={topTab === 'new'}
                  onClick={() => setTopTab('new')}
                  icon={<Plus className="h-4 w-4" />}
                  label="New Campaign"
                />
                <NavPill
                  active={topTab === 'history'}
                  onClick={() => setTopTab('history')}
                  icon={<ScrollText className="h-4 w-4" />}
                  label="History & Status"
                />
                <NavPill
                  active={topTab === 'groups'}
                  onClick={() => setTopTab('groups')}
                  icon={<Users className="h-4 w-4" />}
                  label="Groups"
                />
                <NavPill
                  active={topTab === 'templates'}
                  onClick={() => setTopTab('templates')}
                  icon={<LayoutGrid className="h-4 w-4" />}
                  label="Templates"
                />
                <NavPill
                  active={topTab === 'inbox'}
                  onClick={() => setTopTab('inbox')}
                  icon={<MessageSquareText className="h-4 w-4" />}
                  label="SMS Inbox"
                />
                <NavPill
                  active={topTab === 'automation'}
                  onClick={() => setTopTab('automation')}
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Automated Series"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8">
          {topTab !== 'new' ? (
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Coming soon</div>
                  <div className="mt-1 text-sm text-slate-600">
                    This section is wired into the navigation, but the full feature UI can be built next.
                  </div>
                </div>
                <Pill tone="blue" icon={<BadgeCheck className="h-4 w-4" />}>
                  Wired up
                </Pill>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <Card className="lg:col-span-8">
                <div className="border-b border-slate-200 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        <BadgeCheck className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-lg font-semibold text-slate-900">Campaign Details</div>
                        <div className="text-sm text-slate-600">Choose a channel, audience, and message.</div>
                      </div>
                    </div>

                    <Segmented
                      value={channel}
                      onChange={(v) => setChannel(v as Channel)}
                      items={[
                        { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
                        { value: 'sms', label: 'SMS', icon: <MessageSquareText className="h-4 w-4" /> },
                        // WhatsApp/Telegram intentionally removed per requirements.
                        { value: 'voice', label: 'AI Voice', icon: <PhoneCall className="h-4 w-4" />, disabled: true }
                      ]}
                    />
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <FieldLabel hint={`${formatCompact(effectiveReach)} reachable`}>
                        Select Audience
                      </FieldLabel>
                      <select
                        value={audience}
                        onChange={(e) => setAudience(e.target.value as any)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Customers (Leads + Clients)</option>
                        <option value="email">Email Subscribers</option>
                        <option value="sms">SMS Subscribers</option>
                        <option value="vip">VIP Customers</option>
                        <option value="new">New Customers (30 days)</option>
                      </select>
                      <div className="mt-2 text-xs text-slate-500">
                        Audience filters can be expanded; current send honors opt-in for the selected channel.
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Sender Account</FieldLabel>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                        {sender}
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Send Mode</FieldLabel>
                      <select
                        value={sendMode}
                        onChange={(e) => setSendMode(e.target.value as SendMode)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="now">Send Now</option>
                        <option value="schedule">Schedule</option>
                      </select>
                    </div>

                    <div>
                      <FieldLabel>Scheduled For</FieldLabel>
                      <input
                        type="datetime-local"
                        disabled={sendMode !== 'schedule'}
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className={clsx(
                          'mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                          sendMode !== 'schedule'
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'border-slate-200 bg-white text-slate-900'
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <FieldLabel>Quick Templates</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => applyQuickTemplate('welcome')} variant="secondary" className="px-3 py-2 text-xs rounded-lg">
                          WELCOME EMAIL
                        </Button>
                      </div>
                    </div>
                    <Button onClick={onGenerate} variant="secondary">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      Generate with AI
                    </Button>
                  </div>

                  {isEmail ? (
                    <div className="mt-6">
                      <FieldLabel>Email Subject</FieldLabel>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Exciting updates from Servio…"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <FieldLabel hint={isSms ? 'Keep it short. Links are ok.' : 'HTML supported.'}>
                      Message Content
                    </FieldLabel>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={isEmail ? 'Write your premium marketing email here (HTML supported)…' : 'Write your SMS message…'}
                      rows={10}
                      className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {status ? (
                    <div
                      className={clsx(
                        'mt-5 rounded-xl border px-4 py-3 text-sm',
                        status.tone === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
                        status.tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-900',
                        status.tone === 'err' && 'border-rose-200 bg-rose-50 text-rose-900'
                      )}
                    >
                      {status.text}
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card className="lg:col-span-4 h-fit lg:sticky lg:top-6">
                <div className="border-b border-slate-200 p-5">
                  <div className="text-lg font-semibold text-slate-900">Campaign Summary</div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">Channel</div>
                    <Pill tone="blue">
                      {channel === 'email' ? 'EMAIL' : channel === 'sms' ? 'SMS' : 'AI VOICE'}
                    </Pill>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">
                      Recipients
                      <div className="text-[11px] font-medium text-slate-500">People reachable</div>
                    </div>
                    <div className="text-xl font-semibold tracking-tight text-slate-900">{effectiveReach}</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">Schedule</div>
                    <div className="text-sm font-semibold text-slate-900">{scheduleText}</div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-[11px] font-extrabold tracking-widest text-amber-700 uppercase">Final Check</div>
                        <div className="mt-1 text-sm text-amber-900">{finalCheckText}</div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    disabled={!canLaunch || loading}
                    onClick={launchCampaign}
                    className="w-full py-3 rounded-2xl text-base"
                  >
                    <Rocket className="h-5 w-5" />
                    {loading ? 'Launching…' : 'Launch Campaign'}
                  </Button>

                  <div className="text-xs text-slate-500">
                    Audience selected: <span className="font-semibold text-slate-700">{audienceLabel}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function NavPill(props: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ring-1',
        props.active
          ? 'bg-white text-slate-900 ring-slate-200 shadow-sm'
          : 'bg-white/60 text-slate-700 ring-slate-200 hover:bg-white'
      )}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

