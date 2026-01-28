import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  History,
  RotateCcw,
  Calendar,
  ChevronRight,
  Plus,
  UserPlus
} from 'lucide-react'
import { api } from '../../lib/api'

interface ManagerTimeClockModalProps {
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}

interface StaffMember {
  userId: string
  name: string
  role: string
  pin?: string | null
  isClockedIn: boolean
  timeEntryId?: string
  clockInTime?: string
  position?: string | null
  breakMinutes: number
  isOnBreak: boolean
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
  position?: string | null
  notes?: string | null
}

export default function ManagerTimeClockModal({ isOpen, onClose, onRefresh }: ManagerTimeClockModalProps) {
  const [activeTab, setActiveTab] = useState<'staff' | 'entries'>('staff')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal states
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [showClockInModal, setShowClockInModal] = useState(false)
  const [showClockOutModal, setShowClockOutModal] = useState(false)
  const [showReverseModal, setShowReverseModal] = useState(false)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)

  // Form states
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')
  const [position, setPosition] = useState('')
  const [notes, setNotes] = useState('')
  const [reverseReason, setReverseReason] = useState('')

  // Add staff form states
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffRole, setNewStaffRole] = useState('staff')
  const [generatedPin, setGeneratedPin] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Load all staff with their clock status
      const staffResp = await api.get('/api/timeclock/manager/all-staff')
      setStaff(staffResp.data?.data?.staff || [])

      // Load recent entries for reversal
      const today = new Date().toISOString().split('T')[0]
      const entriesResp = await api.get('/api/timeclock/entries', {
        params: { startDate: today, limit: 20 }
      })
      setRecentEntries(entriesResp.data?.data?.entries || [])
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClockIn = async () => {
    if (!selectedStaff) return
    setActionLoading(selectedStaff.userId)

    try {
      const response = await api.post('/api/timeclock/manager/clock-in', {
        userId: selectedStaff.userId,
        position: position || undefined,
        clockInTime: clockInTime || undefined
      })

      if (response.data.success) {
        setSuccess(`Clocked in ${selectedStaff.name} successfully`)
        closeAllModals()
        onRefresh()
        loadData()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(response.data.error?.message || 'Failed to clock in')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to clock in')
    } finally {
      setActionLoading(null)
    }
  }

  const handleClockOut = async () => {
    if (!selectedStaff) return
    setActionLoading(selectedStaff.userId)

    try {
      const response = await api.post('/api/timeclock/manager/clock-out', {
        userId: selectedStaff.userId,
        notes: notes || undefined,
        clockOutTime: clockOutTime || undefined
      })

      if (response.data.success) {
        setSuccess(`Clocked out ${selectedStaff.name} successfully`)
        closeAllModals()
        onRefresh()
        loadData()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(response.data.error?.message || 'Failed to clock out')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to clock out')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReverseEntry = async () => {
    if (!selectedEntry) return
    setActionLoading(selectedEntry.id)

    try {
      const response = await api.post('/api/timeclock/manager/reverse-entry', {
        entryId: selectedEntry.id,
        reason: reverseReason || 'Manager reversal'
      })

      if (response.data.success) {
        setSuccess(`Reversed entry for ${selectedEntry.user_name} successfully`)
        closeAllModals()
        onRefresh()
        loadData()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(response.data.error?.message || 'Failed to reverse entry')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to reverse entry')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) {
      setError('Name is required')
      return
    }

    setActionLoading('add-staff')

    try {
      const response = await api.post('/api/restaurant/staff', {
        name: newStaffName.trim(),
        email: newStaffEmail.trim() || undefined,
        role: newStaffRole
      })

      if (response.data.success) {
        setGeneratedPin(response.data.data.pin)
        setSuccess(`Successfully added ${newStaffName}!`)
        onRefresh()
        loadData()
        // Don't close the modal yet - show the PIN
      } else {
        setError(response.data.error?.message || 'Failed to add staff member')
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to add staff member')
    } finally {
      setActionLoading(null)
    }
  }

  const closeAddStaffModal = () => {
    setShowAddStaffModal(false)
    setNewStaffName('')
    setNewStaffEmail('')
    setNewStaffRole('staff')
    setGeneratedPin(null)
    setError(null)
    setSuccess(null)
  }

  const closeAllModals = () => {
    setShowClockInModal(false)
    setShowClockOutModal(false)
    setShowReverseModal(false)
    setShowAddStaffModal(false)
    setSelectedStaff(null)
    setSelectedEntry(null)
    setClockInTime('')
    setClockOutTime('')
    setPosition('')
    setNotes('')
    setReverseReason('')
    setNewStaffName('')
    setNewStaffEmail('')
    setNewStaffRole('staff')
    setGeneratedPin(null)
  }

  const openClockInModal = (staffMember: StaffMember) => {
    setSelectedStaff(staffMember)
    setShowClockInModal(true)
    setError(null)
    setSuccess(null)
  }

  const openClockOutModal = (staffMember: StaffMember) => {
    setSelectedStaff(staffMember)
    setShowClockOutModal(true)
    setError(null)
    setSuccess(null)
  }

  const openReverseModal = (entry: TimeEntry) => {
    setSelectedEntry(entry)
    setShowReverseModal(true)
    setError(null)
    setSuccess(null)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDefaultTime = () => {
    const now = new Date()
    return now.toTimeString().slice(0, 5) // HH:mm format
  }

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeAllModals}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                  Manager Time Clock
                </h2>
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Manually manage employee clock in/out
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-surface-700">
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'staff'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Staff Management
            </button>
            <button
              onClick={() => setActiveTab('entries')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'entries'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
              }`}
            >
              <History className="w-4 h-4 inline mr-2" />
              Recent Entries
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Success/Error Messages */}
            {success && (
              <div className="mb-4 flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-xl">
                <CheckCircle className="w-5 h-5" />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : activeTab === 'staff' ? (
              <>
                {/* Search */}
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Staff Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStaff.map((staffMember) => (
                    <div
                      key={staffMember.userId}
                      className={`p-4 rounded-xl border transition-colors ${
                        staffMember.isClockedIn
                          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                          : 'bg-gray-50 dark:bg-surface-700 border-gray-200 dark:border-surface-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                            staffMember.isClockedIn
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                          }`}>
                            {staffMember.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-surface-900 dark:text-surface-100">
                              {staffMember.name}
                            </p>
                            <p className="text-sm text-surface-600 dark:text-surface-400">
                              {staffMember.role}
                            </p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          staffMember.isClockedIn
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-surface-600 dark:text-surface-300'
                        }`}>
                          {staffMember.isClockedIn ? 'Clocked In' : 'Off Shift'}
                        </div>
                      </div>

                      {staffMember.isClockedIn && staffMember.clockInTime && (
                        <div className="mb-3 text-sm text-surface-600 dark:text-surface-400">
                          <span>Since {formatTime(staffMember.clockInTime)}</span>
                          {staffMember.isOnBreak && (
                            <span className="ml-2 text-amber-500">• On Break</span>
                          )}
                          {staffMember.breakMinutes > 0 && (
                            <span className="ml-2 text-surface-500">
                              ({staffMember.breakMinutes}min breaks)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {staffMember.isClockedIn ? (
                          <button
                            onClick={() => openClockOutModal(staffMember)}
                            disabled={actionLoading === staffMember.userId}
                            className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading === staffMember.userId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Clock Out
                          </button>
                        ) : (
                          <button
                            onClick={() => openClockInModal(staffMember)}
                            disabled={actionLoading === staffMember.userId}
                            className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading === staffMember.userId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                            Clock In
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedStaff(staffMember)
                            setSelectedStaff(staffMember)
                            if (staffMember.isClockedIn) {
                              openClockOutModal(staffMember)
                            } else {
                              openClockInModal(staffMember)
                            }
                          }}
                          className="px-3 py-2 bg-gray-100 dark:bg-surface-600 hover:bg-gray-200 dark:hover:bg-surface-500 text-surface-700 dark:text-surface-200 text-sm font-medium rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Recent Entries Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-surface-700">
                        <th className="text-left py-3 px-4 font-medium text-surface-600 dark:text-surface-400">Staff</th>
                        <th className="text-left py-3 px-4 font-medium text-surface-600 dark:text-surface-400">Clock In</th>
                        <th className="text-left py-3 px-4 font-medium text-surface-600 dark:text-surface-400">Clock Out</th>
                        <th className="text-left py-3 px-4 font-medium text-surface-600 dark:text-surface-400">Hours</th>
                        <th className="text-left py-3 px-4 font-medium text-surface-600 dark:text-surface-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100 dark:border-surface-700">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-surface-900 dark:text-surface-100">{entry.user_name}</p>
                              <p className="text-sm text-surface-600 dark:text-surface-400">{entry.user_role}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-surface-900 dark:text-surface-100">
                            {formatDateTime(entry.clock_in_time)}
                          </td>
                          <td className="py-3 px-4 text-surface-900 dark:text-surface-100">
                            {entry.clock_out_time ? formatDateTime(entry.clock_out_time) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Working
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-surface-900 dark:text-surface-100">
                            {entry.total_hours ? `${Number(entry.total_hours).toFixed(2)}h` : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => openReverseModal(entry)}
                              className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reverse
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {recentEntries.length === 0 && (
                    <div className="text-center py-8 text-surface-500">
                      <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No recent time entries</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Clock In Modal */}
      <AnimatePresence>
        {showClockInModal && selectedStaff && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeAllModals}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  Clock In: {selectedStaff.name}
                </h3>
                <button
                  onClick={closeAllModals}
                  className="p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Custom Time */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Clock In Time
                  </label>
                  <input
                    type="time"
                    value={clockInTime}
                    onChange={(e) => setClockInTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-surface-500 mt-1">
                    Leave blank for current time
                  </p>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Position (Optional)
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g., Server, Cook, Cashier"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeAllModals}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClockIn}
                    disabled={actionLoading !== null}
                    className="flex-1 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading !== null ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-5 h-5" />
                    )}
                    Clock In
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clock Out Modal */}
      <AnimatePresence>
        {showClockOutModal && selectedStaff && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeAllModals}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-surface-700">
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  Clock Out: {selectedStaff.name}
                </h3>
                <button
                  onClick={closeAllModals}
                  className="p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Custom Time */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Clock Out Time
                  </label>
                  <input
                    type="time"
                    value={clockOutTime}
                    onChange={(e) => setClockOutTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-surface-500 mt-1">
                    Leave blank for current time
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this shift..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeAllModals}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClockOut}
                    disabled={actionLoading !== null}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading !== null ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-5 h-5" />
                    )}
                    Clock Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reverse Entry Modal */}
      <AnimatePresence>
        {showReverseModal && selectedEntry && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeAllModals}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                    <RotateCcw className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                    Reverse Time Entry
                  </h3>
                </div>
                <button
                  onClick={closeAllModals}
                  className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Entry Details */}
                <div className="bg-gray-50 dark:bg-surface-700 rounded-xl p-4">
                  <p className="font-medium text-surface-900 dark:text-surface-100">
                    {selectedEntry.user_name}
                  </p>
                  <p className="text-sm text-surface-600 dark:text-surface-400">
                    {formatDateTime(selectedEntry.clock_in_time)} → {selectedEntry.clock_out_time ? formatDateTime(selectedEntry.clock_out_time) : 'Working'}
                  </p>
                  {selectedEntry.total_hours && (
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                      Total: {Number(selectedEntry.total_hours).toFixed(2)} hours
                    </p>
                  )}
                </div>

                {/* Warning */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> This action will permanently delete this time entry. This cannot be undone.
                  </p>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Reason for Reversal
                  </label>
                  <textarea
                    value={reverseReason}
                    onChange={(e) => setReverseReason(e.target.value)}
                    placeholder="Explain why this entry is being reversed..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeAllModals}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReverseEntry}
                    disabled={actionLoading !== null}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading !== null ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-5 h-5" />
                    )}
                    Reverse Entry
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}
