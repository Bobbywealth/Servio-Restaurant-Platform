import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import ManagerTimeClockModal from '../../components/timeclock/ManagerTimeClockModal'
import { Clock, Users, Play, Pause, Coffee, CheckCircle, UserCog } from 'lucide-react'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'

const DashboardLayoutForTimeclock = dynamic(() => import('../../components/Layout/DashboardLayout'), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-gray-50 animate-pulse" />
})

interface Staff {
  user_id: string
  name: string
  role: string
  time_entry_id: string
  clock_in_time: string
  position?: string
  break_minutes: number
  is_on_break: boolean
  current_break_start?: string
  hours_worked: number
}

interface TimeEntry {
  id: string
  user_id: string
  user_name: string
  user_role: string
  clock_in_time: string
  clock_out_time?: string
  break_minutes: number
  total_hours?: number
  position?: string
  notes?: string
}

export default function TimeClockPage() {
  const [currentStaff, setCurrentStaff] = useState<Staff[]>([])
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [selectedPin, setSelectedPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({
    totalStaff: 0,
    staffOnBreak: 0,
    totalHoursToday: 0,
    avgHoursPerShift: 0
  })

  const [showManagerModal, setShowManagerModal] = useState(false)

  useEffect(() => {
    fetchCurrentStaff()
    fetchRecentEntries()
    fetchStats()

    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchCurrentStaff()
      fetchRecentEntries()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const fetchCurrentStaff = async () => {
    try {
      const response = await api.get('/api/timeclock/current-staff')
      const data = response.data

      if (data.success) {
        setCurrentStaff(data.data.currentStaff)
        setStats(prev => ({
          ...prev,
          totalStaff: data.data.totalStaff,
          staffOnBreak: data.data.staffOnBreak
        }))
      }
    } catch (error) {
      console.error('Error fetching current staff:', error)
    }
  }

  const fetchRecentEntries = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await api.get('/api/timeclock/entries', { params: { startDate: today, limit: 10 } })
      const data = response.data

      if (data.success) {
        setRecentEntries(data.data.entries)
      }
    } catch (error) {
      console.error('Error fetching recent entries:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await api.get('/api/timeclock/stats', { params: { startDate: today, endDate: today } })
      const data = response.data

      if (data.success) {
        setStats(prev => ({
          ...prev,
          totalHoursToday: data.data.totalStats.total_hours || 0,
          avgHoursPerShift: data.data.totalStats.avg_hours_per_shift || 0
        }))
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleClockIn = async () => {
    if (!selectedPin) return

    setIsLoading(true)
    try {
      const response = await api.post('/api/timeclock/clock-in', { pin: selectedPin })
      const data = response.data

      if (data.success) {
        setSelectedPin('')
        fetchCurrentStaff()
        fetchRecentEntries()
        // Show success message
      } else {
        alert(data.error.message)
      }
    } catch (error) {
      console.error('Error clocking in:', error)
      alert('Error clocking in. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClockOut = async (userId: string) => {
    setIsLoading(true)
    try {
      const response = await api.post('/api/timeclock/clock-out', { userId })
      const data = response.data

      if (data.success) {
        fetchCurrentStaff()
        fetchRecentEntries()
        fetchStats()
        // Show success message
      } else {
        alert(data.error.message)
      }
    } catch (error) {
      console.error('Error clocking out:', error)
      alert('Error clocking out. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBreak = async (userId: string, isOnBreak: boolean) => {
    const endpoint = isOnBreak ? 'end-break' : 'start-break'

    try {
      const response = await api.post(`/api/timeclock/${endpoint}`, { userId })
      const data = response.data

      if (data.success) {
        fetchCurrentStaff()
      } else {
        alert(data.error.message)
      }
    } catch (error) {
      console.error('Error handling break:', error)
      alert('Error handling break. Please try again.')
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatHours = (hours: number) => {
    return hours.toFixed(1)
  }

  const addDigit = (digit: string) => {
    if (selectedPin.length < 4) {
      setSelectedPin(prev => prev + digit)
    }
  }

  const clearPin = () => {
    setSelectedPin('')
  }

  return (
    <DashboardLayoutForTimeclock>
      <Head>
        <title>Time Clock - Servio</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Time Clock</h1>
            <p className="text-gray-600">Staff time tracking and management</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowManagerModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              <UserCog className="w-4 h-4" />
              Manager Controls
            </button>

            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-gray-900">
                {new Date().toLocaleTimeString()}
              </div>
              <div className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Manager Modal */}
        <ManagerTimeClockModal
          isOpen={showManagerModal}
          onClose={() => setShowManagerModal(false)}
          onRefresh={() => {
            fetchCurrentStaff()
            fetchRecentEntries()
            fetchStats()
          }}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Staff Working</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalStaff}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Coffee className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">On Break</p>
                <p className="text-2xl font-bold text-gray-900">{stats.staffOnBreak}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Hours Today</p>
                <p className="text-2xl font-bold text-gray-900">{formatHours(stats.totalHoursToday)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Per Shift</p>
                <p className="text-2xl font-bold text-gray-900">{formatHours(stats.avgHoursPerShift)}</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Clock In/Out Interface */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Clock In/Out</h2>

            <div className="space-y-4">
              {/* PIN Display */}
              <div className="text-center">
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                  <div className="text-2xl font-mono tracking-widest">
                    {selectedPin.padEnd(4, '•')}
                  </div>
                </div>

                {/* PIN Keypad */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => addDigit(num.toString())}
                      className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-semibold text-gray-900 transition-colors"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={clearPin}
                    className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-semibold transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => addDigit('0')}
                    className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-semibold text-gray-900 transition-colors"
                  >
                    0
                  </button>
                  <button
                    onClick={handleClockIn}
                    disabled={selectedPin.length !== 4 || isLoading}
                    className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-colors"
                  >
                    Enter
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Currently Working Staff */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Currently Working</h2>

            <div className="space-y-3">
              {currentStaff.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No staff currently clocked in</p>
                </div>
              ) : (
                currentStaff.map((staff) => (
                  <div key={staff.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${staff.is_on_break ? 'bg-orange-400' : 'bg-green-400'}`} />
                      <div>
                        <p className="font-medium text-gray-900">{staff.name}</p>
                        <div className="text-sm text-gray-600">
                          <span>{staff.role}</span>
                          {staff.position && <span> • {staff.position}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right text-sm">
                        <p className="text-gray-900 font-medium">
                          {formatTime(staff.clock_in_time)} - Now
                        </p>
                        <p className="text-gray-600">
                          {formatHours(staff.hours_worked)} hrs worked
                        </p>
                        {staff.break_minutes > 0 && (
                          <p className="text-orange-600">
                            {staff.break_minutes}min breaks
                          </p>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleBreak(staff.user_id, staff.is_on_break)}
                          className={`p-2 rounded-lg transition-colors ${
                            staff.is_on_break
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          }`}
                        >
                          {staff.is_on_break ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => handleClockOut(staff.user_id)}
                          className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Recent Time Entries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Time Entries</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Staff Member</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Clock In</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Clock Out</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Break Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Total Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Position</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{entry.user_name}</p>
                        <p className="text-sm text-gray-600">{entry.user_role}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {formatTime(entry.clock_in_time)}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {entry.clock_out_time ? formatTime(entry.clock_out_time) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          Working
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {entry.break_minutes > 0 ? `${entry.break_minutes} min` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {entry.total_hours ? `${formatHours(entry.total_hours)} hrs` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {entry.position || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {recentEntries.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No time entries for today</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}