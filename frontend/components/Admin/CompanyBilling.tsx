'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Download, Loader2, Link2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import AdminRowActions from './AdminRowActions';
import StatusChip from './StatusChip';

interface Subscription {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  package_name: string;
  status: string;
  billing_cycle: string;
  amount: number;
  next_billing_date?: string | null;
}

type InvoiceStatus = 'pending' | 'requires_action' | 'paid' | 'failed' | 'voided';
type InvoiceAction = 'collect_payment' | 'send_payment_link' | 'mark_paid' | 'void';

interface BillingHistory {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  amount: number;
  status: InvoiceStatus;
  currency?: string;
  invoice_url?: string | null;
  payment_method_status?: string | null;
  last_payment_attempt_at?: string | null;
  last_payment_attempt_status?: string | null;
  last_payment_attempt_error?: string | null;
  eligible_actions?: InvoiceAction[];
  created_at: string;
}

interface CompanyBillingProps {
  onClose?: () => void;
}

const idempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function CompanyBilling({ onClose }: CompanyBillingProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [history, setHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [invoiceActionInFlight, setInvoiceActionInFlight] = useState<Record<string, InvoiceAction | null>>({});
  const [error, setError] = useState<string | null>(null);

  const loadBilling = async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await api.get('/api/admin/billing/overview');
      setSubscriptions(response.data.subscriptions || []);
      setHistory(response.data.history || []);
    } catch (loadError) {
      console.error('Failed to load billing overview', loadError);
      setError('Unable to load billing data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling().catch(() => setLoading(false));
  }, []);

  const updateSubscription = async (id: string, patch: Partial<Subscription>) => {
    setUpdatingId(id);
    try {
      setError(null);
      await api.patch(`/api/admin/billing/subscriptions/${id}`, patch);
      await loadBilling();
    } catch (updateError) {
      console.error('Failed to update subscription', updateError);
      setError('Subscription update failed.');
    } finally {
      setUpdatingId(null);
    }
  };

  const runInvoiceAction = async (id: string, action: InvoiceAction) => {
    setInvoiceActionInFlight((prev) => ({ ...prev, [id]: action }));
    try {
      setError(null);
      const response = await api.post(
        `/api/admin/billing/invoices/${id}/actions`,
        { action },
        { headers: { 'x-idempotency-key': idempotencyKey() } }
      );

      const redirectUrl = response.data?.redirect_url as string | undefined;
      if (redirectUrl && (action === 'collect_payment' || action === 'send_payment_link')) {
        window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      }

      await loadBilling();
    } catch (invoiceError) {
      console.error('Invoice action failed', invoiceError);
      setError('Invoice action failed. Please retry.');
    } finally {
      setInvoiceActionInFlight((prev) => ({ ...prev, [id]: null }));
    }
  };

  const activeSubscriptions = subscriptions.filter((sub) => sub.status === 'active').length;
  const pastDueSubscriptions = subscriptions.filter((sub) => sub.status === 'past_due').length;
  const monthlyRecurringRevenue = subscriptions
    .filter((sub) => sub.status === 'active')
    .reduce((sum, sub) => sum + Number(sub.amount || 0), 0);

  const subscriptionStatusClass = (status: string) => {
    if (status === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300';
    if (status === 'trialing') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
    if (status === 'past_due') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Billing & Subscription</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage billing package, cycle, and invoice lifecycle.</p>
        </div>
        {onClose && <button className="btn-secondary" onClick={onClose}>Close</button>}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
          <div className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Active subscriptions</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{activeSubscriptions}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Past due subscriptions</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{pastDueSubscriptions}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">MRR (active)</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">${monthlyRecurringRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
          <ShieldCheck className="h-4 w-4 text-green-600" /> Payment operations readiness
        </div>
        <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 dark:text-gray-300 space-y-1">
          <li>Per-invoice actions now support collect payment, send payment link, mark paid, and void.</li>
          <li>Invoice status transitions are enforced and audited in backend state machine rules.</li>
          <li>Payment method status and latest payment attempt are visible for each invoice.</li>
        </ul>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 text-gray-500 flex items-center"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading billing data...</div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="space-y-3 p-4 md:hidden">
              {subscriptions.map((sub) => (
                <article key={sub.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{sub.restaurant_name}</h4>
                      <p className="text-xs text-gray-500">ID: {sub.restaurant_id}</p>
                    </div>
                    <StatusChip label={sub.status} toneClassName={subscriptionStatusClass(sub.status)} />
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <p>Package: <span className="font-medium">{sub.package_name}</span></p>
                    <p>Cycle: <span className="font-medium">{sub.billing_cycle}</span></p>
                    <p>Amount: <span className="font-medium">${Number(sub.amount || 0).toFixed(2)}</span></p>
                  </div>
                  <AdminRowActions className="justify-start">
                    <select disabled={updatingId === sub.id} value={sub.package_name} onChange={(e) => updateSubscription(sub.id, { package_name: e.target.value })} className="input-field py-1">
                      <option value="starter">starter</option>
                      <option value="operations">operations</option>
                      <option value="voice">voice</option>
                    </select>
                    <select disabled={updatingId === sub.id} value={sub.status} onChange={(e) => updateSubscription(sub.id, { status: e.target.value })} className="input-field py-1">
                      <option value="active">active</option>
                      <option value="trialing">trialing</option>
                      <option value="past_due">past_due</option>
                      <option value="canceled">canceled</option>
                    </select>
                    <button disabled={updatingId === sub.id} className="btn-secondary" onClick={() => updateSubscription(sub.id, { billing_cycle: sub.billing_cycle === 'monthly' ? 'yearly' : 'monthly' })}>{sub.billing_cycle}</button>
                  </AdminRowActions>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/20">
                <tr>
                  <th className="px-4 py-3 text-left">Restaurant</th>
                  <th className="px-4 py-3 text-left">Package</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Cycle</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">{sub.restaurant_name}</td>
                    <td className="px-4 py-3">
                      <select disabled={updatingId === sub.id} value={sub.package_name} onChange={(e) => updateSubscription(sub.id, { package_name: e.target.value })} className="input-field py-1">
                        <option value="starter">starter</option>
                        <option value="operations">operations</option>
                        <option value="voice">voice</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusChip label={sub.status} toneClassName={subscriptionStatusClass(sub.status)} />
                        <select disabled={updatingId === sub.id} value={sub.status} onChange={(e) => updateSubscription(sub.id, { status: e.target.value })} className="input-field py-1">
                          <option value="active">active</option>
                          <option value="trialing">trialing</option>
                          <option value="past_due">past_due</option>
                          <option value="canceled">canceled</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button disabled={updatingId === sub.id} className="btn-secondary" onClick={() => updateSubscription(sub.id, { billing_cycle: sub.billing_cycle === 'monthly' ? 'yearly' : 'monthly' })}>{sub.billing_cycle}</button>
                    </td>
                    <td className="px-4 py-3">${Number(sub.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Invoice History</h3>
            <div className="space-y-2">
              {history.map((row) => {
                const inFlightAction = invoiceActionInFlight[row.id];
                const allowed = new Set(row.eligible_actions || []);
                return (
                  <div key={row.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{row.restaurant_name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(row.created_at).toLocaleDateString()} • {row.currency || 'USD'} ${Number(row.amount).toFixed(2)} • {row.status}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Payment method: <span className="font-medium">{row.payment_method_status || 'unavailable'}</span></p>
                      <p className="text-xs text-gray-500">Last attempt: {row.last_payment_attempt_at ? `${new Date(row.last_payment_attempt_at).toLocaleString()} (${row.last_payment_attempt_status || 'unknown'})` : 'No attempts yet'}</p>
                      {row.last_payment_attempt_error && <p className="text-xs text-red-500">Error: {row.last_payment_attempt_error}</p>}
                    </div>
                    <AdminRowActions>
                      {row.invoice_url && <a href={row.invoice_url} target="_blank" rel="noreferrer" className="btn-secondary"><Download className="w-4 h-4" /></a>}
                      <button disabled={!allowed.has('collect_payment') || Boolean(inFlightAction)} className="btn-secondary" onClick={() => runInvoiceAction(row.id, 'collect_payment')}>
                        {inFlightAction === 'collect_payment' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Collect payment'}
                      </button>
                      <button disabled={!allowed.has('send_payment_link') || Boolean(inFlightAction)} className="btn-secondary inline-flex items-center gap-1" onClick={() => runInvoiceAction(row.id, 'send_payment_link')}>
                        {inFlightAction === 'send_payment_link' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4" />Send link</>}
                      </button>
                      <button disabled={!allowed.has('mark_paid') || Boolean(inFlightAction)} className="btn-secondary" onClick={() => runInvoiceAction(row.id, 'mark_paid')}>
                        Mark paid
                      </button>
                      <button disabled={!allowed.has('void') || Boolean(inFlightAction)} className="btn-secondary" onClick={() => runInvoiceAction(row.id, 'void')}>
                        Void
                      </button>
                    </AdminRowActions>
                  </div>
                );
              })}
              {history.length === 0 && <p className="text-sm text-gray-500">No invoice history found.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CompanyBilling;
