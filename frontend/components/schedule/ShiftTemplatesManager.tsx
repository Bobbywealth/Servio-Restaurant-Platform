import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  Clock,
  Trash2,
  Edit3,
  Calendar,
  Copy,
  Check,
  Loader2
} from 'lucide-react'
import { Modal } from '../ui/Modal'

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  position?: string
  color?: string
  is_active: boolean
}

interface ShiftTemplatesManagerProps {
  isOpen: boolean
  onClose: () => void
  templates: ShiftTemplate[]
  onCreateTemplate: (template: Omit<ShiftTemplate, 'id' | 'is_active'>) => Promise<void>
  onUpdateTemplate: (id: string, template: Partial<ShiftTemplate>) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onApplyTemplate: (templateId: string, weekStartDate: string) => Promise<void>
}

const POSITIONS = [
  'Server',
  'Cook',
  'Host',
  'Manager',
  'Cashier',
  'Bartender',
  'Dishwasher',
  'Busser',
  'Other'
]

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
  const minutes = (i % 2) * 30
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})

const COLORS = [
  '#14B8A6', // Teal
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
]

export function ShiftTemplatesManager({
  isOpen,
  onClose,
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onApplyTemplate
}: ShiftTemplatesManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: 0,
    position: '',
    color: '#14B6D4'
  })
  const [applyConfirm, setApplyConfirm] = useState<string | null>(null)

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading('save')
    try {
      if (editingTemplate) {
        await onUpdateTemplate(editingTemplate.id, formData)
        setEditingTemplate(null)
      } else {
        await onCreateTemplate(formData)
        setShowCreateForm(false)
      }
      setFormData({
        name: '',
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 0,
        position: '',
        color: '#14B8A6'
      })
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setLoading(null)
    }
  }

  const handleEdit = (template: ShiftTemplate) => {
    setFormData({
      name: template.name,
      start_time: template.start_time,
      end_time: template.end_time,
      break_minutes: template.break_minutes,
      position: template.position || '',
      color: template.color || '#14B8A6'
    })
    setEditingTemplate(template)
    setShowCreateForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    setLoading(id)
    try {
      await onDeleteTemplate(id)
    } catch (error) {
      console.error('Failed to delete template:', error)
    } finally {
      setLoading(null)
    }
  }

  const handleApply = async (templateId: string) => {
    setApplyConfirm(templateId)
  }

  const confirmApply = async (templateId: string) => {
    setLoading(templateId)
    try {
      // Get start of current week
      const now = new Date()
      const dayOfWeek = now.getDay()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
      const weekStartDate = startOfWeek.toISOString().split('T')[0]

      await onApplyTemplate(templateId, weekStartDate)
      setApplyConfirm(null)
    } catch (error) {
      console.error('Failed to apply template:', error)
    } finally {
      setLoading(null)
    }
  }

  const cancelForm = () => {
    setShowCreateForm(false)
    setEditingTemplate(null)
    setFormData({
      name: '',
      start_time: '09:00',
      end_time: '17:00',
      break_minutes: 0,
      position: '',
      color: '#14B8A6'
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Shift Templates"
      description="Create and manage reusable shift templates"
      size="lg"
    >
      <div className="space-y-4">
        {/* Create/Edit Form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-4 space-y-4 overflow-hidden"
            >
              <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Morning Shift"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Position
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  >
                    <option value="">All Positions</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Start Time
                  </label>
                  <select
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>{formatTime(time)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    End Time
                  </label>
                  <select
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>{formatTime(time)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Break (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.break_minutes}
                    onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="120"
                    className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-lg transition-transform ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-surface-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="flex-1 px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-surface-100 dark:hover:bg-surface-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading === 'save'}
                  className="flex-1 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === 'save' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingTemplate ? 'Update' : 'Create'} Template
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Templates List */}
        {templates.length === 0 && !showCreateForm ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-surface-600 dark:text-surface-400">
              No templates yet. Create your first shift template to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700/50 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: template.color || '#14B8A6' }}
                  >
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-surface-900 dark:text-surface-100">
                      {template.name}
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {formatTime(template.start_time)} - {formatTime(template.end_time)}
                      {template.position && ` • ${template.position}`}
                      {template.break_minutes > 0 && ` • ${template.break_minutes}min break`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {applyConfirm === template.id ? (
                    <>
                      <button
                        onClick={() => confirmApply(template.id)}
                        disabled={loading === template.id}
                        className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Apply?
                      </button>
                      <button
                        onClick={() => setApplyConfirm(null)}
                        className="px-3 py-1.5 bg-surface-200 dark:bg-surface-600 text-surface-700 dark:text-surface-300 text-sm font-medium rounded-lg hover:bg-surface-300 dark:hover:bg-surface-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApply(template.id)}
                        disabled={loading !== null}
                        className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
                        title="Apply to week"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        disabled={loading !== null}
                        className="p-2 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={loading !== null}
                        className="p-2 text-surface-600 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Template Button */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full py-3 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-xl text-surface-600 dark:text-surface-400 font-medium hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Template
          </button>
        )}
      </div>
    </Modal>
  )
}

export default ShiftTemplatesManager
