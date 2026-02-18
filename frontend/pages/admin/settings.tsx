import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Save, RefreshCw, Settings as SettingsIcon, ShieldCheck, Bell } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'

type PlatformSettings = {
  maintenanceMode: boolean
  maintenanceMessage: string
  allowNewDemoBookings: boolean
  defaultOrderPageSize: number
  alertEmail: string
}

const DEFAULT_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  maintenanceMessage: 'Servio platform maintenance is in progress. Please check back shortly.',
  allowNewDemoBookings: true,
  defaultOrderPageSize: 50,
  alertEmail: 'ops@servio.solutions'
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = async () => {
    setIsLoading(true)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await api.get('/api/admin/settings')
      setSettings({ ...DEFAULT_SETTINGS, ...(response.data?.settings || {}) })
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load platform settings'))
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    setError(null)
    setStatusMessage(null)
    try {
      const payload = {
        ...settings,
        defaultOrderPageSize: Math.max(10, Math.min(200, Number(settings.defaultOrderPageSize) || 50))
      }
      const response = await api.put('/api/admin/settings', payload)
      setSettings({ ...DEFAULT_SETTINGS, ...(response.data?.settings || payload) })
      setStatusMessage('Settings saved successfully.')
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to save platform settings'))
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const isEmailValid = useMemo(() => /.+@.+\..+/.test(settings.alertEmail), [settings.alertEmail])

  return (
    <AdminLayout title="Platform Settings" description="Manage system-wide admin settings for Servio.">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        {error && <div className="rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 text-sm">{error}</div>}
        {statusMessage && <div className="rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-3 text-sm">{statusMessage}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/admin/system-health" label="System health" />
          <QuickLink href="/admin/orders" label="Orders management" />
          <QuickLink href="/admin/marketing" label="Marketing controls" />
          <QuickLink href="/admin/billing" label="Billing operations" />
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Core platform settings</h2>
            </div>
            <button
              onClick={loadSettings}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="p-6 space-y-6">
            <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Maintenance mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Temporarily pause platform actions for maintenance windows.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 mt-1" checked={settings.maintenanceMode} onChange={(e) => setSettings((prev) => ({ ...prev, maintenanceMode: e.target.checked }))} disabled={isLoading || isSaving} />
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Maintenance message</label>
              <textarea rows={3} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" value={settings.maintenanceMessage} onChange={(e) => setSettings((prev) => ({ ...prev, maintenanceMessage: e.target.value }))} disabled={isLoading || isSaving} maxLength={300} />
            </div>

            <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Allow new demo bookings</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Controls whether sales demo bookings can be created.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 mt-1" checked={settings.allowNewDemoBookings} onChange={(e) => setSettings((prev) => ({ ...prev, allowNewDemoBookings: e.target.checked }))} disabled={isLoading || isSaving} />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Default orders page size</label>
                <input type="number" min={10} max={200} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" value={settings.defaultOrderPageSize} onChange={(e) => setSettings((prev) => ({ ...prev, defaultOrderPageSize: Number(e.target.value) || 50 }))} disabled={isLoading || isSaving} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Alert email</label>
                <input type="email" className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" value={settings.alertEmail} onChange={(e) => setSettings((prev) => ({ ...prev, alertEmail: e.target.value }))} disabled={isLoading || isSaving} />
                {!isEmailValid && <p className="mt-1 text-xs text-red-600">Please provide a valid notification email.</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard icon={ShieldCheck} title="Security" description="Use alert email and maintenance mode together for controlled incident response." />
              <InfoCard icon={Bell} title="Operations" description="Order page size directly affects admin order review workloads and reporting." />
            </div>

            <div className="pt-2">
              <button onClick={saveSettings} disabled={isLoading || isSaving || !isEmailValid} className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
      {label}
    </Link>
  )
}

function InfoCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"><Icon className="h-4 w-4 text-red-600" />{title}</div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  )
}
