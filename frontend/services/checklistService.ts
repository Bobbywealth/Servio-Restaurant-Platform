import { api } from '../lib/api';

// Types
export interface ChecklistItem {
  id: number;
  section_id: number;
  text: string;
  sort_order: number;
  is_critical: boolean;
}

export interface ChecklistSection {
  id: number;
  template_id: number;
  name: string;
  emoji: string | null;
  sort_order: number;
  assigned_to: number | null;
  assigned_to_name?: string | null;
  items: ChecklistItem[];
}

export interface ChecklistTemplate {
  id: number;
  restaurant_id: number;
  name: string;
  description: string | null;
  recurrence: 'daily' | 'weekly' | 'custom';
  recurrence_days: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sections: ChecklistSection[];
}

export interface ChecklistCompletion {
  id: number;
  instance_id: number;
  item_id: number;
  completed_by: number | null;
  completed_by_name?: string | null;
  completed_at: string;
}

export interface ChecklistInstance {
  id: number;
  template_id: number;
  restaurant_id: number;
  date: string;
  status: 'active' | 'in_progress' | 'completed';
  completed_at: string | null;
  created_at: string;
  template: ChecklistTemplate;
  completions: ChecklistCompletion[];
}

export interface SectionInput {
  name: string;
  emoji?: string;
  assigned_to?: number;
  items: {
    text: string;
    is_critical?: boolean;
  }[];
}

export interface TemplateInput {
  name: string;
  description?: string;
  recurrence?: 'daily' | 'weekly' | 'custom';
  recurrence_days?: number[];
  is_active?: boolean;
  sections?: SectionInput[];
}

// API Functions

/**
 * Get all checklist templates
 */
export async function getTemplates(): Promise<ChecklistTemplate[]> {
  const response = await api.get('/api/checklists/templates');
  return response.data?.data?.templates || [];
}

/**
 * Create a new checklist template
 */
export async function createTemplate(data: TemplateInput): Promise<ChecklistTemplate> {
  const response = await api.post('/api/checklists/templates', data);
  return response.data?.data?.template;
}

/**
 * Update a checklist template
 */
export async function updateTemplate(id: number, data: Partial<TemplateInput>): Promise<ChecklistTemplate> {
  const response = await api.put(`/api/checklists/templates/${id}`, data);
  return response.data?.data?.template;
}

/**
 * Delete a checklist template
 */
export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/api/checklists/templates/${id}`);
}

/**
 * Get today's checklist instances (auto-creates if missing)
 */
export async function getTodayChecklists(date?: string): Promise<{ instances: ChecklistInstance[]; date: string }> {
  const params = date ? { date } : {};
  const response = await api.get('/api/checklists/today', { params });
  return {
    instances: response.data?.data?.instances || [],
    date: response.data?.data?.date
  };
}

/**
 * Toggle item completion
 */
export async function toggleItemCompletion(
  instanceId: number,
  itemId: number
): Promise<{
  item_id: number;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  instance_status: string;
  percent_complete: number;
}> {
  const response = await api.post(`/api/checklists/${instanceId}/toggle/${itemId}`);
  return response.data?.data;
}

/**
 * Get checklist history
 */
export async function getChecklistHistory(from?: string, to?: string): Promise<ChecklistInstance[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  
  const response = await api.get('/api/checklists/history', { params });
  return response.data?.data?.instances || [];
}

// Utility functions

/**
 * Get completion status for an item in an instance
 */
export function getItemCompletion(
  instance: ChecklistInstance,
  itemId: number
): ChecklistCompletion | undefined {
  return instance.completions.find(c => c.item_id === itemId);
}

/**
 * Calculate section completion progress
 */
export function getSectionProgress(
  section: ChecklistSection,
  instance: ChecklistInstance
): { completed: number; total: number; percent: number } {
  const total = section.items.length;
  const completed = section.items.filter(item => 
    instance.completions.some(c => c.item_id === item.id)
  ).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

/**
 * Calculate overall checklist progress
 */
export function getOverallProgress(instances: ChecklistInstance[]): { completed: number; total: number; percent: number } {
  let total = 0;
  let completed = 0;
  
  for (const instance of instances) {
    for (const section of instance.template.sections) {
      total += section.items.length;
      completed += section.items.filter(item =>
        instance.completions.some(c => c.item_id === item.id)
      ).length;
    }
  }
  
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Check if date is today
 */
export function isToday(dateString: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateString === today;
}

/**
 * Get day name from day index
 */
export function getDayName(dayIndex: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] || '';
}
