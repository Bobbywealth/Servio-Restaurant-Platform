import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarDays, Clock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

type BookingSlot = { booking_date: string; booking_time: string }

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
  const startDow = first.getDay() // 0..6
  const totalDays = last.getDate()

  const cells: Array<{ date: Date; inMonth: boolean }> = []

  // previous month padding
  for (let i = 0; i < startDow; i++) {
    const d = new Date(first)
    d.setDate(d.getDate() - (startDow - i))
    cells.push({ date: d, inMonth: false })
  }

  // current month days
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true })
  }

  // next month padding to complete weeks
  while (cells.length % 7 !== 0) {
    const d = new Date(last)
    d.setDate(d.getDate() + (cells.length - (startDow + totalDays) + 1))
    cells.push({ date: d, inMonth: false })
  }

  return cells
}

function buildTimeSlots() {
  // Mon–Fri 9:00–17:00, every 30 min
  const slots: string[] = []
  for (let h = 9; h <= 16; h++) {
    slots.push(`${pad2(h)}:00`)
    slots.push(`${pad2(h)}:30`)
  }
  slots.push('17:00')
  return slots
}

export default function BookDemoPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const timeSlots = useMemo(() => buildTimeSlots(), [])
  const calendarCells = useMemo(() => buildCalendarGrid(month), [month])

  const range = useMemo(() => {
    const start = toYmd(startOfMonth(month))
    const end = toYmd(endOfMonth(month))
    return { start, end }
  }, [month])

  const bookedSet = useMemo(() => {
    const s = new Set<string>()
    for (const b of slots) s.add(`${b.booking_date}|${b.booking_time}`)
    return s
  }, [slots])

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setLoadingSlots(true)
    api
      .get('/api/bookings', { params: range })
      .then((res) => {
        if (!mounted) return
        setSlots(res.data?.bookings || [])
      })
      .catch((e) => {
        if (!mounted) return
        console.error(e)
        // don't block UI if availability fails
        setSlots([])
      })
      .finally(() => mounted && setLoadingSlots(false))
    return () => {
      mounted = false
    }
  }, [range.start, range.end])

  const selectedYmd = selectedDate ? toYmd(selectedDate) : ''
  const isWeekend = selectedDate ? [0, 6].includes(selectedDate.getDay()) : false

  const submit = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Pick a date and time first.')
      return
    }
    setError(null)
    setSubmitting(true)
    setSuccessId(null)
    try {
      const res = await api.post('/api/bookings', {
        name,
        email,
        phone,
        restaurantName,
        bookingDate: selectedYmd,
        bookingTime: selectedTime,
        timezone: tz,
        notes
      })
      setSuccessId(res.data?.id || 'created')
      setSelectedTime('')
      setNotes('')
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to book demo'
      setError(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Book a Demo | Servio</title>
        <meta name="description" content="Book a Servio demo with our team." />
      </Head>

      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-10">
            <Link href="/" className="inline-flex items-center text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to home
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Admin / Login
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-teal-500" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Book a demo</h1>
                  <p className="text-slate-600">Choose a date and time. We’ll confirm by email.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800"
                      onClick={() => setMonth(addMonths(month, -1))}
                      type="button"
                    >
                      Prev
                    </button>
                    <div className="text-lg font-semibold">
                      {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                    </div>
                    <button
                      className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800"
                      onClick={() => setMonth(addMonths(month, 1))}
                      type="button"
                    >
                      Next
                    </button>
                  </div>

                  <div className="grid grid-cols-7 text-xs text-slate-500 mb-2">
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
                      return (
                        <button
                          key={`${ymd}-${cell.inMonth ? 'in' : 'out'}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setSelectedDate(cell.date)
                            setSelectedTime('')
                            setSuccessId(null)
                            setError(null)
                          }}
                          className={[
                            'h-10 rounded-lg border text-sm',
                            disabled ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-100' : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-teal-50',
                            isSelected ? 'ring-2 ring-teal-500 border-teal-400' : '',
                            [0, 6].includes(cell.date.getDay()) && cell.inMonth ? 'text-slate-500' : 'text-slate-900'
                          ].join(' ')}
                        >
                          {cell.date.getDate()}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 text-sm text-slate-600">
                    {loadingSlots ? 'Loading availability…' : 'Availability updates live as times are booked.'}
                  </div>
                </div>

                {/* Times */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <div className="font-semibold">Time slots</div>
                  </div>

                  {!selectedDate ? (
                    <div className="text-slate-500">Select a date first.</div>
                  ) : isWeekend ? (
                    <div className="text-slate-500">Weekends are unavailable. Please pick a weekday.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {timeSlots.map((t) => {
                        const key = `${selectedYmd}|${t}`
                        const booked = bookedSet.has(key)
                        const active = selectedTime === t
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={booked}
                            onClick={() => {
                              setSelectedTime(t)
                              setSuccessId(null)
                              setError(null)
                            }}
                            className={[
                              'px-3 py-2 rounded-lg border text-sm',
                              booked
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                                : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-teal-50',
                              active ? 'ring-2 ring-teal-500 border-teal-400' : ''
                            ].join(' ')}
                          >
                            {t}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Booking form */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-bold mb-2">Your details</h2>
              <p className="text-slate-600 mb-6">
                {selectedDate && selectedTime ? (
                  <>
                    Booking for <span className="text-slate-900 font-semibold">{selectedYmd}</span> at{' '}
                    <span className="text-slate-900 font-semibold">{selectedTime}</span> ({tz})
                  </>
                ) : (
                  'Pick a date and time to continue.'
                )}
              </p>

              {successId && (
                <div className="mb-5 p-4 rounded-xl border border-emerald-500/30 bg-emerald-50 text-emerald-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600" />
                    <div>
                      <div className="font-semibold">Booked!</div>
                      <div className="text-sm text-emerald-700">We’ll reach out shortly to confirm.</div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-50 text-red-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 mt-0.5 text-red-600" />
                    <div className="text-sm">{error}</div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-700">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="name@restaurant.com"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Phone (optional)</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Restaurant (optional)</label>
                  <input
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Restaurant name"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-700">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="What would you like to see in the demo?"
                  />
                </div>

                <button
                  type="button"
                  disabled={
                    submitting ||
                    !name.trim() ||
                    !email.trim() ||
                    !selectedDate ||
                    !selectedTime ||
                    isWeekend
                  }
                  onClick={submit}
                  className="w-full mt-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-semibold transition-colors"
                >
                  {submitting ? 'Booking…' : 'Confirm booking'}
                </button>

                <p className="text-xs text-slate-500">
                  By booking, you agree to be contacted about Servio. This is a demo request—not an auto-charged purchase.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}

