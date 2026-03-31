import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Calendar, ChevronDown, ChevronUp, ClipboardList, Plus, Settings, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../../lib/api'

type StaffMember = { id: string; name: string }

type ChecklistItem = {
  id: string
  text: string
  isCritical: boolean
  completion: {
    completedByName?: string
    completedAt: string
  } | null
}

type ChecklistSection = {
  id: string
  name: string
  emoji?: string
  assignedTo?: string
  assignedToName?: string
  items: ChecklistItem[]
}

type ChecklistInstance = {
  id: string
  templateName: string
  sections: ChecklistSection[]
  progress: { completed: number; total: number; percent: number }
}

type TemplateSection = {
  name: string
  emoji?: string
  assignedTo?: string
  items: Array<{ text: string; isCritical: boolean }>
}

type TemplateModel = {
  id?: string
  name: string
  description?: string
  recurrence: 'daily' | 'weekly' | 'custom'
  recurrence_days: number[]
  is_active?: boolean
  sections: TemplateSection[]
}

const weekdays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
]

export default function DailyChecklistsTab({ staff, canManage }: { staff: StaffMember[]; canManage: boolean }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [templates, setTemplates] = useState<TemplateModel[]>([])
  const [showManageModal, setShowManageModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TemplateModel | null>(null)

  const fetchToday = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/checklists/today', { params: { date } })
      setInstances(res.data?.data?.instances || [])
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to load daily checklists')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/api/checklists/templates')
      setTemplates(res.data?.data?.templates || [])
    } catch {
      toast.error('Failed to load checklist templates')
    }
  }

  useEffect(() => {
    fetchToday()
  }, [date])

  const overallProgress = useMemo(() => {
    const total = instances.reduce((sum, instance) => sum + instance.progress.total, 0)
    const completed = instances.reduce((sum, instance) => sum + instance.progress.completed, 0)
    return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) }
  }, [instances])

  const toggleItem = async (instanceId: string, itemId: string) => {
    try {
      await api.post(`/api/checklists/${instanceId}/toggle/${itemId}`)
      await fetchToday()
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to update checklist item')
    }
  }

  const openManageModal = async () => {
    await fetchTemplates()
    setEditingTemplate(null)
    setShowManageModal(true)
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-surface-500" />
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {canManage && (
            <button onClick={openManageModal} className="btn-secondary inline-flex items-center justify-center">
              <Settings className="w-4 h-4 mr-2" />
              Manage Templates
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100">Overall Completion</h3>
          <span className="text-sm text-surface-600 dark:text-surface-400">{overallProgress.completed}/{overallProgress.total} ({overallProgress.percent}%)</span>
        </div>
        <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
          <div className="h-full bg-primary-600" style={{ width: `${overallProgress.percent}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-8 text-surface-600 dark:text-surface-400">Loading checklists...</div>
      ) : instances.length === 0 ? (
        <div className="card text-center py-8 text-surface-600 dark:text-surface-400">No active checklist templates for this date.</div>
      ) : (
        instances.map((instance) => (
          <div key={instance.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-surface-900 dark:text-surface-100">{instance.templateName}</h3>
              <span className="text-sm text-surface-600 dark:text-surface-400">{instance.progress.completed}/{instance.progress.total} items ({instance.progress.percent}%)</span>
            </div>
            {instance.sections.map((section) => {
              const sectionKey = `${instance.id}-${section.id}`
              const isOpen = expandedSections[sectionKey] ?? true
              const completed = section.items.filter((item) => item.completion).length
              return (
                <div key={section.id} className="border border-surface-200 dark:border-surface-700 rounded-lg">
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between"
                    onClick={() => setExpandedSections((prev) => ({ ...prev, [sectionKey]: !isOpen }))}
                  >
                    <div className="text-left">
                      <div className="font-medium text-surface-900 dark:text-surface-100">{section.emoji || '📋'} {section.name} — {completed}/{section.items.length} ✓</div>
                      {section.assignedToName && (
                        <span className="text-xs mt-1 inline-flex rounded-full px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">Assigned: {section.assignedToName}</span>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-2">
                      {section.items.map((item) => (
                        <label key={item.id} className={`flex items-start gap-2 rounded-md p-2 ${item.isCritical ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : ''}`}>
                          <input type="checkbox" checked={Boolean(item.completion)} onChange={() => toggleItem(instance.id, item.id)} className="mt-1" />
                          <div className="text-sm">
                            <div className={`${item.completion ? 'line-through text-surface-500 dark:text-surface-500' : 'text-surface-800 dark:text-surface-100'}`}>
                              {item.isCritical && <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-600" />} {item.text}
                            </div>
                            {item.completion && (
                              <div className="text-xs text-surface-500 mt-1">
                                Completed by {item.completion.completedByName || 'Staff'} at {new Date(item.completion.completedAt).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}

      {showManageModal && (
        <TemplateManagerModal
          templates={templates}
          staff={staff}
          editingTemplate={editingTemplate}
          onSelectTemplate={setEditingTemplate}
          onClose={() => setShowManageModal(false)}
          onSaved={async () => {
            await fetchTemplates()
            await fetchToday()
          }}
        />
      )}
    </div>
  )
}

function TemplateManagerModal({ templates, staff, editingTemplate, onSelectTemplate, onClose, onSaved }: {
  templates: TemplateModel[]
  staff: StaffMember[]
  editingTemplate: TemplateModel | null
  onSelectTemplate: (template: TemplateModel | null) => void
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [model, setModel] = useState<TemplateModel>(editingTemplate || {
    name: '',
    description: '',
    recurrence: 'daily',
    recurrence_days: [0, 1, 2, 3, 4, 5, 6],
    sections: []
  })

  useEffect(() => {
    if (editingTemplate) {
      setModel(editingTemplate)
    }
  }, [editingTemplate])

  const save = async () => {
    try {
      if (!model.name.trim()) {
        toast.error('Template name is required')
        return
      }
      if (model.id) {
        await api.put(`/api/checklists/templates/${model.id}`, model)
      } else {
        await api.post('/api/checklists/templates', model)
      }
      toast.success('Template saved')
      await onSaved()
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to save template')
    }
  }

  const removeTemplate = async (id?: string) => {
    if (!id || !confirm('Delete this template?')) return
    await api.delete(`/api/checklists/templates/${id}`)
    toast.success('Template deleted')
    onSelectTemplate(null)
    await onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto bg-white dark:bg-surface-900 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Manage Checklist Templates</h3>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-3 space-y-2">
            <button className="btn-primary w-full inline-flex items-center justify-center" onClick={() => setModel({ name: '', description: '', recurrence: 'daily', recurrence_days: [0, 1, 2, 3, 4, 5, 6], sections: [] })}>
              <Plus className="w-4 h-4 mr-2" /> New Template
            </button>
            {templates.map((template) => (
              <button key={template.id} className="w-full text-left p-2 rounded hover:bg-surface-100 dark:hover:bg-surface-800" onClick={() => onSelectTemplate(template)}>
                <div className="font-medium text-sm">{template.name}</div>
              </button>
            ))}
          </div>

          <div className="md:col-span-2 border border-surface-200 dark:border-surface-700 rounded-lg p-3 space-y-3">
            <input className="input-field w-full" placeholder="Template name" value={model.name} onChange={(e) => setModel((prev) => ({ ...prev, name: e.target.value }))} />
            <textarea className="input-field w-full" placeholder="Description" value={model.description || ''} onChange={(e) => setModel((prev) => ({ ...prev, description: e.target.value }))} />
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day) => (
                <button
                  key={day.value}
                  className={`px-2 py-1 rounded text-xs ${model.recurrence_days.includes(day.value) ? 'bg-primary-600 text-white' : 'bg-surface-100 dark:bg-surface-800'}`}
                  onClick={() => setModel((prev) => ({
                    ...prev,
                    recurrence_days: prev.recurrence_days.includes(day.value)
                      ? prev.recurrence_days.filter((d) => d !== day.value)
                      : [...prev.recurrence_days, day.value]
                  }))}
                >
                  {day.label}
                </button>
              ))}
            </div>

            {model.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="border border-surface-200 dark:border-surface-700 rounded p-2 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input className="input-field" placeholder="Emoji" value={section.emoji || ''} onChange={(e) => setModel((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === sectionIndex ? { ...s, emoji: e.target.value } : s) }))} />
                  <input className="input-field sm:col-span-2" placeholder="Section name" value={section.name} onChange={(e) => setModel((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === sectionIndex ? { ...s, name: e.target.value } : s) }))} />
                </div>
                <select className="input-field w-full" value={section.assignedTo || ''} onChange={(e) => setModel((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === sectionIndex ? { ...s, assignedTo: e.target.value || undefined } : s) }))}>
                  <option value="">No default assignee</option>
                  {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-2">
                    <input className="input-field flex-1" value={item.text} placeholder="Checklist item" onChange={(e) => setModel((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === sectionIndex ? { ...s, items: s.items.map((x, xi) => xi === itemIndex ? { ...x, text: e.target.value } : x) } : s) }))} />
                    <label className="text-xs inline-flex items-center gap-1"><input type="checkbox" checked={item.isCritical} onChange={(e) => setModel((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === sectionIndex ? { ...s, items: s.items.map((x, xi) => xi === itemIndex ? { ...x, isCritical: e.target.checked } : x) } : s) }))} /> Critical</label>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs" onClick={() => setModel((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === sectionIndex ? { ...s, items: [...s.items, { text: '', isCritical: false }] } : s) }))}>Add Item</button>
                  <button className="btn-secondary text-xs text-servio-red-600" onClick={() => setModel((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== sectionIndex) }))}>Remove Section</button>
                </div>
              </div>
            ))}

            <button className="btn-secondary" onClick={() => setModel((prev) => ({ ...prev, sections: [...prev.sections, { name: '', emoji: '📋', items: [] }] }))}>Add Section</button>

            <div className="flex justify-between">
              <button className="btn-secondary text-servio-red-600 inline-flex items-center" onClick={() => removeTemplate(model.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </button>
              <button className="btn-primary inline-flex items-center" onClick={save}>
                <ClipboardList className="w-4 h-4 mr-2" /> Save Template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
