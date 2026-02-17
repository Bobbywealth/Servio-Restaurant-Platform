import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { CalendarDays, RefreshCw } from 'lucide-react'

type AdminBooking = {
  id: string
  name: string
  email: string
  phone?: string | null
  restaurant_name?: string | null
  booking_date: string
  booking_time: string
  timezone: string
  notes?: string | null
  internal_notes?: string | null
  owner_user_id?: string | null
  owner_name?: string | null
  follow_up_at?: string | null
  conversion_stage?: string | null
  status: string
  created_at: string
}

type BookingOwner = {
  id: string
  name: string
  email: string
  role: string
}

type BookingDraft = {
  owner_user_id: string
  status: string
  conversion_stage: string
  follow_up_at: string
  internal_notes: string
  restaurant_id: string
}

const STATUS_OPTIONS = ['scheduled', 'completed', 'no_show', 'converted', 'lost']
const CONVERSION_STAGE_OPTIONS = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function toInputDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function buildCalendarGrid(month: Date) {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const startDow = first.getDay()
  const totalDays = last.getDate()
  const cells: Array<{ date: Date; inMonth: boolean }> = []

  for (let i = 0; i < startDow; i++) {
    const d = new Date(first)
    d.setDate(d.getDate() - (startDow - i))
    cells.push({ date: d, inMonth: false })
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(last)
    d.setDate(d.getDate() + (cells.length - (startDow + totalDays) + 1))
    cells.push({ date: d, inMonth: false })
  }
  return cells
}

