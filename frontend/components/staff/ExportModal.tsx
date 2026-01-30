import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  X
} from 'lucide-react'
import { Button } from '../ui/Button'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (format: 'csv' | 'pdf', dateRange: { start: string; end: string }) => void
  exporting?: boolean
}

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  exporting = false
}: ExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom'>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const handleExport = () => {
    let startDate: string
    let endDate: string

    const now = new Date()

    if (dateRange === 'week') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
      startOfWeek.setHours(0, 0, 0, 0)
      startDate = startOfWeek.toISOString()

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      endDate = endOfWeek.toISOString()
    } else if (dateRange === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
    } else {
      if (!customStart || !customEnd) {
        return
      }
      startDate = new Date(customStart).toISOString()
      endDate = new Date(customEnd).toISOString()
    }

    onExport(format, { start: startDate, end: endDate })
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Export Data
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={onClose}
              className="!px-2"
            >
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormat('csv')}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    format === 'csv'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className={`w-8 h-8 ${format === 'csv' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`} />
                    <div className="text-center">
                      <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">CSV</span>
                      <span className="text-xs text-surface-600 dark:text-surface-400">Spreadsheet format</span>
                    </div>
                  </div>
                  {format === 'csv' && (
                    <motion.div
                      layoutId="format-check"
                      className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center"
                    >
                      <CheckIcon />
                    </motion.div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('pdf')}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    format === 'pdf'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileText className={`w-8 h-8 ${format === 'pdf' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`} />
                    <div className="text-center">
                      <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">PDF</span>
                      <span className="text-xs text-surface-600 dark:text-surface-400">Printable format</span>
                    </div>
                  </div>
                  {format === 'pdf' && (
                    <motion.div
                      layoutId="format-check"
                      className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center"
                    >
                      <CheckIcon />
                    </motion.div>
                  )}
                </button>
              </div>
            </div>

            {/* Date Range Selection */}
            <div>
              <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">
                Date Range
              </label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setDateRange('week')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    dateRange === 'week'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  }`}
                >
                  <Calendar className={`w-5 h-5 ${dateRange === 'week' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`} />
                  <div className="flex-1 text-left">
                    <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">This Week</span>
                    <span className="text-xs text-surface-600 dark:text-surface-400">Current week (Mon-Sun)</span>
                  </div>
                  {dateRange === 'week' && (
                    <motion.div layoutId="date-check" className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                      <CheckIcon />
                    </motion.div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDateRange('month')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    dateRange === 'month'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  }`}
                >
                  <Calendar className={`w-5 h-5 ${dateRange === 'month' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`} />
                  <div className="flex-1 text-left">
                    <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">This Month</span>
                    <span className="text-xs text-surface-600 dark:text-surface-400">All days in current month</span>
                  </div>
                  {dateRange === 'month' && (
                    <motion.div layoutId="date-check" className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                      <CheckIcon />
                    </motion.div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDateRange('custom')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    dateRange === 'custom'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                  }`}
                >
                  <Calendar className={`w-5 h-5 ${dateRange === 'custom' ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`} />
                  <div className="flex-1 text-left">
                    <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">Custom Range</span>
                    <span className="text-xs text-surface-600 dark:text-surface-400">Pick specific dates</span>
                  </div>
                  {dateRange === 'custom' && (
                    <motion.div layoutId="date-check" className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                      <CheckIcon />
                    </motion.div>
                  )}
                </button>

                {dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 pl-8">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 bg-surface-50 dark:bg-surface-900/50">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Download}
              onClick={handleExport}
              disabled={exporting}
              className="flex-1"
            >
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
