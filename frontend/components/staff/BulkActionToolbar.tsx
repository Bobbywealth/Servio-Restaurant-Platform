import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Edit3,
  Clock,
  CheckCircle,
  X,
  Download,
  Mail
} from 'lucide-react'
import { Button } from '../ui/Button'

interface BulkActionToolbarProps {
  selectedCount: number
  onEdit: () => void
  onActivate: () => void
  onDeactivate: () => void
  onResetPins: () => void
  onExport: () => void
  onClear: () => void
}

export default function BulkActionToolbar({
  selectedCount,
  onEdit,
  onActivate,
  onDeactivate,
  onResetPins,
  onExport,
  onClear
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 p-4 min-w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-surface-900 dark:text-surface-100">
                {selectedCount} selected
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={onClear}
              className="!px-2"
            >
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Edit3}
              onClick={onEdit}
              className="justify-start"
            >
              Edit Selected
            </Button>

            <Button
              variant="success"
              size="sm"
              icon={CheckCircle}
              onClick={onActivate}
              className="justify-start"
            >
              Activate
            </Button>

            <Button
              variant="destructive"
              size="sm"
              icon={X}
              onClick={onDeactivate}
              className="justify-start"
            >
              Deactivate
            </Button>

            <Button
              variant="outline"
              size="sm"
              icon={Clock}
              onClick={onResetPins}
              className="justify-start"
            >
              Reset PINs
            </Button>

            <Button
              variant="orange"
              size="sm"
              icon={Mail}
              onClick={() => {}}
              className="justify-start"
            >
              Email PINs
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={onExport}
              className="justify-start"
            >
              Export
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