export default function AdminDemoBookingsPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [owners, setOwners] = useState<BookingOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [filterOwnerId, setFilterOwnerId] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [draftById, setDraftById] = useState<Record<string, BookingDraft>>({})

  const range = useMemo(() => {
    const start = toYmd(startOfMonth(month))
    const end = toYmd(endOfMonth(month))
    return { start, end }
  }, [month])

  const calendarCells = useMemo(() => buildCalendarGrid(month), [month])

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, AdminBooking[]>()
    for (const b of bookings) {
      const key = b.booking_date
      const arr = map.get(key) || []
      arr.push(b)
      map.set(key, arr)
    }
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => a.booking_time.localeCompare(b.booking_time))
      map.set(k, v)
    }
    return map
  }, [bookings])

  const selectedYmd = selectedDate ? toYmd(selectedDate) : ''
  const selectedBookings = selectedYmd ? bookingsByDay.get(selectedYmd) || [] : []

  const hydrateDrafts = (nextBookings: AdminBooking[]) => {
    setDraftById((prev) => {
      const next = { ...prev }
      for (const booking of nextBookings) {
        next[booking.id] = next[booking.id] || {
          owner_user_id: booking.owner_user_id || '',
          status: booking.status || 'scheduled',
          conversion_stage: booking.conversion_stage || 'new',
          follow_up_at: toInputDateTime(booking.follow_up_at),
          internal_notes: booking.internal_notes || booking.notes || '',
          restaurant_id: ''
        }
      }
      return next
    })
  }

  const fetchOwners = async () => {
    try {
      const res = await api.get('/api/admin/demo-bookings/owners')
      setOwners(res.data?.owners || [])
    } catch {
      setOwners([])
    }
  }

  const fetchBookings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/admin/demo-bookings', {
        params: {
          ...range,
          ownerId: filterOwnerId,
          status: filterStatus,
          conversionStage: filterStage
        }
      })
      const nextBookings = res.data?.bookings || []
      setBookings(nextBookings)
      hydrateDrafts(nextBookings)
    } catch (e: any) {
      const raw = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load demo bookings'
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const updateDraft = (bookingId: string, key: keyof BookingDraft, value: string) => {
    setDraftById((prev) => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [key]: value
      }
    }))
  }

  const saveBooking = async (bookingId: string) => {
    const draft = draftById[bookingId]
    if (!draft) return
    setSavingId(bookingId)
    setError(null)
    try {
      await api.patch(`/api/admin/demo-bookings/${bookingId}`, {
        owner_user_id: draft.owner_user_id || null,
        status: draft.status,
        conversion_stage: draft.conversion_stage || null,
        follow_up_at: draft.follow_up_at ? new Date(draft.follow_up_at).toISOString() : null,
        internal_notes: draft.internal_notes || null
      })
      await fetchBookings()
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to update booking'
      setError(String(msg))
    } finally {
      setSavingId(null)
    }
  }

  const convertBooking = async (bookingId: string) => {
    const draft = draftById[bookingId]
    setConvertingId(bookingId)
    setError(null)
    try {
      await api.post(`/api/admin/demo-bookings/${bookingId}/convert`, {
        restaurant_id: draft?.restaurant_id || undefined
      })
      await fetchBookings()
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to convert booking'
      setError(String(msg))
    } finally {
      setConvertingId(null)
    }
  }

  useEffect(() => {
    fetchOwners()
  }, [])

  useEffect(() => {
    fetchBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, filterOwnerId, filterStatus, filterStage])

  return (
    <AdminLayout title="Demo Bookings" description="Calendar view of all booked demos">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-red-600 dark:text-red-300" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">Booking Calendar</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Assign owners and move demos through follow-up stages</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(addMonths(month, -1))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">Prev</button>
            <div className="min-w-[180px] text-center font-semibold text-gray-900 dark:text-white">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
            <button onClick={() => setMonth(addMonths(month, 1))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">Next</button>
            <button onClick={fetchBookings} className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" title="Refresh">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={filterOwnerId} onChange={(e) => setFilterOwnerId(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="all">All owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.name} ({owner.role})</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="all">All conversion stages</option>
            {CONVERSION_STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-200">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="grid grid-cols-7 text-xs text-gray-500 dark:text-gray-400 mb-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell) => {
                const ymd = toYmd(cell.date)
                const isSelected = selectedDate && toYmd(selectedDate) === ymd
                const disabled = !cell.inMonth
                const count = bookingsByDay.get(ymd)?.length || 0
                return (
                  <button key={`${ymd}-${cell.inMonth ? 'in' : 'out'}`} disabled={disabled} onClick={() => setSelectedDate(cell.date)} className={[
                    'h-14 rounded-xl border text-left px-2 py-2',
                    disabled ? 'opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-900' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                    isSelected ? 'ring-2 ring-red-500/60 border-red-300 dark:border-red-700' : ''
                  ].join(' ')}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{cell.date.getDate()}</div>
                      {count > 0 && <div className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-900/30">{count}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
            {loading && <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</div>}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Selected day</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{selectedDate ? selectedDate.toLocaleDateString() : '—'}</div>

            {selectedBookings.length === 0 ? <div className="text-sm text-gray-500 dark:text-gray-400">No demo bookings for this day.</div> : (
              <div className="space-y-3">
                {selectedBookings.map((b) => {
                  const draft = draftById[b.id]
                  return (
                    <div key={b.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                      <div className="font-semibold text-gray-900 dark:text-white">{b.booking_time} — {b.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{b.email}</div>
                      <div className="grid grid-cols-1 gap-2">
                        <select value={draft?.owner_user_id || ''} onChange={(e) => updateDraft(b.id, 'owner_user_id', e.target.value)} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                          <option value="">Unassigned owner</option>
                          {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={draft?.status || 'scheduled'} onChange={(e) => updateDraft(b.id, 'status', e.target.value)} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                          <select value={draft?.conversion_stage || 'new'} onChange={(e) => updateDraft(b.id, 'conversion_stage', e.target.value)} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                            {CONVERSION_STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                          </select>
                        </div>
                        <input type="datetime-local" value={draft?.follow_up_at || ''} onChange={(e) => updateDraft(b.id, 'follow_up_at', e.target.value)} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                        <textarea value={draft?.internal_notes || ''} onChange={(e) => updateDraft(b.id, 'internal_notes', e.target.value)} placeholder="Internal notes" className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" rows={2} />
                        <input type="text" value={draft?.restaurant_id || ''} onChange={(e) => updateDraft(b.id, 'restaurant_id', e.target.value)} placeholder="Restaurant ID (optional for conversion)" className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs" />
                        <div className="flex gap-2">
                          <button onClick={() => saveBooking(b.id)} disabled={savingId === b.id} className="px-2 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50">{savingId === b.id ? 'Saving…' : 'Save updates'}</button>
                          <button onClick={() => convertBooking(b.id)} disabled={convertingId === b.id} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs disabled:opacity-50">{convertingId === b.id ? 'Converting…' : 'Convert to onboarding'}</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
