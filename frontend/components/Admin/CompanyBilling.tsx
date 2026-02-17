'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

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

interface BillingHistory {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  amount: number;
  status: string;
  invoice_url?: string | null;
  created_at: string;
}

interface CompanyBillingProps {
  onClose?: () => void;
}

export function CompanyBilling({ onClose }: CompanyBillingProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [history, setHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/billing/overview');
      setSubscriptions(response.data.subscriptions || []);
      setHistory(response.data.history || []);
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
      await api.patch(`/api/admin/billing/subscriptions/${id}`, patch);
      await loadBilling();
    } finally {
      setUpdatingId(null);
    }
  };

  const markInvoiceAction = async (id: string, action: 'retry' | 'void') => {
    await api.post(`/api/admin/billing/invoices/${id}/actions`, { action });
    await loadBilling();
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

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 text-gray-500 flex items-center"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading billing data...</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
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
                      <select disabled={updatingId === sub.id} value={sub.status} onChange={(e) => updateSubscription(sub.id, { status: e.target.value })} className="input-field py-1">
                        <option value="active">active</option>
                        <option value="trialing">trialing</option>
                        <option value="past_due">past_due</option>
                        <option value="canceled">canceled</option>
                      </select>
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

          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Invoice History</h3>
            <div className="space-y-2">
              {history.map((row) => (
                <div key={row.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{row.restaurant_name}</p>
                    <p className="text-xs text-gray-500">{new Date(row.created_at).toLocaleDateString()} • ${Number(row.amount).toFixed(2)} • {row.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.invoice_url && <a href={row.invoice_url} target="_blank" rel="noreferrer" className="btn-secondary"><Download className="w-4 h-4" /></a>}
                    <button className="btn-secondary" onClick={() => markInvoiceAction(row.id, 'retry')}>Retry</button>
                    <button className="btn-secondary" onClick={() => markInvoiceAction(row.id, 'void')}>Void</button>
                  </div>
                </div>
              ))}
              {history.length === 0 && <p className="text-sm text-gray-500">No invoice history found.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CompanyBilling;
