import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, UserCheck, Wrench } from 'lucide-react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { getErrorMessage } from '../../lib/utils'

type Severity = 'critical' | 'high' | 'medium' | 'low'

interface ErrorEvent {
  id: string
  timestamp: string
  severity: Severity
  action: string
  message: string
  service: string
  restaurantId: string | null
  restaurantName: string | null
  context: {
    entityType?: string | null
    entityId?: string | null
    details?: Record<string, any>
    metadata?: Record<string, any>
  }
  triage: {
    acknowledgedAt: string | null
    owner: string | null
    resolvedAt: string | null
    note: string | null
    runbookLink: string | null
    updatedAt: string | null
  }
}

interface FilterOption {
  id: string
  name: string
}

export default function DiagnosticsPage() {
  const [events, setEvents] = useState<ErrorEvent[]>([])
  const [services, setServices] = useState<string[]>([])
  const [restaurants, setRestaurants] = useState<FilterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [service, setService] = useState('all')
  const [restaurantId, setRestaurantId] = useState('all')
  const [severity, setSeverity] = useState<'all' | Severity>('all')
  const [windowHours, setWindowHours] = useState('24')

  const fetchErrors = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/admin/errors/recent', {
        params: {
          service: service === 'all' ? undefined : service,
          restaurantId: restaurantId === 'all' ? undefined : restaurantId,
          severity: severity === 'all' ? undefined : severity,
          windowHours
        }
      })
      setEvents(response.data.errors || [])
      setServices(response.data.filters?.services || [])
      setRestaurants(response.data.filters?.restaurants || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load diagnostics'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, restaurantId, severity, windowHours])

  const applyTriage = async (
    eventId: string,
    action: 'acknowledge' | 'assign_owner' | 'resolve' | 'attach_note',
    payload?: { value?: string; runbookLink?: string }
  ) => {
    setBusyId(eventId)
    try {
      await api.post(`/api/admin/errors/${eventId}/triage`, {
        action,
        value: payload?.value,
        runbookLink: payload?.runbookLink
      })
      await fetchErrors()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to apply triage action'))
    } finally {
      setBusyId(null)
    }
  }

  const severityClass = useMemo(() => ({
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
  }), [])

  return (
    <AdminLayout title="Diagnostics" description="Incident triage and recent platform errors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diagnostics</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Triage incidents and isolate impacted restaurants quickly.</p>
          </div>
          <button onClick={fetchErrors} className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={service} onChange={(e) => setService(e.target.value)} className="input-field">
            <option value="all">All services</option>
            {services.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className="input-field">
            <option value="all">All restaurants</option>
            {restaurants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="input-field">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={windowHours} onChange={(e) => setWindowHours(e.target.value)} className="input-field">
            <option value="1">Last hour</option>
            <option value="6">Last 6 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="72">Last 3 days</option>
            <option value="168">Last 7 days</option>
          </select>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Loading diagnostics...</div>
        ) : events.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No matching incidents in this time window.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <IncidentCard
                key={event.id}
                event={event}
                busy={busyId === event.id}
                severityClass={severityClass}
                onAcknowledge={() => applyTriage(event.id, 'acknowledge')}
                onResolve={() => applyTriage(event.id, 'resolve')}
                onAssign={(owner) => applyTriage(event.id, 'assign_owner', { value: owner })}
                onNote={(note, link) => applyTriage(event.id, 'attach_note', { value: note, runbookLink: link })}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function IncidentCard({
  event,
  busy,
  severityClass,
  onAcknowledge,
  onResolve,
  onAssign,
  onNote
}: {
  event: ErrorEvent
  busy: boolean
  severityClass: Record<Severity, string>
  onAcknowledge: () => void
  onResolve: () => void
  onAssign: (owner: string) => void
  onNote: (note: string, runbookLink: string) => void
}) {
  const [owner, setOwner] = useState(event.triage.owner || '')
  const [note, setNote] = useState(event.triage.note || '')
  const [runbookLink, setRunbookLink] = useState(event.triage.runbookLink || '')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityClass[event.severity]}`}>{event.severity}</span>
        <span className="text-xs text-gray-500">{event.service}</span>
        <span className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
        {event.restaurantName && <span className="text-xs text-gray-500">{event.restaurantName}</span>}
      </div>

      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{event.message}</p>
          <p className="text-xs text-gray-500">{event.action}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="flex gap-2">
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" className="input-field" />
          <button disabled={busy || !owner.trim()} onClick={() => onAssign(owner.trim())} className="px-3 py-2 rounded-md border text-sm inline-flex items-center">
            <UserCheck className="h-4 w-4 mr-1" /> Assign
          </button>
        </div>
        <button disabled={busy || !!event.triage.acknowledgedAt} onClick={onAcknowledge} className="px-3 py-2 rounded-md border text-sm inline-flex items-center justify-center">
          <Wrench className="h-4 w-4 mr-1" /> {event.triage.acknowledgedAt ? 'Acknowledged' : 'Acknowledge'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note" className="input-field" />
        <input value={runbookLink} onChange={(e) => setRunbookLink(e.target.value)} placeholder="Runbook link" className="input-field" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button disabled={busy || (!note.trim() && !runbookLink.trim())} onClick={() => onNote(note.trim(), runbookLink.trim())} className="px-3 py-2 rounded-md border text-sm">Save note/runbook</button>
        <button disabled={busy || !!event.triage.resolvedAt} onClick={onResolve} className="px-3 py-2 rounded-md bg-green-600 text-white text-sm disabled:opacity-70">
          {event.triage.resolvedAt ? 'Resolved' : 'Mark resolved'}
        </button>
      </div>
    </div>
  )
}
