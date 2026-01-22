import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { api } from '../../lib/api'
import { CalendarDays, RefreshCw } from 'lucide-react'
import type { GetServerSideProps } from 'next'

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
  status: string
  created_at: string
}

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true }
  }
  return { props: {} }
}

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const fetchBookings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/admin/demo-bookings', { params: range })
      setBookings(res.data?.bookings || [])
    } catch (e: any) {
      const raw = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load demo bookings'
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

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
              <div className="text-sm text-gray-500 dark:text-gray-400">Click a day to view booked slots</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(addMonths(month, -1))}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              Prev
            </button>
            <div className="min-w-[180px] text-center font-semibold text-gray-900 dark:text-white">
              {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              Next
            </button>
            <button
              onClick={fetchBookings}
              className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="grid grid-cols-7 text-xs text-gray-500 dark:text-gray-400 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-2 py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell) => {
                const ymd = toYmd(cell.date)
                const isSelected = selectedDate && toYmd(selectedDate) === ymd
                const disabled = !cell.inMonth
                const count = bookingsByDay.get(ymd)?.length || 0
                return (
                  <button
                    key={`${ymd}-${cell.inMonth ? 'in' : 'out'}`}
                    disabled={disabled}
                    onClick={() => setSelectedDate(cell.date)}
                    className={[
                      'h-14 rounded-xl border text-left px-2 py-2',
                      disabled
                        ? 'opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-900'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                      isSelected ? 'ring-2 ring-red-500/60 border-red-300 dark:border-red-700' : ''
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{cell.date.getDate()}</div>
                      {count > 0 && (
                        <div className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-900/30">
                          {count}
                        </div>
                      )}
                    </div>
                    {count > 0 && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">booked</div>}
                  </button>
                )
              })}
            </div>

            {loading && <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</div>}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Selected day</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {selectedDate ? selectedDate.toLocaleDateString() : '—'}
            </div>

            {selectedBookings.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">No demo bookings for this day.</div>
            ) : (
              <div className="space-y-3">
                {selectedBookings.map((b) => (
                  <div key={b.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {b.booking_time} — {b.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{b.email}</div>
                        {b.restaurant_name && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">{b.restaurant_name}</div>
                        )}
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                        {b.status}
                      </div>
                    </div>
                    {(b.phone || b.notes) && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {b.phone ? <div>Phone: {b.phone}</div> : null}
                        {b.notes ? <div>Notes: {b.notes}</div> : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

