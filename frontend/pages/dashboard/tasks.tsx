import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { CheckCircle, Plus, Filter, Clock, User, Calendar, Trash2, Edit } from 'lucide-react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'

interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  assignedTo?: string
  assignedToName?: string
  dueDate?: string
  createdAt: string
  updatedAt: string
}

export default function TasksPage() {
  const { user, hasPermission, isManagerOrOwner } = useUser()
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const canCreateTasks = isManagerOrOwner() || hasPermission('tasks', 'create')
  const canUpdateTasks = isManagerOrOwner() || hasPermission('tasks', 'update')
  const canDeleteTasks = isManagerOrOwner() || hasPermission('tasks', 'delete')

  const fetchTasks = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (priorityFilter !== 'all') params.priority = priorityFilter

      const res = await api.get('/api/tasks', { params })
      setTasks(res.data?.data?.tasks || [])
    } catch (e: any) {
      const errorMsg = e?.response?.data?.error?.message || 'Failed to load tasks'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!hasPermission('tasks', 'read')) return
    fetchTasks()
  }, [statusFilter, priorityFilter])

  const handleStatusUpdate = async (taskId: string, newStatus: Task['status']) => {
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus })
      toast.success('Task status updated')
      fetchTasks()
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update task')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await api.delete(`/api/tasks/${taskId}`)
      toast.success('Task deleted')
      fetchTasks()
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to delete task')
    }
  }

  const getStatusBadgeClass = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'status-success'
      case 'in_progress':
        return 'status-info'
      case 'pending':
        return 'status-warning'
      default:
        return ''
    }
  }

  const getPriorityBadgeClass = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'status-error'
      case 'medium':
        return 'status-warning'
      case 'low':
        return 'status-success'
      default:
        return ''
    }
  }

  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  if (!hasPermission('tasks', 'read')) {
    return (
      <DashboardLayout>
        <div className="card text-center py-12">
          <p className="text-surface-600 dark:text-surface-400">
            You don&apos;t have permission to view tasks.
          </p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Tasks - Servio Restaurant Platform</title>
      </Head>

      <DashboardLayout>
        <div className="space-y-6 pb-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 flex items-center">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 mr-2 text-primary-600" />
                Task Manager
              </h1>
              <p className="mt-2 text-sm sm:text-base text-surface-600 dark:text-surface-400">
                Manage and track team tasks efficiently
              </p>
            </div>

            {canCreateTasks && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary inline-flex items-center justify-center w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </button>
            )}
          </div>

          {error && (
            <div className="card border-2 border-servio-red-200 dark:border-servio-red-800 bg-servio-red-50 dark:bg-servio-red-950">
              <div className="text-servio-red-700 dark:text-servio-red-300">{error}</div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-surface-600 dark:text-surface-400">Pending</p>
                  <p className="mt-1 text-3xl font-bold text-servio-orange-600 dark:text-servio-orange-400">
                    {pendingTasks.length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-servio-orange-400" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-surface-600 dark:text-surface-400">In Progress</p>
                  <p className="mt-1 text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {inProgressTasks.length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-primary-400" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-surface-600 dark:text-surface-400">Completed</p>
                  <p className="mt-1 text-3xl font-bold text-servio-green-600 dark:text-servio-green-400">
                    {completedTasks.length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-servio-green-400" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-surface-600 dark:text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                Filters
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Status
                </label>
                <select
                  className="input-field w-full"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Priority
                </label>
                <select
                  className="input-field w-full"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="card">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
              Tasks ({tasks.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
                <p className="mt-4 text-surface-600 dark:text-surface-400">Loading tasks...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-4" />
                <p className="text-surface-600 dark:text-surface-400">
                  {statusFilter === 'all' && priorityFilter === 'all'
                    ? 'No tasks yet. Create your first task!'
                    : 'No tasks match your filters.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="border border-surface-200 dark:border-surface-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h4 className="font-semibold text-surface-900 dark:text-surface-100 text-base">
                            {task.title}
                          </h4>
                          <span className={getPriorityBadgeClass(task.priority)}>
                            {task.priority}
                          </span>
                        </div>
                        {task.description && (
                          <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-surface-500 dark:text-surface-500">
                          {task.assignedToName && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{task.assignedToName}</span>
                            </div>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canUpdateTasks && (
                          <select
                            className="input-field text-sm py-1 px-2 min-w-[120px]"
                            value={task.status}
                            onChange={(e) =>
                              handleStatusUpdate(task.id, e.target.value as Task['status'])
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        )}
                        {!canUpdateTasks && (
                          <span className={getStatusBadgeClass(task.status)}>
                            {task.status.replace('_', ' ')}
                          </span>
                        )}

                        {canDeleteTasks && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="btn-icon text-servio-red-600 hover:text-servio-red-700 dark:text-servio-red-400"
                            title="Delete task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Task Modal */}
        {showCreateModal && (
          <TaskFormModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false)
              fetchTasks()
            }}
          />
        )}
      </DashboardLayout>
    </>
  )
}

// Simple Task Form Modal Component
function TaskFormModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending' as Task['status'],
    priority: 'medium' as Task['priority'],
    dueDate: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error('Task title is required')
      return
    }

    setIsSubmitting(true)
    try {
      await api.post('/api/tasks', formData)
      toast.success('Task created successfully')
      onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create task')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-4">
            Create New Task
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                className="input-field w-full"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Description
              </label>
              <textarea
                className="input-field w-full"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Status
                </label>
                <select
                  className="input-field w-full"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as Task['status'] })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Priority
                </label>
                <select
                  className="input-field w-full"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value as Task['priority'] })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                className="input-field w-full"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
