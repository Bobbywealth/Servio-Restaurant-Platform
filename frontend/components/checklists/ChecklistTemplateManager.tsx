import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, GripVertical, Save, Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  ChecklistTemplate,
  ChecklistSection,
  ChecklistItem,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDayName
} from '../../services/checklistService';

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface ChecklistTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ChecklistTemplateManager({ isOpen, onClose, onSaved }: ChecklistTemplateManagerProps) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [view, setView] = useState<'list' | 'edit'>('list');

  // Form state
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<SectionFormState[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [templatesData, staffData] = await Promise.all([
        getTemplates(),
        api.get('/api/tasks/staff').then(res => res.data?.data?.staff || [])
      ]);
      setTemplates(templatesData);
      setStaff(staffData);
    } catch (e: any) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setRecurrence('daily');
    setRecurrenceDays([1, 2, 3, 4, 5, 6, 0]);
    setIsActive(true);
    setSections([{ id: Date.now(), name: '', emoji: '', assigned_to: undefined, items: [{ id: Date.now(), text: '', is_critical: false }] }]);
    setView('edit');
  };

  const handleEdit = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setRecurrence(template.recurrence as any);
    setRecurrenceDays(template.recurrence_days);
    setIsActive(template.is_active);
    setSections(template.sections.map(s => ({
      id: s.id,
      name: s.name,
      emoji: s.emoji || '',
      assigned_to: s.assigned_to ?? undefined,
      items: s.items.map(i => ({ id: i.id, text: i.text, is_critical: i.is_critical }))
    })));
    setView('edit');
  };

  const handleDelete = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await deleteTemplate(templateId);
      toast.success('Template deleted');
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to delete template');
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (sections.length === 0) {
      toast.error('At least one section is required');
      return;
    }

    const hasEmptySection = sections.some(s => !s.name.trim());
    if (hasEmptySection) {
      toast.error('All sections must have a name');
      return;
    }

    const hasEmptyItem = sections.some(s => s.items.some(i => !i.text.trim()));
    if (hasEmptyItem) {
      toast.error('All items must have text');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: templateName,
        description: templateDescription || undefined,
        recurrence,
        recurrence_days: recurrenceDays,
        is_active: isActive,
        sections: sections.map((s, si) => ({
          name: s.name,
          emoji: s.emoji || undefined,
          assigned_to: s.assigned_to || undefined,
          items: s.items.map((i, ii) => ({
            text: i.text,
            is_critical: i.is_critical
          }))
        }))
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, data);
        toast.success('Template updated');
      } else {
        await createTemplate(data);
        toast.success('Template created');
      }

      setView('list');
      fetchData();
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    setSections(prev => [
      ...prev,
      { id: Date.now(), name: '', emoji: '', assigned_to: undefined, items: [{ id: Date.now(), text: '', is_critical: false }] }
    ]);
  };

  const removeSection = (sectionId: number) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  };

  const updateSection = (sectionId: number, field: string, value: any) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, [field]: value } : s
    ));
  };

  const addItem = (sectionId: number) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, items: [...s.items, { id: Date.now(), text: '', is_critical: false }] };
    }));
  };

  const removeItem = (sectionId: number, itemId: number) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, items: s.items.filter(i => i.id !== itemId) };
    }));
  };

  const updateItem = (sectionId: number, itemId: number, field: string, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, items: s.items.map(i => 
        i.id === itemId ? { ...i, [field]: value } : i
      )};
    }));
  };

  const toggleRecurrenceDay = (day: number) => {
    setRecurrenceDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-surface-900 rounded-xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-700">
              <div>
                <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
                  {view === 'list' ? 'Manage Checklist Templates' : editingTemplate ? 'Edit Template' : 'Create Template'}
                </h2>
                {view === 'edit' && (
                  <p className="text-sm text-surface-500 dark:text-surface-500">
                    {editingTemplate ? `Editing "${editingTemplate.name}"` : 'Create a new checklist template'}
                  </p>
                )}
              </div>
              <button
                onClick={() => view === 'edit' ? setView('list') : onClose()}
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
              ) : view === 'list' ? (
                <div className="space-y-4">
                  <button
                    onClick={handleCreateNew}
                    className="w-full btn-primary py-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Template
                  </button>

                  {templates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-surface-500 dark:text-surface-500">No templates yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templates.map(template => (
                        <div
                          key={template.id}
                          className="p-4 border border-surface-200 dark:border-surface-700 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                                  {template.name}
                                </h3>
                                {!template.is_active && (
                                  <span className="status-warning">Inactive</span>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                                  {template.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-surface-500 dark:text-surface-500">
                                <span>{template.sections.length} sections</span>
                                <span>•</span>
                                <span>{template.sections.reduce((acc, s) => acc + s.items.length, 0)} items</span>
                                <span>•</span>
                                <span className="capitalize">{template.recurrence}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(template)}
                                className="px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="p-1.5 text-surface-400 hover:text-servio-red-500 hover:bg-servio-red-50 dark:hover:bg-servio-red-900/30 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Template Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Template Name *
                      </label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="input-field w-full"
                        placeholder="e.g., Sashey's Kitchen - Opening"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        className="input-field w-full"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>

                  {/* Recurrence */}
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Recurrence
                    </label>
                    <div className="flex gap-4 mb-3">
                      {(['daily', 'weekly', 'custom'] as const).map(type => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="recurrence"
                            value={type}
                            checked={recurrence === type}
                            onChange={() => setRecurrence(type)}
                            className="text-primary-600"
                          />
                          <span className="text-sm text-surface-700 dark:text-surface-300 capitalize">
                            {type}
                          </span>
                        </label>
                      ))}
                    </div>
                    
                    {recurrence === 'custom' && (
                      <div className="flex flex-wrap gap-2">
                        {[0, 1, 2, 3, 4, 5, 6].map(day => (
                          <button
                            key={day}
                            onClick={() => toggleRecurrenceDay(day)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              recurrenceDays.includes(day)
                                ? 'bg-primary-600 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                            }`}
                          >
                            {getDayName(day).slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-surface-600 peer-checked:bg-primary-600"></div>
                    </label>
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Active (will generate daily instances)
                    </span>
                  </div>

                  {/* Sections */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                        Sections
                      </h3>
                      <button
                        onClick={addSection}
                        className="btn-secondary text-sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Section
                      </button>
                    </div>

                    {sections.map((section, sectionIndex) => (
                      <div
                        key={section.id}
                        className="border border-surface-200 dark:border-surface-700 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-surface-400 cursor-grab" />
                          <input
                            type="text"
                            value={section.emoji}
                            onChange={(e) => updateSection(section.id, 'emoji', e.target.value)}
                            className="w-16 input-field text-center text-lg"
                            placeholder="emoji"
                          />
                          <input
                            type="text"
                            value={section.name}
                            onChange={(e) => updateSection(section.id, 'name', e.target.value)}
                            className="flex-1 input-field"
                            placeholder="Section name (e.g., Kitchen Preparation)"
                          />
                          <select
                            value={section.assigned_to || ''}
                            onChange={(e) => updateSection(section.id, 'assigned_to', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="input-field w-40"
                          >
                            <option value="">No assignment</option>
                            {staff.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeSection(section.id)}
                            className="p-2 text-surface-400 hover:text-servio-red-500 hover:bg-servio-red-50 dark:hover:bg-servio-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Items */}
                        <div className="pl-8 space-y-2">
                          {section.items.map((item, itemIndex) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={item.is_critical}
                                onChange={(e) => updateItem(section.id, item.id, 'is_critical', e.target.checked)}
                                className="w-4 h-4 text-servio-orange-500 rounded border-surface-300"
                                title="Mark as critical"
                              />
                              {item.is_critical && <AlertTriangle className="w-4 h-4 text-servio-orange-500 -ml-1" />}
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) => updateItem(section.id, item.id, 'text', e.target.value)}
                                className="flex-1 input-field text-sm"
                                placeholder="Item text"
                              />
                              <button
                                onClick={() => removeItem(section.id, item.id)}
                                className="p-1 text-surface-400 hover:text-servio-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addItem(section.id)}
                            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Item
                          </button>
                        </div>
                      </div>
                    ))}

                    {sections.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-lg">
                        <p className="text-surface-500 dark:text-surface-500 mb-2">No sections yet</p>
                        <button onClick={addSection} className="btn-secondary text-sm">
                          Add First Section
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {view === 'edit' && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                <button
                  onClick={() => setView('list')}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SectionFormState {
  id: number;
  name: string;
  emoji: string;
  assigned_to?: number;
  items: {
    id: number;
    text: string;
    is_critical: boolean;
  }[];
}
