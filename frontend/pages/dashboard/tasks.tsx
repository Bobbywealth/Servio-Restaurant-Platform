import React, { useEffect, useState, useCallback, useRef } from 'react'
import Head from 'next/head'
import { CheckCircle, Plus, Filter, Clock, User, Calendar, Trash2, Edit, LayoutList, LayoutGrid, GripVertical } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { useUser } from '../../contexts/UserContext'
import { api } from '../../lib/api'
import { socketManager } from '../../lib/socket'
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

interface StaffMember {
  id: string
  name: string
  email?: string | null
  role: string
  permissions: string
  is_active: number
  created_at: string
}

export default function TasksPage() {
  const { user, hasPermission, isManagerOrOwner } = useUser()
  const [tasks, setTasks] = useState<Task[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const canCreateTasks = isManagerOrOwner || hasPermission('tasks', 'create')
  const canUpdateTasks = isManagerOrOwner || hasPermission('tasks', 'update')
  const canDeleteTasks = isManagerOrOwner || hasPermission('tasks', 'delete')

  const fetchTasks = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (priorityFilter !== 'all') params.priority = priorityFilter
      if (assignedToFilter !== 'all') params.assignedTo = assignedToFilter

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

  const fetchStaff = async () => {
    try {
      const res = await api.get('/api/tasks/staff')
      setStaff(res.data?.data?.staff || [])
    } catch (e: any) {
      console.error('Failed to load staff:', e)
    }
  }

  useEffect(() => {
    if (!hasPermission('tasks', 'read')) return
    fetchTasks()
    fetchStaff()
  }, [statusFilter, priorityFilter, assignedToFilter])

  // Socket listeners for real-time updates
  useEffect(() => {
    const handleTaskUpdate = (data: { taskId: string; task?: Task; action: string }) => {
      console.log('Task update received:', data)
      fetchTasks()
    }

    const handleTaskAssigned = (data: { taskId: string; assignedTo: string }) => {
      console.log('Task assigned:', data)
      fetchTasks()
    }

    const handleTaskCompleted = (data: { taskId: string }) => {
      console.log('Task completed:', data)
      fetchTasks()
    }

    const handleTaskOverdue = (data: { taskId: string }) => {
      console.log('Task overdue:', data)
      toast.error('A task is now overdue!')
      fetchTasks()
    }

    // Connect and listen
    if (!socketManager.connected) {
      socketManager.connect()
    }

    socketManager.on('task:updated', handleTaskUpdate)
    socketManager.on('task:assigned', handleTaskAssigned)
    socketManager.on('task:completed', handleTaskCompleted)
    socketManager.on('task:overdue', handleTaskOverdue)

    return () => {
      socketManager.off('task:updated', handleTaskUpdate)
      socketManager.off('task:assigned', handleTaskAssigned)
      socketManager.off('task:completed', handleTaskCompleted)
      socketManager.off('task:overdue', handleTaskOverdue)
    }
  }, [])

  const handleStatusUpdate = async (taskId: string, newStatus: Task['status']) => {
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus })
      toast.success('Task status updated')
      fetchTasks()
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update task')
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
  }

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null)
      return
    }

    // Optimistically update UI
    setTasks(prev => prev.map(t =>
      t.id === draggedTask.id ? { ...t, status: newStatus } : t
    ))

    // API call
    try {
      await api.put(`/api/tasks/${draggedTask.id}`, { status: newStatus })
      toast.success('Task moved successfully')
      fetchTasks()
    } catch (e: any) {
      // Revert on error
      toast.error(e?.response?.data?.error?.message || 'Failed to move task')
      fetchTasks()
    }

    setDraggedTask(null)
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Assigned To
                </label>
                <select
                  className="input-field w-full"
                  value={assignedToFilter}
                  onChange={(e) => setAssignedToFilter(e.target.value)}
                >
                  <option value="all">All Staff</option>
                  <option value="unassigned">Unassigned</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
              Tasks ({tasks.length})
            </h3>
            <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                <LayoutList className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </button>
            </div>
          </div>

          {/* List View */}
          <AnimatePresence mode="wait">
            {viewMode === 'list' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card"
              >
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Kanban View */}
          <AnimatePresence mode="wait">
            {viewMode === 'kanban' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {/* Pending Column */}
                <KanbanColumn
                  title="To Do"
                  status="pending"
                  tasks={pendingTasks}
                  count={pendingTasks.length}
                  color="amber"
                  draggedTask={draggedTask}
                  dragOverColumn={dragOverColumn}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  canUpdate={canUpdateTasks}
                  onStatusUpdate={handleStatusUpdate}
                  onDelete={canDeleteTasks ? handleDeleteTask : undefined}
                  getPriorityBadgeClass={getPriorityBadgeClass}
                />

                {/* In Progress Column */}
                <KanbanColumn
                  title="In Progress"
                  status="in_progress"
                  tasks={inProgressTasks}
                  count={inProgressTasks.length}
                  color="blue"
                  draggedTask={draggedTask}
                  dragOverColumn={dragOverColumn}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  canUpdate={canUpdateTasks}
                  onStatusUpdate={handleStatusUpdate}
                  onDelete={canDeleteTasks ? handleDeleteTask : undefined}
                  getPriorityBadgeClass={getPriorityBadgeClass}
                />

                {/* Completed Column */}
                <KanbanColumn
                  title="Done"
                  status="completed"
                  tasks={completedTasks}
                  count={completedTasks.length}
                  color="green"
                  draggedTask={draggedTask}
                  dragOverColumn={dragOverColumn}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  canUpdate={canUpdateTasks}
                  onStatusUpdate={handleStatusUpdate}
                  onDelete={canDeleteTasks ? handleDeleteTask : undefined}
                  getPriorityBadgeClass={getPriorityBadgeClass}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Create/Edit Task Modal */}
        {showCreateModal && (
          <TaskFormModal
            staff={staff}
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

// Kanban Column Component
function KanbanColumn({
  title,
  status,
  tasks,
  count,
  color,
  draggedTask,
  dragOverColumn,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  canUpdate,
  onStatusUpdate,
  onDelete,
  getPriorityBadgeClass
}: {
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  tasks: Task[]
  count: number
  color: string
  draggedTask: Task | null
  dragOverColumn: string | null
  onDragStart: (e: React.DragEvent, task: Task) => void
  onDragOver: (e: React.DragEvent, status: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, status: 'pending' | 'in_progress' | 'completed') => void
  canUpdate: boolean
  onStatusUpdate: (taskId: string, newStatus: Task['status']) => void
  onDelete?: (taskId: string) => void
  getPriorityBadgeClass: (priority: Task['priority']) => string
}) {
  const colorClasses = {
    amber: {
      bg: 'bg-amber-500',
      lightBg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300'
    },
    blue: {
      bg: 'bg-blue-500',
      lightBg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300'
    },
    green: {
      bg: 'bg-green-500',
      lightBg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300'
    }
  }

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.amber
  const isDropTarget = dragOverColumn === status

  return (
    <div
      className={`flex flex-col rounded-xl border-2 transition-all duration-200 ${
        isDropTarget
          ? `${colors.lightBg} ${colors.border} shadow-lg scale-[1.02]`
          : 'bg-surface-50 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700'
      }`}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column Header */}
      <div className={`flex items-center justify-between p-4 border-b ${colors.border}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
          <h3 className="font-semibold text-surface-900 dark:text-white">{title}</h3>
        </div>
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${colors.lightBg} ${colors.text}`}>
          {count}
        </span>
      </div>

      {/* Tasks Container */}
      <div className="flex-1 p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-surface-400 dark:text-surface-500 text-sm">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => onDragStart(e, task)}
              className={`bg-white dark:bg-surface-800 rounded-lg p-3 shadow-sm border border-surface-200 dark:border-surface-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                draggedTask?.id === task.id ? 'opacity-50 scale-95' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="w-4 h-4 text-surface-400 flex-shrink-0 cursor-grab" />
                    <h4 className="font-medium text-surface-900 dark:text-white text-sm truncate">
                      {task.title}
                    </h4>
                  </div>
                  {task.description && (
                    <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-2 mb-2 ml-6">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-surface-500 dark:text-surface-400 ml-6">
                    {task.assignedToName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.assignedToName}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Priority & Actions */}
              <div className="flex items-center justify-between mt-3 ml-6">
                <span className={getPriorityBadgeClass(task.priority)}>
                  {task.priority}
                </span>
                <div className="flex items-center gap-1">
                  {canUpdate && (
                    <select
                      className="text-xs py-1 px-2 rounded border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-surface-700 dark:text-surface-300 cursor-pointer"
                      value={task.status}
                      onChange={(e) => onStatusUpdate(task.id, e.target.value as Task['status'])}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="pending">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Done</option>
                    </select>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(task.id)
                      }}
                      className="p-1 text-surface-400 hover:text-servio-red-600 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Simple Task Form Modal Component
function TaskFormModal({ staff, onClose, onSuccess }: { staff: StaffMember[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending' as Task['status'],
    priority: 'medium' as Task['priority'],
    assignedTo: '',
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
      await api.post('/api/tasks', {
        ...formData,
        assignedTo: formData.assignedTo || undefined,
      })
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
      <div
        className="bg-white dark:bg-surface-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))' }}
      >
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
                className="input-field w-full min-h-[44px] scroll-mt-24"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 300);
                }}
                placeholder="Enter task title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Description
              </label>
              <textarea
                className="input-field w-full scroll-mt-24"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 300);
                }}
                placeholder="Enter task description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Assign To
              </label>
              <select
                className="input-field w-full min-h-[44px]"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              >
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Status
                </label>
                <select
                  className="input-field w-full min-h-[44px]"
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
                  className="input-field w-full min-h-[44px]"
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
                className="input-field w-full min-h-[44px] scroll-mt-24"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 300);
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 min-h-[44px]"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1 min-h-[44px]" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
