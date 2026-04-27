import React, { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Check, Settings, RefreshCw, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  ChecklistInstance,
  ChecklistSection as ChecklistSectionType,
  ChecklistItem as ChecklistItemType,
  ChecklistCompletion,
  getItemCompletion,
  getSectionProgress,
  getOverallProgress,
  formatDate,
  isToday
} from '../../services/checklistService';

interface ChecklistViewProps {
  onManageTemplates: () => void;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export default function ChecklistView({ onManageTemplates }: ChecklistViewProps) {
  const { user, hasPermission, isManagerOrOwner } = useUser();
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [togglingItem, setTogglingItem] = useState<number | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [historyView, setHistoryView] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const isStaff = user?.role === 'staff';
  const canManageTemplates = !isStaff && (isManagerOrOwner || hasPermission('checklists', 'create'));

  const fetchChecklists = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (historyView) {
        params.from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params.to = selectedDate;
        const res = await api.get('/api/checklists/history', { params });
        setHistory(res.data?.data?.instances || []);
      } else {
        params.date = selectedDate;
        const res = await api.get('/api/checklists/today', { params });
        setInstances(res.data?.data?.instances || []);
        
        // Expand all sections by default
        const sectionIds = new Set<string>();
        res.data?.data?.instances?.forEach((instance: ChecklistInstance) => {
          instance.template.sections.forEach((section) => {
            sectionIds.add(`${instance.id}-${section.id}`);
          });
        });
        setExpandedSections(sectionIds);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to load checklists');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, historyView]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/api/tasks/staff');
      setStaff(res.data?.data?.staff || []);
    } catch (e) {
      console.error('Failed to load staff:', e);
    }
  };

  useEffect(() => {
    fetchChecklists();
    if (!isStaff) {
      fetchStaff();
    }
  }, [fetchChecklists]);

  const handleToggleItem = async (instanceId: number, itemId: number) => {
    setTogglingItem(itemId);
    try {
      const res = await api.post(`/api/checklists/${instanceId}/toggle/${itemId}`);
      const { completed, completed_by, completed_at, instance_status, percent_complete } = res.data?.data;

      // Update local state
      setInstances(prev => prev.map(instance => {
        if (instance.id !== instanceId) return instance;

        let newCompletions: ChecklistCompletion[];
        if (completed) {
          newCompletions = [
            ...instance.completions,
            { id: 0, instance_id: instanceId, item_id: itemId, completed_by: completed_by ? parseInt(completed_by) : null, completed_at: completed_at || new Date().toISOString() }
          ];
        } else {
          newCompletions = instance.completions.filter(c => c.item_id !== itemId);
        }

        return {
          ...instance,
          completions: newCompletions,
          status: instance_status as any
        };
      }));

      if (completed) {
        toast.success('Item completed!');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to toggle item');
    } finally {
      setTogglingItem(null);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const progress = getOverallProgress(instances);

  return (
    <div className="space-y-6">
      {/* Header with date selector and manage button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-lg">
            <Calendar className="w-4 h-4 text-surface-600 dark:text-surface-400" />
            <span className="font-medium text-surface-900 dark:text-surface-100">
              {formatDate(selectedDate)}
            </span>
            {isToday(selectedDate) && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
                Today
              </span>
            )}
          </div>
          
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            disabled={isToday(selectedDate)}
          >
            <ChevronRight className={`w-5 h-5 ${isToday(selectedDate) ? 'text-surface-300 dark:text-surface-600' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryView(!historyView)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              historyView
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
          >
            {historyView ? 'View Today' : 'View History'}
          </button>
          
          {canManageTemplates && (
            <button
              onClick={onManageTemplates}
              className="btn-secondary inline-flex items-center"
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Templates
            </button>
          )}
        </div>
      </div>

      {/* Progress Summary */}
      {!historyView && instances.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                Daily Checklists Progress
              </h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                {progress.completed} of {progress.total} items completed ({progress.percent}%)
              </p>
            </div>
            <button
              onClick={fetchChecklists}
              className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2">
            <div
              className="bg-primary-600 dark:bg-primary-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-600" />
          <p className="mt-4 text-surface-600 dark:text-surface-400">Loading checklists...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !historyView && instances.length === 0 && (
        <div className="card text-center py-12">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <Check className="w-6 h-6 text-surface-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
            No Checklists Today
          </h3>
          <p className="text-surface-600 dark:text-surface-400 mb-4">
            There are no active checklist templates scheduled for this day.
          </p>
          {canManageTemplates && (
            <button onClick={onManageTemplates} className="btn-primary">
              Create a Template
            </button>
          )}
        </div>
      )}

      {/* History View */}
      {!isLoading && historyView && (
        <div className="card">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">
            Completed Checklists (Last 30 Days)
          </h3>
          {history.length === 0 ? (
            <p className="text-surface-600 dark:text-surface-400">No completed checklists found.</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-surface-900 dark:text-surface-100">
                      {item.template_name}
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-500">
                      {formatDate(item.date)} • {item.completed_items}/{item.total_items} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
                      <div
                        className="bg-servio-green-500 h-1.5 rounded-full"
                        style={{ width: `${(item.completed_items / item.total_items) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-servio-green-600 dark:text-servio-green-400 font-medium">
                      {Math.round((item.completed_items / item.total_items) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Checklist Instances */}
      <AnimatePresence mode="wait">
        {!historyView && instances.map((instance) => (
          <motion.div
            key={instance.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-200 dark:border-surface-700">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                {instance.template.name}
              </h3>
              {instance.status === 'completed' && (
                <span className="status-success">Completed</span>
              )}
              {instance.status === 'in_progress' && (
                <span className="status-info">In Progress</span>
              )}
            </div>

            {instance.template.description && (
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
                {instance.template.description}
              </p>
            )}

            <div className="space-y-3">
              {instance.template.sections.map((section) => (
                <SectionAccordion
                  key={`${instance.id}-${section.id}`}
                  instance={instance}
                  section={section}
                  expanded={expandedSections.has(`${instance.id}-${section.id}`)}
                  onToggle={() => toggleSection(`${instance.id}-${section.id}`)}
                  onToggleItem={(itemId) => handleToggleItem(instance.id, itemId)}
                  togglingItem={togglingItem}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Section Accordion Component
interface SectionAccordionProps {
  instance: ChecklistInstance;
  section: ChecklistSectionType;
  expanded: boolean;
  onToggle: () => void;
  onToggleItem: (itemId: number) => void;
  togglingItem: number | null;
}

function SectionAccordion({
  instance,
  section,
  expanded,
  onToggle,
  onToggleItem,
  togglingItem
}: SectionAccordionProps) {
  const progress = getSectionProgress(section, instance);
  const hasCriticalItems = section.items.some(item => item.is_critical);

  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{section.emoji || '📋'}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-surface-900 dark:text-surface-100">
                {section.name}
              </span>
              {hasCriticalItems && (
                <AlertTriangle className="w-4 h-4 text-servio-orange-500" />
              )}
            </div>
            {section.assigned_to_name && (
              <span className="text-xs text-surface-500 dark:text-surface-500">
                Assigned to: {section.assigned_to_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-surface-600 dark:text-surface-400">
            {progress.completed}/{progress.total} ✓
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-surface-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-surface-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-2 border-t border-surface-200 dark:border-surface-700">
              {section.items.map((item) => {
                const completion = getItemCompletion(instance, item.id);
                const isCompleted = !!completion;
                const isToggling = togglingItem === item.id;

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                      isCompleted
                        ? 'bg-servio-green-50 dark:bg-servio-green-950/30'
                        : item.is_critical
                        ? 'bg-servio-orange-50 dark:bg-servio-orange-950/30'
                        : 'hover:bg-surface-50 dark:hover:bg-surface-800'
                    }`}
                  >
                    <button
                      onClick={() => onToggleItem(item.id)}
                      disabled={isToggling}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-servio-green-500 border-servio-green-500'
                          : item.is_critical
                          ? 'border-servio-orange-400 hover:border-servio-orange-500'
                          : 'border-surface-300 dark:border-surface-600 hover:border-primary-500'
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isCompleted ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : null}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center gap-2 ${isCompleted ? 'line-through text-surface-400 dark:text-surface-600' : ''}`}>
                        <span className={`text-sm ${isCompleted ? 'text-surface-400 dark:text-surface-600' : item.is_critical ? 'text-servio-orange-700 dark:text-servio-orange-400 font-medium' : 'text-surface-700 dark:text-surface-300'}`}>
                          {item.text}
                        </span>
                        {item.is_critical && !isCompleted && (
                          <AlertTriangle className="w-3 h-3 text-servio-orange-500 flex-shrink-0" />
                        )}
                      </div>
                      {isCompleted && completion?.completed_by_name && (
                        <p className="text-xs text-surface-400 dark:text-surface-600 mt-0.5">
                          Completed by {completion.completed_by_name} at {new Date(completion.completed_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
